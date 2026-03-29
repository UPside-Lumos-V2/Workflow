# DEVELOPMENT PHASES

> Define your project's development process here.
> Customize phases based on project needs.

---

## Phase 1: Design

### Checklist
- [ ] Analyze requirements
- [ ] Research existing codebase
- [ ] Define interfaces/types first
- [ ] Create `task.md` (big picture)
- [ ] Create `implementation_plan.md` (details)
- [ ] Get user approval

### Key Outputs
- `task.md` - Task breakdown
- `implementation_plan.md` - Implementation details

---

## Phase 2: Implementation

### Checklist
- [ ] Implement core logic
- [ ] Update `task.md` as you progress ([/] → [x])
- [ ] Commit at each milestone
- [ ] Run `/verify` periodically

### Rules
- One feature per commit
- Follow Conventional Commits

---

## Phase 3: Testing (CRITICAL)

> ⚠️ **Testing is NOT optional. Every change MUST be tested.**

### 3.1 Automated Tests

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Build succeeds
- [ ] Lint passes

```bash
/verify          # Run all tests
npm run test     # Unit tests
npm run build    # Build check
```

### 3.2 Multi-Model Validation (NEW)

> 여러 AI 모델로 코드 검증하여 blind spot 제거

| 관점 | 모델 예시 | 검증 내용 |
|------|----------|----------|
| 로직 | Opus | 스펙 충족, 엣지케이스 |
| 보안 | Sonnet | XSS, 인증 취약점 |
| 품질 | Codex | 타입 안전성, 성능 |

**워크플로우**: `/multi-model-test` 실행
- 상세: `.agent/workflows/multi-model-test.md`

### 3.3 Manual Verification

- [ ] UI/UX 확인 (if applicable)
- [ ] Browser testing via `browser_subagent`

### Testing Philosophy

1. **No commit without passing tests**
2. **Test edge cases, not just happy path**
3. **If it's not tested, it's broken**
4. **Multi-model = Multi-perspective (blind spot 제거)**

---

## Phase 4: Completion

### Checklist
- [ ] Run `/pre-commit`
- [ ] Update `CURRENT_SPRINT.md`
- [ ] Create `walkthrough.md` (if significant)
- [ ] Final commit with proper message

---

*Customize these phases for your project's needs.*
