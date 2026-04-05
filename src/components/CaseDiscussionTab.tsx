import { DiscussionPanel } from './DiscussionPanel';

interface CaseDiscussionTabProps {
  caseId: string;
  caseTitle?: string;
}

/**
 * 케이스 상세 페이지에서 사용하는 Discussion 탭.
 * DiscussionPanel을 case 컨텍스트로 래핑.
 */
export function CaseDiscussionTab({ caseId, caseTitle }: CaseDiscussionTabProps) {
  return (
    <DiscussionPanel
      contextType="case"
      contextId={caseId}
      contextLabel={caseTitle ?? '케이스 논의'}
    />
  );
}
