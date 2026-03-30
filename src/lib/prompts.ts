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
2. "tasks"는 팀원별로 분류하지 마세요. 할 일 목록을 flat list로 작성하세요.
3. **내용을 줄이거나 요약하지 마세요.** 회의록에 언급된 세부 사항을 최대한 빠짐없이 포함하세요.
4. 목표, 할 일, 피드백은 구체적으로 작성하세요. 추상적으로 뭉치지 마세요.
5. 각 필드가 회의록에 언급되지 않았다면 빈 배열 또는 빈 문자열로 반환하세요.
6. 한글로 작성하세요.

## 출력 JSON 형식
{
  "goals": ["이번 주 목표1", "이번 주 목표2"],
  "tasks": ["할 일1 — 구체적 내용", "할 일2 — 구체적 내용"],
  "mentoringFeedback": "멘토링 피드백 전문 (줄이지 말 것)",
  "carryOver": ["다음 주로 이월할 항목1"]
}

## 회의록 내용
${noteContent}
${transcriptSection}`;
}
