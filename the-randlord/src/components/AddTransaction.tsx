import React, { useState, useEffect } from 'react';
import { Transaction, Account, Category } from '../types';
import { Button, StatLabel, Dot, Icon, ErrorNote, inputStyleSm, moneyInputStyle } from '../ui/kit';

interface AddTransactionProps {
  token: string;
  currentBudget: string;
  accounts: Account[];
  categories?: Category[];
  transactions: Transaction[];
  onAdded: () => void;
  onCancel?: () => void;
}

interface DraftTransaction {
  id: string;
  date: string;
  amount: string;
  payee: string;
  account: string;
  category: string;
  memo: string;
  duplicateWarning?: boolean;
  transferAccountId?: string;
}

export function AddTransaction({
  token, currentBudget, accounts, categories, transactions, onAdded, onCancel
}: AddTransactionProps) {
  const [text, setText] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftTransaction[]>([]);
  const [armDraftId, setArmDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0].name);
  }, [accounts, selectedAccount]);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!selectedAccount) { setError('Choose an account first, or add one on the Accounts screen.'); return; }

    setIsParsing(true); setError(null); setDrafts([]); setArmDraftId(null);
    try {
      const categoryNames = (categories && categories.length > 0)
        ? categories.filter(c => !c.archived && c.name).map(c => c.name)
        : Array.from(new Set(transactions.map(t => t.category).filter(Boolean)));

      const parseRes = await fetch('/api/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          text,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          categories: categoryNames
        })
      });
      if (!parseRes.ok) throw new Error('We could not read that. Try naming the amount and the payee.');

      let parsedData = await parseRes.json();
      if (!Array.isArray(parsedData)) parsedData = [parsedData];
      if (parsedData.length === 0) throw new Error('Nothing in there looked like a transaction.');

      setDrafts(parsedData.map((d: any, index: number) => ({
        id: `draft-${Date.now()}-${index}`,
        date: d.date || new Date().toISOString().split('T')[0],
        amount: String(d.amount || 0),
        payee: d.payee || '',
        account: selectedAccount,
        category: d.category || '',
        memo: d.memo || '',
        duplicateWarning: transactions.some(t =>
          t.date === d.date &&
          Math.abs(t.amount) === Math.abs(d.amount) &&
          (t.payee || '').toLowerCase() === (d.payee || '').toLowerCase()
        ),
        transferAccountId: d.transferAccountId
      })));
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsParsing(false);
    }
  };

  const updateDraft = (id: string, field: keyof DraftTransaction, value: any) =>
    setDrafts(drafts.map(d => d.id === id ? { ...d, [field]: value } : d));

  const removeDraft = (id: string) => setDrafts(drafts.filter(d => d.id !== id));

  const handleConfirmSave = async () => {
    if (drafts.length === 0) return;
    setIsSaving(true); setError(null);
    try {
      const rows: any[][] = [];
      drafts.forEach(d => {
        if (d.transferAccountId) {
          const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const amount = Math.abs(parseFloat(String(d.amount)) || 0);
          rows.push([d.date, d.payee || `Transfer to ${d.transferAccountId}`, -amount, d.account, '', currentBudget, d.memo, false, 'nl-entry', d.transferAccountId, transferId]);
          rows.push([d.date, d.payee || `Transfer from ${d.account}`, amount, d.transferAccountId, '', currentBudget, d.memo, false, 'nl-entry', d.account, transferId]);
        } else {
          rows.push([d.date, d.payee, parseFloat(String(d.amount)) || 0, d.account, d.category, currentBudget, d.memo, false, 'nl-entry', '', '']);
        }
      });

      const appendRes = await fetch('/api/sheets/appendBatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sheet: 'Transactions', rows })
      });
      const appendData = await appendRes.json().catch(() => ({}));
      if (!appendRes.ok || appendData.saved === false) {
        throw new Error(appendData.error || 'We could not write to the sheet. In demo mode, nothing is logged.');
      }

      setText(''); setDrafts([]);
      onAdded();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  /* ── compose ── */
  if (drafts.length === 0) {
    return (
      <form onSubmit={handleParse} style={{ padding: 'var(--nd-s1) var(--nd-s2)' }}>
        <StatLabel size="xs" muted>New transaction</StatLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 'var(--nd-gap)', alignItems: 'end', marginTop: 'var(--nd-gap)' }}>
          <div>
            <StatLabel size="xs">Account</StatLabel>
            <select
              className="rl-input" style={{ ...inputStyleSm, marginTop: 4 }} value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)} disabled={isParsing || accounts.length === 0}
            >
              {accounts.length === 0 && <option value="">No accounts yet</option>}
              {accounts.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <StatLabel size="xs">What happened</StatLabel>
            <input
              className="rl-input" type="text" style={{ ...inputStyleSm, marginTop: 4 }} autoComplete="off"
              placeholder="R 812 at Woolworths today, or paste a statement line"
              value={text} onChange={e => setText(e.target.value)} disabled={isParsing}
            />
          </div>
        </div>

        {error && <div style={{ marginTop: 'var(--nd-gap)' }}><ErrorNote title="Input error" body={error} /></div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)', marginTop: 'var(--nd-s1)' }}>
          <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: 0 }}>
            Write it how you would say it. Check everything before logging.
          </p>
          <div style={{ display: 'flex', gap: 'var(--nd-gap)', justifyContent: 'flex-end', flex: '0 0 auto' }}>
            {onCancel && <Button variant="secondary" size="sm" onClick={onCancel} disabled={isParsing}>Cancel</Button>}
            <Button variant="action" type="submit" size="sm" disabled={!text.trim() || !selectedAccount || isParsing}>
              {isParsing ? <><Dot size={7} color="var(--nd-paper)" breathe /> Reading</> : <>{Icon.send(13)} Draft it</>}
            </Button>
          </div>
        </div>
      </form>
    );
  }

  /* ── review drafts ── */
  return (
    <div style={{ padding: 'var(--nd-s1) var(--nd-s2)' }}>
      <StatLabel size="xs" muted>Check these before logging</StatLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nd-gap)', marginTop: 'var(--nd-gap)' }}>
        {drafts.map(draft => {
          const isTracked = accounts.find(a => a.name === draft.account)?.type === 'tracked';
          return (
            <div key={draft.id} style={{
              padding: 'var(--nd-gap)', background: 'var(--nd-surface)', border: 'var(--nd-rule)', borderRadius: 0
            }}>
              {draft.duplicateWarning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)', marginBottom: 'var(--nd-gap)' }}>
                  <Dot size={6} color="var(--nd-oranje)" />
                  <StatLabel size="xs">
                    Possible duplicate: check date and amount
                  </StatLabel>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '124px minmax(0,1fr) minmax(0,1fr) 124px auto', gap: 'var(--nd-gap)', alignItems: 'end' }}>
                <div>
                  <StatLabel size="xs" muted>Date</StatLabel>
                  <input className="rl-input" type="date" style={{ ...inputStyleSm, marginTop: 4 }} value={draft.date} onChange={e => updateDraft(draft.id, 'date', e.target.value)} disabled={isSaving} />
                </div>
                <div>
                  <StatLabel size="xs" muted>Payee</StatLabel>
                  <input className="rl-input" type="text" style={{ ...inputStyleSm, marginTop: 4 }} value={draft.payee} onChange={e => updateDraft(draft.id, 'payee', e.target.value)} disabled={isSaving} />
                </div>
                {draft.transferAccountId !== undefined ? (
                  <div>
                    <StatLabel size="xs" muted>Transfer to</StatLabel>
                    <select className="rl-input" style={{ ...inputStyleSm, marginTop: 4 }} value={draft.transferAccountId} onChange={e => updateDraft(draft.id, 'transferAccountId', e.target.value)} disabled={isSaving}>
                      <option value="">Choose an account</option>
                      {accounts.filter(a => a.name !== draft.account).map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                    </select>
                  </div>
                ) : isTracked ? <span /> : (
                  <div>
                    <StatLabel size="xs" muted>Category</StatLabel>
                    <select
                      className="rl-input"
                      style={{ ...inputStyleSm, marginTop: 4 }}
                      value={draft.category}
                      onChange={e => updateDraft(draft.id, 'category', e.target.value)}
                      disabled={isSaving}
                    >
                      <option value="">Uncategorised</option>
                      {(categories && categories.length > 0
                        ? categories.filter(c => !c.archived && c.name)
                        : []
                      ).map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                      {draft.category && !(categories || []).some(c => c.name === draft.category && !c.archived) && (
                        <option value={draft.category}>{draft.category}</option>
                      )}
                    </select>
                  </div>
                )}
                <div>
                  <StatLabel size="xs" muted>Amount</StatLabel>
                  <input
                    className="rl-input" type="text" inputMode="decimal"
                    style={{ ...moneyInputStyle, height: 38, fontSize: 13, marginTop: 4 }}
                    value={draft.amount} onChange={e => updateDraft(draft.id, 'amount', e.target.value.replace(/,/g, '.'))} disabled={isSaving}
                  />
                </div>
                <Button
                  variant={armDraftId === draft.id ? 'danger' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    if (armDraftId === draft.id) {
                      removeDraft(draft.id);
                      setArmDraftId(null);
                    } else {
                      setArmDraftId(draft.id);
                    }
                  }}
                  disabled={isSaving}
                  style={{ height: 38 }}
                >
                  {armDraftId === draft.id ? 'Tap to confirm' : Icon.close(13)}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <div style={{ marginTop: 'var(--nd-gap)' }}><ErrorNote title="Nothing was logged" body={error} /></div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--nd-gap)', marginTop: 'var(--nd-s1)' }}>
        <Button variant="secondary" size="sm" onClick={() => setDrafts([])} disabled={isSaving}>Back</Button>
        <Button variant="action" size="sm" onClick={handleConfirmSave} disabled={isSaving || drafts.length === 0}>
          {isSaving
            ? <><Dot size={7} color="var(--nd-paper)" breathe /> Logging</>
            : <>{Icon.check(13)} Log {drafts.length > 1 ? `all ${drafts.length}` : 'it'}</>}
        </Button>
      </div>
    </div>
  );
}
