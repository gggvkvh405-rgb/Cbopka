import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import Database from 'better-sqlite3';

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

// --- DB Setup (SQLite persistence) ---
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'cbopka.db');
const db = new Database(DB_PATH);
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

// Ensure inviteCode column exists for old DBs
try{ db.exec(`ALTER TABLE groups ADD COLUMN inviteCode TEXT UNIQUE`); }catch{}

// In-memory caches for speed + sockets
const sessionsCache = new Map(); // token -> userId
const userSockets = new Map(); // userId -> socketId
const calls = new Map();
const onlineMap = new Map(); // userId -> bool

// Load sessions into cache
for(const row of db.prepare('SELECT token, userId FROM sessions').all()){
  sessionsCache.set(row.token, row.userId);
}

const clientDistPath = process.env.CLIENT_DIST_PATH || path.join(__dirname, '../client/dist');
if(fs.existsSync(clientDistPath)){
  app.use(express.static(clientDistPath));
}

// --- Upload setup ---
const uploadDir = path.join(__dirname, 'uploads');
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive:true});
const storage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null, uploadDir),
  filename: (req,file,cb)=> {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, id + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 100*1024*1024 } });

app.use('/uploads', express.static(uploadDir));

// --- Helpers ---
function getConvoId(a,b){ return [a,b].sort().join('_'); }
function getUserPublic(u){
  if(!u) return null;
  const {passwordHash, ...pub} = u;
  try{ pub.reactions = JSON.parse(pub.reactions||'{}'); }catch{}
  return pub;
}
function getUserById(id){
  return db.prepare('SELECT * FROM users WHERE id=?').get(id);
}
function getUserByNameLower(lower){
  return db.prepare('SELECT * FROM users WHERE usernameLower=?').get(lower);
}
function ensureFriendSet(uid){
  // No-op for DB version, but keep for compatibility
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
  db.prepare('INSERT INTO users (id, username, usernameLower, passwordHash, avatar, bio, status, customStatus, lastSeen, createdAt, theme) VALUES (@id, @username, @usernameLower, @passwordHash, @avatar, @bio, @status, @customStatus, @lastSeen, @createdAt, @theme)').run(user);
  const token = uuidv4();
  db.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?,?,?)').run(token, id, now);
  sessionsCache.set(token, id);
  onlineMap.set(id, true);
  res.json({token, user: getUserPublic(user)});
});

app.post('/api/login', async (req,res)=>{
  const {username, password} = req.body;
  if(!username || !password) return res.status(400).json({error:'required'});
  const lower = username.trim().toLowerCase();
  const user = getUserByNameLower(lower);
  if(!user) return res.status(400).json({error:'user not found'});
  const ok = await bcrypt.compare(password, user.passwordHash);
  if(!ok) return res.status(400).json({error:'wrong password'});
  const token = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?,?,?)').run(token, user.id, now);
  sessionsCache.set(token, user.id);
  db.prepare('UPDATE users SET status=?, lastSeen=? WHERE id=?').run('online', now, user.id);
  onlineMap.set(user.id, true);
  res.json({token, user: getUserPublic(user)});
});

app.get('/api/me', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const u = getUserById(uid);
  res.json({user: getUserPublic(u)});
});

app.get('/api/users/search', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const q = (req.query.q||'').toLowerCase();
  const list = db.prepare('SELECT * FROM users WHERE usernameLower LIKE ? AND id != ? LIMIT 20').all(`%${q}%`, uid).map(getUserPublic);
  res.json({users:list});
});

