/**
 * Adaptive Scaffolding Engine (Fase 2 — Tugas 2)
 * Memantau log dari `telemetryRecorder.ts` dan `labEventBus.ts` untuk mendeteksi
 * pola kesulitan siswa secara real-time serta memberikan intervensi pedagogis 3 tingkat:
 *
 * Klasifikasi Kondisi Kesulitan:
 * 1. `stagnant_trial`: Siswa tidak mengubah parameter selama > 2 menit (120.000 ms) saat target belum tercapai.
 * 2. `erratic_outliers`: Nilai korelasi data regresi R² < 0.70 berulang kali (>= 2 kali).
 * 3. `safety_violation`: Suhu (> 85°C) atau tegangan (> 24 V) melampaui ambang batas aman K3.
 *
 * Sistem Petunjuk Bertingkat (3-Tier Scaffolding):
 * - Level 1 (Nudge): Pesan reflektif singkat dari Dr. LabMu di pojok atas kanvas.
 * - Level 2 (Targeted Clue): Kartu petunjuk spesifik variabel mana yang perlu diubah.
 * - Level 3 (Visual Focus): Mengarahkan kamera Three.js otomatis (smooth camera lerp)
 *   ke instrumen yang perlu disetel ulang disertai efek pendar (pulse highlight).
 */

import { getRecordedTelemetryEvents, TelemetryReplayEvent } from '../telemetryRecorder';
import { LAB_EVENTS, emitLabEvent } from '../labEventBus';

export type ScaffoldingCondition =
  | 'stagnant_trial'
  | 'erratic_outliers'
  | 'safety_violation';

export type ScaffoldingTier = 1 | 2 | 3;

export interface ScaffoldingTelemetryInput {
  nowTimestamp?: number;
  lastInteractionTimestamp: number;
  recordsCount: number;
  targetRecordsCount?: number;
  rSquaredHistory: number[];
  temperatureC?: number;
  maxSafeTemperatureC?: number;
  voltageV?: number;
  maxSafeVoltageV?: number;
  domain?: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  occurrenceCount?: number;
}

export interface AdaptiveScaffoldingHint {
  id: string;
  condition: ScaffoldingCondition;
  tier: ScaffoldingTier;
  title: string;
  nudgeMessage: string;
  targetedVariable?: string;
  targetedVariableAdvice?: string;
  instrumentId: string;
  instrumentTargetPosition: [number, number, number];
  drLabMuFollowUpPrompt: string;
  timestamp: number;
}

export const STAGNANT_THRESHOLD_MS = 120_000; // 2 menit
export const OUTLIER_R2_THRESHOLD = 0.70;
export const DEFAULT_MAX_SAFE_TEMP_C = 85;
export const DEFAULT_MAX_SAFE_VOLTAGE_V = 24;

/**
 * Menentukan nomor Tier (1, 2, atau 3) berdasarkan jumlah pengulangan kondisi kesulitan
 * atau tingkat keparahan keselamatan.
 */
export function resolveScaffoldingTier(
  condition: ScaffoldingCondition,
  occurrenceCount: number
): ScaffoldingTier {
  if (condition === 'safety_violation' && occurrenceCount >= 2) {
    return 3;
  }
  if (occurrenceCount <= 1) return 1;
  if (occurrenceCount === 2) return 2;
  return 3;
}

/**
 * Fungsi murni (pure function) untuk mengevaluasi kondisi kesulitan siswa dan menghasilkan
 * petunjuk 3-Tier Adaptive Scaffolding yang sesuai.
 */
