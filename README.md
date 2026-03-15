# Pick-Park 프로젝트

이 프로젝트는 Next.js 기반의 웹 애플리케이션입니다. 사용자 인증, 이벤트 생성 및 관리, 드로우 참여 등의 기능을 제공합니다.

## 시작하기

개발 서버를 실행하려면 다음 명령을 사용하세요:

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 로 접속하여 결과를 확인할 수 있습니다.

## 주요 기능

- **사용자 인증**: Supabase를 이용한 안전한 사용자 인증 시스템.
- **이벤트 생성 및 관리**: 관리자가 이벤트를 생성하고 관리할 수 있습니다.
- **드로우 참여**: 사용자가 이벤트 드로우에 참여할 수 있습니다.
- **마이페이지**: 사용자 정보를 확인하고 관리할 수 있는 페이지.

## 프로젝트 구조

- `src/app`: Next.js 페이지 및 API 라우트.
- `src/components`: 재사용 가능한 UI 컴포넌트.
- `src/lib`: 유틸리티 함수 및 Supabase 클라이언트/서버 설정.
- `src/hooks`: 커스텀 React 훅.

## 더 알아보기

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)

## 배포

이 프로젝트는 Vercel 플랫폼에 배포할 수 있습니다.
