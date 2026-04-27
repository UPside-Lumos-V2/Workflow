# 테스트 요청서: hack-detector Alert Pipeline (Phase 0.3.5)

## 검증 대상

### 핵심 파일 (hack-detector)
- `src/alerter.py` — AlertRuleEngine (3-rule 판정)
- `src/deduplicator.py` — AlertDeduplicator (first_alert/follow_up/silent)
- `src/formatter.py` — AlertFormatter (N/5 메타데이터 식별 포맷)
- `src/storage/supabase_store.py` — SignalStore (alert 파이프라인 통합)
- `src/normalizer.py` — should_skip + has_hack_keyword
- `src/extractors/field_extractor.py` — 메타데이터 추출기
- `src/grouper.py` — IncidentGrouper (tx_hash > protocol+window > attacker+window)
- `src/scorer.py` — ConfidenceScorer (140점 체계)
- `src/models.py` — HackSignal 데이터 모델

### 참조 파일
- `src/listeners/twitter.py` — Twitter 폴러 (skip 로깅 누락 이슈)
- `migrations/003_alert_system.sql` — Alert 테이블 스키마
- `config/protocols.yaml` — 프로토콜 사전

### UI (Workflow)
- `src/pages/HackSignalsPage.tsx` — SourceBadge, AlertStatusBadge, 필터, Stats

## 아키텍처 컨텍스트

```
SNS 메시지 → should_skip() → extract_all() → HackSignal 생성
    → SignalStore.insert()
        ├→ IncidentGrouper.match_or_create() → lumos_incident_groups
        ├→ ConfidenceScorer.calculate_confidence()
        ├→ AlertRuleEngine.evaluate(group)
        │   ├→ AlertDeduplicator.check(group_id, group)
        │   ├→ AlertFormatter.format_first_alert() / format_follow_up()
        │   └→ _insert_alert() → lumos_hack_alerts (sent_at=NULL)
        └→ lumos_hack_signals (alert_status 포함)
```

---

## 검증 관점

### 1. 로직 검증 (logic)

**Alert 판정 정확도:**
- AlertRuleEngine Rule 1: 교차 채널 (source_types 2+ 종류) → critical
- AlertRuleEngine Rule 2: 단일 소스 + Tier 1 + confidence >= 70 → critical
- AlertRuleEngine Rule 3: 그 외 → silent
- 각 룰의 경계값 테스트 (confidence=69 vs 70, source_types 1개 vs 2개)

**Deduplication 정확도:**
- first_alert: 그룹 첫 알림
- follow_up: 기존 알림 + 새 tx_hash/loss_usd/attacker_address
- silent: 기존 알림 + 새 정보 없음

**Formatter 출력:**
- 메타데이터 N/5 식별 현황 정확도
- 5개 필드 (protocol_name, chain, tx_hash, loss_usd, attacker_address) 누락/존재 조합

**그룹핑 매칭:**
- tx_hash 완전 일치 → 동일 그룹
- protocol_name + 2시간 윈도우 → 동일 그룹
- attacker_address + 6시간 윈도우 → 동일 그룹
- 매칭 실패 → 새 그룹 생성

**Confidence 계산:**
- scorer.py의 기본 Tier 1 (40점) 하드코딩 문제
- 교차 소스 보너스 (+30)
- 필드 보너스 (tx_hash +20, loss_usd +10 등)
- 최대 140점 cap

### 2. 품질 검증 (quality)

**타입 안전성:**
- `group: dict` 타입의 None 처리 (`group.get()` 기본값)
- `AlertDecision`, `AlertMessage` dataclass 필드 타입
- supabase_store.py의 `signal.id` 타이밍 (insert 전에 alert에서 사용)

**에러 핸들링:**
- `_insert_alert()` 실패 시 signal 저장에 영향 없는지
- grouping 실패 시 alert 판정 스킵되는지
- deduplicator Supabase 쿼리 실패 시 fallback

**코드 구조:**
- alert 파이프라인이 insert() 안에 중첩 → 관심사 분리 부족
- formatter.py의 format_usd 중복 (HackSignalsPage.tsx에도 동일 로직)
- field_extractor.py의 ambiguous alias 세트 관리

**테스트 커버리지:**
- deduplicator는 Supabase 의존이라 단위 테스트 없음
- grouper, scorer 단위 테스트 없음
- E2E 하네스 미구현

### 3. 보안 검증 (security)

**입력 신뢰 경계:**
- raw_text를 통한 DB injection 가능성 (Supabase RPC vs REST)
- source_id 충돌/조작으로 중복 무시 가능성
- attacker_address 라벨 기반 추출의 조작 가능성

**API 보안:**
- Supabase anon key vs service role key 사용 구분
- lumos_hack_alerts RLS 정책 존재 여부
- alert 무한 루프 방지 (같은 그룹에 계속 follow_up 생성 가능?)

**Rate limit:**
- Twitter 429 처리 (지수 백오프 vs 고정 interval)
- xAI 일일 예산 cap ($0.50) 우회 가능성

---

## 응답 형식

각 모델은 다음 형식으로 작성:

```markdown
# 검증 결과: {관점}

## 판정: Pass / Conditional Pass / Fail

## Critical Issues (반드시 수정)
- [ ] Issue 1: 설명 + 파일:라인

## Warnings (권장 수정)
- [ ] Warning 1: 설명

## Info (참고 사항)
- Info 1: 설명
```

## 파일 네이밍 규칙 (필수)

결과 파일을 작성할 때 반드시 아래 네이밍 규칙을 따르세요:

**형식: `.agent/testing/result-{관점}_{모델명}.md`**

- `{관점}`: 배정받은 검증 관점 (logic, security, quality)
- `{모델명}`: 작성하는 모델/도구 이름 (claude, codex, gemini, gpt)

예시:
- Claude가 로직 검증 → `result-logic_claude.md`
- Codex가 품질 검증 → `result-quality_codex.md`
- Gemini가 보안 검증 → `result-security_gemini.md`

이 규칙을 지키지 않으면 취합 단계에서 파일을 식별할 수 없습니다.
