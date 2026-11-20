import { useState } from 'react';
import { googleSignIn } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Panel, Heading, StatLabel, Button, Dot } from '../ui/kit';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
  onEnterDemo?: () => void;
  isLoading: boolean;
}

export function Login({ onLogin, onEnterDemo, isLoading }: LoginProps) {
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    try {
      setBusy(true);
      const result = await googleSignIn();
      if (result) onLogin(result.user, result.accessToken);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') return;
      console.error('Login error', err);
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = () => {
    if (onEnterDemo) {
      onEnterDemo();
    } else {
      onLogin({ displayName: 'Demo Visitor', email: 'demo@example.com' } as any, 'demo-token');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', minHeight: '100vh' }}>
      {/* ── Dark side (Navy Canvas-Secondary) ── */}
      <div style={{
        backgroundColor: 'var(--nda-canvas-secondary, #2A3869)',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRight: '3px solid var(--nda-ink-primary, #1A1A1A)',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Dot color="var(--nda-identity-secondary, #F2A223)" size={10} />
          <span style={{
            fontFamily: 'var(--font-header)', fontSize: 16, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF'
          }}>The Randlord</span>
        </div>

        <div style={{ maxWidth: '34ch', margin: '40px 0' }}>
          {/* ND Agency v2.0 Motif: Green frame, Yellow door */}
          <div style={{
            width: 72, height: 96, border: '3px solid var(--nda-identity-primary, #1C7A4E)',
            backgroundColor: 'var(--nda-identity-secondary, #F2A223)',
            borderRadius: 0, position: 'relative', marginBottom: 24,
            boxShadow: '4px 4px 0px #1A1A1A'
          }}>
            <span style={{
              position: 'absolute', inset: 4, border: '2px solid #1A1A1A',
              borderRadius: 0
            }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-header)', fontSize: 44, fontWeight: 700,
            letterSpacing: '-0.02em', lineHeight: 1.1, color: '#FFFFFF',
            textTransform: 'uppercase', margin: 0
          }}>Every rand<br />has a job</h1>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--nda-ui-lines, #D3D9E8)', marginTop: 16 }}>
            Your ledger lives in your own Google Sheet. We read it, show it plainly, and write back only what you ask us to.
          </p>
        </div>

        <StatLabel size="xs" style={{ color: 'var(--nda-ui-lines, #D3D9E8)' }}>
          A different kind of thinking
        </StatLabel>
      </div>

      {/* ── Light side (Canvas-Primary) ── */}
      <div style={{
        backgroundColor: 'var(--nda-canvas-primary, #F4F7FA)',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        boxSizing: 'border-box'
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <StatLabel size="xs" muted>Sign in</StatLabel>
          <Heading level={1} style={{ fontSize: 32, marginTop: 8 }}>Welcome back</Heading>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--nda-ink-secondary, #5C6B89)', marginTop: 8 }}>
            Sign in with the Google account that owns your ledger sheet, or test with sample numbers.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            <Button
              variant="action"
              onClick={handleLogin}
              disabled={isLoading || busy}
              style={{ width: '100%', height: 48, fontSize: 15 }}
            >
              {busy ? <><Dot size={7} color="#FFFFFF" breathe /> Opening Google</> : 'Continue with Google'}
            </Button>

            <Button
              variant="secondary"
              onClick={handleDemo}
              style={{ width: '100%', height: 44, fontSize: 14 }}
            >
              Look around with sample numbers
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0' }}>
            <span style={{ height: 2, background: 'var(--nda-ui-lines)', flex: 1 }} />
            <Dot size={6} color="var(--nda-ink-secondary)" />
            <span style={{ height: 2, background: 'var(--nda-ui-lines)', flex: 1 }} />
          </div>

          <Panel title="What we touch">
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--nda-ink-primary)', margin: 0 }}>
              One spreadsheet, the one you name. Nothing else in your Drive, no bank connection, no card details. Revoke access at any time; your data stays yours.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
