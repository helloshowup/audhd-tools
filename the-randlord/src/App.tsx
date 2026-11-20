/**
 * The Randlord — Application Shell
 * Built with The Neurodiverse Agency Design System v2.0 (NDA, --nda-*)
 */

import { useState, useEffect, ReactElement, CSSProperties } from 'react';
import { User } from 'firebase/auth';
import { initAuth, logout } from './lib/firebase';
import { Login } from './components/Login';
import { BudgetView } from './components/BudgetView';
import { LedgerView } from './components/LedgerView';
import { AccountsView } from './components/AccountsView';
import { ReportsView } from './components/ReportsView';
import { Advisors } from './components/Advisors';
import { PlanView } from './components/PlanView';
import { Ledger } from './types';
import { demoLedger } from '../demo-ledger';
import { quarantineLedgerData } from './lib/guards';
import {
  NDRoot,
  Heading,
  Button,
  Modal,
  Dot,
  Icon,
  ErrorNote,
  Loading
} from './ui/kit';

const DEMO = import.meta.env.VITE_RANDLORD_DEMO !== '0';

type View = 'budget' | 'ledger' | 'accounts' | 'reports' | 'plan' | 'advisors';

const NAV: { id: View; label: string; icon: () => ReactElement }[] = [
  { id: 'budget',   label: 'Budget',   icon: () => Icon.budget(18) },
  { id: 'plan',     label: 'Plan',     icon: () => Icon.plan(18) },
  { id: 'ledger',   label: 'Ledger',   icon: () => Icon.ledger(18) },
  { id: 'accounts', label: 'Accounts', icon: () => Icon.accounts(18) },
  { id: 'reports',  label: 'Reports',  icon: () => Icon.reports(18) },
  { id: 'advisors', label: 'Advisors', icon: () => Icon.advisors(18) }
];