app.get('/api/friends', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const friends = db.prepare('SELECT u.* FROM users u JOIN friendships f ON f.friendId = u.id WHERE f.userId=?').all(uid).map(getUserPublic);
  const incoming = db.prepare('SELECT fr.*, u.* FROM friendRequests fr JOIN users u ON fr.fromId = u.id WHERE fr.toId=? AND fr.status="pending"').all(uid).map(r=> ({
    id: r.id, from: r.fromId, to: r.toId, status: r.status, at: r.at,
    fromUser: getUserPublic(getUserById(r.fromId))
  }));
  const outgoing = db.prepare('SELECT fr.*, u.* FROM friendRequests fr JOIN users u ON fr.toId = u.id WHERE fr.fromId=? AND fr.status="pending"').all(uid).map(r=> ({
    id: r.id, from: r.fromId, to: r.toId, status: r.status, at: r.at,
    toUser: getUserPublic(getUserById(r.toId))
  }));
  res.json({friends, incoming, outgoing});
});

app.get('/api/groups', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const groupIds = db.prepare('SELECT groupId FROM groupMembers WHERE userId=?').all(uid).map(r=>r.groupId);
  const myGroups = [];
  for(const gid of groupIds){
    const g = db.prepare('SELECT * FROM groups WHERE id=?').get(gid);
    if(!g) continue;
    const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(gid).map(getUserPublic);
    const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(gid).map(r=>r.userId);
    myGroups.push({...g, members, admins});
  }
  res.json({groups: myGroups});
});

app.get('/api/messages/:convoId', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const {convoId} = req.params;
  if(convoId.includes('_')){
    const parts = convoId.split('_');
    if(!parts.includes(uid)) return res.status(403).json({error:'forbidden'});
  } else {
    const isMember = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=?').get(convoId, uid);
    if(!isMember) return res.status(403).json({error:'forbidden'});
  }
  const msgs = db.prepare('SELECT * FROM messages WHERE convoId=? ORDER BY at DESC LIMIT 200').all(convoId).reverse().map(m=>{
    try{ m.meta = m.meta ? JSON.parse(m.meta) : null; }catch{}
    try{ m.reactions = m.reactions ? JSON.parse(m.reactions) : {}; }catch{ m.reactions = {}; }
    return m;
  });
  res.json({messages: msgs});
});

app.get('/api/users/:id', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const u = getUserById(req.params.id);
  if(!u) return res.status(404).json({error:'not found'});
  res.json({user: getUserPublic(u)});
});

// File upload
app.post('/api/upload', upload.single('file'), (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  if(!req.file) return res.status(400).json({error:'no file'});
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO files (id, originalName, mimeType, size, path, uploaderId, at) VALUES (?,?,?,?,?,?,?)').run(id, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, uid, now);
  const url = `/uploads/${req.file.filename}`;
  res.json({id, url, name: req.file.originalname, mime: req.file.mimetype, size: req.file.size});
});

// Invite link
app.post('/api/groups/:id/invite', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const {id} = req.params;
  const isAdmin = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=? AND isAdmin=1').get(id, uid);
  if(!isAdmin) return res.status(403).json({error:'not admin'});
  const inviteCode = uuidv4().slice(0,8);
  db.prepare('UPDATE groups SET inviteCode=? WHERE id=?').run(inviteCode, id);
  res.json({inviteCode, link: `${req.protocol}://${req.get('host')}/?invite=${inviteCode}`});
});

app.post('/api/groups/join/:inviteCode', (req,res)=>{
  const token = req.headers.authorization?.replace('Bearer ','');
  const uid = sessionsCache.get(token);
  if(!uid) return res.status(401).json({error:'unauthorized'});
  const {inviteCode} = req.params;
  const g = db.prepare('SELECT * FROM groups WHERE inviteCode=?').get(inviteCode);
  if(!g) return res.status(404).json({error:'invite not found'});
  db.prepare('INSERT OR IGNORE INTO groupMembers (groupId, userId, isAdmin) VALUES (?,?,0)').run(g.id, uid);
  const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(g.id).map(getUserPublic);
  const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(g.id).map(r=>r.userId);
  io.emit('group:updated', {...g, members, admins});
  res.json({group: {...g, members, admins}});
});

