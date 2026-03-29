import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { signOut } from '../lib/auth';

const NAV_ITEMS = [
  { to: '/app', label: '대시보드', exact: true },
  { to: '/app/cases', label: '케이스' },
  { to: '/app/weekly', label: '주간 보드' },
  { to: '/app/notes', label: '노트' },
];

export function AppLayout() {
  const location = useLocation();
  const { currentMember, clearMember } = useCurrentMember();

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <span>◆</span>
          <span>LUMOS</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">메뉴</div>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(item.to + '/');

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={() => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* 현재 멤버 + 로그아웃 */}
        <div className="sidebar-member">
          {currentMember && (
            <>
              <div className="sidebar-member-info">
                <div className="sidebar-member-avatar">
                  {currentMember.avatar
                    ? <img src={currentMember.avatar} alt={currentMember.name} />
                    : <span>{currentMember.name.charAt(0)}</span>
                  }
                </div>
                <div className="sidebar-member-name">{currentMember.name}</div>
              </div>
              <div className="sidebar-member-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={clearMember}
                  title="멤버 변경"
                >
                  전환
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={signOut}
                  title="로그아웃"
                >
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="app-main">
        <header className="app-header">
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {getPageTitle(location.pathname)}
          </div>
        </header>

        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname === '/app') return 'Dashboard';
  if (pathname === '/app/cases') return 'Cases';
  if (pathname.startsWith('/app/cases/')) return 'Case Detail';
  if (pathname === '/app/weekly') return 'Weekly Board';
  if (pathname === '/app/notes') return 'Notes';
  if (pathname.startsWith('/app/notes/')) return 'Note Editor';
  return '';
}
