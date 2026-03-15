import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getUserSession } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    // 1. 커스텀 세션 확인
    const user = getUserSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. 폼 데이터(파일) 받기
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // 3. 서버 권한의 Supabase 클라이언트 생성
    const supabaseAdmin = createAdminClient()
    const userId = user.id

    // 파일 이름 안전하게 처리
    const fileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")
    const filePath = `${userId}/${Date.now()}_${fileName}`

    // 4. Storage에 파일 업로드 (RLS 우회)
    const { error: uploadError } = await supabaseAdmin.storage
      .from("profile-images")
      .upload(filePath, file, { cacheControl: "3600", upsert: false })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
    }

    // 5. 공개 URL 가져오기
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("profile-images")
      .getPublicUrl(filePath)

    // 6. users 테이블에 URL 업데이트 (RLS 우회)
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ profile_image_url: publicUrl })
      .eq("id", userId)

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update profile image url" }, { status: 500 })
    }

    return NextResponse.json({ publicUrl })

  } catch (error: any) {
    console.error("Upload API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
