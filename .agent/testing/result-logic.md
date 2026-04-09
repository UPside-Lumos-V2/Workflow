# 검증 결과: 로직 검증

## 판정: Fail

요청된 3-pass 파이프라인과 Path B 임포트 흐름이 모두 “실패 시 안전하게 멈추는” 형태로 닫혀 있지 않습니다. 특히 수리 후 재검증 미소비와 Path B의 fail-closed 부재는 실제 잘못된 Case 등록으로 이어질 수 있습니다.

## Critical Issues (반드시 수정)
- [ ] [P1] Call 3 결과를 재검증하지 않음: `src/lib/preLumos.ts:102-119`, `src/types/preLumos.ts:91-94`

  `RepairResponse`는 `revalidation`을 요구하고 `SYSTEM_INSTRUCTION_REPAIR`도 “수리 후 재검증”을 명시하지만, `runOrchestrator()`는 `repairedRows`와 `exceptions`만 읽고 종료합니다. 즉, 수리 후에도 contract/rule 위반이 남아 있어도 최종 `finalRows`로 통과할 수 있어, 요청서의 3차 패스 보장이 깨집니다.

- [ ] [P1] Path B가 fail-closed 되지 않음: `src/pages/AnalyzerPage.tsx:107-123`, `src/lib/preLumos.ts:134-181`

  `parseAndValidateImportJson()`는 필수 필드가 누락된 row도 `rows`에 그대로 `cast`해서 반환하고, `handleJsonImport()`는 `rows.length > 0`이면 `finalRows`/`selectedSlugs`를 갱신합니다. 반대로 전부 실패한 경우에는 `finalRows`와 `selectedSlugs`를 비우지 않아서 이전 미리보기 상태가 남을 수 있습니다. 결과적으로 잘못된 JSON이 그대로 등록되거나, 이전 결과가 오염된 채로 다시 등록될 수 있습니다.

## Warnings (권장 수정)
- [ ] `src/lib/preLumosPrompt.ts:302-327`의 Call 1 지시는 “JSON array”와 `{rows, metadata}` object를 동시에 요구하는 문구가 있어 모델 출력이 흔들릴 여지가 있습니다. 현재 구현은 object를 기대하므로 당장 깨질 가능성은 낮지만, 프롬프트 문장 정합성은 정리하는 편이 안전합니다.
- [ ] `src/pages/AnalyzerPage.tsx:90-98`는 `runOrchestrator()`가 이미 `phase: 'repaired'`까지 갱신한 뒤에도 성공 시 상태를 다시 `'validated'`로 덮어씁니다. 미리보기 자체는 동작하지만, 실제로 수리 경로를 탔는지 UI state에서 잃어버려 파이프라인 상태 머신의 의미가 흐려집니다.
- [ ] `src/lib/preLumos.ts:161-178`의 Path B 검사는 필수 필드 존재와 `chains` 배열, `amount` 타입만 확인합니다. 에이전트 산출물만 받는 전제라면 충분하지만, 수동 편집 입력까지 허용한다면 `subcategory`, 중첩 객체, 숫자 유효성까지 더 엄격히 볼 여지가 있습니다.

## Info (참고 사항)
- `src/types/preLumos.ts:7-29`, `src/lib/preLumos.ts:205-267`는 `slug`, `hackedAt`, `chains`, `amount`, `category`, `subcategory` 등 핵심 필드를 `CaseIncidentData`로 거의 1:1 전달하고 있어, 필드명 마이그레이션 자체는 정합합니다.
- `src/lib/preLumosPrompt.ts`는 `skills-pre-lumos`의 계약/정규화 규칙을 직접 임베딩하고 있어, 외부 문서 기준선과의 괴리는 크지 않습니다.
- `api/analyze.ts:12-67`는 Gemini API 키를 서버 환경변수로만 사용하고 있어, 로직 관점에서 클라이언트 직접 노출 문제는 보이지 않습니다.

## 검증 체크리스트
- [x] `PreLumosRow`와 output contract의 핵심 필드 정합성 확인
- [x] `preLumosRowToCaseInput()`의 `CaseIncidentData` 매핑 확인
- [x] `priority` 자동 산정 기준 확인
- [x] `scoreTimeline` 생성 로직 확인
- [x] `Path A` 1→2 순차 흐름 확인
- [ ] `Path A` 3차 수리 후 재검증 소비 여부 확인
- [ ] `Path A` 수리 완료 phase 유지 여부 확인
- [ ] `Path B` 구조 오류 발생 시 fail-closed 여부 확인
- [ ] `Path B` 이전 미리보기 상태 초기화 여부 확인
