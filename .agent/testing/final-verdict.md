# 최종 판정: Pre-Lumos Analyzer

## 종합 판정: Conditional Pass

3개 세션(로직/보안/품질) 모두에서 동일 핵심 문제를 지적했으며, 수정 후 운영 가능.

---

## 1. 공통 지적 이슈 (3/3 세션)

| # | 이슈 | 로직 | 보안 | 품질 | 우선순위 |
|---|------|:----:|:----:|:----:|:--------:|
| **F-1** | Path B: 필수 필드 누락 row가 필터링 없이 등록까지 도달 | P1 | P1 | P1 | **즉시** |

**요약**: `parseAndValidateImportJson()`이 에러만 기록하고 row를 그대로 push → unsafe `as PreLumosRow` 캐스팅 → 미리보기에서 `row.chains.join()` crash 가능 → DB에 불완전 데이터 등록 가능

---

## 2. 2개 세션 이상 지적 이슈

| # | 이슈 | 로직 | 보안 | 품질 | 우선순위 |
|---|------|:----:|:----:|:----:|:--------:|
| **F-2** | Call 3 재검증 결과(`revalidation`) 미소비 | P1 | - | - | **높음** |
| **F-3** | API 인증/레이트리밋 없음 (LLM 프록시 남용 가능) | - | P1 | - | **높음** |

---

## 3. 개별 세션만 발견한 이슈

### 로직만
- 수리 후 phase가 `validated`로 덮어써져 파이프라인 상태 의미 손실
- 빈 배열 입력 시 에러 메시지 부정확
- 프롬프트에서 "array"와 "object" 동시 요구 문구

### 보안만
- 대용량 입력 상한 없음 (브라우저 메모리 + Gemini 비용)
- `website` 필드에 `javascript:` scheme 가능 (XSS 경로)
- Gemini 응답에 런타임 스키마 검증 없음

### 품질만
- 컴포넌트 554행 비대 (useAnalyzerPipeline 추출 권장)
- useCallback 의존성에서 addCase 참조 안정성 불확실
- preAudits/postAudits/postmortem에 nullish coalescing 없음
- api/analyze.ts에 unused 타입 필드 (rawText, year)
- 프롬프트 상수의 원본 파일 동기화 관리 없음

---

## 4. 수정 우선순위

### 즉시 수정 (블로커)
1. **F-1**: Path B 파서에서 필수 필드 누락 row를 skip 처리
2. **F-2**: Call 3 revalidation status가 fail이면 exception lane으로 이동

### 높음 (운영 전)
3. **F-3**: api/analyze.ts에 Supabase auth 토큰 검증 추가
4. preAudits/postAudits/postmortem에 `?? []` 방어 추가
5. 대용량 입력 제한 (텍스트 50KB, JSON 1MB)

### 보통 (리팩토링)
6. AnalyzerPage 상태 로직을 커스텀 훅으로 분리
7. 프롬프트 상수에 원본 파일 경로 + 동기화 날짜 주석
8. api/analyze.ts unused 타입 필드 제거
9. website 필드 URL scheme 검증

---

## 5. 즉시 수정 항목 구체적 변경 사항

### F-1 수정: `src/lib/preLumos.ts:152-178`
```diff
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
+   let hasError = false;
    // ... 필수 필드 확인 ...
    for (const field of REQUIRED_FIELDS) {
      if (!(field in row) || ...) {
        errors.push(...);
+       hasError = true;
      }
    }
+   if (hasError) continue;  // 누락 row skip
    rows.push(row as PreLumosRow);
  }
```

### F-2 수정: `src/lib/preLumos.ts:105-119`
```diff
  const repairResult = await callGemini<RepairResponse>(...);
  const repairedRows = repairResult.repairedRows || rows;
  const exceptions = repairResult.exceptions || [];
+ // 재검증 실패 시 exception lane
+ if (repairResult.revalidation?.status === 'fail') {
+   const failSlugs = repairResult.revalidation.findings
+     .filter(f => f.severity === 'blocker')
+     .map(f => f.slug)
+     .filter(Boolean);
+   // blocker 있는 row 제외
+   const safeSlugs = new Set(failSlugs);
+   return {
+     finalRows: repairedRows.filter(r => !safeSlugs.has(r.slug)),
+     exceptions: [...exceptions, ...failSlugs.map(s => `${s}: revalidation failed`)],
+   };
+ }
```
