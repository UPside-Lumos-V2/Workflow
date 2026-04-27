# 검증 결과: Code Quality

## 판정: Fail

## Critical Issues (반드시 수정)
- [ ] Issue 1: Alert Rule 2가 실제 파이프라인에서는 사실상 도달 불가입니다. `AlertRuleEngine`은 `best_tier == 1`을 요구하지만 그룹 생성/갱신 로직과 마이그레이션에는 `best_tier`가 저장되지 않습니다. 따라서 단일 소스 Tier 1 + confidence >= 70 조건은 테스트용 dict에서만 동작하고, 운영 row에서는 `best_tier` 기본값 3으로 평가됩니다. 파일: `hack-detector/src/alerter.py:33-47`, `hack-detector/src/grouper.py:107-119`, `hack-detector/src/grouper.py:129-167`, `hack-detector/migrations/003_alert_system.sql:5-27`

- [ ] Issue 2: Alert 판정이 갱신 전 그룹 row를 사용합니다. `SignalStore.insert()`는 `calculate_confidence()`로 점수를 계산하고 DB에는 업데이트하지만, 이후 `grp = group_data.data[0]`를 그대로 `AlertRuleEngine.evaluate()`에 넘깁니다. 이 `grp`에는 새 `confidence_score`가 반영되어 있지 않아서 confidence 기반 알림 판정이 누락될 수 있습니다. 파일: `hack-detector/src/storage/supabase_store.py:39-64`

- [ ] Issue 3: Deduplicator의 Supabase 조회 실패 fallback이 없습니다. `AlertDeduplicator.check()` 내부 쿼리 예외가 그대로 전파되고, 상위 `SignalStore.insert()`의 포괄 catch에 걸려 `alert_status`가 기본값 `pending`으로 저장됩니다. 요청서 기준으로는 “쿼리 실패 시 fallback”이 필요하고, 현재 구현은 알림 생성 여부가 조용히 미결 상태로 남습니다. 파일: `hack-detector/src/deduplicator.py:34-42`, `hack-detector/src/storage/supabase_store.py:56-76`, `hack-detector/src/storage/supabase_store.py:95-98`

- [ ] Issue 4: follow-up 알림의 `new_fields`가 실제 새로 추가된 필드가 아닙니다. Deduplicator는 `follow_up` 여부만 반환하고 어떤 필드가 새로 추가됐는지는 반환하지 않습니다. 그런데 저장소는 현재 그룹에 존재하는 `tx_hash`, `loss_usd`, `attacker_address` 전체를 `new_fields`로 넘기므로 이미 이전 알림에 포함된 필드까지 “새 정보”로 표시될 수 있습니다. 파일: `hack-detector/src/deduplicator.py:47-58`, `hack-detector/src/storage/supabase_store.py:112-115`, `hack-detector/src/formatter.py:93-110`

- [ ] Issue 5: Alert 파이프라인이 `SignalStore.insert()` 하나에 그룹핑, 점수 계산, 알림 판정, dedup, signal 저장, alert 저장, 로그 조회까지 중첩되어 있어 트랜잭션 경계와 실패 정책이 불명확합니다. 특히 alert 판정은 signal 저장 전 row 상태를 기준으로 계산하고, alert 저장은 signal 저장 후 수행하는 구조라 stale row, 부분 실패, 상태 불일치를 만들기 쉽습니다. 파일: `hack-detector/src/storage/supabase_store.py:26-143`

## Warnings (권장 수정)
- [ ] Warning 1: `group: dict`, `metadata: dict`, `extract_all() -> dict`처럼 핵심 계약이 bare dict로 흩어져 있습니다. 이번 `best_tier` 누락과 stale `confidence_score` 문제도 타입/스키마 계약이 코드로 고정되어 있지 않아 발생한 성격이 큽니다. `TypedDict` 또는 dataclass/Pydantic 모델로 `IncidentGroup`, `ExtractedFields`, `AlertMetadata`를 정의하는 편이 안전합니다. 파일: `hack-detector/src/alerter.py:22`, `hack-detector/src/deduplicator.py:26`, `hack-detector/src/formatter.py:29-50`, `hack-detector/src/extractors/field_extractor.py:174-182`, `hack-detector/src/scorer.py:17`

