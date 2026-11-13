/**
 * Asisten Suara Real-Time Full-Duplex Dr. LabMu (Fase 1 — Tugas 2)
 * Menyediakan:
 * 1. Speech-to-Text (STT) via `SpeechRecognition` / `webkitSpeechRecognition` (`id-ID` & `en-US`)
 * 2. Text-to-Speech (TTS) via `window.speechSynthesis` dengan pemilihan suara alami Indonesia/Inggris
 * 3. Voice Activity Detection (VAD) sederhana & pencegahan Audio Feedback Loop:
 *    - Mikrofon otomatis mendengarkan saat siswa berbicara
 *    - Mikrofon otomatis dimatikan sementara saat Dr. LabMu sedang bersuara (Speaking)
 *    - Otomatis melanjutkan pendengaran (Auto-Resume) setelah Dr. LabMu selesai berbicara.
 */

import {
  ScienceDomain,
  AcademicLevel,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  BiologyTelemetryContext,
  ExperimentRecord,
  buildDrLabMuTelemetry,
  generateSocraticDrLabMuResponse,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';

export type VoiceAssistantStatus = 'idle' | 'listening' | 'thinking' | 'speaking';
export type SupportedVoiceLocale = 'id-ID' | 'en-US';

export interface VADConfig {
  rmsSilenceThreshold: number;
  rmsSpeechThreshold: number;
  silenceHoldMs: number;
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  rmsSilenceThreshold: 0.02,
  rmsSpeechThreshold: 0.045,
  silenceHoldMs: 1100,
};

export interface VoiceAssistantState {
  status: VoiceAssistantStatus;
  fullDuplexEnabled: boolean;
  locale: SupportedVoiceLocale;
  isMicMutedForTTS: boolean;
  isSupportedSTT: boolean;
  isSupportedTTS: boolean;
  audioEnergy: number; // 0.0 .. 1.0 for waveform visualizer
  interimTranscript: string;
  lastUserTranscript: string;
  lastMentorReply: string;
  errorMessage: string | null;
}

export interface LiveExperimentVoiceContext {
  domain: ScienceDomain;
  academicLevel: AcademicLevel;
  physicsParams: PhysicsParams;
  chemistryParams: ChemistryParams;
  astronomyParams: AstronomyParams;
  biologyContext?: BiologyTelemetryContext;
  records: ExperimentRecord[];
}

/**
 * Pure helper: Evaluates a single audio RMS energy sample & TTS lock state for VAD.
 * Guarantees microphone input is blocked whenever `isMentorSpeaking` is true (prevents feedback loop).
 */
export function evaluateVADFrame(
  rmsEnergy: number,
  isMentorSpeaking: boolean,
  config: VADConfig = DEFAULT_VAD_CONFIG
): {
  shouldCaptureAudio: boolean;
  isSpeechDetected: boolean;
  normalizedLevel: number;
} {
  if (isMentorSpeaking) {
    return {
      shouldCaptureAudio: false,
      isSpeechDetected: false,
      normalizedLevel: 0,
    };
  }

  const safeRms = Number.isFinite(rmsEnergy) ? Math.max(0, rmsEnergy) : 0;
  const isSpeechDetected = safeRms >= config.rmsSpeechThreshold;
  const normalizedLevel = Math.min(1, Number((safeRms * 5.5).toFixed(3)));

  return {
    shouldCaptureAudio: true,
    isSpeechDetected,
    normalizedLevel,
  };
}

/**
 * Pure helper: Cleans scientific symbols and markdown for natural TTS pronunciation in id-ID or en-US.
 */
export function cleanSpeechTextForLocale(
  rawText: string,
  locale: SupportedVoiceLocale = 'id-ID'
): string {
  const isEn = locale === 'en-US';
  return rawText
    .replace(/[*_#`~]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/R²/g, isEn ? 'R squared ' : 'R kuadrat ')
    .replace(/Σ/g, 'sigma ')
    .replace(/Δ/g, 'delta ')
    .replace(/θ/g, isEn ? 'theta ' : 'teta ')
    .replace(/μ[ks]?/g, 'miu ')
    .replace(/λ/g, 'lambda ')
    .replace(/m\/s²/g, isEn ? ' meters per second squared ' : ' meter per detik kuadrat ')
    .replace(/m\/s/g, isEn ? ' meters per second ' : ' meter per detik ')
    .replace(/°C/g, isEn ? ' degrees Celsius ' : ' derajat Celsius ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure helper: Selects the most natural voice for the requested locale (`id-ID` or `en-US`).
 */
export function selectPreferredTTSVoice(
  voices: SpeechSynthesisVoice[],
  locale: SupportedVoiceLocale = 'id-ID'
): SpeechSynthesisVoice | null {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const prefix = locale === 'id-ID' ? 'id' : 'en';
  const keyword = locale === 'id-ID' ? 'indonesia' : 'natural';

  // 1. Prefer high-quality / natural matching locale voice
  const preferred = voices.find(
    (v) =>
      v.lang?.toLowerCase().startsWith(prefix) &&
      (v.name?.toLowerCase().includes('natural') ||
        v.name?.toLowerCase().includes('google') ||
        v.name?.toLowerCase().includes(keyword))
  );
  if (preferred) return preferred;

  // 2. Any voice matching language code
  const langMatch = voices.find((v) => v.lang?.toLowerCase().startsWith(prefix));
  if (langMatch) return langMatch;

  return voices.find((v) => v.default) || voices[0] || null;
}

type VoiceAssistantListener = (state: VoiceAssistantState) => void;

class FullDuplexAIVoiceAssistant {
  private state: VoiceAssistantState;
  private listeners = new Set<VoiceAssistantListener>();
  private recognition: any = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private vadTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private liveLabContext: LiveExperimentVoiceContext | null = null;

  constructor() {
    const hasWindow = typeof window !== 'undefined';
    const hasSTT =
      hasWindow &&
      Boolean(
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      );
    const hasTTS =
      hasWindow &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';

    this.state = {
      status: 'idle',
      fullDuplexEnabled: false,
      locale: 'id-ID',
      isMicMutedForTTS: false,
      isSupportedSTT: hasSTT,
      isSupportedTTS: hasTTS,
      audioEnergy: 0,
      interimTranscript: '',
      lastUserTranscript: '',
      lastMentorReply:
        'Halo! Saya Dr. LabMu. Aktifkan mikrofon Full-Duplex untuk berdiskusi langsung sambil melakukan eksperimen 3D.',
      errorMessage: null,
    };
  }

  public getState(): VoiceAssistantState {
    return { ...this.state };
  }

  public subscribe(listener: VoiceAssistantListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(patch: Partial<VoiceAssistantState>) {
    this.state = { ...this.state, ...patch };
    const snap = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch {
        // ignore
      }
    });
  }

  public updateLiveLabContext(ctx: LiveExperimentVoiceContext) {
    this.liveLabContext = ctx;
  }

  public setLocale(locale: SupportedVoiceLocale) {
    const wasListening = this.state.status === 'listening';
    const defaultGreeting =
      locale === 'en-US'
        ? 'Hello! I am Dr. LabMu. Enable the Full-Duplex microphone to discuss your 3D experiment in real time.'
        : 'Halo! Saya Dr. LabMu. Aktifkan mikrofon Full-Duplex untuk berdiskusi langsung sambil melakukan eksperimen 3D.';

    this.updateState({
      locale,
      lastMentorReply:
        this.state.lastUserTranscript === '' ? defaultGreeting : this.state.lastMentorReply,
    });

    if (wasListening) {
      this.stopRecognitionInternal();
      this.startRecognitionInternal();
    }
  }

  /**
   * Mengaktifkan atau mematikan sesi percakapan suara Full-Duplex.
   */
  public toggleFullDuplexSession(): void {
    labSound.playClick(640);
    if (this.state.fullDuplexEnabled) {
      this.stopFullDuplexSession();
    } else {
      this.startFullDuplexSession();
    }
  }

  public startFullDuplexSession(): void {
    this.updateState({
      fullDuplexEnabled: true,
      errorMessage: null,
    });
    this.startVADAnalyserIfAvailable();
    this.startRecognitionInternal();
  }

  public stopFullDuplexSession(): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
    this.stopRecognitionInternal();
    this.stopSpeaking();
    this.stopVADAnalyser();
    this.updateState({
      status: 'idle',
      fullDuplexEnabled: false,
      isMicMutedForTTS: false,
      audioEnergy: 0,
      interimTranscript: '',
    });
  }

  private async startVADAnalyserIfAvailable() {
    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!this.state.fullDuplexEnabled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.mediaStream = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const pollVAD = () => {
        if (!this.analyser || !this.state.fullDuplexEnabled) return;
        this.analyser.getByteTimeDomainData(dataArray);
        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        const vad = evaluateVADFrame(rms, this.state.status === 'speaking');

        if (this.state.status === 'listening') {
          this.updateState({
            audioEnergy: vad.normalizedLevel,
          });
        }
        this.vadTimer = setTimeout(pollVAD, 90);
      };
      pollVAD();
    } catch {
      // Graceful fallback when microphone hardware permission is unavailable in headless/iframe
    }
  }

  private stopVADAnalyser() {
    if (this.vadTimer) {
      clearTimeout(this.vadTimer);
      this.vadTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
  }

  private startRecognitionInternal() {
    // Prevent audio feedback loop: never start STT while TTS is speaking
    if (this.state.status === 'speaking' || this.state.isMicMutedForTTS) {
      return;
    }

    this.updateState({
      status: 'listening',
      isMicMutedForTTS: false,
      audioEnergy: 0.28,
    });

    if (typeof window === 'undefined') return;
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      // Keep status in 'listening' so UI waveform responds and allows simulated voice prompt
      return;
    }

    try {
      this.stopRecognitionInternal();
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = this.state.locale;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        if (!this.state.isMicMutedForTTS) {
          this.updateState({
            status: 'listening',
            audioEnergy: 0.35,
          });
        }
      };

      recognition.onresult = (event: any) => {
        if (this.state.isMicMutedForTTS || this.state.status === 'speaking') {
          return;
        }
        let interim = '';
        let finalTranscript = '';

        for (let i = event.resultIndex || 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (interim.trim()) {
          this.updateState({
            interimTranscript: interim.trim(),
            audioEnergy: Math.min(0.95, 0.4 + (interim.length % 5) * 0.1),
          });
        }

        if (finalTranscript.trim()) {
          void this.handleUserSpokenPrompt(finalTranscript.trim());
        }
      };

      recognition.onerror = () => {
        // Keep full-duplex standby without crashing
      };

      recognition.onend = () => {
        // Auto-restart continuous listening if still in full-duplex mode and not speaking/thinking
        if (
          this.state.fullDuplexEnabled &&
          this.state.status === 'listening' &&
          !this.state.isMicMutedForTTS
        ) {
          this.resumeTimer = setTimeout(() => {
            if (
              this.state.fullDuplexEnabled &&
              this.state.status === 'listening' &&
              !this.state.isMicMutedForTTS
            ) {
              try {
                recognition.start();
              } catch {
                // ignore
              }
            }
          }, 350);
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch {
      // Fallback cleanly
    }
  }

  private stopRecognitionInternal() {
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
  }

  /**
   * Memproses kalimat suara siswa terhadap telemetri eksperimen 3D terkini (Status: Thinking -> Speaking -> Listening).
   */
  public async handleUserSpokenPrompt(transcriptText: string): Promise<string> {
    const cleanPrompt = transcriptText.trim();
    if (!cleanPrompt) return '';

    // 1. Cut off microphone immediately while thinking & speaking to prevent feedback loop
    this.stopRecognitionInternal();
    this.updateState({
      status: 'thinking',
      isMicMutedForTTS: true,
      interimTranscript: '',
      lastUserTranscript: cleanPrompt,
      audioEnergy: 0.5,
    });

    const ctx = this.liveLabContext;
    let replyScript = '';

    if (ctx) {
      const payload = buildDrLabMuTelemetry(
        ctx.domain,
        ctx.academicLevel,
        ctx.physicsParams,
        ctx.chemistryParams,
        ctx.astronomyParams,
        ctx.records,
        cleanPrompt,
        ctx.biologyContext
      );

      // Try server AI Socratic route first with fast timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch('/api/dr-labmu/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telemetry: payload }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data?.response?.observation && data?.response?.socraticQuestion) {
            replyScript = `${data.response.observation} ${data.response.dataHighlight || ''} ${data.response.socraticQuestion}`;
          }
        }
      } catch {
        // Fallback to deterministic Socratic engine
      }

      if (!replyScript) {
        const localStructured = generateSocraticDrLabMuResponse(payload);
        if (this.state.locale === 'en-US') {
          replyScript = `Great observation on ${payload.domain} (${payload.topic}). Current R squared is ${payload.analytics.rSquared.toFixed(3)}. How does changing your independent variable affect the slope of your regression curve?`;
        } else {
          replyScript = `${localStructured.observation} ${localStructured.dataHighlight} ${localStructured.socraticQuestion}`;
        }
      }
    } else {
      replyScript =
        this.state.locale === 'en-US'
          ? 'Let us observe how adjusting the 3D apparatus parameters changes the measured response variable on your regression chart.'
          : 'Mari kita amati bagaimana perubahan variabel bebas pada meja 3D memengaruhi gradien kurva regresi pengamatan Anda.';
    }

    this.speakMentorResponse(replyScript);
    return replyScript;
  }

  /**
   * Membacakan bimbingan Sokratik secara lisan (TTS) sambil menjaga mikrofon tetap nonaktif
   * hingga pembacaan selesai (mencegah audio feedback loop).
   */
  public speakMentorResponse(text: string): void {
    const cleaned = cleanSpeechTextForLocale(text, this.state.locale);
    if (!cleaned) return;

    // Ensure STT is muted before TTS begins
    this.stopRecognitionInternal();
    this.updateState({
      status: 'speaking',
      isMicMutedForTTS: true,
      lastMentorReply: text,
      audioEnergy: 0.78,
    });

    const finishSpeakingAndResumeListening = () => {
      this.activeUtterance = null;
      if (this.state.fullDuplexEnabled) {
        this.updateState({
          status: 'listening',
          isMicMutedForTTS: false,
          audioEnergy: 0.25,
        });
        this.startRecognitionInternal();
      } else {
        this.updateState({
          status: 'idle',
          isMicMutedForTTS: false,
          audioEnergy: 0,
        });
      }
    };

    if (
      !this.state.isSupportedTTS ||
      typeof window === 'undefined' ||
      !labSound.isEnabled()
    ) {
      // Simulate natural speaking cadence when running in muted or headless environment
      this.resumeTimer = setTimeout(() => {
        finishSpeakingAndResumeListening();
      }, 1800);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = this.state.locale;
      utterance.rate = 0.97;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const chosenVoice = selectPreferredTTSVoice(voices, this.state.locale);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      utterance.onstart = () => {
        this.updateState({
          status: 'speaking',
          isMicMutedForTTS: true,
          audioEnergy: 0.82,
        });
      };

      utterance.onend = () => {
        finishSpeakingAndResumeListening();
      };

      utterance.onerror = () => {
        finishSpeakingAndResumeListening();
      };

      this.activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      finishSpeakingAndResumeListening();
    }
  }

  public stopSpeaking(): void {
    if (this.activeUtterance) {
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }
}

export const aiVoiceAssistant = new FullDuplexAIVoiceAssistant();
