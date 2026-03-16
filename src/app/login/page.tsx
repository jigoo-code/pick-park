"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { CarFront } from "lucide-react"

export default function LoginPage() {
  const [userId, setUserId] = useState("")
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isLoginMode ? "login" : "signup",
          userId,
          password,
          nickname: !isLoginMode ? nickname : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "오류가 발생했습니다.")
      }

      if (!isLoginMode) {
        toast({
          title: "회원가입 완료!",
          description: "이제 로그인해주세요.",
        })
        setIsLoginMode(true) // 가입 후 로그인 폼으로 전환
      } else {
        toast({
          title: "로그인 성공",
          description: `환영합니다, ${data.user.nickname}님!`,
        })
        router.push("/")
        router.refresh()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "오류가 발생했습니다."
      toast({
        title: isLoginMode ? "로그인 실패" : "회원가입 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <CarFront className="h-12 w-12 text-lig" />
          </div>
          <CardTitle className="text-2xl font-bold text-center leading-tight">미사일 핵심 기술 연구소 4팀</CardTitle>
          <CardDescription>주차권 추첨 시스템에 오신 것을 환영합니다</CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">아이디</Label>
              <Input
                id="userId"
                type="text"
                placeholder="아이디를 입력하세요"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            
            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="nickname">닉네임</Label>
                <Input
                  id="nickname"
                  type="text"
                  placeholder="사용할 닉네임을 입력하세요"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isLoading}
                  required={!isLoginMode}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              className="w-full bg-lig hover:bg-lig/90 text-white border-none font-bold"
              type="submit"
              disabled={isLoading || !userId || !password || (!isLoginMode && !nickname)}
            >
              {isLoginMode ? "로그인" : "회원가입 완료"}
            </Button>
            
            <div className="text-center text-sm text-muted-foreground w-full">
              {isLoginMode ? (
                <span>
                  계정이 없으신가요?{" "}
                  <button type="button" onClick={() => setIsLoginMode(false)} className="text-primary font-medium hover:underline">
                    회원가입
                  </button>
                </span>
              ) : (
                <span>
                  이미 계정이 있으신가요?{" "}
                  <button type="button" onClick={() => setIsLoginMode(true)} className="text-primary font-medium hover:underline">
                    로그인
                  </button>
                </span>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
