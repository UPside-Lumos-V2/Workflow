# CURRENT SPRINT

## Goal
LUMOS_2 Phase 0: DeFi 해킹 자동 감지 파이프라인 구축
SNS(Telegram + Twitter) 수집 → 정규화 → 그룹핑 → 알림

## Active Task
- **ID**: hack-detector-phase0
- **Branch**: main
- **Status**: Phase 0.2 완료, Phase 0.3 (알림 봇) 대기
- **Worktree**: hack-detector/

## Completed (이번 세션)
- Phase 0.1 (Telegram 리스닝) ✅ 전체 완료
- Phase 0.2 (Twitter/X + Grouping) ✅ 전체 완료
  - httpx 직접 GraphQL Twitter 폴러
  - xAI Grok x_search 폴백
  - last_ids.json 영구 캐시
  - Incident Grouper (tx_hash/protocol/attacker 3-rule)
  - Confidence Scorer (최대 140점)
  - Workflow UI 소스 링크
  - 교차 소스 E2E 테스트 통과 (Telegram + Twitter → confidence 110)

## Files in Focus
- hack-detector/src/listeners/twitter.py (Twitter 폴러)
- hack-detector/src/grouper.py (Incident Grouper)
- hack-detector/src/scorer.py (Confidence Scorer)
- hack-detector/src/storage/supabase_store.py (Grouper+Scorer 연동)
- Workflow/src/pages/HackSignalsPage.tsx (UI)

## Blockers
- Twitter 쿠키 수동 갱신 필요 (자동화 없음)
- protocols.yaml 프로토콜 사전 부족

## Next Steps
1. T0.3 알림 봇 구현 (plan 승인 완료)
   - alerter.py (Alert Engine)
   - Workflow Telegram 봇 재활용
   - 3단계 알림: 첫 알림 → 팔로업 → 사일런트
2. T0.4 안정화 (에러 핸들링, 로깅, GCP 배포)

## Brain Task Reference
- Conversation ID: cf70fec8-01c2-4b27-9cf2-783af6f47dc6
- Task Path: `~/.gemini/antigravity/brain/cf70fec8-01c2-4b27-9cf2-783af6f47dc6/task.md`
- Status: in-progress

---
*Updated: 2026-04-27T18:23:00+09:00*
*This file is used for immediate context recovery at session start.*
*Update this file when switching tasks.*
