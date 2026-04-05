// ============================================================
// LUMOS Core Types
// ============================================================

// --- Enums & Literals ---

export type CaseStatus = 'active' | 'review' | 'closed';

export type CasePriority = 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export type TaskLabel = '분석' | '개발' | '조사' | '운영';

export type ArtifactType = 'file' | 'link' | 'code';

export type NoteStatus = 'draft' | 'published';

// --- Base Entity ---

interface BaseEntity {
  id: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// --- Member ---

export interface Member extends BaseEntity {
  name: string;
  avatar?: string; // URL or initials fallback
  roleDescription?: string; // 자유 텍스트, 현재 맡고 있는 일 설명
}

// --- Case ---

export interface Case extends BaseEntity {
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  description: string; // 간단 설명 (plain text or HTML)
  // exploit 관련 메타데이터 (자유 필드)
  metadata: Record<string, string>; // e.g., { protocol: "CrossCurve", chain: "Ethereum", txHash: "0x...", lossUsd: "1200000" }
}

// --- Task ---

export interface Task extends BaseEntity {
  caseId: string;
  title: string;
  description: string;
  status: TaskStatus;
  label: TaskLabel;
  assigneeId: string | null; // Member.id
  sortOrder: number; // 정렬 순서 (DB: sort_order)
}

// --- Artifact ---

export interface Artifact extends BaseEntity {
  caseId: string;
  taskId: string | null; // 특정 Task에 연결되거나, Case 레벨에서 직접 첨부
  name: string;
  type: ArtifactType;
  url: string; // 링크 또는 파일 경로
  content: string; // code snippet이면 코드 본문, 그 외엔 빈 문자열
  description: string; // 간단 설명
}

// --- Discussion ---

export type DiscussionContext = 'case' | 'task' | 'topic';

export interface DiscussionAttachment {
  name: string;
  url: string; // base64 data URL or external link
  type: string; // MIME type
}

export interface Discussion extends BaseEntity {
  contextType: DiscussionContext; // 어디에 연결된 논의인지
  contextId: string;             // case ID, task hash, or topic ID
  contextLabel: string;          // 표시용 제목
  authorId: string;              // Member.id
  content: string;               // Markdown 텍스트
  parentId: string | null;       // 스레드 답글
  attachments?: DiscussionAttachment[];
}

// --- Weekly ---

export interface MemberTask {
  text: string;
  noteId: string; // 연결된 노트 ID
  done: boolean;
  source?: 'summary' | 'manual'; // summary: LLM에서 생성 → 삭제 시 미배정 복구, manual: 직접 입력 → 완전 삭제
}

export interface Weekly extends BaseEntity {
  weekLabel: string; // "Week 5 (3/24 ~ 3/30)"
  weekStart: string; // ISO date — 주 시작일 (월요일)
  goals: string[]; // 이번 주 목표
  activeCaseIds: string[]; // 이번 주 집중 케이스
  memberTasks: Record<string, MemberTask[]>; // { memberId: [{text, noteId, done}] }
  mentoringAgenda: string; // 멘토링 안건
  mentoringFeedback: string; // 멘토링 피드백
  mentoringActionItems: string[]; // 멘토링 후 할 일 목록
  carryOver: string[]; // 다음 주로 넘기는 항목
}

// --- Meeting Summary (LLM 요약 결과) ---

export interface MeetingSummary {
  goals: string[];            // 이번 주 목표
  tasks: string[];            // 할 일 목록 (팀원 미배정 flat list)
  mentoringFeedback: string;  // 멘토링 피드백
  carryOver: string[];        // 이월 항목
}

// --- Note ---

export interface Note extends BaseEntity {
  title: string;
  content: string; // Tiptap HTML
  status: NoteStatus;
  authorId: string; // Member.id
  linkedCaseId: string | null; // 연결된 Case (optional)
  linkedWeeklyId: string | null; // 연결된 Weekly (optional)
  tags: string[]; // 자유 태그 (회의록, 논문, 자유메모 등)
}

// --- Store Keys ---

export const STORE_KEYS = {
  CASES: 'lumos_cases',
  TASKS: 'lumos_tasks',
  ARTIFACTS: 'lumos_artifacts',
  DISCUSSIONS: 'lumos_discussions',
  WEEKLIES: 'lumos_weeklies',
  NOTES: 'lumos_notes',
  MEMBERS: 'lumos_members',
} as const;

export type StoreKey = typeof STORE_KEYS[keyof typeof STORE_KEYS];

// --- Utility Types ---

export type CreateInput<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateInput<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt'>> & { updatedAt?: string };
