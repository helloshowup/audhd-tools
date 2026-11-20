export interface Transaction {
  rowIndex?: number;
  date: string;
  payee: string;
  amount: number;
  account: string;
  category: string;
  budget: string;
  memo: string;
  cleared: boolean;
  source: string;
  transferAccountId?: string;
  transferId?: string;
}

export interface Assignment {
  rowIndex?: number;
  month: string;
  category: string;
  amount: number;
  budget: string;
}

export interface Account {
  rowIndex?: number;
  name: string;
  type: string;
  startingBalance: number;
  budget: string;
  currency?: string;
  indicativeRate?: number;
}

export interface Category {
  rowIndex?: number;
  name: string;
  group: string;
  target: number;
  budget: string;
  archived?: boolean;
}

export interface LedgerConfig {
  key: string;
  value: string;
}

export interface Ledger {
  transactions: Transaction[];
  assignments: Assignment[];
  accounts: Account[];
  categories: Category[];
  config: LedgerConfig[];
}

export type PlanBudget = 'Personal' | 'Business';
export type PlanGroup = 'Personal fixed' | 'Personal variable' | 'Agency' | 'Income' | 'Changes';
export type PlanLabel = 'FACT' | 'ESTIMATE' | 'MISSING' | 'BUDGET SUGGESTION' | 'UNVERIFIED';
export type PlanTier = 'base' | 'building' | 'suggestion' | 'none';
export type PlanCadence = 'monthly' | 'one-off' | 'annual';

export interface PlanRow {
  rowIndex?: number;
  budget: PlanBudget;
  group: PlanGroup;
  name: string;
  amount: number | null;
  label: PlanLabel;
  source: string;
  tier: PlanTier;
  start: string;
  end: string;
  cadence: PlanCadence;
  linkedItem: string;
  delta: number | null;
  notes: string;
}
