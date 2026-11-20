import { useState } from 'react';
import { Ledger } from '../types';
import { formatCurrency } from '../lib/ledger-math';
import { TransactionList } from './TransactionList';
import {
  StatTileRow, StatTile, StatLabel, Heading, Badge, Button, IconBtn, Dot, Icon,
  Row, Th, TableCard, EmptyState, ErrorNote, inputStyle, moneyInputStyle
} from '../ui/kit';

interface AccountsViewProps {
  ledger: Ledger;
  budgetName: string;
  token: string;
  onAssigned: () => void;
}

const COLS = 'minmax(0, 1fr) 140px 150px 160px';

export function AccountsView({ ledger, budgetName, token, onAssigned }: AccountsViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('current');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('ZAR');
  const [rate, setRate] = useState('1');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accounts = ledger.accounts.filter(a => a.budget === budgetName && a.name);
  const categories = ledger.categories.filter(c => c.budget === budgetName && c.name);

  const balanceOf = (accountName: string, starting: number) =>
    starting + ledger.transactions
      .filter(t => t.account === accountName && t.budget === budgetName)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const unclearedOf = (accountName: string) =>
    ledger.transactions
      .filter(t => t.account === accountName && t.budget === budgetName && !t.cleared)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const rows = accounts.map(a => ({
    ...a,
    balance: balanceOf(a.name, Number(a.startingBalance) || 0),
    uncleared: unclearedOf(a.name)
  }));

  const netWorth = rows.reduce((s, a) => {
    const rate = (a.type === 'tracked' && a.currency !== 'ZAR') ? (Number(a.indicativeRate) || 1) : 1;
    return s + (a.balance * rate);
  }, 0);
  const onBudget = rows.filter(a => a.type !== 'tracked').reduce((s, a) => s + a.balance, 0);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !balance) { setError('A name and a starting balance are needed.'); return; }
    try {
      setIsSaving(true);
      const values = [
        name.trim(), type, Number(balance), budgetName,
        type === 'tracked' ? currency : 'ZAR',
        type === 'tracked' ? Number(rate) : 1
      ];
      const res = await fetch('/api/sheets/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sheet: 'Accounts', values })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.saved === false) {
        throw new Error(data.error || 'We could not write to the sheet. In demo mode, nothing is saved.');
      }
      setName(''); setBalance(''); setIsAdding(false);
      onAssigned();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'We could not save that account. Nothing changed in your sheet.');
    } finally {
      setIsSaving(false);
    }
  };

  const opened = rows.find(a => a.name === openAccount);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)', padding: '0 0 var(--nd-s1)' }}>
        <Heading level={2} style={{ fontSize: 20, margin: 0 }}>Accounts</Heading>
        <Button
          variant={isAdding ? 'secondary' : 'action'}
          onClick={() => setIsAdding(v => !v)}
        >
          {isAdding ? 'Cancel' : 'Add account'}
        </Button>
      </div>

      <StatTileRow>
        <StatTile
          label="Net worth"
          value={formatCurrency(netWorth)}
          headline
        />
        <StatTile
          label="In the budget"
          value={formatCurrency(onBudget)}
        />
        <StatTile
          label="Tracked only"
          value={formatCurrency(netWorth - onBudget)}
        />
      </StatTileRow>

      {isAdding && (
        <form onSubmit={handleAddAccount} style={{ marginTop: 'var(--nd-s1)' }}>
          <div style={{
            background: 'var(--nd-surface)', border: 'var(--nd-rule)', padding: 'var(--nd-s1) var(--nd-s2)', boxSizing: 'border-box'
          }}>
            <StatLabel size="xs" muted>New account</StatLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)', gap: 'var(--nd-gap)', alignItems: 'end', marginTop: 'var(--nd-gap)' }}>
              <div>
                <StatLabel size="xs">Account name</StatLabel>
                <input className="rl-input" style={{ ...inputStyle, marginTop: 4 }} placeholder="FNB Cheque" value={name} onChange={e => setName(e.target.value)} disabled={isSaving} />
              </div>
              <div>
                <StatLabel size="xs">Type</StatLabel>
                <select className="rl-input" style={{ ...inputStyle, marginTop: 4 }} value={type} onChange={e => setType(e.target.value)} disabled={isSaving}>
                  <option value="current">Current</option>
                  <option value="savings">Savings</option>
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                  <option value="tracked">Tracked</option>
                </select>
              </div>
              <div>
                <StatLabel size="xs">Starting balance</StatLabel>
                <input className="rl-input" inputMode="decimal" style={{ ...moneyInputStyle, marginTop: 4 }} placeholder="0.00" value={balance} onChange={e => setBalance(e.target.value.replace(/,/g, '.'))} disabled={isSaving} />
              </div>
            </div>

            {type === 'tracked' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'var(--nd-gap)', marginTop: 'var(--nd-gap)' }}>
                <div>
                  <StatLabel size="xs">Currency</StatLabel>
                  <input className="rl-input" style={{ ...inputStyle, marginTop: 4 }} placeholder="USD" value={currency} onChange={e => setCurrency(e.target.value)} disabled={isSaving} />
                </div>
                <div>
                  <StatLabel size="xs">Indicative rate to ZAR</StatLabel>
                  <input className="rl-input" inputMode="decimal" style={{ ...moneyInputStyle, marginTop: 4 }} placeholder="18.40" value={rate} onChange={e => setRate(e.target.value.replace(/,/g, '.'))} disabled={isSaving} />
                </div>
              </div>
            )}

            {error && <div style={{ marginTop: 'var(--nd-gap)' }}><ErrorNote title="Not saved" body={error} /></div>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)', marginTop: 'var(--nd-s1)' }}>
              <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: 0 }}>
                Tracked accounts sit outside the budget. Use them for things you watch but do not spend from.
              </p>
              <div style={{ display: 'flex', gap: 'var(--nd-gap)', justifyContent: 'flex-end', flex: '0 0 auto' }}>
                <Button type="button" variant="secondary" onClick={() => setIsAdding(false)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" variant="action" disabled={!name.trim() || !balance || isSaving}>
                  {isSaving ? <><Dot size={7} color="var(--nd-paper)" breathe /> Saving</> : 'Save account'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <div style={{ marginTop: 'var(--nd-s2)' }}>
          <EmptyState
            message="Add the account your money actually sits in. Nothing is missing, there is just nothing yet."
            action={<Button variant="action" onClick={() => setIsAdding(true)}>Add account</Button>}
          />
        </div>
      ) : (
        <TableCard style={{ marginTop: 'var(--nd-s2)' }}>
          <Row cols={COLS} header>
            <Th>Account</Th><Th>Type</Th><Th align="right">Uncleared</Th><Th align="right">Balance</Th>
          </Row>
          {rows.map(a => (
            <Row key={a.name} cols={COLS} dense={false} onClick={() => setOpenAccount(a.name)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)', minWidth: 0 }}>
                <Dot size={8} color={a.type === 'tracked' ? 'var(--nd-turkoois)' : 'var(--app-accent)'} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                {a.type === 'tracked' && a.currency && a.currency !== 'ZAR' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--app-ink-faint)', whiteSpace: 'nowrap' }}>
                    {a.currency} @ {a.indicativeRate}
                  </span>
                )}
              </div>
              <div>
                <Badge tone={a.type === 'tracked' ? 'slate' : 'forest'}>{a.type}</Badge>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'right', color: 'var(--app-ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {a.uncleared ? formatCurrency(a.uncleared) : '—'}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, textAlign: 'right',
                color: a.balance < 0 ? 'var(--app-error)' : 'var(--app-ink)', fontVariantNumeric: 'tabular-nums'
              }}>
                {formatCurrency(a.balance)}
              </span>
            </Row>
          ))}
        </TableCard>
      )}

      {opened && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setOpenAccount(null)} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
          <div className="rl-slide" style={{
            position: 'relative', width: 'var(--drawer-w)', maxWidth: '100%', height: '100%',
            background: 'var(--app-surface)', borderLeft: 'var(--nd-rule)',
            boxShadow: 'var(--nd-shadow)', padding: 'var(--nd-s2)', boxSizing: 'border-box', overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              gap: 'var(--nd-gap)', paddingBottom: 'var(--nd-s1)', borderBottom: 'var(--nd-rule)'
            }}>
              <div>
                <StatLabel size="xs" muted>{opened.type}</StatLabel>
                <Heading level={2} style={{ fontSize: 22, margin: '6px 0 0' }}>{opened.name}</Heading>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
                  color: opened.balance < 0 ? 'var(--app-error)' : 'var(--app-ink)',
                  margin: '6px 0 0'
                }}>
                  {formatCurrency(opened.balance)}
                </p>
              </div>
              <IconBtn label="Close" onClick={() => setOpenAccount(null)}>{Icon.close()}</IconBtn>
            </div>
            <div style={{ marginTop: 'var(--nd-s1)' }}>
              <TransactionList
                transactions={ledger.transactions
                  .filter(t => t.account === opened.name && t.budget === budgetName)
                  .sort((a, b) => b.date.localeCompare(a.date))}
                accounts={accounts}
                categories={categories}
                budgetName={budgetName}
                token={token}
                onUpdate={onAssigned}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
