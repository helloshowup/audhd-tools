/**
 * Demo ledger — the sample data served when RANDLORD_DEMO=1.
 *
 * This exists so the app can be walked through before the Google Sheets
 * backend is wired up. It is NOT a fixture for tests and not a fallback: the
 * only thing that reaches it is the explicit RANDLORD_DEMO switch in
 * server.ts. With the switch off, every route talks to Sheets as before.
 *
 * Dates are generated at call time so the current month is always populated
 * and the month arrows in Budget have a previous month to walk back into.
 */

interface DemoRow { day: number; payee: string; amount: number; account: string; category: string; memo?: string; }

const THIS_MONTH: DemoRow[] = [
  { day: 1,  payee: 'Salary',            amount: 42000,   account: 'Cheque',       category: '',                memo: 'To be assigned' },
  { day: 1,  payee: 'Landlord',          amount: -9500,   account: 'Cheque',       category: 'Rent' },
  { day: 2,  payee: 'City of Cape Town', amount: -1240.5, account: 'Cheque',       category: 'Electricity' },
  { day: 3,  payee: 'Afrihost',          amount: -899,    account: 'Cheque',       category: 'Internet' },
  { day: 4,  payee: 'Checkers',          amount: -1436.8, account: 'Cheque',       category: 'Groceries' },
  { day: 6,  payee: 'Uber',              amount: -186.4,  account: 'Virtual Card', category: 'Transport' },
  { day: 8,  payee: 'Truth Coffee',      amount: -215,    account: 'Virtual Card', category: 'Eating out' },
  { day: 9,  payee: 'Woolworths',        amount: -742.15, account: 'Cheque',       category: 'Groceries' },
  { day: 11, payee: 'Anthropic',         amount: -380,    account: 'Credit Card',  category: 'Software',        memo: 'Business' },
  { day: 12, payee: 'Harbour Studio',        amount: -5995,   account: 'Cheque',       category: 'Studio rent',     memo: 'Business' },
  { day: 14, payee: 'Discovery',         amount: -2310,   account: 'Cheque',       category: 'Medical aid' },
  { day: 15, payee: 'Client invoice',    amount: 18500,   account: 'Cheque',       category: '',                memo: 'To be assigned' },
  { day: 17, payee: 'Pick n Pay',        amount: -689.3,  account: 'Cheque',       category: 'Groceries' },
  { day: 19, payee: 'Netflix',           amount: -199,    account: 'Credit Card',  category: 'Subscriptions' }
];

const LAST_MONTH: DemoRow[] = [
  { day: 1,  payee: 'Salary',            amount: 42000,   account: 'Cheque',       category: '' },
  { day: 1,  payee: 'Landlord',          amount: -9500,   account: 'Cheque',       category: 'Rent' },
  { day: 3,  payee: 'City of Cape Town', amount: -1180,   account: 'Cheque',       category: 'Electricity' },
  { day: 5,  payee: 'Checkers',          amount: -1622.4, account: 'Cheque',       category: 'Groceries' },
  { day: 12, payee: 'Kloof Street House',amount: -940,    account: 'Credit Card',  category: 'Eating out' },
  { day: 22, payee: 'Uber',              amount: -412.7,  account: 'Virtual Card', category: 'Transport' }
];

const CATEGORIES = [
  { name: 'Rent',          group: 'Fixed',    target: 9500,  budget: 'Personal' },
  { name: 'Electricity',   group: 'Fixed',    target: 1400,  budget: 'Personal' },
  { name: 'Internet',      group: 'Fixed',    target: 899,   budget: 'Personal' },
  { name: 'Medical aid',   group: 'Fixed',    target: 2310,  budget: 'Personal' },
  { name: 'Groceries',     group: 'Living',   target: 4500,  budget: 'Personal' },
  { name: 'Transport',     group: 'Living',   target: 1200,  budget: 'Personal' },
  { name: 'Eating out',    group: 'Living',   target: 900,   budget: 'Personal' },
  { name: 'Subscriptions', group: 'Living',   target: 400,   budget: 'Personal' },
  { name: 'Software',      group: 'Business', target: 1500,  budget: 'Business' },
  { name: 'Studio rent',   group: 'Business', target: 5995,  budget: 'Business' }
];

const ACCOUNTS = [
  { name: 'Cheque',       type: 'cheque',  startingBalance: 18400,  budget: 'Personal' },
  { name: 'Savings',      type: 'savings', startingBalance: 65000,  budget: 'Personal' },
  { name: 'Virtual Card', type: 'cheque',  startingBalance: 900,    budget: 'Personal' },
  { name: 'Credit Card',  type: 'credit',  startingBalance: -4210,  budget: 'Personal' }
];

const monthKey = (offset: number): string => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function demoLedger() {
  const months: [string, DemoRow[]][] = [[monthKey(-1), LAST_MONTH], [monthKey(0), THIS_MONTH]];

  let rowIndex = 1;
  const transactions = months.flatMap(([month, rows]) =>
    rows.map(r => ({
      rowIndex: ++rowIndex,
      date: `${month}-${String(r.day).padStart(2, '0')}`,
      payee: r.payee,
      amount: r.amount,
      account: r.account,
      category: r.category,
      budget: r.memo === 'Business' ? 'Business' : 'Personal',
      memo: r.memo ?? '',
      cleared: true,
      source: 'demo'
    }))
  );

  const assignments = months.flatMap(([month]) =>
    CATEGORIES.map((c, i) => ({
      rowIndex: 2 + i,
      month,
      category: c.name,
      amount: c.target,
      budget: c.budget
    }))
  );

  return {
    transactions,
    assignments,
    accounts: ACCOUNTS.map((a, i) => ({ ...a, rowIndex: i + 2, currency: 'ZAR', indicativeRate: 1 })),
    categories: CATEGORIES.map((c, i) => ({ ...c, rowIndex: i + 2, archived: false })),
    config: []
  };
}
