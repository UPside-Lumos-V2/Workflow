# PROJECT CONTEXT

## Overview
- **프로젝트명**: LUMOS 내부 협업 플랫폼
- **한 줄 정의**: exploit 분석 케이스를 중심으로 팀 운영·기록·추적을 한 곳에서 하는 내부 협업 워크스페이스
- **팀 규모**: 7명
- **기획서**: `IMPLEMENTATION_SPEC.md`

## Tech Stack
- **Framework**: React 18 + Vite
- **Language**: TypeScript (strict, ESM)
- **Styling**: Vanilla CSS (다크 모드 기본, CSS 변수)
- **Database**: localStorage (MVP) → Supabase (Post-MVP)
- **Editor**: Tiptap (Planfit journal 패턴 레퍼런스)
- **Routing**: React Router v6
- **Other**: uuid (ID 생성)

## Architecture
- **Pattern**: Feature-based (도메인별 분리)
- **핵심 원칙**: Case-First, Single Source of Truth, 유동적 구조

### Folder Structure
```
src/
├── components/        # 공통 UI (Layout, Sidebar, StatusBadge)
├── features/
│   ├── dashboard/     # /app 메인 대시보드
│   ├── cases/         # /app/cases, /app/cases/:id
│   ├── weekly/        # /app/weekly 주간 운영 보드
│   └── notes/         # /app/notes, /app/notes/:id
├── store/             # localStorage 기반 데이터 레이어
├── types/             # 공통 타입 (Case, Task, Artifact, etc.)
├── hooks/             # 공통 커스텀 훅
├── styles/            # 글로벌 CSS, 변수, 테마
├── App.tsx            # 라우터 설정
└── main.tsx           # 진입점
```

## URL Structure
```
/                    → 최소 랜딩 → /app 리디렉트
/app                 → 메인 대시보드
/app/cases           → 케이스 목록
/app/cases/:id       → 케이스 상세
/app/weekly          → 주간 운영 보드
/app/notes           → 노트 목록
/app/notes/:id       → 노트 에디터
```

## Data Model (Core Entities)
- **Case**: exploit 단위 컨테이너 (status: Open/InProgress/Review/Closed)
- **Task**: Case 내 실행 단위 (assignee, label: 분석/개발/조사/운영)
- **Artifact**: 산출물 (file/link/code)
- **Discussion**: 코멘트/논의
- **Weekly**: 주간 운영 (goals, mentoring, carry-over)
- **Note**: 독립 문서 (Tiptap HTML, Notion 대체)
- **Member**: 팀원

## Commands

| Purpose | Command | What it does | Coverage |
|---------|---------|--------------|----------|
| Dev | `npm run dev` | Vite dev server | - |
| Build | `npm run build` | TypeScript check + Vite build | 전체 |
| Lint | `npx tsc --noEmit` | Type checking | src/**/*.ts(x) |
| Preview | `npm run preview` | 빌드 결과 미리보기 | - |

### Testing Strategy

```
[Type Check]     → tsc --noEmit
       ↓
[Build]          → vite build
       ↓
[Browser Test]   → browser_subagent (핵심 플로우)
```

**MVP 단계 테스트**: 타입 체크 + 빌드 성공 + 브라우저 수동 확인

## Design Principles
- **다크 모드 기본**: Analysis Workspace 톤
- **정보 밀도**: Linear/GitHub Issues 수준
- **3초 원칙**: 진입 후 3초 내 "내 할 일" 파악
- **상태 색상**: Open=blue, InProgress=amber, Review=purple, Closed=green

## Planfit Reference
- **경로**: `/Users/heosehyeon/프로젝트/Vive_Coding/일정관리웹/Planfit`
- **활용 범위**: Tiptap RichEditor, IME 처리, Debounce, StatusPicker, PageCard
- **미활용**: PDF Export, E2EE, Graph View, Privy 인증

## Known Issues
- (없음 — 신규 프로젝트)

---
*This file is referenced by the agent at session start.*
*Commands section is linked to `/verify` workflow.*
