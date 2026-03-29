import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './components/LoginPage';
import { MemberSelect } from './components/MemberSelect';
import { useAuth } from './hooks/useAuth';
import { CurrentMemberProvider, useCurrentMember } from './hooks/useCurrentMember';
import { initSeedData } from './store/seed';

// Placeholder pages — will be replaced in Phase 3~6
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">🚧</div>
      <h2>{title}</h2>
      <p className="text-secondary">Coming soon</p>
    </div>
  );
}

function AuthenticatedApp() {
  const { needsSelection } = useCurrentMember();

  // 인증 후에만 시드 실행
  useEffect(() => {
    initSeedData().catch(console.error);
  }, []);

  if (needsSelection) {
    return <MemberSelect />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<PlaceholderPage title="Dashboard" />} />
          <Route path="cases" element={<PlaceholderPage title="Cases" />} />
          <Route path="cases/:id" element={<PlaceholderPage title="Case Detail" />} />
          <Route path="weekly" element={<PlaceholderPage title="Weekly Board" />} />
          <Route path="notes" element={<PlaceholderPage title="Notes" />} />
          <Route path="notes/:id" element={<PlaceholderPage title="Note Editor" />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  const { user, loading, isAllowed } = useAuth();

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

  // 미 로그인 or 비허용 유저
  if (!user || !isAllowed) {
    return <LoginPage />;
  }

  // 로그인 + 허용 → 멤버 선택 + 앱
  return (
    <CurrentMemberProvider>
      <AuthenticatedApp />
    </CurrentMemberProvider>
  );
}
