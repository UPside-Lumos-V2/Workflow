---
description: Detect changes, identify domain, run appropriate tests
---

## 1. Detect changes

// turbo
`git diff --name-only HEAD`

## 2. Identify domain and select methodology

Check changed file paths against the rules below.
Read the matching `.agent/testing/<domain>.md` for test strategy and tools.
If multiple domains changed, run all matching.

| Changed path contains | Domain | Methodology | Commands |
|---|---|---|---|
| `.sol` | contract | `.agent/testing/contract.md` | `forge fmt --check && forge build && forge test -vvv` |
| `api/`, `server/`, `routes/`, `services/`, `middleware/` | backend | `.agent/testing/backend.md` | `npx vitest run` |
| `Cargo.toml`, `.rs` | rust | `.agent/testing/rust.md` | `cargo test` |
| `app/`, `components/`, `pages/`, `.tsx`, `.jsx` | frontend | `.agent/testing/frontend.md` | `npx vitest run` |

## 3. Contract domain

// turbo
3-1. `forge fmt --check`

// turbo
3-2. `forge build`

// turbo
3-3. `FOUNDRY_OFFLINE=true forge test -vvv`

// turbo
3-4. `FOUNDRY_OFFLINE=true forge snapshot`

// turbo
3-5. `FOUNDRY_OFFLINE=true forge coverage --report summary`

## 4. Backend domain

// turbo
4-1. `npx vitest run`

## 5. Rust domain

// turbo
5-1. `cargo test`

## 6. Frontend domain

// turbo
6-1. `npx vitest run`

## 7. Verdict

All domains passed → PASS.
Any failure → FAIL. Report which domain and test failed.
