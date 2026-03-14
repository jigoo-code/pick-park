import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const { action, userId, password, nickname } = await request.json()
    const cookieStore = cookies()

    if (action === "logout") {
      cookieStore.delete("custom_session")
      return NextResponse.json({ success: true })
    }

    if (!userId || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 })
    }

    if (action === "signup") {
      if (!nickname) {
        return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 })
      }

      // 아이디 중복 체크
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single()

      if (existingUser) {
        return NextResponse.json({ error: "이미 존재하는 아이디입니다." }, { status: 400 })
      }

      // 평문 비밀번호 저장 (단순 데모/테스트 목적, 실제 서비스에선 bcrypt 등으로 해싱 필요)
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: userId,
          password: password,
          nickname: nickname,
        })

      if (insertError) throw insertError

      return NextResponse.json({ success: true, message: "회원가입 완료" })

    } else if (action === "login") {
      // 사용자 확인
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .eq("password", password)
        .single()

      if (error || !user) {
        return NextResponse.json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." }, { status: 401 })
      }

      // 커스텀 세션 쿠키 발급 (간단하게 사용자 객체 문자열 저장)
      const sessionData = JSON.stringify({ id: user.id, nickname: user.nickname })
      cookieStore.set("custom_session", sessionData, {
        httpOnly: false, // 클라이언트(document.cookie)에서 접근 가능하게 변경
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 7일
      })

      return NextResponse.json({ success: true, user: { id: user.id, nickname: user.nickname } })
    }

    return NextResponse.json({ error: "잘못된 액션입니다." }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
