import type { PlanRow, PlanBudget, PlanGroup, PlanLabel, PlanTier, PlanCadence } from '../types';

/* Pure: no DOM, no Node APIs. Error messages carry row and column only,
   never the cell value, so a log or a screenshot cannot leak plan data. */

export const PLAN_HEADERS = [
  'Budget', 'Group', 'Name', 'Amount', 'Label', 'Source', 'Totals tier',
  'Start', 'End', 'Cadence', 'Linked item', 'Delta', 'Notes'
] as const;

export const PLAN_MAX_ROWS = 500;

export interface PlanIssue { row: number; column: string; message: string }
export interface PlanParse { rows: PlanRow[]; errors: PlanIssue[]; warnings: PlanIssue[] }

const BUDGETS: PlanBudget[] = ['Personal', 'Business'];
const GROUPS: PlanGroup[] = ['Personal fixed', 'Personal variable', 'Agency', 'Income', 'Changes'];
const LABELS: PlanLabel[] = ['FACT', 'ESTIMATE', 'MISSING', 'BUDGET SUGGESTION', 'UNVERIFIED'];
const TIERS: PlanTier[] = ['base', 'building', 'suggestion', 'none'];
const CADENCES: PlanCadence[] = ['monthly', 'one-off', 'annual'];

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Same name -> same key, whatever the case, spacing or Unicode form. */
export function planKey(r: Pick<PlanRow, 'budget' | 'group' | 'name'>): string {
  return `${r.budget.toLowerCase()}|${r.group.toLowerCase()}|${collapse(r.name).toLowerCase()}`.normalize('NFC');
}

/** 13 values for USER_ENTERED. The leading apostrophe stops formula and date coercion. */
export function serialisePlanRow(r: PlanRow): (string | number)[] {
  const t = (s: string) => (s === '' ? '' : `'${s}`);
  const n = (v: number | null) => (v === null ? '' : v);
  return [
    t(r.budget), t(r.group), t(r.name), n(r.amount), t(r.label), t(r.source), t(r.tier),
    t(r.start), t(r.end), t(r.cadence), t(r.linkedItem), n(r.delta), t(r.notes)
  ];
}

/* ───────── cell rules ───────── */

function pickEnum<T extends string>(raw: string, allowed: readonly T[]): T | null {
  const low = raw.toLowerCase();
  return allowed.find(a => a.toLowerCase() === low) ?? null;
}

type NumResult = { value: number | null } | { error: string };

function parseMagnitude(s: string): NumResult {
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) return { value: Number(s.replace(/,/g, '')) };
    return { error: 'ambiguous separators: write 1234.50' };
  }
  if (hasComma) {
    if (/^\d+,\d{1,2}$/.test(s)) return { value: Number(s.replace(',', '.')) };
    if (/^\d+,\d{3}$/.test(s)) return { error: 'ambiguous: write 1234 or 1234,00' };
    return { error: 'not a valid number' };
  }
  if (/^\d+(\.\d+)?$/.test(s)) return { value: Number(s) };
  return { error: 'not a valid number' };
}

/** Strips R, spaces and NBSP. Empty becomes null. */
function parseMoney(raw: string, signed: boolean): NumResult {
  if (/^(true|false)$/i.test(raw)) return { error: 'TRUE/FALSE is not a number' };
  let s = raw.replace(/[\s\u00a0\u202f]/g, '').replace(/^R/i, '');
  if (s === '') return { value: null };
  let sign = 1;
  if (/^[-\u2212]/.test(s)) {
    if (!signed) return { error: 'must not be negative' };
    sign = -1;
    s = s.slice(1);
  } else if (s[0] === '+') s = s.slice(1);
  s = s.replace(/^R/i, '');
  const m = parseMagnitude(s);
  if ('error' in m) return m;
  return { value: (m.value as number) * sign };
}

function validDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  if (!m) return false;
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return false;
  if (m[3] === undefined) return true;
  const d = Number(m[3]);
  const last = new Date(Date.UTC(Number(m[1]), mo, 0)).getUTCDate();
  return d >= 1 && d <= last;
}

interface CellParse { row: PlanRow; errors: PlanIssue[]; warnings: PlanIssue[] }

