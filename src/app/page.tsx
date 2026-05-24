"use client";

import React, { useState, useEffect } from 'react';
import { Camera, LogIn, PlusCircle, Users, Zap, Share2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// --- 유틸리티: 6자리 랜덤 초대 코드 생성 ---
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

export default function GisangNapal() {
  // 상태 관리
  const [view, setView] = useState<'landing' | 'create' | 'dashboard'>('landing');
  const [loading, setLoading] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  
  // 데이터 상태
  const [user, setUser] = useState<any>(null); // 현재 유저
  const [currentRoom, setCurrentRoom] = useState<any>(null); // 현재 접속한 방
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]); // 점호 기록 리스트

  // 방 만들기 입력값
  const [roomTitle, setRoomTitle] = useState('');
  const [roomPenalty, setRoomPenalty] = useState('스타벅스 아메리카노');

  // 스타일 클래스
  const neoCard = "bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-6";
  const neoBtnPrimary = "bg-[#eaff00] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-black py-4 px-6 text-xl uppercase italic";
  const neoBtnSecondary = "bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold py-3 px-4 uppercase";
  const neoInput = "w-full border-4 border-black p-4 text-xl font-bold focus:outline-none focus:bg-[#eaff00] transition-colors";

  // 1. 초기 로드: 로그인 상태 확인 (MVP에서는 익명 혹은 간단한 세션 처리 가능)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();
  }, []);

  // 2. 실시간 구독 (Realtime): 점호 기록 업데이트 감시
  useEffect(() => {
    if (!currentRoom) return;

    // 해당 방의 오늘 점호 기록 가져오기
    fetchAttendance(currentRoom.id);

    // 실시간 채널 구독
    const channel = supabase
      .channel('realtime-attendance')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs', filter: `room_id=eq.${currentRoom.id}` },
        (payload) => {
          console.log('새로운 점호 기록 발생!', payload);
          // 새로운 기록이 생기면 리스트에 추가 (간단하게 다시 fetch)
          fetchAttendance(currentRoom.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom]);

  const fetchAttendance = async (roomId: string) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        *,
        profiles (username)
      `)
      .eq('room_id', roomId)
      .order('checked_at', { ascending: false });
    
    if (data) setAttendanceLogs(data);
  };

  // --- 기능 핸들러 ---

  // [기능 1] 방 만들기
  const handleCreateRoom = async () => {
    if (!user) {
      alert("로그인이 필요합니다! (임시로 Supabase Auth 기능을 먼저 확인하세요)");
      return;
    }
    setLoading(true);
    const code = generateInviteCode();
    
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{ 
          title: roomTitle, 
          penalty: roomPenalty, 
          invite_code: code,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      
      // 방 멤버로 자신도 추가
      await supabase.from('room_members').insert([{ room_id: data.id, user_id: user.id }]);
      
      setCurrentRoom(data);
      alert(`방이 생성되었습니다! 초대 코드: ${code}`);
      setView('dashboard');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // [기능 2] 초대 코드로 방 입장
  const handleJoinRoom = async () => {
    if (!user) return alert("로그인 후 이용 가능합니다.");
    setLoading(true);
    
    try {
      // 코드 확인
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('invite_code', inviteCodeInput.toUpperCase())
        .single();

      if (roomError || !room) throw new Error("유효하지 않은 코드입니다.");

      // 멤버 추가 (이미 있는지는 Supabase PK에서 걸러짐)
      const { error: joinError } = await supabase
        .from('room_members')
        .insert([{ room_id: room.id, user_id: user.id }]);

      // 에러가 '이미 존재' 하는 경우가 아닐 때만 던짐
      if (joinError && !joinError.message.includes('duplicate')) throw joinError;

      setCurrentRoom(room);
      setView('dashboard');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // [기능 3] 점호 참여 (생존신고)
  const handleCheckIn = async () => {
    if (!user || !currentRoom) return;
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('attendance_logs')
        .insert([{
          room_id: currentRoom.id,
          user_id: user.id,
          status: 'SUCCESS'
        }]);

      if (error) throw error;
      alert("생존 신고 완료! 🎺");
    } catch (e: any) {
      alert("이미 오늘 신고하셨거나 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 임시 로그인 함수 (Auth UI 구현 전 테스트용)
  const handleTempLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google', // 혹은 다른 설정된 프로바이더
    });
    if (error) alert(error.message);
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0] text-black font-sans selection:bg-[#eaff00] p-4 flex flex-col items-center">
      <div className="w-full max-w-md">
        <header className="py-8 text-center" onClick={() => setView('landing')} style={{ cursor: 'pointer' }}>
          <h1 className="text-5xl font-[900] tracking-tighter uppercase italic leading-none">
            기상 <span className="bg-[#eaff00] px-2">나팔</span>
          </h1>
          <p className="font-bold text-sm mt-2 border-2 border-black inline-block px-2 bg-white">
            WAKE UP OR PAY UP! 🎺
          </p>
        </header>

        {/* 1. 랜딩 & 로그인/초대장 섹션 */}
        {view === 'landing' && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={neoCard}>
              <h2 className="text-3xl font-black mb-4 leading-tight">
                "눈 뜨자마자 생존신고!<br/>지각하면 아아 쏜다."
              </h2>
              {user ? (
                <p className="font-bold text-green-600 mb-6">✅ 로그인됨: {user.email}</p>
              ) : (
                <button 
                  onClick={handleTempLogin}
                  className={`${neoBtnPrimary} w-full flex items-center justify-center gap-2 mb-4`}
                >
                  <LogIn size={24} /> 로그인하고 시작하기
                </button>
              )}
            </div>

            <div className={neoCard}>
              <h3 className="text-xl font-black mb-4 uppercase">이미 초대장이 있나요?</h3>
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
                className={`${neoBtnSecondary} w-full mt-4 flex items-center justify-center gap-2`}
                onClick={handleJoinRoom}
              >
                {loading ? <Loader2 className="animate-spin" /> : '방 입장하기'}
              </button>
              <button 
                className="w-full mt-4 font-bold underline text-sm"
                onClick={() => setView('create')}
              >
                직접 방을 만들고 싶으신가요?
              </button>
            </div>
          </section>
        )}

        {/* 2. 방 만들기 섹션 */}
        {view === 'create' && (
          <section className="animate-in fade-in slide-in-from-right-4 duration-500">
            <div className={neoCard}>
              <h2 className="text-2xl font-black mb-6 uppercase flex items-center gap-2">
                <PlusCircle /> 새로운 방 개설
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="font-black text-sm block mb-1">방 이름</label>
                  <input 
                    type="text" 
                    placeholder="예: 미라클 모닝 7시" 
                    className={neoInput}
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-black text-sm block mb-1">오늘의 벌칙</label>
                  <select 
                    className={neoInput}
                    value={roomPenalty}
                    onChange={(e) => setRoomPenalty(e.target.value)}
                  >
                    <option>스타벅스 아메리카노</option>
                    <option>편의점 비타500</option>
                    <option>천원 입금하기</option>
                    <option>딱밤 한 대</option>
                  </select>
                </div>
                <button 
                  onClick={handleCreateRoom}
                  disabled={loading || !roomTitle}
                  className={`${neoBtnPrimary} w-full flex justify-center items-center`}
                >
                  {loading ? <Loader2 className="animate-spin" /> : '방 개설 완료!'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 3. 점호 대시보드 */}
        {view === 'dashboard' && (
          <section className="animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-4 text-center">
              <span className="bg-black text-white px-3 py-1 font-black italic">ROOM: {currentRoom?.title}</span>
            </div>
            
            <button 
              onClick={handleCheckIn}
              disabled={loading}
              className={`${neoBtnPrimary} w-full py-8 mb-8 flex flex-col items-center justify-center gap-2 border-[6px]`}
            >
              {loading ? <Loader2 size={48} className="animate-spin" /> : <Zap size={48} fill="black" />}
              <span className="text-3xl tracking-tighter">🚨 지금 생존 신고하기!</span>
            </button>

            <div className={neoCard}>
              <h3 className="text-xl font-black mb-4 uppercase flex items-center gap-2">
                <Users size={20} /> 실시간 생존 현황 ({attendanceLogs.length})
              </h3>
              <div className="space-y-3">
                {attendanceLogs.length === 0 && <p className="text-center py-4 font-bold opacity-50">아직 아무도 신고하지 않았어요!</p>}
                {attendanceLogs.map((log, i) => (
                  <div key={i} className="flex justify-between items-center border-b-2 border-black pb-2">
                    <span className="font-bold">{log.profiles?.username || '익명 유저'}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono">
                        {new Date(log.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-black border-2 border-black bg-green-400">
                        SUCCESS
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 인스타 공유 카드 (현재 방 데이터 반영) */}
            <div className="mt-10 border-t-4 border-black pt-8">
              <div className="bg-[#eaff00] border-4 border-black p-6 aspect-[4/5] flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] rotate-12 opacity-10">
                  <Zap size={200} fill="black" />
                </div>
                <div>
                  <h4 className="text-4xl font-[950] italic leading-none uppercase">Gisang<br/>Napal</h4>
                  <div className="bg-black text-white inline-block px-2 py-1 mt-2 font-black text-sm uppercase">
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
                <div className="bg-white border-4 border-black p-4 z-10">
                  <p className="font-black text-lg">{currentRoom?.title}</p>
                  <p className="text-3xl font-[950] mt-2 italic">{attendanceLogs.length} 명 생존 중</p>
                  <p className="text-sm font-bold mt-1 text-red-500 uppercase">Penalty: {currentRoom?.penalty}</p>
                </div>
                <div className="flex justify-between items-end z-10">
                  <div className="font-black leading-tight">
                    <p className="text-xs uppercase">INVITE CODE</p>
                    <p className="text-xl italic">{currentRoom?.invite_code}</p>
                  </div>
                  <Camera size={32} />
                </div>
              </div>
              <button className={`${neoBtnSecondary} w-full mt-4 flex items-center justify-center gap-2`}>
                <Share2 size={18} /> 인스타 스토리에 공유하기
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
