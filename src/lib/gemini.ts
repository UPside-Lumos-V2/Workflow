import type { MeetingSummary } from '../types';
import { buildMeetingPrompt } from './prompts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

/**
 * Gemini API로 회의록 내용을 요약하여 MeetingSummary를 반환
 */
export async function summarizeMeetingNote(
  content: string,
  transcript: string,
  memberNames: string[],
): Promise<MeetingSummary> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다');

  const prompt = buildMeetingPrompt(content, transcript, memberNames);

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류 (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini API 응답이 비어있습니다');

  const parsed = JSON.parse(text) as MeetingSummary;

  // 기본값 보장
  return {
    goals: parsed.goals ?? [],
    tasks: parsed.tasks ?? [],
    mentoringFeedback: parsed.mentoringFeedback ?? '',
    actionItems: parsed.actionItems ?? [],
    carryOver: parsed.carryOver ?? [],
  };
}
