# LUMOS 고도화 로드맵 (MVP 이후)

MVP에서 의도적으로 단순하게 만든 것들과, 이후 단계에서 구현할 기능을 정리합니다.

---

## 1. 에디터 고도화

### 현재 (MVP)
- Notes: plain textarea
- Discussion: textarea + 간단 regex Markdown 렌더링
- Case description: 일반 input/textarea

### 고도화
- **Notes → Tiptap 에디터**
  - StarterKit (heading, bold, italic, lists, blockquote)
  - Table 확장
  - Image 삽입 (Supabase Storage)
  - Link 자동 감지
  - Highlight, TaskList (체크리스트)
  - Placeholder ("/ 를 입력하여 명령어 사용")
  - 슬래시 커맨드 (/, heading, list, code 등)
  - 한글 IME 안정화 (Planfit 패턴 참고)
  - Debounced 자동 저장 (2초 유휴 시 저장)
- **Discussion → GitHub 스타일 입력**
  - 작은 툴바 (Bold, Code, Link 버튼)
  - Markdown preview 토글
  - 파일 드래그앤드롭 첨부
- **Case description → 가벼운 리치 텍스트**
  - Tiptap minimal (bold, link 정도)

### 참고 레퍼런스
| 용도 | 라이브러리 | 비고 |
|------|-----------|------|
| Notes | [Tiptap](https://github.com/ueberdosis/tiptap) | 이미 결정 |
| Notion-like | [BlockNote](https://github.com/TypeCellOS/BlockNote) | Notes를 block editor로 키울 때 |
| Discussion | GitHub Markdown editor 방식 | 자체 구현 |

---

## 2. 케이스 자동화 (Phase 0 연동)

### 현재 (MVP)
- 케이스는 수동으로 생성/관리

### 고도화
- **SNS/온체인 시그널 자동 감지** → 케이스 자동 생성
- **자동 메타데이터 파싱** (protocol, chain, txHash, lossUsd)
- **자동 Task 템플릿** (사고 유형별 Task 세트 자동 생성)
- **사고 분류 AI** (공격 벡터 자동 분류)
- 참고: `/Users/heosehyeon/.gemini/antigravity/knowledge/defi_security_incident_automation/`

---

## 3. 대시보드 고도화

### 현재 (MVP → Phase 6)
- 이번 주 목표, 활성 케이스 카운트, 미완료 Task, 최근 활동

### 고도화
- **차트/시각화** (Chart.js or Recharts)
  - 주간 Task 완료율 추이
  - 케이스 상태 분포 파이 차트
  - 팀원별 기여도 바 차트
- **알림 피드** (새 코멘트, 상태 변경 등)
- **위젯 커스터마이징** (사용자별 대시보드 레이아웃)

---

## 4. 주간 보드 고도화

### 현재 (MVP)
- 팀원별 할 일은 수동 입력
- Carry-over는 수동 작성

### 고도화
- **Carry-over 자동화** — 이전 주 미완료 목표를 자동으로 다음 주로 이월
- **주간 보고서 PDF 내보내기**
- **멘토링 기록 히스토리** — 과거 멘토링 전체 보기
- **팀원별 할 일 ↔ 케이스 Task 연결** (자동화 이후)

---

## 5. 실시간 동기화

### 현재 (MVP)
- 페이지 로드 시 1회 fetch, CRUD 후 로컬 state 갱신
- 여러 팀원이 동시에 수정하면 덮어쓰기 가능

### 고도화
- **Supabase Realtime** 구독
  - `lumos_cases`, `lumos_tasks`, `lumos_discussions` 변경 실시간 반영
  - 다른 팀원의 코멘트 실시간 표시
- **Optimistic UI** — 로컬 즉시 반영 + 서버 확인 후 롤백
- **동시 편집 충돌 감지** (last-write-wins → merge 전략)

---

## 6. 배포 + 인프라

### 현재 (MVP)
- localhost:5180 개발 서버

### 고도화
- **Vercel 배포**
  - SPA 라우팅 (`vercel.json` rewrites)
  - 환경 변수 설정
  - 프리뷰 배포 (PR별)
- **SEO / OG 태그** (로그인 페이지용)
- **커스텀 도메인** 연결
- **Supabase Auth 리다이렉트 URL** — 프로덕션 URL 추가

---

## 7. 모바일 대응

### 현재 (MVP)
- 데스크톱 전용 레이아웃

### 고도화
- **반응형 사이드바** (모바일에서 햄버거 메뉴)
- **터치 최적화** (버튼 크기, 스크롤 영역)
- **PWA** (오프라인 캐싱, 홈 화면 추가)

---

## 8. Discussion 고도화

### 현재 (MVP)
- plain text 입력, 간단 regex Markdown 렌더링 (**bold**, `code`, [link])

### 고도화
- **반응 (리액션)** — 코멘트에 👍 등 이모지 반응
- **스레드** — 코멘트에 답글 달기
- **멘션** — @팀원이름으로 알림
- **파일 첨부** — 이미지/파일 업로드 (Supabase Storage)
- **코멘트 수정/삭제**

---

## 9. 검색 + 필터 고도화

### 현재 (MVP)
- 케이스: 상태 필터만
- 노트: 상태 필터만

### 고도화
- **전체 검색** (케이스, 노트, Discussion 통합)
- **태그 필터** (노트 태그로 필터링)
- **날짜 범위 필터**
- **팀원별 필터** (assignee, author)

---

## 우선순위 추천

| 순위 | 항목 | 이유 |
|------|------|------|
| 1 | Vercel 배포 | 팀원들이 바로 쓸 수 있게 |
| 2 | Notes Tiptap 에디터 | 문서 작성 UX 큰 개선 |
| 3 | 실시간 동기화 | 팀 협업 핵심 |
| 4 | 대시보드 시각화 | 진행 상황 한눈에 |
| 5 | 케이스 자동화 | 장기 로드맵 |
