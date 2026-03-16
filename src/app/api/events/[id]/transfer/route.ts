import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getUserSession } from "@/lib/auth"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = getUserSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const eventId = params.id
    const { targetUserId } = await request.json()

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 })
    }

    if (user.id === targetUserId) {
      return NextResponse.json({ error: "Cannot transfer to yourself" }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. 이벤트가 완료 상태인지 확인
    const { data: event, error: eventError } = await supabaseAdmin
      .from("raffle_events")
      .select("status")
      .eq("id", eventId)
      .single()

    if (eventError || !event || event.status !== "completed") {
      return NextResponse.json({ error: "Event is not completed or not found" }, { status: 400 })
    }

    // 2. 요청자가 실제로 해당 이벤트의 '당첨자'인지 확인
    const { data: myParticipation, error: myPartError } = await supabaseAdmin
      .from("participants")
      .select("id, is_winner")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single()

    if (myPartError || !myParticipation || !myParticipation.is_winner) {
      return NextResponse.json({ error: "You are not a winner of this event" }, { status: 403 })
    }

    // 3. 양도받을 대상이 참가자인지, 그리고 이미 당첨자는 아닌지 확인
    const { data: targetParticipation, error: targetPartError } = await supabaseAdmin
      .from("participants")
      .select("id, is_winner")
      .eq("event_id", eventId)
      .eq("user_id", targetUserId)
      .single()

    if (targetPartError || !targetParticipation) {
      return NextResponse.json({ error: "Target user is not a participant" }, { status: 404 })
    }

    if (targetParticipation.is_winner) {
      return NextResponse.json({ error: "Target user is already a winner" }, { status: 400 })
    }

    // 4. 양도 처리: 내 is_winner를 false로, 대상의 is_winner를 true로 (원자적 처리가 안되므로 순차 진행)
    // 에러 발생을 최소화하기 위해 대상자를 먼저 승격시키고, 그 다음 나를 박탈합니다.
    const { error: upgradeError } = await supabaseAdmin
      .from("participants")
      .update({ is_winner: true })
      .eq("id", targetParticipation.id)

    if (upgradeError) {
      throw upgradeError
    }

    const { error: downgradeError } = await supabaseAdmin
      .from("participants")
      .update({ is_winner: false })
      .eq("id", myParticipation.id)

    if (downgradeError) {
      // 나를 박탈하는 데 실패했다면 매우 꼬인 상황이므로 롤백 시도 (최소한의 방어)
      await supabaseAdmin.from("participants").update({ is_winner: false }).eq("id", targetParticipation.id)
      throw new Error(`Transfer failed during downgrade: ${downgradeError.message}`)
    }

    return NextResponse.json({ success: true, message: "Transfer completed successfully" })

  } catch (error: any) {
    console.error("Transfer Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
