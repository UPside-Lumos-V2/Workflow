# 프론트엔드 테스팅 방법론

> Vitest + Playwright 기반

## 도구

- `vitest` — 컴포넌트/로직 단위 테스트
- `playwright` — 브라우저 E2E 테스트
- `vitest --coverage` — 커버리지

## 테스트 폴더

```
test/
├── unit/           # 컴포넌트 렌더링, 유틸 함수
├── e2e/            # 브라우저 시나리오 (Playwright)
└── helpers/        # mock provider, fixture
```

## 레이어별 목적

| 레이어 | 도구 | 질문 |
|---|---|---|
| unit | vitest | 컴포넌트가 정확히 렌더하는가? |
| e2e | playwright | 유저가 클릭→입력→제출하면 동작하는가? |

## 테스트 대상

- **컴포넌트:** 렌더링, props 변경, 이벤트 핸들러
- **훅:** 상태 변화, 비동기 데이터 페칭
- **라우팅:** 페이지 전환, 404 처리
- **지갑 연동:** 연결/해제, 네트워크 전환 (mock provider)
- **반응형:** 모바일/데스크톱 레이아웃

## 네이밍

```
describe("ComponentName")
  it("renders correctly")
  it("handles click event")
  it("shows error on invalid input")
```
