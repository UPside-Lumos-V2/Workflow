import type { CaseStatus, TaskStatus } from '../../types';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  'active': { label: '진행 중', className: 'badge badge-open' },
  'review': { label: '검토', className: 'badge badge-review' },
  'closed': { label: '완료', className: 'badge badge-closed' },
  'todo': { label: 'Todo', className: 'badge badge-open' },
  'done': { label: 'Done', className: 'badge badge-closed' },
};

interface StatusBadgeProps {
  status: CaseStatus | TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'badge' };
  return <span className={config.className}>{config.label}</span>;
}
