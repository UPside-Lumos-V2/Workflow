// ============================================================
// Pre-Lumos Pipeline Types
// ============================================================

// --- Pre-Lumos Row (output contract 형태) ---

export interface PreLumosRow {
  slug: string;
  name: string;
  hackedAt: string;                       // YYYY-MM-DD
  chains: string[];
  amount: number;
  category: string;
  subcategory: string | null;
  summary: string | null;
  compensationStatus: 'yes' | 'no' | 'rugged' | null;
  preIncidentAuditStatus: 'yes' | 'no' | 'rugged' | null;
  postIncidentAuditStatus: 'yes' | 'no' | 'rugged' | null;
  postmortemStatus: 'yes' | 'no' | 'rugged' | null;
  compensation: { detail: string | null };
  preAudits: PreLumosAuditRow[];
  postAudits: PreLumosAuditRow[];
  postmortem: Array<{ url: string; timestamp: string }>;
  fund: PreLumosFundRow | null;
  twitter: string | null;
  website: string | null;
  logoImage: string | null;
  category2: string | null;
}

export interface PreLumosAuditRow {
  firm: string | null;
  scope: 'In Scope' | 'Out of Scope' | null;
  timestamp: string | null;
  date?: string | null;                   // fallback input only
  reportUrl: string | null;
}

export interface PreLumosFundLinkRow {
  value: string | null;
  url: string;
  type: string | null;
}

export interface PreLumosFundRow {
  destinations: string[];
  destinations2: Array<{ name: string | null; percent: number | null }>;
  links: PreLumosFundLinkRow[];
  lastUpdatedAt: string | null;
}

// --- Validator Finding Schema ---

export type FindingSeverity = 'blocker' | 'repairable' | 'warning';
export type FindingFixClass = 'deterministic' | 'evidence-recovery' | 'manual-only';
export type FindingAppliesTo = 'touched-row' | 'merged-file' | 'legacy-warning';

export interface ValidatorFinding {
  slug: string | null;
  severity: FindingSeverity;
  ruleId: string;
  fieldPath: string;
  problem: string;
  recommendedFix: string;
  fixClass: FindingFixClass;
  appliesTo: FindingAppliesTo;
}

export interface ValidatorResult {
  validator: string;
  scope: 'row-batch' | 'merged-payload';
  status: 'pass' | 'fail';
  findings: ValidatorFinding[];
}

// --- API Response Types ---

export interface AnalyzeResponse {
  rows: PreLumosRow[];
  metadata: {
    year: number;
    incidentCount: number;
  };
}

export interface ValidateResponse {
  contractResult: ValidatorResult;
  ruleResult: ValidatorResult;
}

export interface RepairResponse {
  repairedRows: PreLumosRow[];
  revalidation: ValidatorResult;
  exceptions: string[];
}

// --- Orchestrator State ---

export type PipelinePhase =
  | 'idle'
  | 'extracting'       // Call 1 진행 중
  | 'extracted'         // Call 1 완료
  | 'validating'        // Call 2 진행 중
  | 'validated'         // Call 2 완료
  | 'repairing'         // Call 3 진행 중
  | 'repaired'          // Call 3 완료
  | 'registering'       // Cases 등록 중
  | 'complete'          // 등록 완료
  | 'error';

export interface PipelineState {
  phase: PipelinePhase;
  rows: PreLumosRow[];
  contractResult: ValidatorResult | null;
  ruleResult: ValidatorResult | null;
  repairedRows: PreLumosRow[];
  exceptions: string[];
  registeredSlugs: string[];
  error: string | null;
}

export const INITIAL_PIPELINE_STATE: PipelineState = {
  phase: 'idle',
  rows: [],
  contractResult: null,
  ruleResult: null,
  repairedRows: [],
  exceptions: [],
  registeredSlugs: [],
  error: null,
};
