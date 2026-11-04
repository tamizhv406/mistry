/**
 * Tamil Voice Guidance & Audio Assistant for Building Mistry
 * Helps field mistries, masons and workers understand actions without reading complex English text.
 */

const VOICE_PREF_KEY = 'mistry_voice_enabled';

export function isVoiceEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const stored = localStorage.getItem(VOICE_PREF_KEY);
  return stored !== 'false'; // Default to enabled for assisted experience
}

export function setVoiceEnabled(enabled: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VOICE_PREF_KEY, enabled ? 'true' : 'false');
  }
}

export function toggleVoice(): boolean {
  const current = isVoiceEnabled();
  const next = !current;
  setVoiceEnabled(next);
  if (next) {
    speakTamil('குரல் உதவி ஆன் செய்யப்பட்டது'); // "Voice guidance enabled"
  }
  return next;
}

/**
 * Speaks a phrase in natural Tamil using the device SpeechSynthesis engine
 */
export function speakTamil(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!isVoiceEnabled()) return;

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech immediately

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ta-IN';
    utterance.rate = 0.92; // Slightly measured pace for clear field audibility
    utterance.pitch = 1.0;

    // Pick a Tamil voice if available in the browser voice list
    const voices = window.speechSynthesis.getVoices();
    const tamilVoice = voices.find(v => v.lang.startsWith('ta') || v.name.toLowerCase().includes('tamil'));
    if (tamilVoice) {
      utterance.voice = tamilVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.debug('Speech synthesis error:', err);
  }
}

