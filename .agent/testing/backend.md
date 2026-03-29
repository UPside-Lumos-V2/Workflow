# 백엔드 API 테스팅 방법론

> TypeScript / Express / Vitest / supertest 기반

## 도구

- `vitest` — 테스트 러너
- `supertest` — HTTP 요청 테스트
- `vitest --coverage` — 커버리지

## 테스트 폴더

```
test/
├── unit/           # 서비스/유틸 함수 단위
├── integration/    # API 엔드포인트 + DB 연동
├── e2e/            # 전체 플로우 (인증 → 요청 → 응답)
└── helpers/        # mock, fixture, 공통 setUp
```

## 레이어별 목적

| 레이어 | 질문 | 우선순위 |
|---|---|---|
| unit | 서비스 함수가 정확히 동작하는가? | 1 |
| integration | API 엔드포인트 + DB 조합이 동작하는가? | 2 |
| e2e | 인증 → 요청 → 체인 tx → 응답 전체가 되는가? | 3 |

## 테스트 대상

- **인증:** API Key 발급, 검증, 만료, rate limit
- **엔드포인트:** 각 route의 성공/실패/에러 응답
- **미들웨어:** 인증 미들웨어, 에러 핸들러
- **외부 연동:** 체인 tx 전송(mock), IPFS 업로드(mock), DB 쿼리
- **에러 응답:** 400, 401, 402, 404, 500 적절한 반환

## 네이밍

```
describe("<METHOD> <route>")
  it("성공 시 200 반환")
  it("인증 없이 401 반환")
  it("결제 안 됐으면 402 반환")
```

## mock 패턴

```typescript
// 체인 호출 mock
vi.mock("../services/chain", () => ({
  callAttest: vi.fn().mockResolvedValue("0xattestationId"),
}));

// DB mock
vi.mock("../db", () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));
```
