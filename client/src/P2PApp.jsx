import { useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';

function genId(){
  return 'cb-' + Math.random().toString(36).slice(2,7) + '-' + Math.random().toString(36).slice(2,5);
}

export default function P2PApp({onBack, initialInvite}){
  const [myId, setMyId] = useState('');
  const [peer, setPeer] = useState(null);
  const [status, setStatus] = useState('init'); // init, ready, connecting, connected
  const [remoteIdInput, setRemoteIdInput] = useState(()=> initialInvite || '');
  const [remoteId, setRemoteId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conn, setConn] = useState(null);
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreen, setIsScreen] = useState(false);
  const [username, setUsername] = useState(()=> localStorage.getItem('cb_p2p_name') || 'User-'+Math.floor(Math.random()*1000));

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const screenTrackRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  // init peer
  useEffect(()=>{
    const id = genId();
    setMyId(id);
    const p = new Peer(id, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ]
      }
    });
    p.on('open', (id)=>{
      console.log('peer open', id);
      setStatus('ready');
    });
    p.on('connection', (c)=>{
      console.log('incoming connection', c.peer);
      handleDataConnection(c);
    });
    p.on('call', async (mediaConn)=>{
      console.log('incoming call', mediaConn.peer);
      // ask user
      const accept = confirm(`Входящий звонок от ${mediaConn.peer}. Принять?`);
      if(!accept){
        mediaConn.close();
        return;
      }
      try{
        const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        setLocalStream(stream);
        mediaConn.answer(stream);
        setCall(mediaConn);
        mediaConn.on('stream', (rs)=>{
          setRemoteStream(rs);
        });
        mediaConn.on('close', ()=>{
          setCall(null);
          setRemoteStream(null);
          setIsScreen(false);
        });
      }catch(e){
        alert('Нет доступа к камере/микрофону: '+e.message);
      }
    });
    p.on('error', (err)=>{
      console.error('peer error', err);
      if(err.type==='peer-unavailable'){
        alert('Пир не найден: '+remoteIdInput);
        setStatus('ready');
      }
    });
    setPeer(p);
    return ()=>{
      p.destroy();
    };
  }, []);

  // auto-connect if invite link
  useEffect(()=>{
    if(peer && status==='ready' && remoteIdInput && initialInvite){
      // small delay
      setTimeout(()=> connectTo(), 800);
    }
  }, [peer, status]);

  useEffect(()=>{
    if(localStream && localVideoRef.current){
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(()=>{
    if(remoteStream && remoteVideoRef.current){
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:'smooth'});
  }, [messages]);

  function handleDataConnection(c){
    setConn(c);
    setRemoteId(c.peer);
    setStatus('connected');
    c.on('open', ()=>{
      console.log('data open');
      setStatus('connected');
      setMessages(m=> [...m, {id: Date.now(), from:'system', text:`Соединен с ${c.peer}`}]);
    });
    c.on('data', (data)=>{
      if(data.type==='chat'){
        setMessages(m=> [...m, {id: Date.now()+Math.random(), from:'remote', text: data.text, at: Date.now()}]);
      }
      if(data.type==='name'){
        // could store remote name
      }
    });
    c.on('close', ()=>{
      setMessages(m=> [...m, {id: Date.now(), from:'system', text:'Соединение закрыто'}]);
      setStatus('ready');
      setConn(null);
      setRemoteId('');
    });
    c.on('error', (e)=>{
      console.error('conn error', e);
    });
  }

  function connectTo(){
    if(!peer || !remoteIdInput.trim()) return;
    setStatus('connecting');
    const c = peer.connect(remoteIdInput.trim());
    handleDataConnection(c);
  }

  function sendMsg(){
    if(!input.trim() || !conn) return;
    const msg = {id: Date.now(), from:'me', text: input.trim(), at: Date.now()};
    setMessages(m=> [...m, msg]);
    conn.send({type:'chat', text: input.trim()});
    setInput('');
  }

  async function startCall(video=true){
    if(!peer || !remoteId) return alert('Сначала подключись к другу');
    try{
      const stream = await navigator.mediaDevices.getUserMedia({video: video, audio:true});
      setLocalStream(stream);
      const mediaConn = peer.call(remoteId, stream);
      setCall(mediaConn);
      mediaConn.on('stream', (rs)=>{
        setRemoteStream(rs);
      });
      mediaConn.on('close', ()=>{
        setCall(null);
        setRemoteStream(null);
        setIsScreen(false);
      });
    }catch(e){
      alert('Ошибка камеры: '+e.message);
    }
  }

  function endCall(){
    call?.close();
    localStream?.getTracks().forEach(t=> t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCall(null);
    setIsScreen(false);
  }

  async function toggleScreen(){
    if(!call) return;
    if(isScreen){
      // stop screen, back to cam
      const camTrack = originalVideoTrackRef.current;
      if(camTrack){
        const sender = call.peerConnection.getSenders().find(s=> s.track && s.track.kind==='video');
        if(sender) await sender.replaceTrack(camTrack);
        if(localVideoRef.current) localVideoRef.current.srcObject = localStream;
      }
      screenTrackRef.current?.getTracks().forEach(t=> t.stop());
      setIsScreen(false);
    } else {
      try{
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {width:{ideal:1920}, height:{ideal:1080}, frameRate:{ideal:30}},
          audio: true
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        originalVideoTrackRef.current = localStream?.getVideoTracks()[0] || call.localStream?.getVideoTracks()[0];
        const sender = call.peerConnection.getSenders().find(s=> s.track && s.track.kind==='video');
        if(sender) await sender.replaceTrack(screenTrack);
        screenTrackRef.current = screenStream;
        if(localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        screenTrack.onended = ()=> toggleScreen();
        setIsScreen(true);
      }catch(e){
        alert('Не удалось захватить экран: '+e.message);
      }
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

  function copyId(){
    navigator.clipboard.writeText(myId);
    alert('ID скопирован: '+myId);
  }

  function shareLink(){
    const url = `${window.location.origin}${window.location.pathname}?p2p=${myId}`;
    navigator.clipboard.writeText(url);
    alert('Ссылка скопирована, скинь другу:\n'+url);
  }

  return (
    <div className="min-h-screen bg-[#0f0f12] text-white flex flex-col">
      {/* Header */}
      <div className="h-[56px] border-b border-[#232329] flex items-center px-4 justify-between bg-[#1a1a1f]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-[#232329] flex items-center justify-center">←</button>
          <div className="w-8 h-8 rounded-xl bg-[#7c5cff] flex items-center justify-center font-bold">P</div>
          <div>
            <div className="font-semibold text-[14px]">Cbopka P2P — без сервера</div>
            <div className="text-[11px] text-[#9a9aa3]">{status==='ready'?'Готов к подключению':status==='connected'?'Соединен с '+remoteId:status}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input value={username} onChange={e=>{setUsername(e.target.value); localStorage.setItem('cb_p2p_name', e.target.value);}} className="bg-[#232329] border border-[#2a2a33] rounded-full px-3 py-1.5 text-[12px] w-[120px]" placeholder="Твое имя" />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left - connection */}
        <div className="w-full md:w-[340px] border-b md:border-b-0 md:border-r border-[#232329] bg-[#15151a] p-4 flex flex-col gap-4 overflow-auto">
          <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4">
            <div className="text-[12px] text-[#9a9aa3] font-medium mb-2">ТВОЙ ID (скинь другу)</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#0f0f12] border border-[#2a2a33] rounded-xl px-3 py-2.5 font-mono text-[13px] break-all">{myId || 'генерация...'}</div>
              <button onClick={copyId} className="w-10 h-10 rounded-xl bg-[#7c5cff] flex items-center justify-center">📋</button>
            </div>
            <button onClick={shareLink} className="w-full mt-2 bg-[#232329] hover:bg-[#2a2a33] py-2.5 rounded-xl text-[12px]">🔗 Скопировать ссылку-приглашение</button>
            <div className="text-[10px] text-[#5a5a66] mt-2">Друг откроет ссылку и автоматически подключится к тебе. Работает через интернет, без твоего сервера.</div>
          </div>

          <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4">
            <div className="text-[12px] text-[#9a9aa3] font-medium mb-2">ПОДКЛЮЧИТЬСЯ К ДРУГУ</div>
            <div className="flex gap-2">
              <input value={remoteIdInput} onChange={e=>setRemoteIdInput(e.target.value)} placeholder="cb-xxxxx-xxx" className="flex-1 bg-[#0f0f12] border border-[#2a2a33] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#7c5cff]" />
              <button onClick={connectTo} disabled={status!=='ready' || !remoteIdInput.trim()} className="px-4 bg-white text-black font-semibold rounded-xl text-[13px] disabled:opacity-50">Подкл</button>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={()=>startCall(true)} disabled={!conn} className="flex-1 bg-[#7c5cff] disabled:opacity-40 py-2.5 rounded-xl text-[13px] font-semibold">🎥 Видео</button>
              <button onClick={()=>startCall(false)} disabled={!conn} className="flex-1 bg-[#232329] disabled:opacity-40 py-2.5 rounded-xl text-[13px]">📞 Аудио</button>
            </div>
          </div>

          <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-4">
            <div className="text-[12px] font-semibold mb-2">Как это работает без сервера?</div>
            <div className="text-[11px] text-[#9a9aa3] leading-[1.5]">
              • Используется публичный PeerJS сервер (0.peerjs.com) только для знакомства<br/>
              • После соединения — трафик идет напрямую P2P между вами<br/>
              • Чат через DataChannel, звонки через WebRTC<br/>
              • Никакого Render, никакого общего WiFi<br/>
              • Ссылку можно скинуть в любой мессенджер и сразу общаться
            </div>
          </div>

          <div className="bg-[#1a1a1f] border border-[#2a2a33] rounded-2xl p-3 text-[11px] text-[#9a9aa3]">
            <div>Статус: <span className="text-white">{status}</span></div>
            <div>Подключен к: <span className="text-white">{remoteId || '—'}</span></div>
            <div className="mt-2 text-[10px]">Если не коннектит — проверьте, что оба открыли страницу и скопировали правильный ID. Иногда помогает обновить страницу.</div>
          </div>
        </div>

        {/* Right - chat + call */}
        <div className="flex-1 flex flex-col bg-[#0f0f12] relative">
          {/* Call overlay */}
          {call && (
            <div className="absolute inset-0 z-20 bg-black flex flex-col">
              <div className="flex-1 relative">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-[#0a0a0f]" />
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-[120px] md:w-[180px] aspect-video object-cover rounded-2xl border-2 border-white/20 bg-[#1a1a1f]" />
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[12px]">🔴 {remoteId} {isScreen?'• Экран 1080p':''}</div>
              </div>
              <div className="h-[90px] bg-[#1a1a1f] border-t border-[#232329] flex items-center justify-center gap-3">
                <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center ${isMuted?'bg-red-500':'bg-[#2a2a33]'}`}>{isMuted?'🔇':'🎙️'}</button>
                <button onClick={toggleCam} className={`w-12 h-12 rounded-full flex items-center justify-center ${isCamOff?'bg-red-500':'bg-[#2a2a33]'}`}>{isCamOff?'🚫':'🎥'}</button>
                <button onClick={toggleScreen} className={`px-4 h-12 rounded-full flex items-center justify-center text-[12px] font-semibold ${isScreen?'bg-[#7c5cff]':'bg-[#2a2a33]'}`}>🖥️ 1080p</button>
                <button onClick={endCall} className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">✕</button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {messages.length===0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-[#7c5cff]/20 flex items-center justify-center text-2xl mb-4">⚡</div>
                <div className="font-semibold">P2P чат без сервера</div>
                <div className="text-[13px] text-[#9a9aa3] mt-2 max-w-[320px]">Скинь свой ID другу или введи его ID слева. После подключения можно чатиться и звонить напрямую, без общего WiFi и без деплоя.</div>
                <div className="mt-6 bg-[#1a1a1f] border border-[#2a2a33] rounded-xl p-3 text-[11px] text-left max-w-[320px]">
                  <div className="font-semibold text-white mb-1">Быстрый старт:</div>
                  1. Скопируй свой ID сверху<br/>
                  2. Скинь другу в ТГ/Вотсап<br/>
                  3. Друг вставляет ID и жмет Подкл<br/>
                  4. Готово — чат и звонки работают!
                </div>
              </div>
            )}
            {messages.map(m=>(
              <div key={m.id} className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-[13px] ${m.from==='me'?'ml-auto bg-[#7c5cff] text-white rounded-br-[4px]':m.from==='system'?'mx-auto bg-[#1a1a1f] border border-[#2a2a33] text-[#9a9aa3] text-[11px]':'mr-auto bg-[#1a1a1f] border border-[#232329] rounded-bl-[4px]'}`}>
                {m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#232329] bg-[#1a1a1f] flex gap-2">
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=> e.key==='Enter' && sendMsg()} placeholder={conn?'Сообщение...':'Сначала подключись к другу'} disabled={!conn} className="flex-1 bg-[#0f0f12] border border-[#2a2a33] rounded-full px-4 py-3 text-[14px] outline-none focus:border-[#7c5cff] disabled:opacity-50" />
            <button onClick={sendMsg} disabled={!conn || !input.trim()} className="w-12 h-12 rounded-full bg-[#7c5cff] disabled:opacity-40 flex items-center justify-center">➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}
