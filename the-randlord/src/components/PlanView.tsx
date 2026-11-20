/**
 * Plan: monthly costs, income and dated changes from the Plan tab.
 * Fetches for itself, so a Plan failure cannot break any other view.
 */

import { useCallback, useEffect, useState } from 'react';
import { PlanRow, PlanGroup, PlanLabel } from '../types';
import { PlanRowError } from '../lib/plan-csv';
import { computePlanTotals } from '../lib/plan-math';
import { formatCurrency } from '../lib/ledger-math';
import {
  Panel, StatTile, StatTileRow, Badge, Button, EmptyState, ErrorNote, Loading,
  Money, Row, Th, TableCard, ViewHeader, StatLabel
} from '../ui/kit';
import type { LifecycleTone } from '../ui/kit';
import { PlanImport, fetchPlan } from './PlanImport';

const GROUPS: PlanGroup[] = ['Personal fixed', 'Personal variable', 'Agency', 'Income', 'Changes'];
const COLS = 'minmax(0, 1fr) 140px 190px 100px 170px 90px';

/* Status family only: a label says how far to trust a figure. */
const LABEL_TONE: Record<PlanLabel, LifecycleTone> = {
  FACT: 'forest',
  ESTIMATE: 'cyan',
  MISSING: 'ochre',
  'BUDGET SUGGESTION': 'lavender',
  UNVERIFIED: 'slate'
};

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string; detail?: string }
  | { status: 'ready'; rows: PlanRow[] };

export function PlanView({ token, demo }: { token: string; demo: boolean }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { rows } = await fetchPlan(token);
      setState({ status: 'ready', rows });
    } catch (e: any) {
      if (e instanceof PlanRowError) {
        setState({
          status: 'error',
          message: 'Some rows in the Plan tab are not valid, so no totals are shown. Fix these cells, then reload.',
          detail: e.issues.slice(0, 20).map(i => `row ${i.row}, ${i.column}: ${i.message}`).join('; ')
        });
      } else {
        setState({ status: 'error', message: e.message || String(e) });
      }
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const rows = state.status === 'ready' ? state.rows : [];
  const totals = computePlanTotals(rows);

  const amountCell = (r: PlanRow) => {
    if (r.amount !== null) return <Money>{formatCurrency(r.amount)}</Money>;
    if (r.group === 'Changes' && r.delta !== null) {
      return <Money>{(r.delta > 0 ? '+' : '') + formatCurrency(r.delta)}</Money>;
    }
    if (r.group === 'Income' || r.group === 'Changes') return <Money>—</Money>;
    return <span style={{ justifySelf: 'end' }}><Badge tone="ochre">MISSING</Badge></span>;
  };

  return (
    <div>
      <ViewHeader title="Plan">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)' }}>
          {demo && <StatLabel size="xs" muted>Demo mode: nothing can be saved</StatLabel>}
          <Button variant="secondary" disabled={demo} onClick={() => setImporting(true)}>Import plan</Button>
        </div>
      </ViewHeader>
      <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: 0 }}>
        Covers both budgets. The Personal / Business selector does not change this view.
      </p>

      {state.status === 'loading' && <Loading text="Fetching your plan" />}
      {state.status === 'error' && (
        <div style={{ marginTop: 'var(--nd-s1)' }}>
          <ErrorNote
            title="We cannot read the Plan"
            body={state.message}
            detail={state.detail}
            action={<Button variant="secondary" size="sm" onClick={load}>Try again</Button>}
          />
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <Panel
            raised
            title="Monthly totals"
            action={totals.missing > 0 ? <Badge tone="ochre">{totals.missing} missing</Badge> : undefined}
            style={{ marginTop: 'var(--nd-s1)' }}
          >
            <StatTileRow>
              <StatTile label="Personal" value={formatCurrency(totals.personal)} />
              <StatTile label="Agency" value={formatCurrency(totals.agency)} />
              <StatTile label="All in" value={formatCurrency(totals.allIn)} />
              <StatTile label="With building" value={formatCurrency(totals.withBuilding)} />
              <StatTile label="With suggestions" value={formatCurrency(totals.withSuggestions)} />
            </StatTileRow>
          </Panel>

          {rows.length === 0 ? (
            <div style={{ marginTop: 'var(--nd-s2)' }}>
              <EmptyState message="The Plan tab has no rows yet. Import a CSV, or type rows straight into the Plan tab of your sheet." />
            </div>
          ) : (
            <TableCard style={{ marginTop: 'var(--nd-s2)' }}>
              <Row cols={COLS} header>
                <Th>Name</Th><Th align="right">Amount</Th><Th>Label</Th><Th>Tier</Th><Th>Start – End</Th><Th>Cadence</Th>
              </Row>
              {GROUPS.filter(g => rows.some(r => r.group === g)).map(g => (
                <div key={g}>
                  <Row cols="minmax(0, 1fr)" style={{ background: 'var(--app-surface-alt)' }}>
                    <Th>{g} · {rows.filter(r => r.group === g).length}</Th>
                  </Row>
                  {rows.filter(r => r.group === g).map(r => (
                    <Row key={r.rowIndex} cols={COLS}>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{r.name}</span>
                      {amountCell(r)}
                      <span><Badge tone={LABEL_TONE[r.label]}>{r.label}</Badge></span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.tier}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {r.start || r.end ? `${r.start || '…'} – ${r.end || '…'}` : '—'}
                      </span>
                      <span style={{ fontSize: 13 }}>{r.cadence}</span>
                    </Row>
                  ))}
                </div>
              ))}
            </TableCard>
          )}
        </>
      )}

      <PlanImport open={importing} token={token} onClose={() => setImporting(false)} onWritten={load} />
    </div>
  );
}
