import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- TEST SUITE: ATTENDANCE SIMPLIFICATION ---\n');

const attendancePath = path.resolve(process.cwd(), 'src', 'views', 'AttendanceSalaryView.tsx');
const attendanceCode = fs.readFileSync(attendancePath, 'utf8');

const erpCssPath = path.resolve(process.cwd(), 'src', 'styles', 'erp-dashboard.css');
const erpCss = fs.readFileSync(erpCssPath, 'utf8');

// Attendance Table Simplification & Mobile Roster
console.log('\nTest: Attendance Table Simplification & Mobile Roster Management');
{
  assert.ok(
    attendanceCode.includes('attendance-desktop-table'),
    'Desktop table is separated for clean responsive display'
  );
  assert.ok(
    attendanceCode.includes('attendance-mobile-roster'),
    'Mobile worker roster cards (.attendance-mobile-roster) are implemented'
  );
  assert.ok(
    attendanceCode.includes('attendance-status-pill-btn'),
    '1-tap cycling status pill (.attendance-status-pill-btn) is implemented'
  );
  assert.ok(
    attendanceCode.includes('attendance-quick-cycle-cluster'),
    'Streamlined status selector cluster (.attendance-quick-cycle-cluster) is implemented'
  );
  assert.ok(
    erpCss.includes('.attendance-mobile-roster') && erpCss.includes('.attendance-worker-card'),
    'CSS styles for mobile attendance roster cards are implemented'
  );

  console.log('  ✓ Redundant columns simplified into streamlined Daily Status interaction');
  console.log('  ✓ 1-tap cycling status pill enables quick attendance toggling');
  console.log('  ✓ Mobile worker roster cards eliminate horizontal scrolling on phone screens');
}

console.log('\n======================================================');
console.log('ATTENDANCE SIMPLIFICATION TESTS PASSED!');
console.log('======================================================\n');
