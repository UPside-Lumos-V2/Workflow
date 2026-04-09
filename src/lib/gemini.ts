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
  slug: string;          // was: protocol
  chains: string[];      // was: chain (string)
  amount: number;        // was: hackedAmount
  hackedAt: string;      // was: hackedDate
  category: string;      // was: attackVector[0]
  subcategory: string | null;  // new
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = data.result as any;

  // LLM이 레거시 필드명으로 응답할 경우 대비 폴백
  const slug = parsed.slug || parsed.protocol || '';
  const chains = Array.isArray(parsed.chains)
    ? parsed.chains
    : parsed.chain
      ? [parsed.chain]
      : [];
  const amount = parsed.amount ?? parsed.hackedAmount ?? 0;
  const hackedAt = parsed.hackedAt || parsed.hackedDate || '';
  const category = parsed.category
    || (Array.isArray(parsed.attackVector) ? parsed.attackVector[0] : '')
    || 'Unknown';
  const subcategory = parsed.subcategory
    || (Array.isArray(parsed.attackVector) ? parsed.attackVector[1] : null)
    || null;

  return {
    title: parsed.title ?? '',
    slug,
    chains,
    amount,
    hackedAt,
    category,
    subcategory,
    description: parsed.description ?? '',
    priority: parsed.priority ?? 'medium',
    lumosScore: parsed.lumosScore ?? null,
  };
}

