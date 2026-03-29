import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './components/LoginPage';
import { MemberSelect } from './components/MemberSelect';
import { useAuth } from './hooks/useAuth';
import { CurrentMemberProvider, useCurrentMember } from './hooks/useCurrentMember';
import { initSeedData } from './store/seed';
import { CasesPage } from './pages/CasesPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { WeeklyPage } from './pages/WeeklyPage';
import { NotesPage } from './pages/NotesPage';
import { NoteEditorPage } from './pages/NoteEditorPage';
import { DashboardPage } from './pages/DashboardPage';



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
          <Route index element={<DashboardPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
          <Route path="weekly" element={<WeeklyPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="notes/:id" element={<NoteEditorPage />} />
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
