# LUMOS MVP — Task Breakdown

> **기획서**: `IMPLEMENTATION_SPEC.md`
> **목표**: 오늘 밤 MVP 완성
> **핵심**: Case CRUD, Task CRUD, Artifact, Discussion, Weekly, Note 에디터, 대시보드

---

## Phase 0: 프로젝트 초기화

- [x] **T0.1** Vite + React + TypeScript 프로젝트 생성
- [x] **T0.2** 핵심 의존성 설치 (react-router-dom, uuid, tiptap 패키지들)
- [x] **T0.3** 폴더 구조 생성 (features/, store/, types/, styles/, components/)
- [x] **T0.4** TypeScript 타입 정의 (Case, Task, Artifact, Discussion, Weekly, Note, Member)
- [ ] **T0.5** CSS 변수 + 다크 모드 글로벌 스타일 설정
- [ ] **T0.6** React Router 라우팅 셸 설정 (/, /app, /app/cases, etc.)
- [ ] **T0.7** 앱 레이아웃 (Sidebar + Main Content 셸)

## Phase 1: 데이터 레이어

- [ ] **T1.1** localStorage 기반 store 구현 (CRUD 헬퍼 함수)
  - `getAll<T>`, `getById<T>`, `create<T>`, `update<T>`, `remove<T>`
- [ ] **T1.2** 초기 시드 데이터 (샘플 Member 7명, 샘플 Case 1개)
- [ ] **T1.3** 스토어 hooks 구현 (`useCases`, `useTasks`, `useWeekly`, `useNotes`, `useMembers`)

## Phase 2: 공통 컴포넌트

- [ ] **T2.1** Sidebar 네비게이션 (Dashboard, Cases, Weekly, Notes 링크)
- [ ] **T2.2** StatusBadge (Open/InProgress/Review/Closed 색상 코드)
- [ ] **T2.3** PriorityBadge (High/Medium/Low)
- [ ] **T2.4** TaskLabelBadge (분석/개발/조사/운영)
- [ ] **T2.5** MemberAvatar (이니셜 아바타)
- [ ] **T2.6** EmptyState 컴포넌트 ("아직 없음" 표시)
- [ ] **T2.7** Modal / Dialog 컴포넌트

## Phase 3: Cases 기능

- [ ] **T3.1** 케이스 목록 페이지 (`/app/cases`)
  - 케이스 카드 리스트, 상태 필터, 새 케이스 생성 버튼
- [ ] **T3.2** 케이스 생성 모달 (title, priority, description)
- [ ] **T3.3** 케이스 상세 페이지 (`/app/cases/:id`)
  - Overview 섹션 (제목, 상태 전환, 우선순위, 설명)
- [ ] **T3.4** 케이스 상세 — Tasks 탭
  - Task 목록, Task 추가, assignee 배정, label, status 변경
- [ ] **T3.5** 케이스 상세 — Artifacts 탭
  - Artifact 추가 (링크/메모), 목록 표시
- [ ] **T3.6** 케이스 상세 — Discussion 탭
  - 코멘트 작성/목록 (Markdown 지원)

## Phase 4: Weekly 기능

- [ ] **T4.1** 주간 보드 페이지 (`/app/weekly`)
  - 주차 선택 (이번 주 / 지난 주 조회)
- [ ] **T4.2** 이번 주 목표 섹션 (추가/수정/삭제)
- [ ] **T4.3** 팀원별 할 일 섹션 (assignee별 Task 그룹핑)
- [ ] **T4.4** 멘토링 섹션 (agenda, feedback 입력, action items)
- [ ] **T4.5** Carry-over 섹션 (다음 주 이관 항목)

## Phase 5: Notes 기능 (Notion 대체)

- [ ] **T5.1** 노트 목록 페이지 (`/app/notes`)
  - 노트 카드 리스트, 새 노트 생성
- [ ] **T5.2** Tiptap 에디터 셋업 (Planfit RichEditor 패턴 레퍼런스)
  - StarterKit, Table, Image, Link, Highlight, Placeholder, TaskList
  - 슬래시 커맨드, 한글 IME, Debounced 저장
- [ ] **T5.3** 노트 에디터 페이지 (`/app/notes/:id`)
  - 제목 입력, 에디터 영역, 자동 저장
  - Case/Weekly 연결 (optional select)
- [ ] **T5.4** 노트 상태 관리 (draft/published)

## Phase 6: 대시보드

- [ ] **T6.1** 메인 대시보드 페이지 (`/app`)
  - 이번 주 하이라이트 (Weekly goals)
  - 활성 케이스 요약 (상태별 카운트)
  - 내 할 일 (특정 멤버 필터 — MVP에서는 첫 번째 멤버 하드코딩)
  - 최근 활동 피드

## Phase 7: 통합 + Polish

- [ ] **T7.1** 전체 라우팅 연결 확인
- [ ] **T7.2** 반짝이는 빈 상태(empty state) 대응
- [ ] **T7.3** 랜딩 페이지 (`/`) — 최소 소개 + /app 리디렉트
- [ ] **T7.4** 빌드 성공 확인 (`npm run build`)
- [ ] **T7.5** 브라우저 테스트 (핵심 플로우: 케이스 생성 → Task 추가 → 상태 변경)

---

## 병렬 작업 가능 단위

Phase 0~1 완료 후, 아래 3개를 병렬 진행 가능:

```
[Phase 0+1: 기반] → ┬→ [Phase 3: Cases]
                     ├→ [Phase 4: Weekly]
                     ├→ [Phase 5: Notes]
                     └→ [Phase 6: Dashboard] (Phase 3~5 데이터 의존)
```

- Phase 2 (공통 컴포넌트)는 Phase 3~5에서 필요할 때 같이 만듦
- Phase 6 (대시보드)는 Cases/Weekly 데이터가 필요하므로 마지막
- Phase 7은 최종 통합

---

## 완료 기준

- [ ] `/app` 대시보드에서 활성 케이스와 내 할 일 확인 가능
- [ ] `/app/cases` 에서 케이스 생성/조회/상태 변경 가능
- [ ] `/app/cases/:id` 에서 Task 추가/배정/완료, Artifact 첨부, Discussion 코멘트 가능
- [ ] `/app/weekly` 에서 이번 주 목표 설정, 팀원별 할 일 확인, 멘토링 메모 가능
- [ ] `/app/notes/:id` 에서 Tiptap 에디터로 문서 작성/저장 가능
- [ ] `npm run build` 성공
