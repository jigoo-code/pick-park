"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { LogOut, User, Check, Edit2, Upload } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function MyPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string>("")
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

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
          setNickname(user.nickname || "")
          // 프로필 이미지 URL 가져오기 (DB에서 직접 가져오기)
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("profile_image_url")
            .eq("id", user.id)
            .single()
          
          if (!userError && userData) {
            setProfileImageUrl(userData.profile_image_url)
          }
        } else {
          router.push("/login")
        }
      } catch (err) {
        console.error("Error fetching user session or profile:", err)
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [router, supabase])

  const handleUpdateNickname = async () => {
    if (!nickname.trim()) return
    if (!userId) return

    setIsUpdating(true)
    try {
      // 1. DB 업데이트
      const { error } = await supabase
        .from("users")
        .update({ nickname })
        .eq("id", userId)

      if (error) throw error

      toast({
        title: "수정 완료",
        description: "닉네임이 성공적으로 변경되었습니다. (변경 사항 반영을 위해 재로그인을 권장합니다.)",
      })
      setIsEditing(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "오류가 발생했습니다."
      toast({
        title: "수정 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleProfileImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return
    const file = event.target.files[0]

    if (!userId) return

    setIsUpdating(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      // 클라이언트에서 직접 Supabase Storage 업로드 대신, 백엔드 API 호출 (RLS 우회)
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "업로드 실패")
      }

      const { publicUrl } = await response.json()

      setProfileImageUrl(publicUrl) // UI 업데이트
      toast({
        title: "프로필 사진 업데이트",
        description: "프로필 사진이 성공적으로 변경되었습니다.",
      })
    } catch (error: any) {
      toast({
        title: "사진 업로드 실패",
        description: error.message || "오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

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
          <div className="flex justify-center mb-4 relative group">
            <Avatar className="h-24 w-24 border-4 border-lig/50 shadow-lg">
              <AvatarImage src={profileImageUrl || ""} alt="프로필 이미지" />
              <AvatarFallback className="bg-lig/20 text-lig text-2xl font-bold">
                {nickname ? nickname[0].toUpperCase() : <User className="h-12 w-12" />}
              </AvatarFallback>
            </Avatar>
            <label htmlFor="profile-image-upload" className="absolute bottom-0 right-0 p-2 bg-lig text-white rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md">
              <Upload className="h-4 w-4" />
              <input 
                id="profile-image-upload" 
                type="file" 
                accept="image/*" 
                onChange={handleProfileImageChange} 
                className="hidden"
                disabled={isUpdating}
              />
            </label>
          </div>
          <CardTitle className="text-center text-2xl font-bold text-lig">내 정보</CardTitle>
          <CardDescription className="text-center">현재 로그인된 계정 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {/* 닉네임 박스 (수정 가능) */}
          <div className="p-4 border rounded-lg shadow-sm bg-background">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">닉네임</p>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div className="flex w-full gap-2">
                  <Input 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value)} 
                    className="text-center font-bold text-lg border-lig focus-visible:ring-lig"
                    autoFocus
                  />
                  <Button size="icon" className="bg-lig hover:bg-lig/90 shrink-0" onClick={handleUpdateNickname} disabled={isUpdating}>
                    <Check className="h-4 w-4 text-white" />
                  </Button>
                </div>
              ) : (
                <div className="flex w-full items-center justify-center relative group min-h-[40px]">
                  <span className="font-bold text-xl text-foreground">{nickname}</span>
                  <button 
                    onClick={() => setIsEditing(true)} 
                    className="ml-2 p-1 text-muted-foreground hover:text-lig hover:bg-lig/5 rounded-full transition-all"
                    title="닉네임 수정"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 로그인 아이디 박스 (읽기 전용) */} 
          <div className="p-4 border rounded-lg shadow-sm bg-muted/20">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">로그인 아이디</p>
            <p className="font-medium text-lg text-foreground/80">{userId}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 mt-2">
          <Button variant="ghost" className="w-full h-12 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={handleLogout}>
            <LogOut className="mr-2 h-5 w-5" /> 로그아웃
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}