import React, { useState } from 'react';
import { Mic, MicOff, Check, X, Sparkles } from 'lucide-react';
import { startVoiceRecognition, isSpeechRecognitionSupported } from '../utils/voiceParser';

interface VoiceInputFieldProps {
  label: string;
  tamilLabel?: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: 'text' | 'number' | 'textarea';
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export const VoiceInputField: React.FC<VoiceInputFieldProps> = ({
  label,
  tamilLabel,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  rows = 3,
  className = '',
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleStartVoice = () => {
    if (!isSpeechRecognitionSupported()) {
      setFeedback('Microphone not supported on this browser');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    if (isListening) return;

    setIsListening(true);
    setPendingTranscript(null);
    setFeedback('Listening... Speak naturally 🎙️');

    startVoiceRecognition({
      onResult: (transcript: string) => {
        setIsListening(false);
        setFeedback(null);

        if (type === 'number') {
          const numMatch = transcript.match(/\d+(?:\.\d+)?/);
          const cleanNum = numMatch ? numMatch[0] : transcript;
          setPendingTranscript(cleanNum);
          onChange(cleanNum);
        } else {
          setPendingTranscript(transcript);
          onChange(transcript);
        }
      },
      onError: (err: string) => {
        setIsListening(false);
        setFeedback(err || 'Could not hear clearly. Tap mic to retry.');
        setTimeout(() => setFeedback(null), 3500);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <span>{label}</span>
          {tamilLabel && (
            <span className="text-[11px] font-normal text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
              {tamilLabel}
            </span>
          )}
          {required && <span className="text-rose-400 font-bold">*</span>}
        </label>
        {feedback && (
          <span className="text-[11px] text-amber-300 animate-pulse font-medium">
            {feedback}
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        {type === 'textarea' ? (
          <textarea
            value={value}
            onChange={e => {
              onChange(e.target.value);
              setPendingTranscript(null);
            }}
            placeholder={placeholder}
            required={required}
            rows={rows}
            disabled={disabled}
            className="w-full bg-slate-800/90 border border-slate-700/90 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 transition-all resize-none pr-12"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={e => {
              onChange(e.target.value);
              setPendingTranscript(null);
            }}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className="w-full bg-slate-800/90 border border-slate-700/90 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 transition-all pr-12"
          />
        )}

        {/* Large Touch-Target Microphone Button (min 42x42px on mobile) */}
        <button
          type="button"
          onClick={handleStartVoice}
          title={`Tap to speak ${label} by voice`}
          aria-label={`Voice input for ${label}`}
          disabled={disabled}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl transition-all ${
            isListening
              ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40 ring-4 ring-rose-500/20'
              : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700/60 active:scale-95'
          }`}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-amber-400" />}
        </button>
      </div>

      {/* Voice Recognition Value Verification Preview Badge */}
      {pendingTranscript && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs">
          <div className="flex items-center gap-1.5 overflow-hidden text-amber-200">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
            <span className="truncate">
              Recognized: <strong>"{pendingTranscript}"</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPendingTranscript(null)}
            className="text-amber-400 hover:text-amber-200 p-0.5"
            title="Dismiss preview"
            aria-label="Confirm recognized value"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
