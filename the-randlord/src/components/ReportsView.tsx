import { useMemo } from 'react';
import { Ledger } from '../types';
import { formatCurrency } from '../lib/ledger-math';
import { Panel, Heading, StatLabel, Money } from '../ui/kit';

interface ReportsViewProps {
  ledger: Ledger;
  budgetName: string;
}

const VIZ = [
  'var(--nda-action-primary, #DC6919)',
  'var(--nda-identity-primary, #1C7A4E)',
  'var(--nda-identity-secondary, #F2A223)',
  'var(--nda-canvas-secondary, #2A3869)',
  'var(--nda-semantic-error, #C6302A)',
  'var(--nda-ink-secondary, #5C6B89)'
];

export function ReportsView({ ledger, budgetName }: ReportsViewProps) {
  const transactions = useMemo(
    () => ledger.transactions.filter(t => t.budget === budgetName && t.date).sort((a, b) => a.date.localeCompare(b.date)),
    [ledger, budgetName]
  );
  const accounts = useMemo(() => ledger.accounts.filter(a => a.budget === budgetName), [ledger, budgetName]);

  /* Last six months, seeded so the timeline is always complete. */
  const months = useMemo(() => {
    const keys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
  }, []);

  const flow = useMemo(() => months.map(m => {
    const monthTx = transactions.filter(t => t.date.substring(0, 7) === m);
    return {
      key: m,
      label: new Date(m + '-01').toLocaleDateString(undefined, { month: 'short' }),
      inflow: monthTx.filter(t => t.amount > 0 && (!t.category || t.category.trim() === 'To Be Assigned')).reduce((s, t) => s + t.amount, 0),
      outflow: monthTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    };
  }), [months, transactions]);

  const netWorth = useMemo(() => {
    const accountRateMap: Record<string, number> = {};
    accounts.forEach(a => {
      accountRateMap[a.name] = (a.type === 'tracked' && a.currency !== 'ZAR') ? (Number(a.indicativeRate) || 1) : 1;
    });

    let rolling = accounts.reduce((s, a) => s + ((Number(a.startingBalance) || 0) * (accountRateMap[a.name] || 1)), 0);
    const before = transactions.filter(t => t.date.substring(0, 7) < months[0]).reduce((s, t) => {
      const rate = accountRateMap[t.account] || 1;
      return s + (t.amount * rate);
    }, 0);
    rolling += before;
    return months.map(m => {
      rolling += transactions.filter(t => t.date.substring(0, 7) === m).reduce((s, t) => {
        const rate = accountRateMap[t.account] || 1;
        return s + (t.amount * rate);
      }, 0);
      return { key: m, label: new Date(m + '-01').toLocaleDateString(undefined, { month: 'short' }), value: rolling };
    });
  }, [months, transactions, accounts]);

  const thisMonth = months[months.length - 1];
  const spend = useMemo(() => {
    const totals: Record<string, number> = {};
    transactions
      .filter(t => t.date.substring(0, 7) === thisMonth && t.amount < 0 && t.category && t.category !== 'To Be Assigned')
      .forEach(t => { totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount); });
    return Object.entries(totals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [transactions, thisMonth]);

  const spendMax = Math.max(1, ...spend.map(s => s.value));
  const flowMax = Math.max(1, ...flow.flatMap(f => [f.inflow, f.outflow]));
  const nwValues = netWorth.map(n => n.value);
  const nwMin = Math.min(...nwValues) * 0.94;
  const nwMax = Math.max(...nwValues) * 1.02 || 1;
  const points = netWorth.map((n, i) => {
    const x = (i / Math.max(1, netWorth.length - 1)) * 480;
    const y = 170 - ((n.value - nwMin) / Math.max(1, nwMax - nwMin)) * 150;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const delta = nwValues[nwValues.length - 1] - nwValues[0];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)', padding: '0 0 var(--nd-s1)' }}>
        <Heading level={2} style={{ fontSize: 20, margin: 0 }}>Reports</Heading>
        <StatLabel size="xs" muted>Last six months</StatLabel>
      </div>

      {/* ── Where the money went ── */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--nd-gap)' }}>
          <StatLabel size="xs">Where the money went · {new Date(thisMonth + '-01').toLocaleDateString(undefined, { month: 'long' })}</StatLabel>
          <Money size={13} tone="var(--app-ink-muted)">{formatCurrency(spend.reduce((s, x) => s + x.value, 0))} spent</Money>
        </div>

        {spend.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--app-ink-muted)', margin: 'var(--nd-s1) 0 0' }}>
            Nothing categorised this month yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nd-gap)', marginTop: 'var(--nd-s1)' }}>
            {spend.map((s, i) => (
              <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '180px minmax(0,1fr) 116px', alignItems: 'center', gap: 'var(--nd-gap)' }}>
                <span style={{ fontSize: 14, color: 'var(--app-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                <div style={{ height: 20, borderRadius: 0, border: '1px solid var(--nd-ink)', background: 'var(--nd-kalk)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(s.value / spendMax) * 100}%`, borderRadius: 0, background: VIZ[i % 6] }} />
                </div>
                <Money size={13} tone="var(--app-ink-muted)">{formatCurrency(s.value)}</Money>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--nd-s1)', marginTop: 'var(--nd-s1)' }}>
        {/* ── Money in, money out ── */}
        <Panel>
          <StatLabel size="xs">Money in, money out</StatLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--nd-gap)', height: 180, marginTop: 'var(--nd-s1)' }}>
            {flow.map(f => (
              <div key={f.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--nd-gap)', height: 100 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4, width: '100%', justifyContent: 'center' }}>
                  <span title={`In ${formatCurrency(f.inflow)}`} style={{ width: 14, borderRadius: 0, border: '1px solid var(--nd-ink)', background: 'var(--nd-forest)', height: `${Math.max(2, (f.inflow / flowMax) * 100)}%` }} />
                  <span title={`Out ${formatCurrency(f.outflow)}`} style={{ width: 14, borderRadius: 0, border: '1px solid var(--nd-ink)', background: 'var(--nd-oranje)', height: `${Math.max(2, (f.outflow / flowMax) * 100)}%` }} />
                </div>
                <StatLabel size="xs" muted>{f.label}</StatLabel>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-s1)', marginTop: 'var(--nd-s1)', paddingTop: 'var(--nd-gap)', borderTop: 'var(--nd-rule)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--app-ink)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 0, border: '1px solid var(--nd-ink)', background: 'var(--nd-forest)' }} />In
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--app-ink)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 0, border: '1px solid var(--nd-ink)', background: 'var(--nd-oranje)' }} />Out
            </span>
          </div>
        </Panel>

        {/* ── Net worth ── */}
        <Panel>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--nd-gap)' }}>
            <StatLabel size="xs">Net worth</StatLabel>
            <Money size={13} tone="var(--app-ink-muted)">
              {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
            </Money>
          </div>
          <div style={{ marginTop: 'var(--nd-s1)', height: 180, position: 'relative' }}>
            <svg viewBox="0 0 480 180" preserveAspectRatio="none" style={{ width: '100%', height: 180, overflow: 'visible' }}>
              <polyline points={`0,180 ${points.join(' ')} 480,180`} fill="var(--nd-kalk)" stroke="none" />
              <polyline
                points={points.join(' ')} fill="none" stroke="var(--nd-ink)"
                strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {netWorth.map(n => (
                <StatLabel key={n.key} size="xs" muted style={{ transform: 'translateY(20px)' }}>{n.label}</StatLabel>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: 'var(--nd-s2) 0 0' }}>
            Balances across all accounts, including tracked ones.
          </p>
        </Panel>
      </div>
    </div>
  );
}
