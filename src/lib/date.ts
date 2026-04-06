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

/** 주어진 날짜가 속한 주의 화요일 반환 (로컬 타임존, 주간 기준: 화~월) */
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=일 1=월 2=화 3=수 4=목 5=금 6=토
  // 화요일(2) 기준: 현재 요일에서 화요일까지의 거리 계산
  const diff = (day < 2 ? day + 5 : day - 2); // 일=5, 월=6, 화=0, 수=1, …, 토=4
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return toLocalDateString(d);
}
