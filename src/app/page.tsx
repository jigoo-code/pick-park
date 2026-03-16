"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Calendar, Users, Trash2, Zap, RefreshCw } from "lucide-react"

interface RaffleEvent {
  id: string
  title: string
  description: string | null
  end_at: string
  winner_count: number
  status: string
  creator_id: string
  isParticipated?: boolean
  isWinner?: boolean
  isCreator?: boolean
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [events, setEvents] = useState<RaffleEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const currentFilter = searchParams.get("filter") || "all"

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // 1. 세션 확인
        const sessionRes = await fetch("/api/auth/session")
        if (!sessionRes.ok) {
          router.push("/login")
          return
        }
        const { user: sessionUser } = await sessionRes.json()
        setUser(sessionUser)

        // 2. 이벤트 및 참여 정보 가져오기
        const { data: rawEvents, error } = await supabase
          .from("raffle_events")
          .select(`
            *,
            participants(user_id, is_winner)
          `)
          .order("created_at", { ascending: false })

        if (error) throw error

        const now = new Date()
        const processed = (rawEvents || []).map((event: any) => {
          const myPart = event.participants.find((p: any) => p.user_id === sessionUser.id)
          const isOver = new Date(event.end_at) <= now
          
          return {
            ...event,
            status: (event.status === "active" && isOver) ? "completed" : event.status,
            isParticipated: !!myPart,
            isWinner: myPart?.is_winner || false,
            isCreator: event.creator_id === sessionUser.id
          }
        })

        setEvents(processed)
      } catch (err: any) {
        console.error("Dashboard Fetch Error:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [supabase, router])

  const handleDelete = async (eventId: string) => {
    if (!confirm("정말로 이 이벤트를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.")) return

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "삭제 실패")
      }

      toast({
        title: "삭제 완료",
        description: "이벤트가 성공적으로 삭제되었습니다.",
      })

      // 목록에서 즉시 제거
      setEvents(prev => prev.filter(e => e.id !== eventId))
    } catch (err: any) {
      toast({
        title: "삭제 오류",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const handleForceComplete = async (eventId: string) => {
    if (!confirm("종료 시간과 상관없이 지금 즉시 추첨을 진행하고 종료하시겠습니까?")) return

    try {
      const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "추첨 실패")
      }

      toast({
        title: "추첨 완료",
        description: "이벤트가 즉시 종료되었습니다.",
      })

      // 서버 최신 데이터 반영을 위해 리렌더링 유도
      router.refresh()
      window.location.reload() // 완전한 상태 갱신을 위해 임시로 병행
    } catch (err: any) {
      toast({
        title: "오류 발생",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const handleResetDraw = async (eventId: string) => {
    if (!confirm("당첨 결과를 무효로 하고 다시 진행 상태로 변경하시겠습니까?")) return

    try {
      const res = await fetch("/api/draw", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "초기화 실패")
      }

      toast({
        title: "초기화 완료",
        description: "이벤트가 다시 진행 중 상태로 변경되었습니다.",
      })

      // 서버 최신 데이터 반영을 위해 리렌더링 유도
      router.refresh()
      window.location.reload() // 완전한 상태 갱신을 위해 임시로 병행
    } catch (err: any) {
      toast({
        title: "오류 발생",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-20">로딩 중...</div>
  }

  const filteredEvents = events.filter(event => 
    currentFilter === 'all' || (currentFilter === 'participated' && event.isParticipated)
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-4">안녕하세요, {user?.nickname}님!</h1>
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
                  <CardHeader className="pt-6">
                    <div className="flex flex-col gap-2 mb-1">
                      {event.isParticipated && (
                        <div className="flex">
                          <span className="text-[10px] bg-lig text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                            참여함
                          </span>
                        </div>
                      )}
                    </div>
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
                  <CardFooter className="gap-2">
                    <Link href={`/events/${event.id}`} className="flex-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={`w-full ${event.status === 'completed' && event.isParticipated && event.isWinner ? 'border-yellow-400 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800' : ''}`}
                      >
                        {event.status === 'completed' && event.isParticipated ? '결과 확인' : '상세 보기'}
                      </Button>
                    </Link>
                    {(user?.id === "system" || event.isCreator) && (
                      <div className="flex gap-1.5">
                        {event.status === "active" ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleForceComplete(event.id)}
                            className="border-orange-400 text-orange-500 hover:bg-orange-50"
                            title="즉시 종료"
                          >
                            <Zap className="h-4 w-4 fill-orange-500" />
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleResetDraw(event.id)}
                            className="border-blue-400 text-blue-500 hover:bg-blue-50"
                            title="추첨 초기화"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDelete(event.id)}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          <Trash2 className="h-4 w-4 text-white" />
                        </Button>
                      </div>
                    )}
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
