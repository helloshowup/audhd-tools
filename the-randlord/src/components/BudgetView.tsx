/**
 * The Randlord — Budget (the envelope grid)
 * DROP-IN REPLACEMENT for src/components/BudgetView.tsx
 *
 * BACKEND: every fetch below is unchanged from the original file —
 * same endpoints, same sheet names, same column order. Only the
 * render tree and the interaction pattern changed:
 *   - categories are a real grid, grouped and collapsible
 *   - clicking a row opens a right-hand drawer, not a centred modal
 *   - the assign field previews the result before you commit
 */

import { useMemo, useState } from 'react';
import { Ledger } from '../types';
import { computeBudgetState, CategoryMonth, formatCurrency } from '../lib/ledger-math';
import {
  Panel,
  StatLabel,
  Heading,
  Callout,
  Modal,
  Button,
  ProgressBar,
  EmptyState,
  Dot,
  Icon,
  IconBtn,
  Money,
  Pill,
  Row,
  Th,
  TableCard,
  ErrorNote,
  inputStyle,
  moneyInputStyle
} from '../ui/kit';

interface BudgetViewProps {
  ledger: Ledger;
  budgetName: string;
  token: string;
  onAssigned: () => void;
  onInspectUncategorised?: () => void;
}

const COLS = 'minmax(0, 1fr) 104px 132px 132px 148px 44px';

const STARTER_SET = [
  { name: 'Groceries', group: 'Daily', target: 0 },
  { name: 'Transport and fuel', group: 'Daily', target: 0 },
  { name: 'Eating out', group: 'Daily', target: 0 },
  { name: 'Airtime and data', group: 'Daily', target: 0 },
  { name: 'Medical', group: 'Monthly', target: 0 },
  { name: 'Vet', group: 'Monthly', target: 0 },
  { name: 'Insurance', group: 'Monthly', target: 0 },
  { name: 'Rent', group: 'Monthly', target: 0 },
  { name: 'Utilities', group: 'Monthly', target: 0 },
  { name: 'Subscriptions', group: 'Monthly', target: 0 },
  { name: 'Car service', group: 'Goals', target: 3000 },
  { name: 'December', group: 'Goals', target: 5000 },
  { name: 'Emergencies', group: 'Goals', target: 0 }
];

