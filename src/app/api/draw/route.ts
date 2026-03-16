import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getUserSession } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }

    // 서버 권한 어드민 클라이언트 사용
    const supabase = createAdminClient()

    // 1. 이벤트 정보 가져오기
    // 상태가 active인 이벤트만 가져옴 (Race condition 방지 및 DB 락 우회)
    const { data: event, error: eventError } = await supabase
      .from("raffle_events")
      .select("*")
      .eq("id", eventId)
      .eq("status", "active")
      .single()

    if (eventError || !event) {
      // 이벤트가 없거나 이미 completed 된 경우 (중복 실행 방지)
      return NextResponse.json({ message: "Event not found or already completed/processing" }, { status: 409 })
    }

    // *방어 로직 2: 추첨을 시작하기 전에 이벤트 상태를 우선 completed로 변경하여 다른 요청을 차단.*
    const now = new Date().toISOString()
    const { data: lockUpdateData, error: lockUpdateError } = await supabase
      .from("raffle_events")
      .update({ status: "completed", end_at: now })
      .eq("id", eventId)
      .eq("status", "active") // 다시 한 번 active인지 확인
      .select()

    if (lockUpdateError || !lockUpdateData || lockUpdateData.length === 0) {
      // 누군가 간발의 차이로 먼저 상태를 completed로 바꿨음
      return NextResponse.json({ message: "Draw already completed by another process" }, { status: 409 })
    }

    // 2. 기존 당첨 정보 모두 초기화 (만약을 대비한 중복 방지)
    await supabase
      .from("participants")
      .update({ is_winner: false })
      .eq("event_id", eventId)

    // 3. 참여자 리스트 가져오기 (출장 여부 포함)
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id, user_id, is_business_trip")
      .eq("event_id", eventId)

    if (participantsError || !participants) {
      throw participantsError || new Error("No participants")
    }

    // 4. 출장자 우선 추첨 알고리즘
    const businessTripPool = participants.filter(p => p.is_business_trip)
    const regularPool = participants.filter(p => !p.is_business_trip)
    
    let winnerIds: string[] = []
    const totalWinnerLimit = event.winner_count

    if (businessTripPool.length <= totalWinnerLimit) {
      winnerIds = businessTripPool.map(p => p.id)
      const remainingSlots = totalWinnerLimit - winnerIds.length
      if (remainingSlots > 0 && regularPool.length > 0) {
        const shuffledRegulars = [...regularPool].sort(() => 0.5 - Math.random())
        const additionalWinners = shuffledRegulars.slice(0, Math.min(remainingSlots, regularPool.length))
        winnerIds = [...winnerIds, ...additionalWinners.map(w => w.id)]
      }
    } else {
      const shuffledBusiness = [...businessTripPool].sort(() => 0.5 - Math.random())
      winnerIds = shuffledBusiness.slice(0, totalWinnerLimit).map(w => w.id)
    }

    // 5. 선별된 당첨자만 정확히 업데이트
    if (winnerIds.length > 0) {
      await supabase
        .from("participants")
        .update({ is_winner: true })
        .in("id", winnerIds)
    }

    // 6. 결과 반환 (이벤트 상태 및 시간은 1단계 방어 로직에서 이미 완료됨)
    return NextResponse.json({ 
      success: true, 
      message: "Draw completed successfully",
      winners_count: winnerIds.length,
      completed_at: now
    })

  } catch (error) {
    // 치명적 에러 발생 시 상태를 active로 되돌림 (선택적)
    // 단, 이 경우 다른 프로세스가 다시 추첨을 돌릴 수 있게 됨.
    try {
      const { eventId } = await request.clone().json()
      if (eventId) {
        const supabase = createAdminClient()
        await supabase.from("raffle_events").update({ status: "active" }).eq("id", eventId)
      }
    } catch (_) { }

    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { eventId } = await request.json()
    const user = getUserSession()

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. 이벤트 정보 및 권한 확인
    const { data: event, error: eventError } = await supabase
      .from("raffle_events")
      .select("creator_id")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // 관리자(system)이거나 작성자인지 확인
    const isAuthorized = user && (user.id === "system" || user.id === event.creator_id)
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. 당첨자 정보 초기화
    const { error: resetError } = await supabase
      .from("participants")
      .update({ is_winner: false })
      .eq("event_id", eventId)

    if (resetError) throw resetError

    // 3. 이벤트 상태를 'active'로 변경
    // 종료 시간(end_at)을 현재 시점으로부터 1시간 뒤로 연장
    // (클라이언트 렌더링 시 과거 시간이면 즉시 다시 추첨해버리는 무한 루프 방지)
    const newEndAt = new Date()
    newEndAt.setHours(newEndAt.getHours() + 1)

    await supabase
      .from("raffle_events")
      .update({ 
        status: "active",
        end_at: newEndAt.toISOString()
      })
      .eq("id", eventId)

    return NextResponse.json({ 
      success: true, 
      message: "Event reset to active successfully. End time extended by 1 hour." 
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
