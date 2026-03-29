import { useMembers } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import type { Member } from '../types';

export function MemberSelect() {
  const { items: members, loading } = useMembers();
  const { selectMember } = useCurrentMember();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>
          나는 누구?
        </div>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
          팀 내 멤버를 선택하세요
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((member: Member) => (
            <button
              key={member.id}
              className="btn btn-secondary"
              style={{ padding: '12px 16px', justifyContent: 'flex-start' }}
              onClick={() => selectMember(member)}
            >
              <span className="avatar" style={{ marginRight: 8 }}>
                {member.name.charAt(0)}
              </span>
              <span>{member.name}</span>
              {member.roleDescription && (
                <span className="text-tertiary" style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)' }}>
                  {member.roleDescription}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
