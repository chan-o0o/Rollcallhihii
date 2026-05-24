import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, penalty, userId } = body;

    // 1. 6자리 랜덤 초대 코드 생성 (A-Z, 0-9)
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let inviteCode = '';
    for (let i = 0; i < 6; i++) {
      inviteCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // 2. Supabase rooms 테이블에 방 생성
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([
        { 
          title, 
          penalty, 
          invite_code: inviteCode, 
          created_by: userId 
        }
      ])
      .select()
      .single();

    if (roomError) throw roomError;

    // 3. 방을 만든 사람(방장)을 room_members 테이블에도 추가
    const { error: memberError } = await supabase
      .from('room_members')
      .insert([
        { room_id: room.id, user_id: userId }
      ]);

    if (memberError) throw memberError;

    return NextResponse.json({ success: true, room }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
