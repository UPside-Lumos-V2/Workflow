/**
 * 날짜 유틸 — 로컬 타임존 기반
 * toISOString()은 UTC 기준이므로 KST에서 하루 밀림 방지
 */

/** Date → 'YYYY-MM-DD' (로컬 타임존 기준) */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 주어진 날짜가 속한 주의 월요일 반환 (로컬 타임존) */
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return toLocalDateString(d);
}
