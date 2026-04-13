/**
 * 회의록 요약 프롬프트 빌더
 * Gemini JSON mode용 — 한글 지시문
 */
export function buildMeetingPrompt(
  noteContent: string,
  transcriptContent: string,
  memberNames: string[],
): string {
  const transcriptSection = transcriptContent
    ? `\n## 회의 녹음본 텍스트\n${transcriptContent}`
    : '';

  return `당신은 팀 회의록을 분석하여 핵심 정보를 구조화하는 어시스턴트입니다.

## 중요 컨텍스트
이 회의는 **주간 사이클(화요일~월요일)의 마지막 날(월요일)**에 진행됩니다.
요약 결과는 **다음 주(화요일 시작) 주간보드**에 반영됩니다.

## 팀원 이름 (참고용)
${memberNames.map((n) => `- ${n}`).join('\n')}

## ⚠️ 회의록 구조 인식 규칙 (가장 중요)

이 회의록은 아래 2개 섹션으로 구분됩니다:

### 🔴 금지 영역: "📋 멤버별 이번 주 한 일 정리" 섹션
- 이 섹션은 **이번 주에 이미 완료한 작업 보고**입니다.
- 이 섹션의 모든 내용은 **과거 완료 사항**입니다.
- 이 섹션에서 goals, tasks를 절대 추출하지 마세요.
- 체크박스([x], [ ])가 있는 항목은 모두 과거 작업입니다.

### 🟢 추출 대상: "📝 회의 내용" 섹션 (이후의 모든 내용)
- 이 섹션부터가 **실제 회의 논의 내용**입니다.
- goals, tasks, mentoringFeedback, carryOver는 **오직 이 섹션에서만** 추출하세요.
- 이 섹션 내에서도 "~했다", "~완료했다", "~진행했다", "~분석했다" 등 **과거형 서술은 이미 한 일**이므로 tasks/goals에 넣지 마세요.
- "~해야 한다", "~하기로 했다", "~할 예정", "~하면 좋겠다", "다음 주에 ~" 등 **미래/계획 서술만** tasks/goals에 포함하세요.

## 규칙
1. 아래 회의록 내용(+ 녹음본 텍스트가 있으면 함께)을 읽고 지정된 JSON 형식으로 반환하세요.
2. **"tasks"는 '📝 회의 내용' 섹션에서 논의된 '앞으로(다음 주) 해야 할 일'만 추출하세요.**
3. **"goals"는 '다음 주 목표'만 추출하세요.** 이번 주에 달성한 성과는 goals에 넣지 마세요.
4. "tasks"에 팀원 이름을 포함하지 마세요. 예: "OO가 XXX하기" (X) → "XXX하기" (O). 할 일 목록은 팀원 배정 없이 flat list로 작성하세요.
5. **내용을 줄이거나 요약하지 마세요.** 회의록에 언급된 세부 사항을 최대한 빠짐없이 포함하세요.
6. 목표, 할 일, 피드백은 구체적으로 작성하세요. 추상적으로 뭉치지 마세요.
7. 각 필드가 회의록에 언급되지 않았다면 빈 배열 또는 빈 문자열로 반환하세요.
8. 한글로 작성하세요.
9. "mentoringFeedback"에는 멘토가 준 피드백, 조언, 지시 사항을 그대로 기록하세요 (과거/현재 시점 상관없이 포함).
10. "carryOver"에는 이번 주 미완료 항목 중 다음 주로 넘겨야 할 것만 포함하세요.

## 출력 JSON 형식
{
  "goals": ["다음 주 목표1", "다음 주 목표2"],
  "tasks": ["다음 주에 할 일1 — 구체적 내용", "다음 주에 할 일2 — 구체적 내용"],
  "mentoringFeedback": "멘토링 피드백 전문 (줄이지 말 것)",
  "carryOver": ["다음 주로 이월할 항목1"]
}

## 회의록 내용
${noteContent}
${transcriptSection}`;
}

/**
 * 케이스 자동 파싱 프롬프트 빌더
 * 자유 텍스트 → 케이스 필드 JSON 추출
 */
export function buildCaseParsePrompt(rawText: string): string {
  return `당신은 DeFi/블록체인 보안 사고 정보를 구조화하는 전문 어시스턴트입니다.

## 규칙
1. 아래 텍스트에서 보안 사고 정보를 추출하여 JSON 형식으로 반환하세요.
2. 텍스트에서 명시적으로 언급되지 않은 필드는 빈 문자열, 0, 빈 배열, 또는 null로 반환하세요.
3. 추측하지 마세요 — 텍스트에 있는 정보만 사용하세요.
4. priority는 피해금액과 공격 복잡도를 고려하여 "high", "medium", "low" 중 선택하세요.
5. category는 대분류 공격 유형 (예: Contract Vulnerability, Flash Loan Attack, Rug Pull, Bridge Exploit).
6. subcategory는 프로토콜 DeFi 유형 (예: Lending, DEX, Bridge, Yield). 모르면 null.
7. slug는 "프로토콜명-연도" 형식의 고유 ID (예: euler-finance-2023). 소문자, 하이픈 구분.
8. chains는 관련 체인 배열 (예: ["Ethereum"], ["Ethereum", "Arbitrum"]).
9. description은 사건 개요를 1~2문장으로 작성하세요 (한글).
10. hackedAt은 YYYY-MM-DD 형식으로 변환하세요.

## 출력 JSON 형식
{
  "title": "사건 제목 (프로토콜명 + 공격 유형, 영문)",
  "slug": "프로토콜명-연도 (소문자, 하이픈)",
  "chains": ["체인명1", "체인명2"],
  "amount": 피해금액(USD 숫자만),
  "hackedAt": "YYYY-MM-DD",
  "category": "대분류 공격 유형",
  "subcategory": "DeFi 유형 또는 null",
  "description": "사건 개요 (한글, 1~2문장)",
  "priority": "high | medium | low",
  "lumosScore": null
}

## 입력 텍스트
${rawText}`;
}

