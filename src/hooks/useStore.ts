import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Case, Task, Artifact, Discussion, Weekly, Note, Member,
  CaseStatus,
} from '../types';

// ============================================================
// snake_case ↔ camelCase 변환
// ============================================================

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function rowToEntity<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value;
  }
  return result as T;
}

function entityToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

// ============================================================
// 제네릭 Supabase Hook
// ============================================================

interface UseSupabaseTableReturn<T extends { id: string }> {
  items: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getById: (id: string) => T | undefined;
  add: (input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => Promise<T | null>;
  edit: (id: string, changes: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
}

function useSupabaseTable<T extends { id: string }>(
  tableName: string,
  orderBy: string = 'created_at'
): UseSupabaseTableReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await supabase
        .from(tableName)
        .select('*')
        .order(orderBy, { ascending: true });

      if (err) {
        setError(err.message);
        return;
      }
      setItems((data || []).map((row) => rowToEntity<T>(row as Record<string, unknown>)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [tableName, orderBy]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const getById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items]
  );

  const add = useCallback(
    async (input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T | null> => {
      if (!supabase) return null;
      const row = entityToRow(input as Record<string, unknown>);
      // id, created_at, updated_at 는 DB 기본값
      delete row['id'];
      delete row['created_at'];
      delete row['updated_at'];

      const { data, error: err } = await supabase
        .from(tableName)
        .insert(row)
        .select()
        .single();

      if (err || !data) {
        console.error('Insert error:', err);
        return null;
      }
      const entity = rowToEntity<T>(data as Record<string, unknown>);
      setItems((prev) => [...prev, entity]);
      return entity;
    },
    [tableName]
  );

  const edit = useCallback(
    async (id: string, changes: Partial<T>): Promise<T | null> => {
      if (!supabase) return null;
      const row = entityToRow(changes as Record<string, unknown>);
      delete row['id'];
      delete row['created_at'];
      delete row['updated_at'];

      const { data, error: err } = await supabase
        .from(tableName)
        .update(row)
        .eq('id', id)
        .select()
        .single();

      if (err || !data) {
        console.error('Update error:', err, 'row sent:', row);
        return null;
      }
      const entity = rowToEntity<T>(data as Record<string, unknown>);
      setItems((prev) => prev.map((item) => (item.id === id ? entity : item)));
      return entity;
    },
    [tableName]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase) return false;
      const { error: err } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (err) {
        console.error('Delete error:', err);
        return false;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      return true;
    },
    [tableName]
  );

  return { items, loading, error, refetch, getById, add, edit, remove };
}

// ============================================================
// 도메인별 Hooks
// ============================================================

export function useMembers() {
  return useSupabaseTable<Member>('lumos_members');
}

export function useCases() {
  const store = useSupabaseTable<Case>('lumos_cases');
  const byStatus = useCallback(
    (status: CaseStatus) => store.items.filter((c) => c.status === status),
    [store.items]
  );
  return { ...store, byStatus };
}

export function useTasks() {
  const store = useSupabaseTable<Task>('lumos_tasks', 'sort_order');
  const byCaseId = useCallback(
    (caseId: string) => store.items.filter((t) => t.caseId === caseId),
    [store.items]
  );
  const byAssignee = useCallback(
    (memberId: string) => store.items.filter((t) => t.assigneeId === memberId),
    [store.items]
  );
  return { ...store, byCaseId, byAssignee };
}

export function useArtifacts() {
  const store = useSupabaseTable<Artifact>('lumos_artifacts');
  const byCaseId = useCallback(
    (caseId: string) => store.items.filter((a) => a.caseId === caseId),
    [store.items]
  );
  return { ...store, byCaseId };
}

export function useDiscussions() {
  const store = useSupabaseTable<Discussion>('lumos_discussions');
  const byCaseId = useCallback(
    (caseId: string) => store.items.filter((d) => d.caseId === caseId),
    [store.items]
  );
  return { ...store, byCaseId };
}

export function useWeekly() {
  const store = useSupabaseTable<Weekly>('lumos_weeklies', 'week_start');

  const current = useMemo(() => {
    if (store.items.length === 0) return undefined;
    // 가장 최근 주
    return store.items[store.items.length - 1];
  }, [store.items]);

  return { ...store, current };
}

export function useNotes() {
  return useSupabaseTable<Note>('lumos_notes');
}
