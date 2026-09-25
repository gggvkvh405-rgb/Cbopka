import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  maxHttpBufferSize: 1e8
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Try to load optional deps ---
let multer = null;
let Database = null;
let db = null;
let useSQLite = false;

if (process.env.DISABLE_MULTER !== '1') {
  try {
    const multerMod = await import('multer');
    multer = multerMod.default;
    console.log('✅ multer loaded');
  } catch (e) {
    console.log('⚠️ multer not available, file upload disabled:', e.message);
  }
} else {
  console.log('⚠️ multer disabled via DISABLE_MULTER');
}

if (process.env.DISABLE_SQLITE !== '1') {
  try {
    const dbMod = await import('better-sqlite3');
    Database = dbMod.default;
    const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'cbopka.db');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  usernameLower TEXT UNIQUE,
  passwordHash TEXT,
  avatar TEXT,
  bio TEXT,
  status TEXT DEFAULT 'online',
  customStatus TEXT DEFAULT '',
  lastSeen INTEGER,
  createdAt INTEGER,
  theme TEXT DEFAULT 'dark',
  isVerified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT,
  createdAt INTEGER
);
CREATE TABLE IF NOT EXISTS friendships (
  userId TEXT,
  friendId TEXT,
  PRIMARY KEY (userId, friendId)
);
CREATE TABLE IF NOT EXISTS friendRequests (
  id TEXT PRIMARY KEY,
  fromId TEXT,
  toId TEXT,
  status TEXT,
  at INTEGER
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT,
  avatar TEXT,
  description TEXT,
  inviteCode TEXT UNIQUE,
  createdAt INTEGER
);
CREATE TABLE IF NOT EXISTS groupMembers (
  groupId TEXT,
  userId TEXT,
  isAdmin INTEGER DEFAULT 0,
  PRIMARY KEY (groupId, userId)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  convoId TEXT,
  fromId TEXT,
  text TEXT,
  at INTEGER,
  type TEXT DEFAULT 'text',
  meta TEXT,
  edited INTEGER DEFAULT 0,
  replyTo TEXT,
  reactions TEXT DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  originalName TEXT,
  mimeType TEXT,
  size INTEGER,
  path TEXT,
  uploaderId TEXT,
  at INTEGER
);
`);
  try{ db.exec(`ALTER TABLE groups ADD COLUMN inviteCode TEXT UNIQUE`); }catch{}
  useSQLite = true;
  console.log(`✅ SQLite persistence at ${DB_PATH}`);
} catch (e) {
  console.log('⚠️ better-sqlite3 not available, using in-memory storage:', e.message);
  useSQLite = false;
}
} else {
  console.log('⚠️ SQLite disabled via DISABLE_SQLITE, using in-memory');
  useSQLite = false;
}

// --- In-memory fallback ---
const memUsers = new Map();
const memUsersByName = new Map();
const memSessions = new Map();
const memFriendships = new Map();
const memFriendRequests = [];
const memMessages = new Map();
const memGroups = new Map();

// Load sessions into cache if SQLite
const sessionsCache = new Map();
const userSockets = new Map();
const calls = new Map();
const onlineMap = new Map();

if (useSQLite && db) {
  try {
    for(const row of db.prepare('SELECT token, userId FROM sessions').all()){
      sessionsCache.set(row.token, row.userId);
    }
  } catch {}
}

const clientDistPath = process.env.CLIENT_DIST_PATH || path.join(__dirname, '../client/dist');
console.log(`Client dist path: ${clientDistPath}, exists: ${fs.existsSync(clientDistPath)}`);
if(fs.existsSync(clientDistPath)){
  app.use(express.static(clientDistPath));
  // Also serve assets explicitly for file:// fallback
  const assetsPath = path.join(clientDistPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    app.use('/assets', express.static(assetsPath));
  }
}

// --- Upload setup ---
const uploadDir = path.join(__dirname, 'uploads');
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive:true});

let upload = null;
if (multer) {
  const storage = multer.diskStorage({
    destination: (req,file,cb)=> cb(null, uploadDir),
    filename: (req,file,cb)=> {
      const id = uuidv4();
      const ext = path.extname(file.originalname);
      cb(null, id + ext);
    }
  });
  upload = multer({ storage, limits: { fileSize: 100*1024*1024 } });
  app.use('/uploads', express.static(uploadDir));
}

// --- Helpers ---
function getConvoId(a,b){ return [a,b].sort().join('_'); }
function getUserPublic(u){
  if(!u) return null;
  const {passwordHash, ...pub} = u;
  return pub;
}

function getUserById(id){
  if (useSQLite && db) {
    try { return db.prepare('SELECT * FROM users WHERE id=?').get(id); } catch { return memUsers.get(id); }
  }
  return memUsers.get(id);
}
function getUserByNameLower(lower){
  if (useSQLite && db) {
    try { return db.prepare('SELECT * FROM users WHERE usernameLower=?').get(lower); } catch { return memUsersByName.get(lower); }
  }
  return memUsersByName.get(lower);
}

// --- API ---

app.post('/api/register', async (req,res)=>{
  const {username, password, avatar, bio} = req.body;
  if(!username || !password) return res.status(400).json({error:'username and password required'});
  const clean = username.trim();
  if(clean.length < 3 || clean.length > 20) return res.status(400).json({error:'username 3-20 chars'});
  const lower = clean.toLowerCase();
  if(getUserByNameLower(lower)) return res.status(400).json({error:'username taken'});
  const id = uuidv4();
  const hash = await bcrypt.hash(password, 8);
  const now = Date.now();
  const user = {
    id,
    username: clean,
    usernameLower: lower,
    passwordHash: hash,
    avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(clean)}`,
    bio: bio || 'Привет! Я использую Cbopka',
    status: 'online',
    customStatus: '',
    lastSeen: now,
    createdAt: now,
    theme: 'dark'
  };
  if (useSQLite && db) {
    try {
      db.prepare('INSERT INTO users (id, username, usernameLower, passwordHash, avatar, bio, status, customStatus, lastSeen, createdAt, theme) VALUES (@id, @username, @usernameLower, @passwordHash, @avatar, @bio, @status, @customStatus, @lastSeen, @createdAt, @theme)').run(user);
      const token = uuidv4();
      db.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?,?,?)').run(token, id, now);
      sessionsCache.set(token, id);
      onlineMap.set(id, true);
      return res.json({token, user: getUserPublic(user)});
    } catch (e) {
      console.error('SQLite register error, fallback to mem:', e.message);
    }
  }
  // Fallback mem
  memUsers.set(id, user);
  memUsersByName.set(lower, user);
  if(!memFriendships.has(id)) memFriendships.set(id, new Set());
  const token = uuidv4();
  memSessions.set(token, id);
  sessionsCache.set(token, id);
  onlineMap.set(id, true);
  res.json({token, user: getUserPublic(user)});
});

