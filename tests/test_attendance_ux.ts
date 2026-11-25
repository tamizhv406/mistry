/**
 * Attendance (Task 6): one-tap cycle, long-press statuses, "Mark all present" that never
 * overwrites a saved mark, the salary formula unchanged (1 / 0.5 / 1.5 / leave by project rule),
 * past-date corrections with a correction log, and phone/desktop using the same services.
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import type { LabourWorker, Site, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u-att', username: 'mestri', fullName: 'Velu Mestri', mobile: '', email: 'v@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };

async function run() {
  const { db } = await import('../src/db/db');
  const svc = await import('../src/services/records');
  const sal = await import('../src/domain/salary');
  const { todayKey, addDays } = await import('../src/utils/datetime');
  await db.open();
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const site: Site = {
    id: 'att1', userId: owner.id, name: 'Velachery House', ownerName: 'A', ownerPhone: '', address: '', area: '', buildingType: 'House',
    startDate: '2026-09-01', expectedCompletionDate: '2027-03-01', status: 'Active', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  };
  await db.sites.put(site);
  const workers: LabourWorker[] = Array.from({ length: 20 }, (_, i) => ({
    id: `w${String(i + 1).padStart(2, '0')}`, siteId: 'att1', userId: owner.id, name: `Worker ${i + 1}`, phone: '', category: i % 3 ? 'SITHAAL' : 'MISTRY',
    dailyWage: 1000, joiningDate: '2026-09-01', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  }));
  await db.workers.bulkPut(workers);
  const statusOn = async (workerId: string, date: string) =>
    (await db.attendance.where('workerId').equals(workerId).filter(a => !a.isDeleted && a.date === date).first())?.status;

  console.log('\n--- 1. One tap cycles; long press offers the rest ---');
  check('Not marked → Present → Half Day → Absent → Present',
    sal.nextTapStatus(undefined) === 'present' && sal.nextTapStatus('present') === 'half_day' && sal.nextTapStatus('half_day') === 'absent' && sal.nextTapStatus('absent') === 'present');
  check('Overtime and Leave go back to Present on the next tap', sal.nextTapStatus('overtime') === 'present' && sal.nextTapStatus('leave') === 'present');
  check('Long press menu has Overtime and Leave (and the others)', ['overtime', 'leave', 'present', 'half_day', 'absent'].every(s => sal.LONG_PRESS_STATUSES.includes(s as never)) && sal.LONG_PRESS_STATUSES[0] === 'overtime');
  check('Hold time 450–500 ms; moving the finger cancels it (scrolling never opens it)', sal.LONG_PRESS_MS >= 450 && sal.LONG_PRESS_MS <= 500 && sal.LONG_PRESS_SLOP > 0 && sal.LONG_PRESS_SLOP <= 16);

  console.log('\n--- 2. "Mark all present" for 20 workers ---');
  await svc.markAttendance(owner, 'att1', workers[0], today, 'absent');
  await svc.markAttendance(owner, 'att1', workers[1], today, 'half_day');
  await svc.markAttendance(owner, 'att1', workers[2], today, 'overtime');
  const t0 = Date.now();
  const all = await svc.markAllPresent(owner, 'att1', workers, today);
  check('One tap marks the 17 not yet marked, keeps the 3 already marked', all.ok && all.value.marked === 17 && all.value.kept === 3 && all.value.failed === 0, all);
  check('…Absent, Half Day and Overtime are not overwritten',
    (await statusOn('w01', today)) === 'absent' && (await statusOn('w02', today)) === 'half_day' && (await statusOn('w03', today)) === 'overtime');
  check('Everyone has exactly one mark today', (await db.attendance.where('siteId').equals('att1').filter(a => !a.isDeleted && a.date === today).count()) === 20);
  const again = await svc.markAllPresent(owner, 'att1', workers, today);
  check('Pressing it again changes nothing', again.ok && again.value.marked === 0 && again.value.kept === 20);
  // Then tap the few who are different: Worker 4 → Half Day (2 taps from Present: Present → Half Day).
  await svc.markAttendance(owner, 'att1', workers[3], today, sal.nextTapStatus(await statusOn('w04', today)));
  await svc.markAttendance(owner, 'att1', workers[4], today, sal.nextTapStatus(sal.nextTapStatus(await statusOn('w05', today))));
  check('Taps set the exceptions (Half Day, Absent)', (await statusOn('w04', today)) === 'half_day' && (await statusOn('w05', today)) === 'absent');
  check('20 workers done in well under a minute', Date.now() - t0 < 10_000, Date.now() - t0);
  const plan = sal.planMarkAllPresent(workers, await db.attendance.toArray(), yesterday);
  check('For another day the plan starts fresh (all 20 to mark)', plan.toMark.length === 20 && plan.kept.length === 0);

  console.log('\n--- 3. Salary formula unchanged ---');
  const fiveDays = [addDays(today, -6), addDays(today, -5), addDays(today, -4), addDays(today, -3), addDays(today, -2)];
  const statuses = ['present', 'half_day', 'overtime', 'absent', 'leave'] as const;
  for (let i = 0; i < 5; i++) await svc.markAttendance(owner, 'att1', workers[19], fiveDays[i], statuses[i]);
  const w20 = (await db.attendance.where('workerId').equals('w20').filter(a => !a.isDeleted && fiveDays.includes(a.date)).toArray());
  check('Stored day values: Present 1, Half Day 0.5, Overtime 1.5, Absent 0, Leave 0',
    statuses.every(s => w20.find(a => a.status === s)?.dayMultiplier === ({ present: 1, half_day: 0.5, overtime: 1.5, absent: 0, leave: 0 } as const)[s]));
  const unpaid = sal.buildWorkerLedger(workers[19], w20, [], [], { leavePaid: false });
  const paid = sal.buildWorkerLedger(workers[19], w20, [], [], { leavePaid: true });
  check('₹1,000/day: 1 + 0.5 + 1.5 + 0 = 3 days = ₹3,000 when leave is unpaid', unpaid.earned === 3000 && unpaid.workedDayEquivalents === 3, unpaid.earned);
  check('…and leave adds a full day (₹4,000) when the project pays leave', paid.earned === 4000, paid.earned);

  console.log('\n--- 4. Past-date corrections and the correction log ---');
  await svc.markAttendance(owner, 'att1', workers[5], yesterday, 'present');
  const fix = await svc.markAttendance(owner, 'att1', workers[5], yesterday, 'absent', undefined, 'Left before lunch');
  const rec = fix.ok ? fix.value : undefined;
  const edit = rec?.editHistory?.at(-1);
  check('Yesterday can be corrected', fix.ok && rec?.status === 'absent' && rec.dayMultiplier === 0);
  check('The change is kept: who, when, old → new, reason', !!edit && edit.from === 'present' && edit.to === 'absent' && edit.by === owner.id && edit.byName === 'Velu Mestri' && edit.reason === 'Left before lunch' && !!edit.at, edit);
  const logs = await db.activityLogs.where('siteId').equals('att1').toArray();
  check('…and noted in the project activity log', logs.some(l => l.action === 'ATTENDANCE_CORRECTED' && l.description.includes('Worker 6') && l.description.includes(yesterday) && l.description.includes('Left before lunch')));
  check('Re-saving the same status adds no correction', (await svc.markAttendance(owner, 'att1', workers[5], yesterday, 'absent')).ok &&
    ((await db.attendance.get(rec!.id))?.editHistory?.length === 1));
  await svc.markAttendance(owner, 'att1', workers[6], yesterday, 'half_day');
  const cleared = await svc.clearAttendance(owner, 'att1', workers[6].id, yesterday, 'Marked on the wrong worker');
  check('Clearing a mark works and the day shows as not marked', cleared.ok && (await statusOn('w07', yesterday)) === undefined);
  const log = sal.buildCorrectionLog(await db.attendance.where('siteId').equals('att1').toArray(), workers);
  const clearEntry = log.find(e => e.workerId === 'w07');
  check('The clearing is in the correction log too (removed marks included)', clearEntry?.from === 'half_day' && clearEntry.to === 'cleared' && clearEntry.reason === 'Marked on the wrong worker' && sal.correctionStatusLabel('cleared') === 'Not marked', clearEntry);
  check('Correction log: newest first, with worker names and the day', log.length >= 4 && log.every((e, i) => i === 0 || log[i - 1].at >= e.at) && log.some(e => e.workerName === 'Worker 6' && e.date === yesterday));
  check('Today\'s taps that change a saved mark are logged too (Worker 4: Present → Half Day)', log.some(e => e.workerId === 'w04' && e.from === 'present' && e.to === 'half_day'));
  const future = await svc.markAttendance(owner, 'att1', workers[0], addDays(today, 1), 'present');
  check('A future date is refused', !future.ok);
  const futureAll = await svc.markAllPresent(owner, 'att1', workers, addDays(today, 1));
  check('…for "Mark all present" too', !futureAll.ok);

  console.log('\n--- 5. Phone and desktop use the same services; no salary on the attendance list ---');
  const src = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  const phone = src('src/views/mobile/LabourView.tsx');
  const desk = src('src/views/AttendanceSalaryView.tsx');
  const matrix = src('src/components/attendance/AttendanceMatrix.tsx');
  const dash = src('src/views/DashboardView.tsx');
  check('Phone screen marks through markAttendance / markAllPresent / clearAttendance', /markAttendance\(/.test(phone) && /markAllPresent\(/.test(phone) && /clearAttendance\(/.test(phone) && phone.includes('nextTapStatus('));
  check('Desktop screen, matrix and dashboard use the same markAllPresent', /markAllPresent\(/.test(desk) && /markAllPresent\(/.test(matrix) && /markAllPresent\(/.test(dash) && !/db\.attendance\.add\(/.test(dash));
  check('Both show the same correction log (buildCorrectionLog)', phone.includes('buildCorrectionLog(') && src('src/components/attendance/CorrectionLog.tsx').includes('buildCorrectionLog(') && desk.includes('<CorrectionLog'));
  const app = src('src/App.tsx');
  check('Phones open the one-tap screen; wider screens the desktop one', app.includes("currentView === 'labour' && isPhone && projectSiteId") && app.includes('<LabourView'));
  const rowJsx = phone.slice(phone.indexOf('className="att-row"'), phone.indexOf('rows.length === 0'));
  check('Attendance rows show no wage, salary or advance', rowJsx.length > 200 && !/formatINR|dailyWage|pending|advance/i.test(rowJsx));
  check('Each row: avatar + name (opens profile), status button (tap / hold), ⋯ menu button',
    rowJsx.includes('att-avatar') && rowJsx.includes('onOpenWorker(') && rowJsx.includes('<StatusButton') && rowJsx.includes('att-more'));
  check('Long press uses pointer events with a timer and a move tolerance, plus right-click', phone.includes('onPointerDown') && phone.includes('LONG_PRESS_MS') && phone.includes('LONG_PRESS_SLOP') && phone.includes('onContextMenu'));
  check('Date strip: Today, Yesterday, any past date; search; mark all', phone.includes("t('at_today'") && phone.includes("t('at_yesterday'") && phone.includes('type="date"') && phone.includes('<SearchBox') && phone.includes("t('at_mark_all'"));
  const profile = src('src/views/mobile/WorkerProfileView.tsx');
  check('Worker profile has the money: wage, earned, advances, pending, pay salary, advance, wage slip, remove, corrections',
    ['per day', 'Wages earned', 'Advances to deduct', 'Pay salary', 'Advance', 'Wage slip', 'Remove worker', 'Attendance corrections', 'buildCorrectionLog('].every(k => profile.includes(k)));

  console.log(`\n✅ Attendance UX: all ${passed} checks passed.\n`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
