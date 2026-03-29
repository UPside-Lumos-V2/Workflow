import type { TaskLabel } from '../../types';

const LABEL_CONFIG: Record<TaskLabel, { className: string }> = {
  '분석': { className: 'badge badge-label-analysis' },
  '개발': { className: 'badge badge-label-dev' },
  '조사': { className: 'badge badge-label-research' },
  '운영': { className: 'badge badge-label-ops' },
};

interface TaskLabelBadgeProps {
  label: TaskLabel;
}

export function TaskLabelBadge({ label }: TaskLabelBadgeProps) {
  const config = LABEL_CONFIG[label];
  return <span className={config.className}>{label}</span>;
}