export function evaluateAdaptiveScaffolding(
  input: ScaffoldingTelemetryInput
): AdaptiveScaffoldingHint | null {
  const now = input.nowTimestamp ?? Date.now();
  const targetRecords = input.targetRecordsCount ?? 3;
  const maxTemp = input.maxSafeTemperatureC ?? DEFAULT_MAX_SAFE_TEMP_C;
  const maxVolt = input.maxSafeVoltageV ?? DEFAULT_MAX_SAFE_VOLTAGE_V;
  const domain = input.domain ?? 'Fisika';

  // 1. Cek Safety Violation terlebih dahulu (Prioritas K3 Tertinggi)
  const isOverTemp =
    typeof input.temperatureC === 'number' && input.temperatureC > maxTemp;
  const isOverVolt =
    typeof input.voltageV === 'number' && input.voltageV > maxVolt;

  if (isOverTemp || isOverVolt) {
    const occ = Math.max(1, input.occurrenceCount ?? 1);
    const tier = resolveScaffoldingTier('safety_violation', occ);
    const hazardParam = isOverTemp
      ? `Suhu Reaksi (${input.temperatureC}°C > ${maxTemp}°C)`
      : `Tegangan Catu Daya (${input.voltageV} V > ${maxVolt} V)`;

    return {
      id: `scaff-safety-${now}`,
      condition: 'safety_violation',
      tier,
      title:
        tier === 1
          ? 'Level 1 (Nudge K3): Ambang Keselamatan Terlampaui'
          : tier === 2
            ? 'Level 2 (Targeted Clue K3): Turunkan Parameter Berbahaya'
            : 'Level 3 (Visual Focus K3): Fokus Kamera ke Instrumen Kritis',
      nudgeMessage: `Perhatian K3! ${hazardParam} melampaui batas aman laboratorium. Segera stabilkan parameter sebelum melanjutkan pencatatan data.`,
      targetedVariable: isOverTemp ? 'Suhu Awal (T₀)' : 'Tegangan Sumber (V)',
      targetedVariableAdvice: isOverTemp
        ? `Turunkan slider Suhu Awal ke rentang aman 25°C – ${maxTemp - 10}°C.`
        : `Turunkan tegangan sumber listrik ke bawah ${maxVolt} V untuk mencegah panas berlebih pada resistor.`,
      instrumentId: isOverTemp ? 'kalorimeter-pemanas-3d' : 'catu-daya-dc-3d',
      instrumentTargetPosition: isOverTemp ? [0.0, 1.4, 0.0] : [-1.2, 1.2, 0.0],
      drLabMuFollowUpPrompt: `Dokter LabMu, mengapa ${hazardParam} berbahaya bagi akurasi instrumen dan keselamatan kerja laboratorium?`,
      timestamp: now,
    };
  }

  // 2. Cek Erratic Outliers (Nilai R² < 0.70 berulang kali >= 2 kali)
  const lowR2List = (input.rSquaredHistory || []).filter(
    (r2) => Number.isFinite(r2) && r2 > 0 && r2 < OUTLIER_R2_THRESHOLD
  );
  if (lowR2List.length >= 2) {
    const occ = Math.max(lowR2List.length, input.occurrenceCount ?? lowR2List.length);
    const tier = resolveScaffoldingTier('erratic_outliers', occ - 1);
    const latestR2 = lowR2List[lowR2List.length - 1];

    const varMap: Record<string, { varName: string; advice: string; pos: [number, number, number]; inst: string }> = {
      Fisika: {
        varName: 'Gaya Dorong (F) & Massa (m)',
        advice: 'Jaga Massa (m) dan Sudut (θ) tetap konstan, lalu naikkan Gaya Dorong (F) secara bertahap (misal 20 N, 40 N, 60 N).',
        pos: [0.0, 1.5, 0.0],
        inst: 'bidang-miring-newton-3d',
      },
      Kimia: {
        varName: 'Volume Titran NaOH (mL)',
        advice: 'Tambahkan volume titran secara bertahap (increment 2.0 mL) mendekati titik ekuivalen sambil menjaga suhu konstan.',
        pos: [0.2, 1.9, 0.0],
        inst: 'buret-titran-3d',
      },
      Biologi: {
        varName: 'Intensitas Cahaya / Konsentrasi Substrat',
        advice: 'Ubah satu variabel bebas secara teratur dan hindari mengubah suhu serta pH secara bersamaan.',
        pos: [0.0, 1.3, 0.0],
        inst: 'bioreaktor-enzim-3d',
      },
      Astronomi: {
        varName: 'Sumbu Semi-Mayor Orbit (a)',
        advice: 'Pertahankan massa bintang induk tetap 1.0 M☉ saat memvariasikan jarak orbit a (AU) untuk membuktikan T² ∝ a³.',
        pos: [0.0, 1.2, 0.0],
        inst: 'orbit-kepler-3d',
      },
    };

    const targetMeta = varMap[domain] || varMap.Fisika;

    return {
      id: `scaff-outlier-${now}`,
      condition: 'erratic_outliers',
      tier,
      title:
        tier === 1
          ? `Level 1 (Nudge): Korelasi Data Menyimpang (R² = ${latestR2.toFixed(2)})`
          : tier === 2
            ? `Level 2 (Targeted Clue): Kendalikan Variabel Kontrol ${domain}`
            : `Level 3 (Visual Focus): Sorotan Kamera ke Instrumen ${targetMeta.inst}`,
      nudgeMessage: `Dr. LabMu mendeteksi nilai determinasi regresi R² = ${latestR2.toFixed(3)} (< 0.70) secara berulang. Kemungkinan lebih dari satu variabel diubah secara bersamaan.`,
      targetedVariable: targetMeta.varName,
      targetedVariableAdvice: targetMeta.advice,
      instrumentId: targetMeta.inst,
      instrumentTargetPosition: targetMeta.pos,
      drLabMuFollowUpPrompt: `Dokter LabMu, nilai regresi R² saya ${latestR2.toFixed(2)} masih di bawah 0.70. Bagaimana cara mengisolasi variabel bebas pada eksperimen ${domain} ini?`,
      timestamp: now,
    };
  }

  // 3. Cek Stagnant Trial (Tidak mengubah parameter > 2 menit saat target belum tercapai)
  const idleElapsedMs = Math.max(0, now - input.lastInteractionTimestamp);
  if (input.recordsCount < targetRecords && idleElapsedMs > STAGNANT_THRESHOLD_MS) {
    const occ = Math.max(
      1,
      input.occurrenceCount ?? Math.floor(idleElapsedMs / STAGNANT_THRESHOLD_MS)
    );
    const tier = resolveScaffoldingTier('stagnant_trial', occ);

    const idleMinutes = (idleElapsedMs / 60_000).toFixed(1);
    const primaryVar =
      domain === 'Kimia'
        ? 'Volume Titran (mL) / Suhu Awal (T₀)'
        : domain === 'Astronomi'
          ? 'Sumbu Semi-Mayor (a)'
          : domain === 'Biologi'
            ? 'Intensitas Cahaya / Konsentrasi Substrat'
            : 'Gaya Dorong Luar (F)';

    return {
      id: `scaff-stagnant-${now}`,
      condition: 'stagnant_trial',
      tier,
      title:
        tier === 1
          ? `Level 1 (Nudge): Eksplorasi Terhenti (${idleMinutes} Menit)`
          : tier === 2
            ? `Level 2 (Targeted Clue): Variasikan ${primaryVar}`
            : `Level 3 (Visual Focus): Arahkan Kamera ke Aparatus Utama`,
      nudgeMessage: `Anda belum mengubah parameter selama ${idleMinutes} menit sementara data pengamatan baru ${input.recordsCount}/${targetRecords} titik. Mari variasikan variabel bebas untuk melengkapi kurva!`,
      targetedVariable: primaryVar,
      targetedVariableAdvice: `Geser slider ${primaryVar} ke nilai baru lalu tekan tombol "+ Catat Data" untuk merekam titik uji berikutnya.`,
      instrumentId: `aparatus-utama-${domain.toLowerCase()}`,
      instrumentTargetPosition: [0.0, 1.5, 0.0],
      drLabMuFollowUpPrompt: `Dokter LabMu, langkah apa yang sebaiknya saya lakukan selanjutnya untuk melengkapi ${targetRecords} titik data pengamatan pada modul ${domain}?`,
      timestamp: now,
    };
  }

  return null;
}

