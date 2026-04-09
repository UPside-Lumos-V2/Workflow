# Incident Input Template

이 템플릿을 채워서 `pre-lumos` 스킬에 입력으로 전달하세요.
필수 항목(★)은 반드시 입력해야 합니다. 선택 항목은 알 수 있는 범위에서 채우세요.

---

## ★ 기본 정보

- **프로토콜/프로젝트명 (`name`)**: 
- **사고 날짜 (`hackedAt`, YYYY-MM-DD)**: 
- **관련 체인 (`chains`)**: 
- **피해 금액 (`amount`, USD)**: 
- **공격 유형 (`category`)**: 

> category 후보: `Contract Vulnerability`, `Rugpull`, `Fraud`, `Control Hijacking`,
> `Source Code Vulnerability`, `Compiler Vulnerability`, `Stablecoin Depeg`,
> `Malicious Governance Proposal`, `Government Sanctions`, `Circulating Supply`, `Unknown`

## 선택: 분류

- **하위 분류 (`category2`)**: 
- **DeFi 유형 (`subcategory`)**: 

> subcategory 후보: `Lending`, `DEX`, `Yield`, `Staking`, `CEX`, `Perpetual`,
> `Synthetics`, `Token`, `Unknown`

## 선택: 사건 개요 (`summary`)

> 아래에 사건 개요, 공격 벡터, 취약점 분석 등을 자유롭게 서술하세요.




## 선택: 감사 이력

### 사전 감사 (`preAudits`)

| 감사 회사 (`firm`) | 범위 (`scope`: In Scope / Out of Scope) | 날짜 (`timestamp`, YYYY-MM-DD) | 보고서 URL (`reportUrl`) |
|-----------|-------------------------------|-------------------|-----------|
|           |                               |                   |           |

- **사전 감사 상태 (`preIncidentAuditStatus`)**: (yes / no / null)

### 사후 감사 (`postAudits`)

| 감사 회사 | 범위 | 날짜 | 보고서 URL |
|-----------|------|------|-----------|
|           |      |      |           |

- **사후 감사 상태 (`postIncidentAuditStatus`)**: (yes / no / null)

## 선택: 사후 대응

- **포스트모템 상태 (`postmortemStatus`)**: (yes / no / null)
- **포스트모템 URL**: 
- **포스트모템 날짜 (YYYY-MM-DD)**: 

## 선택: 피해 보상

- **보상 상태 (`compensationStatus`)**: (yes / no / rugged / null)
- **보상 상세 (`compensation.detail`)**: 

## 선택: 자금 흐름 (`fund`)

- **자금 이동 경로 (`fund.destinations`)**: (예: Tornado Cash, Binance, ...)
- **관련 주소/TX**:

| 레이블 (`value`) | 링크 URL (`url`) | 유형 (`type`: mixer / bridge / cex) |
|------------|---------|---------------------------|
|            |         |                           |

## 선택: 프로젝트 정보

- **Twitter 핸들 (`twitter`)**: (예: EulerFinance, @ 없이)
- **Website URL (`website`)**: 
- **Logo Image URL (`logoImage`)**: 

---

## 사용법

### Path A (웹 분석)
위 내용을 채운 후 AnalyzerPage의 **[텍스트 분석]** 탭에 붙여넣기

### Path B (로컬 에이전트)
```
# 1. 이 파일을 복사하여 채우기 (예: input/euler-2023.md)
# 2. 에이전트에게 스킬과 함께 전달:

Use pre-lumos skill at ./skills-pre-lumos/ on ./input/euler-2023.md
Target year: 2023
```
