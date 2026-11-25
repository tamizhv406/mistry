import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('Module 1: Floor Planner Direct Touch Gestures & Floating Precision Toolbar', () => {
  it('TransformBoundingBox supports dashed bounding box and pointer capture handles', () => {
    const filePath = path.resolve('src/views/floorPlan/components/TransformBoundingBox.tsx');
    assert.strictEqual(fs.existsSync(filePath), true);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /strokeDasharray="4 3"/);
    assert.match(content, /setPointerCapture/);
    assert.match(content, /hitR = 16/); // 32px touch target
  });

  it('MobileContextBar provides precision nudge D-pad and dimension steppers', () => {
    const filePath = path.resolve('src/views/floorPlan/components/MobileContextBar.tsx');
    assert.strictEqual(fs.existsSync(filePath), true);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /onNudge/);
    assert.match(content, /onStepDimension/);
    assert.match(content, /position:\s*'fixed'/);
    assert.match(content, /bottom:\s*'12px'/);
    assert.match(content, /details\.dimensions/);
  });
});

describe('Module 2: Tamil Unicode Font Rendering', () => {
  it('index.html preloads Inter and Noto Sans Tamil fonts', () => {
    const filePath = path.resolve('index.html');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /Noto\+Sans\+Tamil/);
    assert.match(content, /Inter/);
  });

  it('src/index.css includes Noto Sans Tamil in the typography stack', () => {
    const filePath = path.resolve('src/index.css');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /Noto Sans Tamil/);
  });
});

describe('Module 3: Zero-Cost Security Auth: Security Questions Account Creation & Password Reset', () => {
  // The local-only ForgotPasswordModal / RegistrationModal kept passwords on the device and
  // let blank recovery answers through; they were removed (security task). Accounts and
  // passwords live in Supabase Auth; the login page keeps the 3 security questions.
  it('Local-password modals are gone', () => {
    assert.strictEqual(fs.existsSync(path.resolve('src/components/ForgotPasswordModal.tsx')), false);
    assert.strictEqual(fs.existsSync(path.resolve('src/components/RegistrationModal.tsx')), false);
  });

  it('Login page keeps 3 security questions and uses Supabase for passwords', () => {
    const content = fs.readFileSync(path.resolve('src/views/LoginView.tsx'), 'utf-8');
    assert.match(content, /What is your name\?/);
    assert.match(content, /requestEmailPasswordReset/);
    assert.doesNotMatch(content, /passwordHash === password/);
  });
});

describe('Module 4: Offline Guest Mode & Cloud Sync Workflow', () => {
  it('App.tsx contains post-authentication local sites merge modal', () => {
    const filePath = path.resolve('src/App.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /local_builder/);
    assert.match(content, /உள்ளூர் திட்டங்கள் கண்டறியப்பட்டன/);
    assert.match(content, /இணைக்கவும் \(Merge Sites\)/);
  });
});

describe('Module 5 & Module 6: Mastri Field Mode & Tamil Nadu Costing Benchmarks & Wage Settlement', () => {
  it('DashboardView provides Mastri Field Mode toggle and 1-click Mark All Present', () => {
    const filePath = path.resolve('src/views/DashboardView.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /மேஸ்திரி ஃபீல்டு மோட்/);
    assert.match(content, /handleMarkAllPresent/);
    assert.match(content, /1-Click Mark All Present/);
    assert.match(content, /டீ \/ ஸ்நாக்ஸ் செலவு/);
  });

  it('DashboardView includes real Tamil Nadu material costing benchmarks (Cement, M-Sand, Bricks, Steel)', () => {
    const filePath = path.resolve('src/views/DashboardView.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /₹400/); // Cement
    assert.match(content, /₹55/);  // M-Sand
    assert.match(content, /₹95/);  // River Sand
    assert.match(content, /₹11/);  // Red Bricks
    assert.match(content, /₹65/);  // Steel
    assert.match(content, /1850/); // Standard TN residential rate
  });

  it('WageSlipModal generates 1-click printable wage slip with gross, advances, and net payout', () => {
    const filePath = path.resolve('src/components/WageSlipModal.tsx');
    assert.strictEqual(fs.existsSync(filePath), true);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /தொழிலாளர் சம்பள பட்டுவாடா ரசீது/);
    assert.match(content, /grossWage/);
    assert.match(content, /totalAdvances/);
    assert.match(content, /netPayable/);
    assert.match(content, /window\.print/);
  });
});