export function BudgetView({ ledger, budgetName, token, onAssigned, onInspectUncategorised }: BudgetViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().substring(0, 7));
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroup, setNewCatGroup] = useState('');
  const [newCatTarget, setNewCatTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [selectedCat, setSelectedCat] = useState<CategoryMonth | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [assignAmount, setAssignAmount] = useState('');
  const [moveAmount, setMoveAmount] = useState('');
  const [moveDest, setMoveDest] = useState('');
  const [armArchive, setArmArchive] = useState(false);

  const state = useMemo(
    () => computeBudgetState(ledger, currentMonth, budgetName),
    [ledger, currentMonth, budgetName]
  );

  const activeCategories = ledger.categories.filter(c => c.budget === budgetName && c.name && !c.archived);

  const categoriesByGroup = useMemo(() => {
    const groups: Record<string, CategoryMonth[]> = {};
    const catDefs = new Map(ledger.categories.map(c => [c.name, c]));
    for (const catMonth of state.categories) {
      if (catMonth.categoryId === 'Uncategorised') continue;
      const catDef = catDefs.get(catMonth.categoryId);
      if (catDef?.archived && catMonth.available === 0 && catMonth.activity === 0 && catMonth.assigned === 0) continue;
      const groupName = catDef?.group || 'Uncategorised';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(catMonth);
    }
    return groups;
  }, [state.categories, ledger.categories]);

  const uncategorisedCat = state.categories.find(c => c.categoryId === 'Uncategorised');

  const prevMonth = () => {
    const [y, m] = currentMonth.split('-');
    setCurrentMonth(new Date(Number(y), Number(m) - 2).toISOString().substring(0, 7));
  };
  const nextMonth = () => {
    const [y, m] = currentMonth.split('-');
    setCurrentMonth(new Date(Number(y), Number(m)).toISOString().substring(0, 7));
  };

  /* ───────── backend mutations with loud error handling ───────── */

  const postSheet = async (url: string, body: any) => {
    setError(null);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.saved === false) {
      throw new Error(data.error || 'Changes could not be saved to your sheet. In demo mode, changes are not saved.');
    }
    return data;
  };

  const loadStarterSet = async () => {
    try {
      const values = STARTER_SET.map(c => [budgetName, c.name, c.group, c.target, false]);
      await postSheet('/api/sheets/appendBatch', { sheet: 'Categories', rows: values });
      onAssigned();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not save starter categories.');
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await postSheet('/api/sheets/append', {
        sheet: 'Categories',
        values: [budgetName, newCatName.trim(), newCatGroup.trim(), Number(newCatTarget) || 0, false]
      });
      setIsAdding(false); setNewCatName(''); setNewCatGroup(''); setNewCatTarget('');
      onAssigned();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not add that category.');
    }
  };

  const handleAssign = async () => {
    if (!selectedCat || !assignAmount) return;
    try {
      await postSheet('/api/sheets/append', {
        sheet: 'Assignments',
        values: [currentMonth, selectedCat.categoryId, Number(assignAmount), budgetName]
      });
      setAssignAmount('');
      onAssigned();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not assign that amount.');
    }
  };

  const handleMove = async () => {
    if (!selectedCat || !moveAmount || !moveDest) return;
    try {
      const amt = Number(moveAmount);
      await postSheet('/api/sheets/appendBatch', {
        sheet: 'Assignments',
        rows: [
          [currentMonth, selectedCat.categoryId, -amt, budgetName],
          [currentMonth, moveDest, amt, budgetName]
        ]
      });
      setMoveAmount(''); setMoveDest('');
      onAssigned();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not move that money.');
    }
  };

  const handleRename = async () => {
    if (!selectedCat || !renameValue || renameValue === selectedCat.categoryId) return;
    try {
      const oldName = selectedCat.categoryId;
      const catRow = ledger.categories.find(c => c.name === oldName && c.budget === budgetName);
      if (!catRow || !catRow.rowIndex) return;

      const updates: { range: string; values: string[][] }[] = [];
      updates.push({ range: `Categories!B${catRow.rowIndex}`, values: [[renameValue]] });
      ledger.transactions.forEach(t => {
        if (t.category === oldName && t.budget === budgetName && t.rowIndex) {
          updates.push({ range: `Transactions!E${t.rowIndex}`, values: [[renameValue]] });
        }
      });
      ledger.assignments.forEach(a => {
        if (a.category === oldName && a.budget === budgetName && a.rowIndex) {
          updates.push({ range: `Assignments!B${a.rowIndex}`, values: [[renameValue]] });
        }
      });

      await postSheet('/api/sheets/batchUpdateValues', { data: updates });
      setIsRenaming(false); setSelectedCat(null);
      onAssigned();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not rename that category.');
    }
  };

  const handleArchive = async () => {
    if (!selectedCat) return;
    if (selectedCat.available !== 0) {
      setError(`Move ${formatCurrency(selectedCat.available)} somewhere first, then archive.`);
      return;
    }
    if (!armArchive) {
      setArmArchive(true);
      return;
    }
    const catRow = ledger.categories.find(c => c.name === selectedCat.categoryId && c.budget === budgetName);
    if (!catRow || !catRow.rowIndex) return;
    try {
      await postSheet('/api/sheets/updateRow', {
        sheet: 'Categories', rowIndex: catRow.rowIndex,
        values: [budgetName, catRow.name, catRow.group, catRow.target, true]
      });
      setArmArchive(false);
      setSelectedCat(null);
      onAssigned();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'We could not archive that category.');
    }
  };

  /* ───────── render ───────── */

  const monthLabel = new Date(currentMonth + '-01')
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const totalAssigned = state.categories.reduce((s, c) => s + c.assigned, 0);
  const totalActivity = state.categories.reduce((s, c) => s + c.activity, 0);

  const catDef = (name: string) => ledger.categories.find(c => c.name === name && c.budget === budgetName);
  const selectedDef = selectedCat ? catDef(selectedCat.categoryId) : undefined;
  const pending = parseFloat(assignAmount.replace(/\s/g, '').replace(',', '.')) || 0;

  return (
    <div>
      {/* ── Month band ── */}
      <div style={{
        position: 'sticky', top: 'var(--topbar-h)', zIndex: 20, background: 'var(--app-page)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--nd-gap)', padding: '0 0 var(--nd-s1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)' }}>
          <IconBtn label="Previous month" onClick={prevMonth}>{Icon.left()}</IconBtn>
          <Heading level={2} style={{ fontSize: 20, margin: 0, minWidth: 220, textAlign: 'center' }}>{monthLabel}</Heading>
          <IconBtn label="Next month" onClick={nextMonth}>{Icon.right()}</IconBtn>
        </div>
        <Button variant="secondary" onClick={() => setIsAdding(true)}>New category</Button>
      </div>

      {/* ── To be assigned (Raised Panel) ── */}
      <Panel raised title="To Be Assigned" style={{ marginTop: 'var(--nd-gap)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) 2px minmax(0,1fr) minmax(0,1fr) auto',
          alignItems: 'center', gap: 'var(--nd-s2)'
        }}>
          <div>
            <StatLabel size="xs" muted>To be assigned</StatLabel>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: state.toBeAssigned < 0 ? 'var(--app-error)' : 'var(--app-ink)',
              margin: '8px 0 0'
            }}>
              {formatCurrency(state.toBeAssigned)}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--app-ink-muted)', margin: '8px 0 0' }}>
              {state.toBeAssigned < 0
                ? 'More is assigned than you have. Take some back from a category.'
                : 'Waiting for a job. Give it one when you are ready.'}
            </p>
          </div>
          <span style={{ height: 64, width: 2, background: 'var(--app-line)' }} />
          <div>
            <StatLabel size="xs" muted>Assigned this month</StatLabel>
            <Money size={20} align="left" style={{ display: 'block', marginTop: 8 }}>{formatCurrency(totalAssigned)}</Money>
          </div>
          <div>
            <StatLabel size="xs" muted>Activity</StatLabel>
            <Money size={20} align="left" style={{ display: 'block', marginTop: 8 }}>{formatCurrency(totalActivity)}</Money>
          </div>
          <div style={{ textAlign: 'right' }}>
            <StatLabel size="xs" muted>Age of money</StatLabel>
            <Money size={20} style={{ display: 'block', marginTop: 8 }}>{state.ageOfMoney} days</Money>
          </div>
        </div>
      </Panel>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{ marginTop: 'var(--nd-s1)' }}>
          <ErrorNote title="Action not saved" body={error} />
        </div>
      )}

      {/* ── Needs a category ── */}
      {uncategorisedCat && uncategorisedCat.available !== 0 && (
        <div style={{ marginTop: 'var(--nd-s1)' }}>
          <Callout tone="error" title="Uncategorised money">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)' }}>
              <span>{formatCurrency(Math.abs(uncategorisedCat.available))} has no category yet.</span>
              <Button variant="danger" size="sm" onClick={onInspectUncategorised}>Give it a home</Button>
            </div>
          </Callout>
        </div>
      )}

      {/* ── Empty ── */}
      {activeCategories.length === 0 && (
        <div style={{ marginTop: 'var(--nd-s2)' }}>
          <EmptyState
            message="A fresh budget — categories land here once you create them."
            action={<Button variant="action" onClick={loadStarterSet}>Start with a set</Button>}
          />
        </div>
      )}

      {/* ── The grid ── */}
      {activeCategories.length > 0 && (
        <TableCard style={{ marginTop: 'var(--nd-s2)' }}>
          <Row cols={COLS} header style={{ position: 'sticky', top: 144, zIndex: 15 }}>
            <Th>Category</Th>
            <Th align="right">Target</Th>
            <Th align="right">Assigned</Th>
            <Th align="right">Activity</Th>
            <Th align="right">Available</Th>
            <Th />
          </Row>

          {Object.entries(categoriesByGroup).map(([groupName, cats]) => {
            const open = !closed[groupName];
            const sum = (k: 'assigned' | 'activity' | 'available') => cats.reduce((s, c) => s + c[k], 0);
            return (
              <div key={groupName}>
                <Row
                  cols={COLS}
                  onClick={() => setClosed(p => ({ ...p, [groupName]: !p[groupName] }))}
                  style={{ background: 'var(--app-surface-alt)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)' }}>
                    <span style={{
                      display: 'inline-flex', color: 'var(--app-ink-muted)',
                      transition: 'transform var(--dur-fast) var(--ease-out)',
                      transform: open ? 'rotate(90deg)' : 'rotate(0deg)'
                    }}>{Icon.chevron()}</span>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--app-ink)'
                    }}>{groupName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--app-ink-faint)' }}>
                      ({cats.length})
                    </span>
                  </div>
                  <span />
                  <Money size={13} tone="var(--app-ink-muted)">{formatCurrency(sum('assigned'))}</Money>
                  <Money size={13} tone="var(--app-ink-muted)">{formatCurrency(sum('activity'))}</Money>
                  <Money size={13}>{formatCurrency(sum('available'))}</Money>
                  <span />
                </Row>

                {open && cats.map(cat => {
                  const def = catDef(cat.categoryId);
                  const target = def ? Number(def.target) : 0;
                  const isGoal = groupName === 'Goals';
                  const pct = target > 0
                    ? Math.min(100, Math.max(0, ((isGoal ? cat.available : cat.assigned) / target) * 100))
                    : 0;
                  return (
                    <Row key={cat.categoryId} cols={COLS} onClick={() => { setSelectedCat(cat); setAssignAmount(''); setArmArchive(false); }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, color: 'var(--app-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cat.categoryId}
                          </span>
                          {def?.archived && (
                            <StatLabel size="xs" muted>set aside</StatLabel>
                          )}
                        </div>
                        {target > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <ProgressBar value={pct} max={100} tone={pct >= 100 ? 'done' : 'progress'} />
                          </div>
                        )}
                      </div>
                      <Money size={13} tone="var(--app-ink-faint)">{target > 0 ? formatCurrency(target) : '—'}</Money>
                      <Money>{formatCurrency(cat.assigned)}</Money>
                      <Money tone="var(--app-ink-muted)">{cat.activity === 0 ? '—' : formatCurrency(cat.activity)}</Money>
                      <Pill value={cat.available} text={formatCurrency(cat.available)} />
                      <button
                        type="button" aria-label={`Assign money to ${cat.categoryId}`}
                        className="rl-icon-btn"
                        onClick={e => { e.stopPropagation(); setSelectedCat(cat); setAssignAmount(''); setArmArchive(false); }}
                        style={{
                          width: 28, height: 28, justifySelf: 'center', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center', background: 'var(--nd-surface)',
                          border: '1.5px solid var(--nd-ink)', borderRadius: 0,
                          color: 'var(--app-ink)', cursor: 'pointer'
                        }}
                      >{Icon.plus(12)}</button>
                    </Row>
                  );
                })}
              </div>
            );
          })}
        </TableCard>
      )}

      <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: 'var(--nd-s1) 0 0' }}>
        Click any category to assign, move money, or set it aside.
      </p>

      {/* ── Category drawer ── */}
      {selectedCat && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelectedCat(null)} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
          <div className="rl-slide" style={{
            position: 'relative', width: 'var(--drawer-w)', maxWidth: '100%', height: '100%',
            background: 'var(--app-surface)', borderLeft: 'var(--nd-rule)',
            boxShadow: 'var(--nd-shadow)', padding: 'var(--nd-s2)', boxSizing: 'border-box', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--nd-gap)' }}>
              <div style={{ minWidth: 0 }}>
                <StatLabel size="xs" muted>{selectedDef?.group || 'Uncategorised'}</StatLabel>
                {!isRenaming ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--nd-gap)', marginTop: 8 }}>
                    <Heading level={2} style={{ fontSize: 20, margin: 0 }}>{selectedCat.categoryId}</Heading>
                    <button
                      type="button"
                      onClick={() => { setIsRenaming(true); setRenameValue(selectedCat.categoryId); }}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase', color: 'var(--app-ink-muted)', textDecoration: 'underline'
                      }}
                    >Rename</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input className="rl-input" style={{ ...inputStyle, height: 38 }} value={renameValue} onChange={e => setRenameValue(e.target.value)} />
                    <Button size="sm" onClick={handleRename}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsRenaming(false)}>Cancel</Button>
                  </div>
                )}
                {isRenaming && (
                  <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: '8px 0 0' }}>History comes along.</p>
                )}
              </div>
              <IconBtn label="Close" onClick={() => setSelectedCat(null)}>{Icon.close()}</IconBtn>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--nd-gap)',
              marginTop: 'var(--nd-s2)', padding: 'var(--nd-s1) 0',
              borderTop: 'var(--nd-rule)', borderBottom: 'var(--nd-rule)'
            }}>
              <div>
                <StatLabel size="xs" muted>Assigned</StatLabel>
                <Money size={14} align="left" style={{ display: 'block', marginTop: 6 }}>{formatCurrency(selectedCat.assigned)}</Money>
              </div>
              <div>
                <StatLabel size="xs" muted>Activity</StatLabel>
                <Money size={14} align="left" style={{ display: 'block', marginTop: 6 }}>
                  {selectedCat.activity === 0 ? '—' : formatCurrency(selectedCat.activity)}
                </Money>
              </div>
              <div>
                <StatLabel size="xs" muted>Available</StatLabel>
                <Money size={14} align="left" tone={selectedCat.available < 0 ? 'var(--app-error)' : 'var(--app-ink)'} style={{ display: 'block', marginTop: 6 }}>
                  {formatCurrency(selectedCat.available)}
                </Money>
              </div>
            </div>

            <div style={{ marginTop: 'var(--nd-s2)' }}>
              <StatLabel size="xs">Assign from to be assigned</StatLabel>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  className="rl-input" inputMode="decimal" placeholder="0.00"
                  value={assignAmount}
                  onChange={e => setAssignAmount(e.target.value.replace(/,/g, '.'))}
                  style={moneyInputStyle}
                />
                <Button variant="action" onClick={handleAssign} disabled={!pending} style={{ flex: '0 0 auto' }}>Assign</Button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: '10px 0 0' }}>
                {pending > 0
                  ? `Available becomes ${formatCurrency(selectedCat.available + pending)}, and ${formatCurrency(state.toBeAssigned - pending)} stays unassigned.`
                  : `There is ${formatCurrency(state.toBeAssigned)} waiting to be assigned.`}
              </p>
            </div>

            <div style={{ marginTop: 'var(--nd-s2)', paddingTop: 'var(--nd-s1)', borderTop: '1px solid var(--app-line)' }}>
              <StatLabel size="xs">Move money elsewhere</StatLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <input
                  className="rl-input" inputMode="decimal" placeholder="0.00"
                  value={moveAmount} onChange={e => setMoveAmount(e.target.value.replace(/,/g, '.'))}
                  style={moneyInputStyle}
                />
                <select className="rl-input" style={inputStyle} value={moveDest} onChange={e => setMoveDest(e.target.value)}>
                  <option value="">Choose where it goes</option>
                  {activeCategories.filter(c => c.name !== selectedCat.categoryId).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={handleMove} disabled={!moveAmount || !moveDest} style={{ height: 44 }}>Move it</Button>
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--nd-gap)',
              marginTop: 'var(--nd-s2)', paddingTop: 'var(--nd-s1)', borderTop: 'var(--nd-rule)'
            }}>
              <div>
                <StatLabel size="xs">Set aside</StatLabel>
                <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: '4px 0 0' }}>
                  {selectedCat.available !== 0
                    ? `Move ${formatCurrency(selectedCat.available)} somewhere first.`
                    : 'Hidden from the budget, history kept.'}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={handleArchive}
                disabled={selectedCat.available !== 0}
              >
                {armArchive ? 'Tap to confirm' : 'Set aside'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── New category modal ── */}
      <Modal
        open={isAdding}
        title="New Category"
        onClose={() => setIsAdding(false)}
        footer={
          <div style={{ display: 'flex', gap: 'var(--nd-gap)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button variant="action" onClick={handleAddCategory} disabled={!newCatName}>Create category</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nd-s1)' }}>
          <div>
            <StatLabel size="xs" muted>Name</StatLabel>
            <input className="rl-input" style={{ ...inputStyle, marginTop: 6 }} value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Vet" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: 'var(--nd-gap)' }}>
            <div>
              <StatLabel size="xs" muted>Group</StatLabel>
              <input className="rl-input" style={{ ...inputStyle, marginTop: 6 }} value={newCatGroup} onChange={e => setNewCatGroup(e.target.value)} placeholder="Monthly" />
            </div>
            <div>
              <StatLabel size="xs" muted>Monthly Target</StatLabel>
              <input
                className="rl-input" inputMode="decimal" style={{ ...moneyInputStyle, marginTop: 6 }}
                value={newCatTarget} onChange={e => setNewCatTarget(e.target.value.replace(/,/g, '.'))} placeholder="0.00"
              />
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--app-ink-muted)', margin: 0 }}>
            A target is optional. Leave it empty and the category simply holds whatever you assign.
          </p>
        </div>
      </Modal>
    </div>
  );
}
