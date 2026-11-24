import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, Loader2, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';
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
          ringClass: 'border-sky-500/70 bg-sky-500/15 text-sky-700 dark:text-sky-300 shadow-xs',
          barColor: 'bg-sky-500 dark:bg-sky-400',
        };
      case 'thinking':
        return {
          badge: voiceState.locale === 'en-US' ? 'Thinking (Analyzing 3D Data...)' : 'Memproses Data 3D...',
          ringClass: 'border-amber-500/70 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs',
          barColor: 'bg-amber-500 dark:bg-amber-400',
        };
      case 'speaking':
        return {
          badge:
            voiceState.locale === 'en-US'
              ? 'Dr. LabMu Speaking (Mic Muted)'
              : 'Dr. LabMu Berbicara (Mic Dijeda)',
          ringClass: 'border-emerald-500/75 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-xs',
          barColor: 'bg-emerald-500 dark:bg-emerald-400',
        };
      default:
        return {
          badge: voiceState.locale === 'en-US' ? 'Voice Mentor Standby' : 'Mentor Suara Siaga',
          ringClass: 'border-[var(--comfort-hud-border)] bg-[var(--comfort-hud-surface)] text-[var(--comfort-hud-muted)]',
          barColor: 'bg-[var(--comfort-hud-muted)]',
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
        <div className="w-72 sm:w-80 rounded-2xl studio-hud-surface border p-3.5 shadow-2xl text-xs text-[var(--comfort-hud-text)] space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--comfort-hud-border)] pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-[var(--comfort-hud-text)] truncate">
                Dr. LabMu Full-Duplex
              </span>
              <span className="px-1.5 py-0.5 rounded studio-hud-subcard border text-2xs font-mono text-sky-700 dark:text-sky-300">
                VAD
              </span>
            </div>

            <div className="flex items-center gap-1">
              <div
                role="group"
                aria-label="Bahasa Suara STT/TTS"
                className="flex items-center rounded-lg studio-hud-subcard border p-0.5 text-2xs font-mono"
              >
                <button
                  type="button"
                  onClick={() => handleLocaleSwitch('id-ID')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    voiceState.locale === 'id-ID'
                      ? 'bg-sky-600 text-white font-bold'
                      : 'text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
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
                      : 'text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
                  }`}
                >
                  EN
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Sembunyikan Panel Transkrip Suara"
                className="p-1 rounded-lg text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)] cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Status & Anti-Feedback Indicator */}
          <div className="flex items-center justify-between text-2xs studio-hud-subcard rounded-lg px-2.5 py-1.5 border">
            <span className="font-medium text-[var(--comfort-hud-text)]">{statusMeta.badge}</span>
            <span className="font-mono text-2xs text-[var(--comfort-hud-muted)]">
              {voiceState.isMicMutedForTTS ? 'Anti-Loop: Aktif' : 'Duplex: Siap'}
            </span>
          </div>

          {/* Student Live Transcript */}
          {(voiceState.interimTranscript || voiceState.lastUserTranscript) && (
            <div className="rounded-lg studio-hud-subcard border px-2.5 py-1.5 text-2xs">
              <span className="text-2xs uppercase tracking-wider font-mono text-sky-700 dark:text-sky-400 block mb-0.5">
                {voiceState.locale === 'en-US' ? 'Student Voice:' : 'Suara Siswa:'}
              </span>
              <p className="text-[var(--comfort-hud-text)] italic">
                &ldquo;{voiceState.interimTranscript || voiceState.lastUserTranscript}&rdquo;
              </p>
            </div>
          )}

          {/* Mentor Socratic Spoken Guidance */}
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-2 text-2xs leading-relaxed">
            <span className="text-2xs uppercase tracking-wider font-mono text-emerald-700 dark:text-emerald-400 block mb-0.5">
              {voiceState.locale === 'en-US' ? 'Dr. LabMu Guidance:' : 'Bimbingan Lisan Dr. LabMu:'}
            </span>
            <p className="text-[var(--comfort-hud-text)] line-clamp-4">{voiceState.lastMentorReply}</p>
          </div>

          {/* Quick Test Socratic Voice Prompt Button */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleSimulatedVoiceQuery}
              className="flex-1 px-2.5 py-1.5 rounded-lg studio-hud-subcard border hover:border-sky-500/50 text-sky-700 dark:text-sky-300 font-semibold text-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>
                {voiceState.locale === 'en-US'
                  ? 'Simulate Voice Question'
                  : 'Simulasi Tanya Lisan'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Circular Audio Visualizer & Full-Duplex Control Dock */}
      <div className="flex items-center gap-1.5 rounded-full studio-hud-surface border p-1.5 pr-3 shadow-xl">
        {/* Circular Reactive Waveform Visualizer Button */}
        <button
          type="button"
          onClick={handleToggleMic}
          aria-label={
            voiceState.fullDuplexEnabled
              ? 'Matikan Asisten Suara Full-Duplex Dr. LabMu'
              : 'Aktifkan Asisten Suara Full-Duplex Dr. LabMu'
          }
          className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${statusMeta.ringClass}`}
        >
          {/* Thinking State: Rotating Orbit Ring */}
          {voiceState.status === 'thinking' && (
            <span
              data-testid="voice-thinking-orbit"
              className="pointer-events-none absolute -inset-1 rounded-full border-2 border-transparent border-t-amber-400 border-r-sky-400 animate-spin"
            />
          )}

          {/* Speaking State: Outer Halo */}
          {voiceState.status === 'speaking' && (
            <span
              data-testid="voice-speaking-halo"
              className="pointer-events-none absolute -inset-1 rounded-full border border-emerald-400/60"
            />
          )}

          {voiceState.status === 'thinking' ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-300" />
          ) : voiceState.status === 'speaking' ? (
            <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
          ) : voiceState.fullDuplexEnabled ? (
            <Mic className="w-4 h-4 text-sky-600 dark:text-sky-300" />
          ) : (
            <MicOff className="w-4 h-4 text-[var(--comfort-hud-muted)]" />
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
            <span className="text-2xs font-bold text-[var(--comfort-hud-text)] leading-tight group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors">
              Suara Dr. LabMu
            </span>
            <span className="text-2xs font-mono text-[var(--comfort-hud-muted)] leading-tight">
              {statusMeta.badge}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--comfort-hud-muted)] group-hover:text-[var(--comfort-hud-text)]" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--comfort-hud-muted)] group-hover:text-[var(--comfort-hud-text)]" />
          )}
        </button>
      </div>
    </div>
  );
};
