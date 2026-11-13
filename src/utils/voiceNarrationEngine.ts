/**
 * Web Speech API Voice Narration Engine ("Dr. LabMu Voice")
 * Provides zero-cost, native speech synthesis for Indonesian laboratory narration,
 * K3 safety briefings, and Socratic hints.
 */

import { labSound } from './soundEngine';

export interface NarrationOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

type SpeechListener = (speaking: boolean) => void;

class VoiceNarrationEngine {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private isCurrentlySpeaking: boolean = false;
  private listeners: Set<SpeechListener> = new Set();
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWindowListeners();
    }
  }

  private initWindowListeners() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // Automatically cancel narration when user switches tabs to avoid startling
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isCurrentlySpeaking) {
        this.stop();
      }
    });

    // Handle window unload
    window.addEventListener('beforeunload', () => {
      this.stop();
    });
  }

  /**
   * Check if speech synthesis is supported in current environment
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  /**
   * Cleans text from markdown, formulas, and asterisks for smooth TTS pronunciation
   */
  public cleanTextForSpeech(text: string): string {
    return text
      .replace(/[*_#`~]/g, '') // remove markdown styling
      .replace(/https?:\/\/\S+/g, '') // remove urls
      .replace(/Σ/g, 'sigma ')
      .replace(/Δ/g, 'delta ')
      .replace(/θ/g, 'teta ')
      .replace(/μ[ks]?/g, 'miu ')
      .replace(/λ/g, 'lambda ')
      .replace(/m\/s²/g, ' meter per detik kuadrat ')
      .replace(/m\/s/g, ' meter per detik ')
      .replace(/km\/s/g, ' kilometer per detik ')
      .replace(/N\/m/g, ' newton per meter ')
      .replace(/°C/g, ' derajat Celsius ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get available Indonesian voice or fallback voice
   */
  public getIndonesianVoice(): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;
    try {
      const voices = window.speechSynthesis.getVoices();
      // First try id-ID or Indonesian voices
      const idVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('id') ||
          v.name.toLowerCase().includes('indonesia')
      );
      if (idVoice) return idVoice;

      // Fallback to default or first available voice
      return voices.find((v) => v.default) || voices[0] || null;
    } catch {
      return null;
    }
  }

  private setSpeaking(speaking: boolean) {
    this.isCurrentlySpeaking = speaking;
    this.listeners.forEach((listener) => {
      try {
        listener(speaking);
      } catch {
        // ignore listener errors
      }
    });
  }

  /**
   * Speak narration text
   */
  public speak(text: string, options?: NarrationOptions): void {
    if (!this.isSupported()) {
      options?.onError?.(new Error('Speech synthesis not supported in this browser'));
      return;
    }

    // Respect global mute setting
    if (!labSound.isEnabled()) {
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    const cleanedText = this.cleanTextForSpeech(text);
    if (!cleanedText) return;

    try {
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = options?.lang || 'id-ID';
      utterance.rate = options?.rate ?? 0.95; // Slightly slower for clear pedagogical comprehension
      utterance.pitch = options?.pitch ?? 1.0;
      utterance.volume = options?.volume ?? 1.0;

      const voice = this.getIndonesianVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        this.setSpeaking(true);
        options?.onStart?.();
      };

      utterance.onend = () => {
        this.setSpeaking(false);
        this.activeUtterance = null;
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.setSpeaking(false);
        this.activeUtterance = null;
        // Ignore synthetic cancel errors
        if ((e as unknown as { error?: string }).error !== 'canceled') {
          options?.onError?.(e);
        }
      };

      this.activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      this.setSpeaking(false);
      options?.onError?.(err);
    }
  }

  /**
   * Stop any current narration immediately
   */
  public stop(): void {
    if (this.activeUtterance) {
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.setSpeaking(false);
  }

  /**
   * Check if currently speaking
   */
  public isSpeaking(): boolean {
    if (!this.isSupported()) return false;
    return this.isCurrentlySpeaking || window.speechSynthesis.speaking;
  }

  /**
   * Subscribe to speech state changes
   */
  public subscribe(listener: SpeechListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const voiceNarration = new VoiceNarrationEngine();

export function speakNarration(text: string, options?: NarrationOptions): void {
  voiceNarration.speak(text, options);
}

export function stopNarration(): void {
  voiceNarration.stop();
}

export function isSpeaking(): boolean {
  return voiceNarration.isSpeaking();
}
