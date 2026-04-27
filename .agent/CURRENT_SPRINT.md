# CURRENT SPRINT

## Goal
LUMOS_2 Phase 0: DeFi 해킹 자동 감지 파이프라인 구축
SNS(Telegram + Twitter) 수집 → 정규화 → LLM 분류 → 그룹핑 → 알림

## Active Task
- **ID**: hack-detector-phase0
- **Branch**: main
- **Status**: Phase 0.5 배포 완료 (fxTwitter + Gemini LLM). 실 메시지 수신 검증 대기.
- **Worktree**: hack-detector/

## Completed (이번 세션)
- Phase 0.4 (GCP 배포, systemd, 보안 감사) ✅
- Phase 0.5 (fxTwitter + Gemini LLM 분류) ✅
  - fxtwitter API로 참조 트윗 URL resolve → raw_text append
  - Gemini 3 Flash (gemini-3-flash-preview) 기반 LLM 분류기
  - regex→LLM 2단계 파이프라인 (regex 우선, LLM 보강)
  - normalizer.py async 전환
  - 서버 v0.5.0 배포 완료, active (running)

## Files in Focus
- hack-detector/src/extractors/tweet_resolver.py (fxTwitter resolve)
- hack-detector/src/classifiers/gemini_classifier.py (Gemini 분류)
- hack-detector/src/normalizer.py (async + regex→LLM merge)
- hack-detector/src/listeners/telegram.py (await process_message)
- hack-detector/src/listeners/twitter.py (tweet URL append)

## Blockers
- Twitter 쿠키 수동 갱신 필요 (자동화 없음)
- protocols.yaml 프로토콜 사전 부족
- 실 메시지 수신 시 Gemini 분류 로그 확인 필요

## Next Steps
1. 실 메시지 수신 검증 (journalctl로 Gemini 분류 로그 확인)
2. Gemini 분류 결과(is_hack, category, summary) → Supabase 별도 컬럼 저장
3. Telegram Bot 알림 구현 (감지 결과를 팀 채널로 push)
4. Forta Network 온체인 감지 연동

## Brain Task Reference
- Conversation ID: 9f1c68f1-6021-4d45-a9e2-4e4cd75ac485
- Task Path: `~/.gemini/antigravity/brain/9f1c68f1-6021-4d45-a9e2-4e4cd75ac485/task.md`
- Status: in-progress

---
*Updated: 2026-04-28T01:19:00+09:00*
*This file is used for immediate context recovery at session start.*
*Update this file when switching tasks.*
