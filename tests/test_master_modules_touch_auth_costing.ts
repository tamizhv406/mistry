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
  it('ForgotPasswordModal exists with zero SMS cost security questions challenge', () => {
    const filePath = path.resolve('src/components/ForgotPasswordModal.tsx');
    assert.strictEqual(fs.existsSync(filePath), true);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /உங்களின் முதல் பள்ளி எது/);
    assert.match(content, /உங்களுக்கு பிடித்த ஊர் எது/);
    assert.match(content, /உங்கள் தாயாரின் பெயர் என்ன/);
    assert.match(content, /தவறான பதில்கள்\. மீண்டும் முயற்சிக்கவும்/);
  });

  it('RegistrationModal exists with 3 security question dropdowns in Tamil and English', () => {
    const filePath = path.resolve('src/components/RegistrationModal.tsx');
    assert.strictEqual(fs.existsSync(filePath), true);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /SECURITY_QUESTIONS_1/);
    assert.match(content, /SECURITY_QUESTIONS_2/);
    assert.match(content, /SECURITY_QUESTIONS_3/);
    assert.match(content, /புதிய கணக்கு பதிவு/);
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
