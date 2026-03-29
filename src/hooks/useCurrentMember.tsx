import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Member } from '../types';
import { useMembers } from './useStore';

const CURRENT_MEMBER_KEY = 'lumos_current_member';

interface CurrentMemberContextType {
  currentMember: Member | null;
  selectMember: (member: Member) => void;
  clearMember: () => void;
  needsSelection: boolean;
}

const CurrentMemberContext = createContext<CurrentMemberContextType>({
  currentMember: null,
  selectMember: () => {},
  clearMember: () => {},
  needsSelection: true,
});

export function useCurrentMember() {
  return useContext(CurrentMemberContext);
}

export function CurrentMemberProvider({ children }: { children: ReactNode }) {
  const { items: members, loading } = useMembers();
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [needsSelection, setNeedsSelection] = useState(false);

  // localStorage에서 저장된 멤버 복원
  useEffect(() => {
    if (loading || members.length === 0) return;

    const savedId = localStorage.getItem(CURRENT_MEMBER_KEY);
    if (savedId) {
      const found = members.find((m) => m.id === savedId);
      if (found) {
        setCurrentMember(found);
        setNeedsSelection(false);
        return;
      }
    }
    setNeedsSelection(true);
  }, [members, loading]);

  const selectMember = useCallback((member: Member) => {
    localStorage.setItem(CURRENT_MEMBER_KEY, member.id);
    setCurrentMember(member);
    setNeedsSelection(false);
  }, []);

  const clearMember = useCallback(() => {
    localStorage.removeItem(CURRENT_MEMBER_KEY);
    setCurrentMember(null);
    setNeedsSelection(true);
  }, []);

  return (
    <CurrentMemberContext.Provider value={{ currentMember, selectMember, clearMember, needsSelection }}>
      {children}
    </CurrentMemberContext.Provider>
  );
}
