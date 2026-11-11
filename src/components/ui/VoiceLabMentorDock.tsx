import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, Loader2, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import {
  aiVoiceAssistant,
  VoiceAssistantState,
  SupportedVoiceLocale,
} from '../../services/aiVoiceAssistant';
import { labSound } from '../../utils/soundEngine';

export interface VoiceLabMentorDockProps {
  domain?: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
}

const WAVEFORM_BAR_MULTIPLIERS = [0.45, 0.75, 1.0, 0.85, 0.55];

export const VoiceLabMentorDock: React.FC<VoiceLabMentorDockProps> = ({
  domain = 'Fisika',
}) => {
  const [voiceState, setVoiceState] = useState<VoiceAssistantState>(() =>
    aiVoiceAssistant.getState()
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    const unsub = aiVoiceAssistant.subscribe((nextState) => {
      setVoiceState(nextState);
    });
    return unsub;
  }, []);

  const handleToggleMic = () => {
    aiVoiceAssistant.toggleFullDuplexSession();
    if (!voiceState.fullDuplexEnabled) {
      setIsExpanded(true);
    }
  };

  const handleLocaleSwitch = (locale: SupportedVoiceLocale) => {
    labSound.playClick(680);
    aiVoiceAssistant.setLocale(locale);
  };

  const handleSimulatedVoiceQuery = () => {
    labSound.playClick(720);
    setIsExpanded(true);
    const samplePrompt =
      voiceState.locale === 'en-US'
        ? `Dr. LabMu, how does changing the primary variable in ${domain} affect the linear regression R squared?`
        : `Dokter LabMu, bagaimana pengaruh perubahan variabel bebas pada eksperimen ${domain} terhadap kemiringan kurva regresi saya?`;
    void aiVoiceAssistant.handleUserSpokenPrompt(samplePrompt);
  };

  const statusMeta = (() => {
    switch (voiceState.status) {
      case 'listening':
        return {
          badge: voiceState.locale === 'en-US' ? 'Listening (VAD Active)' : 'Mendengarkan (VAD Aktif)',
          ringClass: 'border-sky-400/80 bg-sky-950/90 text-sky-300 shadow-sky-500/20',
          barColor: 'bg-sky-400',
        };
      case 'thinking':
        return {
          badge: voiceState.locale === 'en-US' ? 'Thinking (Analyzing 3D Data...)' : 'Memproses Data 3D...',
          ringClass: 'border-amber-400/80 bg-amber-950/90 text-amber-300 shadow-amber-500/20',
          barColor: 'bg-amber-400',
        };
      case 'speaking':
        return {
          badge:
            voiceState.locale === 'en-US'
              ? 'Dr. LabMu Speaking (Mic Muted)'
              : 'Dr. LabMu Berbicara (Mic Dijeda)',
          ringClass: 'border-emerald-400/85 bg-emerald-950/90 text-emerald-300 shadow-emerald-500/25',
          barColor: 'bg-emerald-400',
        };
      default:
        return {
          badge: voiceState.locale === 'en-US' ? 'Voice Mentor Standby' : 'Mentor Suara Siaga',
          ringClass: 'border-slate-700/80 bg-slate-900/90 text-slate-300',
          barColor: 'bg-slate-500',
        };
    }
  })();

  return (
    <div
      data-testid="voice-lab-mentor-dock"
      aria-label="Asisten Suara Real-Time Full-Duplex Dr. LabMu"
      className="pointer-events-auto flex flex-col items-end gap-2 select-none"
    >
      {/* Expanded Full-Duplex Transcript & Socratic Guidance Card */}
      {isExpanded && (
        <div className="w-72 sm:w-80 rounded-2xl bg-slate-950/95 border border-slate-700/80 p-3.5 shadow-2xl text-xs text-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-white truncate">
                Dr. LabMu Full-Duplex
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-sky-300">
                VAD
              </span>
            </div>

            <div className="flex items-center gap-1">
              <div
                role="group"
                aria-label="Bahasa Suara STT/TTS"
                className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[10px] font-mono"
              >
                <button
                  type="button"
                  onClick={() => handleLocaleSwitch('id-ID')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    voiceState.locale === 'id-ID'
                      ? 'bg-sky-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => handleLocaleSwitch('en-US')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    voiceState.locale === 'en-US'
                      ? 'bg-sky-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Sembunyikan Panel Transkrip Suara"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Status & Anti-Feedback Indicator */}
          <div className="flex items-center justify-between text-[11px] bg-slate-900/90 rounded-lg px-2.5 py-1.5 border border-slate-800">
            <span className="font-medium text-slate-300">{statusMeta.badge}</span>
            <span className="font-mono text-[10px] text-slate-400">
              {voiceState.isMicMutedForTTS ? 'Anti-Loop: Aktif' : 'Duplex: Siap'}
            </span>
          </div>

          {/* Student Live Transcript */}
          {(voiceState.interimTranscript || voiceState.lastUserTranscript) && (
            <div className="rounded-lg bg-slate-900/70 border border-slate-800/80 px-2.5 py-1.5 text-[11px]">
              <span className="text-[10px] uppercase tracking-wider font-mono text-sky-400 block mb-0.5">
                {voiceState.locale === 'en-US' ? 'Student Voice:' : 'Suara Siswa:'}
              </span>
              <p className="text-slate-200 italic">
                "{voiceState.interimTranscript || voiceState.lastUserTranscript}"
              </p>
            </div>
          )}

          {/* Mentor Socratic Spoken Guidance */}
          <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/25 px-2.5 py-2 text-[11px] leading-relaxed">
            <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-400 block mb-0.5">
              {voiceState.locale === 'en-US' ? 'Dr. LabMu Guidance:' : 'Bimbingan Lisan Dr. LabMu:'}
            </span>
            <p className="text-slate-200 line-clamp-4">{voiceState.lastMentorReply}</p>
          </div>

          {/* Quick Test Socratic Voice Prompt Button */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleSimulatedVoiceQuery}
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {voiceState.locale === 'en-US'
                  ? 'Simulate Voice Question'
                  : 'Simulasi Tanya Lisan'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Circular Audio Visualizer & Full-Duplex Control Pill */}
      <div className="flex items-center gap-1.5 rounded-full bg-slate-950/95 border border-slate-700/80 p-1.5 pr-3 shadow-xl">
        {/* Circular Reactive Waveform Visualizer Button */}
        <button
          type="button"
          onClick={handleToggleMic}
          aria-label={
            voiceState.fullDuplexEnabled
              ? 'Matikan Asisten Suara Full-Duplex Dr. LabMu'
              : 'Aktifkan Asisten Suara Full-Duplex Dr. LabMu'
          }
          className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shadow-lg ${statusMeta.ringClass}`}
        >
          {/* Thinking State: Rotating Orbit Ring */}
          {voiceState.status === 'thinking' && (
            <span
              data-testid="voice-thinking-orbit"
              className="pointer-events-none absolute -inset-1 rounded-full border-2 border-transparent border-t-amber-400 border-r-sky-400 animate-spin"
            />
          )}

          {/* Speaking State: Glowing Outer Halo */}
          {voiceState.status === 'speaking' && (
            <span
              data-testid="voice-speaking-halo"
              className="pointer-events-none absolute -inset-1 rounded-full border border-emerald-400/60"
            />
          )}

          {voiceState.status === 'thinking' ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
          ) : voiceState.status === 'speaking' ? (
            <Volume2 className="w-4 h-4 text-emerald-300" />
          ) : voiceState.fullDuplexEnabled ? (
            <Mic className="w-4 h-4 text-sky-300" />
          ) : (
            <MicOff className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Reactive Audio Waveform Bars */}
        <div
          data-testid="voice-waveform-bars"
          aria-hidden="true"
          className="flex items-center gap-0.5 h-6 px-1"
        >
          {WAVEFORM_BAR_MULTIPLIERS.map((mult, idx) => {
            const activeEnergy =
              voiceState.status === 'speaking'
                ? 0.85
                : voiceState.status === 'thinking'
                  ? 0.55
                  : voiceState.status === 'listening'
                    ? Math.max(0.3, voiceState.audioEnergy)
                    : 0.18;
            const heightPx = Math.max(4, Math.min(22, Math.round(activeEnergy * mult * 22)));
            return (
              <span
                key={idx}
                style={{ height: `${heightPx}px` }}
                className={`w-1 rounded-full transition-all duration-150 ${statusMeta.barColor}`}
              />
            );
          })}
        </div>

        {/* Status Text & Expand Toggle */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick(600);
            setIsExpanded((prev) => !prev);
          }}
          className="flex items-center gap-1.5 text-left cursor-pointer group"
        >
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-white leading-tight group-hover:text-sky-300 transition-colors">
              Suara Dr. LabMu
            </span>
            <span className="text-[10px] font-mono text-slate-400 leading-tight">
              {statusMeta.badge}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
          )}
        </button>
      </div>
    </div>
  );
};
