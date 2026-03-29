import type { Member } from '../../types';

interface MemberAvatarProps {
  member: Member;
  size?: 'sm' | 'md';
  showName?: boolean;
}

export function MemberAvatar({ member, size = 'md', showName = false }: MemberAvatarProps) {
  const sizeClass = size === 'sm' ? 'avatar avatar-sm' : 'avatar';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={sizeClass}>
        {member.avatar
          ? <img src={member.avatar} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-full)' }} />
          : member.name.charAt(0).toUpperCase()
        }
      </span>
      {showName && <span style={{ fontSize: 'var(--font-size-sm)' }}>{member.name}</span>}
    </span>
  );
}
