/**
 * Tools workflow (Task 3): issue and return with day, time, person and condition; no double
 * issue; damaged tools kept aside; custom tool with the person's own photo; add / edit / remove /
 * search; and "Late" for a tool still out after the day it was taken.
 */
import 'fake-indexeddb/auto';
import type { Site, ToolAsset, ToolIssue, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u-owner', username: 'owner', fullName: 'Owner', mobile: '', email: 'o@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };
const stranger: User = { ...owner, id: 'u-other', username: 'other', email: 'other@x.in' };

async function run() {
  const { db } = await import('../src/db/db');
  const svc = await import('../src/services/records');
  const tt = await import('../src/domain/toolTracking');
  const { todayKey, addDays, dayKeyOf } = await import('../src/utils/datetime');
  await db.open();
  await svc.ensureCatalogSeeded();

  const site: Site = {
    id: 't1', userId: owner.id, name: 'Tool Site', ownerName: 'A', ownerPhone: '', address: '', area: '', buildingType: 'House',
    startDate: '2026-09-01', expectedCompletionDate: '2027-03-01', status: 'Active', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  };
  await db.sites.put(site);
  const today = todayKey();
  const d = (n: number) => addDays(today, n);
  const tool = async (id: string) => (await db.toolAssets.get(id)) as ToolAsset;
  const status = async (id: string) => tt.buildToolStatus(await tool(id), await db.toolIssues.where('toolAssetId').equals(id).toArray(), today);
  const add = async (name: string, totalQuantity = 1, extra: Record<string, unknown> = {}) => {
    const res = await svc.saveToolAsset(owner, 't1', { name, category: 'Power tools', totalQuantity, condition: 'Good', ...extra });
    if (!res.ok) throw new Error(res.error);
    return res.value.id;
  };

  console.log('\n--- 1. Issue and return: day, time, person, condition ---');
  const drill = await add('Drill Machine');
  const before = Date.now();
  const iss = await svc.issueTool(owner, 't1', { toolAssetId: drill, quantity: 1, issuedTo: 'Murugan', workerId: 'w-murugan' });
  check('Issued to Murugan', iss.ok);
  const issue = iss.ok ? ((await db.toolIssues.get(iss.value.id)) as ToolIssue) : undefined;
  check('Saved: who, worker, quantity, by whom', issue?.issuedTo === 'Murugan' && issue.workerId === 'w-murugan' && issue.quantity === 1 && issue.createdBy === owner.id, issue);
  check('Saved: today\'s date and the real time', !!issue && dayKeyOf(issue.issuedAt) === today && Date.parse(issue.issuedAt) >= before - 1000 && Date.parse(issue.issuedAt) <= Date.now() + 1000, issue?.issuedAt);
  let st = await status(drill);
  check('Shows as out with Murugan', tt.toolState(st) === 'out' && st.holders[0]?.name === 'Murugan' && st.available === 0);
  check('The row offers Return', tt.toolAction(st) === 'return');
  check('Not late on the day it was taken', !st.late);

  console.log('\n--- 2. No double issue ---');
  const again = await svc.issueTool(owner, 't1', { toolAssetId: drill, quantity: 1, issuedTo: 'Selvam' });
  check('Issuing it again while out is refused', !again.ok);
  check('…saying who has it', !again.ok && /Already issued to Murugan/.test(again.error) && /Record the return/.test(again.error), again);
  check('Still one issue on record', (await db.toolIssues.where('toolAssetId').equals(drill).count()) === 1);

  const ret = await svc.returnTool(owner, 't1', { issueId: iss.ok ? iss.value.id : '', quantity: 1, condition: 'Good', notes: 'ok' });
  check('Returned in good condition', ret.ok);
  const back = ret.ok ? ret.value.returns[0] : undefined;
  check('Saved: return day, time, condition, by whom', !!back && dayKeyOf(back.returnedAt) === today && back.condition === 'Good' && back.recordedBy === owner.id && back.quantity === 1, back);
  st = await status(drill);
  check('Available again, row offers Issue', tt.toolState(st) === 'available' && tt.toolAction(st) === 'issue' && st.available === 1);
  check('Returning it twice is refused', !(await svc.returnTool(owner, 't1', { issueId: iss.ok ? iss.value.id : '', quantity: 1, condition: 'Good' })).ok);
  const [a, b] = await Promise.all([
    svc.issueTool(owner, 't1', { toolAssetId: drill, quantity: 1, issuedTo: 'Ravi' }),
    svc.issueTool(owner, 't1', { toolAssetId: drill, quantity: 1, issuedTo: 'Kumar' }),
  ]);
  check('Two quick taps from two phones: only one issue goes through', [a, b].filter(r => r.ok).length === 1, [a.ok, b.ok]);
  const open = (a.ok ? a.value : b.ok ? b.value : undefined)!;
  await svc.returnTool(owner, 't1', { issueId: open.id, quantity: 1, condition: 'Good' });
  check('A stranger can not issue tools here', !(await svc.issueTool(stranger, 't1', { toolAssetId: drill, quantity: 1, issuedTo: 'X' })).ok);
  check('Blank name is refused', !(await svc.issueTool(owner, 't1', { toolAssetId: drill, quantity: 1, issuedTo: '  ' })).ok);

  console.log('\n--- 3. Dates on the issue and return forms ---');
  check('A future issue date is refused', !(await svc.issueTool(owner, 't1', { toolAssetId: drill, quantity: 1, issuedTo: 'Ravi', issuedOn: d(1) })).ok);
  const past = await svc.issueTool(owner, 't1', { toolAssetId: drill, quantity: 1, issuedTo: 'Ravi', issuedOn: d(-2) });
  check('An issue dated two days ago is saved on that day', past.ok && dayKeyOf(past.value.issuedAt) === d(-2) && tt.issueDay(past.value) === d(-2));
  check('A return dated before the issue is refused', past.ok && !(await svc.returnTool(owner, 't1', { issueId: past.value.id, quantity: 1, condition: 'Good', returnedOn: d(-3) })).ok);
  check('A future return date is refused', past.ok && !(await svc.returnTool(owner, 't1', { issueId: past.value.id, quantity: 1, condition: 'Good', returnedOn: d(1) })).ok);

  console.log('\n--- 4. Late: out after the day it was taken ---');
  st = await status(drill);
  check('Issued two days ago, not back: Late', st.late && st.holders[0].late && tt.isLate(past.ok ? past.value : ({} as ToolIssue), today));
  check('Days out counted', past.ok && tt.daysOut(past.value, today) === 2);
  const yesterday: ToolIssue = { id: 'x', siteId: 't1', toolAssetId: 'x', quantity: 1, issuedTo: 'A', issuedAt: `${d(-1)}T12:30:00.000Z`, returns: [], isDeleted: false, createdAt: '', updatedAt: '' };
  check('Issued yesterday evening and not back: Late', tt.isLate(yesterday, today));
  check('Issued this morning: not late', !tt.isLate({ ...yesterday, issuedAt: new Date().toISOString() }, today));
  check('An agreed return date in the future: not late yet', !tt.isLate({ ...yesterday, issuedAt: `${d(-3)}T06:30:00.000Z`, expectedReturnDate: d(1) }, today));
  check('An agreed return date already passed: Late', tt.isLate({ ...yesterday, expectedReturnDate: d(-1) }, today));
  check('Returned tools are never late', !tt.isLate({ ...yesterday, returns: [{ id: 'r', quantity: 1, returnedAt: '', condition: 'Good' }] }, today));
  check('Cancelled issues are never late', !tt.isLate({ ...yesterday, isDeleted: true }, today));
  const backLate = await svc.returnTool(owner, 't1', { issueId: past.ok ? past.value.id : '', quantity: 1, condition: 'Good', returnedOn: d(-1) });
  check('Returned yesterday: saved on that day, no longer late', backLate.ok && dayKeyOf(backLate.value.returns[0].returnedAt) === d(-1) && !(await status(drill)).late);

  console.log('\n--- 5. Damaged tools are kept aside ---');
  const grinder = await add('Angle Grinder');
  const g1 = await svc.issueTool(owner, 't1', { toolAssetId: grinder, quantity: 1, issuedTo: 'Selvam' });
  check('Returned damaged', g1.ok && (await svc.returnTool(owner, 't1', { issueId: g1.value.id, quantity: 1, condition: 'Damaged', notes: 'disc broken' })).ok);
  st = await status(grinder);
  check('Kept aside: none available, shows Damaged', st.damaged === 1 && st.available === 0 && tt.toolState(st) === 'damaged' && tt.toolAction(st) === 'none');
  const blocked = await svc.issueTool(owner, 't1', { toolAssetId: grinder, quantity: 1, issuedTo: 'Ravi' });
  check('A damaged tool can not be issued', !blocked.ok && /damaged/i.test(blocked.error), blocked);
  check('Damaged filter finds it', tt.matchesToolFilter(st, 'damaged') && !tt.matchesToolFilter(st, 'available'));
  check('Marking it repaired puts it back', (await svc.markToolRepaired(owner, 't1', grinder, 1)).ok && (await status(grinder)).available === 1);
  check('Repairing more than is kept aside is refused', !(await svc.markToolRepaired(owner, 't1', grinder, 1)).ok);
  await svc.saveToolAsset(owner, 't1', { id: grinder, name: 'Angle Grinder', category: 'Power tools', totalQuantity: 1, condition: 'Needs Repair' });
  const marked = await svc.issueTool(owner, 't1', { toolAssetId: grinder, quantity: 1, issuedTo: 'Ravi' });
  check('A tool marked Needs Repair can not be issued', !marked.ok && /Needs Repair/.test(marked.error), marked);
  check('…and shows as Damaged', tt.toolState(await status(grinder)) === 'damaged');
  await svc.saveToolAsset(owner, 't1', { id: grinder, name: 'Angle Grinder', category: 'Power tools', totalQuantity: 1, condition: 'Good' });
  check('Back to Good: it can be issued', (await status(grinder)).available === 1 && tt.toolAction(await status(grinder)) === 'issue');

  console.log('\n--- 6. Tools with several pieces ---');
  const shovel = await add('Shovel', 5);
  const s1 = await svc.issueTool(owner, 't1', { toolAssetId: shovel, quantity: 2, issuedTo: 'Arun' });
  const s2 = await svc.issueTool(owner, 't1', { toolAssetId: shovel, quantity: 1, issuedTo: 'Bala', issuedOn: d(-1) });
  st = await status(shovel);
  check('Who has how many', s1.ok && s2.ok && st.holders.length === 2 && st.holders[0].name === 'Bala' && st.holders[1].quantity === 2 && st.available === 2);
  check('The row still offers Issue while some are here', tt.toolAction(st) === 'issue');
  check('Only the one out since yesterday is late', st.late && st.holders.filter(h => h.late).map(h => h.name).join() === 'Bala');
  const tooMany = await svc.issueTool(owner, 't1', { toolAssetId: shovel, quantity: 3, issuedTo: 'Chandran' });
  check('Issuing more than are here is refused', !tooMany.ok && /Only 2 available/.test(tooMany.error), tooMany);
  check('Part return works', s1.ok && (await svc.returnTool(owner, 't1', { issueId: s1.value.id, quantity: 1, condition: 'Lost' })).ok);
  st = await status(shovel);
  check('A lost one comes off the total', st.lost === 1 && st.available === 2 && st.issued === 2);
  check('The total can not drop below what is out or lost', !(await svc.saveToolAsset(owner, 't1', { id: shovel, name: 'Shovel', category: 'Hand tools', totalQuantity: 2, condition: 'Good' })).ok);

  console.log('\n--- 7. Custom tool with own photo ---');
  const photo = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(30000)).toString('base64');
  const custom = await svc.saveToolAsset(owner, 't1', { name: 'Plate Compactor (Ravi\'s)', category: 'Machines', totalQuantity: 1, condition: 'Good', imageUrl: photo, imageCredit: '' });
  check('A custom tool with a photo is saved', custom.ok);
  db.close();
  await db.open();
  const reread = custom.ok ? await db.toolAssets.get(custom.value.id) : undefined;
  check('After reopening the database the photo is still there, unchanged', reread?.imageUrl === photo && reread.name === 'Plate Compactor (Ravi\'s)');
  const renamed = await svc.saveToolAsset(owner, 't1', { id: reread!.id, name: 'Plate Compactor', category: 'Machines', totalQuantity: 1, condition: 'Good' });
  check('Editing other fields keeps the photo', renamed.ok && (await db.toolAssets.get(reread!.id))?.imageUrl === photo);
  check('The photo can be removed', (await svc.saveToolAsset(owner, 't1', { id: reread!.id, name: 'Plate Compactor', category: 'Machines', totalQuantity: 1, condition: 'Good', imageUrl: '' })).ok &&
    (await db.toolAssets.get(reread!.id))?.imageUrl === '');

  console.log('\n--- 8. Add, edit, search, remove ---');
  const catalogTools = await db.catalogItems.where('kind').equals('tool').toArray();
  check('The tool catalog is there to pick from', catalogTools.length >= 10);
  const taken = new Set((await db.toolAssets.where('siteId').equals('t1').toArray()).map(x => x.name.toLowerCase()));
  const fromCatalog = catalogTools.find(c => !taken.has(c.name.toLowerCase()))!;
  check('A catalog tool can be added', (await svc.saveToolAsset(owner, 't1', { name: fromCatalog.name, category: fromCatalog.category, totalQuantity: 1, condition: 'Good', catalogItemId: fromCatalog.id })).ok);
  const dup = await svc.saveToolAsset(owner, 't1', { name: 'drill machine', category: 'Power tools', totalQuantity: 1, condition: 'Good' });
  check('The same name twice in one project is refused', !dup.ok && /already in this project/.test(dup.error), dup);
  check('Renaming onto another tool\'s name is refused', !(await svc.saveToolAsset(owner, 't1', { id: shovel, name: 'Drill Machine', category: 'Hand tools', totalQuantity: 5, condition: 'Good' })).ok);
  check('Editing a tool keeps its id and history', (await svc.saveToolAsset(owner, 't1', { id: drill, name: 'Drill Machine (Bosch)', category: 'Power tools', totalQuantity: 1, condition: 'Good' })).ok &&
    (await status(drill)).history.length === 3);
  const sh = await status(shovel);
  check('Search by name', tt.toolMatches({ name: 'Shovel', category: 'Hand tools' }, sh, 'sho'));
  check('Search by who has it', tt.toolMatches({ name: 'Shovel', category: 'Hand tools' }, sh, 'bala') && !tt.toolMatches({ name: 'Shovel', category: 'Hand tools' }, sh, 'murugan'));
  check('Empty search matches everything', tt.toolMatches({ name: 'Shovel', category: 'Hand tools' }, sh, '  '));
  const removeOut = await svc.removeToolAsset(owner, 't1', shovel);
  check('A tool that is out can not be removed', !removeOut.ok && /still with/.test(removeOut.error), removeOut);
  check('A tool that is in can be removed', (await svc.removeToolAsset(owner, 't1', drill)).ok && (await tool(drill)).isDeleted === true);
  check('Its history is kept', (await db.toolIssues.where('toolAssetId').equals(drill).count()) === 3);
  check('A removed tool can not be issued', !(await svc.issueTool(owner, 't1', { toolAssetId: drill, quantity: 1, issuedTo: 'Ravi' })).ok);
  check('A removed tool can not be edited back', !(await svc.saveToolAsset(owner, 't1', { id: drill, name: 'Drill', category: 'Power tools', totalQuantity: 1, condition: 'Good' })).ok);
  check('Its name can be used for a new tool', (await svc.saveToolAsset(owner, 't1', { name: 'Drill Machine (Bosch)', category: 'Power tools', totalQuantity: 1, condition: 'Good' })).ok);

  console.log('\n--- 9. Filters ---');
  const all = await Promise.all((await db.toolAssets.where('siteId').equals('t1').filter(x => !x.isDeleted).toArray()).map(x => status(x.id)));
  const count = (f: (typeof tt.TOOL_FILTERS)[number]) => all.filter(s => tt.matchesToolFilter(s, f)).length;
  check('Four filters: All, Issued, Available, Damaged', tt.TOOL_FILTERS.join() === 'all,out,available,damaged');
  check('All counts every tool', count('all') === all.length);
  check('Issued counts tools with someone', count('out') === all.filter(s => s.issued > 0).length && count('out') >= 1);
  check('A tool can be both partly out and partly here', all.some(s => tt.matchesToolFilter(s, 'out') && tt.matchesToolFilter(s, 'available')));

  console.log(`\n✅ Tools workflow: all ${passed} checks passed.\n`);
}

run().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
