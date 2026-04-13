/**
 * 텔레그램 그룹챗 알림 유틸
 * fire-and-forget — 실패해도 UI 블로킹 없음
 * 텍스트 내 @멤버이름을 실제 텔레그램 유저네임으로 자동 변환
 */
import { tagMembers } from './memberTelegram';

export function sendTelegramNotification(text: string): void {
  const taggedText = tagMembers(text);
  fetch('/api/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: taggedText }),
  }).catch((err) => {
    console.warn('[Telegram] 알림 전송 실패:', err);
  });
}
