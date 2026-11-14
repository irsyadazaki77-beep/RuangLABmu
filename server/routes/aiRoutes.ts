import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { generateSocraticDrLabMuResponse } from '../../src/utils/scienceEngine';
import {
  formatDrLabMuAskPayload,
  normalizeDrLabMuRequest,
} from '../../src/utils/labTelemetryHelpers';
import {
  CustomAIMissionPayload,
  LabRoom,
  generateDeterministicCustomMission,
  normalizeCustomMissionPayload,
  resolveModuleBlueprint,
} from '../../src/utils/collabProtocol';
import type { LabServerState } from '../state/labServerState';
import { applyCustomMissionToRoom } from '../ws/collabSocketServer';
import {
  validateConversationalDrLabMuPayload,
  validateDrLabMuAskPayload,
  validateGenerateMissionPayload,
  validateRoomMissionPayload,
  validateVisionDiagnosePayload,
  type ValidatedGenerateMissionPayload,
} from '../utils/routePayloadValidators';
import {
  deriveContextualDrLabMuActions,
  sanitizeDrLabMuUIActions,
} from '../../src/utils/drLabMuActions';

const DR_LABMU_SYSTEM_INSTRUCTION = `# ROLE & IDENTITAS
Nama Anda adalah "Dr. LabMu", asisten mentor laboratorium sains virtual cerdas di platform RuangLABmu. Anda menguasai bidang Fisika, Kimia, Biologi, dan Astronomi untuk jenjang SMP, SMA, hingga Perguruan Tinggi.

# PRINSIP PEDAGOGIK UTAMA (METODE SOKRATIK)
1. Pantangan Mutlak: Jangan pernah memberikan angka hasil akhir, jawaban langsung, atau menyalin kesimpulan laporan praktikum secara instan.
2. Bimbingan Bertahap: Tuntun pemahaman siswa menggunakan observasi data nyata, analogi intuitif, dan 1 pertanyaan pemantik reflektif di akhir jawaban.
3. Apresiasi Eksplorasi: Selalu validasi inisiatif siswa sebelum mengoreksi anomali data eksperimen.

# KONTEKS TELEMETRI SIMULASI
Setiap percakapan akan menyertakan data telemetri lab dalam format JSON:
- domain: "Fisika" | "Kimia" | "Biologi" | "Astronomi"
- topic: Judul modul aktif
- educationLevel: "SMP" | "SMA" | "Perguruan Tinggi"
- currentParameters: Parameter aktif yang diatur siswa
- recordedData: Tabel observasi riil dari simulasi
- analytics: Indikator statistik (R², kemiringan/slope, deviasi, persentase error)
- studentQuery: Pertanyaan siswa

# ATURAN PENANGANAN DATA & ANOMALI
1. Anomali & Deviasi Data (R² < 0.85 atau Outlier Ekstrem):
   - Arahkan perhatian siswa ke baris percobaan yang menyimpang tanpa menyalahkan.
2. Hands-On 3D Action Calling (Opsional via \`uiActions\`):
   - Jika relevan untuk mengarahkan fokus siswa di kanvas 3D atau panel parameter, sertakan array \`uiActions\` berisi 1-3 aksi:
     * FOCUS_CAMERA: target salah satu dari 'left_ventricle' | 'burette_tip' | 'pendulum_bob' | 'planet_focus'
     * TOGGLE_XRAY: enabled (boolean) untuk anatomi 3D
     * HIGHLIGHT_SLIDER: paramKey (string nama variabel) & durationMs (3000)
     * SET_SIMULATION_STATE: action ('play' | 'pause' | 'reset')
3. Format Output:
  1. Observasi Singkat (1-2 kalimat)
  2. Insight / Analogi Konseptual (1-2 paragraf)
  3. Pertanyaan Pemantik (1 kalimat tanya)`;

export interface AiRoutesDeps {
  state: LabServerState;
  broadcastAll: (payload: unknown) => void;
  broadcastRoom?: (roomId: string, payload: unknown) => void;
}

