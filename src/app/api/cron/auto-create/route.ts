import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { format, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns"

export const dynamic = 'force-dynamic' // 정적 페이지 캐싱 방지

export async function GET(request: Request) {
  // 간단한 보안 체크: 환경 변수 CRON_SECRET이 설정되어 있다면 이를 검증합니다.
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0: 일, 1: 월, ..., 5: 금, 6: 토

    // 1. 평일(월~금)인지 확인 (1~5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({ message: "Skipped: Today is weekend." }, { status: 200 })
    }

    // 2. 제목 설정 (yyyy-mm-dd 주차권 추첨)
    const dateStr = format(now, "yyyy-MM-dd")
    const title = `${dateStr} 주차권 추첨`

    // 3. 종료 날짜 설정 (당일 오후 2시)
    const endAtDate = setMilliseconds(setSeconds(setMinutes(setHours(now, 14), 0), 0), 0)
    const endAtIsoString = endAtDate.toISOString()

    const supabaseAdmin = createAdminClient()

    // 4. 이벤트 생성 (Service Role로 RLS 우회하여 강제 생성)
    const { data: newEvent, error } = await supabaseAdmin
      .from("raffle_events")
      .insert({
        title,
        description: `${dateStr} 주차신청 자동 추첨 이벤트입니다.`,
        end_at: endAtIsoString,
        winner_count: 2,
        status: "active",
        items: [{ id: "1", name: "주차신청" }], // 추첨 항목 설정
        creator_id: "system" // 시스템 자동 생성 표기용
      })
      .select()
      .single()

    if (error) {
      console.error("Auto Create Error:", error)
      throw new Error(`Failed to insert event: ${error.message}`)
    }

    console.log(`[Cron] Event successfully created for ${dateStr}`)
    return NextResponse.json({ 
      success: true, 
      message: `Event "${title}" created.`, 
      event: newEvent 
    })

  } catch (error: any) {
    console.error("Cron Job Failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
