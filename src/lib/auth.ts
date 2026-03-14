import { cookies } from "next/headers"

export interface UserSession {
  id: string
  nickname: string
}

// 서버 컴포넌트(Server Component) 또는 API Route에서 사용할 수 있습니다.
export function getUserSession(): UserSession | null {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get("custom_session")?.value

  if (!sessionCookie) return null

  try {
    const user = JSON.parse(sessionCookie)
    return user as UserSession
  } catch (e) {
    return null
  }
}
