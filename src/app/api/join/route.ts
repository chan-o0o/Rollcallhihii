import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inviteCode, userId } = body;

    // 1. 초대 코드로 방 찾기
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json({ success: false, message: '유효하지 않은 초대 코드입니다.' }, { status: 404 });
    }

    // 2. 해당 유저가 이미 방에 있는지 확인 (선택 사항)
    const { data: existingMember } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      return NextResponse.json({ success: false, message: '이미 참여 중인 방입니다.' }, { status: 400 });
    }

    // 3. room_members에 추가
    const { error: joinError } = await supabase
      .from('room_members')
      .insert([
        { room_id: room.id, user_id: userId }
      ]);

    if (joinError) throw joinError;

    return NextResponse.json({ success: true, roomId: room.id, message: '방에 성공적으로 입장했습니다!' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
