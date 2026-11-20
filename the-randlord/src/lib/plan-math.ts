import { PlanRow } from '../types';

export interface PlanTotals {
  personal: number;
  agency: number;
  allIn: number;
  withBuilding: number;
  withSuggestions: number;
  missing: number;
}

const isCost = (r: PlanRow) => r.group !== 'Income' && r.group !== 'Changes';
const cents = (r: PlanRow) => Math.round((r.amount as number) * 100);

/**
 * Plan totals. Plain integer-cent sums, no dates, no cadence, no AI.
 * Amounts are already per month; a one-off counts at face value.
 * Income and Changes rows never count, whatever their tier.
 */
export function computePlanTotals(rows: PlanRow[]): PlanTotals {
  let personal = 0;
  let agency = 0;
  let building = 0;
  let suggestion = 0;
  let missing = 0;

  for (const r of rows) {
    if (!isCost(r) || r.tier === 'none') continue;
    if (r.amount === null) { missing++; continue; }
    const c = cents(r);
    if (r.tier === 'base') {
      if (r.group === 'Agency') agency += c;
      else personal += c;
    } else if (r.tier === 'building') building += c;
    else if (r.tier === 'suggestion') suggestion += c;
  }

  const allIn = personal + agency;
  const withBuilding = allIn + building;
  return {
    personal: personal / 100,
    agency: agency / 100,
    allIn: allIn / 100,
    withBuilding: withBuilding / 100,
    withSuggestions: (withBuilding + suggestion) / 100,
    missing
  };
}
