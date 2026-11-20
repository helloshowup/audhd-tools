import { Ledger, Transaction, Assignment, Account, Category } from '../types';

export interface CategoryMonth {
  categoryId: string; // name
  month: string; // YYYY-MM
  assigned: number;
  activity: number;
  available: number;
}

export interface BudgetState {
  toBeAssigned: number;
  categories: CategoryMonth[];
  ageOfMoney: number;
}

export function computeBudgetState(ledger: Ledger, currentMonth: string, budgetName: string): BudgetState {
  const transactions = ledger.transactions.filter(t => t.budget === budgetName && t.date);
  const assignments = ledger.assignments.filter(a => a.budget === budgetName && a.month);
  const accounts = ledger.accounts.filter(a => a.budget === budgetName && a.name);
  const categories = ledger.categories.filter(c => c.budget === budgetName && c.name);

  const budgetAccounts = accounts.filter(a => a.type !== 'tracked');

  // Get all unique months up to currentMonth
  const allDates = transactions.map(t => t.date.substring(0, 7)).concat(assignments.map(a => a.month));
  let months = Array.from(new Set(allDates)).sort();
  if (!months.includes(currentMonth)) {
    months.push(currentMonth);
    months.sort();
  }

  // Remove future months for past calculation
  months = months.filter(m => m <= currentMonth);

  let carryover: Record<string, number> = {};
  let toBeAssigned = budgetAccounts.reduce((sum, a) => sum + a.startingBalance, 0);
  let currentMonthCategories: CategoryMonth[] = [];

  for (const month of months) {
    let monthOverspend = 0;
    
    // Inflows for the month (transactions without a category are To Be Assigned)
    const monthTx = transactions.filter(t => t.date.substring(0, 7) === month);
    
    // Add uncategorised inflows to TBA
    const inflows = monthTx.filter(t => {
      if (t.amount <= 0) return false;
      if (t.category && t.category.trim() !== 'To Be Assigned') return false;
      if (t.transferId) {
        const otherAccount = accounts.find(a => a.name === t.transferAccountId);
        if (otherAccount && otherAccount.type !== 'tracked') return false; // transfer from another budget account
      }
      return true;
    }).reduce((sum, t) => sum + t.amount, 0);
    toBeAssigned += inflows;

    if (month === currentMonth) {
      currentMonthCategories = []; 
    }

    // Uncategorised outflows
    const uncategorisedOutflows = monthTx.filter(t => {
      if (t.amount >= 0) return false;
      if (t.category && t.category !== 'To Be Assigned' && categories.find(c => c.name === t.category)) return false;
      if (t.transferId) {
        const otherAccount = accounts.find(a => a.name === t.transferAccountId);
        if (otherAccount && otherAccount.type !== 'tracked') return false; // transfer to another budget account
      }
      return true;
    }).reduce((sum, t) => sum + t.amount, 0);

    if (uncategorisedOutflows < 0) {
       const previousAvailable = carryover['Uncategorised'] || 0;
       const available = previousAvailable + uncategorisedOutflows;
       if (month === currentMonth) {
         currentMonthCategories.push({
           categoryId: 'Uncategorised',
           month,
           assigned: 0,
           activity: uncategorisedOutflows,
           available
         });
       }
       if (available > 0) {
         carryover['Uncategorised'] = available;
       } else {
         carryover['Uncategorised'] = 0;
         monthOverspend += Math.abs(available);
       }
    }

    for (const cat of categories) {
      const catName = cat.name;
      const assigned = assignments
        .filter(a => a.month === month && a.category === catName)
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

      const activity = monthTx.filter(t => t.category === catName && !t.transferId).reduce((sum, t) => sum + t.amount, 0);
      
      toBeAssigned -= assigned; // Assigning money removes from TBA

      const previousAvailable = carryover[catName] || 0;
      const available = previousAvailable + assigned + activity;

      if (month === currentMonth) {
        currentMonthCategories.push({
          categoryId: catName,
          month,
          assigned,
          activity,
          available
        });
      }

      if (available > 0) {
        carryover[catName] = available; // Positive carries forward
      } else {
        carryover[catName] = 0; // Overspend doesn't carry as category debt
        monthOverspend += Math.abs(available); // It reduces next month's TBA
      }
    }
    
    // Deduct overspend from TBA for next month
    toBeAssigned -= monthOverspend;
  }

  return {
    toBeAssigned,
    categories: currentMonthCategories,
    ageOfMoney: computeAgeOfMoney(transactions, budgetAccounts.reduce((sum, a) => sum + a.startingBalance, 0) + transactions.filter(t => !t.transferId || (t.transferId && accounts.find(a => a.name === t.transferAccountId)?.type === 'tracked')).reduce((sum, t) => sum + t.amount, 0))
  };
}

export function formatCurrency(val: number): string {
  const isNeg = val < 0;
  const parts = Math.abs(val).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (isNeg ? '-R ' : 'R ') + parts.join('.');
}

function computeAgeOfMoney(transactions: Transaction[], currentLiquidCash: number): number {
  if (transactions.length === 0) return 0;
  
  const outflows = transactions.filter(t => t.amount < 0);
  if (outflows.length === 0) return 0;

  const totalOutflows = outflows.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const dates = transactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
  if (dates.length === 0) return 0;
  
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const daysHistory = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));
  
  const divisorDays = Math.max(30, daysHistory);
  const avgDailyOutflow = totalOutflows / divisorDays;
  if (avgDailyOutflow === 0) return 0;
  return Math.round(currentLiquidCash / avgDailyOutflow);
}

export function calculateNetWorth(accounts: Account[], transactions: Transaction[], budgetName: string): number {
  const filteredAccounts = accounts.filter(a => a.budget === budgetName && a.name);
  const filteredTransactions = transactions.filter(t => t.budget === budgetName);

  return filteredAccounts.reduce((total, account) => {
    const starting = Number(account.startingBalance) || 0;
    const activity = filteredTransactions
      .filter(t => t.account === account.name)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const balance = starting + activity;
    const rate = (account.type === 'tracked' && account.currency !== 'ZAR')
      ? (Number(account.indicativeRate) || 1)
      : 1;
    return total + (balance * rate);
  }, 0);
}