const TITLE: Record<View, string> = {
  budget: 'Budget', plan: 'Plan', ledger: 'Ledger',
  accounts: 'Accounts', reports: 'Reports', advisors: 'Advisors'
};

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [currentBudget, setCurrentBudget] = useState('Personal');
  const [currentView, setCurrentView] = useState<View>('budget');
  const [quarantinedCount, setQuarantinedCount] = useState(0);

  const isDemo = DEMO || token === 'demo-token' || token === 'demo';

  const [showDemoNote, setShowDemoNote] = useState(
    () => isDemo && sessionStorage.getItem('randlord-demo-note') !== 'seen'
  );
  const dismissDemoNote = () => {
    sessionStorage.setItem('randlord-demo-note', 'seen');
    setShowDemoNote(false);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-brand', currentBudget === 'Business' ? 'business' : 'nda');
  }, [currentBudget]);

  useEffect(() => {
    if (DEMO) {
      setToken('demo');
      setNeedsAuth(false);
      setIsAuthLoading(false);
      return;
    }
    const unsubscribe = initAuth(
      (user, token) => { setUser(user); setToken(token); setNeedsAuth(false); setIsAuthLoading(false); },
      () => { setNeedsAuth(true); setToken(null); setUser(null); setIsAuthLoading(false); }
    );
    return () => unsubscribe();
  }, []);

  const fetchLedger = async (currentToken: string) => {
    setIsLoadingLedger(true);
    setSetupError(null);
    try {
      if (!isDemo) {
        const setupRes = await fetch('/api/sheets/setup', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (!setupRes.ok) {
          const errData = await setupRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to setup sheets');
        }
      }
      let rawData: any = null;
      try {
        const res = await fetch('/api/sheets/ledger', {
          headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {}
        });
        if (res.ok) rawData = await res.json();
      } catch {}
      if (!rawData && isDemo) rawData = demoLedger();
      if (rawData) {
        const { safe, quarantinedCount: qCount } = quarantineLedgerData(rawData);
        setLedger(safe);
        setQuarantinedCount(qCount);
        setSavedAt(isDemo ? null : new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
      } else {
        throw new Error('Failed to fetch ledger');
      }
    } catch (err: any) {
      console.error('Error fetching ledger:', err);
      setSetupError(err.message);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  useEffect(() => { if (token) fetchLedger(token); }, [token]);

  // Expose clean test hooks for automation
  useEffect(() => {
    (window as any).__randlordTestHooks = {
      getActiveTab: () => currentView,
      getCurrentBudget: () => currentBudget,
      getLedger: () => ledger,
      isDemo: () => isDemo,
      setLedger: (l: Ledger) => setLedger(l),
      setCurrentView: (v: View) => setCurrentView(v),
      setCurrentBudget: (b: string) => setCurrentBudget(b)
    };
  }, [currentView, currentBudget, ledger, isDemo]);

  if (isAuthLoading) {
    return (
      <NDRoot as="div" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Dot breathe size={12} color="var(--nda-action-primary)" />
      </NDRoot>
    );
  }

  if (needsAuth && !token) {
    return (
      <Login
        onLogin={(u, t) => { setUser(u); setToken(t); setNeedsAuth(false); }}
        onEnterDemo={() => {
          setToken('demo-token');
          setUser({ displayName: 'Demo Visitor', email: 'demo@example.com' } as any);
          setNeedsAuth(false);
        }}
        isLoading={false}
      />
    );
  }

  const railBtn = (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 42,
    padding: '0 12px',
    border: active ? '3px solid var(--nda-identity-primary)' : '3px solid transparent',
    borderRadius: 0,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-header)',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    width: '100%',
    backgroundColor: active ? 'var(--nda-canvas-container)' : 'transparent',
    color: active ? 'var(--nda-ink-primary)' : '#FFFFFF',
    boxShadow: active ? '4px 4px 0 var(--nda-ink-primary)' : 'none',
    transition: 'all 0s step-end'
  });

  return (
    <NDRoot as="main" className="rl-app-shell">
      {/* ── Brand cell (Zone 0) ── */}
      <div className="rl-brand-cell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Dot size={10} color="var(--nda-identity-secondary)" />
          <span style={{
            fontFamily: 'var(--font-header)', fontSize: 14, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF', whiteSpace: 'nowrap'
          }}>The Randlord</span>
        </div>
      </div>

      {/* ── Sticky Topbar (Zone 1: Escape Hatch & Title; Zone 2: Budget Switcher; Zone 3: Indicator & Account) ── */}
      <header className="rl-topbar">
        {/* Zone 1: Persistent Escape Hatch + View Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span id="launchpad-escape-link"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--nda-ink-primary)',
              textDecoration: 'none',
              padding: '4px 8px',
              border: '2px solid var(--nda-ink-primary)',
              backgroundColor: 'var(--nda-canvas-primary)',
              boxShadow: '2px 2px 0px var(--nda-ink-primary)',
              whiteSpace: 'nowrap'
            }}
          >Demo Ledger</span>
          <Heading level={2} style={{ fontSize: 16, margin: 0 }}>
            {TITLE[currentView]}
          </Heading>
        </div>

        {/* Zone 2: Budget Switcher (Personal / Business) */}
        <div role="group" aria-label="Budget selector" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['Personal', 'Business'] as const).map(b => {
            const on = currentBudget === b;
            return (
              <button
                key={b}
                type="button"
                aria-pressed={on}
                onClick={() => setCurrentBudget(b)}
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-header)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  border: '2px solid var(--nda-ink-primary)',
                  backgroundColor: on ? (b === 'Business' ? 'var(--nda-canvas-secondary)' : 'var(--nda-action-primary)') : 'var(--nda-canvas-container)',
                  color: on ? '#FFFFFF' : 'var(--nda-ink-primary)',
                  boxShadow: on ? '3px 3px 0px var(--nda-ink-primary)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Dot size={6} color={on ? '#FFFFFF' : 'var(--nda-ink-secondary)'} />
                {b}
              </button>
            );
          })}
        </div>

        {/* Zone 3: Save Status, Demo Indicator & Account Slot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {isDemo ? (
            <span
              id="demo-mode-indicator"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                backgroundColor: 'var(--nda-identity-secondary)',
                color: 'var(--nda-ink-primary)',
                border: '2px solid var(--nda-ink-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                boxShadow: '2px 2px 0px var(--nda-ink-primary)'
              }}
            >
              <Dot size={6} color="var(--nda-ink-primary)" />
              Demo · nothing is saved
            </span>
          ) : savedAt ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--nda-ink-secondary)' }}>
              • saved {savedAt}
            </span>
          ) : null}

          <span
            id="account-slot-label"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--nda-ink-primary)',
              textTransform: 'uppercase'
            }}
          >
            {isDemo ? 'Demo mode' : (user?.displayName || user?.email || 'Signed in')}
          </span>

          <button
            type="button"
            onClick={isDemo ? () => { setToken(null); setNeedsAuth(true); } : logout}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--nda-ink-secondary)',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Rail (Left Sidebar) ── */}
      <aside className="rl-sidebar">
        <div>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--nda-ui-lines)', margin: '0 0 10px', padding: '0 8px'
          }}>Budget</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['Personal', 'Business'].map(b => (
              <button
                key={b} type="button"
                onClick={() => setCurrentBudget(b)}
                style={railBtn(currentBudget === b)}
              >
                <Dot size={7} color={currentBudget === b ? 'var(--nda-action-primary)' : 'transparent'} />
                {b}
              </button>
            ))}
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--nda-ui-lines)', margin: '0 0 10px', padding: '0 8px'
          }}>Workspace</p>
          {NAV.map(item => (
            <button
              key={item.id} type="button"
              onClick={() => setCurrentView(item.id)}
              aria-current={currentView === item.id ? 'page' : undefined}
              style={railBtn(currentView === item.id)}
            >
              <Dot size={7} color={currentView === item.id ? 'var(--nda-action-primary)' : 'transparent'} />
              {item.icon()}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Content Container (NDA v2.0 Page Column) ── */}
      <div className="rl-content-area">
        {/* Quiet-failure / Quarantine banner */}
        {quarantinedCount > 0 && (
          <div id="quarantine-banner" style={{ marginBottom: 20 }}>
            <ErrorNote
              title="Quarantined records"
              body={`${quarantinedCount} row(s) in your sheet had malformed amounts or dates and were held aside without affecting the rest of your budget.`}
            />
          </div>
        )}

        {setupError && (
          <div style={{ marginBottom: 20 }}>
            <ErrorNote
              title="We cannot reach the sheet"
              body="Set SPREADSHEET_ID to the ID of the Google Sheet you want us to read, then reload. Your figures are safe where they are."
              detail={setupError}
            />
          </div>
        )}

        {!ledger && !setupError && <Loading />}

        {ledger && currentView === 'budget' && (
          <BudgetView
            ledger={ledger}
            budgetName={currentBudget}
            token={token || ''}
            onAssigned={() => fetchLedger(token || '')}
            onInspectUncategorised={() => setCurrentView('ledger')}
          />
        )}
        {ledger && currentView === 'ledger' && (
          <LedgerView
            ledger={ledger}
            budgetName={currentBudget}
            token={token || ''}
            onUpdate={() => fetchLedger(token || '')}
          />
        )}
        {ledger && currentView === 'accounts' && (
          <AccountsView
            ledger={ledger}
            budgetName={currentBudget}
            token={token || ''}
            onAssigned={() => fetchLedger(token || '')}
          />
        )}
        {ledger && currentView === 'reports' && (
          <ReportsView
            ledger={ledger}
            budgetName={currentBudget}
          />
        )}
        {ledger && currentView === 'plan' && (
          <PlanView
            token={token || ''}
            demo={isDemo}
          />
        )}
        {ledger && currentView === 'advisors' && (
          <Advisors
            token={token || ''}
            transactions={(ledger.transactions || []).filter(t => t.budget === currentBudget)}
            config={ledger.config || []}
          />
        )}
      </div>

      {/* ── Demo Modal ── */}
      {isDemo && (
        <Modal
          open={showDemoNote}
          title="Demo Mode"
          onClose={dismissDemoNote}
          footer={<Button variant="action" onClick={dismissDemoNote} autoFocus>Have a look around</Button>}
        >
          <Heading level={3} style={{ fontSize: 18, marginBottom: 12 }}>
            Nothing here is real, and nothing is saved
          </Heading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--nda-ink-primary)' }}>
              The accounts, the transactions and every number in here are sample figures. You can
              assign money, move it, add things and delete things. None of it is written
              anywhere, and a reload puts it all back.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--nda-ink-secondary)' }}>
              The Randlord is designed for neurodivergent adults to adapt to how they actually
              think about money. It is not a product, there is nothing to buy, and there is no account to make.
            </p>
          </div>
        </Modal>
      )}
    </NDRoot>
  );
}
