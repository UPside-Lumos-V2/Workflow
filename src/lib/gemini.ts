import type { MeetingSummary } from '../types';
import { buildMeetingPrompt, buildCaseParsePrompt } from './prompts';

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

/** 자유 텍스트에서 케이스 필드 자동 추출 */
export interface ParsedCaseData {
  title: string;
  protocol: string;
  chain: string;
  hackedAmount: number;
  hackedDate: string;
  attackVector: string[];
  description: string;
  priority: 'high' | 'medium' | 'low';
  lumosScore: number | null;
}

export async function parseCaseFromText(rawText: string): Promise<ParsedCaseData> {
  const prompt = buildCaseParsePrompt(rawText);

  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `AI 파싱 오류 (${res.status})`);
  }

  const data = await res.json();
  const parsed = data.result as ParsedCaseData;

  return {
    title: parsed.title ?? '',
    protocol: parsed.protocol ?? '',
    chain: parsed.chain ?? '',
    hackedAmount: parsed.hackedAmount ?? 0,
    hackedDate: parsed.hackedDate ?? '',
    attackVector: parsed.attackVector ?? [],
    description: parsed.description ?? '',
    priority: parsed.priority ?? 'medium',
    lumosScore: parsed.lumosScore ?? null,
  };
}

