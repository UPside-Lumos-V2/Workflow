# 검증 결과: 코드 품질

## 판정: Conditional Pass

## Critical Issues (반드시 수정)

- [ ] **Q-1**: `parseAndValidateImportJson`에서 `row as PreLumosRow` 캐스팅이 unsafe — 필수 필드 누락된 row도 `PreLumosRow`로 캐스팅됨. 타입 시스템의 보호를 우회.
  파일: `src/lib/preLumos.ts:178`
  수정안: hasErrors flag로 skip하거나, validated row만 별도 배열로 분리

## Warnings (권장 수정)

- [ ] **Q-2**: `AnalyzerPage.tsx`가 554행으로 단일 컴포넌트치고 비대. `IncidentCard`, `ValidationReport`, `TabButton`은 이미 분리되어 있지만 메인 컴포넌트의 상태 관리(useState 7개)가 집중되어 있음.
  권장: 커스텀 훅 `useAnalyzerPipeline()`으로 상태+핸들러 추출

- [ ] **Q-3**: `useCallback` 의존성에서 `addCase`가 포함됨 (`handleRegister`). `useCases()`가 매 렌더마다 새 참조를 반환하면 불필요한 리렌더링 발생 가능.
  파일: `src/pages/AnalyzerPage.tsx:149-168`, dep: `[finalRows, selectedSlugs, addCase, updateState]`
  권장: `addCase`를 ref로 감싸거나 useCases 내부 memoization 확인

- [ ] **Q-4**: `preLumosRowToCaseInput`에서 `row.preAudits`, `row.postAudits`, `row.postmortem` 등이 undefined일 수 있는데 방어 코드 없음. `PreLumosRow` 타입에서는 필수이지만 실제 JSON에서 누락 가능.
  파일: `src/lib/preLumos.ts:257-259`
  수정안: `row.preAudits ?? []` 등의 nullish coalescing 적용

- [ ] **Q-5**: `api/analyze.ts`에서 `req.body`의 타입 assertion `as { rawText?: string; ... }`이 unused field(`rawText`, `year`)를 포함. 실제로 사용하지 않는 필드가 타입에 남아있어 혼란을 줌.
  파일: `api/analyze.ts:24-28`
  수정안: `rawText`와 `year` 제거

- [ ] **Q-6**: `preLumosPrompt.ts`의 임베딩 상수들이 very long string literals — 향후 스킬 파일이 변경되면 동기화가 필요하지만 수동 관리됨.
  권장: 주석으로 원본 파일 경로와 마지막 동기화 날짜 기록

## Info (참고 사항)

- `PreLumosRow`와 `CaseIncidentData` 간 필드 매핑이 1:1로 정확함
- `ValidatorFinding` 타입의 severity/fixClass/appliesTo가 모두 union literal로 타입 안전
- `PipelineState`가 discriminated union 대신 단일 interface + phase 필드 사용 — 현재 규모에서는 적절
- `INITIAL_PIPELINE_STATE`가 `const`로 export되어 있어 외부 mutation 위험 없음 (spread copy로 사용됨)

## 검증 체크리스트
- [x] PreLumosRow ↔ CaseIncidentData 타입 호환: 정합
- [ ] `as` 캐스팅 안전성: **C-1에서 unsafe** (Q-1)
- [x] ValidatorFinding 필드 타입: API 응답 구조와 일치
- [x] PipelinePhase union type: 필요한 모든 상태 포함
- [ ] 컴포넌트 크기: 554행, 분할 권장 (Q-2)
- [ ] useCallback deps 정확성: addCase 참조 안정성 불확실 (Q-3)
- [ ] null safety for nested objects: 방어 없음 (Q-4)
- [x] INITIAL_PIPELINE_STATE immutability: 정상
- [x] 타입 export 구조: 깔끔