- [ ] Warning 2: `AlertMessage`의 `alert_level`, `alert_action` 타입이 `str`이고 `metadata`도 bare dict입니다. DB CHECK 제약은 있지만 Python 레벨에서 잘못된 문자열을 막지 못합니다. `Literal["critical", "follow_up"]`, `Literal["first_alert", "follow_up"]`, `dict[str, str | float]` 또는 전용 `TypedDict`가 필요합니다. 파일: `hack-detector/src/formatter.py:42-50`, `hack-detector/migrations/003_alert_system.sql:8-14`

- [ ] Warning 3: `calculate_confidence()`가 source tier를 항상 Tier 1로 가정합니다. 요청서에도 명시된 문제이며, 코드 품질 관점에서는 점수 계산 함수가 필요한 입력(`best_tier` 또는 signal tier 집계)을 받지 않고 내부 추정으로 계약을 숨기고 있습니다. 파일: `hack-detector/src/scorer.py:33-37`

- [ ] Warning 4: `formatter.py`의 `_format_usd()`와 Workflow UI의 `formatUsd()`가 중복되어 있습니다. Python/TS 경계 때문에 완전 공유는 어렵더라도 포맷 정책을 문서화하거나 fixture 기반 스냅샷 테스트로 맞추는 장치가 필요합니다. UI 내부에서도 `CasesPage.tsx`, `CaseDetailPage.tsx`, `AnalyzerPage.tsx`, `HackSignalsPage.tsx`에 유사 구현이 반복됩니다. 파일: `hack-detector/src/formatter.py:19-26`, `Workflow/src/pages/HackSignalsPage.tsx:41-46`, `Workflow/src/pages/CasesPage.tsx:17`, `Workflow/src/pages/CaseDetailPage.tsx:24`, `Workflow/src/pages/AnalyzerPage.tsx:50`

- [ ] Warning 5: `field_extractor.py`의 ambiguous protocol alias와 chain keyword가 코드에 하드코딩되어 있어 `config/protocols.yaml`과 정책이 갈라질 수 있습니다. alias별 `ambiguous: true`, `requires_marker: true`, `context_keywords` 같은 메타데이터를 config로 옮기고 extractor는 그 정책을 해석하는 구조가 더 유지보수하기 좋습니다. 파일: `hack-detector/src/extractors/field_extractor.py:20-34`, `hack-detector/src/extractors/field_extractor.py:61-70`, `hack-detector/src/extractors/field_extractor.py:90-102`

- [ ] Warning 6: `IncidentGrouper.match_or_create()`는 `tx_hash`, `protocol_name`, `attacker_address`가 모두 없어도 새 그룹을 만듭니다. quality 관점에서 그룹 생성 invariant가 약해 noisy signal이 독립 incident group으로 계속 쌓일 수 있습니다. 최소한 “식별자 없는 그룹” 정책을 별도 함수/상수로 분리하고 테스트해야 합니다. 파일: `hack-detector/src/grouper.py:27-58`

- [ ] Warning 7: Twitter listener는 `should_skip()` 된 tweet을 그냥 `continue`하고 `SignalStore.log_skip()`을 호출하지 않습니다. Telegram 쪽과 동일한 운영 가시성을 기대한다면 skip 로깅 정책이 source별로 일관되지 않습니다. 파일: `hack-detector/src/listeners/twitter.py:274-279`

