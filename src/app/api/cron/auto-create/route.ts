import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { format, addDays, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns"
import { ko } from "date-fns/locale"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // 보안 체크
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0: 일, 1: 월, ..., 5: 금, 6: 토

    // 1. 목표 날짜(targetDate) 계산
    // 월~목(1~4) 실행 시: 내일(+1)
    // 금(5) 실행 시: 다음주 월요일(+3)
    let daysToAdd = 1
    if (dayOfWeek === 5) {
      daysToAdd = 3
    } else if (dayOfWeek === 6 || dayOfWeek === 0) {
      // 주말 실행 시 로직 (기본적으로 월요일 타겟)
      return NextResponse.json({ message: "Skipped: Weekend run is not supported." })
    }

    const targetDate = addDays(now, daysToAdd)
    
    // 2. 제목 설정 (yyyy-MM-dd (요일) 주차권 추첨)
    const dateStr = format(targetDate, "yyyy-MM-dd")
    const dayName = format(targetDate, "EEEEEE", { locale: ko }) // '월', '화' 등
    const title = `${dateStr} (${dayName}) 주차권 추첨`

    // 3. 종료 날짜 설정 (목표 날짜 오후 1시)
    const endAtDate = setMilliseconds(setSeconds(setMinutes(setHours(targetDate, 13), 0), 0), 0)
    const endAtIsoString = endAtDate.toISOString()

    const supabaseAdmin = createAdminClient()

    // 4. 이벤트 생성
    const { data: newEvent, error } = await supabaseAdmin
      .from("raffle_events")
      .insert({
        title,
        description: `${dateStr} (${dayName}) 주차신청 자동 추첨 이벤트입니다.`,
        end_at: endAtIsoString,
        winner_count: 2,
        status: "active",
        items: [{ id: "1", name: "주차신청" }],
        creator_id: "system"
      })
      .select()
      .single()

    if (error) {
      console.error("Auto Create Error:", error)
      throw new Error(`Failed to insert event: ${error.message}`)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Event "${title}" created for tomorrow/next week.`, 
      event: newEvent 
    })

  } catch (error: any) {
    console.error("Cron Job Failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
