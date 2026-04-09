---
description: Multi-model parallel testing workflow
---

# 멀티모델 병렬 테스팅 워크플로우

> 여러 AI 모델을 활용하여 코드 검증의 blind spot을 제거하는 테스팅 프로세스

## 개요

```
┌─────────────────────────────────────────────────────────┐
│                    1. 테스트 요청서 작성                 │
│                    (Antigravity가 생성)                 │
└─────────────────────┬───────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    ▼                 ▼                 ▼
┌──────────┐    ┌──────────┐      ┌──────────┐
│ Session A│    │ Session B│      │ Codex    │
│ (Model X)│    │ (Model Y)│      │ (CLI)    │
└────┬─────┘    └────┬─────┘      └────┬─────┘
     │               │                 │
     ▼               ▼                 ▼
┌──────────┐    ┌──────────┐      ┌──────────┐
│result-   │    │result-   │      │result-   │
│{관점}    │    │{관점}    │      │{관점}    │
│_{모델}.md│    │_{모델}.md│      │_codex.md │
└────┬─────┘    └────┬─────┘      └────┬─────┘
     │               │                 │
     └───────────────┼─────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│              2. 결과 취합 및 최종 판정                   │
│                  (Antigravity)                          │
└─────────────────────────────────────────────────────────┘
```

---

## 파일 네이밍 규칙

결과 파일명은 **`result-{관점}_{모델명}.md`** 형식을 반드시 따른다.

| 관점 | 모델 | 파일명 |
|------|------|--------|
| 로직 | Claude (Antigravity) | `result-logic_claude.md` |
| 로직 | Codex | `result-logic_codex.md` |
| 보안 | Claude (Antigravity) | `result-security_claude.md` |
| 보안 | Gemini | `result-security_gemini.md` |
| 품질 | Codex | `result-quality_codex.md` |
| 품질 | Claude (Antigravity) | `result-quality_claude.md` |

**모델명 접미사 목록:**
- `_claude` — Antigravity 세션 (Opus, Sonnet, Haiku 포함)
- `_codex` — Codex CLI
- `_gemini` — Gemini 세션
- `_gpt` — ChatGPT / GPT 계열

> 하나의 관점에 여러 모델이 배정되면 모델별로 별도 파일 생성.
> 최종 판정 파일은 항상 `final-verdict.md` (모델 접미사 없음).

---

## Phase 1: 테스트 요청서 생성

Antigravity에게 다음 명령:

```
다음 파일들을 검증하기 위한 테스트 요청서를 작성해줘:
- [검증 대상 파일 목록]
- [관련 스펙/인터페이스 파일]
```

### 생성될 파일: `.agent/testing/test-request.md`

요청서 마지막에 반드시 아래 블록을 포함:

```markdown
## 파일 네이밍 규칙 (필수)

결과 파일을 작성할 때 반드시 아래 네이밍 규칙을 따르세요:

**형식: `.agent/testing/result-{관점}_{모델명}.md`**

- `{관점}`: 배정받은 검증 관점 (logic, security, quality 등)
- `{모델명}`: 작성하는 모델/도구 이름 (claude, codex, gemini, gpt 등)

예시:
- Claude가 로직 검증 → `result-logic_claude.md`
- Codex가 품질 검증 → `result-quality_codex.md`
- Gemini가 보안 검증 → `result-security_gemini.md`

이 규칙을 지키지 않으면 취합 단계에서 파일을 식별할 수 없습니다.
```

### 요청서 템플릿

