import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../types';

interface ActiveEditor {
  name: string;
  color: string;
}

const MEMBER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8',
];

export function getMemberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

export function useNotePresence(
  noteId: string | undefined,
  currentMember: Member | null,
  memberColor: string
): ActiveEditor[] {
  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);

  useEffect(() => {
    if (!supabase || !currentMember || !noteId) return;

    const channel = supabase.channel(`note-presence-${noteId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const editors: ActiveEditor[] = [];
        for (const presences of Object.values(state)) {
          for (const p of presences as Array<Record<string, string>>) {
            // 자기 자신은 제외
            if (p.memberId !== currentMember.id) {
              editors.push({ name: p.name, color: p.color });
            }
          }
        }
        setActiveEditors(editors);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            memberId: currentMember.id,
            name: currentMember.name,
            color: memberColor,
          });
        }
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [noteId, currentMember, memberColor]);

  return activeEditors;
}
