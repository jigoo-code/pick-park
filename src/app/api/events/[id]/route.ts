import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getUserSession } from "@/lib/auth"

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = getUserSession()
    
    const eventId = params.id
    const supabaseAdmin = createAdminClient()

    // 삭제하려는 이벤트 정보 가져오기 (작성자 확인용)
    const { data: event } = await supabaseAdmin
      .from("raffle_events")
      .select("creator_id")
      .eq("id", eventId)
      .single()

    // 관리자(system)이거나 해당 이벤트의 작성자인지 확인
    const isAuthorized = user && (user.id === "system" || user.id === event?.creator_id)

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized. Access denied." }, { status: 401 })
    }

    // 1. 참여자 데이터 먼저 삭제 (외래 키 제약 조건 대응)
    const { error: partError } = await supabaseAdmin
      .from("participants")
      .delete()
      .eq("event_id", eventId)

    if (partError) throw partError

    // 2. 이벤트 삭제
    const { error: eventError } = await supabaseAdmin
      .from("raffle_events")
      .delete()
      .eq("id", eventId)

    if (eventError) throw eventError

    return NextResponse.json({ success: true, message: "Event deleted successfully." })

  } catch (error: any) {
    console.error("Delete Event Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