```markdown
# 테스트 요청서

## 검증 대상
- `src/components/LoginForm.tsx`
- `src/hooks/useAuth.ts`

## 스펙 참조
- `contracts/auth.interface.ts`

## 검증 관점

### 1. 로직 검증
- 인증 플로우가 스펙을 충족하는가?
- 에러 핸들링이 완전한가?
- 엣지케이스가 처리되는가?

### 2. 보안 검증
- XSS 취약점 존재 여부
- 인증 토큰 처리 안전성
- 입력 값 검증 충분성

### 3. 코드 품질
- 타입 안전성
- 성능 이슈
- 코드 중복

## 응답 형식

각 모델은 다음 형식으로 작성:
- **Pass/Fail**: 전체 판정
- **Issues**: 발견된 문제 목록
- **Suggestions**: 개선 제안

## 파일 네이밍 규칙 (필수)

결과 파일을 작성할 때 반드시 아래 네이밍 규칙을 따르세요:

**형식: `.agent/testing/result-{관점}_{모델명}.md`**

- `{관점}`: 배정받은 검증 관점 (logic, security, quality 등)
- `{모델명}`: 작성하는 모델/도구 이름 (claude, codex, gemini, gpt 등)

예시:
- Claude가 로직 검증 → `result-logic_claude.md`
- Codex가 품질 검증 → `result-quality_codex.md`
- Gemini가 보안 검증 → `result-security_gemini.md`

이 규칙을 지키지 않으면 취합 단계에서 파일을 식별할 수 없습니다.
```

---

## Phase 2: 병렬 실행

### 세션 1: Antigravity

```
@[.agent/testing/test-request.md] 를 읽고 "로직 검증" 관점에서
검증해서 .agent/testing/result-logic_claude.md 에 결과 작성해줘.
파일명에 반드시 _claude 접미사를 붙여줘.
```

### 세션 2: Antigravity (다른 모델 / 다른 세션)

```
@[.agent/testing/test-request.md] 를 읽고 "보안 검증" 관점에서
검증해서 .agent/testing/result-security_claude.md 에 결과 작성해줘.
파일명에 반드시 _claude 접미사를 붙여줘.
```

### 터미널: Codex CLI

```bash
codex "Read .agent/testing/test-request.md and validate
from 'Code Quality' perspective.
IMPORTANT: Write results to .agent/testing/result-quality_codex.md
The filename MUST end with _codex.md to identify the authoring model."
```

### 다른 모델 (Gemini / GPT 등)

```
# Gemini 세션:
결과를 .agent/testing/result-{관점}_gemini.md 에 작성

# GPT 세션:
결과를 .agent/testing/result-{관점}_gpt.md 에 작성
```

---

## Phase 3: 결과 취합

// turbo-all

1. 결과 파일 확인 (모델별 구분 확인)
   `ls -la .agent/testing/result-*_*.md`

2. 파일별 결과 읽기
   `for f in .agent/testing/result-*_*.md; do echo "=== $f ==="; head -5 "$f"; echo; done`

---

## Phase 4: 최종 판정

Antigravity에게 요청:

```
.agent/testing/result-*_*.md 파일들을 모두 읽고:

1. 공통으로 지적된 이슈
2. 각 모델만 발견한 이슈 (파일명의 _모델명으로 구분)
3. 최종 Pass/Fail 판정
4. 수정 우선순위

를 정리해서 .agent/testing/final-verdict.md 에 작성해줘
```

---

## 파일 구조

```
.agent/
└── testing/
    ├── test-request.md              # 테스트 요청서 (Phase 1)
    ├── result-logic_claude.md       # Claude 로직 검증 결과
    ├── result-security_claude.md    # Claude 보안 검증 결과
    ├── result-quality_codex.md      # Codex 품질 검증 결과
    ├── result-logic_gemini.md       # (선택) Gemini 로직 결과
    └── final-verdict.md             # 최종 판정 (Phase 4)
```

---

## 팁

- **관점 분리**: 각 모델에게 다른 관점 부여 (로직/보안/품질)
- **동일 프롬프트 사용X**: blind spot이 겹침
- **결과 비교**: 2개 이상 모델이 동일 이슈 지적 시 우선 수정
- **시간 절약**: Phase 2는 터미널 탭 여러개로 동시 실행
- **파일 추적**: `_모델명` 접미사로 누가 작성했는지 즉시 식별 가능
- **같은 관점 복수 모델**: `result-logic_claude.md` + `result-logic_codex.md` 가능