function parseCells(raw: string[], rowNum: number): CellParse {
  const cells = PLAN_HEADERS.map((_, i) => (raw[i] ?? '').trim());
  const errors: PlanIssue[] = [];
  const warnings: PlanIssue[] = [];
  const err = (col: number, message: string) => errors.push({ row: rowNum, column: PLAN_HEADERS[col], message });
  const warn = (col: number, message: string) => warnings.push({ row: rowNum, column: PLAN_HEADERS[col], message });

  cells.forEach((c, i) => {
    if (/\d{13,}/.test(c.replace(/[\s-]/g, ''))) err(i, 'looks like a card or account number (13+ digits); remove it');
  });
  const longDigits = (i: number) => errors.some(e => e.column === PLAN_HEADERS[i]);

  const en = <T extends string>(i: number, allowed: readonly T[]): T => {
    if (cells[i] === '') { err(i, 'required'); return allowed[0]; }
    const v = pickEnum(cells[i], allowed);
    if (v === null) { err(i, `not one of: ${allowed.join(' | ')}`); return allowed[0]; }
    return v;
  };

  const budget = en(0, BUDGETS);
  const group = en(1, GROUPS);
  const name = cells[2];
  if (name === '') err(2, 'required');

  const money = (i: number, signed: boolean): number | null => {
    if (longDigits(i)) return null;
    const r = parseMoney(cells[i], signed);
    if ('error' in r) { err(i, r.error); return null; }
    return r.value;
  };
  const amount = money(3, false);
  const delta = money(11, true);

  const label = en(4, LABELS);
  const tier = en(6, TIERS);
  const cadence = en(9, CADENCES);

  const start = cells[7];
  const end = cells[8];
  if (start !== '' && !validDate(start)) err(7, 'use YYYY-MM or YYYY-MM-DD');
  if (end !== '' && !validDate(end)) err(8, 'use YYYY-MM or YYYY-MM-DD');
  if (start !== '' && end !== '' && validDate(start) && validDate(end)) {
    const n = Math.min(start.length, end.length);
    if (end.slice(0, n) < start.slice(0, n)) err(8, 'End is before Start');
  }

  if (errors.every(e => e.column !== 'Budget' && e.column !== 'Group')) {
    if ((group === 'Personal fixed' || group === 'Personal variable') && budget !== 'Personal') err(1, 'this group requires Budget Personal');
    if (group === 'Agency' && budget !== 'Business') err(1, 'Agency requires Budget Business');
  }

  if (label === 'MISSING' && amount !== null) warn(3, 'Label is MISSING but an amount is set');
  if (amount === null && !errors.some(e => e.column === 'Amount') && label !== 'MISSING' && !(group === 'Changes' && delta !== null)) warn(3, 'no amount, and Label is not MISSING');
  if ((group === 'Income' || group === 'Changes') && tier !== 'none') warn(6, 'Income and Changes never count; use tier none');

  const row: PlanRow = {
    budget, group, name, amount, label, source: cells[5], tier, start, end, cadence,
    linkedItem: cells[10], delta, notes: cells[12]
  };
  return { row, errors, warnings };
}

export class PlanRowError extends Error {
  issues: PlanIssue[];
  constructor(issues: PlanIssue[]) {
    super(issues.map(i => `row ${i.row}, ${i.column}: ${i.message}`).join('; '));
    this.issues = issues;
  }
}

/** A Plan sheet row (already stringified). Throws PlanRowError (no cell values) if any cell breaks a rule. */
export function parseSheetRow(cells: string[], rowIndex: number): PlanRow {
  const { row, errors } = parseCells(cells, rowIndex);
  if (errors.length) throw new PlanRowError(errors);
  return { ...row, rowIndex };
}

/* ───────── CSV ───────── */

/** RFC 4180 records. Returns each record's cells; blank lines come back as [''] */
function splitCsv(text: string, delim: string): string[][] {
  const out: string[][] = [];
  let rec: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"' && cur === '') quoted = true;
    else if (ch === delim) { rec.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      rec.push(cur); out.push(rec); rec = []; cur = '';
    } else cur += ch;
  }
  if (quoted) throw new Error('unterminated quote');
  if (cur !== '' || rec.length) { rec.push(cur); out.push(rec); }
  return out;
}

