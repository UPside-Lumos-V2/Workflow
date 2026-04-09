# 테스트 요청서: Pre-Lumos Incident Analyzer

## 검증 대상

### 핵심 파일
- `src/pages/AnalyzerPage.tsx` — 분석기 UI (Tab A + Tab B + 미리보기 + 등록)
- `src/lib/preLumos.ts` — Orchestrator (3-pass pipeline) + Path B parser + Row→Case 변환
- `src/lib/preLumosPrompt.ts` — skills-pre-lumos 규칙 임베딩 + 프롬프트 빌더
- `src/types/preLumos.ts` — PreLumosRow, ValidatorFinding, PipelineState 타입
- `api/analyze.ts` — Vercel serverless Gemini 3.1 Pro 엔드포인트

### 참조 파일
- `src/types/index.ts` — CaseIncidentData, Case 타입 (변환 대상)
- `src/hooks/useStore.ts` — useCases 훅 (DB 등록에 사용)
- `skills-pre-lumos/references/pre-lumos-output-contract.md` — output JSON 계약
- `skills-pre-lumos/references/pre-lumos-normalization-rules.md` — 정규화 규칙
- `skills-pre-lumos/agents/contract-validator.md` — 구조 검증 에이전트
- `skills-pre-lumos/agents/rule-validator.md` — 규칙 검증 에이전트

## 아키텍처 컨텍스트

### Path A (웹 분석): 3-Pass Orchestrated Pipeline
```
사용자 텍스트 입력
  → Call 1 (Phase 1-4): Gemini로 추출+정규화 (system_instruction: SKILL원칙+contract+rules)
  → Call 2 (Phase 5): Gemini로 검증 (system_instruction: validator 규칙)
  → [조건부] Call 3 (Phase 6): Gemini로 수리+재검증
  → 미리보기 카드 → Cases 등록 (Supabase)
```

### Path B (JSON 임포트)
```
로컬 에이전트 결과 JSON 업로드
  → 구조 확인만 (검증 생략 — 에이전트가 이미 완료)
  → 미리보기 카드 → Cases 등록
```

---

## 검증 관점

### 1. 로직 검증 (세션 1)

**데이터 흐름 정합성:**
- `preLumosRowToCaseInput()` 변환이 `CaseIncidentData` 타입과 1:1 매핑되는가?
- `PreLumosRow`와 `pre-lumos-output-contract.md`의 Required JSON Shape가 일치하는가?
- `scoreTimeline` 자동 생성 로직이 올바른가? (상태에 따라 completed/pending/none)
- `priority` 자동 결정: amount ≥ $100M → high, ≥ $1M → medium, else → low

**Orchestrator 로직:**
- Call 1 → Call 2 → Call 3 순차 흐름이 올바른가?
- findings가 없으면 Call 3이 실제로 생략되는가?
- 에러 발생 시 적절한 에러 상태 전환이 이루어지는가?
- `PipelineState` 상태 머신이 일관성 있는가?

**Path B 파서 검증:**
- 필수 필드(slug, name, hackedAt, chains, amount, category) 누락 감지가 정확한가?
- `chains`가 배열이 아닌 경우를 잡는가?
- `amount`가 숫자가 아닌 경우를 잡는가?
- 빈 배열 `[]` 입력 시 적절한 처리가 되는가?

### 2. 보안 + 안정성 검증 (세션 2)

**API 보안:**
- `api/analyze.ts`에서 `GEMINI_API_KEY`가 서버 사이드에서만 사용되는가?
- 클라이언트에서 API 키가 노출되지 않는가?
- `systemInstruction`을 클라이언트에서 보내는 구조 — 프롬프트 인젝션 위험이 있는가?
- 입력 검증이 충분한가? (빈 prompt, 과도한 길이 등)

**런타임 안정성:**
- Gemini API 실패 시 (네트워크 에러, 429, 500) 적절한 에러 핸들링이 되는가?
- JSON.parse 실패 시 크래시하지 않는가?
- `useCases().add()` 실패 시 중간 등록 상태가 적절히 처리되는가?
- 복수 사건 등록 중 일부 실패 시 partial success를 보여주는가?

**입력 위생:**
- Path B에서 악의적 JSON 입력 (프로토타입 오염 등) 방어가 되는가?
- XSS: `row.name`, `row.summary` 등이 HTML에 직접 렌더링될 때 위험은 없는가?

### 3. 코드 품질 검증 (세션 3)

**타입 안전성:**
- `PreLumosRow`와 `CaseIncidentData`의 필드 타입이 정확히 호환되는가?
- `as` 캐스팅이 안전한가?
- `ValidatorFinding`의 모든 필드가 API 응답과 일치하는가?

**프롬프트 품질:**
- `SYSTEM_INSTRUCTION_ANALYZE`가 output contract와 일치하는 JSON 구조를 지시하는가?
- 정규화 규칙(REQ-001~006, STS-001~003, FMT-001~006 등)이 누락 없이 임베딩되었는가?
- Repair Boundaries가 `pre-lumos-normalization-rules.md`의 L126-141과 일치하는가?

**컴포넌트 설계:**
- `AnalyzerPage`가 단일 컴포넌트로 너무 큰가? (500+ lines)
- 상태 관리가 적절한가? (useState 수, 불필요한 리렌더링)
- `useCallback` 의존성 배열이 정확한가?

## 응답 형식

각 모델은 다음 형식으로 `.agent/testing/result-{model}.md`에 작성:

```markdown
# 검증 결과: {관점}

## 판정: Pass / Conditional Pass / Fail

## Critical Issues (반드시 수정)
- [ ] Issue 1: 설명 + 파일:라인

## Warnings (권장 수정)
- [ ] Warning 1: 설명

## Info (참고 사항)
- Info 1: 설명

## 검증 체크리스트
- [x] 항목 1: 결과
- [ ] 항목 2: 결과
```
