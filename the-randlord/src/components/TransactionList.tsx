import { useState } from 'react';
import { formatCurrency } from '../lib/ledger-math';
import { Transaction, Account, Category } from '../types';
import { Row, Th, Button, StatLabel, Money, Dot, EmptyState, ErrorNote, inputStyleSm, moneyInputStyle } from '../ui/kit';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgetName: string;
  token: string;
  onUpdate: () => void;
  totalCount?: number;
}

const COLS = '44px 108px minmax(0, 1fr) 190px 160px 136px';
const PAGE_SIZE = 15;

export function TransactionList({
  transactions, accounts, categories, budgetName, token, onUpdate, totalCount
}: TransactionListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [armDelete, setArmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('');
  const [cleared, setCleared] = useState(false);

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const current = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const notCleared = transactions.filter(t => !t.cleared).length;

  const startEdit = (t: Transaction) => {
    if (!t.rowIndex) return;
    setError(null);
    setEditingId(t.rowIndex);
    setArmDelete(false);
    setDate(t.date); setPayee(t.payee); setAmount(String(t.amount));
    setAccount(t.account); setCategory(t.category); setCleared(t.cleared);
  };

  const writeRow = async (t: Transaction, values: any[]) => {
    setError(null);
    const res = await fetch('/api/sheets/updateRow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ sheet: 'Transactions', rowIndex: t.rowIndex, values })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.saved === false) {
      throw new Error(data.error || 'Row could not be saved to your sheet. In demo mode, changes are not saved.');
    }
  };

  const handleSave = async (t: Transaction) => {
    if (!t.rowIndex) return;
    try {
      await writeRow(t, [date, payee, Number(amount) || 0, account, category, budgetName, t.memo, String(cleared), t.source]);
      setEditingId(null);
      onUpdate();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not save that transaction.');
    }
  };

  const toggleCleared = async (t: Transaction) => {
    if (!t.rowIndex) return;
    try {
      await writeRow(t, [t.date, t.payee, t.amount, t.account, t.category, budgetName, t.memo, String(!t.cleared), t.source]);
      onUpdate();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not update the cleared state.');
    }
  };

  const handleDelete = async (t: Transaction) => {
    if (!t.rowIndex) return;
    if (!armDelete) {
      setArmDelete(true);
      return;
    }
    try {
      setError(null);
      const res = await fetch('/api/sheets/deleteRow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sheet: 'Transactions', rowIndex: t.rowIndex })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.saved === false) {
        throw new Error(data.error || 'Row could not be deleted from your sheet. In demo mode, changes are not saved.');
      }
      setEditingId(null);
      setArmDelete(false);
      onUpdate();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not delete that transaction.');
    }
  };

  return (
    <div>
      {error && (
        <div style={{ padding: '8px 16px' }}>
          <ErrorNote title="Not saved" body={error} />
        </div>
      )}
      <Row cols={COLS} header>
        <Th>Ok</Th><Th>Date</Th><Th>Payee</Th><Th>Category</Th><Th>Account</Th><Th align="right">Amount</Th>
      </Row>

      {current.map(t => {
        const isEditing = editingId === t.rowIndex;
        const isTracked = accounts.find(a => a.name === t.account)?.type === 'tracked';
        const uncategorised = !isTracked && !t.category;

        if (isEditing) {
          return (
            <div key={t.rowIndex} style={{ padding: 'var(--nd-s1) var(--nd-s2)', background: 'var(--app-surface-alt)', borderBottom: 'var(--nd-rule)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '124px minmax(0,1fr) minmax(0,1fr) 160px 124px', gap: 'var(--nd-gap)', alignItems: 'end' }}>
                <div>
                  <StatLabel size="xs" muted>Date</StatLabel>
                  <input className="rl-input" type="date" style={{ ...inputStyleSm, marginTop: 4 }} value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <StatLabel size="xs" muted>Payee</StatLabel>
                  <input className="rl-input" type="text" style={{ ...inputStyleSm, marginTop: 4 }} value={payee} onChange={e => setPayee(e.target.value)} />
                </div>
                <div>
                  <StatLabel size="xs" muted>Category</StatLabel>
                  <select className="rl-input" style={{ ...inputStyleSm, marginTop: 4 }} value={category} onChange={e => setCategory(e.target.value)} disabled={isTracked}>
                    <option value="">To be assigned</option>
                    {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <StatLabel size="xs" muted>Account</StatLabel>
                  <select className="rl-input" style={{ ...inputStyleSm, marginTop: 4 }} value={account} onChange={e => setAccount(e.target.value)}>
                    {accounts.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <StatLabel size="xs" muted>Amount</StatLabel>
                  <input
                    className="rl-input" type="text" inputMode="decimal"
                    style={{ ...moneyInputStyle, height: 38, fontSize: 13, marginTop: 4 }}
                    value={amount} onChange={e => setAmount(e.target.value.replace(/,/g, '.'))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)', marginTop: 'var(--nd-s1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-s1)' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cleared}
                      onChange={e => setCleared(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--nd-ink)' }}
                    />
                    <StatLabel size="xs">Cleared</StatLabel>
                  </label>
                  <Button size="sm" variant={armDelete ? "danger" : "ghost"} onClick={() => handleDelete(t)}>
                    {armDelete ? 'Tap to confirm' : 'Delete'}
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: 'var(--nd-gap)', justifyContent: 'flex-end' }}>
                  <Button size="sm" variant="secondary" onClick={() => { setEditingId(null); setArmDelete(false); }}>Cancel</Button>
                  <Button size="sm" variant="action" onClick={() => handleSave(t)}>Save</Button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <Row key={t.rowIndex} cols={COLS} onClick={() => startEdit(t)}>
            <button
              type="button" aria-label={t.cleared ? 'Mark not cleared' : 'Mark cleared'}
              onClick={e => { e.stopPropagation(); toggleCleared(t); }}
              style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{
                width: 12, height: 12, borderRadius: 0,
                border: `var(--nd-rule)`,
                background: t.cleared ? 'var(--nd-ink)' : 'transparent',
                transition: 'background-color var(--dur-fast) var(--ease-out)'
              }} />
            </button>

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--app-ink-muted)', fontVariantNumeric: 'tabular-nums' }}>{t.date}</span>

            <span style={{ fontSize: 14, color: 'var(--app-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.payee || 'Unknown'}
            </span>

            {isTracked ? <span /> : (
              <span style={{
                justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%',
                padding: '3px 8px', borderRadius: 0, border: '1px solid var(--nd-ink)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden',
                background: uncategorised ? 'var(--app-error-tint)' : 'var(--app-surface-alt)',
                color: uncategorised ? 'var(--app-error)' : 'var(--app-ink)'
              }}>
                <Dot size={5} color={uncategorised ? 'var(--nd-rooi)' : 'var(--nd-ink-muted)'} />
                {uncategorised ? 'Needs category' : t.category}
              </span>
            )}

            <span style={{ fontSize: 13, color: 'var(--app-ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.account}</span>

            <Money
              size={13}
              tone={t.amount > 0 ? 'var(--app-success)' : 'var(--app-ink)'}
            >
              {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
            </Money>
          </Row>
        );
      })}

      {transactions.length === 0 && (
        <div style={{ padding: 'var(--nd-s2) 0' }}>
          <EmptyState message="Nothing here yet. Nothing is missing, there is just nothing to show." />
        </div>
      )}

      {transactions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)', padding: 'var(--nd-s1) var(--nd-s2)' }}>
          <StatLabel size="xs" muted>
            {transactions.length} of {totalCount ?? transactions.length} shown · {notCleared} uncleared
          </StatLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)' }}>
            <Button size="sm" variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <StatLabel size="xs" style={{ minWidth: 80, textAlign: 'center' }}>Page {page} of {totalPages}</StatLabel>
            <Button size="sm" variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
