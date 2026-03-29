import { useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isAllowedUser, signOut } from '../lib/auth';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAllowed: boolean;
}

export function useAuth(): AuthState & { logout: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAllowed: false,
  });

  useEffect(() => {
    if (!supabase) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      const allowed = isAllowedUser(user?.email);

      // 화이트리스트에 없으면 즉시 로그아웃
      if (user && !allowed) {
        signOut();
        setState({ user: null, session: null, loading: false, isAllowed: false });
        return;
      }

      setState({ user, session, loading: false, isAllowed: allowed });
    });

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user ?? null;
        const allowed = isAllowedUser(user?.email);

        if (user && !allowed) {
          signOut();
          setState({ user: null, session: null, loading: false, isAllowed: false });
          return;
        }

        setState({ user, session, loading: false, isAllowed: allowed });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    ...state,
    logout: signOut,
  };
}
