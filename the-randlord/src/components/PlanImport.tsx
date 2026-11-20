/**
 * Plan import: paste a CSV, check it against the sheet, write it.
 * Add or update by Budget + Group + Name. Rows missing from the file are kept, never deleted.
 */

import { useState } from 'react';
import { PlanRow } from '../types';
import {
  parsePlanCsv, parseSheetRow, serialisePlanRow, diffPlan, findDuplicateKeys, planKey,
  PlanRowError, PlanIssue, PlanDiff
} from '../lib/plan-csv';
import { computePlanTotals, PlanTotals } from '../lib/plan-math';
import { formatCurrency } from '../lib/ledger-math';
import { Modal, Button, StatLabel, Money, inputStyle } from '../ui/kit';

/** Read the Plan tab. Throws with row and column only (never cell values) if a row is invalid. */
export async function fetchPlan(token: string): Promise<{ demo: boolean; rows: PlanRow[] }> {
  const res = await fetch('/api/sheets/plan', { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(body.error || `Plan request failed (${res.status})`);
  const rows: PlanRow[] = [];
  const issues: PlanIssue[] = [];
  for (const r of (body.rows || []) as { rowIndex: number; cells: string[] }[]) {
    try {
      rows.push(parseSheetRow(r.cells, r.rowIndex));
    } catch (e) {
      if (e instanceof PlanRowError) issues.push(...e.issues);
      else throw e;
    }
  }
  if (issues.length) throw new PlanRowError(issues);
  return { demo: !!body.demo, rows };
}

async function post(token: string, url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data.error || `${url} failed (${res.status})`);
  if (data.demo || data.saved === false) throw new Error('The server reported that nothing was saved (demo mode).');
}

const issueLine = (i: PlanIssue) => `row ${i.row}, ${i.column}: ${i.message}`;
const TOTAL_KEYS: (keyof PlanTotals)[] = ['personal', 'agency', 'allIn', 'withBuilding', 'withSuggestions', 'missing'];
const sameTotals = (a: PlanTotals, b: PlanTotals) => TOTAL_KEYS.every(k => a[k] === b[k]);
const MONEY_COLS = [3, 11];
const show = (v: string | number, col: number) => {
  if (v === '') return '(empty)';
  if (MONEY_COLS.includes(col)) return formatCurrency(Number(v));
  return String(v).replace(/^'/, '');
};

type Phase = 'idle' | 'pasted' | 'parsed' | 'writing' | 'done' | 'failed';

interface Props {
  open: boolean;
  token: string;
  onClose: () => void;
  /** Called after anything was written, so the view reloads. */
  onWritten: () => void;
}

export function PlanImport({ open, token, onClose, onWritten }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [diff, setDiff] = useState<PlanDiff | null>(null);
  const [previewTotals, setPreviewTotals] = useState<PlanTotals | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const clearResult = () => { setProblems([]); setWarnings([]); setDiff(null); setPreviewTotals(null); setFailure(null); };
  const close = () => { setText(''); clearResult(); setPhase('idle'); onClose(); };

  const edit = (v: string) => {
    setText(v);
    clearResult();
    setPhase(v.trim() === '' ? 'idle' : 'pasted');
  };

  const check = async () => {
    clearResult();
    setChecking(true);
    try {
      const parsed = parsePlanCsv(text);
      setWarnings(parsed.warnings.map(issueLine));
      if (parsed.errors.length) {
        setProblems(parsed.errors.map(issueLine));
        setPhase('parsed');
        return;
      }
      if (parsed.rows.length === 0) {
        setProblems(['The file has a header but no rows.']);
        setPhase('parsed');
        return;
      }
      const sheet = await fetchPlan(token);
      if (sheet.demo) throw new Error('Demo mode: nothing can be saved.');
      const dups = findDuplicateKeys(sheet.rows);
      if (dups.length) {
        setProblems(dups.map(([a, b]) => `Plan sheet rows ${a} and ${b} have the same Budget, Group and Name. Fix the sheet, then check again.`));
        setPhase('parsed');
        return;
      }
      const d = diffPlan(parsed.rows, sheet.rows);
      setDiff(d);
      setPreviewTotals(computePlanTotals(d.after));
      setPhase('parsed');
    } catch (e: any) {
      setProblems([e.message || String(e)]);
      setPhase('parsed');
    } finally {
      setChecking(false);
    }
  };

  const write = async () => {
    if (!diff || !previewTotals) return;
    setPhase('writing');
    let wrote = false;
    try {
      // The sheet must still look the way it did at preview.
      const fresh = await fetchPlan(token);
      const atRow = new Map(fresh.rows.map(r => [r.rowIndex, r]));
      const keys = new Set(fresh.rows.map(planKey));
      const moved =
        diff.updates.some(u => { const cur = atRow.get(u.target); return !cur || planKey(cur) !== u.key; }) ||
        diff.adds.some(a => keys.has(planKey(a)));
      if (moved) throw new Error('The sheet changed since the preview. Nothing was written. Check again.');

      if (diff.updates.length) {
        await post(token, '/api/sheets/batchUpdateValues', {
          data: diff.updates.map(u => ({
            range: `Plan!A${u.target}:M${u.target}`,
            values: [serialisePlanRow(u.row)]
          }))
        });
        wrote = true;
      }
      if (diff.adds.length) {
        try {
          await post(token, '/api/sheets/appendBatch', { sheet: 'Plan', rows: diff.adds.map(serialisePlanRow) });
        } catch (e: any) {
          throw new Error(
            `${diff.updates.length ? 'The updates were written, but adding' : 'Adding'} the new rows failed: ${e.message}. ` +
            'Check again: the import only adds what is still missing.'
          );
        }
        wrote = true;
      }

      const after = computePlanTotals((await fetchPlan(token)).rows);
      if (!sameTotals(after, previewTotals)) {
        const fmt = (t: PlanTotals) => `${formatCurrency(t.allIn)} / ${formatCurrency(t.withBuilding)} / ${formatCurrency(t.withSuggestions)} / ${t.missing} missing`;
        throw new Error(`Written, but the totals read back do not match the preview (preview ${fmt(previewTotals)}; sheet ${fmt(after)}). Check the Plan tab before trusting them.`);
      }
      setPhase('done');
      onWritten();
    } catch (e: any) {
      setFailure(e.message || String(e));
      setPhase('failed');
      if (wrote) onWritten();
    }
  };

  const clean = !!diff && problems.length === 0;
  const busy = phase === 'writing' || checking;

  const footer = (
    <div style={{ display: 'flex', gap: 'var(--nd-gap)', justifyContent: 'flex-end' }}>
      <Button variant="secondary" onClick={close} disabled={phase === 'writing'}>{phase === 'done' ? 'Close' : 'Cancel'}</Button>
      {phase !== 'done' && (
        <Button variant={clean ? 'secondary' : 'action'} onClick={check} disabled={text.trim() === '' || busy}>
          {checking ? 'Checking' : 'Check'}
        </Button>
      )}
      {clean && phase === 'parsed' && (
        <Button variant="action" onClick={write} disabled={diff.adds.length + diff.updates.length === 0}>
          Write to sheet
        </Button>
      )}
    </div>
  );

  const list: React.CSSProperties = { margin: 0, paddingLeft: 'var(--nd-s1)', fontSize: 13, lineHeight: 1.6 };
  const scroll: React.CSSProperties = { maxHeight: 180, overflowY: 'auto', border: 'var(--nd-rule)', padding: 'var(--nd-gap)' };

  return (
    <Modal open={open} title="Import plan" onClose={phase === 'writing' ? undefined : close} footer={footer} maxWidth={880}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nd-s1)' }}>
        {phase === 'writing' && <p style={{ fontSize: 14, margin: 0 }}>Writing to the sheet, then reading it back to check the totals.</p>}
        {phase === 'done' && <p style={{ fontSize: 14, margin: 0 }}><strong>Done.</strong> The sheet was written and its totals match the preview.</p>}
        {phase === 'failed' && failure && (
          <div>
            <StatLabel size="xs">Failed</StatLabel>
            <p role="alert" style={{ fontSize: 14, lineHeight: 1.6, margin: '6px 0 0' }}>{failure}</p>
          </div>
        )}
        <div>
          <StatLabel size="xs" muted>Paste the CSV (commas or semicolons, with the header row)</StatLabel>
          <textarea
            className="rl-input"
            value={text}
            onChange={e => edit(e.target.value)}
            disabled={phase === 'writing' || phase === 'done'}
            spellCheck={false}
            style={{ ...inputStyle, height: 160, padding: 'var(--nd-gap)', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
          />
          <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: '6px 0 0' }}>
            Rows match on Budget, Group and Name. Existing rows are updated, new ones are added, and rows missing from the file are kept.
          </p>
        </div>

        {problems.length > 0 && (
          <div>
            <StatLabel size="xs">Fix these first. Nothing can be written.</StatLabel>
            <ul style={{ ...list, ...scroll, marginTop: 6 }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <StatLabel size="xs" muted>{warnings.length} warning(s), not blocking</StatLabel>
            <ul style={{ ...list, ...scroll, marginTop: 6 }}>{warnings.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        )}

        {clean && diff && previewTotals && (phase === 'parsed' || phase === 'writing' || phase === 'done' || phase === 'failed') && (
          <>
            <p style={{ fontSize: 14, margin: 0 }}>
              <strong>{diff.adds.length}</strong> to add · <strong>{diff.updates.length}</strong> to update ·{' '}
              <strong>{diff.unchanged}</strong> unchanged · <strong>{diff.kept.length}</strong> kept, not in this file
            </p>
            {diff.updates.length > 0 && (
              <div>
                <StatLabel size="xs" muted>Changes</StatLabel>
                <ul style={{ ...list, ...scroll, marginTop: 6 }}>
                  {diff.updates.map(u => (
                    <li key={u.key}>
                      {u.row.group} / {u.row.name}:{' '}
                      {u.changes.map(c => `${c.column} ${show(c.from, c.col)} → ${show(c.to, c.col)}`).join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diff.adds.length > 0 && (
              <div>
                <StatLabel size="xs" muted>New rows</StatLabel>
                <ul style={{ ...list, ...scroll, marginTop: 6 }}>
                  {diff.adds.map(a => <li key={planKey(a)}>{a.group} / {a.name}</li>)}
                </ul>
              </div>
            )}
            {diff.kept.length > 0 && (
              <div>
                <StatLabel size="xs" muted>Kept, not in this file</StatLabel>
                <ul style={{ ...list, ...scroll, marginTop: 6 }}>
                  {diff.kept.map(k => <li key={k.rowIndex}>{k.group} / {k.name}</li>)}
                </ul>
              </div>
            )}
            <div>
              <StatLabel size="xs" muted>Totals after the write</StatLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--nd-gap)', marginTop: 6 }}>
                {([['Personal', previewTotals.personal], ['Agency', previewTotals.agency], ['All in', previewTotals.allIn],
                  ['With building', previewTotals.withBuilding], ['With suggestions', previewTotals.withSuggestions]] as const).map(([l, v]) => (
                  <div key={l}>
                    <StatLabel size="xs" muted>{l}</StatLabel>
                    <Money size={16} align="left" style={{ display: 'block', marginTop: 4 }}>{formatCurrency(v)}</Money>
                  </div>
                ))}
                <div>
                  <StatLabel size="xs" muted>Missing amounts</StatLabel>
                  <Money size={16} align="left" style={{ display: 'block', marginTop: 4 }}>{previewTotals.missing}</Money>
                </div>
              </div>
            </div>
            {diff.adds.length + diff.updates.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: 0 }}>The sheet already matches this file. Nothing to write.</p>
            )}
          </>
        )}

      </div>
    </Modal>
  );
}
