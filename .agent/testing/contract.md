# 컨트랙트 테스팅 방법론

> Solidity / Foundry 기반 스마트 컨트랙트 테스팅

## Tools

- `forge build` — compile
- `forge test -vvvv` — run tests (full trace, shows all call paths)
- `forge test -vvv` — run tests (trace on failures only, for CI)
- `forge snapshot` — gas benchmark
- `forge coverage --report summary` — coverage report
- `forge inspect <Contract> storage-layout` — verify storage slot order (UUPS critical)
- `forge fmt --check` — format check
- Use `FOUNDRY_OFFLINE=true` prefix if nightly/macOS panics on network calls

## 테스트 폴더

```
test/
├── unit/           # 함수 1개 단위
├── integration/    # 함수 간 연계 흐름
├── upgrade/        # 프록시(UUPS/Transparent) 전용
├── fuzz/           # 랜덤 입력 (vm.assume)
├── invariant/      # 불변 속성
├── helpers/        # 공통 setUp, 유틸
└── e2e/            # 전체 체인 시나리오
```

## 레이어별 목적

| 레이어 | 질문 | 우선순위 |
|---|---|---|
| unit | 함수가 정확히 동작하는가? | 1 |
| integration | 함수 연결 시 동작하는가? | 2 |
| upgrade | 프록시 환경에서 안전한가? | 2 |
| fuzz | 예상 못 한 입력에도 안전한가? | 3 |
| invariant | 어떤 조작 후에도 깨지지 않는 규칙은? | 3 |
| e2e | 배포→실행→조회 전체가 되는가? | 4 |

## 핵심 cheatcode

| cheatcode | 용도 |
|---|---|
| `vm.prank(addr)` | 특정 주소로 위장 |
| `vm.expectRevert(selector)` | revert 예상 |
| `vm.expectEmit(true,true,true,true)` | 이벤트 검증 |
| `vm.deal(addr, amount)` | ETH 잔액 설정 |
| `vm.assume(condition)` | fuzz 입력 필터 |
| `makeAddr("name")` | 역할별 주소 생성 |

## 네이밍

```
test_<함수>_<시나리오>
test_<함수>_revert_<조건>
testFuzz_<함수>
invariant_<속성>
```

## setUp 패턴 (프록시 프로젝트)

```solidity
abstract contract TestSetup is Test {
    MyContract public target;
    address owner    = makeAddr("owner");
    address operator = makeAddr("operator");
    address attacker = makeAddr("attacker");

    function setUp() public virtual {
        // Implementation → Proxy → cast
        MyContract impl = new MyContract();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MyContract.initialize, (owner, operator))
        );
        target = MyContract(address(proxy));
    }
}
```

## upgrade 테스트 필수 항목

- 프록시 초기화 성공
- 초기화 중복 호출 revert
- owner/operator가 프록시 storage에 저장 확인
- non-owner 업그레이드 revert
- implementation 직접 호출 차단
- V2 reinitializer 동작 (업그레이드 시)
