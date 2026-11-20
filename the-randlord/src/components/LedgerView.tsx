import { useMemo, useState } from 'react';
import { Ledger } from '../types';
import { TransactionList } from './TransactionList';
import { AddTransaction } from './AddTransaction';
import { Button, FilterChip, FilterChipRow, Icon, TableCard, inputStyle } from '../ui/kit';

interface LedgerViewProps {
  ledger: Ledger;
  budgetName: string;
  token: string;
  onUpdate: () => void;
}

export function LedgerView({ ledger, budgetName, token, onUpdate }: LedgerViewProps) {
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState('all');
  const [composing, setComposing] = useState(false);

  const accounts = ledger.accounts.filter(a => a.budget === budgetName && a.name);
  const categories = ledger.categories.filter(c => c.budget === budgetName && c.name);

  const transactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ledger.transactions
      .filter(t => t.budget === budgetName && t.date)
      .filter(t => account === 'all' || t.account === account)
      .filter(t => !q || (t.payee || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [ledger.transactions, budgetName, account, search]);

  const chips = ['all', ...accounts.map(a => a.name)].slice(0, 6);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)', padding: '0 0 var(--nd-s1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)', flex: '1 1 auto', minWidth: 0 }}>
          <div className="rl-input" style={{
            display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)', height: 38, padding: '0 var(--nd-gap)',
            background: 'var(--nd-surface)', border: 'var(--nd-rule)',
            borderRadius: 0, flex: '0 1 300px', boxSizing: 'border-box'
          }}>
            <span style={{ color: 'var(--app-ink-muted)', display: 'inline-flex' }}>{Icon.search(14)}</span>
            <input
              type="text" placeholder="Search payee or category"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--app-ink)', fontFamily: 'inherit' }}
            />
          </div>

          <FilterChipRow>
            {chips.map(name => {
              const count = name === 'all'
                ? ledger.transactions.filter(t => t.budget === budgetName && t.date).length
                : ledger.transactions.filter(t => t.budget === budgetName && t.date && t.account === name).length;
              return (
                <FilterChip
                  key={name}
                  active={account === name}
                  count={count}
                  onClick={() => setAccount(name)}
                >
                  {name === 'all' ? 'All accounts' : name}
                </FilterChip>
              );
            })}
          </FilterChipRow>
        </div>
        <Button
          variant={composing ? 'secondary' : 'action'}
          onClick={() => setComposing(c => !c)}
          style={{ flex: '0 0 auto' }}
        >
          {composing ? 'Close form' : 'Add transaction'}
        </Button>
      </div>

      <TableCard>
        {composing && (
          <div style={{ background: 'var(--app-surface-alt)', borderBottom: '2px solid var(--nd-ink)' }}>
            <AddTransaction
              token={token}
              currentBudget={budgetName}
              accounts={accounts}
              categories={categories}
              transactions={ledger.transactions.filter(t => t.budget === budgetName)}
              onAdded={() => { setComposing(false); onUpdate(); }}
              onCancel={() => setComposing(false)}
            />
          </div>
        )}

        <TransactionList
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          budgetName={budgetName}
          token={token}
          onUpdate={onUpdate}
          totalCount={ledger.transactions.filter(t => t.budget === budgetName && t.date).length}
        />
      </TableCard>
    </div>
  );
}
