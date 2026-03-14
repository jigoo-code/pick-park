"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Share2, Copy, Users, Calendar, Trophy } from "lucide-react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"

interface EventData {
  id: string
  title: string
  description: string
  end_at: string
  winner_count: number
  status: string
  creator_id: string
}

export default function EventDetailPage() {
  const { id } = useParams()
  const [event, setEvent] = useState<EventData | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [isParticipated, setIsParticipated] = useState(false)
  const [isWinner, setIsWinner] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [winners, setWinners] = useState<any[]>([])
  
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const fetchEventData = async () => {
      setIsLoading(true)
      try {
        const sessionRes = await fetch("/api/auth/session")
        if (!sessionRes.ok) {
          router.push("/login")
          return
        }
        const { user } = await sessionRes.json()

        // 이벤트 상세 정보 가져오기
        const { data: eventData, error: eventError } = await supabase
          .from("raffle_events")
          .select("*")
          .eq("id", id)
          .single()

        if (eventError) throw eventError

        let currentStatus = eventData.status
        // 종료 시간이 지났는데 아직 active인 경우 추첨 API 강제 실행
        if (currentStatus === "active" && new Date(eventData.end_at) <= new Date()) {
          try {
            await fetch("/api/draw", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventId: id })
            })
            currentStatus = "completed"
            eventData.status = "completed"
          } catch (e) {
            console.error("Auto draw failed:", e)
          }
        }
        
        setEvent(eventData)

        // 참여자 수 가져오기
        const { count, error: countError } = await supabase
          .from("participants")
          .select("*", { count: 'exact', head: true })
          .eq("event_id", id)

        if (!countError && count !== null) {
          setParticipantCount(count)
        }

        // 내 참여 여부 확인
        const { data: myParticipation } = await supabase
          .from("participants")
          .select("is_winner")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle()

        if (myParticipation) {
          setIsParticipated(true)
          setIsWinner(myParticipation.is_winner)
        }

        // 이벤트가 종료되었다면 당첨자 목록 가져오기 (만약 방금 추첨되었다면, 다시 한 번 상태 갱신 확인을 위해 딜레이를 살짝 주거나 즉시 가져옴)
        if (currentStatus === "completed") {
          // 혹시 방금 추첨이 일어났을 수 있으므로 내 승리 여부 다시 한 번 확인
          if (myParticipation) {
            const { data: updatedMyPart } = await supabase
              .from("participants")
              .select("is_winner")
              .eq("event_id", id)
              .eq("user_id", user.id)
              .maybeSingle()
            if (updatedMyPart) {
              setIsWinner(updatedMyPart.is_winner)
            }
          }

          const { data: winnerData } = await supabase
            .from("participants")
            .select(`
              user_id,
              users ( nickname, id )
            `)
            .eq("event_id", id)
            .eq("is_winner", true)
          
          if (winnerData) {
            setWinners(winnerData)
          }
        }
      } catch (error: any) {
        toast({
          title: "데이터를 불러올 수 없습니다",
          description: error.message,
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchEventData()
    }
  }, [id, router, supabase, toast])

  const handleParticipate = async () => {
    try {
      const sessionRes = await fetch("/api/auth/session")
      if (!sessionRes.ok) throw new Error("로그인이 필요합니다.")
      const { user } = await sessionRes.json()

      const { error } = await supabase
        .from("participants")
        .insert({
          event_id: id,
          user_id: user.id
        })

      if (error) throw error

      setIsParticipated(true)
      setParticipantCount(prev => prev + 1)
      toast({
        title: "응모 완료!",
        description: "추첨에 성공적으로 참여했습니다.",
      })
    } catch (error: any) {
      toast({
        title: "참여 실패",
        description: error.code === '23505' ? "이미 참여한 추첨입니다." : error.message,
        variant: "destructive"
      })
    }
  }

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const title = `[Pick-Park] ${event?.title} 주차권 추첨`
    
    const nav = navigator as any
    if (nav.share) {
      try {
        await nav.share({
          title,
          text: event?.description,
          url,
        })
      } catch (error) {
        console.log("공유 취소됨")
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast({
        title: "링크 복사 완료",
        description: "클립보드에 추첨 링크가 복사되었습니다.",
      })
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-20">로딩 중...</div>
  }

  if (!event) {
    return <div className="text-center py-20 text-muted-foreground">이벤트를 찾을 수 없습니다.</div>
  }

  const isCompleted = event.status === "completed"

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl mb-2">{event.title}</CardTitle>
              <CardDescription className="text-base">{event.description}</CardDescription>
            </div>
            <span className={`shrink-0 text-sm px-3 py-1 rounded-full font-medium ${isCompleted ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}`}>
              {isCompleted ? '종료됨' : '진행중'}
            </span>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">현재 응모자</p>
                <p className="font-semibold">{participantCount}명</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">당첨 인원</p>
                <p className="font-semibold">{event.winner_count}명</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">추첨 종료 일시</p>
              <p className="font-medium text-sm">
                {format(new Date(event.end_at), "yyyy년 MM월 dd일 HH시 mm분", { locale: ko })}
              </p>
            </div>
          </div>

          {/* 종료 시 결과 / 당첨 여부 표시 UI */}
          {isCompleted && isParticipated && (
            <div className={`p-6 rounded-xl text-center border-2 ${isWinner ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="text-4xl mb-4">
                {isWinner ? '🎉' : '🥲'}
              </div>
              <h3 className="text-xl font-bold mb-2">
                {isWinner ? '축하합니다! 당첨되었습니다.' : '아쉽지만 미당첨입니다.'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isWinner ? '주차권 발급에 대한 안내를 기다려주세요.' : '다음 기회에 다시 도전해주세요.'}
              </p>
            </div>
          )}

          {isCompleted && winners.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" /> 
                당첨자 명단
              </h3>
              <ul className="space-y-2">
                {winners.map((winner: any, idx: number) => (
                  <li key={idx} className="p-3 bg-muted rounded-lg flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {idx + 1}
                    </div>
                    <span className="font-medium">{winner.users?.nickname}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {winner.users?.id ? (winner.users.id.substring(0, 3) + '***') : '***'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3">
          {!isCompleted && (
            <Button 
              className="w-full sm:flex-1 h-12 text-lg" 
              onClick={handleParticipate}
              disabled={isParticipated}
            >
              {isParticipated ? "응모 완료됨" : "추첨 응모하기"}
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="w-full sm:flex-1 h-12 text-lg"
            onClick={handleShare}
          >
            {typeof navigator !== "undefined" && (navigator as any).share ? (
              <><Share2 className="mr-2 h-5 w-5" /> 공유하기</>
            ) : (
              <><Copy className="mr-2 h-5 w-5" /> 링크 복사</>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