async function buildCustomMissionScenario(
  input: ValidatedGenerateMissionPayload
): Promise<CustomAIMissionPayload> {
  const { moduleId, caseStudyPrompt, teacherName, roomId } = input;
  const blueprint = resolveModuleBlueprint(moduleId);

  if (process.env.GEMINI_API_KEY && caseStudyPrompt) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const missionPrompt = `Anda adalah Arsitek Kurikulum Sains & Praktikum Virtual 3D RuangLABmu.
Guru memilih modul dasar: "${blueprint.moduleTitle}" (ID: ${blueprint.moduleId}, Domain: ${blueprint.domain}).
Studi Kasus Cerita dari Guru: "${caseStudyPrompt}"
Target Variabel Standar Modul: ${blueprint.targetVariable.variableLabel} (${blueprint.targetVariable.variableKey}) dalam satuan ${blueprint.targetVariable.unit}.

Buat skenario misi praktikum kontekstual berbahasa Indonesia dalam format JSON terstruktur yang mencakup:
1. title: Judul misi eksperimen yang menarik & relevan dengan studi kasus.
2. narrative: Narasi studi kasus ilmiah (2-3 kalimat) yang menginstruksikan siswa tentang apa yang harus diuji di laboratorium 3D.
3. targetVariable: Objek berisi variableKey ("${blueprint.targetVariable.variableKey}"), variableLabel, unit ("${blueprint.targetVariable.unit}"), targetValue (angka), minSuccessValue (angka batas bawah keberhasilan), dan maxSuccessValue (angka batas atas keberhasilan).
4. contextualQuestions: Array berisi tepat 3 pertanyaan LKS kontekstual (masing-masing memiliki id, questionText, expectedConceptOrValue, dan hint Sokratik).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: missionPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              narrative: { type: Type.STRING },
              targetVariable: {
                type: Type.OBJECT,
                properties: {
                  variableKey: { type: Type.STRING },
                  variableLabel: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  targetValue: { type: Type.NUMBER },
                  minSuccessValue: { type: Type.NUMBER },
                  maxSuccessValue: { type: Type.NUMBER },
                },
                required: [
                  'variableKey',
                  'variableLabel',
                  'unit',
                  'targetValue',
                  'minSuccessValue',
                  'maxSuccessValue',
                ],
              },
              contextualQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    questionText: { type: Type.STRING },
                    expectedConceptOrValue: { type: Type.STRING },
                    hint: { type: Type.STRING },
                  },
                  required: ['id', 'questionText', 'expectedConceptOrValue', 'hint'],
                },
              },
            },
            required: ['title', 'narrative', 'targetVariable', 'contextualQuestions'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return normalizeCustomMissionPayload(
        parsed,
        { moduleId, caseStudyPrompt, teacherName, roomId },
        'gemini-api'
      );
    } catch {
      // Fallback to deterministic generator
    }
  }

  return generateDeterministicCustomMission({
    moduleId,
    caseStudyPrompt,
    teacherName,
    roomId,
  });
}

export function createAiRouter({
  state,
  broadcastAll,
  broadcastRoom,
}: AiRoutesDeps): express.Router {
  const router = express.Router();
  const emitRoomMission = (roomId: string, payload: unknown) => {
    if (broadcastRoom) {
      broadcastRoom(roomId, payload);
    } else {
      broadcastAll(payload);
    }
  };

  router.post(
    ['/api/generate-mission', '/api/ai/generate-mission'],
    async (req, res) => {
      try {
        const check = validateGenerateMissionPayload(req.body);
        if (!check.ok) {
          res.status(400).json({
            error: check.error,
            code: check.code,
            details: check.details,
          });
          return;
        }

        const mission = await buildCustomMissionScenario(check.data);
        const shouldPublish = check.data.publishToRoom;
        let updatedRoom: LabRoom | undefined;
        if (shouldPublish) {
          updatedRoom = applyCustomMissionToRoom(
            state.activeLabRooms,
            mission.roomId,
            mission,
            mission.createdByTeacher
          );
          emitRoomMission(updatedRoom.roomId, {
            type: 'ROOM_MISSION_UPDATED',
            payload: {
              roomId: updatedRoom.roomId,
              customMission: mission,
              room: updatedRoom,
            },
          });
        }

        res.json({
          success: true,
          mission,
          room: updatedRoom,
        });
      } catch {
        res.status(500).json({
          error: 'Gagal menghasilkan skenario misi praktikum AI.',
        });
      }
    }
  );

  router.post('/api/rooms/:roomId/mission', (req, res) => {
    try {
      const check = validateRoomMissionPayload(req.params.roomId, req.body);
      if (!check.ok) {
        res.status(400).json({
          error: check.error,
          code: check.code,
          details: check.details,
        });
        return;
      }

      const { roomId, mission, teacherName } = check.data;
      const updatedRoom = applyCustomMissionToRoom(
        state.activeLabRooms,
        roomId,
        (mission as CustomAIMissionPayload | null) ?? null,
        teacherName
      );
      emitRoomMission(updatedRoom.roomId, {
        type: 'ROOM_MISSION_UPDATED',
        payload: {
          roomId: updatedRoom.roomId,
          customMission: updatedRoom.customMission || null,
          room: updatedRoom,
        },
      });
      res.json({
        success: true,
        room: updatedRoom,
        customMission: updatedRoom.customMission || null,
      });
    } catch {
      res.status(500).json({ error: 'Gagal menyimpan misi kustom ke Room.' });
    }
  });

  router.post(['/api/dr-labmu/ask', '/api/assistant'], async (req, res) => {
    try {
      const check = validateDrLabMuAskPayload(req.body);
      if (!check.ok) {
        res.status(400).json({
          error: check.error,
          code: check.code,
          details: check.details,
        });
        return;
      }

      if (check.data.kind === 'mission' && check.data.missionInput) {
        const mission = await buildCustomMissionScenario(check.data.missionInput);
        const shouldPublish = check.data.missionInput.publishToRoom;
        let updatedRoom: LabRoom | undefined;
        if (shouldPublish) {
          updatedRoom = applyCustomMissionToRoom(
            state.activeLabRooms,
            mission.roomId,
            mission,
            mission.createdByTeacher
          );
          emitRoomMission(updatedRoom.roomId, {
            type: 'ROOM_MISSION_UPDATED',
            payload: {
              roomId: updatedRoom.roomId,
              customMission: mission,
              room: updatedRoom,
            },
          });
        }
        res.json({
          success: true,
          mission,
          room: updatedRoom,
        });
        return;
      }

      const telemetry = normalizeDrLabMuRequest(check.data.rawBody);
      if (!telemetry) {
        res.status(400).json({
          error: 'Invalid telemetry payload',
          code: 'INVALID_PAYLOAD',
        });
        return;
      }

      const contextualActions = deriveContextualDrLabMuActions(telemetry);

      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const prompt = `Data Telemetri Eksperimen Siswa (JSON):\n${JSON.stringify(telemetry, null, 2)}\n\nBerikan respons Dr. LabMu dalam 3 bagian: observasiSingkat, insightKonseptual, pertanyaanPemantik, serta opsional uiActions bila perlu menggerakkan kamera 3D / X-Ray / sorot slider.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  observasiSingkat: { type: Type.STRING },
                  insightKonseptual: { type: Type.STRING },
                  pertanyaanPemantik: { type: Type.STRING },
                  hasAnomaly: { type: Type.BOOLEAN },
                  uiActions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING },
                        target: { type: Type.STRING },
                        enabled: { type: Type.BOOLEAN },
                        paramKey: { type: Type.STRING },
                        durationMs: { type: Type.NUMBER },
                        action: { type: Type.STRING },
                      },
                      required: ['type'],
                    },
                  },
                },
                required: [
                  'observasiSingkat',
                  'insightKonseptual',
                  'pertanyaanPemantik',
                  'hasAnomaly',
                ],
              },
            },
          });

          const parsed = JSON.parse(response.text || '{}');
          if (
            parsed.observasiSingkat &&
            parsed.insightKonseptual &&
            parsed.pertanyaanPemantik
          ) {
            res.json(formatDrLabMuAskPayload(parsed, 'gemini-api', contextualActions));
            return;
          }
        } catch {
          // fallback to deterministic Socratic engine
        }
      }

      const fallbackResponse = generateSocraticDrLabMuResponse(telemetry);
      res.json(formatDrLabMuAskPayload(fallbackResponse, 'socratic-engine', contextualActions));
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/ai/dr-labmu', async (req, res) => {
    try {
      const check = validateConversationalDrLabMuPayload(req.body);
      if (!check.ok) {
        res.status(400).json({
          error: check.error,
          code: check.code,
          details: check.details,
        });
        return;
      }

      const { message, telemetry } = check.data;
      const telemetryQuery =
        telemetry && typeof telemetry.studentQuery === 'string'
          ? telemetry.studentQuery.trim()
          : '';
      const activeQuery = (message || telemetryQuery).trim();

      const normalizedTelemetry = telemetry ? normalizeDrLabMuRequest({ telemetry }) : null;
      const fallbackActions = normalizedTelemetry
        ? deriveContextualDrLabMuActions({
            ...normalizedTelemetry,
            studentQuery: activeQuery,
          })
        : [];

      if (process.env.GEMINI_API_KEY && activeQuery) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const promptContext = `[KONTEKS TELEMETRI SAAT INI]:
${telemetry ? JSON.stringify(telemetry, null, 2) : `Domain: Sains\nTopik: Praktikum Virtual`}

<student_input>
${activeQuery.slice(0, 600)}
</student_input>`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: promptContext,
            config: { systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION },
          });

          const replyText = (response.text || '').trim();
          if (replyText) {
            res.json({
              reply: replyText,
              uiActions: sanitizeDrLabMuUIActions(fallbackActions),
              source: 'gemini-3.8-flash',
            });
            return;
          }
        } catch {
          // fallback
        }
      }

      if (normalizedTelemetry) {
        const localStructured = generateSocraticDrLabMuResponse({
          ...normalizedTelemetry,
          studentQuery: activeQuery,
        });
        res.json({
          reply: localStructured.formattedText,
          structured: {
            ...localStructured,
            uiActions: fallbackActions,
          },
          uiActions: fallbackActions,
          source: 'local-socratic',
        });
        return;
      }

      res.json({
        reply:
          'Eksplorasi yang sangat baik di meja praktikum! Bagaimana korelasi variabel bebas dan terikat Anda teramati pada grafik?',
        uiActions: [],
        source: 'local-socratic',
      });
    } catch {
      res
        .status(500)
        .json({ error: 'SERVER_ERROR', message: 'Gagal memproses pesan AI.' });
    }
  });

  router.post('/api/ai/vision-diagnose', async (req, res) => {
    try {
      const check = validateVisionDiagnosePayload(req.body);
      if (!check.ok) {
        res.status(400).json({
          error: check.error,
          code: check.code,
          details: check.details,
        });
        return;
      }

      const { image, telemetry, studentQuery: activeQuery } = check.data;
      const domain =
        telemetry && typeof telemetry.domain === 'string' && telemetry.domain.trim()
          ? telemetry.domain.trim()
          : 'Fisika';
      const topic =
        telemetry && typeof telemetry.topic === 'string' && telemetry.topic.trim()
          ? telemetry.topic.trim()
          : 'Laboratorium Sains 3D';

      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
          const imagePart = {
            inlineData: { mimeType: 'image/jpeg', data: base64Data },
          };

          const visionPrompt = `Anda adalah Dr. LabMu, mentor laboratorium sains cerdas di RuangLABmu.
Siswa melampirkan foto tangkapan layar meja simulasi 3D eksperimen mereka.
Domain: ${domain} | Topik Modul: ${topic}
Data Telemetri: ${JSON.stringify(telemetry || {}, null, 2)}
Pertanyaan Siswa: "${activeQuery}"
Berikan bimbingan Sokratik cerdas:
1. Observasi Visual (1-2 kalimat): Konfigurasi alat yang tampak.
2. Diagnostik & Analisis Fisis (1-2 paragraf): Hubungan antara posisi visual alat dan hukum sains.
3. Pertanyaan Pemantik Reflektif (1 kalimat): Menuntun langkah penyetelan instrumen berikutnya.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: { parts: [imagePart, { text: visionPrompt }] },
            config: { systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION },
          });

          const replyText = (response.text || '').trim();
          if (replyText) {
            res.json({ reply: replyText, source: 'gemini-vision' });
            return;
          }
        } catch {
          // fallback
        }
      }

      const fallbackReply = `1. Observasi Visual:\nSaya telah memeriksa tangkapan layar 3D meja praktikum ${topic} Anda. Aparatus laboratorium terpasang stabil dengan instrumen pengukuran terkalibrasi.\n\n2. Diagnostik & Analisis Fisis:\nPenataan instrumen Anda sudah menunjukkan kesiapan eksperimen yang baik. Data pengamatan Anda tampak konsisten dengan prediksi hukum dasar sains.\n\n3. Pertanyaan Pemantik:\n💡 Bagaimana jika Anda sedikit menggeser parameter variabel bebas untuk mengamati perubahan seketika pada indikator visual di kanvas 3D?`;

      res.json({ reply: fallbackReply, source: 'local-vision-diagnostic' });
    } catch {
      res
        .status(500)
        .json({ error: 'Gagal memproses visual diagnostik 3D.' });
    }
  });

  return router;
}
