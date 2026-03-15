-- =======================================================
-- Pick-Park (주차권 추첨 앱) Supabase Custom Auth 스키마
-- =======================================================
-- 기존 Supabase Auth를 사용하지 않고 public.users를 완전히 독립적인 테이블로 구성합니다.

-- 기존 테이블 및 정책들 모두 삭제 (초기화를 위함)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.raffle_events CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. 사용자 (Users) 테이블 (아이디, 비밀번호, 닉네임)
-- id를 UUID 대신 사용자가 입력하는 "문자열(아이디)"로 변경합니다.
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  password TEXT NOT NULL, -- 비밀번호 암호화 저장
  nickname TEXT NOT NULL,
  profile_image_url TEXT, -- 프로필 이미지 URL 추가
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(\'utc\'::text, now()) NOT NULL
);

-- 2. 추첨 이벤트 (Raffle_Events) 테이블 생성
CREATE TABLE public.raffle_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id TEXT REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  winner_count INTEGER NOT NULL CHECK (winner_count > 0),
  items JSONB DEFAULT '[]'::jsonb NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 참여자 (Participants) 테이블 생성
CREATE TABLE public.participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.raffle_events(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  is_winner BOOLEAN DEFAULT false,
  is_business_trip BOOLEAN DEFAULT false, -- 출장자 여부 컬럼 추가
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, user_id)
);

-- =======================================================
-- ROW LEVEL SECURITY (RLS) 정책 비활성화
-- 커스텀 Auth를 이용하므로, 서버사이드 API에서 검증하거나
-- 현재처럼 테스트용이성을 위해 RLS를 모두 허용/비활성화 합니다.
-- =======================================================

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants DISABLE ROW LEVEL SECURITY;
