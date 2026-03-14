import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Calendar, Users } from "lucide-react"
import { getUserSession } from "@/lib/auth"

export default async function DashboardPage() {
  const supabase = createClient()
  const user = getUserSession()

  if (!user) {
    redirect("/login")
  }

  // 1. 내가 만든 이벤트 가져오기
  const { data: createdEvents, error: err1 } = await supabase
    .from("raffle_events")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })

  if (err1) {
    console.error("Created Events Error:", err1)
  }

  // 대시보드 접속 시 종료 시간이 지난 active 이벤트가 있다면 자동 상태 업데이트
  if (createdEvents) {
    const now = new Date()
    for (const event of createdEvents) {
      if (event.status === "active" && new Date(event.end_at) <= now) {
        try {
          const { data: participants } = await supabase
            .from("participants")
            .select("id")
            .eq("event_id", event.id)
            
          const shuffled = [...(participants || [])].sort(() => 0.5 - Math.random())
          const winnerCount = Math.min(event.winner_count, shuffled.length)
          const winners = shuffled.slice(0, winnerCount)
          const winnerIds = winners.map(w => w.id)

          if (winnerIds.length > 0) {
            await supabase
              .from("participants")
              .update({ is_winner: true })
              .in("id", winnerIds)
          }

          await supabase
            .from("raffle_events")
            .update({ status: "completed" })
            .eq("id", event.id)
          
          event.status = "completed" // 클라이언트 렌더링용 임시 변경
        } catch (e) {
          console.error("Dashboard auto draw error:", e)
        }
      }
    }
  }

  // 2. 내가 참여한 이벤트 가져오기
  const { data: participatedEvents, error: err2 } = await supabase
    .from("participants")
    .select(`
      is_winner,
      raffle_events:raffle_events (*)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (err2) {
    console.error("Participated Events Error:", err2)
  }

  // 데이터 가공 (타입 안전성 확보)
  const processedParticipations = (participatedEvents || []).map((p: any) => {
    const event = Array.isArray(p.raffle_events) ? p.raffle_events[0] : p.raffle_events
    if (!event) return null
    
    // 시간 지남 여부 체크하여 상태 가상 업데이트
    const isOver = new Date(event.end_at) <= new Date()
    return {
      ...p,
      raffle_events: {
        ...event,
        status: (event.status === "active" && isOver) ? "completed" : event.status
      }
    }
  }).filter(Boolean)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-4">안녕하세요, {user.nickname}님!</h1>
        <p className="text-muted-foreground">Pick-Park 주차권 추첨 대시보드입니다.</p>
      </div>

      <div className="space-y-6">
        {/* Section: 내가 만든 추첨 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">내가 만든 추첨</h2>
            <Link href="/create">
              <Button size="sm" variant="outline">새로 만들기</Button>
            </Link>
          </div>
          
          {createdEvents && createdEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {createdEvents.map((event) => (
                <Card key={event.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg line-clamp-1">{event.title}</CardTitle>
                      <span className={`text-xs px-2 py-1 rounded-full ${event.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {event.status === 'active' ? '진행중' : '종료됨'}
                      </span>
                    </div>
                    <CardDescription className="line-clamp-2">{event.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>당첨 인원: {event.winner_count}명</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>종료: {format(new Date(event.end_at), "PPP p", { locale: ko })}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/events/${event.id}`} className="w-full">
                      <Button variant="secondary" className="w-full">상세 보기</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 border-dashed">
              <CardDescription>아직 만든 추첨 이벤트가 없습니다.</CardDescription>
            </Card>
          )}
        </section>

        {/* Section: 내가 참여한 추첨 */}
        <section>
          <h2 className="text-xl font-semibold mb-4">내가 참여한 추첨</h2>
          {processedParticipations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedParticipations.map((participation: any) => {
                const event = participation.raffle_events
                return (
                  <Card key={event.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg line-clamp-1">{event.title}</CardTitle>
                        {event.status === 'completed' && (
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${participation.is_winner ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {participation.is_winner ? '🎉 당첨!' : '🥲 미당첨'}
                          </span>
                        )}
                      </div>
                      <CardDescription className="line-clamp-1">{event.description}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Link href={`/events/${event.id}`} className="w-full">
                        <Button variant="outline" className="w-full">결과 확인</Button>
                      </Link>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 border-dashed">
              <CardDescription>아직 참여한 추첨 이벤트가 없습니다.</CardDescription>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
