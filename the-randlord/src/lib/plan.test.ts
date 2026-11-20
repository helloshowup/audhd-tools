import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlanRow } from '../types';
import { computePlanTotals } from './plan-math';
import { parsePlanCsv, parseSheetRow, planKey, serialisePlanRow, diffPlan, findDuplicateKeys, PLAN_HEADERS } from './plan-csv';

/* Invented numbers only. */

const row = (o: Partial<PlanRow>): PlanRow => ({
  budget: 'Personal', group: 'Personal fixed', name: 'Item', amount: 0, label: 'FACT', source: '',
  tier: 'base', start: '', end: '', cadence: 'monthly', linkedItem: '', delta: null, notes: '', ...o
});
const HEAD = PLAN_HEADERS.join(',');
const line = (o: Partial<Record<(typeof PLAN_HEADERS)[number], string>>) =>
  PLAN_HEADERS.map(h => o[h] ?? '').join(',');
const OK = { Budget: 'Personal', Group: 'Personal fixed', Name: 'Thing', Amount: '10', Label: 'FACT', 'Totals tier': 'base', Cadence: 'monthly' };

const base = [
  row({ name: 'A', amount: 1000 }),
  row({ name: 'B', group: 'Personal variable', amount: 250.5 })
];

test('1 personal fixed + variable', () => {
  assert.equal(computePlanTotals(base).personal, 1250.5);
});
test('2 agency base', () => {
  const t = computePlanTotals([...base, row({ budget: 'Business', group: 'Agency', name: 'C', amount: 400 })]);
  assert.equal(t.agency, 400);
  assert.equal(t.personal, 1250.5);
  assert.equal(t.allIn, 1650.5);
});
test('3 income never counts', () => {
  const t = computePlanTotals([...base, row({ group: 'Income', name: 'I', amount: 9999 })]);
  assert.deepEqual(t, computePlanTotals(base));
});
test('4 changes never count', () => {
  const t = computePlanTotals([...base, row({ group: 'Changes', name: 'X', amount: 300, delta: 50 })]);
  assert.deepEqual(t, computePlanTotals(base));
});
test('5 building only moves withBuilding', () => {
  const b = computePlanTotals(base);
  const t = computePlanTotals([...base, row({ name: 'D', tier: 'building', amount: 70 })]);
  assert.equal(t.allIn, b.allIn);
  assert.equal(t.withBuilding, b.withBuilding + 70);
});
test('6 suggestion adds on top of building', () => {
  const t = computePlanTotals([...base, row({ name: 'D', tier: 'building', amount: 70 }), row({ name: 'E', tier: 'suggestion', amount: 30 })]);
  assert.equal(t.withSuggestions, t.withBuilding + 30);
});
test('7 tier none has no effect', () => {
  assert.deepEqual(computePlanTotals([...base, row({ name: 'N', tier: 'none', amount: 500 })]), computePlanTotals(base));
});
test('8 null base amount is skipped and counted missing', () => {
  const t = computePlanTotals([...base, row({ name: 'M', amount: null, label: 'MISSING' })]);
  assert.equal(t.missing, 1);
  assert.equal(t.personal, 1250.5);
});
test('9 dates never filter', () => {
  const t = computePlanTotals([
    row({ name: 'F', amount: 10, cadence: 'one-off', start: '2099-01' }),
    row({ name: 'G', amount: 5, end: '2000-01' })
  ]);
  assert.equal(t.personal, 15);
});
test('10 cents are exact', () => {
  const t = computePlanTotals([row({ name: 'P', amount: 0.1 }), row({ name: 'Q', amount: 0.2 })]);
  assert.equal(t.personal, 0.3);
});
test('11 empty input is all zero', () => {
  assert.deepEqual(computePlanTotals([]), { personal: 0, agency: 0, allIn: 0, withBuilding: 0, withSuggestions: 0, missing: 0 });
});
test('12 order does not matter', () => {
  const rows = [
    ...base, row({ budget: 'Business', group: 'Agency', name: 'C', amount: 400.1 }),
    row({ name: 'D', tier: 'building', amount: 70.7 }), row({ name: 'E', tier: 'suggestion', amount: 30.3 }),
    row({ name: 'M', amount: null })
  ];
  const expected = computePlanTotals(rows);
  const shuffled = [rows[4], rows[2], rows[0], rows[5], rows[3], rows[1]];
  assert.equal(shuffled.length, rows.length);
  assert.deepEqual(computePlanTotals(shuffled), expected);
});

