"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Share2, Copy, Users, Calendar, Trophy, User } from "lucide-react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
  const params = useParams()
  const id = params?.id as string
  const [event, setEvent] = useState<EventData | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [isParticipated, setIsParticipated] = useState(false)
  const [isBusinessTrip, setIsBusinessTrip] = useState(false)
  const [isWinner, setIsWinner] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [winners, setWinners] = useState<any[]>([])
  const [allParticipants, setAllParticipants] = useState<any[]>([])
  
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

        // 모든 응모자 리스트 가져오기 (이벤트 상세 정보보다 먼저 로드)
        const { data: participantsData, error: participantsFetchError } = await supabase
            .from("participants")
            .select(`
              is_business_trip,
              users ( nickname, id, profile_image_url )
            `)
            .eq("event_id", id)
            .order("created_at", { ascending: true })

        if (participantsFetchError) {
          console.error("Error fetching participants:", participantsFetchError)
        }
        
        if (participantsData) {
          setAllParticipants(participantsData)
        }

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

        // 이벤트가 종료되었다면 당첨자 목록 가져오기
        if (currentStatus === "completed") {
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
              users ( nickname, id, profile_image_url )
            `)
            .eq("event_id", id)
            .eq("is_winner", true)
          
          if (winnerData) {
            setWinners(winnerData)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류"
        toast({
          title: "데이터를 불러올 수 없습니다",
          description: message,
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
          user_id: user.id,
          is_business_trip: isBusinessTrip
        })

      if (error) throw error

      setIsParticipated(true)
      setParticipantCount(prev => prev + 1)
      
      // 내 응모 정보를 리스트에 즉시 반영 (낙관적 업데이트)
      setAllParticipants(prev => [
        ...prev, 
        { 
          is_business_trip: isBusinessTrip, 
          users: { nickname: user.nickname, id: user.id } 
        }
      ])

      toast({
        title: "응모 완료!",
        description: "추첨에 성공적으로 참여했습니다.",
      })
    } catch (error) {
      const err = error as any
      toast({
        title: "참여 실패",
        description: err.code === '23505' ? "이미 참여한 추첨입니다." : (err.message || "오류가 발생했습니다."),
        variant: "destructive"
      })
    }
  }

  const handleCancelParticipate = async () => {
    if (!confirm("정말로 응모를 취소하시겠습니까?")) return

    try {
      const sessionRes = await fetch("/api/auth/session")
      if (!sessionRes.ok) throw new Error("로그인이 필요합니다.")
      const { user } = await sessionRes.json()

      const { error } = await supabase
        .from("participants")
        .delete()
        .eq("event_id", id)
        .eq("user_id", user.id)

      if (error) throw error

      setIsParticipated(false)
      setParticipantCount(prev => Math.max(0, prev - 1))
      
      // 리스트에서 내 정보 제거 (낙관적 업데이트)
      setAllParticipants(prev => prev.filter(p => p.users?.id !== user.id))

      toast({
        title: "응모 취소 완료",
        description: "추첨 응모가 취소되었습니다.",
      })
    } catch (error) {
      toast({
        title: "취소 실패",
        description: "오류가 발생했습니다. 다시 시도해 주세요.",
        variant: "destructive"
      })
    }
  }

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const title = `[미사일 핵심 기술 연구소 4팀] ${event?.title} 추첨`
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              <Users className="h-5 w-5 text-lig" />
              <div>
                <p className="text-xs text-muted-foreground">현재 응모자</p>
                <p className="font-semibold">{participantCount}명</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Trophy className="h-5 w-5 text-lig" />
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

          {isCompleted && isParticipated && (
            <div className={`p-6 rounded-xl text-center border-2 ${isWinner ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="text-4xl mb-4">
                {isWinner ? '🎉' : '🥲'}
              </div>
              <h3 className="text-xl font-bold mb-2">
                {isWinner ? '축하합니다! 당첨되었습니다.' : '아쉽지만 미당첨입니다.'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isWinner ? '당첨 안내를 확인해 주세요.' : '다음 기회에 다시 도전해 주세요.'}
              </p>
            </div>
          )}

          {isCompleted && winners.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-lig">
                <Trophy className="h-5 w-5" /> 
                당첨자 명단
              </h3>
              <ul className="space-y-2">
                {winners.map((winner: any, idx: number) => (
                  <li key={idx} className="p-3 bg-lig/5 border border-lig/20 rounded-lg flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={winner.users?.profile_image_url || ""} alt={winner.users?.nickname || ""} />
                      <AvatarFallback className="bg-lig/20 text-lig text-xs font-bold">
                        {winner.users?.nickname ? winner.users.nickname[0].toUpperCase() : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-lig">{winner.users?.nickname}</span>
                    <span className="text-[10px] bg-lig text-white px-1.5 py-0.5 rounded ml-1">당첨</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {winner.users?.id ? (String(winner.users.id).substring(0, 3) + '***') : '***'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 전체 응모자 리스트 표시 (추가된 기능) */}
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              전체 응모 현황 ({participantCount}명)
            </h3>
            {allParticipants.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allParticipants.map((participant: any, idx: number) => {
                  const user = participant.users
                  if (!user || !user.nickname) return null
                  return (
                    <div key={idx} className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-md border border-dashed border-muted-foreground/20">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.profile_image_url || ""} alt={user.nickname || ""} />
                        <AvatarFallback className="bg-muted/60 text-muted-foreground text-xs font-bold">
                          {user.nickname ? user.nickname[0].toUpperCase() : <User className="h-3 w-3" />}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">{user.nickname}</span>
                      {participant.is_business_trip && (
                        <span className="text-[10px] font-bold bg-blue-100 text-lig px-1.5 py-0.5 rounded border border-blue-200">
                          출장자
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                아직 응모자가 없습니다.
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t pt-6">
          {!isCompleted && !isParticipated && (
            <div className="flex items-center space-x-3 bg-blue-50 p-4 rounded-lg border border-blue-100 w-full">
              <input
                type="checkbox"
                id="business_trip"
                className="h-5 w-5 rounded border-gray-300 text-lig focus:ring-lig cursor-pointer"
                checked={isBusinessTrip}
                onChange={(e) => setIsBusinessTrip(e.target.checked)}
              />
              <label
                htmlFor="business_trip"
                className="text-sm font-bold text-lig cursor-pointer"
              >
                이번 주 출장자입니다 (우선 당첨 대상)
              </label>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            {!isCompleted && !isParticipated && (
              <Button 
                className="w-full sm:flex-1 h-12 text-lg font-bold shadow-md active:scale-95 transition-transform bg-lig hover:bg-lig/90 text-white border-none" 
                onClick={handleParticipate}
              >
                추첨 응모하기
              </Button>
            )}

            {!isCompleted && isParticipated && (
              <Button 
                className="w-full sm:flex-1 h-12 text-lg font-bold shadow-md active:scale-95 transition-transform bg-red-600 hover:bg-red-700 text-white border-none" 
                onClick={handleCancelParticipate}
              >
                응모 취소하기
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
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
