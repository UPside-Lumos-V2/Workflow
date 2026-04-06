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

## 팀원 이름 (참고용)
${memberNames.map((n) => `- ${n}`).join('\n')}

## 규칙
1. 아래 회의록 내용(+ 녹음본 텍스트가 있으면 함께)을 읽고 지정된 JSON 형식으로 반환하세요.
2. **"tasks"는 회의에서 논의된 '앞으로 해야 할 일'만 추출하세요.** 지난주에 이미 완료했거나 보고한 내용은 tasks에 넣지 마세요.
3. "tasks"에 팀원 이름을 포함하지 마세요. 예: "OO가 XXX하기" (X) → "XXX하기" (O). 할 일 목록은 팀원 배정 없이 flat list로 작성하세요.
4. **내용을 줄이거나 요약하지 마세요.** 회의록에 언급된 세부 사항을 최대한 빠짐없이 포함하세요.
5. 목표, 할 일, 피드백은 구체적으로 작성하세요. 추상적으로 뭉치지 마세요.
6. 각 필드가 회의록에 언급되지 않았다면 빈 배열 또는 빈 문자열로 반환하세요.
7. 한글로 작성하세요.

## 출력 JSON 형식
{
  "goals": ["이번 주 목표1", "이번 주 목표2"],
  "tasks": ["앞으로 할 일1 — 구체적 내용", "앞으로 할 일2 — 구체적 내용"],
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
2. 텍스트에서 명시적으로 언급되지 않은 필드는 빈 문자열, 0, 또는 빈 배열로 반환하세요.
3. 추측하지 마세요 — 텍스트에 있는 정보만 사용하세요.
4. priority는 피해금액과 공격 복잡도를 고려하여 "high", "medium", "low" 중 선택하세요.
5. attackVector는 기술적 공격 벡터를 배열로 추출하세요 (예: Flash Loan, Reentrancy, Price Manipulation 등).
6. description은 사건 개요를 1~2문장으로 작성하세요 (한글).
7. hackedDate는 YYYY-MM-DD 형식으로 변환하세요.

## 출력 JSON 형식
{
  "title": "사건 제목 (프로토콜명 + 공격 유형, 영문)",
  "protocol": "프로토콜명",
  "chain": "체인명 (Ethereum, BSC, Arbitrum 등)",
  "hackedAmount": 피해금액(USD, 숫자만),
  "hackedDate": "YYYY-MM-DD",
  "attackVector": ["공격벡터1", "공격벡터2"],
  "description": "사건 개요 (한글, 1~2문장)",
  "priority": "high | medium | low",
  "lumosScore": null
}

## 입력 텍스트
${rawText}`;
}

