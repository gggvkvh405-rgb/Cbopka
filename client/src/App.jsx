import { useEffect, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { io } from 'socket.io-client';
const P2PApp = lazy(()=> import('./P2PApp.jsx'));

const CUSTOM_SERVER = localStorage.getItem('cb_server_url') || window.CBOPKA_SERVER_URL || '';
const API = CUSTOM_SERVER || '';
const SOCKET_URL = CUSTOM_SERVER || window.location.origin;

function uid() { return Math.random().toString(36).slice(2); }

// ---------- Auth ----------
function Auth({onAuth, onP2P}) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e){
    e.preventDefault();
    setErr(''); setLoading(true);
    try{
      const res = await fetch(`${API}/api/${mode}`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({username, password})
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Ошибка');
      localStorage.setItem('cb_token', data.token);
      localStorage.setItem('cb_user', JSON.stringify(data.user));
      onAuth(data.user, data.token);
    }catch(e){ setErr(e.message); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f0f12] relative overflow-hidden">
      <div className="absolute w-[600px] h-[600px] bg-[#7c5cff]/20 rounded-full blur-[120px] -top-40 -left-40" />
      <div className="absolute w-[500px] h-[500px] bg-[#00d084]/15 rounded-full blur-[120px] -bottom-40 -right-40" />
      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7c5cff] mb-4 shadow-[0_0_30px_rgba(124,92,255,0.5)]">
            <span className="text-2xl font-bold">C</span>
          </div>
          <h1 className="text-[32px] font-bold tracking-tight">Cbopka</h1>
          <p className="text-[#9a9aa3] mt-2 text-[15px]">Мессенджер для своих. Звонки, видео, экран 1080p</p>
        </div>

        <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-[24px] p-7 shadow-2xl">
          <div className="flex bg-[#0f0f12] rounded-full p-1 mb-6 border border-[#2a2a33]">
            <button onClick={()=>setMode('login')} className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition ${mode==='login'?'bg-white text-black':'text-[#9a9aa3]'}`}>Вход</button>
            <button onClick={()=>setMode('register')} className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition ${mode==='register'?'bg-white text-black':'text-[#9a9aa3]'}`}>Регистрация</button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-[13px] text-[#9a9aa3] font-medium ml-1">Никнейм</label>
              <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="например, s1mple" className="w-full mt-1.5 bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3.5 text-[15px] outline-none focus:border-[#7c5cff] focus:bg-[#2a2a33] transition placeholder:text-[#5a5a66]" required minLength={3} />
            </div>
            <div>
              <label className="text-[13px] text-[#9a9aa3] font-medium ml-1">Пароль</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="минимум 4 символа" className="w-full mt-1.5 bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3.5 text-[15px] outline-none focus:border-[#7c5cff] focus:bg-[#2a2a33] transition placeholder:text-[#5a5a66]" required minLength={4} />
            </div>
            {err && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] rounded-xl px-4 py-3">{err}</div>}
            <button disabled={loading} className="w-full bg-[#7c5cff] hover:bg-[#6b4df0] disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl text-[15px] shadow-[0_8px_20px_rgba(124,92,255,0.3)] transition mt-2">
              {loading ? 'Загрузка...' : mode==='login' ? 'Войти в Cbopka' : 'Создать аккаунт'}
            </button>
          </form>

          <div className="mt-6 grid grid-cols-3 gap-2 text-[11px] text-[#5a5a66] text-center">
            <div className="bg-[#232329] rounded-xl py-3 border border-[#2a2a33]"><span className="block text-white font-semibold text-[13px]">1080p</span>Демо экрана</div>
            <div className="bg-[#232329] rounded-xl py-3 border border-[#2a2a33]"><span className="block text-white font-semibold text-[13px]">SQLite</span>База</div>
            <div className="bg-[#232329] rounded-xl py-3 border border-[#2a2a33]"><span className="block text-white font-semibold text-[13px]">P2P</span>Звонки</div>
          </div>

          <button onClick={onP2P} className="w-full mt-4 bg-[#00d084]/10 hover:bg-[#00d084]/20 border border-[#00d084]/20 text-[#00d084] font-semibold py-3 rounded-xl text-[13px] transition">
            ⚡ P2P без сервера — сразу общаться
            <span className="block text-[11px] font-normal text-[#9a9aa3] mt-0.5">Без WiFi и Render, через интернет по ID</span>
          </button>
        </div>

        <p className="text-center text-[12px] text-[#5a5a66] mt-6">Работает на ПК и телефоне. Нативное приложение — Electron и APK.</p>
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App(){
  const [p2pMode, setP2pMode] = useState(()=>{
    const params = new URLSearchParams(window.location.search);
    return params.has('p2p') || localStorage.getItem('cb_p2p_mode')==='1';
  });
  const [p2pInvite] = useState(()=>{
    const params = new URLSearchParams(window.location.search);
    return params.get('p2p') || '';
  });

  if(p2pMode){
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0f0f12] text-white">Загрузка P2P...</div>}>
        <P2PApp onBack={()=>{
          localStorage.removeItem('cb_p2p_mode');
          setP2pMode(false);
          window.history.replaceState({}, '', window.location.pathname);
        }} initialInvite={p2pInvite} />
      </Suspense>
    );
  }

  const [user, setUser] = useState(()=> {
    try{ return JSON.parse(localStorage.getItem('cb_user')||'null'); }catch{ return null; }
  });
  const [token, setToken] = useState(()=> localStorage.getItem('cb_token')||'');
  const [socket, setSocket] = useState(null);

  const [friends, setFriends] = useState([]);
  const [incomingReq, setIncomingReq] = useState([]);
  const [outgoingReq, setOutgoingReq] = useState([]);
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [onlineMap, setOnlineMap] = useState({});
  const [theme, setTheme] = useState(()=> localStorage.getItem('cb_theme')||'dark');

  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState('');
  const [typingMap, setTypingMap] = useState({});
  const [showSidebar, setShowSidebar] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [tab, setTab] = useState('chats');
  const [searchMsg, setSearchMsg] = useState('');

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingMsg, setEditingMsg] = useState(null);

  // Call state
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(true);

  const peersRef = useRef(new Map());
  const localVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const fileInputRef = useRef(null);

  function handleAuth(u, t){
    setUser(u); setToken(t);
  }
  function logout(){
    localStorage.removeItem('cb_token'); localStorage.removeItem('cb_user');
    setUser(null); setToken(''); socket?.disconnect();
  }

  // Theme
  useEffect(()=>{
    localStorage.setItem('cb_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Fetch initial data
  useEffect(()=>{
    if(!token) return;
    fetch(`${API}/api/friends`, {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{
      if(d.friends) setFriends(d.friends);
      if(d.incoming) setIncomingReq(d.incoming);
      if(d.outgoing) setOutgoingReq(d.outgoing);
    });
    fetch(`${API}/api/groups`, {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{
      if(d.groups) setGroups(d.groups);
    });
    // Load TURN config
    fetch(`${API}/api/turn`, {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{
      if(d.iceServers) localStorage.setItem('cb_ice', JSON.stringify(d.iceServers));
    }).catch(()=>{});
  }, [token]);

  // Socket connect
  useEffect(()=>{
    if(!token || !user) return;
    const s = io(SOCKET_URL, {auth:{token}});
    setSocket(s);
    s.on('connect', ()=> console.log('socket connected'));
    s.on('connect_error', (err)=>{ console.error(err); if(err.message==='unauthorized'){ logout(); }});

    s.on('user:online', ({userId})=> setOnlineMap(m=>({...m, [userId]:true})));
    s.on('user:offline', ({userId})=> setOnlineMap(m=>({...m, [userId]:false})));
    s.on('user:updated', ({user:u})=>{
      if(u.id===user.id) { setUser(u); localStorage.setItem('cb_user', JSON.stringify(u)); }
      setFriends(f=> f.map(x=> x.id===u.id? u : x));
      setGroups(gs=> gs.map(g=> ({...g, members: g.members.map(mem=> mem.id===u.id? u : mem)})));
    });

    s.on('friends:request:incoming', (reqObj)=>{
      setIncomingReq(r=> [...r.filter(x=>x.id!==reqObj.id), reqObj]);
    });
    s.on('friends:added', ({friend})=>{
      setFriends(f=> [...f.filter(x=>x.id!==friend.id), friend]);
      setOnlineMap(m=>({...m, [friend.id]: true}));
    });
    s.on('friends:removed', ({friendId})=>{
      setFriends(f=> f.filter(x=>x.id!==friendId));
      if(activeConvo?.user?.id===friendId) setActiveConvo(null);
    });

    s.on('message:new', (msg)=>{
      setMessages(ms=> {
        const arr = ms[msg.convoId] || [];
        return {...ms, [msg.convoId]: [...arr, msg]};
      });
    });
    s.on('message:edited', (msg)=>{
      setMessages(ms=>{
        const arr = ms[msg.convoId] || [];
        return {...ms, [msg.convoId]: arr.map(m=> m.id===msg.id ? {...m, text: msg.text, edited:true} : m)};
      });
    });
    s.on('message:deleted', ({messageId, convoId})=>{
      setMessages(ms=>{
        const arr = ms[convoId] || [];
        return {...ms, [convoId]: arr.filter(m=> m.id!==messageId)};
      });
    });
    s.on('message:reaction', ({messageId, reactions})=>{
      setMessages(ms=>{
        const newMs = {...ms};
        for(const cid in newMs){
          newMs[cid] = newMs[cid].map(m=> m.id===messageId ? {...m, reactions} : m);
        }
        return newMs;
      });
    });

    s.on('typing:start', ({convoId, userId})=> setTypingMap(m=> ({...m, [convoId]: userId})));
    s.on('typing:stop', ({convoId})=> setTypingMap(m=> { const n={...m}; delete n[convoId]; return n; }));

    s.on('group:created', (g)=>{
      setGroups(gs=> [...gs.filter(x=>x.id!==g.id), g]);
    });
    s.on('group:updated', (g)=>{
      setGroups(gs=> gs.map(x=> x.id===g.id ? g : x));
      if(activeConvo?.id===g.id) setActiveConvo({id:g.id, type:'group', group:g});
    });
    s.on('group:left', ({groupId})=>{
      setGroups(gs=> gs.filter(x=>x.id!==groupId));
      if(activeConvo?.id===groupId) setActiveConvo(null);
    });

    // Calls
    s.on('call:incoming', (data)=>{
      setCall({callId: data.callId, isIncoming:true, from: data.from, type: data.type, groupId: data.groupId, group: data.group});
    });
    s.on('call:accepted', ({callId, userId, user: u})=>{
      if(call?.callId!==callId) return;
      // Will create peer
    });
    s.on('call:rejected', ()=>{
      endCall(false);
      alert('Звонок отклонен');
    });
    s.on('call:ended', ()=> endCall(false));
    s.on('call:participant:left', ({userId})=>{
      const pc = peersRef.current.get(userId);
      if(pc) pc.close();
      peersRef.current.delete(userId);
      setRemoteStreams(rs=> { const n={...rs}; delete n[userId]; return n; });
    });

    s.on('webrtc:offer', async ({callId, fromUserId, offer})=>{
      if(!localStream){
        try{
          const stream = await navigator.mediaDevices.getUserMedia({video: call?.type!=='audio', audio: {echoCancellation:true, noiseSuppression: noiseSuppression}});
          setLocalStream(stream);
        }catch(e){ console.error(e); return; }
      }
      const pc = createPeer(fromUserId, false);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit('webrtc:answer', {callId, toUserId: fromUserId, answer});
    });
    s.on('webrtc:answer', async ({fromUserId, answer})=>{
      const pc = peersRef.current.get(fromUserId);
      if(pc) await pc.setRemoteDescription(answer);
    });
    s.on('webrtc:ice', async ({fromUserId, candidate})=>{
      const pc = peersRef.current.get(fromUserId);
      if(pc && candidate) await pc.addIceCandidate(candidate).catch(()=>{});
    });

    return ()=> s.disconnect();
  }, [token, user, call, localStream, noiseSuppression]);

  // Messages fetch when activeConvo changes
  useEffect(()=>{
    if(!activeConvo || !token) return;
    fetch(`${API}/api/messages/${activeConvo.id}`, {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{
      if(d.messages) setMessages(ms=> ({...ms, [activeConvo.id]: d.messages}));
    });
  }, [activeConvo, token]);

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:'smooth'});
  }, [messages, activeConvo]);

  // Peer creation
  function createPeer(peerId, isInitiator){
    if(peersRef.current.has(peerId)) return peersRef.current.get(peerId);
    const iceServers = JSON.parse(localStorage.getItem('cb_ice') || '[{"urls":"stun:stun.l.google.com:19302"}]');
    const pc = new RTCPeerConnection({iceServers});
    if(localStream){
      localStream.getTracks().forEach(t=> pc.addTrack(t, localStream));
    }
    pc.onicecandidate = (e)=>{
      if(e.candidate) socket?.emit('webrtc:ice', {callId: call?.callId, toUserId: peerId, candidate: e.candidate});
    };
    pc.ontrack = (e)=>{
      setRemoteStreams(rs=> ({...rs, [peerId]: e.streams[0]}));
    };
    peersRef.current.set(peerId, pc);
    if(isInitiator){
      // Will create offer later
    }
    return pc;
  }

  async function startCall(targetUserId, type='video', groupId=null){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type!=='audio' ? {width:{ideal:1280}, height:{ideal:720}} : false,
        audio: {echoCancellation:true, noiseSuppression: noiseSuppression, autoGainControl:true}
      });
      setLocalStream(stream);
      if(groupId){
        socket.emit('call:invite', {type, groupId});
        const members = groups.find(g=>g.id===groupId)?.members || [];
        for(const m of members){
          if(m.id===user.id) continue;
          const pc = createPeer(m.id, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', {callId: call?.callId || 'temp', toUserId: m.id, offer});
        }
        setCall({callId: 'temp-'+Date.now(), type, groupId, isIncoming:false});
      } else {
        socket.emit('call:invite', {toUserId: targetUserId, type});
        setCall({callId: 'temp-'+Date.now(), type, targetUserId, isIncoming:false});
        // Peer will be created after accepted
      }
    }catch(e){
      alert('Ошибка камеры/микрофона: '+e.message);
    }
  }

  async function acceptCall(){
    if(!call) return;
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        video: call.type!=='audio',
        audio: {echoCancellation:true, noiseSuppression: noiseSuppression}
      });
      setLocalStream(stream);
      socket.emit('call:accept', {callId: call.callId});
      setCall({...call, isIncoming:false});
      if(call.groupId){
        const members = groups.find(g=>g.id===call.groupId)?.members || [];
        for(const m of members){
          if(m.id===user.id) continue;
          const pc = createPeer(m.id, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', {callId: call.callId, toUserId: m.id, offer});
        }
      } else if(call.from){
        const pc = createPeer(call.from.id, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', {callId: call.callId, toUserId: call.from.id, offer});
      }
    }catch(e){ alert(e.message); }
  }

  function endCall(emit=true){
    if(emit && socket && call?.callId) socket.emit('call:leave', {callId: call.callId});
    localStream?.getTracks().forEach(t=> t.stop());
    setLocalStream(null);
    setRemoteStreams({});
    peersRef.current.forEach(pc=> pc.close());
    peersRef.current.clear();
    setCall(null);
    setIsScreenSharing(false);
    setIsRecording(false);
  }

  async function toggleScreen(){
    if(!call) return;
    if(isScreenSharing){
      // Back to cam
      try{
        const camStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        const videoTrack = camStream.getVideoTracks()[0];
        peersRef.current.forEach(pc=>{
          const sender = pc.getSenders().find(s=> s.track && s.track.kind==='video');
          if(sender) sender.replaceTrack(videoTrack);
        });
        localStream?.getTracks().forEach(t=> t.stop());
        setLocalStream(camStream);
        setIsScreenSharing(false);
      }catch{}
    } else {
      try{
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {width:{ideal:1920}, height:{ideal:1080}, frameRate:{ideal:30}},
          audio:true
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        peersRef.current.forEach(pc=>{
          const sender = pc.getSenders().find(s=> s.track && s.track.kind==='video');
          if(sender) sender.replaceTrack(screenTrack);
        });
        screenTrack.onended = ()=> toggleScreen();
        setIsScreenSharing(true);
        // Keep screen stream as local for preview
        if(localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      }catch(e){ alert('Экран: '+e.message); }
    }
  }

  function toggleMute(){
    if(!localStream) return;
    localStream.getAudioTracks().forEach(t=> t.enabled = !t.enabled);
    setIsMuted(!isMuted);
  }
  function toggleCam(){
    if(!localStream) return;
    localStream.getVideoTracks().forEach(t=> t.enabled = !t.enabled);
    setIsCamOff(!isCamOff);
  }

  function toggleRecording(){
    if(isRecording){
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      if(!localStream) return;
      const recorder = new MediaRecorder(localStream, {mimeType:'video/webm'});
      const chunks = [];
      recorder.ondataavailable = e=> chunks.push(e.data);
      recorder.onstop = ()=>{
        const blob = new Blob(chunks, {type:'video/webm'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `cbopka-${Date.now()}.webm`; a.click();
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  }

  async function handleFileUpload(e){
    const file = e.target.files[0];
    if(!file) return;
    const form = new FormData();
    form.append('file', file);
    try{
      const res = await fetch(`${API}/api/upload`, {
        method:'POST',
        headers:{Authorization:`Bearer ${token}`},
        body: form
      });
      const data = await res.json();
      if(data.url){
        socket.emit('message:send', {convoId: activeConvo.id, text: `📎 Файл: ${data.name}`, type:'file', meta: {url: data.url, name: data.name, mime: data.mime, size: data.size}});
      }
    }catch(err){ alert('Ошибка загрузки'); }
  }

  function sendMessage(){
    if(!input.trim() || !activeConvo || !socket) return;
    if(editingMsg){
      socket.emit('message:edit', {messageId: editingMsg.id, text: input});
      setEditingMsg(null);
    } else {
      socket.emit('message:send', {convoId: activeConvo.id, text: input});
    }
    setInput('');
    socket.emit('typing:stop', {convoId: activeConvo.id});
  }

  function searchUsers(q){
    if(!q.trim()){ setAllUsers([]); return; }
    fetch(`${API}/api/users/search?q=${encodeURIComponent(q)}`, {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{
      if(d.users) setAllUsers(d.users);
    });
  }

  const conversations = useMemo(()=>{
    const list = [];
    friends.forEach(f=>{
      const cid = getConvoId(user.id, f.id);
      const msgs = messages[cid] || [];
      list.push({id:cid, type:'dm', user:f, lastMessage: msgs[msgs.length-1], unread:0});
    });
    groups.forEach(g=>{
      const msgs = messages[g.id] || [];
      list.push({id:g.id, type:'group', group:g, lastMessage: msgs[msgs.length-1], unread:0});
    });
    list.sort((a,b)=> (b.lastMessage?.at||0) - (a.lastMessage?.at||0));
    return list;
  }, [friends, groups, messages, user?.id]);

  const filteredConvos = useMemo(()=>{
    if(tab==='friends') return [];
    if(tab==='groups') return conversations.filter(c=> c.type==='group');
    return conversations;
  }, [conversations, tab]);

  const filteredMessages = useMemo(()=>{
    if(!activeConvo) return [];
    const msgs = messages[activeConvo.id] || [];
    if(!searchMsg.trim()) return msgs;
    return msgs.filter(m=> m.text.toLowerCase().includes(searchMsg.toLowerCase()));
  }, [messages, activeConvo, searchMsg]);

  if(!user){
    return <Auth onAuth={handleAuth} onP2P={()=>{
      localStorage.setItem('cb_p2p_mode','1');
      setP2pMode(true);
    }} />;
  }

  return (
    <div className={`h-[100dvh] w-screen bg-[#0f0f12] text-[#e6e6eb] flex overflow-hidden relative ${theme}`}>
      {/* Sidebar */}
      <div className={`w-[340px] shrink-0 bg-[#15151a] border-r border-[#23232a] flex flex-col z-20 transition-transform duration-300 lg:translate-x-0 ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} absolute lg:relative h-full`}>
        <div className="p-4 flex items-center gap-3 border-b border-[#23232a]">
          <img src={user.avatar} className="w-10 h-10 rounded-full object-cover bg-[#232329]" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] truncate">{user.username}</div>
            <div className="text-[12px] text-[#00d084] flex items-center gap-1"><span className="w-2 h-2 bg-[#00d084] rounded-full inline-block"></span> в сети • {user.customStatus||'Cbopka'}</div>
          </div>
          <button onClick={()=>setShowProfile(true)} className="w-8 h-8 rounded-full bg-[#232329] flex items-center justify-center hover:bg-[#2a2a33]">⚙️</button>
          <button onClick={()=>setShowSidebar(false)} className="lg:hidden w-8 h-8 rounded-full bg-[#232329] flex items-center justify-center">✕</button>
        </div>

        <div className="p-3 flex gap-2">
          <button onClick={()=>setTab('chats')} className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition ${tab==='chats'?'bg-white text-black':'bg-[#1e1e24] text-[#9a9aa3] hover:bg-[#232329]'}`}>Чаты</button>
          <button onClick={()=>setTab('friends')} className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition ${tab==='friends'?'bg-white text-black':'bg-[#1e1e24] text-[#9a9aa3] hover:bg-[#232329]'}`}>Друзья</button>
          <button onClick={()=>setTab('groups')} className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition ${tab==='groups'?'bg-white text-black':'bg-[#1e1e24] text-[#9a9aa3] hover:bg-[#232329]'}`}>Группы</button>
        </div>

        <div className="px-3 pb-3 flex gap-2">
          <button onClick={()=>setShowAddFriend(true)} className="flex-1 bg-[#7c5cff] hover:bg-[#6b4df0] text-white rounded-xl py-2.5 text-[13px] font-semibold flex items-center justify-center gap-1.5"><span>＋</span> Друга</button>
          <button onClick={()=>setShowCreateGroup(true)} className="flex-1 bg-[#232329] hover:bg-[#2a2a33] border border-[#2a2a33] rounded-xl py-2.5 text-[13px] font-semibold">＋ Группу</button>
        </div>
        <div className="px-3 pb-2">
          <button onClick={()=>{
            localStorage.setItem('cb_p2p_mode','1');
            setP2pMode(true);
          }} className="w-full bg-[#00d084]/10 hover:bg-[#00d084]/20 border border-[#00d084]/20 text-[#00d084] rounded-xl py-2.5 text-[12px] font-semibold">⚡ P2P без сервера — сразу общаться</button>
        </div>

        <div className="px-3 pb-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a66]">🔍</span>
            <input onChange={e=>searchUsers(e.target.value)} placeholder="Поиск людей..." className="w-full bg-[#1e1e24] border border-[#2a2a33] rounded-xl pl-9 pr-3 py-2.5 text-[13px] outline-none focus:border-[#7c5cff] placeholder:text-[#5a5a66]" />
          </div>
          {allUsers.length>0 && (
            <div className="mt-2 bg-[#1e1e24] border border-[#2a2a33] rounded-xl overflow-hidden">
              {allUsers.slice(0,5).map(u=>(
                <div key={u.id} className="flex items-center gap-2 p-2.5 hover:bg-[#232329] cursor-pointer" onClick={()=>{
                  const cid = [user.id, u.id].sort().join('_');
                  setActiveConvo({id:cid, type:'dm', user:u});
                  setShowSidebar(false);
                  setAllUsers([]);
                }}>
                  <img src={u.avatar} className="w-8 h-8 rounded-full" />
                  <div className="flex-1 min-w-0"><div className="text-[13px] font-medium truncate">{u.username}</div><div className="text-[11px] text-[#9a9aa3] truncate">{u.bio}</div></div>
                  <button onClick={(e)=>{ e.stopPropagation(); socket.emit('friends:request',{toUserId:u.id}); }} className="text-[11px] bg-[#7c5cff] px-2.5 py-1 rounded-full font-semibold">Добавить</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto px-2 pb-2 space-y-1">
          {tab==='friends' ? (
            <>
              {incomingReq.length>0 && (
                <div className="px-2 py-2">
                  <div className="text-[11px] text-[#9a9aa3] font-semibold uppercase tracking-wider mb-2">Заявки • {incomingReq.length}</div>
                  {incomingReq.map(r=>(
                    <div key={r.id} className="flex items-center gap-2 bg-[#1e1e24] border border-[#2a2a33] rounded-xl p-2.5 mb-2">
                      <img src={r.fromUser?.avatar} className="w-8 h-8 rounded-full" />
                      <div className="flex-1 min-w-0"><div className="text-[13px] font-medium truncate">{r.fromUser?.username}</div><div className="text-[11px] text-[#9a9aa3]">хочет дружить</div></div>
                      <button onClick={()=>socket.emit('friends:accept',{requestId:r.id})} className="w-7 h-7 rounded-full bg-[#00d084] text-black font-bold">✓</button>
                      <button onClick={()=>socket.emit('friends:reject',{requestId:r.id})} className="w-7 h-7 rounded-full bg-[#2a2a33]">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-2">
                <div className="text-[11px] text-[#9a9aa3] font-semibold uppercase tracking-wider mb-2">Друзья • {friends.length}</div>
                {friends.map(f=>(
                  <div key={f.id} onClick={()=>{
                    const cid = [user.id, f.id].sort().join('_');
                    setActiveConvo({id:cid, type:'dm', user:f});
                    setShowSidebar(false);
                  }} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-[#1e1e24] transition ${activeConvo?.id===getConvoId(user.id,f.id)?'bg-[#1e1e24]':''}`}>
                    <div className="relative"><img src={f.avatar} className="w-9 h-9 rounded-full" /><span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#15151a] ${onlineMap[f.id]?'bg-[#00d084]':'bg-[#5a5a66]'}`}></span></div>
                    <div className="flex-1 min-w-0"><div className="text-[13px] font-medium truncate">{f.username}</div><div className="text-[11px] text-[#9a9aa3] truncate">{onlineMap[f.id]?'в сети':'оффлайн'} • {f.customStatus||f.bio}</div></div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            filteredConvos.map(c=>(
              <div key={c.id} onClick={()=>{setActiveConvo(c); setShowSidebar(false);}} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-[#1e1e24] transition ${activeConvo?.id===c.id?'bg-[#1e1e24]':''}`}>
                <img src={c.type==='dm'?c.user.avatar:c.group.avatar} className="w-9 h-9 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{c.type==='dm'?c.user.username:c.group.name}</div>
                  <div className="text-[11px] text-[#9a9aa3] truncate">{typingMap[c.id] ? 'печатает...' : c.lastMessage ? `${c.lastMessage.from===user.id?'Вы: ':''}${c.lastMessage.text.slice(0,30)}` : 'Нет сообщений'}</div>
                </div>
                <div className="text-[10px] text-[#5a5a66]">{c.lastMessage ? new Date(c.lastMessage.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[#23232a] flex items-center gap-2">
          <button onClick={()=>setTheme(theme==='dark'?'light': theme==='light'?'amoled':'dark')} className="w-8 h-8 rounded-full bg-[#1e1e24] flex items-center justify-center text-[12px]">{theme==='dark'?'🌙':theme==='light'?'☀️':'🖤'}</button>
          <div className="flex-1 text-[11px] text-[#5a5a66]">Тема: {theme} • SQLite • P2P</div>
          <button onClick={logout} className="text-[11px] text-[#9a9aa3] hover:text-white">Выйти</button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[#0f0f12] relative">
        {!activeConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-[24px] bg-[#7c5cff]/20 flex items-center justify-center mb-4 text-3xl">💬</div>
            <h2 className="text-[20px] font-bold">Выбери чат</h2>
            <p className="text-[#9a9aa3] text-[14px] mt-2 max-w-[360px]">Добавь друга, создай группу или используй P2P без сервера — сразу общаться по ID, без общего WiFi!</p>
            <div className="mt-6 grid grid-cols-2 gap-3 max-w-[360px] w-full">
              <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4 text-left"><div className="text-[13px] font-semibold">📎 Файлы</div><div className="text-[11px] text-[#9a9aa3] mt-1">До 100MB, фото, видео, доки</div></div>
              <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4 text-left"><div className="text-[13px] font-semibold">😊 Реакции</div><div className="text-[11px] text-[#9a9aa3] mt-1">Эмодзи на сообщения</div></div>
              <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4 text-left"><div className="text-[13px] font-semibold">✏️ Правка</div><div className="text-[11px] text-[#9a9aa3] mt-1">Редактируй и удаляй</div></div>
              <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4 text-left"><div className="text-[13px] font-semibold">🔗 Инвайты</div><div className="text-[11px] text-[#9a9aa3] mt-1">Ссылки-приглашения</div></div>
            </div>
          </div>
        ) : (
          <>
            <div className="h-[56px] border-b border-[#23232a] bg-[#15151a] flex items-center px-4 gap-3">
              <button onClick={()=>setShowSidebar(true)} className="lg:hidden w-8 h-8 rounded-full bg-[#1e1e24] flex items-center justify-center">☰</button>
              <img src={activeConvo.type==='dm'?activeConvo.user.avatar:activeConvo.group.avatar} className="w-8 h-8 rounded-full" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14px] truncate">{activeConvo.type==='dm'?activeConvo.user.username:activeConvo.group.name}</div>
                <div className="text-[11px] text-[#9a9aa3] truncate">{activeConvo.type==='dm' ? (onlineMap[activeConvo.user.id]?'в сети':'оффлайн') : `${activeConvo.group.members?.length||0} участников`}</div>
              </div>
              <div className="flex items-center gap-2">
                <input value={searchMsg} onChange={e=>setSearchMsg(e.target.value)} placeholder="Поиск..." className="hidden md:block bg-[#1e1e24] border border-[#2a2a33] rounded-full px-3 py-1.5 text-[12px] w-[140px] outline-none focus:border-[#7c5cff]" />
                <button onClick={()=>startCall(activeConvo.type==='dm'?activeConvo.user.id:null, 'audio', activeConvo.type==='group'?activeConvo.id:null)} className="w-8 h-8 rounded-full bg-[#1e1e24] hover:bg-[#232329] flex items-center justify-center">📞</button>
                <button onClick={()=>startCall(activeConvo.type==='dm'?activeConvo.user.id:null, 'video', activeConvo.type==='group'?activeConvo.id:null)} className="w-8 h-8 rounded-full bg-[#7c5cff] hover:bg-[#6b4df0] flex items-center justify-center">🎥</button>
                <button onClick={()=>setShowRight(!showRight)} className="w-8 h-8 rounded-full bg-[#1e1e24] hover:bg-[#232329] flex items-center justify-center">ℹ️</button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3" onDragOver={e=>e.preventDefault()} onDrop={e=>{ e.preventDefault(); if(e.dataTransfer.files[0]){ fileInputRef.current.files = e.dataTransfer.files; handleFileUpload({target:{files:e.dataTransfer.files}}); }}}>
              {filteredMessages.map(m=>{
                const isMe = m.from===user.id || m.fromId===user.id;
                const fromUser = isMe ? user : (activeConvo.type==='dm' ? activeConvo.user : groups.find(g=>g.id===activeConvo.id)?.members?.find(x=>x.id===(m.from||m.fromId)));
                return (
                  <div key={m.id} className={`group flex gap-2 ${isMe?'justify-end':'justify-start'}`}>
                    {!isMe && <img src={fromUser?.avatar} className="w-7 h-7 rounded-full mt-1 shrink-0" />}
                    <div className={`relative max-w-[70%] ${isMe?'order-first':''}`}>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-[1.4] break-words ${isMe?'bg-[#7c5cff] text-white rounded-br-[4px]':'bg-[#1e1e24] border border-[#2a2a33] rounded-bl-[4px]'}`}>
                        {m.type==='file' && m.meta ? (
                          <div>
                            <div className="font-semibold">📎 {m.meta.name}</div>
                            <div className="text-[11px] opacity-80">{(m.meta.size/1024).toFixed(1)} KB • {m.meta.mime}</div>
                            <a href={m.meta.url} target="_blank" rel="noreferrer" className="mt-2 inline-block bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-[12px]">Скачать</a>
                          </div>
                        ) : (
                          <>{m.text}{m.edited && <span className="text-[10px] opacity-60 ml-2">(изменено)</span>}</>
                        )}
                      </div>
                      {m.reactions && Object.keys(m.reactions).length>0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Object.entries(m.reactions).map(([emoji, users])=>(
                            <span key={emoji} className="bg-[#1e1e24] border border-[#2a2a33] rounded-full px-2 py-0.5 text-[11px]">{emoji} {users.length}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-[#5a5a66]">{new Date(m.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        <div className="hidden group-hover:flex gap-1">
                          <button onClick={()=>socket.emit('message:react',{messageId:m.id, emoji:'❤️'})} className="text-[12px] hover:scale-110">❤️</button>
                          <button onClick={()=>socket.emit('message:react',{messageId:m.id, emoji:'👍'})} className="text-[12px] hover:scale-110">👍</button>
                          <button onClick={()=>socket.emit('message:react',{messageId:m.id, emoji:'😂'})} className="text-[12px] hover:scale-110">😂</button>
                          {isMe && <>
                            <button onClick={()=>{setEditingMsg(m); setInput(m.text);}} className="text-[10px] text-[#9a9aa3] hover:text-white">✏️</button>
                            <button onClick={()=>socket.emit('message:delete',{messageId:m.id})} className="text-[10px] text-[#9a9aa3] hover:text-red-400">🗑️</button>
                          </>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingMap[activeConvo.id] && <div className="text-[11px] text-[#9a9aa3] px-2">печатает...</div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-[#23232a] bg-[#15151a]">
              {editingMsg && <div className="mb-2 bg-[#1e1e24] border border-[#2a2a33] rounded-xl px-3 py-2 flex items-center justify-between"><span className="text-[12px] text-[#9a9aa3]">Редактирование: {editingMsg.text.slice(0,30)}</span><button onClick={()=>{setEditingMsg(null); setInput('');}} className="text-[12px]">✕</button></div>}
              <div className="flex items-end gap-2">
                <button onClick={()=>fileInputRef.current.click()} className="w-10 h-10 rounded-full bg-[#1e1e24] hover:bg-[#232329] flex items-center justify-center shrink-0">📎</button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <div className="flex-1 relative">
                  <input value={input} onChange={e=>{setInput(e.target.value); if(e.target.value.trim()){ socket.emit('typing:start',{convoId:activeConvo.id}); if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current=setTimeout(()=>socket.emit('typing:stop',{convoId:activeConvo.id}),1500); }}} onKeyDown={e=> e.key==='Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())} placeholder="Сообщение..." className="w-full bg-[#1e1e24] border border-[#2a2a33] rounded-[20px] pl-4 pr-12 py-3 text-[14px] outline-none focus:border-[#7c5cff] resize-none" />
                  <button onClick={sendMessage} className="absolute right-1 top-1 w-8 h-8 rounded-full bg-[#7c5cff] hover:bg-[#6b4df0] flex items-center justify-center">➤</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right panel */}
      {showRight && activeConvo && (
        <div className="w-[300px] shrink-0 bg-[#15151a] border-l border-[#23232a] flex flex-col absolute lg:relative right-0 top-0 h-full z-30">
          <div className="p-4 border-b border-[#23232a] flex items-center justify-between">
            <div className="font-semibold text-[14px]">Инфо</div>
            <button onClick={()=>setShowRight(false)} className="w-7 h-7 rounded-full bg-[#1e1e24] flex items-center justify-center">✕</button>
          </div>
          <div className="p-4 flex flex-col items-center">
            <img src={activeConvo.type==='dm'?activeConvo.user.avatar:activeConvo.group.avatar} className="w-20 h-20 rounded-full object-cover" />
            <div className="font-semibold mt-3">{activeConvo.type==='dm'?activeConvo.user.username:activeConvo.group.name}</div>
            <div className="text-[12px] text-[#9a9aa3] mt-1 text-center">{activeConvo.type==='dm'?activeConvo.user.bio:activeConvo.group.description}</div>
            {activeConvo.type==='dm' ? (
              <button onClick={()=>{ if(confirm('Удалить из друзей?')) socket.emit('friends:remove',{friendId:activeConvo.user.id}); }} className="mt-4 w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-2.5 rounded-xl text-[13px] font-semibold">Удалить из друзей</button>
            ) : (
              <>
                <button onClick={async()=>{
                  const res = await fetch(`${API}/api/groups/${activeConvo.id}/invite`, {method:'POST', headers:{Authorization:`Bearer ${token}`}});
                  const data = await res.json();
                  if(data.link){ prompt('Ссылка-приглашение (скопируй):', data.link); }
                }} className="mt-4 w-full bg-[#7c5cff]/10 hover:bg-[#7c5cff]/20 border border-[#7c5cff]/20 text-[#7c5cff] py-2.5 rounded-xl text-[13px] font-semibold">🔗 Создать инвайт-ссылку</button>
                <button onClick={()=>{ if(confirm('Выйти из группы?')) socket.emit('group:leave',{groupId:activeConvo.group.id}); }} className="mt-3 w-full bg-[#232329] hover:bg-[#2a2a33] py-2.5 rounded-xl text-[13px]">Выйти из группы</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Call overlay */}
      {call && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0f] flex flex-col">
          <div className="flex-1 relative bg-black overflow-hidden">
            {Object.keys(remoteStreams).length>0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-full p-2">
                {Object.entries(remoteStreams).map(([uid, stream])=>(
                  <video key={uid} autoPlay playsInline ref={el=>{ if(el) el.srcObject=stream; }} className="w-full h-full object-cover rounded-2xl bg-[#1a1a1f]" />
                ))}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#9a9aa3]">Ожидание участников...</div>
            )}
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-[140px] md:w-[200px] aspect-video object-cover rounded-2xl border-2 border-white/20 bg-[#1a1a1f] shadow-2xl" />
            <div className="absolute top-4 left-4 flex gap-2">
              <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[12px]">🔴 {call.groupId ? 'Группа' : call.from?.username || 'Звонок'} {isScreenSharing?'• Экран 1080p':''} {isRecording?'• ● REC':''}</div>
              {noiseSuppression && <div className="bg-[#00d084]/20 border border-[#00d084]/30 px-3 py-1.5 rounded-full text-[11px] text-[#00d084]">🎧 Шумодав</div>}
            </div>
          </div>
          <div className="h-[100px] bg-[#15151a] border-t border-[#23232a] flex items-center justify-center gap-2 md:gap-3 px-4">
            <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isMuted?'bg-red-500':'bg-[#232329] hover:bg-[#2a2a33]'}`}>{isMuted?'🔇':'🎙️'}</button>
            <button onClick={toggleCam} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isCamOff?'bg-red-500':'bg-[#232329] hover:bg-[#2a2a33]'}`}>{isCamOff?'🚫':'🎥'}</button>
            <button onClick={toggleScreen} className={`px-3 md:px-4 h-12 rounded-full flex items-center justify-center text-[12px] font-semibold transition ${isScreenSharing?'bg-[#7c5cff]':'bg-[#232329] hover:bg-[#2a2a33]'}`}>🖥️ 1080p</button>
            <button onClick={toggleRecording} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isRecording?'bg-red-500 animate-pulse':'bg-[#232329] hover:bg-[#2a2a33]'}`}>●</button>
            <button onClick={()=>setNoiseSuppression(!noiseSuppression)} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${noiseSuppression?'bg-[#00d084] text-black':'bg-[#232329]'}`}>🎧</button>
            {call.isIncoming ? (
              <>
                <button onClick={acceptCall} className="bg-[#00d084] hover:bg-[#00b86f] text-black px-6 md:px-8 h-12 rounded-full font-semibold">✓ Принять</button>
                <button onClick={()=>{ socket.emit('call:reject',{callId:call.callId}); endCall(false); }} className="bg-[#232329] hover:bg-[#2a2a33] px-6 md:px-8 h-12 rounded-full font-semibold">✕ Отклонить</button>
              </>
            ) : (
              <button onClick={()=>endCall()} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-xl">✕</button>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddFriend && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur flex items-center justify-center p-4" onClick={()=>setShowAddFriend(false)}>
          <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-[20px] p-6 w-full max-w-[360px]" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Добавить друга</h3><button onClick={()=>setShowAddFriend(false)} className="w-7 h-7 rounded-full bg-[#232329] flex items-center justify-center">✕</button></div>
            <AddFriendForm socket={socket} onDone={()=>setShowAddFriend(false)} />
          </div>
        </div>
      )}
      {showCreateGroup && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur flex items-center justify-center p-4" onClick={()=>setShowCreateGroup(false)}>
          <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-[20px] p-6 w-full max-w-[400px]" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Создать группу</h3><button onClick={()=>setShowCreateGroup(false)} className="w-7 h-7 rounded-full bg-[#232329] flex items-center justify-center">✕</button></div>
            <CreateGroupForm friends={friends} socket={socket} onDone={()=>setShowCreateGroup(false)} />
          </div>
        </div>
      )}
      {showProfile && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur flex items-center justify-center p-4" onClick={()=>setShowProfile(false)}>
          <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-[20px] p-6 w-full max-w-[400px] max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Профиль</h3><button onClick={()=>setShowProfile(false)} className="w-7 h-7 rounded-full bg-[#232329] flex items-center justify-center">✕</button></div>
            <ProfileForm user={user} socket={socket} token={token} onUpdate={u=>{ setUser(u); localStorage.setItem('cb_user', JSON.stringify(u)); }} theme={theme} setTheme={setTheme} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddFriendForm({socket, onDone}){
  const [q, setQ] = useState('');
  const [res, setRes] = useState('');
  function send(){
    if(!q.trim()) return;
    socket.emit('friends:request', {toUsername: q.trim()});
    setRes(`Заявка ${q.trim()} отправлена!`);
    setTimeout(()=>{ onDone(); }, 800);
  }
  return (
    <div className="space-y-4">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ник друга" className="w-full bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#7c5cff]" />
      {res && <div className="bg-[#00d084]/10 border border-[#00d084]/20 text-[#00d084] text-[12px] rounded-xl px-3 py-2">{res}</div>}
      <button onClick={send} disabled={!q.trim()} className="w-full bg-white text-black font-semibold py-3 rounded-xl text-[14px] disabled:opacity-50">Отправить заявку</button>
    </div>
  );
}

function CreateGroupForm({friends, socket, onDone}){
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selected, setSelected] = useState([]);
  return (
    <div className="space-y-4">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название группы" className="w-full bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#7c5cff]" />
      <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Описание (необязательно)" className="w-full bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#7c5cff]" />
      <div className="max-h-[180px] overflow-auto bg-[#0f0f12] border border-[#2a2a33] rounded-xl p-2 space-y-1">
        {friends.map(f=>(
          <label key={f.id} className="flex items-center gap-2 p-2 hover:bg-[#1e1e24] rounded-lg cursor-pointer">
            <input type="checkbox" checked={selected.includes(f.id)} onChange={e=> setSelected(s=> e.target.checked ? [...s, f.id] : s.filter(id=>id!==f.id))} className="accent-[#7c5cff]" />
            <img src={f.avatar} className="w-7 h-7 rounded-full" />
            <span className="text-[13px]">{f.username}</span>
          </label>
        ))}
        {friends.length===0 && <div className="text-[12px] text-[#5a5a66] p-2">Сначала добавь друзей</div>}
      </div>
      <button disabled={!name.trim()} onClick={()=>{
        socket.emit('group:create', {name, description:desc, memberIds:selected});
        onDone();
      }} className="w-full bg-white text-black font-semibold py-3 rounded-xl text-[14px] disabled:opacity-50">Создать группу</button>
    </div>
  );
}

function ProfileForm({user, socket, token, onUpdate, theme, setTheme}){
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [customStatus, setCustomStatus] = useState(user.customStatus||'');
  const [avatar, setAvatar] = useState(user.avatar);
  const [saving, setSaving] = useState(false);
  const [serverUrl, setServerUrl] = useState(()=> localStorage.getItem('cb_server_url')||'');

  async function handleAvatar(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=> setAvatar(reader.result);
    reader.readAsDataURL(file);
  }

  function save(){
    setSaving(true);
    socket.emit('user:update', {username, bio, customStatus, avatar, theme});
    setTimeout(()=>{
      const updated = {...user, username, bio, customStatus, avatar, theme};
      onUpdate(updated);
      setSaving(false);
    }, 400);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <img src={avatar} className="w-20 h-20 rounded-full object-cover border-2 border-[#2a2a33]" />
          <label className="absolute bottom-0 right-0 w-7 h-7 bg-[#7c5cff] rounded-full flex items-center justify-center cursor-pointer text-[12px]">✏️<input type="file" accept="image/*" className="hidden" onChange={handleAvatar} /></label>
        </div>
        <div className="text-[11px] text-[#5a5a66]">Нажми на иконку чтобы сменить аватар</div>
      </div>
      <div>
        <label className="text-[12px] text-[#9a9aa3]">Никнейм</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full mt-1 bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#7c5cff]" />
      </div>
      <div>
        <label className="text-[12px] text-[#9a9aa3]">О себе</label>
        <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={2} className="w-full mt-1 bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#7c5cff] resize-none" />
      </div>
      <div>
        <label className="text-[12px] text-[#9a9aa3]">Кастомный статус (идея #32)</label>
        <input value={customStatus} onChange={e=>setCustomStatus(e.target.value)} placeholder="🎮 Играет в Dota, 💻 Кодит..." className="w-full mt-1 bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#7c5cff]" />
      </div>
      <div>
        <label className="text-[12px] text-[#9a9aa3]">Тема (идея #50)</label>
        <div className="flex gap-2 mt-1">
          {['dark','light','amoled'].map(t=>(
            <button key={t} onClick={()=>setTheme(t)} className={`flex-1 py-2 rounded-xl text-[12px] border ${theme===t?'bg-white text-black border-white':'bg-[#232329] border-[#2a2a33]'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="bg-[#15151a] border border-[#2a2a33] rounded-xl p-3 text-[11px] text-[#9a9aa3]">
        <div>ID: <span className="mono text-white">{user.id}</span></div>
        <div>Создан: {new Date(user.createdAt).toLocaleDateString()}</div>
        <div className="mt-2">Сервер: <span className="text-white break-all">{localStorage.getItem('cb_server_url')||window.location.origin}</span></div>
      </div>
      <div className="bg-[#15151a] border border-[#2a2a33] rounded-xl p-3">
        <label className="text-[12px] text-[#9a9aa3]">Сервер для .exe</label>
        <input value={serverUrl} onChange={e=>setServerUrl(e.target.value)} placeholder="https://твой-сервер.com" className="w-full mt-1 bg-[#232329] border border-[#2a2a33] rounded-xl px-3 py-2.5 text-[12px] outline-none focus:border-[#7c5cff]" />
        <div className="flex gap-2 mt-2">
          <button onClick={()=>{
            if(serverUrl.trim()) localStorage.setItem('cb_server_url', serverUrl.trim());
            else localStorage.removeItem('cb_server_url');
            location.reload();
          }} className="flex-1 bg-[#232329] hover:bg-[#2a2a33] py-2 rounded-lg text-[12px]">Сохранить и перезапустить</button>
          <button onClick={()=>{ localStorage.removeItem('cb_server_url'); setServerUrl(''); location.reload(); }} className="px-3 bg-[#232329] py-2 rounded-lg text-[12px]">Сброс</button>
        </div>
      </div>
      <button onClick={save} disabled={saving} className="w-full bg-[#7c5cff] hover:bg-[#6b4df0] text-white font-semibold py-3 rounded-xl text-[14px]">{saving?'Сохранение...':'Сохранить профиль'}</button>

      <div className="bg-[#15151a] border border-[#2a2a33] rounded-xl p-3">
        <div className="text-[12px] font-semibold mb-2">📦 2 варианта приложения (не браузер):</div>
        <div className="text-[11px] text-[#9a9aa3] space-y-1">
          <div><b>1. Electron:</b> `cd electron && npm run build:win` → нативное окно, трей, без браузера</div>
          <div><b>2. Python:</b> `python Cbopka.py` → нативное окно через pywebview, `pyinstaller --onefile Cbopka.py` → exe</div>
          <div className="mt-2">Скачать готовый exe: <a href="https://github.com/gggvkvh405-rgb/Cbopka/tree/release-exe" target="_blank" className="text-[#7c5cff] underline">GitHub release-exe</a></div>
        </div>
      </div>
    </div>
  );
}
