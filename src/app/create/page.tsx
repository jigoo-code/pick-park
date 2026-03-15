"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2 } from "lucide-react"

export default function CreateEventPage() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [endAtDate, setEndAtDate] = useState("")
  const [endAtTime, setEndAtTime] = useState("")
  const [winnerCount, setWinnerCount] = useState(1)
  const [items, setItems] = useState<string[]>([""])
  const [isLoading, setIsLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const addItem = () => setItems([...items, ""])
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }
  const updateItem = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = value
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // API를 통해 안전하게 서버에서 세션 파싱
      const sessionRes = await fetch("/api/auth/session")
      if (!sessionRes.ok) throw new Error("로그인이 필요합니다.")
      
      const { user } = await sessionRes.json()
      if (!user || !user.id) throw new Error("로그인이 필요합니다.")

      const endAt = new Date(`${endAtDate}T${endAtTime}`).toISOString()
      const validItems = items.filter(item => item.trim() !== "")

      if (validItems.length === 0) {
        throw new Error("최소 1개 이상의 추첨 항목을 입력해주세요.")
      }

      const { data, error } = await supabase
        .from("raffle_events")
        .insert({
          creator_id: user.id,
          title,
          description,
          end_at: endAt,
          winner_count: winnerCount,
          items: validItems
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "이벤트 생성 완료",
        description: "추첨 이벤트가 성공적으로 만들어졌습니다.",
      })
      router.push(`/events/${data.id}`)
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>새 추첨 만들기</CardTitle>
          <CardDescription>추첨 이벤트의 상세 정보를 입력해주세요.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">이벤트 제목 *</Label>
              <Input
                id="title"
                placeholder="예: 4월 첫째 주 지하주차장 추첨"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Input
                id="description"
                placeholder="간단한 안내 사항을 적어주세요."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">종료 날짜 *</Label>
                <Input
                  id="date"
                  type="date"
                  value={endAtDate}
                  onChange={(e) => setEndAtDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">종료 시간 *</Label>
                <Input
                  id="time"
                  type="time"
                  value={endAtTime}
                  onChange={(e) => setEndAtTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="winnerCount">당첨 인원 수 *</Label>
              <Input
                id="winnerCount"
                type="number"
                min="1"
                value={winnerCount}
                onChange={(e) => setWinnerCount(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>추첨 항목 (주차 구역 등) *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  항목 추가
                </Button>
              </div>
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={`예: B1-0${index + 1}`}
                    value={item}
                    onChange={(e) => updateItem(index, e.target.value)}
                    required
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold bg-lig hover:bg-lig/90 text-white shadow-md active:scale-95 transition-all" 
              disabled={isLoading}
            >
              {isLoading ? "생성 중..." : "이벤트 생성 완료"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
