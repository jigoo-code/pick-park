"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { CarFront, User, PlusCircle, Home, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function Navigation() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { toast } = useToast()

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" })
    })
    
    // Next.js 라우터 캐시를 무시하고 확실하게 로그인 페이지로 강제 이동시킵니다.
    window.location.href = "/login"
  }

  return (
    <>
      {/* PC: 상단 내비게이션 바 */}
      <nav className="hidden md:flex fixed top-0 w-full h-16 border-b bg-background/95 backdrop-blur z-50 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-lig">
          <CarFront className="h-6 w-6" />
          <span>미사일 핵심 기술 연구소 4팀</span>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-primary transition-colors">홈</Link>
          <Link href="/create" className="hover:text-primary transition-colors">추첨 만들기</Link>
          <Link href="/mypage" className="hover:text-primary transition-colors">내 정보</Link>
          <button onClick={handleLogout} className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="h-4 w-4" />
            <span>로그아웃</span>
          </button>
        </div>
      </nav>

      {/* Mobile: 상단 헤더 */}
      <header className="md:hidden fixed top-0 w-full h-14 border-b bg-background/95 backdrop-blur z-50 flex items-center justify-between px-4">
        <div className="w-8"></div> {/* 좌측 여백(정렬용) */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-lig">
          <CarFront className="h-5 w-5" />
          <span className="text-sm">미사일 핵심 기술 연구소 4팀</span>
        </Link>
        <button onClick={handleLogout} className="w-8 flex justify-end text-muted-foreground hover:text-destructive transition-colors" aria-label="로그아웃">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile: 하단 탭 바 (Mobile-First) */}
      <nav className="md:hidden fixed bottom-0 w-full h-16 border-t bg-background/95 backdrop-blur z-50 flex items-center justify-around pb-safe">
        <Link href="/" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors min-w-[44px] min-h-[44px] justify-center active:scale-95">
          <Home className="h-5 w-5" />
          <span className="text-[10px]">홈</span>
        </Link>
        <Link href="/create" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors min-w-[44px] min-h-[44px] justify-center active:scale-95">
          <PlusCircle className="h-5 w-5" />
          <span className="text-[10px]">만들기</span>
        </Link>
        <Link href="/mypage" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors min-w-[44px] min-h-[44px] justify-center active:scale-95">
          <User className="h-5 w-5" />
          <span className="text-[10px]">내 정보</span>
        </Link>
      </nav>
    </>
  )
}