app.post('/api/login', async (req,res)=>{
  const {username, password} = req.body;
  if(!username || !password) return res.status(400).json({error:'required'});
  const lower = username.trim().toLowerCase();
  const user = getUserByNameLower(lower) || memUsersByName.get(lower);
  if(!user) return res.status(400).json({error:'user not found'});
  const ok = await bcrypt.compare(password, user.passwordHash);
  if(!ok) return res.status(400).json({error:'wrong password'});
  const token = uuidv4();
  const now = Date.now();
  if (useSQLite && db) {
    try {
      db.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?,?,?)').run(token, user.id, now);
      db.prepare('UPDATE users SET status=?, lastSeen=? WHERE id=?').run('online', now, user.id);
    } catch {}
  } else {
    memSessions.set(token, user.id);
  }
  sessionsCache.set(token, user.id);
  onlineMap.set(user.id, true);
  if (memUsers.has(user.id)) {
    const u = memUsers.get(user.id);
    u.status = 'online';
    u.lastSeen = now;
  }
  res.json({token, user: getUserPublic(user)});
});

app.get('/api/me', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const u = getUserById(uid) || memUsers.get(uid);
  if (!u) return res.status(401).json({error:'unauthorized'});
  res.json({user: getUserPublic(u)});
});

app.get('/api/users/search', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const q = (req.query.q||'').toLowerCase();
  let list = [];
  if (useSQLite && db) {
    try {
      list = db.prepare('SELECT * FROM users WHERE usernameLower LIKE ? AND id != ? LIMIT 20').all(`%${q}%`, uid).map(getUserPublic);
    } catch {
      list = [...memUsers.values()].filter(u=> u.usernameLower.includes(q) && u.id!==uid).slice(0,20).map(getUserPublic);
    }
  } else {
    list = [...memUsers.values()].filter(u=> (u.usernameLower||u.username.toLowerCase()).includes(q) && u.id!==uid).slice(0,20).map(getUserPublic);
  }
  res.json({users:list});
});

app.get('/api/friends', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  let friends = [];
  let incoming = [];
  let outgoing = [];
  if (useSQLite && db) {
    try {
      friends = db.prepare('SELECT u.* FROM users u JOIN friendships f ON f.friendId = u.id WHERE f.userId=?').all(uid).map(getUserPublic);
      incoming = db.prepare('SELECT fr.id, fr.fromId, fr.toId, fr.status, fr.at FROM friendRequests fr WHERE fr.toId=? AND fr.status="pending"').all(uid).map(r=> ({
        id: r.id, from: r.fromId, to: r.toId, status: r.status, at: r.at,
        fromUser: getUserPublic(getUserById(r.fromId))
      }));
      outgoing = db.prepare('SELECT fr.id, fr.fromId, fr.toId, fr.status, fr.at FROM friendRequests fr WHERE fr.fromId=? AND fr.status="pending"').all(uid).map(r=> ({
        id: r.id, from: r.fromId, to: r.toId, status: r.status, at: r.at,
        toUser: getUserPublic(getUserById(r.toId))
      }));
    } catch (e) {
      console.error('friends SQLite error', e.message);
    }
  }
  if (friends.length===0 && !useSQLite) {
    const fids = memFriendships.get(uid) || new Set();
    friends = [...fids].map(fid=> getUserPublic(memUsers.get(fid))).filter(Boolean);
    incoming = memFriendRequests.filter(r=> r.to===uid && r.status==='pending').map(r=> ({...r, fromUser: getUserPublic(memUsers.get(r.from))}));
    outgoing = memFriendRequests.filter(r=> r.from===uid && r.status==='pending').map(r=> ({...r, toUser: getUserPublic(memUsers.get(r.to))}));
  }
  res.json({friends, incoming, outgoing});
});

app.get('/api/groups', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const myGroups = [];
  if (useSQLite && db) {
    try {
      const groupIds = db.prepare('SELECT groupId FROM groupMembers WHERE userId=?').all(uid).map(r=>r.groupId);
      for(const gid of groupIds){
        const g = db.prepare('SELECT * FROM groups WHERE id=?').get(gid);
        if(!g) continue;
        const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(gid).map(getUserPublic);
        const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(gid).map(r=>r.userId);
        myGroups.push({...g, members, admins});
      }
    } catch {}
  } else {
    for(const g of memGroups.values()){
      if(g.members.has(uid)){
        myGroups.push({...g, members: [...g.members].map(mid=> getUserPublic(memUsers.get(mid))), admins: [...g.admins]});
      }
    }
  }
  res.json({groups: myGroups});
});

