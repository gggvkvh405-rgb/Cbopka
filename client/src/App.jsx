import { useEffect, useState, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';

const API = ''; // proxied via vite
const SOCKET_URL = window.location.origin;

function uid() { return Math.random().toString(36).slice(2); }

// ---------- Auth ----------
function Auth({onAuth}) {
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
      {/* bg blobs */}
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
            <div className="bg-[#232329] rounded-xl py-3 border border-[#2a2a33]"><span className="block text-white font-semibold text-[13px]">∞</span>Группы</div>
            <div className="bg-[#232329] rounded-xl py-3 border border-[#2a2a33]"><span className="block text-white font-semibold text-[13px]">P2P</span>Звонки</div>
          </div>
        </div>

        <p className="text-center text-[12px] text-[#5a5a66] mt-6">Работает на ПК и телефоне. Без регистрации номера.</p>
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App(){
  const [user, setUser] = useState(()=> {
    try{ return JSON.parse(localStorage.getItem('cb_user')||'null'); }catch{ return null; }
  });
  const [token, setToken] = useState(()=> localStorage.getItem('cb_token')||'');
  const [socket, setSocket] = useState(null);

  const [friends, setFriends] = useState([]);
  const [incomingReq, setIncomingReq] = useState([]);
  const [outgoingReq, setOutgoingReq] = useState([]);
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // search results
  const [onlineMap, setOnlineMap] = useState({}); // userId -> bool

  const [activeConvo, setActiveConvo] = useState(null); // {id, type:'dm'|'group', user?, group?}
  const [messages, setMessages] = useState({}); // convoId -> []
  const [input, setInput] = useState('');
  const [typingMap, setTypingMap] = useState({}); // convoId -> userId
  const [showSidebar, setShowSidebar] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [tab, setTab] = useState('chats'); // chats|friends|groups

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Call state
  const [call, setCall] = useState(null); // {callId, type, groupId?, participants:[user], isIncoming, from?}
  const [callParticipants, setCallParticipants] = useState({}); // userId -> {stream, muted, camOff}
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peersRef = useRef(new Map()); // userId -> RTCPeerConnection
  const localVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // auth handler
  function handleAuth(u, t){
    setUser(u); setToken(t);
  }
  function logout(){
    localStorage.removeItem('cb_token'); localStorage.removeItem('cb_user');
    setUser(null); setToken(''); socket?.disconnect();
  }

  // fetch initial data
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
  }, [token]);

  // socket connect
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
    });
    s.on('friends:request:accepted', (fr)=>{
      setOutgoingReq(r=> r.filter(x=>x.id!==fr.id));
      setIncomingReq(r=> r.filter(x=>x.id!==fr.id));
    });
    s.on('friends:request:rejected', (fr)=>{
      setOutgoingReq(r=> r.filter(x=>x.id!==fr.id));
      setIncomingReq(r=> r.filter(x=>x.id!==fr.id));
    });

    s.on('group:created', (g)=>{
      setGroups(prev=> {
        const exists = prev.find(x=>x.id===g.id);
        if(exists) return prev.map(x=> x.id===g.id? g : x);
        return [...prev, g];
      });
    });
    s.on('group:updated', (g)=>{
      setGroups(prev=> prev.map(x=> x.id===g.id? g : x));
      if(activeConvo?.id===g.id) setActiveConvo(a=> ({...a, group:g}));
    });
    s.on('group:left', ({groupId})=>{
      setGroups(prev=> prev.filter(x=>x.id!==groupId));
      if(activeConvo?.id===groupId) setActiveConvo(null);
    });

    s.on('message:new', (msg)=>{
      setMessages(prev=> {
        const list = prev[msg.convoId]||[];
        if(list.find(m=>m.id===msg.id)) return prev;
        return {...prev, [msg.convoId]: [...list, msg]};
      });
    });
    s.on('typing:start', ({convoId, userId})=> setTypingMap(m=>({...m, [convoId]: userId})));
    s.on('typing:stop', ({convoId})=> setTypingMap(m=>{ const n={...m}; delete n[convoId]; return n; }));

    // Calls
    s.on('call:incoming', ({callId, from, type, groupId, group})=>{
      setCall({callId, type, groupId, from, isIncoming:true, group});
      // ring sound could be added
    });
    s.on('call:inviting', ({callId, type})=>{
      setCall({callId, type, isIncoming:false, isInviting:true});
    });
    s.on('call:started', ({callId, type, groupId})=>{
      setCall(c=> c && c.callId===callId ? {...c, isInviting:false} : {callId, type, groupId, isIncoming:false});
    });
    s.on('call:accepted', ({callId, userId, user:u})=>{
      // participant accepted, will initiate webrtc
      setCallParticipants(prev=> ({...prev, [userId]: {...(prev[userId]||{}), user:u}}));
    });
    s.on('call:joined', ({callId})=>{
      setCall(c=> c ? {...c, joined:true, isIncoming:false} : c);
    });
    s.on('call:rejected', ()=>{
      endCall(false);
    });
    s.on('call:participant:left', ({callId, userId})=>{
      const pc = peersRef.current.get(userId);
      if(pc) { pc.close(); peersRef.current.delete(userId); }
      setCallParticipants(prev=>{ const n={...prev}; delete n[userId]; return n; });
    });
    s.on('call:ended', ()=> endCall(false));

    // WebRTC
    s.on('webrtc:offer', async ({callId, fromUserId, offer, fromUser})=>{
      // if we haven't created peer yet
      let pc = peersRef.current.get(fromUserId);
      if(!pc){
        pc = createPeer(fromUserId, callId);
        peersRef.current.set(fromUserId, pc);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit('webrtc:answer', {callId, toUserId: fromUserId, answer});
      setCallParticipants(prev=> ({...prev, [fromUserId]: {...(prev[fromUserId]||{}), user: fromUser}}));
    });
    s.on('webrtc:answer', async ({fromUserId, answer})=>{
      const pc = peersRef.current.get(fromUserId);
      if(pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });
    s.on('webrtc:ice', async ({fromUserId, candidate})=>{
      const pc = peersRef.current.get(fromUserId);
      if(pc && candidate) {
        try{ await pc.addIceCandidate(new RTCIceCandidate(candidate)); }catch(e){ console.warn(e); }
      }
    });

    return ()=> s.disconnect();
  }, [token, user?.id]);

  // create peer helper
  function createPeer(peerId, callId){
    const pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}, {urls:'stun:stun1.l.google.com:19302'}]});
    pc.onicecandidate = (e)=>{
      if(e.candidate) socket?.emit('webrtc:ice', {callId, toUserId: peerId, candidate: e.candidate});
    };
    pc.ontrack = (e)=>{
      const stream = e.streams[0];
      setCallParticipants(prev=> ({...prev, [peerId]: {...(prev[peerId]||{}), stream}}));
    };
    pc.onconnectionstatechange = ()=>{
      if(pc.connectionState==='failed' || pc.connectionState==='disconnected'){
        // retry?
      }
    };
    // add local tracks if available
    if(localStream){
      localStream.getTracks().forEach(track=> pc.addTrack(track, localStream));
    }
    return pc;
  }

  async function startCall(targetUserId, type='video', groupId=null){
    if(!socket) return;
    // get media first
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type==='video' ? {width:{ideal:1280}, height:{ideal:720}} : false,
        audio: {echoCancellation:true, noiseSuppression:true, autoGainControl:true}
      });
      setLocalStream(stream);
      if(localVideoRef.current) localVideoRef.current.srcObject = stream;
    }catch(e){
      alert('Не удалось получить доступ к камере/микрофону: '+e.message);
      return;
    }

    if(groupId){
      socket.emit('call:invite', {type, groupId});
    } else {
      socket.emit('call:invite', {toUserId: targetUserId, type});
    }
    setCall({callId: null, type, groupId, isIncoming:false, isInviting:true, targetUserId});
    setCallParticipants({});
    peersRef.current.clear();
  }

  async function acceptCall(){
    if(!call || !socket) return;
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        video: call.type==='video' ? {width:{ideal:1280}, height:{ideal:720}} : false,
        audio: true
      });
      setLocalStream(stream);
      // for each existing participant, create offer
      // For group, we need to know participants? Server will send accepted events, but we can just wait for offers.
      // To initiate mesh, after joining, create offers to all known participants (excluding self)
      socket.emit('call:accept', {callId: call.callId});
      setCall(c=>({...c, isIncoming:false, joined:true}));
      // If it's 1-1, the caller will create offer, but we also prepare to create peer when offer arrives
      // For group, we should create offers to existing participants after short delay
      setTimeout(()=>{
        Object.keys(callParticipants).forEach(async pid=>{
          if(pid===user.id) return;
          let pc = peersRef.current.get(pid);
          if(!pc){
            pc = createPeer(pid, call.callId);
            peersRef.current.set(pid, pc);
          }
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', {callId: call.callId, toUserId: pid, offer});
        });
      }, 500);
    }catch(e){
      alert('Ошибка доступа к медиа: '+e.message);
    }
  }

  // When localStream changes, add tracks to peers and handle offers for initiator
  useEffect(()=>{
    if(!localStream || !call || !socket) return;
    // initiator: create offers to all participants that accepted
    // For 1-1 inviting flow
    if(call.isInviting && call.targetUserId){
      const pid = call.targetUserId;
      let pc = peersRef.current.get(pid);
      if(!pc){
        pc = createPeer(pid, call.callId || 'temp');
        peersRef.current.set(pid, pc);
      } else {
        // replace tracks
        const senders = pc.getSenders();
        localStream.getTracks().forEach(track=>{
          const sender = senders.find(s=> s.track && s.track.kind===track.kind);
          if(sender) sender.replaceTrack(track);
          else pc.addTrack(track, localStream);
        });
      }
    }
    // For group, also update
    peersRef.current.forEach((pc, pid)=>{
      const senders = pc.getSenders();
      localStream.getTracks().forEach(track=>{
        const sender = senders.find(s=> s.track && s.track.kind===track.kind);
        if(sender) sender.replaceTrack(track);
        else pc.addTrack(track, localStream);
      });
    });

    // If callId is known and we are initiator, create offer after stream
    if(call.callId && call.isInviting && call.targetUserId){
      (async()=>{
        const pc = peersRef.current.get(call.targetUserId);
        if(pc){
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', {callId: call.callId, toUserId: call.targetUserId, offer});
        }
      })();
    }
  }, [localStream]);

  // handle when new participant accepted, initiator creates offer
  useEffect(()=>{
    if(!socket || !call || !localStream) return;
    // when callParticipants updates and we are initiator or already joined, create offer to new participant if not exists
    Object.keys(callParticipants).forEach(async pid=>{
      if(peersRef.current.has(pid)) return;
      if(pid===user.id) return;
      const pc = createPeer(pid, call.callId);
      peersRef.current.set(pid, pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', {callId: call.callId, toUserId: pid, offer});
    });
  }, [callParticipants]);

  function endCall(emit=true){
    if(emit && socket && call?.callId) socket.emit('call:leave', {callId: call.callId});
    localStream?.getTracks().forEach(t=> t.stop());
    screenStream?.getTracks().forEach(t=> t.stop());
    peersRef.current.forEach(pc=> pc.close());
    peersRef.current.clear();
    setLocalStream(null);
    setScreenStream(null);
    setCall(null);
    setCallParticipants({});
    setIsMuted(false);
    setIsCamOff(false);
    setIsScreenSharing(false);
  }

  async function toggleMute(){
    if(!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(t=> t.enabled = !t.enabled);
    setIsMuted(!audioTracks[0]?.enabled);
  }
  async function toggleCam(){
    if(!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach(t=> t.enabled = !t.enabled);
    setIsCamOff(!videoTracks[0]?.enabled);
  }
  async function toggleScreenShare(){
    if(isScreenSharing){
      // stop screen, restore cam
      screenStream?.getTracks().forEach(t=> t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      // restore cam track
      try{
        const camStream = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280}, height:{ideal:720}}, audio:false});
        const videoTrack = camStream.getVideoTracks()[0];
        // replace in localStream
        const oldVideo = localStream.getVideoTracks()[0];
        if(oldVideo) localStream.removeTrack(oldVideo);
        localStream.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStream.getTracks()));
        // replace in peers
        peersRef.current.forEach(pc=>{
          const sender = pc.getSenders().find(s=> s.track && s.track.kind==='video');
          if(sender) sender.replaceTrack(videoTrack);
        });
        if(localVideoRef.current) localVideoRef.current.srcObject = localStream;
      }catch(e){ console.warn(e); }
    } else {
      try{
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: {width:{ideal:1920}, height:{ideal:1080}, frameRate:{ideal:30}, displaySurface:'monitor'},
          audio: true
        });
        setScreenStream(display);
        setIsScreenSharing(true);
        const screenTrack = display.getVideoTracks()[0];
        // replace track in all peers
        peersRef.current.forEach(pc=>{
          const sender = pc.getSenders().find(s=> s.track && s.track.kind==='video');
          if(sender) sender.replaceTrack(screenTrack);
          else pc.addTrack(screenTrack, display);
        });
        // show screen in local preview
        if(localVideoRef.current) localVideoRef.current.srcObject = display;
        screenTrack.onended = ()=> toggleScreenShare();
      }catch(e){
        alert('Не удалось включить демонстрацию: '+e.message);
      }
    }
  }

  // messaging
  useEffect(()=>{
    if(!activeConvo || !token) return;
    fetch(`${API}/api/messages/${activeConvo.id}`, {headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{
      if(d.messages) setMessages(prev=> ({...prev, [activeConvo.id]: d.messages}));
    });
  }, [activeConvo?.id]);

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:'smooth'});
  }, [messages, activeConvo]);

  function sendMessage(){
    if(!input.trim() || !activeConvo || !socket) return;
    socket.emit('message:send', {convoId: activeConvo.id, text: input});
    setInput('');
    socket.emit('typing:stop', {convoId: activeConvo.id});
  }
  function handleTyping(e){
    setInput(e.target.value);
    if(!socket || !activeConvo) return;
    socket.emit('typing:start', {convoId: activeConvo.id});
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(()=> socket.emit('typing:stop', {convoId: activeConvo.id}), 1500);
  }

  // search users
  async function searchUsers(q){
    if(!q || q.length<1){ setAllUsers([]); return; }
    const res = await fetch(`${API}/api/users/search?q=${encodeURIComponent(q)}`, {headers:{Authorization:`Bearer ${token}`}});
    const data = await res.json();
    if(data.users) setAllUsers(data.users);
  }

  const conversations = useMemo(()=>{
    const list = [];
    // DMs from friends + any DM with messages
    const dmIds = new Set();
    Object.keys(messages).forEach(cid=>{
      if(cid.includes('_')) dmIds.add(cid);
    });
    friends.forEach(f=>{
      const cid = [user.id, f.id].sort().join('_');
      dmIds.add(cid);
    });
    dmIds.forEach(cid=>{
      const parts = cid.split('_');
      const otherId = parts.find(id=> id!==user.id);
      const friend = friends.find(f=> f.id===otherId) || allUsers.find(u=> u.id===otherId);
      const msgs = messages[cid]||[];
      const last = msgs[msgs.length-1];
      list.push({id: cid, type:'dm', user: friend || {id:otherId, username:'Неизвестный', avatar:''}, lastMessage: last, unread:0});
    });
    // groups
    groups.forEach(g=>{
      const msgs = messages[g.id]||[];
      const last = msgs[msgs.length-1];
      list.push({id: g.id, type:'group', group:g, lastMessage:last});
    });
    // sort by last message time
    list.sort((a,b)=> (b.lastMessage?.at||0) - (a.lastMessage?.at||0));
    return list;
  }, [friends, groups, messages, allUsers, user?.id]);

  const filteredConvos = useMemo(()=>{
    if(tab==='friends') return [];
    if(tab==='groups') return conversations.filter(c=> c.type==='group');
    return conversations;
  }, [conversations, tab]);

  if(!user){
    return <Auth onAuth={handleAuth} />;
  }

  return (
    <div className="h-[100dvh] w-screen bg-[#0f0f12] text-[#e6e6eb] flex overflow-hidden relative">
      {/* Sidebar */}
      <div className={`w-[340px] shrink-0 bg-[#15151a] border-r border-[#23232a] flex flex-col z-20 transition-transform duration-300 lg:translate-x-0 ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} absolute lg:relative h-full`}>
        {/* Profile header */}
        <div className="p-4 flex items-center gap-3 border-b border-[#23232a]">
          <img src={user.avatar} className="w-10 h-10 rounded-full object-cover bg-[#232329]" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] truncate">{user.username}</div>
            <div className="text-[12px] text-[#00d084] flex items-center gap-1"><span className="w-2 h-2 bg-[#00d084] rounded-full inline-block"></span> в сети • Cbopka</div>
          </div>
          <button onClick={()=>setShowProfile(true)} className="w-8 h-8 rounded-full bg-[#232329] flex items-center justify-center hover:bg-[#2a2a33]">⚙️</button>
          <button onClick={()=>setShowSidebar(false)} className="lg:hidden w-8 h-8 rounded-full bg-[#232329] flex items-center justify-center">✕</button>
        </div>

        {/* Tabs */}
        <div className="p-3 flex gap-2">
          <button onClick={()=>setTab('chats')} className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition ${tab==='chats'?'bg-white text-black':'bg-[#1e1e24] text-[#9a9aa3] hover:bg-[#232329]'}`}>Чаты</button>
          <button onClick={()=>setTab('friends')} className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition ${tab==='friends'?'bg-white text-black':'bg-[#1e1e24] text-[#9a9aa3] hover:bg-[#232329]'}`}>Друзья</button>
          <button onClick={()=>setTab('groups')} className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition ${tab==='groups'?'bg-white text-black':'bg-[#1e1e24] text-[#9a9aa3] hover:bg-[#232329]'}`}>Группы</button>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 flex gap-2">
          <button onClick={()=>setShowAddFriend(true)} className="flex-1 bg-[#7c5cff] hover:bg-[#6b4df0] text-white rounded-xl py-2.5 text-[13px] font-semibold flex items-center justify-center gap-1.5"><span>＋</span> Друга</button>
          <button onClick={()=>setShowCreateGroup(true)} className="flex-1 bg-[#232329] hover:bg-[#2a2a33] border border-[#2a2a33] rounded-xl py-2.5 text-[13px] font-semibold">＋ Группу</button>
        </div>

        {/* Search */}
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

        {/* Lists */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
          {tab==='friends' ? (
            <>
              {incomingReq.length>0 && (
                <div>
                  <div className="text-[11px] font-bold text-[#9a9aa3] uppercase tracking-wider px-2 py-2">Заявки • {incomingReq.length}</div>
                  {incomingReq.map(r=>(
                    <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1e1e24] border border-[#2a2a33] mb-2">
                      <img src={r.fromUser.avatar} className="w-9 h-9 rounded-full" />
                      <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold">{r.fromUser.username}</div><div className="text-[11px] text-[#9a9aa3]">хочет дружить</div></div>
                      <button onClick={()=>socket.emit('friends:accept',{requestId:r.id})} className="w-7 h-7 rounded-full bg-[#00d084] text-black font-bold">✓</button>
                      <button onClick={()=>socket.emit('friends:reject',{requestId:r.id})} className="w-7 h-7 rounded-full bg-[#2a2a33]">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div className="text-[11px] font-bold text-[#9a9aa3] uppercase tracking-wider px-2 py-2">Друзья • {friends.length}</div>
                {friends.map(f=>(
                  <div key={f.id} className={`group flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#1e1e24] cursor-pointer transition ${activeConvo?.id=== [user.id,f.id].sort().join('_') ? 'bg-[#232329] border border-[#2a2a33]' : ''}`} onClick={()=>{
                    const cid = [user.id, f.id].sort().join('_');
                    setActiveConvo({id:cid, type:'dm', user:f});
                    setShowSidebar(false);
                  }}>
                    <div className="relative"><img src={f.avatar} className="w-10 h-10 rounded-full object-cover" /><span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#15151a] ${onlineMap[f.id] ? 'bg-[#00d084]' : 'bg-[#5a5a66]'}`}></span></div>
                    <div className="flex-1 min-w-0"><div className="text-[14px] font-medium truncate flex items-center gap-1.5">{f.username} {onlineMap[f.id] && <span className="w-1.5 h-1.5 bg-[#00d084] rounded-full"></span>}</div><div className="text-[12px] text-[#9a9aa3] truncate">{onlineMap[f.id] ? 'в сети' : 'не в сети'}</div></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={(e)=>{ e.stopPropagation(); startCall(f.id,'audio'); }} className="w-8 h-8 rounded-full bg-[#232329] hover:bg-[#2a2a33] flex items-center justify-center">📞</button>
                      <button onClick={(e)=>{ e.stopPropagation(); startCall(f.id,'video'); }} className="w-8 h-8 rounded-full bg-[#232329] hover:bg-[#2a2a33] flex items-center justify-center">🎥</button>
                    </div>
                  </div>
                ))}
                {friends.length===0 && <div className="text-center py-10 text-[#5a5a66] text-[13px]">Пока нет друзей.<br/>Добавь по нику выше.</div>}
              </div>
            </>
          ) : (
            <>
              {tab!=='groups' && friends.length>0 && (
                <div>
                  <div className="text-[11px] font-bold text-[#9a9aa3] uppercase tracking-wider px-2 py-1">Быстрый доступ</div>
                  <div className="flex gap-2 overflow-x-auto py-2 px-1">
                    {friends.slice(0,8).map(f=>(
                      <button key={f.id} onClick={()=>{
                        const cid = [user.id, f.id].sort().join('_');
                        setActiveConvo({id:cid, type:'dm', user:f});
                        setShowSidebar(false);
                      }} className="flex flex-col items-center gap-1.5 min-w-[56px]">
                        <div className="relative"><img src={f.avatar} className="w-12 h-12 rounded-full border-2 border-[#23232a]" /><span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#15151a] ${onlineMap[f.id]?'bg-[#00d084]':'bg-[#5a5a66]'}`}></span></div>
                        <span className="text-[11px] truncate max-w-[56px]">{f.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] font-bold text-[#9a9aa3] uppercase tracking-wider px-2 py-2 flex items-center justify-between"><span>{tab==='groups'?'Группы':'Чаты'} • {filteredConvos.length}</span></div>
                {filteredConvos.map(c=>(
                  <div key={c.id} onClick={()=>{ setActiveConvo(c); setShowSidebar(false); }} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition border ${activeConvo?.id===c.id ? 'bg-[#232329] border-[#3a3a44] shadow' : 'border-transparent hover:bg-[#1e1e24] hover:border-[#23232a]'}`}>
                    {c.type==='dm' ? (
                      <>
                        <div className="relative"><img src={c.user.avatar} className="w-11 h-11 rounded-full object-cover" /><span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#15151a] ${onlineMap[c.user.id]?'bg-[#00d084]':'bg-[#5a5a66]'}`}></span></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between"><span className="font-medium text-[14px] truncate">{c.user.username}</span><span className="text-[11px] text-[#5a5a66]">{c.lastMessage ? new Date(c.lastMessage.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span></div>
                          <div className="text-[12px] text-[#9a9aa3] truncate">{typingMap[c.id] ? <span className="text-[#7c5cff]">печатает...</span> : c.lastMessage ? `${c.lastMessage.from===user.id?'Вы: ':''}${c.lastMessage.text}` : 'Нет сообщений'}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <img src={c.group.avatar} className="w-11 h-11 rounded-xl object-cover bg-[#232329]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between"><span className="font-medium text-[14px] truncate">#{c.group.name}</span><span className="text-[11px] text-[#5a5a66]">{c.group.members.length} чел</span></div>
                          <div className="text-[12px] text-[#9a9aa3] truncate">{typingMap[c.id] ? 'печатает...' : c.lastMessage ? c.lastMessage.text : c.group.description || 'Групповой чат'}</div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {filteredConvos.length===0 && <div className="text-center py-12 text-[#5a5a66] text-[13px]">Нет чатов.<br/>Начни с добавления друга.</div>}
              </div>

              {tab==='chats' && groups.length>0 && (
                <div>
                  <div className="text-[11px] font-bold text-[#9a9aa3] uppercase tracking-wider px-2 py-2">Твои группы</div>
                  {groups.map(g=>(
                    <div key={g.id} onClick={()=>{ setActiveConvo({id:g.id, type:'group', group:g}); setShowSidebar(false); }} className={`flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#1e1e24] cursor-pointer ${activeConvo?.id===g.id?'bg-[#232329] border border-[#2a2a33]':''}`}>
                      <img src={g.avatar} className="w-9 h-9 rounded-xl" />
                      <div className="flex-1 min-w-0"><div className="text-[13px] font-medium truncate">{g.name}</div><div className="text-[11px] text-[#9a9aa3]">{g.members.length} участников</div></div>
                      <button onClick={(e)=>{ e.stopPropagation(); startCall(null,'video', g.id); }} className="w-8 h-8 rounded-full bg-[#232329] flex items-center justify-center">🎥</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 border-t border-[#23232a] flex items-center gap-2 text-[11px] text-[#5a5a66]">
          <span className="w-2 h-2 bg-[#00d084] rounded-full animate-pulse"></span> Cbopka работает • P2P звонки • 1080p экран
          <button onClick={logout} className="ml-auto text-[11px] text-[#9a9aa3] hover:text-white">Выйти</button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f12] relative">
        {/* Chat header */}
        {activeConvo ? (
          <div className="h-[64px] shrink-0 bg-[#15151a]/80 backdrop-blur-xl border-b border-[#23232a] flex items-center gap-3 px-4">
            <button onClick={()=>setShowSidebar(true)} className="lg:hidden w-9 h-9 rounded-full bg-[#232329] flex items-center justify-center">☰</button>
            {activeConvo.type==='dm' ? (
              <>
                <img src={activeConvo.user.avatar} className="w-9 h-9 rounded-full" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] truncate flex items-center gap-2">{activeConvo.user.username} {onlineMap[activeConvo.user.id] && <span className="text-[11px] bg-[#00d084]/20 text-[#00d084] px-2 py-0.5 rounded-full">online</span>}</div>
                  <div className="text-[12px] text-[#9a9aa3] truncate">{onlineMap[activeConvo.user.id] ? 'в сети' : activeConvo.user.bio || 'оффлайн'}</div>
                </div>
              </>
            ) : (
              <>
                <img src={activeConvo.group.avatar} className="w-9 h-9 rounded-xl" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] truncate">{activeConvo.group.name}</div>
                  <div className="text-[12px] text-[#9a9aa3] truncate">{activeConvo.group.members.length} участников • {activeConvo.group.description}</div>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <button onClick={()=> activeConvo.type==='dm' ? startCall(activeConvo.user.id,'audio') : startCall(null,'audio', activeConvo.id)} className="w-9 h-9 rounded-full bg-[#232329] hover:bg-[#2a2a33] flex items-center justify-center">📞</button>
              <button onClick={()=> activeConvo.type==='dm' ? startCall(activeConvo.user.id,'video') : startCall(null,'video', activeConvo.id)} className="w-9 h-9 rounded-full bg-[#7c5cff] hover:bg-[#6b4df0] flex items-center justify-center shadow-[0_0_15px_rgba(124,92,255,0.3)]">🎥</button>
              <button onClick={()=>setShowRight(!showRight)} className="w-9 h-9 rounded-full bg-[#232329] hover:bg-[#2a2a33] flex items-center justify-center">ℹ️</button>
            </div>
          </div>
        ) : (
          <div className="h-[64px] shrink-0 bg-[#15151a]/80 backdrop-blur-xl border-b border-[#23232a] flex items-center px-4 gap-3">
            <button onClick={()=>setShowSidebar(true)} className="lg:hidden w-9 h-9 rounded-full bg-[#232329] flex items-center justify-center">☰</button>
            <div className="font-semibold">Выбери чат</div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(ellipse_at_top,_rgba(124,92,255,0.08),_transparent_60%)]">
          {!activeConvo ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-[24px] bg-[#1a1a1f] border border-[#2a2a33] flex items-center justify-center text-3xl mb-4">💬</div>
              <h2 className="text-[20px] font-bold">Добро пожаловать в Cbopka</h2>
              <p className="text-[#9a9aa3] text-[14px] mt-2 max-w-[320px]">Переписывайся, создавай группы, звони с видео и делись экраном в 1080p. Всё работает прямо в браузере на ПК и телефоне.</p>
              <div className="grid grid-cols-3 gap-3 mt-6 w-full max-w-[360px]">
                <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4"><div className="text-[20px]">👥</div><div className="text-[12px] font-semibold mt-2">Друзья</div><div className="text-[11px] text-[#9a9aa3]">Добавляй по нику</div></div>
                <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4"><div className="text-[20px]">🎥</div><div className="text-[12px] font-semibold mt-2">Звонки</div><div className="text-[11px] text-[#9a9aa3]">Видео и голос</div></div>
                <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4"><div className="text-[20px]">🖥️</div><div className="text-[12px] font-semibold mt-2">Экран 1080p</div><div className="text-[11px] text-[#9a9aa3]">Демо в звонке</div></div>
              </div>
              <button onClick={()=>setShowAddFriend(true)} className="mt-6 bg-white text-black font-semibold px-6 py-3 rounded-full text-[14px]">Найти друзей</button>
            </div>
          ) : (
            <>
              {(messages[activeConvo.id]||[]).map(m=>{
                const isMe = m.from===user.id;
                const fromUser = activeConvo.type==='group' ? (activeConvo.group.members.find(x=>x.id===m.from) || {username:'?', avatar:''}) : activeConvo.user;
                return (
                  <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && activeConvo.type==='group' && <img src={fromUser.avatar} className="w-7 h-7 rounded-full mt-1" />}
                    <div className={`max-w-[75%] rounded-[18px] px-4 py-2.5 text-[14px] leading-[1.4] shadow-sm ${isMe ? 'bg-[#7c5cff] text-white rounded-br-[6px]' : 'bg-[#1e1e24] border border-[#2a2a33] text-[#e6e6eb] rounded-bl-[6px]'}`}>
                      {activeConvo.type==='group' && !isMe && <div className="text-[11px] font-bold opacity-80 mb-0.5">{fromUser.username}</div>}
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                      <div className={`text-[10px] mt-1 mono ${isMe ? 'text-white/70' : 'text-[#9a9aa3]'}`}>{new Date(m.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    </div>
                  </div>
                );
              })}
              {typingMap[activeConvo.id] && (
                <div className="flex gap-2 items-center">
                  <div className="bg-[#1e1e24] border border-[#2a2a33] rounded-full px-4 py-2 text-[12px] text-[#9a9aa3] flex items-center gap-2">
                    <span className="flex gap-1"><span className="w-1 h-1 bg-[#9a9aa3] rounded-full animate-bounce"></span><span className="w-1 h-1 bg-[#9a9aa3] rounded-full animate-bounce [animation-delay:0.1s]"></span><span className="w-1 h-1 bg-[#9a9aa3] rounded-full animate-bounce [animation-delay:0.2s]"></span></span>
                    печатает...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        {activeConvo && (
          <div className="p-3 bg-[#15151a] border-t border-[#23232a] shrink-0">
            <div className="flex items-end gap-2 max-w-[900px] mx-auto w-full">
              <div className="flex-1 bg-[#1e1e24] border border-[#2a2a33] rounded-[20px] flex items-end gap-2 px-3 py-2 focus-within:border-[#7c5cff] transition">
                <textarea value={input} onChange={handleTyping} onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } }} placeholder="Сообщение..." rows={1} className="flex-1 bg-transparent outline-none text-[14px] py-2.5 resize-none max-h-[120px] placeholder:text-[#5a5a66]" />
                <button onClick={sendMessage} className="w-9 h-9 rounded-full bg-[#7c5cff] hover:bg-[#6b4df0] flex items-center justify-center shrink-0 mb-0.5">➤</button>
              </div>
            </div>
            <div className="text-center text-[10px] text-[#5a5a66] mt-2">Enter — отправить, Shift+Enter — новая строка • Шифрование P2P в звонках</div>
          </div>
        )}
      </div>

      {/* Right panel */}
      {activeConvo && showRight && (
        <div className="w-[300px] shrink-0 bg-[#15151a] border-l border-[#23232a] flex flex-col absolute lg:relative right-0 top-0 h-full z-10">
          <div className="p-4 border-b border-[#23232a] flex items-center justify-between">
            <div className="font-semibold text-[14px]">Инфо</div>
            <button onClick={()=>setShowRight(false)} className="w-8 h-8 rounded-full bg-[#232329]">✕</button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {activeConvo.type==='dm' ? (
              <div className="text-center">
                <img src={activeConvo.user.avatar} className="w-24 h-24 rounded-full mx-auto" />
                <div className="font-bold text-[18px] mt-3">{activeConvo.user.username}</div>
                <div className="text-[13px] text-[#9a9aa3] mt-1">{activeConvo.user.bio}</div>
                <div className="flex gap-2 mt-5">
                  <button onClick={()=>startCall(activeConvo.user.id,'audio')} className="flex-1 bg-[#232329] hover:bg-[#2a2a33] py-2.5 rounded-xl text-[13px] font-semibold">📞 Звонок</button>
                  <button onClick={()=>startCall(activeConvo.user.id,'video')} className="flex-1 bg-[#7c5cff] hover:bg-[#6b4df0] py-2.5 rounded-xl text-[13px] font-semibold text-white">🎥 Видео</button>
                </div>
                <div className="mt-6 text-left bg-[#1e1e24] border border-[#2a2a33] rounded-xl p-3">
                  <div className="text-[11px] font-bold text-[#9a9aa3] uppercase tracking-wider">Профиль</div>
                  <div className="mt-2 space-y-2 text-[13px]">
                    <div className="flex justify-between"><span className="text-[#9a9aa3]">Статус</span><span className={onlineMap[activeConvo.user.id] ? 'text-[#00d084]' : 'text-[#5a5a66]'}>{onlineMap[activeConvo.user.id]?'online':'offline'}</span></div>
                    <div className="flex justify-between"><span className="text-[#9a9aa3]">ID</span><span className="mono text-[11px]">{activeConvo.user.id.slice(0,8)}</span></div>
                  </div>
                </div>
                <button onClick={()=>{ if(confirm('Удалить из друзей?')) socket.emit('friends:remove',{friendId:activeConvo.user.id}); }} className="mt-4 w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-2.5 rounded-xl text-[13px] font-semibold">Удалить из друзей</button>
              </div>
            ) : (
              <div>
                <div className="text-center">
                  <img src={activeConvo.group.avatar} className="w-20 h-20 rounded-2xl mx-auto" />
                  <div className="font-bold text-[18px] mt-3">{activeConvo.group.name}</div>
                  <div className="text-[13px] text-[#9a9aa3] mt-1">{activeConvo.group.description || 'Групповой чат'}</div>
                  <button onClick={()=>startCall(null,'video', activeConvo.group.id)} className="mt-4 w-full bg-[#7c5cff] py-2.5 rounded-xl font-semibold text-white">🎥 Начать групповой звонок</button>
                </div>
                <div className="mt-6">
                  <div className="text-[11px] font-bold text-[#9a9aa3] uppercase tracking-wider mb-2">Участники • {activeConvo.group.members.length}</div>
                  <div className="space-y-2">
                    {activeConvo.group.members.map(m=>(
                      <div key={m.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-[#1e1e24]">
                        <img src={m.avatar} className="w-8 h-8 rounded-full" />
                        <div className="flex-1 min-w-0"><div className="text-[13px] font-medium truncate">{m.username} {activeConvo.group.admins?.includes(m.id) && <span className="text-[10px] bg-[#7c5cff] px-1.5 py-0.5 rounded-full ml-1">admin</span>}</div><div className="text-[11px] text-[#9a9aa3]">{onlineMap[m.id]?'в сети':'оффлайн'}</div></div>
                        {m.id!==user.id && <button onClick={()=>{ const cid=[user.id,m.id].sort().join('_'); setActiveConvo({id:cid, type:'dm', user:m}); }} className="text-[11px] bg-[#232329] px-2 py-1 rounded-full">Чат</button>}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={()=>{ if(confirm('Выйти из группы?')) socket.emit('group:leave',{groupId:activeConvo.group.id}); }} className="mt-6 w-full bg-[#232329] hover:bg-[#2a2a33] py-2.5 rounded-xl text-[13px]">Выйти из группы</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Call overlay */}
      {call && (
        <div className="absolute inset-0 z-50 bg-[#050507] flex flex-col">
          {/* header */}
          <div className="h-[56px] flex items-center justify-between px-4 border-b border-[#1e1e24] bg-[#0f0f12]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-semibold text-[14px]">{call.isIncoming ? 'Входящий звонок' : call.isInviting ? 'Вызов...' : 'Звонок'} • {call.type==='video' ? 'Видео' : 'Голос'} {call.groupId ? `• группа ${call.group?.name || ''}` : ''} {isScreenSharing && '• экран 1080p'}</span>
            </div>
            <div className="text-[12px] text-[#9a9aa3] mono">{call.callId ? call.callId.slice(0,8) : 'подключение...'}</div>
          </div>

          {/* videos grid */}
          <div className="flex-1 overflow-auto p-3 grid gap-3 auto-rows-fr content-start" style={{gridTemplateColumns: `repeat(auto-fit, minmax(${Object.keys(callParticipants).length>1 ? '320px' : '400px'}, 1fr))`}}>
            {/* local */}
            <div className="relative bg-[#15151a] border border-[#23232a] rounded-[20px] overflow-hidden aspect-video min-h-[220px] flex items-center justify-center">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!localStream && <div className="absolute inset-0 flex items-center justify-center text-[#5a5a66]">Включаем камеру...</div>}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-2"><img src={user.avatar} className="w-5 h-5 rounded-full" /> Вы {isMuted && '🔇'} {isCamOff && '🚫🎥'} {isScreenSharing && '🖥️ 1080p'}</div>
              {isScreenSharing && <div className="absolute top-3 left-3 bg-[#7c5cff] text-white text-[11px] font-bold px-2.5 py-1 rounded-full">Экран 1080p</div>}
            </div>
            {Object.entries(callParticipants).map(([pid, data])=>(
              <div key={pid} className="relative bg-[#15151a] border border-[#23232a] rounded-[20px] overflow-hidden aspect-video min-h-[220px] flex items-center justify-center">
                {data.stream ? (
                  <video autoPlay playsInline ref={el=>{ if(el && data.stream) el.srcObject = data.stream; }} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <img src={data.user?.avatar} className="w-16 h-16 rounded-full" />
                    <div className="text-[13px] text-[#9a9aa3]">Подключается...</div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-2">
                  <img src={data.user?.avatar} className="w-5 h-5 rounded-full" />
                  {data.user?.username || pid.slice(0,6)}
                </div>
              </div>
            ))}
            {Object.keys(callParticipants).length===0 && !call.groupId && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 rounded-full bg-[#1a1a1f] border border-[#2a2a33] flex items-center justify-center text-3xl mb-4 animate-pulse">📞</div>
                <div className="font-semibold">{call.isIncoming ? `${call.from?.username} звонит...` : 'Дозваниваемся...'}</div>
                <div className="text-[13px] text-[#9a9aa3] mt-1">Звонок P2P • защищено</div>
              </div>
            )}
          </div>

          {/* controls */}
          <div className="h-[96px] shrink-0 bg-[#0f0f12] border-t border-[#1e1e24] flex items-center justify-center gap-3 px-4">
            {call.isIncoming ? (
              <>
                <button onClick={acceptCall} className="bg-[#00d084] hover:bg-[#00b86f] text-black font-bold px-8 py-3.5 rounded-full text-[14px] flex items-center gap-2 shadow-[0_0_20px_rgba(0,208,132,0.3)]">✓ Принять</button>
                <button onClick={()=>{ socket.emit('call:reject',{callId:call.callId}); endCall(false); }} className="bg-[#232329] hover:bg-[#2a2a33] px-8 py-3.5 rounded-full text-[14px] font-semibold">✕ Отклонить</button>
              </>
            ) : (
              <>
                <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center text-[18px] border transition ${isMuted ? 'bg-red-500 border-red-500 text-white' : 'bg-[#1e1e24] border-[#2a2a33] hover:bg-[#232329]'}`}>{isMuted ? '🔇' : '🎙️'}</button>
                <button onClick={toggleCam} className={`w-12 h-12 rounded-full flex items-center justify-center text-[18px] border transition ${isCamOff ? 'bg-red-500 border-red-500 text-white' : 'bg-[#1e1e24] border-[#2a2a33] hover:bg-[#232329]'}`}>{isCamOff ? '🚫' : '🎥'}</button>
                <button onClick={toggleScreenShare} className={`px-5 h-12 rounded-full flex items-center justify-center gap-2 text-[13px] font-semibold border transition ${isScreenSharing ? 'bg-[#7c5cff] border-[#7c5cff] text-white shadow-[0_0_20px_rgba(124,92,255,0.4)]' : 'bg-[#1e1e24] border-[#2a2a33] hover:bg-[#232329]'}`}>🖥️ {isScreenSharing ? 'Стоп 1080p' : 'Экран 1080p'}</button>
                <button onClick={()=>endCall(true)} className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-[18px] shadow-[0_0_20px_rgba(239,68,68,0.3)]">📞</button>
              </>
            )}
          </div>

          <div className="absolute top-[64px] left-1/2 -translate-x-1/2 bg-[#1e1e24] border border-[#2a2a33] rounded-full px-4 py-1.5 text-[11px] text-[#9a9aa3] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#00d084] rounded-full animate-pulse"></span> WebRTC P2P • Шифрование • {isScreenSharing ? 'Экран 1920×1080 30fps' : 'Демо экрана доступно'}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddFriend && (
        <Modal title="Добавить друга" onClose={()=>setShowAddFriend(false)}>
          <div className="space-y-4">
            <p className="text-[13px] text-[#9a9aa3]">Введи никнейм друга. Он получит заявку.</p>
            <AddFriendForm socket={socket} onDone={()=>setShowAddFriend(false)} />
            <div className="bg-[#1e1e24] border border-[#2a2a33] rounded-xl p-3">
              <div className="text-[12px] font-bold text-[#9a9aa3] uppercase tracking-wider">Как найти?</div>
              <div className="text-[12px] text-[#5a5a66] mt-1">Попроси друга зарегистрироваться и сказать свой ник. Поиск работает выше в сайдбаре тоже.</div>
            </div>
          </div>
        </Modal>
      )}
      {showCreateGroup && (
        <Modal title="Создать группу" onClose={()=>setShowCreateGroup(false)}>
          <CreateGroupForm friends={friends} socket={socket} onDone={()=>setShowCreateGroup(false)} />
        </Modal>
      )}
      {showProfile && (
        <Modal title="Твой профиль" onClose={()=>setShowProfile(false)}>
          <ProfileForm user={user} socket={socket} token={token} onUpdate={u=>{ setUser(u); localStorage.setItem('cb_user', JSON.stringify(u)); }} />
        </Modal>
      )}

      {/* mobile bottom nav */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-[#15151a]/90 backdrop-blur-xl border-t border-[#23232a] flex justify-around py-2 z-20">
        <button onClick={()=>{ setTab('chats'); setShowSidebar(true); }} className="flex flex-col items-center gap-1 px-4 py-1"><span>💬</span><span className="text-[10px]">Чаты</span></button>
        <button onClick={()=>{ setTab('friends'); setShowSidebar(true); }} className="flex flex-col items-center gap-1 px-4 py-1"><span>👥</span><span className="text-[10px]">Друзья {incomingReq.length>0 && <span className="bg-red-500 text-white text-[9px] px-1 rounded-full">{incomingReq.length}</span>}</span></button>
        <button onClick={()=>{ setTab('groups'); setShowSidebar(true); }} className="flex flex-col items-center gap-1 px-4 py-1"><span>#️⃣</span><span className="text-[10px]">Группы</span></button>
        <button onClick={()=>setShowProfile(true)} className="flex flex-col items-center gap-1 px-4 py-1"><img src={user.avatar} className="w-5 h-5 rounded-full" /><span className="text-[10px]">Профиль</span></button>
      </div>
    </div>
  );
}

function Modal({title, children, onClose}){
  return (
    <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-[#1a1a1f] border border-[#2a2a33] rounded-[24px] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a33]">
          <div className="font-bold text-[16px]">{title}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#232329] flex items-center justify-center">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function AddFriendForm({socket, onDone}){
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  return (
    <div className="space-y-3">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Никнейм, например alex" className="w-full bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#7c5cff]" />
      <button onClick={()=>{
        if(!q.trim()) return;
        socket.emit('friends:request', {toUsername: q.trim()});
        setStatus('Заявка отправлена!');
        setTimeout(onDone, 800);
      }} className="w-full bg-[#7c5cff] hover:bg-[#6b4df0] text-white font-semibold py-3 rounded-xl text-[14px]">Отправить заявку</button>
      {status && <div className="text-[12px] text-[#00d084] text-center">{status}</div>}
    </div>
  );
}

function CreateGroupForm({friends, socket, onDone}){
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selected, setSelected] = useState([]);
  return (
    <div className="space-y-4">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название группы, например Игровая" className="w-full bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#7c5cff]" />
      <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Описание (необязательно)" className="w-full bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#7c5cff]" />
      <div>
        <div className="text-[12px] font-bold text-[#9a9aa3] uppercase tracking-wider mb-2">Добавить друзей</div>
        <div className="max-h-[160px] overflow-y-auto space-y-1 bg-[#15151a] border border-[#2a2a33] rounded-xl p-2">
          {friends.map(f=>(
            <label key={f.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#232329] cursor-pointer">
              <input type="checkbox" checked={selected.includes(f.id)} onChange={e=> setSelected(s=> e.target.checked ? [...s, f.id] : s.filter(id=>id!==f.id))} className="accent-[#7c5cff]" />
              <img src={f.avatar} className="w-7 h-7 rounded-full" />
              <span className="text-[13px]">{f.username}</span>
            </label>
          ))}
          {friends.length===0 && <div className="text-[12px] text-[#5a5a66] p-2">Сначала добавь друзей</div>}
        </div>
      </div>
      <button disabled={!name.trim()} onClick={()=>{
        socket.emit('group:create', {name, description:desc, memberIds:selected});
        onDone();
      }} className="w-full bg-white text-black font-semibold py-3 rounded-xl text-[14px] disabled:opacity-50">Создать группу</button>
    </div>
  );
}

function ProfileForm({user, socket, token, onUpdate}){
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState(user.avatar);
  const [saving, setSaving] = useState(false);

  async function handleAvatar(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=> setAvatar(reader.result);
    reader.readAsDataURL(file);
  }

  function save(){
    setSaving(true);
    socket.emit('user:update', {username, bio, avatar});
    setTimeout(()=>{
      const updated = {...user, username, bio, avatar};
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
        <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} className="w-full mt-1 bg-[#232329] border border-[#2a2a33] rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#7c5cff] resize-none" />
      </div>
      <div className="bg-[#15151a] border border-[#2a2a33] rounded-xl p-3 text-[11px] text-[#9a9aa3]">
        <div>ID: <span className="mono text-white">{user.id}</span></div>
        <div>Аккаунт создан: {new Date(user.createdAt).toLocaleDateString()}</div>
      </div>
      <button onClick={save} disabled={saving} className="w-full bg-[#7c5cff] hover:bg-[#6b4df0] text-white font-semibold py-3 rounded-xl text-[14px]">{saving?'Сохранение...':'Сохранить профиль'}</button>
    </div>
  );
}