export function parsePlanCsv(input: string): PlanParse {
  const result: PlanParse = { rows: [], errors: [], warnings: [] };
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? '';
  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const delim = semis > commas ? ';' : ',';

  let records: string[][];
  try {
    records = splitCsv(text, delim);
  } catch {
    result.errors.push({ row: 0, column: 'file', message: 'a quoted cell is never closed' });
    return result;
  }
  if (records.length === 0) {
    result.errors.push({ row: 1, column: 'header', message: 'file is empty' });
    return result;
  }

  // Header: map by name, case-insensitive.
  const header = records[0].map(h => h.trim().toLowerCase());
  const colOf: number[] = []; // canonical index -> file column
  PLAN_HEADERS.forEach((h, ci) => {
    const hits = header.map((x, i) => (x === h.toLowerCase() ? i : -1)).filter(i => i >= 0);
    if (hits.length === 0) result.errors.push({ row: 1, column: h, message: 'missing header' });
    else if (hits.length > 1) result.errors.push({ row: 1, column: h, message: 'duplicate header' });
    else colOf[ci] = hits[0];
  });
  header.forEach((x, i) => {
    if (!PLAN_HEADERS.some(h => h.toLowerCase() === x)) {
      result.errors.push({ row: 1, column: `column ${i + 1}`, message: 'unknown header' });
    }
  });
  if (result.errors.length) return result;

  const parsed: { row: PlanRow; num: number }[] = [];
  records.slice(1).forEach((rec, i) => {
    const num = i + 2;
    if (rec.every(c => c.trim() === '')) return; // blank line, keeps numbering
    if (rec.length > header.length) {
      result.errors.push({ row: num, column: 'row', message: 'more cells than headers' });
      return;
    }
    const cells = PLAN_HEADERS.map((_, ci) => rec[colOf[ci]] ?? '');
    const p = parseCells(cells, num);
    result.errors.push(...p.errors);
    result.warnings.push(...p.warnings);
    parsed.push({ row: p.row, num });
  });

  if (parsed.length > PLAN_MAX_ROWS) {
    result.errors.push({ row: PLAN_MAX_ROWS + 2, column: 'row', message: `more than ${PLAN_MAX_ROWS} rows` });
  }

  const seen = new Map<string, number>();
  for (const { row, num } of parsed) {
    if (row.name === '') continue;
    const k = planKey(row);
    if (seen.has(k)) result.errors.push({ row: num, column: 'Name', message: `duplicate of row ${seen.get(k)} (same Budget, Group and Name)` });
    else seen.set(k, num);
  }

  const namesByBudget = new Set(parsed.map(p => `${p.row.budget}|${collapse(p.row.name).toLowerCase()}`.normalize('NFC')));
  for (const { row, num } of parsed) {
    if (row.linkedItem === '') continue;
    if (!namesByBudget.has(`${row.budget}|${collapse(row.linkedItem).toLowerCase()}`.normalize('NFC'))) {
      result.warnings.push({ row: num, column: 'Linked item', message: 'matches no Name in the same Budget' });
    }
  }

  result.rows = parsed.map(p => p.row);
  return result;
}

/* ───────── import diff (pure) ───────── */

export interface PlanChange { col: number; column: string; from: string | number; to: string | number }
export interface PlanUpdate { row: PlanRow; target: number; key: string; changes: PlanChange[] }
export interface PlanDiff {
  adds: PlanRow[];
  updates: PlanUpdate[];
  unchanged: number;
  /** Sheet rows the file does not mention. Never deleted. */
  kept: PlanRow[];
  /** The sheet as it will read after the write. */
  after: PlanRow[];
}

/** Pairs of sheet rowIndex that share a planKey. Non-empty means stop. */
export function findDuplicateKeys(sheet: PlanRow[]): [number, number][] {
  const seen = new Map<string, number>();
  const dups: [number, number][] = [];
  for (const r of sheet) {
    const k = planKey(r);
    if (seen.has(k)) dups.push([seen.get(k) as number, r.rowIndex as number]);
    else seen.set(k, r.rowIndex as number);
  }
  return dups;
}

/** Classify each file row against the sheet. Assumes neither side has duplicate keys. */
export function diffPlan(file: PlanRow[], sheet: PlanRow[]): PlanDiff {
  const byKey = new Map(sheet.map(r => [planKey(r), r]));
  const fileKeys = new Set<string>();
  const adds: PlanRow[] = [];
  const updates: PlanUpdate[] = [];
  let unchanged = 0;
  for (const row of file) {
    const key = planKey(row);
    fileKeys.add(key);
    const existing = byKey.get(key);
    if (!existing) { adds.push(row); continue; }
    const from = serialisePlanRow(existing);
    const to = serialisePlanRow(row);
    const changes: PlanChange[] = [];
    to.forEach((v, col) => {
      if (v !== from[col]) changes.push({ col, column: PLAN_HEADERS[col], from: from[col], to: v });
    });
    if (changes.length === 0) unchanged++;
    else updates.push({ row, target: existing.rowIndex as number, key, changes });
  }
  const byTarget = new Map(updates.map(u => [u.target, u.row]));
  return {
    adds,
    updates,
    unchanged,
    kept: sheet.filter(r => !fileKeys.has(planKey(r))),
    after: [...sheet.map(r => byTarget.get(r.rowIndex as number) ?? r), ...adds]
  };
}
