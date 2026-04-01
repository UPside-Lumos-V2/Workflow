import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Supabase Realtime Postgres Changes를 사용하여
 * 테이블 변경 시 자동으로 refetch하는 훅
 */
export function useRealtimeTable(
  tableName: string,
  refetch: () => Promise<void>
) {
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`realtime-${tableName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [tableName, refetch]);
}
