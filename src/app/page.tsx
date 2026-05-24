"use client";

import React, { useState, useEffect } from 'react';
import { Camera, LogIn, PlusCircle, Users, Zap, Share2, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

export default function GisangNapal() {
  const [view, setView] = useState<'landing' | 'create' | 'dashboard'>('landing');
  const [loading, setLoading] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  
  const [user, setUser] = useState<any>(null);
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);

  // 로그인/회원가입 입력값
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // 방 만들기 입력값
  const [roomTitle, setRoomTitle] = useState('');
  const [roomPenalty, setRoomPenalty] = useState('스타벅스 아메리카노');

  const neoCard = "bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-6";
  const neoBtnPrimary = "bg-[#eaff00] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-black py-4 px-6 text-xl uppercase italic";
  const neoBtnSecondary = "bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold py-3 px-4 uppercase";
  const neoInput = "w-full border-4 border-black p-4 text-xl font-bold focus:outline-none focus:bg-[#eaff00] transition-colors mb-2";

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    // 로그아웃 등 상태 변경 감지
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentRoom) return;
    fetchAttendance(currentRoom.id);
    const channel = supabase
      .channel(`room-${currentRoom.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs', filter: `room_id=eq.${currentRoom.id}` },
        () => fetchAttendance(currentRoom.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom]);

  const fetchAttendance = async (roomId: string) => {
    const { data } = await supabase
      .from('attendance_logs')
      .select(`*, profiles (username)`)
      .eq('room_id', roomId)
      .order('checked_at', { ascending: false });
    if (data) setAttendanceLogs(data);
  };

  // --- 인증 관련 함수 ---
  const handleAuth = async () => {
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: nickname } // 프로필 트리거에서 사용됨
          }
        });
        if (error) throw error;
        alert("회원가입 성공! (이메일 인증을 껐다면 바로 로그인됩니다)");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView('landing');
  };

  // --- 방 관련 함수 ---
  const handleCreateRoom = async () => {
    if (!user) return alert("먼저 로그인해 주세요!");
    setLoading(true);
    const code = generateInviteCode();
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{ title: roomTitle, penalty: roomPenalty, invite_code: code, created_by: user.id }])
        .select().single();
      if (error) throw error;
      await supabase.from('room_members').insert([{ room_id: data.id, user_id: user.id }]);
      setCurrentRoom(data);
      setView('dashboard');
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  const handleJoinRoom = async () => {
    if (!user) return alert("먼저 로그인해 주세요!");
    setLoading(true);
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms').select('*').eq('invite_code', inviteCodeInput.toUpperCase()).single();
      if (roomError || !room) throw new Error("방을 찾을 수 없습니다.");
      const { error: joinError } = await supabase
        .from('room_members').insert([{ room_id: room.id, user_id: user.id }]);
      if (joinError && !joinError.message.includes('duplicate')) throw joinError;
      setCurrentRoom(room);
      setView('dashboard');
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  const handleCheckIn = async () => {
    if (!user || !currentRoom) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('attendance_logs').insert([{ room_id: currentRoom.id, user_id: user.id, status: 'SUCCESS' }]);
      if (error) throw error;
      alert("생존 신고 완료! 🎺");
    } catch (e: any) { alert("이미 오늘 신고했거나 오류가 발생했습니다."); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0] text-black font-sans selection:bg-[#eaff00] p-4 flex flex-col items-center">
      <div className="w-full max-w-md">
        <header className="py-8 text-center" onClick={() => setView('landing')} style={{ cursor: 'pointer' }}>
          <h1 className="text-5xl font-[900] tracking-tighter uppercase italic leading-none">
            기상 <span className="bg-[#eaff00] px-2">나팔</span>
          </h1>
          <p className="font-bold text-sm mt-2 border-2 border-black inline-block px-2 bg-white uppercase">
            Wake up or pay up!
          </p>
        </header>

        {view === 'landing' && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={neoCard}>
              <h2 className="text-3xl font-black mb-6 leading-tight uppercase italic">
                {user ? `환영합니다! ${user.user_metadata?.username || user.email}` : "지각하면 아아 쏜다!"}
              </h2>

              {!user ? (
                <div className="space-y-2">
                  {isSignUp && (
                    <input type="text" placeholder="닉네임 (예: 홍길동)" className={neoInput} value={nickname} onChange={e => setNickname(e.target.value)} />
                  )}
                  <input type="email" placeholder="이메일 주소" className={neoInput} value={email} onChange={e => setEmail(e.target.value)} />
                  <input type="password" placeholder="비밀번호" className={neoInput} value={password} onChange={e => setPassword(e.target.value)} />
                  
                  <button onClick={handleAuth} disabled={loading} className={`${neoBtnPrimary} w-full flex items-center justify-center gap-2 mb-2`}>
                    {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? <UserPlus size={24} /> : <LogIn size={24} />)}
                    {isSignUp ? "가입하고 시작하기" : "로그인하기"}
                  </button>
                  
                  <button onClick={() => setIsSignUp(!isSignUp)} className="w-full font-bold text-sm underline text-center block mt-2">
                    {isSignUp ? "이미 계정이 있나요? 로그인" : "계정이 없으신가요? 회원가입"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-black text-[#eaff00] p-4 border-4 border-black font-black text-center">
                    로그인 상태입니다.
                  </div>
                  <button onClick={handleLogout} className="w-full font-bold text-sm underline uppercase opacity-50">Logout</button>
                </div>
              )}
            </div>

            {user && (
              <div className={neoCard}>
                <h3 className="text-xl font-black mb-4 uppercase italic underline decoration-[#eaff00] decoration-4">이미 초대장이 있나요?</h3>
                <input 
                  type="text" 
                  placeholder="6자리 코드 입력" 
                  className={neoInput}
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button 
                  disabled={loading}
                  className={`${neoBtnSecondary} w-full mt-2 flex items-center justify-center gap-2 font-black italic`}
                  onClick={handleJoinRoom}
                >
                  {loading ? <Loader2 className="animate-spin" /> : '방 입장하기 (JOIN)'}
                </button>
                <button className="w-full mt-6 py-4 border-4 border-black bg-white font-black text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all" onClick={() => setView('create')}>
                  + 새 방 만들기
                </button>
              </div>
            )}
          </section>
        )}

        {view === 'create' && (
          <section className="animate-in fade-in slide-in-from-right-4 duration-500">
            <div className={neoCard}>
              <h2 className="text-2xl font-black mb-6 uppercase flex items-center gap-2 italic">
                <PlusCircle /> NEW ROOM
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="font-black text-xs block mb-1 uppercase opacity-50">Room Name</label>
                  <input type="text" placeholder="예: 미라클 모닝 7시" className={neoInput} value={roomTitle} onChange={(e) => setRoomTitle(e.target.value)} />
                </div>
                <div>
                  <label className="font-black text-xs block mb-1 uppercase opacity-50">Penalty</label>
                  <select className={neoInput} value={roomPenalty} onChange={(e) => setRoomPenalty(e.target.value)}>
                    <option>스타벅스 아메리카노</option>
                    <option>편의점 비타500</option>
                    <option>천원 입금하기</option>
                    <option>딱밤 한 대</option>
                  </select>
                </div>
                <button onClick={handleCreateRoom} disabled={loading || !roomTitle} className={`${neoBtnPrimary} w-full flex justify-center items-center`}>
                  {loading ? <Loader2 className="animate-spin" /> : '방 개설 완료! (CREATE)'}
                </button>
              </div>
            </div>
          </section>
        )}

        {view === 'dashboard' && (
          <section className="animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-4 text-center">
              <span className="bg-black text-white px-3 py-1 font-black italic uppercase tracking-tighter">ROOM: {currentRoom?.title}</span>
            </div>
            
            <button 
              onClick={handleCheckIn}
              disabled={loading}
              className={`${neoBtnPrimary} w-full py-10 mb-8 flex flex-col items-center justify-center gap-2 border-[6px] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]`}
            >
              {loading ? <Loader2 size={64} className="animate-spin" /> : <Zap size={64} fill="black" />}
              <span className="text-4xl tracking-tighter italic">지금 생존 신고!</span>
            </button>

            <div className={neoCard}>
              <h3 className="text-xl font-black mb-4 uppercase flex items-center gap-2 italic">
                <Users size={20} /> SURVIVORS ({attendanceLogs.length})
              </h3>
              <div className="space-y-3">
                {attendanceLogs.length === 0 && <p className="text-center py-4 font-bold opacity-30 italic">No one yet...</p>}
                {attendanceLogs.map((log, i) => (
                  <div key={i} className="flex justify-between items-center border-b-4 border-black pb-2">
                    <span className="font-black text-lg">{log.profiles?.username || '익명'}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold">{new Date(log.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="px-2 py-1 text-xs font-black border-2 border-black bg-green-400 uppercase italic">SUCCESS</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 border-t-4 border-black pt-8">
              <div className="bg-[#eaff00] border-4 border-black p-6 aspect-[4/5] flex flex-col justify-between relative overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                <div className="absolute top-[-20px] right-[-20px] rotate-12 opacity-10"><Zap size={200} fill="black" /></div>
                <div>
                  <h4 className="text-5xl font-[950] italic leading-none uppercase tracking-tighter">Gisang<br/>Napal</h4>
                  <div className="bg-black text-white inline-block px-2 py-1 mt-2 font-black text-sm uppercase">{new Date().toLocaleDateString()}</div>
                </div>
                <div className="bg-white border-4 border-black p-4 z-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                  <p className="font-black text-xl italic underline decoration-[#eaff00] decoration-4">{currentRoom?.title}</p>
                  <p className="text-4xl font-[950] mt-2 italic tracking-tighter">{attendanceLogs.length} SURVIVED</p>
                  <p className="text-xs font-black mt-2 text-red-600 uppercase">Penalty: {currentRoom?.penalty}</p>
                </div>
                <div className="flex justify-between items-end z-10">
                  <div className="font-black leading-tight">
                    <p className="text-[10px] uppercase opacity-50">Invite Code</p>
                    <p className="text-2xl italic tracking-widest">{currentRoom?.invite_code}</p>
                  </div>
                  <Camera size={40} />
                </div>
              </div>
              <button className={`${neoBtnSecondary} w-full mt-8 flex items-center justify-center gap-2 font-black text-lg italic mb-20`}>
                <Share2 size={24} /> SHARE TO STORY
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
