import assert from 'node:assert/strict';
import { isVoiceEnabled, setVoiceEnabled, toggleVoice, speakTamil } from '../src/utils/tamilVoice';

console.log('Testing Tamil voice assistant toggle...');

// Test tamilVoice behavior in Node / mock environment
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

console.log('✓ All Tamil voice toggle tests passed successfully!');
