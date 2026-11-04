/**
 * Saving and removing Building Calculator estimates.
 *
 * An estimate belongs to the user who saved it and can be attached to one of their projects,
 * where the Estimate vs Actual tab compares it with real purchases.
 */
import { db } from '../db/db';
import { userCanAccessRecord, type BuildingEstimate, type User } from '../db/types';
import type { EstimateInput, EstimateOutcome } from '../domain/estimate';
import { nowIso } from '../utils/datetime';
import { newId, writableSite, type Result } from './records';

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export interface SaveEstimateInput {
  name: string;
  siteId?: string;
  notes?: string;
  input: EstimateInput;
  result: EstimateOutcome;
  /** Set after the user has confirmed saving a second copy of the same estimate. */
  allowDuplicate?: boolean;
}

/** Estimates this user may see: their own, or all of them for an administrator. */
export async function estimatesFor(user: User): Promise<BuildingEstimate[]> {
  const all = await db.estimates.filter(e => !e.isDeleted).toArray();
  const mine = all.filter(estimate => userCanAccessRecord(user, 'estimates', 'read', estimate.userId));
  return mine.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function saveBuildingEstimate(user: User, save: SaveEstimateInput): Promise<Result<BuildingEstimate>> {
  const name = save.name.trim();
  if (!name) return fail('Give the estimate a name.');
  if (name.length > 80) return fail('Use a shorter name (80 characters at most).');

  const site = save.siteId ? await writableSite(user, save.siteId, 'estimates') : null;
  if (save.siteId && !site) return fail('You do not have access to that project.');

  const { input, result } = save;
  const a = result.areas;
  const now = nowIso();
  const record: BuildingEstimate = {
    id: newId('est'),
    userId: user.id,
    siteId: site?.id,
    siteName: site?.name,
    estimateName: name,
    plotArea: a.plotSqFt ?? a.footprintSqFt,
    plotAreaUnit: 'sq.ft',
    builtUpArea: a.builtUpSqFt,
    builtUpAreaUnit: 'sq.ft',
    convertedBuiltUpSqFt: a.builtUpSqFt,
    floors: a.floors,
    buildingType: input.buildingType,
    quality: input.quality,
    structureType: input.structureType,
    concreteGrade: input.concreteGrade,
    steelGrade: input.steelGrade,
    includeRiverSand: input.includeRiverSand,
    materialEstimates: result.lines.map(({ working: _working, rateChanged: _changed, ...line }) => line),
    totalEstimatedMaterialCost: result.materialCost,
    estimatedLabourCost: result.labourCost,
    totalEstimatedCost: result.total,
    notes: save.notes?.trim() || undefined,
    plotSqFt: a.plotSqFt,
    footprintSqFt: a.footprintSqFt,
    labourRatePerSqFt: input.prices.labourPerSqFt,
    finishingRatePerSqFt: input.finishingPerSqFt,
    finishingCost: result.finishingCost,
    ratesUsed: { ...result.rates },
    ratesChanged: result.ratesChanged,
    assumptions: result.assumptions,
    inputs: input,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  return db.transaction('rw', db.estimates, db.activityLogs, async () => {
    // Checked inside the transaction, so a double tap can not save the same estimate twice.
    if (!save.allowDuplicate) {
      const dup = await db.estimates
        .filter(e => !e.isDeleted && e.userId === user.id && (e.siteId || '') === (record.siteId || '') &&
          e.estimateName.trim().toLowerCase() === name.toLowerCase() && e.totalEstimatedCost === record.totalEstimatedCost)
        .first();
      if (dup) return { ok: false as const, error: 'An estimate with this name and total is already saved.', duplicateOf: dup.id };
    }
    await db.estimates.put(record);
    await db.logActivity(
      user.id, user.fullName || user.username, user.role, site?.id, site?.name, 'ESTIMATE_SAVED',
      `Saved estimate "${name}" (${a.builtUpSqFt} sq.ft built-up, ₹${result.total.toLocaleString('en-IN')})`
    );
    return { ok: true as const, value: record };
  }).catch((e: Error) => fail(e.message || 'Could not save the estimate.'));
}

/** Moves an estimate to the Recycle Bin. */
export async function removeBuildingEstimate(user: User, id: string): Promise<Result> {
  const est = await db.estimates.get(id);
  if (!est || est.isDeleted) return fail('Estimate not found.');
  if (!userCanAccessRecord(user, 'estimates', 'write', est.userId)) return fail('You do not have access to this estimate.');
  await db.softDelete('estimates', id, user);
  return { ok: true, value: undefined };
}
