import React, { useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
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
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleStartVoice = () => {
    if (!isSpeechRecognitionSupported()) {
      setFeedback('Microphone not supported on this browser');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    if (isListening) return;

    setIsListening(true);
    setFeedback('Listening... Speak now 🎙️');

    startVoiceRecognition({
      onResult: (transcript: string) => {
        setIsListening(false);
        setFeedback(`Heard: "${transcript}"`);
        setTimeout(() => setFeedback(null), 2500);

        if (type === 'number') {
          // Extract first digits
          const numMatch = transcript.match(/\d+(?:\.\d+)?/);
          if (numMatch) {
            onChange(numMatch[0]);
          } else {
            onChange(transcript);
          }
        } else {
          // For text, if existing value, can either replace or append
          onChange(transcript);
        }
      },
      onError: (err: string) => {
        setIsListening(false);
        setFeedback(err || 'Could not hear clearly. Try again.');
        setTimeout(() => setFeedback(null), 3000);
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
          {required && <span className="text-rose-400">*</span>}
        </label>
        {feedback && (
          <span className="text-[10px] text-amber-300 animate-pulse font-medium">
            {feedback}
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        {type === 'textarea' ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            rows={rows}
            disabled={disabled}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none pr-10"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all pr-10"
          />
        )}

        <button
          type="button"
          onClick={handleStartVoice}
          title="Speak by voice (Tamil / English)"
          aria-label={`Voice input for ${label}`}
          disabled={disabled}
          className={`absolute right-2 top-2 p-1.5 rounded-lg transition-all ${
            isListening
              ? 'bg-rose-500 text-white animate-bounce shadow-lg shadow-rose-500/30'
              : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700/50'
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
