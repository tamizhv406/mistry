/**
 * Building Calculator: areas (plot vs built-up), input checks, the documented rates,
 * recalculation, and saving an estimate to a project.
 */
import 'fake-indexeddb/auto';
import type { Site, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u-owner', username: 'owner', fullName: 'Owner', mobile: '', email: 'o@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };
const stranger: User = { ...owner, id: 'u-other', username: 'other', email: 'other@x.in' };
const admin: User = { ...owner, id: 'u-admin', username: 'boss', email: 'boss@x.in', role: 'SUPER_ADMIN' };

async function run() {
  const est = await import('../src/domain/estimate');
  const core = await import('../src/utils/estimator');
  const { emptySize, sizeSqFt, planAreas, buildEstimate, EXAMPLE_PRICES } = est;

  const dims = (length: number, width: number, lengthUnit: 'ft' | 'm' = 'ft') => ({ ...emptySize('dimensions'), length, width, lengthUnit });
  const area = (value: number, areaUnit: 'sq.ft' | 'sq.m' | 'cent' | 'ground' = 'sq.ft') => ({ ...emptySize('area'), area: value, areaUnit });
  const percent = (value: number) => ({ ...emptySize('percent'), percent: value });
  const base = {
    buildingType: 'Residential Villa', plot: dims(40, 60), footprint: dims(40, 25), floors: 2,
    structureType: 'Framed Structure (RCC)' as const, quality: 'Standard' as const, concreteGrade: 'M20' as const, steelGrade: 'Fe500' as const,
    includeRiverSand: false, prices: { ...EXAMPLE_PRICES }, rateOverrides: {}, finishingPerSqFt: 0,
  };
  const value = (input: typeof base | Record<string, unknown>) => {
    const r = buildEstimate(input as Parameters<typeof buildEstimate>[0]);
    if (!r.ok) throw new Error('Expected an estimate, got errors: ' + JSON.stringify(r.errors));
    return r.value;
  };
  const errorsOf = (input: Record<string, unknown>) => {
    const r = buildEstimate(input as Parameters<typeof buildEstimate>[0]);
    return r.ok ? {} : r.errors;
  };
  const qty = (o: ReturnType<typeof value>, material: string) => o.lines.find(l => l.material === material)?.quantity;

  console.log('\n--- 1. Sizes and units ---');
  check('40 ft × 25 ft = 1,000 sq.ft', sizeSqFt(dims(40, 25)) === 1000);
  check('12 m × 9 m = 108 sq.m = 1,162.5 sq.ft', near(sizeSqFt(dims(12, 9, 'm')), 108 * 10.76391, 0.01), sizeSqFt(dims(12, 9, 'm')));
  check('3 cent = 1,306.8 sq.ft', sizeSqFt(area(3, 'cent')) === 1306.8);
  check('1 ground = 2,400 sq.ft', sizeSqFt(area(1, 'ground')) === 2400);
  check('100 sq.m = 1,076.39 sq.ft', sizeSqFt(area(100, 'sq.m')) === 1076.39);
  check('60% of a 2,400 sq.ft plot = 1,440 sq.ft', sizeSqFt(percent(60), 2400) === 1440);
  check('A half-typed size is not a number', Number.isNaN(sizeSqFt(dims(40, NaN))) && Number.isNaN(sizeSqFt(area(NaN))));
  check('Zero and negative sizes are not accepted', Number.isNaN(sizeSqFt(dims(0, 25))) && Number.isNaN(sizeSqFt(area(-5))));

  console.log('\n--- 2. Plot area is not built-up area ---');
  const a = planAreas({ plot: dims(40, 60), footprint: dims(40, 25), floors: 2 });
  check('Plot 2,400 sq.ft, building 1,000 sq.ft on each of 2 floors', a.plan?.plotSqFt === 2400 && a.plan?.footprintSqFt === 1000 && a.plan?.floors === 2);
  check('Built-up area = building on one floor × floors = 2,000 sq.ft', a.plan?.builtUpSqFt === 2000);
  check('Built-up area is not plot × floors', a.plan?.builtUpSqFt !== 2400 * 2);
  check('Coverage 41.7% and 1,400 sq.ft left open', a.plan?.coveragePct === 41.7 && a.plan?.openSqFt === 1400, a.plan);
  const noPlot = planAreas({ plot: emptySize(), footprint: area(900), floors: 1 });
  check('The plot is optional', noPlot.plan?.plotSqFt === null && noPlot.plan?.builtUpSqFt === 900 && noPlot.plan?.coveragePct === null);
  const pct = planAreas({ plot: area(3, 'cent'), footprint: percent(70), floors: 2 });
  check('70% of 3 cent on 2 floors = 1,829.52 sq.ft built-up', pct.plan?.footprintSqFt === 914.76 && pct.plan?.builtUpSqFt === 1829.52, pct.plan);

  console.log('\n--- 3. Wrong input is refused, with a reason ---');
  check('A building bigger than the plot', /larger than the plot/.test(planAreas({ plot: dims(30, 40), footprint: dims(40, 40), floors: 1 }).errors.footprint || ''));
  check('No building size', !!planAreas({ plot: dims(30, 40), footprint: emptySize(), floors: 1 }).errors.footprint);
  check('A percent without a plot', /plot size first/.test(planAreas({ plot: emptySize(), footprint: percent(60), floors: 1 }).errors.footprint || ''));
  check('More than 100% of the plot', !!planAreas({ plot: dims(30, 40), footprint: percent(120), floors: 1 }).errors.footprint);
  check('A half-typed plot', !!planAreas({ plot: dims(30, NaN), footprint: area(800), floors: 1 }).errors.plot);
  check('A size that is almost certainly a unit mistake (20 sq.ft)', /Check the numbers/.test(planAreas({ plot: emptySize(), footprint: area(20), floors: 1 }).errors.footprint || ''));
  check('0 floors, 6 floors and 1.5 floors', [0, 6, 1.5].every(f => !!planAreas({ plot: emptySize(), footprint: area(800), floors: f }).errors.floors));
  check('No plan is returned when anything is wrong', planAreas({ plot: emptySize(), footprint: area(800), floors: 0 }).plan === null);
  check('A plot covered more than 90% gets a warning, not an error', (() => { const r = planAreas({ plot: dims(30, 40), footprint: dims(30, 38), floors: 1 }); return !!r.plan && r.warnings.some(w => /open space/.test(w)); })());
  check('A negative price is refused', /price/.test(errorsOf({ ...base, prices: { ...EXAMPLE_PRICES, cementPerBag: -1 } }).prices || ''));
  check('A price that is not a number is refused', !!errorsOf({ ...base, prices: { ...EXAMPLE_PRICES, steelPerKg: NaN } }).prices);
  check('A negative rate is refused', !!errorsOf({ ...base, rateOverrides: { steelKgPerSqFt: -2 } }).rates);
  check('A negative finishing allowance is refused', !!errorsOf({ ...base, finishingPerSqFt: -10 }).finishing);

  console.log('\n--- 4. Quantities: built-up area × the published rate ---');
  const std = value(base);
  check('Standard, 2,000 sq.ft: cement 0.45 × 2,000 = 900 bags', qty(std, 'Cement') === 900);
  check('Steel 4 × 2,000 = 8,000 kg', qty(std, 'Steel') === 8000);
  check('M-sand 0.9 × 2,000 = 1,800 cft, and no river sand line', qty(std, 'M-Sand') === 1800 && qty(std, 'Sand') === undefined);
  check('Aggregate 1.1 × 2,000 = 2,200 cft', qty(std, 'Aggregate') === 2200);
  check('Bricks 8 × 2,000 = 16,000', qty(std, 'Bricks') === 16000);
  check('Each line shows its working', std.lines.find(l => l.material === 'Cement')?.working === '2,000 sq.ft × 0.45 bags', std.lines[0].working);
  const low = value({ ...base, quality: 'Economy' });
  const high = value({ ...base, quality: 'Premium' });
  check('Basic uses the low end of each range', qty(low, 'Cement') === 800 && qty(low, 'Steel') === 7000 && qty(low, 'M-Sand') === 1600 && qty(low, 'Aggregate') === 2000 && qty(low, 'Bricks') === 10000);
  check('Premium uses the high end of each range', qty(high, 'Cement') === 1000 && qty(high, 'Steel') === 9000 && qty(high, 'M-Sand') === 2000 && qty(high, 'Aggregate') === 2400 && qty(high, 'Bricks') === 20000);
  for (const [name, rule] of Object.entries(core.THUMB_RULES)) {
    if (!(rule.low <= rule.typical && rule.typical <= rule.high)) throw new Error(`Rate table out of order: ${name}`);
  }
  check('In every published range, low ≤ typical ≤ high', true);
  check('Every rate names where it comes from', core.THUMB_RULE_SOURCES.length >= 2 && core.THUMB_RULE_SOURCES.every(s => s.url.startsWith('https://')));
  const river = value({ ...base, includeRiverSand: true });
  check('River sand for plastering: 30% of the sand, the rest M-sand', qty(river, 'Sand') === 540 && qty(river, 'M-Sand') === 1260);
  check('…and the total sand is unchanged', (qty(river, 'Sand') || 0) + (qty(river, 'M-Sand') || 0) === 1800);

  console.log('\n--- 5. What does and does not change a quantity ---');
  const lb = value({ ...base, structureType: 'Load Bearing' });
  check('Construction type changes no quantity', ['Cement', 'Steel', 'M-Sand', 'Aggregate', 'Bricks'].every(m => qty(lb, m) === qty(std, m)));
  check('…but says, in plain words, the rates are for a pillar & beam house', lb.warnings.some(w => /pillar-free/i.test(w)) && !std.warnings.some(w => /pillar/i.test(w)));
  check('A pillar-free house over two floors is warned about', value({ ...base, structureType: 'Load Bearing', floors: 3 }).warnings.some(w => /more than two floors/.test(w)) && !lb.warnings.some(w => /more than two floors/.test(w)));
  check('House types use the plain names', est.HOUSE_TYPES.map(h => h.label).join() === 'Pillar & Beam House,Pillar-Free Traditional House');
  const grade = value({ ...base, concreteGrade: 'M30', steelGrade: 'Fe550' });
  check('Concrete and steel grade change no quantity', ['Cement', 'Steel', 'Aggregate'].every(m => qty(grade, m) === qty(std, m)));
  check('Grades are not in the on-screen assumptions', !grade.assumptions.some(t => /M\d\d|Fe\d{3}/.test(t)) && !std.assumptions.some(t => /M20|Fe500/.test(t)));
  check('…but are kept as engineering defaults for the file', grade.engineerNotes.some(t => /M30/.test(t) && /Fe550/.test(t) && /do not change these quantities/.test(t)));
  check('The documented defaults are M20 and Fe500', est.ENGINEERING_DEFAULTS.concreteGrade === 'M20' && est.ENGINEERING_DEFAULTS.steelGrade === 'Fe500');
  check('The plot size changes no quantity', qty(value({ ...base, plot: dims(100, 100) }), 'Cement') === 900);
  check('Shed and commercial buildings are flagged as outside the rates', value({ ...base, buildingType: 'Industrial Shed' }).warnings.some(w => /rough guide/.test(w)));

  console.log('\n--- 6. Recalculation ---');
  check('One more floor: 3,000 sq.ft, 1,350 bags', (() => { const o = value({ ...base, floors: 3 }); return o.areas.builtUpSqFt === 3000 && qty(o, 'Cement') === 1350; })());
  check('A bigger building on the same plot', qty(value({ ...base, footprint: dims(40, 30) }), 'Cement') === 1080);
  const custom = value({ ...base, rateOverrides: { steelKgPerSqFt: 2.5, bricksPiecesPerSqFt: 20 } });
  check('A changed rate is used', qty(custom, 'Steel') === 5000 && qty(custom, 'Bricks') === 40000);
  check('…is marked as changed', custom.ratesChanged.length === 2 && custom.lines.find(l => l.material === 'Steel')?.rateChanged === true && custom.lines.find(l => l.material === 'Cement')?.rateChanged === false);
  check('…and leaves the other quantities alone', qty(custom, 'Cement') === 900);
  check('Typing the published rate back is not a change', value({ ...base, rateOverrides: { steelKgPerSqFt: 4 } }).ratesChanged.length === 0);
  check('A rate far outside the usual range is warned about', value({ ...base, rateOverrides: { cementBagsPerSqFt: 4.5 } }).warnings.some(w => /Cement/.test(w) && /Check it/.test(w)));

  console.log('\n--- 7. Cost ---');
  const expectedMaterials = 900 * 420 + 8000 * 74 + 1800 * 45 + 2200 * 42 + 16000 * 10.5;
  check('Material cost = Σ quantity × price', std.materialCost === expectedMaterials, [std.materialCost, expectedMaterials]);
  check('Every line cost = quantity × price', std.lines.every(l => l.estimatedCost === Math.round(l.quantity * l.rate)));
  check('Labour = built-up area × rate', std.labourCost === 2000 * 320);
  check('Total = materials + labour', std.total === expectedMaterials + 640000 && std.finishingCost === 0);
  check('Cost per sq.ft is over the built-up area', std.costPerSqFt === Math.round(std.total / 2000));
  check('Tiles, paint, doors, windows, electrical and plumbing are each listed as not included',
    ['Tiles', 'Paint', 'Doors', 'Windows', 'Electrical work', 'Plumbing'].every(t => std.notIncluded.includes(t)), std.notIncluded);
  const fin = value({ ...base, finishingPerSqFt: 600 });
  check('A finishing allowance adds built-up area × rate', fin.finishingCost === 1200000 && fin.total === std.total + 1200000);
  check('…and they are no longer listed as left out', !fin.notIncluded.some(t => ['Tiles', 'Paint', 'Plumbing'].includes(t)));
  check('A new price changes the cost, not the quantity', (() => { const o = value({ ...base, prices: { ...EXAMPLE_PRICES, cementPerBag: 450 } }); return qty(o, 'Cement') === 900 && o.materialCost === expectedMaterials + 900 * 30; })());
  check('Labour priced at 0 gives no labour cost', value({ ...base, prices: { ...EXAMPLE_PRICES, labourPerSqFt: 0 } }).labourCost === 0);
  check('Example prices are counted and warned about', std.examplePricesLeft === 6 && std.warnings.some(w => /example values/.test(w)), std.examplePricesLeft);
  check('…and the warning goes when they are replaced', (() => {
    const o = value({ ...base, prices: { cementPerBag: 410, sandPerCft: 130, msandPerCft: 50, aggregatePerCft: 40, brickPerPiece: 9, steelPerKg: 70, labourPerSqFt: 300 } });
    return o.examplePricesLeft === 0 && !o.warnings.some(w => /example values/.test(w));
  })());
  check('The result is labelled as approximate', /approximate/i.test(std.disclaimer) && /not a structural design/.test(std.disclaimer));
  check('…with the exact wording', std.disclaimer.startsWith('Approximate estimate only. Actual cost may vary.') && /guaranteed quote/.test(std.disclaimer));
  check('The assumptions state the area sum', std.assumptions[0].includes('1,000 sq.ft') && std.assumptions[0].includes('2 floors') && std.assumptions[0].includes('2,000 sq.ft'));
  check('The same input always gives the same result', JSON.stringify(value(base)) === JSON.stringify(std));

  console.log('\n--- 8. Report ---');
  const rows = est.estimateReportRows(base as Parameters<typeof est.estimateReportRows>[0], std, { date: '12 Oct 2026', name: 'Test', project: 'Site A' });
  const flat = rows.map(r => r.join(' | '));
  check('The report shows plot and built-up area separately', flat.some(r => r === 'Plot area (sq.ft) | 2400') && flat.some(r => r === 'Built-up area (sq.ft) | 2000'));
  check('It lists every material with quantity, rate, price and cost', flat.some(r => r.startsWith('Cement | 900 | Bags | 0.45 | 420 | 378000')));
  check('It carries the total, the assumptions and the limits', flat.some(r => r.startsWith('TOTAL (approximate)')) && flat.includes('ASSUMPTIONS') && flat.some(r => r.startsWith('LIMITS')));
  check('CSV quotes are escaped', est.toCsv([['a "b"', 'c,d']]) === '"a ""b""","c,d"');

  console.log('\n--- 9. Saving to a project ---');
  const { db } = await import('../src/db/db');
  const svc = await import('../src/services/estimates');
  await db.open();
  const site: Site = {
    id: 's1', userId: owner.id, name: 'Velu House', ownerName: 'A', ownerPhone: '', address: '', area: '', buildingType: 'House',
    startDate: '2026-09-01', expectedCompletionDate: '2027-03-01', status: 'Active', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  };
  await db.sites.put(site);
  const input = base as Parameters<typeof buildEstimate>[0];
  const s1 = await svc.saveBuildingEstimate(owner, { name: 'Velu G+1', siteId: 's1', notes: ' first ', input, result: std });
  check('Estimate saved to the project', s1.ok && s1.value.siteId === 's1' && s1.value.siteName === 'Velu House');
  const stored = s1.ok ? await db.estimates.get(s1.value.id) : undefined;
  check('It keeps plot, building and built-up area apart', stored?.plotSqFt === 2400 && stored?.footprintSqFt === 1000 && stored?.convertedBuiltUpSqFt === 2000 && stored?.floors === 2, stored && [stored.plotSqFt, stored.footprintSqFt]);
  check('It keeps every material line and the totals', stored?.materialEstimates.length === 5 && stored?.totalEstimatedCost === std.total && stored?.totalEstimatedMaterialCost === std.materialCost);
  check('It keeps the rates and assumptions it was made with', stored?.ratesUsed?.cementBagsPerSqFt === 0.45 && (stored?.assumptions?.length || 0) >= 6 && stored?.notes === 'first');
  check('It belongs to the user who saved it', stored?.userId === owner.id && stored?.isDeleted === false);
  check('Reading it back gives the same estimate again', (() => {
    const again = buildEstimate(stored?.inputs as Parameters<typeof buildEstimate>[0]);
    return again.ok && again.value.total === std.total && again.value.areas.builtUpSqFt === 2000;
  })());
  const dup = await svc.saveBuildingEstimate(owner, { name: 'velu g+1', siteId: 's1', input, result: std });
  check('Saving the same estimate again is stopped', !dup.ok && !!(dup as { duplicateOf?: string }).duplicateOf && (await db.estimates.count()) === 1);
  const [x, y] = await Promise.all([
    svc.saveBuildingEstimate(owner, { name: 'Double tap', input, result: std }),
    svc.saveBuildingEstimate(owner, { name: 'Double tap', input, result: std }),
  ]);
  check('A double tap saves once', [x, y].filter(r => r.ok).length === 1 && (await db.estimates.count()) === 2);
  check('A second copy is saved when confirmed', (await svc.saveBuildingEstimate(owner, { name: 'Velu G+1', siteId: 's1', input, result: std, allowDuplicate: true })).ok);
  check('A name is required', !(await svc.saveBuildingEstimate(owner, { name: '  ', input, result: std })).ok);
  check('Another contractor can not save into this project', !(await svc.saveBuildingEstimate(stranger, { name: 'Sneaky', siteId: 's1', input, result: std })).ok);
  check('An unknown project is refused', !(await svc.saveBuildingEstimate(owner, { name: 'Lost', siteId: 'nope', input, result: std })).ok);
  check('It can be saved without a project', (await svc.saveBuildingEstimate(stranger, { name: 'Mine', input, result: std })).ok);
  check('Each user sees only their own estimates', (await svc.estimatesFor(owner)).length === 3 && (await svc.estimatesFor(stranger)).length === 1);
  check('An administrator sees all of them', (await svc.estimatesFor(admin)).length === 4);
  const mine = (await svc.estimatesFor(stranger))[0];
  check('Another user can not delete it', !(await svc.removeBuildingEstimate(owner, mine.id)).ok && (await db.estimates.get(mine.id))?.isDeleted === false);
  check('Its owner can: it goes to the Recycle Bin', (await svc.removeBuildingEstimate(stranger, mine.id)).ok && (await db.estimates.get(mine.id))?.isDeleted === true && (await svc.estimatesFor(stranger)).length === 0);

  console.log(`\n✅ Building Calculator: all ${passed} checks passed.\n`);
}

run().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
