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

  // 1단계: 웹앱 멘션 형식 "@[MemberName](uuid)" → 텔레그램 ID로 변환
  // 예: "@[Yham](b4e896f4-...)" → "@Yunsikkkk"
  result = result.replace(/@\[([^\]]+)\]\([^)]+\)/g, (_match, name: string) => {
    return MEMBER_TELEGRAM_MAP[name] ?? `@${name}`;
  });

  // 2단계: 단순 "@멤버이름" 패턴 → 텔레그램 ID로 변환
  for (const [name, tgId] of Object.entries(MEMBER_TELEGRAM_MAP)) {
    // 이미 해당 텔레그램 ID가 포함되어 있으면 스킵
    if (result.includes(tgId)) continue;

    const atPattern = new RegExp(`@${name}(?=[\\s,.)!?:;\\]|$])`, 'g');
    result = result.replace(atPattern, tgId);
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
