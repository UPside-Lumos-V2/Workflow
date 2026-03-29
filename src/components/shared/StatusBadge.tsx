import type { CaseStatus, TaskStatus } from '../../types';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  'open': { label: 'Open', className: 'badge badge-open' },
  'in-progress': { label: 'In Progress', className: 'badge badge-in-progress' },
  'review': { label: 'Review', className: 'badge badge-review' },
  'closed': { label: 'Closed', className: 'badge badge-closed' },
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
