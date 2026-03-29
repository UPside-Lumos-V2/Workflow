import { signInWithGoogle } from '../lib/auth';

export function LoginPage() {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 8 }}>
          ◆ LUMOS
        </div>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
          DeFi Exploit Analysis Workspace
        </p>
        <button
          className="btn btn-primary"
          style={{ padding: '12px 32px', fontSize: 'var(--font-size-md)' }}
          onClick={handleLogin}
        >
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  );
}