/* ───────── parsing ───────── */

const parseAmount = (cell: string) => parsePlanCsv(`${HEAD}\n${line({ ...OK, Amount: `"${cell}"` })}\n`);

test('amount: "1 234,50" -> 1234.5', () => {
  const p = parseAmount('1 234,50');
  assert.equal(p.errors.length, 0);
  assert.equal(p.rows[0].amount, 1234.5);
});
test('amount: "R1,234.50" -> 1234.5', () => {
  const p = parseAmount('R1,234.50');
  assert.equal(p.errors.length, 0);
  assert.equal(p.rows[0].amount, 1234.5);
});
test('amount: "1,234" is ambiguous', () => {
  const p = parseAmount('1,234');
  assert.equal(p.errors.length, 1);
  assert.equal(p.errors[0].column, 'Amount');
  assert.ok(!JSON.stringify(p.errors).includes('1,234'));
});
test('amount: negative and TRUE are errors', () => {
  assert.equal(parseAmount('-5').errors.length, 1);
  assert.equal(parseAmount('TRUE').errors.length, 1);
});
test('amount: empty is null', () => {
  assert.equal(parseAmount('').rows[0].amount, null);
});
test('card-like digits in Notes are an error that never echoes the value', () => {
  const p = parsePlanCsv(`${HEAD}\n${line({ ...OK, Notes: '"4111 1111 1111 1111"' })}\n`);
  assert.equal(p.errors.length, 1);
  assert.equal(p.errors[0].column, 'Notes');
  assert.ok(!JSON.stringify(p.errors).includes('4111'));
});
test('13 plain digits is an error', () => {
  assert.equal(parseAmount('1234567890123').errors.length, 1);
});
test('keys ignore case and extra spaces', () => {
  assert.equal(
    planKey(row({ name: 'Cell  Phone' })),
    planKey(row({ name: ' cell phone ', budget: 'Personal', group: 'Personal fixed' }))
  );
  const dup = parsePlanCsv(`${HEAD}\n${line({ ...OK, Name: 'Cell phone' })}\n${line({ ...OK, Name: 'CELL   PHONE' })}\n`);
  assert.equal(dup.errors.length, 1);
});
test('semicolon, quoted comma and BOM parse', () => {
  const text = '﻿' + [PLAN_HEADERS.join(';'), PLAN_HEADERS.map(h => ({ ...OK, Name: '"Water, rates"' } as Record<string, string>)[h] ?? '').join(';')].join('\r\n') + '\r\n';
  const p = parsePlanCsv(text);
  assert.equal(p.errors.length, 0);
  assert.equal(p.rows[0].name, 'Water, rates');
});
test('headers match in any case, order is free, unknown and missing are errors', () => {
  const rev = [...PLAN_HEADERS].reverse();
  const p = parsePlanCsv(`${rev.map(h => h.toUpperCase()).join(',')}\n${rev.map(h => (OK as Record<string, string>)[h] ?? '').join(',')}\n`);
  assert.equal(p.errors.length, 0);
  assert.equal(p.rows[0].name, 'Thing');
  assert.ok(parsePlanCsv(`${HEAD},Extra\n`).errors.some(e => e.message === 'unknown header'));
  assert.ok(parsePlanCsv(`${HEAD.replace('Notes', 'Memo')}\n`).errors.length >= 2);
});
test('Agency with Budget Personal is an error', () => {
  const p = parsePlanCsv(`${HEAD}\n${line({ ...OK, Group: 'Agency' })}\n`);
  assert.equal(p.errors.length, 1);
  assert.equal(p.errors[0].column, 'Group');
});
test('Income allows either budget; canonical case out', () => {
  const p = parsePlanCsv(`${HEAD}\n${line({ ...OK, Budget: 'business', Group: 'income', Label: 'estimate', 'Totals tier': 'NONE' })}\n`);
  assert.equal(p.errors.length, 0);
  assert.equal(p.rows[0].budget, 'Business');
  assert.equal(p.rows[0].group, 'Income');
  assert.equal(p.rows[0].label, 'ESTIMATE');
  assert.equal(p.rows[0].tier, 'none');
});
test('dates: bad format and End before Start are errors', () => {
  assert.equal(parsePlanCsv(`${HEAD}\n${line({ ...OK, Start: '2026-13' })}\n`).errors.length, 1);
  assert.equal(parsePlanCsv(`${HEAD}\n${line({ ...OK, Start: '2026-05', End: '2026-04-30' })}\n`).errors.length, 1);
  assert.equal(parsePlanCsv(`${HEAD}\n${line({ ...OK, Start: '2026-05-01', End: '2026-05' })}\n`).errors.length, 0);
});
test('warnings: MISSING with amount, empty amount, income tier, dangling link', () => {
  const csv = [
    HEAD,
    line({ ...OK, Name: 'W1', Label: 'MISSING' }),
    line({ ...OK, Name: 'W2', Amount: '' }),
    line({ ...OK, Name: 'W3', Group: 'Income', 'Totals tier': 'base' }),
    line({ ...OK, Name: 'W4', 'Linked item': 'Nothing here' })
  ].join('\n');
  const p = parsePlanCsv(csv);
  assert.equal(p.errors.length, 0);
  assert.equal(p.warnings.length, 4);
});
test('more than 500 rows is an error', () => {
  const rows = Array.from({ length: 501 }, (_, i) => line({ ...OK, Name: `Row ${i}` }));
  assert.ok(parsePlanCsv([HEAD, ...rows].join('\n')).errors.some(e => e.message.includes('500')));
});
test('sheet row round-trips through serialise', () => {
  const cells = ['personal', 'personal fixed', 'Thing', '1250.5', 'fact', 'src', 'base', '2026-01', '', 'monthly', '', '', ''];
  const r = parseSheetRow(cells, 7);
  assert.equal(r.rowIndex, 7);
  const s = serialisePlanRow(r);
  assert.equal(s.length, 13);
  assert.equal(s[0], "'Personal");
  assert.equal(s[3], 1250.5);
  assert.equal(s[10], '');
  assert.equal(s[11], '');
  assert.throws(() => parseSheetRow(['x', ...cells.slice(1)], 7));
});

test('diff: add, update, unchanged, kept; nothing is deleted', () => {
  const sheet = [
    row({ name: 'Same', amount: 10, rowIndex: 2 }),
    row({ name: 'Moves', amount: 20, rowIndex: 3 }),
    row({ name: 'Stays', amount: 30, rowIndex: 4 })
  ];
  const file = [row({ name: 'Same', amount: 10 }), row({ name: 'Moves', amount: 25 }), row({ name: 'New', amount: 5 })];
  const d = diffPlan(file, sheet);
  assert.equal(d.unchanged, 1);
  assert.equal(d.adds.length, 1);
  assert.equal(d.updates.length, 1);
  assert.equal(d.updates[0].target, 3);
  assert.deepEqual(d.updates[0].changes.map(c => c.column), ['Amount']);
  assert.deepEqual(d.kept.map(r => r.name), ['Stays']);
  assert.equal(d.after.length, 4);
  assert.equal(computePlanTotals(d.after).personal, 25 + 30 + 10 + 5);
  assert.deepEqual(findDuplicateKeys([...sheet, row({ name: 'STAYS', rowIndex: 9 })]), [[4, 9]]);
});
