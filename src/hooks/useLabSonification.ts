import { useEffect, useRef } from 'react';
import { scientificSonification } from '../utils/scientificSonificationEngine';
import { useLabStore } from '../stores/useLabStore';

export type SonificationTelemetryInput =
  | { kind: 'physics'; frequencyHz?: number; sourceVelocityMs?: number; speedHz?: number }
  | { kind: 'chemistry'; ph: number; temperatureC?: number }
  | { kind: 'biology'; bpm: number; oxygenRate?: number }
  | { kind: 'astronomy'; orbitalVelocityKmS: number }
  | { kind: 'earth'; magnitude: number };

/**
 * Periodically maps active simulation physical telemetry into classroom-safe Web Audio feedback
 * whenever the user enables scientific sonification in the 3D HUD.
 */
export function useLabSonification(input: SonificationTelemetryInput, isActive = true): void {
  const sonificationEnabled = useLabStore((s) => s.sonificationEnabled);
  const isSimulating = useLabStore((s) => s.isSimulating);
  const latestRef = useRef(input);
  latestRef.current = input;

  useEffect(() => {
    scientificSonification.setEnabled(sonificationEnabled);
    if (!sonificationEnabled || !isSimulating || !isActive) return;

    const intervalMs =
      input.kind === 'biology'
        ? Math.max(350, Math.round(60000 / Math.max(40, Math.min(180, input.bpm || 72))))
        : input.kind === 'earth'
        ? 1100
        : 650;

    const timer = window.setInterval(() => {
      const current = latestRef.current;
      if (!scientificSonification.isEnabled()) return;
      switch (current.kind) {
        case 'physics':
          if (typeof current.sourceVelocityMs === 'number' && Math.abs(current.sourceVelocityMs) > 0.1) {
            scientificSonification.playDopplerTone(
              current.frequencyHz ?? 440,
              current.sourceVelocityMs
            );
          } else {
            scientificSonification.playHarmonicTone(current.speedHz ?? current.frequencyHz ?? 1.2);
          }
          break;
        case 'chemistry':
          scientificSonification.playTitrationTone(current.ph);
          break;
        case 'biology':
          scientificSonification.playHeartbeatLubDub(current.bpm || 72);
          break;
        case 'astronomy':
          scientificSonification.playHarmonicTone(Math.max(0.15, current.orbitalVelocityKmS * 0.08));
          break;
        case 'earth':
          scientificSonification.playSeismicPulse(current.magnitude);
          break;
      }
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [sonificationEnabled, isSimulating, isActive, input.kind, input.kind === 'biology' ? input.bpm : 0]);
}