- [ ] Warning 8: 테스트 커버리지가 alert rule/formatter와 field extractor 일부에 집중되어 있습니다. 요청서 기준으로 deduplicator, grouper, scorer 단위 테스트와 `SignalStore.insert()` E2E harness가 없습니다. 특히 이번 Critical Issue 1-4는 현재 테스트 13개가 모두 통과해도 잡히지 않습니다. 파일: `hack-detector/tests/test_alerter.py:1-112`, `hack-detector/tests/test_field_extractor.py:1-58`

- [ ] Warning 9: `supabase_store.py`의 `json` import와 `formatter.py`의 `links` 변수가 미사용입니다. 기능 결함은 아니지만 alert 파이프라인처럼 민감한 코드에서는 dead code를 줄이는 편이 검토 비용을 낮춥니다. 파일: `hack-detector/src/storage/supabase_store.py:2`, `hack-detector/src/formatter.py:74`

- [ ] Warning 10: Workflow UI의 `AlertStatusBadge`는 `pending` 또는 누락 상태를 `null`로 렌더링합니다. 이전 UI 요구사항인 “없는 경우에도 없다는 식으로 표시”와는 맞지 않습니다. 품질 관점에서는 상태값 union 타입과 표시 정책을 명시하고 `Pending`/`Not evaluated` 같은 배지를 노출하는 편이 좋습니다. 파일: `Workflow/src/pages/HackSignalsPage.tsx:24`, `Workflow/src/pages/HackSignalsPage.tsx:124-131`

## Info (참고 사항)
- Info 1: `signal.id` 타이밍 문제는 현재 구조상 해결되어 있습니다. alert 레코드는 signal insert 이후 `stored_signal_id`를 받은 뒤 `_insert_alert()`에 전달됩니다. 파일: `hack-detector/src/storage/supabase_store.py:100-116`, `hack-detector/migrations/003_alert_system.sql:14`

- Info 2: `_insert_alert()` 실패는 signal 저장 자체를 막지 않습니다. 내부에서 예외를 catch하고 로그만 출력합니다. 다만 운영 추적을 위해서는 실패 사유를 `alert_status` 또는 별도 error log에 남기는 개선이 필요합니다. 파일: `hack-detector/src/storage/supabase_store.py:174-188`

- Info 3: grouping 실패 시 signal 저장은 계속되고 alert 판정은 `group_id`/`group_data` 부재로 스킵됩니다. 요청서의 “grouping 실패 시 alert 판정 스킵” 조건은 충족합니다. 파일: `hack-detector/src/storage/supabase_store.py:35-59`

- Info 4: `AlertDecision`은 `alert_level`에 `Literal["critical", "follow_up", "silent"]`을 사용하고 있어 최소한의 타입 제약은 있습니다. 다만 `follow_up`은 rule engine의 alert level보다는 dedup action에 가까워 의미가 섞여 있습니다. 파일: `hack-detector/src/alerter.py:12-16`

- Info 5: Workflow 상세 모달은 주요 메타데이터가 없을 때 `Not detected`를 표시하고 raw JSON도 확인할 수 있습니다. 목록 카드에서는 Protocol/Chain/Loss/Tx만 표시하고 Attacker/Incident Group/Confidence는 상세 모달에서 확인하는 구조입니다. 파일: `Workflow/src/pages/HackSignalsPage.tsx:64-95`, `Workflow/src/pages/HackSignalsPage.tsx:223-308`, `Workflow/src/pages/HackSignalsPage.tsx:506-513`

- Info 6: 검증 실행 결과: `hack-detector/.venv/bin/python -m unittest discover -s tests`는 13개 테스트 통과, `hack-detector/.venv/bin/python -m compileall src tests` 통과, `Workflow npm exec -- tsc --noEmit` 통과, `Workflow npm exec -- eslint src/pages/HackSignalsPage.tsx` 통과. 시스템 Python의 `python3 -m unittest discover -s tests`는 `pyyaml` 미설치로 실패했으므로 로컬 실행은 `.venv` 사용이 필요합니다. `ruff`는 `.venv`에 설치되어 있지 않아 실행하지 못했습니다.
