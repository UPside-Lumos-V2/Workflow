# 검증 결과: 보안 + 안정성 검증

## 판정: Fail

검증 범위는 `AnalyzerPage`, `preLumos.ts`, `preLumosPrompt.ts`, `types/preLumos.ts`, `api/analyze.ts`, 그리고 관련 참조 파일입니다. 현재 상태는 보안 경계와 런타임 방어가 충분하지 않아서, 실제 운영 기준으로는 실패 판정이 맞습니다.

## Critical Issues (반드시 수정)
- [ ] `api/analyze.ts`가 인증 없이 외부 요청을 받아 `systemInstruction`과 `prompt`를 그대로 Gemini 호출에 전달합니다. 즉, 누구나 이 엔드포인트를 LLM 프록시처럼 사용해 API 키가 붙은 서버 자원을 소모시킬 수 있습니다. `POST` 여부와 필수 필드 존재만 확인하고 있어, 인증/인가/레이트리밋/허용 길이 제한이 전부 비어 있습니다. 근거: [api/analyze.ts](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/api/analyze.ts#L17), [api/analyze.ts](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/api/analyze.ts#L30), [api/analyze.ts](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/api/analyze.ts#L61).
- [ ] Path B JSON 임포트는 구조 오류가 있어도 row를 버리지 않고 그대로 `finalRows`로 넘기며, 미리보기는 `row.chains.join(', ')`를 무조건 호출합니다. 그래서 `chains`가 문자열이거나 잘못된 JSON이 들어오면 구조 경고만 쌓이고 실제 렌더 단계에서 UI가 깨질 수 있습니다. `parseAndValidateImportJson()`가 오류를 기록하면서도 `rows.push(row as PreLumosRow)`를 수행하는 점이 핵심입니다. 근거: [src/lib/preLumos.ts](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/lib/preLumos.ts#L134), [src/lib/preLumos.ts](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/lib/preLumos.ts#L178), [src/pages/AnalyzerPage.tsx](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/pages/AnalyzerPage.tsx#L114), [src/pages/AnalyzerPage.tsx](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/pages/AnalyzerPage.tsx#L451).

## Warnings (권장 수정)
- [ ] Gemini 응답은 `JSON.parse(text)`로 바로 신뢰하고, 런타임 스키마 검증이 없습니다. 모델이 형식만 JSON인 잘못된 구조를 반환하면 `/api/analyze`는 500으로 종료되고 파이프라인은 중단됩니다. 회복용 재시도나 최소 스키마 검증이 없어서 안정성이 약합니다. 근거: [api/analyze.ts](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/api/analyze.ts#L54), [src/lib/preLumos.ts](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/lib/preLumos.ts#L69).
- [ ] Path A와 Path B 모두 입력 크기 제한이 없습니다. `handleAnalyze()`는 빈 문자열만 막고 길이 상한을 두지 않으며, JSON 임포트는 `FileReader.readAsText()`로 전체 파일을 메모리에 올립니다. 큰 텍스트나 큰 JSON을 넣으면 브라우저 메모리 압박, 느린 렌더, 긴 Gemini 요청으로 이어질 수 있습니다. 근거: [src/pages/AnalyzerPage.tsx](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/pages/AnalyzerPage.tsx#L83), [src/pages/AnalyzerPage.tsx](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/pages/AnalyzerPage.tsx#L127).
- [ ] `website` 값은 pre-lumos row와 Case 데이터로 그대로 전달되고, 상세 화면에서는 링크 href로 직접 사용됩니다. Path B 임포트가 URL scheme을 강제하지 않기 때문에, 악성 JSON이 `javascript:` 계열 값을 넣으면 데이터층에 남을 수 있습니다. 클릭 전제가 있지만 입력 경로를 생각하면 정제는 필요합니다. 근거: [src/lib/preLumos.ts](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/lib/preLumos.ts#L244), [src/pages/CaseDetailPage.tsx](/Users/heosehyeon/프로젝트/upside%20후속지원/LUMOS_2/Workflow/src/pages/CaseDetailPage.tsx#L164).

## Info (참고 사항)
- `AnalyzerPage`의 현재 렌더링 경로는 React 텍스트 노드 중심이라, 이번 검토 범위 안에서는 직접적인 `dangerouslySetInnerHTML` 기반 XSS 경로가 보이지 않았습니다. 즉, 이번 경로의 위험은 HTML 주입보다는 입력 검증 부재와 데이터 무결성 부족에 가깝습니다.
- `registerRowsAsCases()`는 행 단위 `try/catch`로 실패를 분리해서 처리하므로, 한 건 실패가 전체 배치를 즉시 중단하지는 않습니다. 부분 성공/부분 실패를 표시할 수 있는 구조는 이미 있습니다.
- `types/preLumos.ts`의 타입 정의는 의도상 contract와 대체로 정합적이지만, 현재는 타입만 있고 런타임 검증이 없어서 외부 JSON이나 모델 응답이 타입을 우회하면 보호가 되지 않습니다.

## 검증 체크리스트
- [x] `GEMINI_API_KEY`는 클라이언트 코드에 직접 노출되지 않고 서버 함수에서만 사용됩니다.
- [ ] `/api/analyze`는 인증/인가/레이트리밋 없이 공개적으로 남아 있습니다.
- [ ] Path B의 구조 오류는 차단되지 않고 미리보기까지 진행될 수 있습니다.
- [x] 이번 범위의 AnalyzerPage 렌더링은 React 텍스트 렌더링을 사용합니다.
- [ ] Gemini 응답에 대한 런타임 스키마 검증과 재시도 전략이 없습니다.
- [ ] 대용량 텍스트/JSON 입력에 대한 상한이 없습니다.
- [x] 케이스 등록은 행 단위 실패 격리를 사용해 배치 전체를 한 번에 깨뜨리지는 않습니다.
