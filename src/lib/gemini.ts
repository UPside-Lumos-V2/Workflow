import type { MeetingSummary } from '../types';
import { buildMeetingPrompt } from './prompts';

/**
 * Vercel Serverless /api/summarize 를 통해 Gemini API 호출
 * → API Key는 서버 환경변수에만 존재 (브라우저 노출 없음)
 */
export async function summarizeMeetingNote(
  content: string,
  transcript: string,
  memberNames: string[],
): Promise<MeetingSummary> {
  const prompt = buildMeetingPrompt(content, transcript, memberNames);

  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `요약 API 오류 (${res.status})`);
  }

  const data = await res.json();
  const parsed = data.result as MeetingSummary;

  return {
    goals: parsed.goals ?? [],
    tasks: parsed.tasks ?? [],
    mentoringFeedback: parsed.mentoringFeedback ?? '',
    carryOver: parsed.carryOver ?? [],
  };
}
