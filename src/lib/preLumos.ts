// ============================================================
// Pre-Lumos Orchestrator + Path B Parser + Row → Case Converter
// ============================================================

import type {
  PreLumosRow,
  AnalyzeResponse,
  ValidateResponse,
  RepairResponse,
  PipelineState,
  ValidatorFinding,
} from '../types/preLumos';
import type { CaseIncidentData, CasePriority, ScoreTimelineEntry } from '../types';
import {
  SYSTEM_INSTRUCTION_ANALYZE,
  SYSTEM_INSTRUCTION_VALIDATE,
  SYSTEM_INSTRUCTION_REPAIR,
  buildAnalysisPrompt,
  buildValidationPrompt,
  buildRepairPrompt,
} from './preLumosPrompt';

// ─────────────────────────────────────────────────────
// Generic Gemini API call via /api/analyze
// ─────────────────────────────────────────────────────

import { supabase } from './supabase';

async function getAuthToken(): Promise<string> {
  if (!supabase) return '';
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

async function callGemini<T>(systemInstruction: string, prompt: string): Promise<T> {
  const token = await getAuthToken();

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ systemInstruction, prompt }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `API error: ${res.status}`);
  }

  const data = await res.json();
  return data.result as T;
}

// ─────────────────────────────────────────────────────
// Path A: Orchestrated Pipeline (3-pass)
// ─────────────────────────────────────────────────────

export type PipelineCallback = (state: Partial<PipelineState>) => void;

/**
 * Path A 전체 파이프라인 실행
 * Call 1 (Phase 1-4) → Call 2 (Phase 5) → [조건부] Call 3 (Phase 6)
 */
export async function runOrchestrator(
  rawText: string,
  year: number | undefined,
  onUpdate: PipelineCallback,
): Promise<{
  finalRows: PreLumosRow[];
  exceptions: string[];
}> {
  // ── Call 1: 추출 + 정규화 (Phase 1-4) ──
  onUpdate({ phase: 'extracting' });

  const analyzeResult = await callGemini<AnalyzeResponse>(
    SYSTEM_INSTRUCTION_ANALYZE,
    buildAnalysisPrompt(rawText, year),
  );

  const rows = analyzeResult.rows || [];
  onUpdate({
    phase: 'extracted',
    rows,
  });

  if (rows.length === 0) {
    return { finalRows: [], exceptions: ['No incidents could be extracted from the input text.'] };
  }

  // ── Call 2: 검증 Swarm (Phase 5) ──
  onUpdate({ phase: 'validating' });

  const validateResult = await callGemini<ValidateResponse>(
    SYSTEM_INSTRUCTION_VALIDATE,
    buildValidationPrompt(rows),
  );

  const contractFindings = validateResult.contractResult?.findings || [];
  const ruleFindings = validateResult.ruleResult?.findings || [];
  const allFindings: ValidatorFinding[] = [...contractFindings, ...ruleFindings];

  onUpdate({
    phase: 'validated',
    contractResult: validateResult.contractResult || { validator: 'contract-validator', scope: 'row-batch', status: 'pass', findings: [] },
    ruleResult: validateResult.ruleResult || { validator: 'rule-validator', scope: 'row-batch', status: 'pass', findings: [] },
  });

  // ── 검증 통과 → Call 3 생략 ──
  if (allFindings.length === 0) {
    return { finalRows: rows, exceptions: [] };
  }

  // ── Call 3: 수리 + 재검증 (Phase 6) ──
  onUpdate({ phase: 'repairing' });

  const repairResult = await callGemini<RepairResponse>(
    SYSTEM_INSTRUCTION_REPAIR,
    buildRepairPrompt(rows, allFindings),
  );

  const repairedRows = repairResult.repairedRows || rows;
  const exceptions = repairResult.exceptions || [];

  onUpdate({
    phase: 'repaired',
    repairedRows,
    exceptions,
  });

  // F-2: 재검증 결과 소비 — blocker가 남아있으면 해당 row 제외
  if (repairResult.revalidation?.status === 'fail') {
    const blockerSlugs = new Set(
      (repairResult.revalidation.findings || [])
        .filter(f => f.severity === 'blocker' && f.slug)
        .map(f => f.slug!),
    );
    if (blockerSlugs.size > 0) {
      return {
        finalRows: repairedRows.filter(r => !blockerSlugs.has(r.slug)),
        exceptions: [
          ...exceptions,
          ...Array.from(blockerSlugs).map(s => `${s}: revalidation blocker`),
        ],
      };
    }
  }

  return { finalRows: repairedRows, exceptions };
}

// ─────────────────────────────────────────────────────
// Path B: JSON Import (클라이언트 사이드)
// ─────────────────────────────────────────────────────

const REQUIRED_FIELDS: Array<keyof PreLumosRow> = [
  'slug', 'name', 'hackedAt', 'chains', 'amount', 'category',
];

/**
 * Path B: JSON 문자열 → PreLumosRow[] 파싱 + 구조 확인
 * 검증은 생략 (로컬 에이전트가 이미 완료)
 */
