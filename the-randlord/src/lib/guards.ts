/**
 * The Randlord — Runtime Safety Guards & Quarantine Pipeline
 * Enforces:
 * 1. Sheet name whitelist (RL-R03)
 * 2. Protection against PAN / bank account leakage (13-19 digit cards/accounts)
 * 3. Formula injection sanitisation (=, +, -, @ prefix protection)
 * 4. Row index boundary enforcement (rowIndex >= 2 to protect row 1 headers)
 * 5. Corrupt record quarantine without data loss
 */

import { Ledger, Transaction, Account, Category, Assignment } from '../types';

export const ALLOWED_SHEETS = new Set([
  'Transactions',
  'Assignments',
  'Accounts',
  'Categories',
  'Config',
  'Plan'
]);

/**
 * Validates that the requested sheet is in the allowed whitelist.
 */
export function validateSheetName(sheet: string): boolean {
  return typeof sheet === 'string' && ALLOWED_SHEETS.has(sheet.trim());
}

/**
 * Validates that a string does not contain 13–19 consecutive digits (or digit blocks)
 * representing credit card PANs or full bank account numbers.
 */
export function validateNoPanOrAccountNumbers(text: string): boolean {
  if (!text || typeof text !== 'string') return true;
  // Match 13 to 19 digits with optional spaces or dashes
  const panRegex = /\b(?:\d[ -]*?){13,19}\b/;
  return !panRegex.test(text);
}

/**
 * Sanitises strings that begin with formula trigger characters (=, +, -, @)
 * to prevent formula injection into Google Sheets.
 */
export function sanitiseFormulaInjection(val: any): any {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (trimmed.length > 0 && ['=', '+', '-', '@'].includes(trimmed[0])) {
    // If it's a negative or positive plain number, allow it as a number
    if (/^[-+]?\d+(?:\.\d+)?$/.test(trimmed)) {
      return val;
    }
    return `'${val}`;
  }
  return val;
}

/**
 * Validates that row index is at least 2, preventing accidental overwrite of row 1 headers.
 */
export function validateRowIndex(rowIndex: number): boolean {
  return typeof rowIndex === 'number' && Number.isInteger(rowIndex) && rowIndex >= 2;
}

/**
 * Sanitises an entire array of row values for safe sheet writing.
 */
export function sanitiseRowValues(row: any[]): any[] {
  return row.map(cell => sanitiseFormulaInjection(cell));
}

/**
 * Quarantine pipeline for fetched ledger records.
 * Identifies corrupted or malformed transactions (NaN amounts, invalid dates)
 * and holds them aside safely without breaking budget math.
 */
export function quarantineLedgerData(raw: Ledger): { safe: Ledger; quarantinedCount: number } {
  let quarantinedCount = 0;

  const safeTransactions = (raw.transactions || []).filter(t => {
    // Must have a valid numeric amount
    if (typeof t.amount !== 'number' || isNaN(t.amount)) {
      quarantinedCount++;
      return false;
    }

    // Must have a valid date string (YYYY-MM-DD or parseable)
    if (!t.date || typeof t.date !== 'string' || isNaN(new Date(t.date).getTime())) {
      quarantinedCount++;
      return false;
    }

    return true;
  });

  const safeAccounts = (raw.accounts || []).filter(a => {
    if (typeof a.startingBalance !== 'number' || isNaN(a.startingBalance)) {
      quarantinedCount++;
      return false;
    }
    return true;
  });

  const safeCategories = (raw.categories || []).filter(c => {
    if (!c.name || typeof c.name !== 'string') {
      quarantinedCount++;
      return false;
    }
    return true;
  });

  const safeAssignments = (raw.assignments || []).filter(a => {
    if (typeof a.amount !== 'number' || isNaN(a.amount)) {
      quarantinedCount++;
      return false;
    }
    return true;
  });

  return {
    safe: {
      transactions: safeTransactions,
      accounts: safeAccounts,
      categories: safeCategories,
      assignments: safeAssignments,
      config: raw.config || []
    },
    quarantinedCount
  };
}