app.get('/api/messages/:convoId', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const {convoId} = req.params;
  if(convoId.includes('_')){
    const parts = convoId.split('_');
    if(!parts.includes(uid)) return res.status(403).json({error:'forbidden'});
  } else {
    if (useSQLite && db) {
      const isMember = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=?').get(convoId, uid);
      if(!isMember && !memGroups.has(convoId)) return res.status(403).json({error:'forbidden'});
    } else {
      const g = memGroups.get(convoId);
      if(!g || !g.members.has(uid)) return res.status(403).json({error:'forbidden'});
    }
  }
  let msgs = [];
  if (useSQLite && db) {
    try {
      msgs = db.prepare('SELECT * FROM messages WHERE convoId=? ORDER BY at DESC LIMIT 200').all(convoId).reverse().map(m=>{
        try{ m.meta = m.meta ? JSON.parse(m.meta) : null; }catch{}
        try{ m.reactions = m.reactions ? JSON.parse(m.reactions) : {}; }catch{ m.reactions = {}; }
        m.from = m.fromId;
        return m;
      });
    } catch {
      msgs = (memMessages.get(convoId) || []).slice(-200);
    }
  } else {
    msgs = (memMessages.get(convoId) || []).slice(-200);
  }
  res.json({messages: msgs});
});

app.get('/api/users/:id', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const u = getUserById(req.params.id) || memUsers.get(req.params.id);
  if(!u) return res.status(404).json({error:'not found'});
  res.json({user: getUserPublic(u)});
});

if (upload) {
  app.post('/api/upload', upload.single('file'), (req,res)=>{
    const token = req.headers.authorization?.replace('Bearer ','');
    const uid = sessionsCache.get(token) || memSessions.get(token);
    if(!uid) return res.status(401).json({error:'unauthorized'});
    if(!req.file) return res.status(400).json({error:'no file'});
    const id = uuidv4();
    const now = Date.now();
    if (useSQLite && db) {
      try {
        db.prepare('INSERT INTO files (id, originalName, mimeType, size, path, uploaderId, at) VALUES (?,?,?,?,?,?,?)').run(id, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, uid, now);
      } catch {}
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({id, url, name: req.file.originalname, mime: req.file.mimetype, size: req.file.size});
  });
}

app.post('/api/groups/:id/invite', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const {id} = req.params;
  let isAdmin = false;
  if (useSQLite && db) {
    try {
      isAdmin = !!db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=? AND isAdmin=1').get(id, uid);
    } catch {}
  } else {
    const g = memGroups.get(id);
    isAdmin = g && g.admins.has(uid);
  }
  if(!isAdmin) return res.status(403).json({error:'not admin'});
  const inviteCode = uuidv4().slice(0,8);
  if (useSQLite && db) {
    try { db.prepare('UPDATE groups SET inviteCode=? WHERE id=?').run(inviteCode, id); } catch {}
  } else {
    const g = memGroups.get(id);
    if(g) g.inviteCode = inviteCode;
  }
  res.json({inviteCode, link: `${req.protocol}://${req.get('host')}/?invite=${inviteCode}`});
});

app.post('/api/groups/join/:inviteCode', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const {inviteCode} = req.params;
  let g = null;
  if (useSQLite && db) {
    try { g = db.prepare('SELECT * FROM groups WHERE inviteCode=?').get(inviteCode); } catch {}
  } else {
    for(const grp of memGroups.values()){ if(grp.inviteCode===inviteCode) g=grp; }
  }
  if(!g) return res.status(404).json({error:'invite not found'});
  if (useSQLite && db) {
    try { db.prepare('INSERT OR IGNORE INTO groupMembers (groupId, userId, isAdmin) VALUES (?,?,0)').run(g.id, uid); } catch {}
  } else {
    g.members.add(uid);
  }
  res.json({group: g});
});

app.get('/api/turn', (req,res)=>{
  const turnUrl = process.env.TURN_URL;
  const turnUser = process.env.TURN_USER;
  const turnPass = process.env.TURN_PASS;
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  if(turnUrl){
    iceServers.push({ urls: turnUrl, username: turnUser, credential: turnPass });
  }
  res.json({ iceServers });
});

// Health
app.get('/api/health', (req,res)=>{
  res.json({status:'ok', sqlite: useSQLite, uptime: process.uptime()});
});

// Socket auth
io.use((socket, next)=>{
  const token = socket.handshake.auth?.token;
  const uid = sessionsCache.get(token) || memSessions.get(token);
  if(!uid) return next(new Error('unauthorized'));
  socket.userId = uid;
  next();
});