export function parseAndValidateImportJson(
  jsonStr: string,
): { rows: PreLumosRow[]; errors: string[] } {
  const errors: string[] = [];

  // 1. JSON 파싱
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { rows: [], errors: ['Invalid JSON: 파싱에 실패했습니다.'] };
  }

  // 2. 최상위 배열 확인 (CON-001)
  if (!Array.isArray(parsed)) {
    return { rows: [], errors: ['CON-001: 최상위가 배열이 아닙니다.'] };
  }

  // 3. 각 행 구조 확인 — F-1: 필수 필드 누락 row는 skip
  const rows: PreLumosRow[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (typeof row !== 'object' || row === null) {
      errors.push(`Row ${i}: 객체가 아닙니다.`);
      continue;
    }

    // 필수 필드 확인
    let hasRequiredError = false;
    for (const field of REQUIRED_FIELDS) {
      if (!(field in row) || row[field] === undefined || row[field] === null) {
        errors.push(`Row ${i} (${row.slug || row.name || '?'}): 필수 필드 '${field}' 누락`);
        hasRequiredError = true;
      }
    }

    // chains 배열 확인
    if ('chains' in row && !Array.isArray(row.chains)) {
      errors.push(`Row ${i} (${row.slug || '?'}): chains가 배열이 아닙니다.`);
      hasRequiredError = true;
    }

    // amount 숫자 확인
    if ('amount' in row && typeof row.amount !== 'number') {
      errors.push(`Row ${i} (${row.slug || '?'}): amount가 숫자가 아닙니다.`);
      hasRequiredError = true;
    }

    // 에러 있는 row는 skip (fail-closed)
    if (hasRequiredError) continue;

    rows.push(row as PreLumosRow);
  }

  return { rows, errors };
}

// ─────────────────────────────────────────────────────
// Row → CaseIncidentData 변환
// ─────────────────────────────────────────────────────

const DEFAULT_SCORE_TIMELINE: ScoreTimelineEntry[] = [
  { label: 'Pre-Incident Audit', date: null, status: 'none' },
  { label: 'Hacked', date: null, status: 'pending' },
  { label: 'Post-Mortem Release', date: null, status: 'none' },
  { label: 'Post-Incident Audit', date: null, status: 'none' },
  { label: 'Compensation', date: null, status: 'none' },
];

function determinePriority(amount: number): CasePriority {
  if (amount >= 100_000_000) return 'high';
  if (amount >= 1_000_000) return 'medium';
  return 'low';
}

/**
 * PreLumosRow → CaseIncidentData + Case 메타 변환
 */
export function preLumosRowToCaseInput(row: PreLumosRow): {
  title: string;
  status: 'active';
  priority: CasePriority;
  description: string;
  metadata: Record<string, string>;
  incidentData: CaseIncidentData;
} {
  // scoreTimeline 생성 — 대소문자 무관 비교 (Gemini가 'Yes'/'YES' 등 반환 가능)
  const isYes = (v: string | undefined | null) => v?.toLowerCase() === 'yes';

  const timeline: ScoreTimelineEntry[] = DEFAULT_SCORE_TIMELINE.map((entry) => {
    const clone = { ...entry };
    if (entry.label === 'Hacked') {
      clone.date = row.hackedAt;
      clone.status = 'completed';
    }
    if (entry.label === 'Pre-Incident Audit' && isYes(row.preIncidentAuditStatus)) {
      clone.status = 'completed';
    }
    if (entry.label === 'Post-Mortem Release' && isYes(row.postmortemStatus)) {
      clone.status = 'completed';
    }
    if (entry.label === 'Post-Incident Audit' && isYes(row.postIncidentAuditStatus)) {
      clone.status = 'completed';
    }
    if (entry.label === 'Compensation' && isYes(row.compensationStatus)) {
      clone.status = 'completed';
    }
    return clone;
  });

  return {
    title: row.name,
    status: 'active',
    priority: determinePriority(row.amount),
    description: row.summary || `${row.name} — ${row.category} incident on ${row.chains.join(', ')}`,
    metadata: {
      source: 'pre-lumos-analyzer',
      importedAt: new Date().toISOString(),
    },
    incidentData: {
      slug: row.slug,
      hackedAt: row.hackedAt,
      chains: row.chains,
      amount: row.amount,
      category: row.category,
      subcategory: row.subcategory,
      summary: row.summary,
      compensationStatus: row.compensationStatus,
      preIncidentAuditStatus: row.preIncidentAuditStatus,
      postIncidentAuditStatus: row.postIncidentAuditStatus,
      postmortemStatus: row.postmortemStatus,
      compensation: row.compensation,
      preAudits: row.preAudits ?? [],
      postAudits: row.postAudits ?? [],
      postmortem: row.postmortem ?? [],
      fund: row.fund,
      twitter: row.twitter,
      website: row.website,
      logoImage: row.logoImage,
      category2: row.category2,
      lumosScore: null,
      scoreTimeline: timeline,
    },
  };
}

/**
 * 여러 행을 Cases로 등록
 */
export async function registerRowsAsCases(
  rows: PreLumosRow[],
  addCase: (input: {
    title: string;
    status: 'active';
    priority: CasePriority;
    description: string;
    metadata: Record<string, string>;
    incidentData: CaseIncidentData;
  }) => Promise<{ id: string } | null>,
): Promise<{ registered: string[]; failed: string[] }> {
  const registered: string[] = [];
  const failed: string[] = [];

  for (const row of rows) {
    try {
      const caseInput = preLumosRowToCaseInput(row);
      const result = await addCase(caseInput);
      if (result) {
        registered.push(row.slug);
      } else {
        failed.push(`${row.slug}: 등록 실패`);
      }
    } catch (err) {
      failed.push(`${row.slug}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  return { registered, failed };
}