type ScaffoldingListener = (hint: AdaptiveScaffoldingHint | null) => void;

class AdaptiveScaffoldingController {
  private activeHint: AdaptiveScaffoldingHint | null = null;
  private listeners = new Set<ScaffoldingListener>();
  private rSquaredHistory: number[] = [];
  private conditionEscalationCount: Record<ScaffoldingCondition, number> = {
    stagnant_trial: 0,
    erratic_outliers: 0,
    safety_violation: 0,
  };

  public getActiveHint(): AdaptiveScaffoldingHint | null {
    return this.activeHint;
  }

  public subscribe(listener: ScaffoldingListener): () => void {
    this.listeners.add(listener);
    listener(this.activeHint);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setActiveHint(hint: AdaptiveScaffoldingHint | null) {
    this.activeHint = hint;
    this.listeners.forEach((fn) => {
      try {
        fn(hint);
      } catch {
        // ignore
      }
    });

    // If Tier 3 (Visual Focus) is reached, automatically emit smooth camera lerp & pulse highlight event
    if (hint && hint.tier === 3) {
      emitLabEvent(LAB_EVENTS.SCAFFOLDING_FOCUS_INSTRUMENT, {
        instrumentId: hint.instrumentId,
        targetPosition: hint.instrumentTargetPosition,
        cameraOffset: [2.3, 2.0, 4.4],
        reason: hint.title,
      });
    }
  }

  public dismissActiveHint(): void {
    this.setActiveHint(null);
  }

  /**
   * Mengevaluasi telemetri langsung dari sesi praktikum dan `telemetryRecorder.ts`.
   */
  public evaluateSessionState(params: {
    domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
    recordsCount: number;
    latestRSquared?: number;
    temperatureC?: number;
    voltageV?: number;
    nowTimestamp?: number;
  }): AdaptiveScaffoldingHint | null {
    const events: TelemetryReplayEvent[] = getRecordedTelemetryEvents();
    const lastEventTime =
      events.length > 0 ? events[events.length - 1].timestamp : Date.now();

    if (
      typeof params.latestRSquared === 'number' &&
      params.latestRSquared > 0 &&
      params.recordsCount >= 2
    ) {
      const prev = this.rSquaredHistory[this.rSquaredHistory.length - 1];
      if (prev !== params.latestRSquared) {
        this.rSquaredHistory.push(params.latestRSquared);
        if (this.rSquaredHistory.length > 8) {
          this.rSquaredHistory.shift();
        }
      }
    }

    const hint = evaluateAdaptiveScaffolding({
      nowTimestamp: params.nowTimestamp ?? Date.now(),
      lastInteractionTimestamp: lastEventTime,
      recordsCount: params.recordsCount,
      targetRecordsCount: 3,
      rSquaredHistory: this.rSquaredHistory,
      temperatureC: params.temperatureC,
      voltageV: params.voltageV,
      domain: params.domain,
    });

    if (hint) {
      this.conditionEscalationCount[hint.condition] += 1;
      const escalatedTier = resolveScaffoldingTier(
        hint.condition,
        this.conditionEscalationCount[hint.condition]
      );
      const escalatedHint: AdaptiveScaffoldingHint = {
        ...hint,
        tier: escalatedTier,
      };
      this.setActiveHint(escalatedHint);
      return escalatedHint;
    }

    return null;
  }

  /**
   * Memungkinkan siswa atau penguji menaikkan level petunjuk (Level 1 -> Level 2 -> Level 3 Visual Focus)
   * atau memicu simulasi diagnostik secara langsung.
   */
  public escalateOrTriggerDiagnosticHint(
    domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi',
    condition: ScaffoldingCondition = 'erratic_outliers',
    forcedTier?: ScaffoldingTier
  ): AdaptiveScaffoldingHint {
    this.conditionEscalationCount[condition] = forcedTier
      ? forcedTier
      : Math.min(3, (this.conditionEscalationCount[condition] || 0) + 1);

    const tier = forcedTier ?? resolveScaffoldingTier(
      condition,
      this.conditionEscalationCount[condition]
    );

    const syntheticInput: ScaffoldingTelemetryInput =
      condition === 'safety_violation'
        ? {
            lastInteractionTimestamp: Date.now(),
            recordsCount: 1,
            rSquaredHistory: [0.95],
            temperatureC: 94,
            domain,
            occurrenceCount: tier,
          }
        : condition === 'stagnant_trial'
          ? {
              nowTimestamp: Date.now(),
              lastInteractionTimestamp: Date.now() - 150_000,
              recordsCount: 1,
              rSquaredHistory: [],
              domain,
              occurrenceCount: tier,
            }
          : {
              lastInteractionTimestamp: Date.now(),
              recordsCount: 3,
              rSquaredHistory: [0.62, 0.58],
              domain,
              occurrenceCount: tier + 1,
            };

    const generated = evaluateAdaptiveScaffolding(syntheticInput)!;
    const finalHint: AdaptiveScaffoldingHint = {
      ...generated,
      tier,
    };
    this.setActiveHint(finalHint);
    return finalHint;
  }

  public triggerVisualFocusOnInstrument(hint?: AdaptiveScaffoldingHint): void {
    const target = hint ?? this.activeHint;
    if (!target) return;
    emitLabEvent(LAB_EVENTS.SCAFFOLDING_FOCUS_INSTRUMENT, {
      instrumentId: target.instrumentId,
      targetPosition: target.instrumentTargetPosition,
      cameraOffset: [2.2, 1.9, 4.2],
      reason: target.title,
    });
  }

  public reset(): void {
    this.rSquaredHistory = [];
    this.conditionEscalationCount = {
      stagnant_trial: 0,
      erratic_outliers: 0,
      safety_violation: 0,
    };
    this.setActiveHint(null);
  }
}

export const adaptiveScaffoldingEngine = new AdaptiveScaffoldingController();