io.on('connection', (socket)=>{
  const uid = socket.userId;
  let user = getUserById(uid) || memUsers.get(uid);
  if(!user) {
    // Try to get from memUsersByName? No, disconnect
    // But allow if user exists in SQLite but not in mem cache
    user = {id: uid, username: 'Unknown', avatar: '', bio: ''};
  }
  userSockets.set(uid, socket.id);
  onlineMap.set(uid, true);
  if (useSQLite && db) {
    try { db.prepare('UPDATE users SET status=?, lastSeen=? WHERE id=?').run('online', Date.now(), uid); } catch {}
  } else if (memUsers.has(uid)) {
    const u = memUsers.get(uid);
    u.status = 'online';
    u.lastSeen = Date.now();
  }
  console.log(`user ${user.username||uid} connected ${socket.id}`);
  socket.broadcast.emit('user:online', {userId: uid});
  socket.emit('connected', {userId: uid});

  socket.on('user:update', ({avatar,bio,status,customStatus,username,theme})=>{
    if (useSQLite && db) {
      try {
        const updates = [];
        const params = [];
        if(avatar){ updates.push('avatar=?'); params.push(avatar); }
        if(bio!==undefined){ updates.push('bio=?'); params.push(bio); }
        if(status){ updates.push('status=?'); params.push(status); }
        if(customStatus!==undefined){ updates.push('customStatus=?'); params.push(customStatus); }
        if(theme){ updates.push('theme=?'); params.push(theme); }
        if(username && username.trim().length>=3){
          const newLower = username.trim().toLowerCase();
          if(!getUserByNameLower(newLower) || getUserByNameLower(newLower).id===uid){
            updates.push('username=?'); params.push(username.trim());
            updates.push('usernameLower=?'); params.push(newLower);
          }
        }
        if(updates.length){
          params.push(uid);
          db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id=?`).run(...params);
          const updated = getUserById(uid);
          io.emit('user:updated', {user: getUserPublic(updated)});
        }
        return;
      } catch (e) { console.error('user:update sqlite error', e.message); }
    }
    // Fallback mem
    const u = memUsers.get(uid);
    if(!u) return;
    if(avatar) u.avatar = avatar;
    if(bio!==undefined) u.bio = bio;
    if(status) u.status = status;
    if(customStatus!==undefined) u.customStatus = customStatus;
    if(theme) u.theme = theme;
    if(username && username.trim().length>=3){
      const oldKey = (u.usernameLower||u.username.toLowerCase());
      const newKey = username.trim().toLowerCase();
      if(oldKey!==newKey && !memUsersByName.has(newKey)){
        memUsersByName.delete(oldKey);
        memUsersByName.set(newKey, u);
        u.username = username.trim();
        u.usernameLower = newKey;
      }
    }
    io.emit('user:updated', {user: getUserPublic(u)});
  });

  socket.on('friends:request', ({toUsername, toUserId})=>{
    let targetId = toUserId;
    if(!targetId && toUsername){
      const u = getUserByNameLower(toUsername.trim().toLowerCase()) || memUsersByName.get(toUsername.trim().toLowerCase());
      if(u) targetId = u.id || u;
      if(typeof targetId === 'object') targetId = targetId.id;
    }
    if(!targetId || targetId===uid) return;
    if (useSQLite && db) {
      try {
        const exists = db.prepare('SELECT 1 FROM friendships WHERE userId=? AND friendId=?').get(uid, targetId);
        if(exists) return socket.emit('error_msg',{msg:'Уже в друзьях'});
        const pending = db.prepare('SELECT 1 FROM friendRequests WHERE fromId=? AND toId=? AND status="pending"').get(uid, targetId);
        if(pending) return;
        const id = uuidv4();
        const now = Date.now();
        db.prepare('INSERT INTO friendRequests (id, fromId, toId, status, at) VALUES (?,?,?,?,?)').run(id, uid, targetId, 'pending', now);
        const reqObj = {id, from: uid, to: targetId, status:'pending', at: now};
        const targetSocket = userSockets.get(targetId);
        if(targetSocket) io.to(targetSocket).emit('friends:request:incoming', {...reqObj, fromUser: getUserPublic(getUserById(uid)||memUsers.get(uid))});
        socket.emit('friends:request:sent', reqObj);
        return;
      } catch {}
    }
    // Mem fallback
    if(!memFriendships.has(uid)) memFriendships.set(uid, new Set());
    if(!memFriendships.has(targetId)) memFriendships.set(targetId, new Set());
    if(memFriendships.get(uid).has(targetId)) return socket.emit('error_msg',{msg:'Уже в друзьях'});
    if(memFriendRequests.find(r=> r.from===uid && r.to===targetId && r.status==='pending')) return;
    const reqObj = {id: uuidv4(), from: uid, to: targetId, status:'pending', at: Date.now()};
    memFriendRequests.push(reqObj);
    const targetSocket = userSockets.get(targetId);
    if(targetSocket) io.to(targetSocket).emit('friends:request:incoming', {...reqObj, fromUser: getUserPublic(memUsers.get(uid))});
    socket.emit('friends:request:sent', reqObj);
  });

  socket.on('friends:accept', ({requestId})=>{
    if (useSQLite && db) {
      try {
        const fr = db.prepare('SELECT * FROM friendRequests WHERE id=? AND toId=?').get(requestId, uid);
        if(!fr) return;
        db.prepare('UPDATE friendRequests SET status="accepted" WHERE id=?').run(requestId);
        db.prepare('INSERT OR IGNORE INTO friendships (userId, friendId) VALUES (?,?)').run(fr.fromId, fr.toId);
        db.prepare('INSERT OR IGNORE INTO friendships (userId, friendId) VALUES (?,?)').run(fr.toId, fr.fromId);
        const fromUser = getUserById(fr.fromId) || memUsers.get(fr.fromId);
        const toUser = getUserById(fr.toId) || memUsers.get(fr.toId);
        const s1 = userSockets.get(fr.fromId);
        const s2 = userSockets.get(fr.toId);
        if(s1) io.to(s1).emit('friends:added', {friend: getUserPublic(toUser)});
        if(s2) io.to(s2).emit('friends:added', {friend: getUserPublic(fromUser)});
        return;
      } catch {}
    }
    const fr = memFriendRequests.find(r=> r.id===requestId && r.to===uid);
    if(!fr) return;
    fr.status='accepted';
    if(!memFriendships.has(fr.from)) memFriendships.set(fr.from, new Set());
    if(!memFriendships.has(fr.to)) memFriendships.set(fr.to, new Set());
    memFriendships.get(fr.from).add(fr.to);
    memFriendships.get(fr.to).add(fr.from);
    const fromUser = memUsers.get(fr.from);
    const toUser = memUsers.get(fr.to);
    const s1 = userSockets.get(fr.from);
    const s2 = userSockets.get(fr.to);
    if(s1) io.to(s1).emit('friends:added', {friend: getUserPublic(toUser)});
    if(s2) io.to(s2).emit('friends:added', {friend: getUserPublic(fromUser)});
  });

  socket.on('friends:reject', ({requestId})=>{
    if (useSQLite && db) {
      try {
        const fr = db.prepare('SELECT * FROM friendRequests WHERE id=? AND toId=?').get(requestId, uid);
        if(!fr) return;
        db.prepare('UPDATE friendRequests SET status="rejected" WHERE id=?').run(requestId);
        socket.emit('friends:request:rejected', fr);
        const s = userSockets.get(fr.fromId);
        if(s) io.to(s).emit('friends:request:rejected', fr);
        return;
      } catch {}
    }
    const fr = memFriendRequests.find(r=> r.id===requestId && r.to===uid);
    if(!fr) return;
    fr.status='rejected';
    socket.emit('friends:request:rejected', fr);
    const s = userSockets.get(fr.from);
    if(s) io.to(s).emit('friends:request:rejected', fr);
  });

  socket.on('friends:remove', ({friendId})=>{
    if (useSQLite && db) {
      try { db.prepare('DELETE FROM friendships WHERE (userId=? AND friendId=?) OR (userId=? AND friendId=?)').run(uid, friendId, friendId, uid); } catch {}
    }
    if(memFriendships.has(uid)) memFriendships.get(uid).delete(friendId);
    if(memFriendships.has(friendId)) memFriendships.get(friendId).delete(uid);
    socket.emit('friends:removed', {friendId});
    const s = userSockets.get(friendId);
    if(s) io.to(s).emit('friends:removed', {friendId: uid});
  });

  socket.on('message:send', ({convoId, text, toUserId, type='text', meta, replyTo})=>{
    if(!text || !text.trim()) return;
    let finalConvo = convoId;
    if(toUserId) finalConvo = getConvoId(uid, toUserId);
    if(!finalConvo) return;
    if(finalConvo.includes('_')){
      const parts = finalConvo.split('_');
      if(!parts.includes(uid)) return;
    } else {
      if (useSQLite && db) {
        try {
          const isMember = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=?').get(finalConvo, uid);
          if(!isMember && !memGroups.has(finalConvo)) return;
        } catch {}
      } else {
        const g = memGroups.get(finalConvo);
        if(!g || !g.members.has(uid)) return;
      }
    }
    const id = uuidv4();
    const now = Date.now();
    const outMsg = {
      id,
      from: uid,
      fromId: uid,
      convoId: finalConvo,
      text: text.trim().slice(0,5000),
      at: now,
      type,
      meta: meta||null,
      replyTo: replyTo || null,
      reactions: {}
    };
    if (useSQLite && db) {
      try {
        db.prepare('INSERT INTO messages (id, convoId, fromId, text, at, type, meta, replyTo, reactions) VALUES (?,?,?,?,?,?,?,?,?)').run(id, finalConvo, uid, outMsg.text, now, type, meta ? JSON.stringify(meta) : null, replyTo||null, '{}');
      } catch (e) { console.error('msg insert error', e.message); }
    }
    if(!memMessages.has(finalConvo)) memMessages.set(finalConvo, []);
    memMessages.get(finalConvo).push(outMsg);
    if(finalConvo.includes('_')){
      finalConvo.split('_').forEach(pid=>{
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('message:new', outMsg);
      });
    } else {
      let members = [];
      if (useSQLite && db) {
        try { members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(finalConvo).map(r=>r.userId); } catch {}
      }
      if(members.length===0){
        const g = memGroups.get(finalConvo);
        if(g) members = [...g.members];
      }
      members.forEach(pid=>{
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('message:new', outMsg);
      });
    }
  });

  socket.on('message:edit', ({messageId, text})=>{
    if (useSQLite && db) {
      try {
        const msg = db.prepare('SELECT * FROM messages WHERE id=? AND fromId=?').get(messageId, uid);
        if(msg){
          db.prepare('UPDATE messages SET text=?, edited=1 WHERE id=?').run(text.slice(0,5000), messageId);
          const updated = {...msg, text: text.slice(0,5000), edited:true, from: msg.fromId};
          try{ updated.meta = updated.meta ? JSON.parse(updated.meta) : null; }catch{}
          try{ updated.reactions = updated.reactions ? JSON.parse(updated.reactions) : {}; }catch{}
          const convoId = msg.convoId;
          if(convoId.includes('_')){
            convoId.split('_').forEach(pid=>{
              const sid = userSockets.get(pid);
              if(sid) io.to(sid).emit('message:edited', updated);
            });
          } else {
            const members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(convoId).map(r=>r.userId);
            members.forEach(pid=>{
              const sid = userSockets.get(pid);
              if(sid) io.to(sid).emit('message:edited', updated);
            });
          }
          return;
        }
      } catch {}
    }
    // mem fallback
    for(const [cid, arr] of memMessages){
      const m = arr.find(x=> x.id===messageId && (x.from===uid||x.fromId===uid));
      if(m){
        m.text = text.slice(0,5000);
        m.edited = true;
        if(cid.includes('_')){
          cid.split('_').forEach(pid=>{
            const sid = userSockets.get(pid);
            if(sid) io.to(sid).emit('message:edited', {...m});
          });
        } else {
          const g = memGroups.get(cid);
          if(g) g.members.forEach(pid=>{
            const sid = userSockets.get(pid);
            if(sid) io.to(sid).emit('message:edited', {...m});
          });
        }
        break;
      }
    }
  });

  socket.on('message:delete', ({messageId})=>{
    if (useSQLite && db) {
      try {
        const msg = db.prepare('SELECT * FROM messages WHERE id=? AND fromId=?').get(messageId, uid);
        if(msg){
          db.prepare('DELETE FROM messages WHERE id=?').run(messageId);
          const convoId = msg.convoId;
          if(convoId.includes('_')){
            convoId.split('_').forEach(pid=>{
              const sid = userSockets.get(pid);
              if(sid) io.to(sid).emit('message:deleted', {messageId, convoId});
            });
          } else {
            const members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(convoId).map(r=>r.userId);
            members.forEach(pid=>{
              const sid = userSockets.get(pid);
              if(sid) io.to(sid).emit('message:deleted', {messageId, convoId});
            });
          }
          // also mem
          if(memMessages.has(convoId)){
            memMessages.set(convoId, memMessages.get(convoId).filter(m=> m.id!==messageId));
          }
          return;
        }
      } catch {}
    }
    for(const [cid, arr] of memMessages){
      const idx = arr.findIndex(x=> x.id===messageId && (x.from===uid||x.fromId===uid));
      if(idx!==-1){
        arr.splice(idx,1);
        if(cid.includes('_')){
          cid.split('_').forEach(pid=>{
            const sid = userSockets.get(pid);
            if(sid) io.to(sid).emit('message:deleted', {messageId, convoId: cid});
          });
        } else {
          const g = memGroups.get(cid);
          if(g) g.members.forEach(pid=>{
            const sid = userSockets.get(pid);
            if(sid) io.to(sid).emit('message:deleted', {messageId, convoId: cid});
          });
        }
        break;
      }
    }
  });

  socket.on('message:react', ({messageId, emoji})=>{
    if (useSQLite && db) {
      try {
        const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(messageId);
        if(!msg) return;
        let reactions = {};
        try{ reactions = JSON.parse(msg.reactions||'{}'); }catch{}
        if(!reactions[emoji]) reactions[emoji] = [];
        if(reactions[emoji].includes(uid)){
          reactions[emoji] = reactions[emoji].filter(id=> id!==uid);
          if(reactions[emoji].length===0) delete reactions[emoji];
        } else {
          reactions[emoji].push(uid);
        }
        db.prepare('UPDATE messages SET reactions=? WHERE id=?').run(JSON.stringify(reactions), messageId);
        const convoId = msg.convoId;
        const payload = {messageId, reactions, userId: uid, emoji};
        if(convoId.includes('_')){
          convoId.split('_').forEach(pid=>{
            const sid = userSockets.get(pid);
            if(sid) io.to(sid).emit('message:reaction', payload);
          });
        } else {
          const members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(convoId).map(r=>r.userId);
          members.forEach(pid=>{
            const sid = userSockets.get(pid);
            if(sid) io.to(sid).emit('message:reaction', payload);
          });
        }
        // sync mem
        if(memMessages.has(convoId)){
          const m = memMessages.get(convoId).find(x=> x.id===messageId);
          if(m) m.reactions = reactions;
        }
        return;
      } catch {}
    }
    // mem fallback
    for(const [cid, arr] of memMessages){
      const m = arr.find(x=> x.id===messageId);
      if(m){
        if(!m.reactions) m.reactions = {};
        if(!m.reactions[emoji]) m.reactions[emoji] = [];
        if(m.reactions[emoji].includes(uid)){
          m.reactions[emoji] = m.reactions[emoji].filter(id=> id!==uid);
          if(m.reactions[emoji].length===0) delete m.reactions[emoji];
        } else {
          m.reactions[emoji].push(uid);
        }
        const payload = {messageId, reactions: m.reactions, userId: uid, emoji};
        if(cid.includes('_')){
          cid.split('_').forEach(pid=>{
            const sid = userSockets.get(pid);
            if(sid) io.to(sid).emit('message:reaction', payload);
          });
        } else {
          const g = memGroups.get(cid);
          if(g) g.members.forEach(pid=>{
            const sid = userSockets.get(pid);
            if(sid) io.to(sid).emit('message:reaction', payload);
          });
        }
        break;
      }
    }
  });

  socket.on('typing:start', ({convoId, toUserId})=>{
    let finalConvo = convoId || (toUserId ? getConvoId(uid, toUserId) : null);
    if(!finalConvo) return;
    if(finalConvo.includes('_')){
      const other = finalConvo.split('_').find(id=> id!==uid);
      const sid = userSockets.get(other);
      if(sid) io.to(sid).emit('typing:start', {convoId: finalConvo, userId: uid});
    } else {
      let members = [];
      if (useSQLite && db) {
        try { members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(finalConvo).map(r=>r.userId); } catch {}
      }
      if(members.length===0){
        const g = memGroups.get(finalConvo);
        if(g) members = [...g.members];
      }
      members.forEach(pid=>{
        if(pid===uid) return;
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('typing:start', {convoId: finalConvo, userId: uid});
      });
    }
  });
  socket.on('typing:stop', ({convoId, toUserId})=>{
    let finalConvo = convoId || (toUserId ? getConvoId(uid, toUserId) : null);
    if(!finalConvo) return;
    if(finalConvo.includes('_')){
      const other = finalConvo.split('_').find(id=> id!==uid);
      const sid = userSockets.get(other);
      if(sid) io.to(sid).emit('typing:stop', {convoId: finalConvo, userId: uid});
    } else {
      let members = [];
      if (useSQLite && db) {
        try { members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(finalConvo).map(r=>r.userId); } catch {}
      }
      if(members.length===0){
        const g = memGroups.get(finalConvo);
        if(g) members = [...g.members];
      }
      members.forEach(pid=>{
        if(pid===uid) return;
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('typing:stop', {convoId: finalConvo, userId: uid});
      });
    }
  });

  // Groups
  socket.on('group:create', ({name, memberIds, avatar, description})=>{
    if(!name || name.trim().length<2) return;
    const id = uuidv4();
    const inviteCode = uuidv4().slice(0,8);
    const now = Date.now();
    if (useSQLite && db) {
      try {
        db.prepare('INSERT INTO groups (id, name, avatar, description, inviteCode, createdAt) VALUES (?,?,?,?,?,?)').run(id, name.trim().slice(0,40), avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${id}`, (description||'').slice(0,200), inviteCode, now);
        db.prepare('INSERT INTO groupMembers (groupId, userId, isAdmin) VALUES (?,?,1)').run(id, uid);
        for(const mid of (memberIds||[])){
          if(getUserById(mid)||memUsers.get(mid)) db.prepare('INSERT OR IGNORE INTO groupMembers (groupId, userId, isAdmin) VALUES (?,?,0)').run(id, mid);
        }
        const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(id).map(getUserPublic);
        const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(id).map(r=>r.userId);
        const g = db.prepare('SELECT * FROM groups WHERE id=?').get(id);
        const out = {...g, members, admins};
        members.forEach(m=>{
          const sid = userSockets.get(m.id);
          if(sid) io.to(sid).emit('group:created', out);
        });
        return;
      } catch (e) { console.error('group:create sqlite error', e.message); }
    }
    // mem fallback
    const members = new Set([uid, ...(memberIds||[]).filter(mid=> memUsers.has(mid) || getUserById(mid))]);
    const g = {
      id,
      name: name.trim().slice(0,40),
      avatar: avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${id}`,
      description: (description||'').slice(0,200),
      members,
      admins: new Set([uid]),
      createdAt: now,
      inviteCode
    };
    memGroups.set(id, g);
    members.forEach(pid=>{
      const sid = userSockets.get(pid);
      if(sid) io.to(sid).emit('group:created', {
        ...g,
        members: [...g.members].map(mid=> getUserPublic(memUsers.get(mid)||getUserById(mid))),
        admins: [...g.admins]
      });
    });
  });

  socket.on('group:addMembers', ({groupId, memberIds})=>{
    if (useSQLite && db) {
      try {
        const isAdmin = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=? AND isAdmin=1').get(groupId, uid);
        if(!isAdmin) return;
        for(const mid of memberIds){
          if(getUserById(mid)||memUsers.get(mid)) db.prepare('INSERT OR IGNORE INTO groupMembers (groupId, userId, isAdmin) VALUES (?,?,0)').run(groupId, mid);
        }
        const g = db.prepare('SELECT * FROM groups WHERE id=?').get(groupId);
        const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(groupId).map(getUserPublic);
        const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(groupId).map(r=>r.userId);
        const out = {...g, members, admins};
        members.forEach(m=>{
          const sid = userSockets.get(m.id);
          if(sid) io.to(sid).emit('group:updated', out);
        });
        return;
      } catch {}
    }
    const g = memGroups.get(groupId);
    if(!g || !g.admins.has(uid)) return;
    memberIds.forEach(mid=>{
      if(memUsers.has(mid)||getUserById(mid)) g.members.add(mid);
    });
    g.members.forEach(pid=>{
      const sid = userSockets.get(pid);
      if(sid) io.to(sid).emit('group:updated', {
        ...g,
        members: [...g.members].map(mid=> getUserPublic(memUsers.get(mid)||getUserById(mid))),
        admins: [...g.admins]
      });
    });
  });

  socket.on('group:leave', ({groupId})=>{
    if (useSQLite && db) {
      try {
        db.prepare('DELETE FROM groupMembers WHERE groupId=? AND userId=?').run(groupId, uid);
        const remaining = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(groupId);
        if(remaining.length===0){
          db.prepare('DELETE FROM groups WHERE id=?').run(groupId);
        } else {
          const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(groupId);
          if(admins.length===0){
            db.prepare('UPDATE groupMembers SET isAdmin=1 WHERE groupId=? AND userId=?').run(groupId, remaining[0].userId);
          }
          const g = db.prepare('SELECT * FROM groups WHERE id=?').get(groupId);
          if(g){
            const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(groupId).map(getUserPublic);
            const adminIds = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(groupId).map(r=>r.userId);
            const out = {...g, members, admins: adminIds};
            members.forEach(m=>{
              const sid = userSockets.get(m.id);
              if(sid) io.to(sid).emit('group:updated', out);
            });
          }
        }
        socket.emit('group:left', {groupId});
        return;
      } catch {}
    }
    const g = memGroups.get(groupId);
    if(!g) return;
    g.members.delete(uid);
    g.admins.delete(uid);
    if(g.members.size===0){
      memGroups.delete(groupId);
    } else {
      if(g.admins.size===0){
        const first = [...g.members][0];
        g.admins.add(first);
      }
      g.members.forEach(pid=>{
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('group:updated', {
          ...g,
          members: [...g.members].map(mid=> getUserPublic(memUsers.get(mid)||getUserById(mid))),
          admins: [...g.admins]
        });
      });
    }
    socket.emit('group:left', {groupId});
  });

  socket.on('group:update', ({groupId, name, avatar, description})=>{
    if (useSQLite && db) {
      try {
        const isAdmin = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=? AND isAdmin=1').get(groupId, uid);
        if(!isAdmin) return;
        if(name) db.prepare('UPDATE groups SET name=? WHERE id=?').run(name.trim().slice(0,40), groupId);
        if(avatar) db.prepare('UPDATE groups SET avatar=? WHERE id=?').run(avatar, groupId);
        if(description!==undefined) db.prepare('UPDATE groups SET description=? WHERE id=?').run(description.slice(0,200), groupId);
        const g = db.prepare('SELECT * FROM groups WHERE id=?').get(groupId);
        const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(groupId).map(getUserPublic);
        const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(groupId).map(r=>r.userId);
        const out = {...g, members, admins};
        members.forEach(m=>{
          const sid = userSockets.get(m.id);
          if(sid) io.to(sid).emit('group:updated', out);
        });
        return;
      } catch {}
    }
    const g = memGroups.get(groupId);
    if(!g || !g.admins.has(uid)) return;
    if(name) g.name = name.trim().slice(0,40);
    if(avatar) g.avatar = avatar;
    if(description!==undefined) g.description = description.slice(0,200);
    g.members.forEach(pid=>{
      const sid = userSockets.get(pid);
      if(sid) io.to(sid).emit('group:updated', {
        ...g,
        members: [...g.members].map(mid=> getUserPublic(memUsers.get(mid)||getUserById(mid))),
        admins: [...g.admins]
      });
    });
  });

  // Calls
  socket.on('call:invite', ({toUserId, type='video', groupId})=>{
    const callId = uuidv4();
    if(groupId){
      let isMember = false;
      if (useSQLite && db) {
        try { isMember = !!db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=?').get(groupId, uid); } catch {}
      } else {
        const g = memGroups.get(groupId);
        isMember = g && g.members.has(uid);
      }
      if(!isMember) return;
      const call = {id: callId, initiator: uid, type, groupId, participants: new Set([uid]), startedAt: Date.now()};
      calls.set(callId, call);
      let members = [];
      if (useSQLite && db) {
        try { members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(groupId).map(r=>r.userId); } catch {}
      }
      if(members.length===0){
        const g = memGroups.get(groupId);
        if(g) members = [...g.members];
      }
      let gInfo = null;
      if (useSQLite && db) {
        try { gInfo = db.prepare('SELECT * FROM groups WHERE id=?').get(groupId); } catch {}
      }
      if(!gInfo) gInfo = memGroups.get(groupId);
      members.forEach(pid=>{
        if(pid===uid) return;
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('call:incoming', {callId, from: getUserPublic(getUserById(uid)||memUsers.get(uid)), type, groupId, group: gInfo ? {id:gInfo.id, name:gInfo.name, avatar:gInfo.avatar} : null});
      });
      socket.emit('call:started', {callId, type, groupId});
    } else {
      if(!toUserId) return;
      const targetExists = getUserById(toUserId) || memUsers.get(toUserId);
      if(!targetExists) return;
      const targetSocket = userSockets.get(toUserId);
      if(!targetSocket) return socket.emit('call:error', {msg:'Пользователь оффлайн'});
      const call = {id: callId, initiator: uid, type, participants: new Set([uid]), startedAt: Date.now(), toUserId};
      calls.set(callId, call);
      io.to(targetSocket).emit('call:incoming', {callId, from: getUserPublic(getUserById(uid)||memUsers.get(uid)), type});
      socket.emit('call:inviting', {callId, toUserId, type});
    }
  });

  socket.on('call:accept', ({callId})=>{
    const call = calls.get(callId);
    if(!call) return;
    call.participants.add(uid);
    call.participants.forEach(pid=>{
      const sid = userSockets.get(pid);
      if(sid) io.to(sid).emit('call:accepted', {callId, userId: uid, user: getUserPublic(getUserById(uid)||memUsers.get(uid))});
    });
    if(call.toUserId){
      const sid = userSockets.get(call.initiator);
      if(sid) io.to(sid).emit('call:accepted', {callId, userId: uid, user: getUserPublic(getUserById(uid)||memUsers.get(uid))});
    }
    socket.emit('call:joined', {callId, type: call.type, groupId: call.groupId});
  });

  socket.on('call:reject', ({callId})=>{
    const call = calls.get(callId);
    if(!call) return;
    const initiatorSid = userSockets.get(call.initiator);
    if(initiatorSid) io.to(initiatorSid).emit('call:rejected', {callId, userId: uid});
    if(!call.groupId) calls.delete(callId);
  });

  socket.on('call:leave', ({callId})=>{
    const call = calls.get(callId);
    if(!call) return;
    call.participants.delete(uid);
    call.participants.forEach(pid=>{
      const sid = userSockets.get(pid);
      if(sid) io.to(sid).emit('call:participant:left', {callId, userId: uid});
    });
    if(call.participants.size===0){
      calls.delete(callId);
      io.emit('call:ended', {callId});
    }
    socket.emit('call:left', {callId});
  });

  socket.on('webrtc:offer', ({callId, toUserId, offer})=>{
    const targetSocket = userSockets.get(toUserId);
    if(targetSocket) io.to(targetSocket).emit('webrtc:offer', {callId, fromUserId: uid, offer, fromUser: getUserPublic(getUserById(uid)||memUsers.get(uid))});
  });
  socket.on('webrtc:answer', ({callId, toUserId, answer})=>{
    const targetSocket = userSockets.get(toUserId);
    if(targetSocket) io.to(targetSocket).emit('webrtc:answer', {callId, fromUserId: uid, answer});
  });
  socket.on('webrtc:ice', ({callId, toUserId, candidate})=>{
    const targetSocket = userSockets.get(toUserId);
    if(targetSocket) io.to(targetSocket).emit('webrtc:ice', {callId, fromUserId: uid, candidate});
  });

  socket.on('disconnect', ()=>{
    userSockets.delete(uid);
    onlineMap.set(uid, false);
    if (useSQLite && db) {
      try { db.prepare('UPDATE users SET status=?, lastSeen=? WHERE id=?').run('offline', Date.now(), uid); } catch {}
    } else if (memUsers.has(uid)) {
      const u = memUsers.get(uid);
      u.status = 'offline';
      u.lastSeen = Date.now();
    }
    socket.broadcast.emit('user:offline', {userId: uid, lastSeen: Date.now()});
    for(const [callId, call] of calls){
      if(call.participants.has(uid)){
        call.participants.delete(uid);
        call.participants.forEach(pid=>{
          const sid = userSockets.get(pid);
          if(sid) io.to(sid).emit('call:participant:left', {callId, userId: uid});
        });
        if(call.participants.size===0) calls.delete(callId);
      }
    }
    console.log(`user ${uid} disconnected`);
  });
});

// SPA fallback - MUST be after /api/* routes
app.get('*', (req,res)=>{
  // Don't serve index.html for API or socket.io
  if(req.path.startsWith('/api/') || req.path.startsWith('/socket.io') || req.path.startsWith('/uploads')) {
    return res.status(404).json({error:'not found'});
  }
  const filePath = path.join(clientDistPath, 'index.html');
  if(fs.existsSync(filePath)){
    res.sendFile(filePath);
  } else {
    res.send('Cbopka server running. Build client first. API ok: /api/health');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', ()=>{
  console.log(`Server running on http://0.0.0.0:${PORT} with ${useSQLite ? 'SQLite' : 'in-memory'} at ${clientDistPath}`);
});
