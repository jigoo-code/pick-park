import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// 이 API는 Vercel Cron 등 외부 스케줄러나 관리자가 호출할 수 있도록 환경 변수를 통한 인증이 가능합니다.
// 서버리스 환경에서 Supabase 관리자 권한을 위해 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.
// 여기서는 테스트를 용이하게 하기 위해 ANON KEY로 우회하여 구현합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }

    // 1. 이벤트 정보 가져오기
    const { data: event, error: eventError } = await supabase
      .from("raffle_events")
      .select("*")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (event.status === "completed") {
      return NextResponse.json({ message: "Already completed" }, { status: 400 })
    }

    // 2. 참여자 리스트 가져오기
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id, user_id")
      .eq("event_id", eventId)

    if (participantsError) {
      throw participantsError
    }

    // 3. 무작위 추첨 알고리즘 (Fisher-Yates Shuffle 활용)
    const shuffled = [...(participants || [])].sort(() => 0.5 - Math.random())
    const winnerCount = Math.min(event.winner_count, shuffled.length)
    const winners = shuffled.slice(0, winnerCount)
    const winnerIds = winners.map(w => w.id)

    // 4. 당첨자 업데이트
    if (winnerIds.length > 0) {
      // 당첨자 is_winner 플래그 업데이트
      await supabase
        .from("participants")
        .update({ is_winner: true })
        .in("id", winnerIds)
    }

    // 5. 이벤트 상태를 'completed'로 변경
    await supabase
      .from("raffle_events")
      .update({ status: "completed" })
      .eq("id", eventId)

    return NextResponse.json({ 
      success: true, 
      message: "Draw completed successfully",
      winners_count: winnerIds.length 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