// TURN config endpoint
app.get('/api/turn', (req,res)=>{
  // Return TURN servers - user should configure via env
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

// Socket auth
io.use((socket, next)=>{
  const token = socket.handshake.auth?.token;
  const uid = sessionsCache.get(token);
  if(!uid) return next(new Error('unauthorized'));
  socket.userId = uid;
  next();
});

io.on('connection', (socket)=>{
  const uid = socket.userId;
  const user = getUserById(uid);
  if(!user) return socket.disconnect();
  userSockets.set(uid, socket.id);
  onlineMap.set(uid, true);
  db.prepare('UPDATE users SET status=?, lastSeen=? WHERE id=?').run('online', Date.now(), uid);
  console.log(`user ${user.username} connected ${socket.id}`);
  socket.broadcast.emit('user:online', {userId: uid});
  socket.emit('connected', {userId: uid});

  socket.on('user:update', ({avatar,bio,status,customStatus,username,theme})=>{
    const updates = [];
    const params = [];
    if(avatar){ updates.push('avatar=?'); params.push(avatar); }
    if(bio!==undefined){ updates.push('bio=?'); params.push(bio); }
    if(status){ updates.push('status=?'); params.push(status); }
    if(customStatus!==undefined){ updates.push('customStatus=?'); params.push(customStatus); }
    if(theme){ updates.push('theme=?'); params.push(theme); }
    if(username && username.trim().length>=3){
      const oldLower = user.usernameLower;
      const newLower = username.trim().toLowerCase();
      if(oldLower!==newLower && !getUserByNameLower(newLower)){
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
  });

  socket.on('friends:request', ({toUsername, toUserId})=>{
    let targetId = toUserId;
    if(!targetId && toUsername){
      const u = getUserByNameLower(toUsername.trim().toLowerCase());
      if(u) targetId = u.id;
    }
    if(!targetId || targetId===uid) return;
    const exists = db.prepare('SELECT 1 FROM friendships WHERE userId=? AND friendId=?').get(uid, targetId);
    if(exists) return socket.emit('error_msg',{msg:'Уже в друзьях'});
    const pending = db.prepare('SELECT 1 FROM friendRequests WHERE fromId=? AND toId=? AND status="pending"').get(uid, targetId);
    if(pending) return;
    const id = uuidv4();
    const now = Date.now();
    db.prepare('INSERT INTO friendRequests (id, fromId, toId, status, at) VALUES (?,?,?,?,?)').run(id, uid, targetId, 'pending', now);
    const reqObj = {id, from: uid, to: targetId, status:'pending', at: now};
    const targetSocket = userSockets.get(targetId);
    if(targetSocket) io.to(targetSocket).emit('friends:request:incoming', {...reqObj, fromUser: getUserPublic(user)});
    socket.emit('friends:request:sent', reqObj);
  });

  socket.on('friends:accept', ({requestId})=>{
    const fr = db.prepare('SELECT * FROM friendRequests WHERE id=? AND toId=?').get(requestId, uid);
    if(!fr) return;
    db.prepare('UPDATE friendRequests SET status="accepted" WHERE id=?').run(requestId);
    db.prepare('INSERT OR IGNORE INTO friendships (userId, friendId) VALUES (?,?)').run(fr.fromId, fr.toId);
    db.prepare('INSERT OR IGNORE INTO friendships (userId, friendId) VALUES (?,?)').run(fr.toId, fr.fromId);
    const fromUser = getUserById(fr.fromId);
    const toUser = getUserById(fr.toId);
    const s1 = userSockets.get(fr.fromId);
    const s2 = userSockets.get(fr.toId);
    if(s1) io.to(s1).emit('friends:added', {friend: getUserPublic(toUser)});
    if(s2) io.to(s2).emit('friends:added', {friend: getUserPublic(fromUser)});
  });

  socket.on('friends:reject', ({requestId})=>{
    const fr = db.prepare('SELECT * FROM friendRequests WHERE id=? AND toId=?').get(requestId, uid);
    if(!fr) return;
    db.prepare('UPDATE friendRequests SET status="rejected" WHERE id=?').run(requestId);
    socket.emit('friends:request:rejected', fr);
    const s = userSockets.get(fr.fromId);
    if(s) io.to(s).emit('friends:request:rejected', fr);
  });

  socket.on('friends:remove', ({friendId})=>{
    db.prepare('DELETE FROM friendships WHERE (userId=? AND friendId=?) OR (userId=? AND friendId=?)').run(uid, friendId, friendId, uid);
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
      const isMember = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=?').get(finalConvo, uid);
      if(!isMember) return;
    }
    const id = uuidv4();
    const now = Date.now();
    const msg = {
      id,
      from: uid,
      convoId: finalConvo,
      text: text.trim().slice(0,5000),
      at: now,
      type,
      meta: meta ? JSON.stringify(meta) : null,
      replyTo: replyTo || null,
      reactions: '{}'
    };
    db.prepare('INSERT INTO messages (id, convoId, fromId, text, at, type, meta, replyTo, reactions) VALUES (@id, @convoId, @from, @text, @at, @type, @meta, @replyTo, @reactions)').run(msg);
    const outMsg = {...msg, from: uid, meta: meta||null, reactions:{}};
    // deliver
    if(finalConvo.includes('_')){
      finalConvo.split('_').forEach(pid=>{
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('message:new', outMsg);
      });
    } else {
      const members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(finalConvo).map(r=>r.userId);
      members.forEach(pid=>{
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('message:new', outMsg);
      });
    }
  });

  socket.on('message:edit', ({messageId, text})=>{
    const msg = db.prepare('SELECT * FROM messages WHERE id=? AND fromId=?').get(messageId, uid);
    if(!msg) return;
    db.prepare('UPDATE messages SET text=?, edited=1 WHERE id=?').run(text.slice(0,5000), messageId);
    const updated = {...msg, text: text.slice(0,5000), edited:true};
    try{ updated.meta = updated.meta ? JSON.parse(updated.meta) : null; }catch{}
    try{ updated.reactions = updated.reactions ? JSON.parse(updated.reactions) : {}; }catch{}
    // broadcast to convo
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
  });

  socket.on('message:delete', ({messageId})=>{
    const msg = db.prepare('SELECT * FROM messages WHERE id=? AND fromId=?').get(messageId, uid);
    if(!msg) return;
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
  });

  socket.on('message:react', ({messageId, emoji})=>{
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
  });

  socket.on('typing:start', ({convoId, toUserId})=>{
    let finalConvo = convoId || (toUserId ? getConvoId(uid, toUserId) : null);
    if(!finalConvo) return;
    if(finalConvo.includes('_')){
      const other = finalConvo.split('_').find(id=> id!==uid);
      const sid = userSockets.get(other);
      if(sid) io.to(sid).emit('typing:start', {convoId: finalConvo, userId: uid});
    } else {
      const members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(finalConvo).map(r=>r.userId);
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
      const members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(finalConvo).map(r=>r.userId);
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
    db.prepare('INSERT INTO groups (id, name, avatar, description, inviteCode, createdAt) VALUES (?,?,?,?,?,?)').run(id, name.trim().slice(0,40), avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${id}`, (description||'').slice(0,200), inviteCode, now);
    db.prepare('INSERT INTO groupMembers (groupId, userId, isAdmin) VALUES (?,?,1)').run(id, uid);
    for(const mid of (memberIds||[])){
      if(getUserById(mid)) db.prepare('INSERT OR IGNORE INTO groupMembers (groupId, userId, isAdmin) VALUES (?,?,0)').run(id, mid);
    }
    const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(id).map(getUserPublic);
    const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(id).map(r=>r.userId);
    const g = db.prepare('SELECT * FROM groups WHERE id=?').get(id);
    const out = {...g, members, admins};
    members.forEach(m=>{
      const sid = userSockets.get(m.id);
      if(sid) io.to(sid).emit('group:created', out);
    });
  });

  socket.on('group:addMembers', ({groupId, memberIds})=>{
    const isAdmin = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=? AND isAdmin=1').get(groupId, uid);
    if(!isAdmin) return;
    for(const mid of memberIds){
      if(getUserById(mid)) db.prepare('INSERT OR IGNORE INTO groupMembers (groupId, userId, isAdmin) VALUES (?,?,0)').run(groupId, mid);
    }
    const g = db.prepare('SELECT * FROM groups WHERE id=?').get(groupId);
    const members = db.prepare('SELECT u.* FROM users u JOIN groupMembers gm ON gm.userId=u.id WHERE gm.groupId=?').all(groupId).map(getUserPublic);
    const admins = db.prepare('SELECT userId FROM groupMembers WHERE groupId=? AND isAdmin=1').all(groupId).map(r=>r.userId);
    const out = {...g, members, admins};
    members.forEach(m=>{
      const sid = userSockets.get(m.id);
      if(sid) io.to(sid).emit('group:updated', out);
    });
  });

  socket.on('group:leave', ({groupId})=>{
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
  });

  socket.on('group:update', ({groupId, name, avatar, description})=>{
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
  });

  // Calls
  socket.on('call:invite', ({toUserId, type='video', groupId})=>{
    const callId = uuidv4();
    if(groupId){
      const isMember = db.prepare('SELECT 1 FROM groupMembers WHERE groupId=? AND userId=?').get(groupId, uid);
      if(!isMember) return;
      const call = {id: callId, initiator: uid, type, groupId, participants: new Set([uid]), startedAt: Date.now()};
      calls.set(callId, call);
      const members = db.prepare('SELECT userId FROM groupMembers WHERE groupId=?').all(groupId).map(r=>r.userId);
      const g = db.prepare('SELECT * FROM groups WHERE id=?').get(groupId);
      members.forEach(pid=>{
        if(pid===uid) return;
        const sid = userSockets.get(pid);
        if(sid) io.to(sid).emit('call:incoming', {callId, from: getUserPublic(user), type, groupId, group: {id:g.id, name:g.name, avatar:g.avatar}});
      });
      socket.emit('call:started', {callId, type, groupId});
    } else {
      if(!toUserId || !getUserById(toUserId)) return;
      const targetSocket = userSockets.get(toUserId);
      if(!targetSocket) return socket.emit('call:error', {msg:'Пользователь оффлайн'});
      const call = {id: callId, initiator: uid, type, participants: new Set([uid]), startedAt: Date.now(), toUserId};
      calls.set(callId, call);
      io.to(targetSocket).emit('call:incoming', {callId, from: getUserPublic(user), type});
      socket.emit('call:inviting', {callId, toUserId, type});
    }
  });

  socket.on('call:accept', ({callId})=>{
    const call = calls.get(callId);
    if(!call) return;
    call.participants.add(uid);
    call.participants.forEach(pid=>{
      const sid = userSockets.get(pid);
      if(sid) io.to(sid).emit('call:accepted', {callId, userId: uid, user: getUserPublic(user)});
    });
    if(call.toUserId){
      const sid = userSockets.get(call.initiator);
      if(sid) io.to(sid).emit('call:accepted', {callId, userId: uid, user: getUserPublic(user)});
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
    if(targetSocket) io.to(targetSocket).emit('webrtc:offer', {callId, fromUserId: uid, offer, fromUser: getUserPublic(user)});
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
    db.prepare('UPDATE users SET status=?, lastSeen=? WHERE id=?').run('offline', Date.now(), uid);
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

// SPA fallback
app.get('*', (req,res)=>{
  const filePath = path.join(clientDistPath, 'index.html');
  if(fs.existsSync(filePath)){
    res.sendFile(filePath);
  } else {
    res.send('Cbopka server running. Build client first.');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', ()=>{
  console.log(`Server running on http://0.0.0.0:${PORT} with SQLite persistence at ${DB_PATH}`);
});
