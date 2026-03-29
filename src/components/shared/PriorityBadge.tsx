import type { CasePriority } from '../../types';

const PRIORITY_CONFIG: Record<CasePriority, { label: string; className: string }> = {
  high: { label: 'High', className: 'badge badge-high' },
  medium: { label: 'Medium', className: 'badge badge-medium' },
  low: { label: 'Low', className: 'badge badge-low' },
};

interface PriorityBadgeProps {
  priority: CasePriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  return <span className={config.className}>{config.label}</span>;
}
