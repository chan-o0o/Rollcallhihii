import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, userId, status } = body; 
    // status는 'SUCCESS' 혹은 'FAIL'

    // attendance_logs 테이블에 점호 기록 추가
    const { data: log, error } = await supabase
      .from('attendance_logs')
      .insert([
        { 
          room_id: roomId, 
          user_id: userId,
          status: status
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
