import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // custom_session 쿠키 존재 여부로 인증 상태 확인
  const sessionCookie = request.cookies.get("custom_session")?.value
  const user = sessionCookie ? JSON.parse(sessionCookie) : null

  // 로그인 페이지 및 Cron API 등 인증이 필요 없는 경로
  const isAuthPage = request.nextUrl.pathname.startsWith("/login")
  const isCronPath = request.nextUrl.pathname.startsWith("/api/cron")

  if (!user && !isAuthPage && !isCronPath) {
    // 인증되지 않은 사용자가 보호된 페이지에 접근할 때 로그인으로 리다이렉트
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user && isAuthPage) {
    // 이미 로그인한 사용자가 로그인 페이지에 접근하면 홈으로 리다이렉트
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (인증 API 자체는 보호 대상에서 제외)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
