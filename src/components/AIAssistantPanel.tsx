import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, X, Mic, MicOff, Send, CheckCircle2, AlertTriangle,
  RotateCcw, Info, HelpCircle, ArrowRight, ShieldAlert,
  Layers, Ruler, Box, DoorOpen, AppWindow, Wrench, BarChart2, Lightbulb
} from 'lucide-react';
import type {
  StrokeClassification,
  CandidateOption,
  PlanDiagnosticIssue,
  PlanAnalysisReport,
  ProposedLayoutResult,
  ValidatedPlanAction,
} from '../services/aiFloorPlanEngine';
import { getAIProvider, type PlanContext, type AICommandResult } from '../services/aiProvider';
import type { FloorPlanUnit } from '../db/types';

export interface AIAssistantHistoryItem {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  canUndo: boolean;
  action?: ValidatedPlanAction;
}

export interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  planContext: PlanContext;
  onExecuteAction: (action: ValidatedPlanAction) => void;
  onUndoLastAction: () => void;
  pendingClassification: StrokeClassification | null;
  onClearPendingClassification: () => void;
  onOpenFixPlanModal?: () => void;
  onOpenAnalyzeModal?: () => void;
  onOpenDesignModal?: () => void;
  onSwitch3D?: () => void;
  onToggleDimensions?: () => void;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  isOpen,
  onClose,
  planContext,
  onExecuteAction,
  onUndoLastAction,
  pendingClassification,
  onClearPendingClassification,
  onOpenFixPlanModal,
  onOpenAnalyzeModal,
  onOpenDesignModal,
  onSwitch3D,
  onToggleDimensions,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; action?: ValidatedPlanAction; clarification?: any }>>([
    {
      sender: 'ai',
      text: 'Hello! I am your AI Architectural Assistant. You can draw freely using AI Draw, or tell me what you want to build.',
    },
  ]);
  const [history, setHistory] = useState<AIAssistantHistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Resize listener for mobile sheet vs desktop panel
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Web Speech API initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Works for Indian English & mixed accents

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        // Automatically handle the voice command
        handleSendCommand(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Scroll to bottom of chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingClassification]);

  const toggleVoiceListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Speech recognition error', err);
        setIsListening(false);
      }
    }
  };

  const handleSendCommand = async (customText?: string) => {
    const cmdText = customText || inputText;
    if (!cmdText.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { sender: 'user', text: cmdText }]);
    setInputText('');
    setIsProcessing(true);

    try {
      const provider = getAIProvider();
      const result: AICommandResult = await provider.interpretCommand(cmdText, planContext);

      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: result.message,
          action: result.action,
          clarification: result.clarificationPrompt,
        },
      ]);

      if (result.action && result.action.action !== 'NOOP') {
        onExecuteAction(result.action);
        recordHistory(`Executed: ${cmdText}`, result.action.description, result.action);
      } else if (result.action && result.action.action === 'SWITCH_VIEW') {
        if (result.action.value === '3D' && onSwitch3D) {
          onSwitch3D();
        }
      } else if (result.action && result.action.payload?.setting === 'showDimensions' && onToggleDimensions) {
        onToggleDimensions();
      }

      if (result.diagnosticReport && onOpenFixPlanModal) {
        onOpenFixPlanModal();
      }
      if (result.metricsReport && onOpenAnalyzeModal) {
        onOpenAnalyzeModal();
      }
      if (result.layoutProposal && onOpenDesignModal) {
        onOpenDesignModal();
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Error processing command: ${err.message || 'Unknown error'}. Drawing tools are still available.`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const recordHistory = (title: string, description: string, action?: ValidatedPlanAction) => {
    setHistory(prev => [
      {
        id: `hist-${Date.now()}`,
        title,
        description,
        timestamp: Date.now(),
        canUndo: true,
        action,
      },
      ...prev.slice(0, 15), // keep last 15
    ]);
  };

  const handleClarificationChoice = (option: CandidateOption | { label: string; action: ValidatedPlanAction }) => {
    if (option.action && option.action.action !== 'NOOP') {
      onExecuteAction(option.action);
      recordHistory(`✓ Interpreted as ${option.label}`, option.action.description, option.action);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Applied: ${option.label} (${option.action.description})`,
        },
      ]);
    }
    onClearPendingClassification();
  };

  if (!isOpen) return null;

  return (
    <aside
      className={`fp-ai-panel ${isMobile ? 'fp-ai-panel-mobile-sheet' : 'fp-ai-panel-desktop'}`}
      role="complementary"
      aria-label="AI Architectural Floor Plan Assistant"
    >
      {/* Panel Header */}
      <div className="fp-ai-panel-header">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              Building Mistry AI
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-medium">
                Ready
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Intelligent Floor Plan Assistant</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Close Assistant Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Actions Carousel / Chips */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => onOpenFixPlanModal && onOpenFixPlanModal()}
          className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
          title="Scan and repair gaps or zig-zag walls"
        >
          <Wrench className="w-3 h-3" />
          Fix My Plan
        </button>

        <button
          onClick={() => onOpenAnalyzeModal && onOpenAnalyzeModal()}
          className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
          title="Calculate verified gross floor area and room schedule"
        >
          <BarChart2 className="w-3 h-3" />
          Analyze Plan
        </button>

        <button
          onClick={() => onOpenDesignModal && onOpenDesignModal()}
          className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
          title="AI House Layout Generator"
        >
          <Lightbulb className="w-3 h-3" />
          Help Me Design
        </button>

        {onSwitch3D && (
          <button
            onClick={onSwitch3D}
            className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors"
          >
            <Box className="w-3 h-3" />
            Switch 3D
          </button>
        )}
      </div>

      {/* Main Panel Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* PENDING CLARIFICATION CARD (Interactive Stroke Feedback) */}
        {pendingClassification && (
          <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  {pendingClassification.isUncertain
                    ? "I'm not completely sure what this is."
                    : `Detected: ${pendingClassification.label}`}
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                {Math.round(pendingClassification.confidence * 100)}% Confidence
              </span>
            </div>

            <p className="text-[12px] text-amber-800 dark:text-amber-300 mb-3 leading-relaxed">
              {pendingClassification.isUncertain
                ? 'What should this rough drawing represent?'
                : pendingClassification.reasoning}
            </p>

            {/* Candidate options buttons */}
            <div className="flex flex-wrap gap-1.5">
              {pendingClassification.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleClarificationChoice(opt)}
                  className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 shadow-sm ${
                    idx === 0
                      ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{opt.label}</span>
                  {idx === 0 && <ArrowRight className="w-3 h-3 ml-0.5" />}
                </button>
              ))}

              <button
                onClick={onClearPendingClassification}
                className="text-[11px] font-medium px-2 py-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Chat / Assistant Conversation Stream */}
        <div className="space-y-2.5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col ${
                m.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] text-[12px] rounded-xl px-3 py-2 leading-relaxed shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {m.text}

                {/* Inline Clarification Prompt if any */}
                {m.clarification && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {m.clarification.question}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {m.clarification.options.map((opt: any, oIdx: number) => (
                        <button
                          key={oIdx}
                          onClick={() => handleClarificationChoice(opt)}
                          className="text-[11px] px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Action History Feed with 1-Click Undo */}
        {history.length > 0 && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Recent AI Actions
              </span>
              <button
                onClick={onUndoLastAction}
                className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                title="Undo last architectural action"
              >
                <RotateCcw className="w-3 h-3" />
                Undo Last
              </button>
            </div>
            <div className="space-y-1.5">
              {history.slice(0, 4).map(h => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="truncate text-slate-700 dark:text-slate-300">{h.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggested Command Chips */}
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {[
          'Make this bedroom',
          'Make this wall 10 feet',
          'Fix my plan',
          'Calculate total floor area',
          'Add door',
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendCommand(chip)}
            className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Box & Voice Mic */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendCommand();
          }}
          className="flex items-center gap-1.5"
        >
          {/* Voice Microphone Button */}
          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoiceListening}
              className={`p-2 rounded-lg border transition-all ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
              title={isListening ? 'Listening... click to stop' : 'Voice command (English / Tamil)'}
            >
              {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={
              isListening ? 'Listening to voice...' : 'Type or draw (e.g. "Make this bedroom", "Fix plan")'
            }
            className="flex-1 text-[12px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            title="Send command"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Architectural Safety Disclaimer */}
        <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1 leading-tight">
          <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
          <span>AI design suggestion — verify with a qualified engineer before construction.</span>
        </div>
      </div>
    </aside>
  );
};
