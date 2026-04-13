/**
 * 멤버 이름 → 텔레그램 유저네임 매핑
 * 텔레그램 알림에서 실제 @mention 태그에 사용
 */
export const MEMBER_TELEGRAM_MAP: Record<string, string> = {
  Erwin: '@bitcoin_vibe',
  Ethan: '@n4mchun',
  Omin: '@omin_00',
  Tamaneko: '@tamaNek0',
  Wi11y: '@luckyswilly',
  Wiimdy: '@wiimdy',
  Yham: '@Yunsikkkk',
};

/**
 * 텍스트 내 멤버 이름을 텔레그램 @username 태그로 변환
 * - 멤버 이름이 단어 경계에 있을 때만 치환 (부분 매칭 방지)
 * - "@멤버이름" 형태도 처리
 * - 이미 텔레그램 ID가 포함된 경우 중복 변환 방지
 */
export function tagMembers(text: string): string {
  let result = text;
  for (const [name, tgId] of Object.entries(MEMBER_TELEGRAM_MAP)) {
    // 이미 해당 텔레그램 ID가 포함되어 있으면 스킵
    if (result.includes(tgId)) continue;

    // "@멤버이름" 패턴 → 텔레그램 ID로 변환
    const atPattern = new RegExp(`@${name}(?=[\\s,.)!?:;\\]|$])`, 'g');
    result = result.replace(atPattern, tgId);

    // "멤버이름" 단독 사용 시에는 변환하지 않음 (의도적)
    // 태그하고 싶을 때만 @를 붙여서 사용
  }
  return result;
}

/**
 * 멤버 이름으로 텔레그램 태그 문자열 반환
 * 예: getMemberTag('Erwin') → '@bitcoin_vibe'
 *     getMemberTag('Unknown') → 'Unknown'
 */
export function getMemberTag(name: string): string {
  return MEMBER_TELEGRAM_MAP[name] ?? name;
}
