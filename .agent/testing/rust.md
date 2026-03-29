# Rust 테스팅 방법론

> cargo test 기반 CLI / 유틸리티 테스팅

## 도구

- `cargo test` — 테스트 실행
- `cargo test -- --nocapture` — 출력 포함
- `cargo tarpaulin` — 커버리지 (선택)

## 테스트 위치

```
src/
├── lib.rs          # 인라인 #[cfg(test)] mod tests
├── hasher.rs       # 각 모듈에 인라인 테스트
└── crypto.rs

tests/              # 통합 테스트 (각 파일이 별도 바이너리)
├── hash_test.rs
├── aes_test.rs
└── e2e_test.rs
```

## 레이어별 목적

| 레이어 | 위치 | 질문 |
|---|---|---|
| unit | `src/` 인라인 `#[cfg(test)]` | 함수 1개가 정확한가? |
| integration | `tests/` 디렉토리 | 모듈 조합이 동작하는가? |
| e2e | `tests/` 디렉토리 | CLI 실행 → API 호출 → 결과 전체가 되는가? |
| fuzz | `cargo-fuzz` / `proptest` | 랜덤 입력에 안전한가? |

## 테스트 대상 (유틸)

- **Hasher:** 동일 입력 → 동일 해시, 키 정렬 확인, 빈 입력 처리
- **AES:** 암호화 → 복호화 라운드트립, 키 길이 검증, 잘못된 키 에러
- **Indexer:** 이벤트 파싱, DB 삽입, 재시작 시 중복 방지
- **CLI Agent:** API 호출 성공/실패, 인자 파싱, 출력 포맷

## 네이밍

```rust
#[test]
fn test_canonical_hash_deterministic() { }

#[test]
#[should_panic(expected = "invalid key")]
fn test_aes_decrypt_wrong_key() { }
```

## fuzz 패턴

```rust
// proptest
proptest! {
    #[test]
    fn fuzz_hash_never_panics(input: String) {
        let _ = canonical_hash(&input);
    }
}
```
