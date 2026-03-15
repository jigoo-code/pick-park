import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Calendar, Users } from "lucide-react"
import { getUserSession } from "@/lib/auth"

interface RaffleEvent {
  id: string
  title: string
  description: string | null
  end_at: string
  winner_count: number
  status: string
  creator_id: string
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { filter?: string }
}) {
  const supabase = createClient()
  const user = getUserSession()

  if (!user) {
    redirect("/login")
  }

  const currentFilter = searchParams.filter || "all"

  // 1. 모든 이벤트 가져오기
  const { data: rawEvents, error: err1 } = await supabase
    .from("raffle_events")
    .select(`
      *,
      participants(user_id, is_winner)
    `)
    .order("created_at", { ascending: false })

  if (err1) {
    console.error("Events Fetch Error:", err1)
  }

  // 데이터 가공 및 종료 처리 (자동 추첨)
  const now = new Date()
  
  const processedEvents = await Promise.all((rawEvents || []).map(async (event: any) => {
    let currentStatus = event.status
    const isOver = new Date(event.end_at) <= now

    // 내가 참여했는지 여부 및 당첨 결과 확인
    const myParticipation = event.participants.find((p: any) => p.user_id === user.id)
    const isParticipated = !!myParticipation
    const isWinner = myParticipation?.is_winner || false
    const isCreator = event.creator_id === user.id

    if (currentStatus === "active" && isOver) {
      currentStatus = "completed"
    }

    return {
      ...event,
      status: currentStatus,
      isParticipated,
      isWinner,
      isCreator
    }
  }))

  const filteredEvents = processedEvents.filter(event => 
    currentFilter === 'all' || (currentFilter === 'participated' && event.isParticipated)
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-4">안녕하세요, {user.nickname}님!</h1>
      </div>

      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">추첨 이벤트</h2>
              <div className="flex bg-muted p-1 rounded-md text-sm">
                <Link 
                  href="/"
                  className={`px-3 py-1 rounded-sm transition-colors ${currentFilter === 'all' ? 'bg-background shadow-sm font-bold' : 'hover:text-foreground/80 text-muted-foreground'}`}
                >
                  전체
                </Link>
                <Link 
                  href="/?filter=participated"
                  className={`px-3 py-1 rounded-sm transition-colors ${currentFilter === 'participated' ? 'bg-background shadow-sm font-bold' : 'hover:text-foreground/80 text-muted-foreground'}`}
                >
                  참여함
                </Link>
              </div>
            </div>
            <Link href="/create">
              <Button size="sm" className="bg-lig hover:bg-lig/90 text-white border-none">새로 만들기</Button>
            </Link>
          </div>
          
          {filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((event) => (
                <Card key={event.id} className={`flex flex-col relative overflow-hidden ${event.isParticipated ? 'border-lig/50 bg-lig/5' : ''}`}>
                  <div className="absolute top-4 left-4 flex flex-col gap-1 z-10">
                    {event.isParticipated && (
                      <span className="text-[10px] bg-lig text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                        참여함
                      </span>
                    )}
                  </div>
                  
                  <CardHeader className="pt-8">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg line-clamp-1">{event.title}</CardTitle>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                         <span className={`text-[10px] px-2 py-0.5 rounded-full ${event.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700 font-medium'}`}>
                          {event.status === 'active' ? '진행중' : '종료됨'}
                        </span>
                        {event.isParticipated && event.status === 'completed' && (
                           <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${event.isWinner ? 'bg-yellow-400 text-yellow-950' : 'bg-red-100 text-red-800'}`}>
                             {event.isWinner ? '🎉 당첨!' : '🥲 미당첨'}
                           </span>
                        )}
                      </div>
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
                      <Button variant="outline" className={`w-full ${event.status === 'completed' && event.isParticipated && event.isWinner ? 'border-yellow-400 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800' : ''}`}>
                        {event.status === 'completed' && event.isParticipated ? '결과 확인' : '상세 보기'}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 border-dashed">
              <CardDescription>
                {currentFilter === 'participated' ? "참여한 이벤트가 없습니다." : "진행 중인 이벤트가 없습니다."}
              </CardDescription>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
