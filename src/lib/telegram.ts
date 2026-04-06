/**
 * 텔레그램 그룹챗 알림 유틸
 * fire-and-forget — 실패해도 UI 블로킹 없음
 */
export function sendTelegramNotification(text: string): void {
  fetch('/api/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch((err) => {
    console.warn('[Telegram] 알림 전송 실패:', err);
  });
}
