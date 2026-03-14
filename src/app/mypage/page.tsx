"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { LogOut, User } from "lucide-react"

export default function MyPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/session")
        if (!res.ok) {
          router.push("/login")
          return
        }
        const { user } = await res.json()
        if (user) {
          setUserId(user.id)
          setNickname(user.nickname)
        } else {
          router.push("/login")
        }
      } catch (error) {
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [router])

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" })
    })
    
    // 강제 리다이렉트를 통해 캐시를 우회하고 로그인 페이지로 즉시 이동
    window.location.href = "/login"
  }

  if (isLoading) {
    return <div className="flex justify-center py-20">로딩 중...</div>
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">내 정보</CardTitle>
          <CardDescription className="text-center">현재 로그인된 계정 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">닉네임</p>
            <p className="font-bold text-lg">{nickname}</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">로그인 아이디</p>
            <p className="font-medium">{userId}</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="destructive" className="w-full h-12" onClick={handleLogout}>
            <LogOut className="mr-2 h-5 w-5" /> 로그아웃
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
