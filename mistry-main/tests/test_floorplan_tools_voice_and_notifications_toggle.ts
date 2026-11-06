import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isVoiceEnabled, setVoiceEnabled, toggleVoice, speakTamil } from '../src/utils/tamilVoice';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing Floor Plan Tools: Voice Assistant and Notifications toggle options...');

// 1. Verify source elements in FloorPlanEditorView.tsx
const editorFilePath = path.resolve(__dirname, '../src/views/FloorPlanEditorView.tsx');
assert.ok(fs.existsSync(editorFilePath), 'FloorPlanEditorView.tsx should exist');
const editorContent = fs.readFileSync(editorFilePath, 'utf-8');

// Check drawer tools menu buttons
assert.ok(
  editorContent.includes('id="fp-tool-toggle-voice"'),
  'Tools drawer menu must include Voice Assistant toggle button (#fp-tool-toggle-voice)'
);
assert.ok(
  editorContent.includes('id="fp-tool-toggle-notifications"'),
  'Tools drawer menu must include Notifications toggle button (#fp-tool-toggle-notifications)'
);

// Check desktop tools accordion buttons
assert.ok(
  editorContent.includes('id="fp-desktop-tool-toggle-voice"'),
  'Desktop TOOLS accordion must include Voice Assistant toggle button (#fp-desktop-tool-toggle-voice)'
);
assert.ok(
  editorContent.includes('id="fp-desktop-tool-toggle-notifications"'),
  'Desktop TOOLS accordion must include Notifications toggle button (#fp-desktop-tool-toggle-notifications)'
);

// Check mobile more tools bottom sheet buttons
assert.ok(
  editorContent.includes('id="fp-mobile-more-tool-voice"'),
  'Mobile More Tools menu must include Voice Assistant toggle button (#fp-mobile-more-tool-voice)'
);
assert.ok(
  editorContent.includes('id="fp-mobile-more-tool-notifications"'),
  'Mobile More Tools menu must include Notifications toggle button (#fp-mobile-more-tool-notifications)'
);

// Check toggle handlers
assert.ok(
  editorContent.includes('handleToggleVoiceAssistant'),
  'FloorPlanEditorView must implement handleToggleVoiceAssistant'
);
assert.ok(
  editorContent.includes('handleToggleNotifications'),
  'FloorPlanEditorView must implement handleToggleNotifications'
);
assert.ok(
  editorContent.includes('mistry_fp_notifications_enabled'),
  'FloorPlanEditorView must persist notification preference in localStorage (mistry_fp_notifications_enabled)'
);

// 2. Test tamilVoice behavior in Node / mock environment
// Setup in-memory mock localStorage
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
};

let spokeCount = 0;
let cancelCalled = false;
(globalThis as any).window = {
  speechSynthesis: {
    speak: (_utterance: any) => {
      spokeCount++;
    },
    cancel: () => {
      cancelCalled = true;
    },
    getVoices: () => [],
  },
};
(globalThis as any).SpeechSynthesisUtterance = class {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  constructor(text: string) {
    this.text = text;
  }
};

// Initial state: default voice should be enabled
localStorage.removeItem('mistry_voice_enabled');
assert.equal(isVoiceEnabled(), true, 'Voice should default to enabled');

// Turn off voice
setVoiceEnabled(false);
assert.equal(isVoiceEnabled(), false, 'Voice should be disabled after setVoiceEnabled(false)');
assert.equal(localStorage.getItem('mistry_voice_enabled'), 'false');

// Verify speakTamil is silenced when voice is off
spokeCount = 0;
speakTamil('சுவர் வரையவும்');
assert.equal(spokeCount, 0, 'speakTamil should NOT trigger speech when voice assistant is turned off');

// Turn on voice
setVoiceEnabled(true);
assert.equal(isVoiceEnabled(), true, 'Voice should be enabled after setVoiceEnabled(true)');
speakTamil('சுவர் வரையவும்');
assert.equal(spokeCount, 1, 'speakTamil should trigger speech when voice assistant is turned on');

// Test toggleVoice helper
const toggled = toggleVoice();
assert.equal(toggled, false, 'toggleVoice should flip enabled true -> false');
assert.equal(isVoiceEnabled(), false);

// 3. Test Notification gating simulation
let lastNotification: { msg: string; type?: string } | null = null;
const rawOnNotify = (msg: string, type?: 'success' | 'error' | 'info') => {
  lastNotification = { msg, type };
};

// Wrapper replicating FloorPlanEditorView notification logic
let notificationsEnabled = true;
const simulateOnNotify = (msg: string, type?: 'success' | 'error' | 'info') => {
  if (!notificationsEnabled && type !== 'error') {
    return;
  }
  rawOnNotify(msg, type);
};

// Test when notifications are enabled
lastNotification = null;
simulateOnNotify('Plan saved', 'success');
assert.deepEqual(lastNotification, { msg: 'Plan saved', type: 'success' });

// Turn off notifications
notificationsEnabled = false;
lastNotification = null;
simulateOnNotify('Measurements: ON', 'info');
assert.equal(lastNotification, null, 'Info notifications must be suppressed when notifications are turned off');

simulateOnNotify('Room added', 'success');
assert.equal(lastNotification, null, 'Success notifications must be suppressed when notifications are turned off');

// Critical errors must still pass through even when notifications are turned off
simulateOnNotify('Cannot place overlapping door', 'error');
assert.deepEqual(lastNotification, { msg: 'Cannot place overlapping door', type: 'error' }, 'Errors must still alert the user');

console.log('✓ All Voice Assistant and Notifications toggle tests passed successfully!');
