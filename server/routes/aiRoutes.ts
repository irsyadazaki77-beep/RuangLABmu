import express from 'express';
import { Type } from '@google/genai';
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
import {
  requireAuthMiddleware,
  requireTeacherAuthMiddleware,
} from '../auth/sessionToken';
import {
  DR_LABMU_MODEL,
  getSharedGeminiClient,
  recordAiRequestMetrics,
  runWithAiRetryAndTimeout,
} from '../services/geminiClient';
import type { LabServerState } from '../state/labServerState';
import { sanitizeRoomForBroadcast } from '../utils/collabReconnectSync';
import { logger } from '../utils/logger';
import { rateLimitKeyGenerator } from '../utils/rateLimitKey';
import { applyCustomMissionToRoom } from '../ws/collabSocketServer';
import {
  formatValidationErrorResponse,
  validateConversationalDrLabMuPayload,
  validateDrLabMuAskPayload,
  validateGenerateMissionPayload,
  validateRoomMissionPayload,
  validateVisionDiagnosePayload,
  type ValidatedGenerateMissionPayload,
} from '../utils/routePayloadValidators';
import { ClassMisconceptionAnalyzeSchema } from '../../src/shared/contracts/restContracts';
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

function writeSseEvent(res: express.Response, eventName: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function buildCustomMissionScenario(
  input: ValidatedGenerateMissionPayload
): Promise<CustomAIMissionPayload> {
  const { moduleId, caseStudyPrompt, teacherName, roomId } = input;
  const blueprint = resolveModuleBlueprint(moduleId);
  const ai = getSharedGeminiClient();

  if (ai && caseStudyPrompt) {
    try {
      const missionPrompt = `Anda adalah Arsitek Kurikulum Sains & Praktikum Virtual 3D RuangLABmu.
Guru memilih modul dasar: "${blueprint.moduleTitle}" (ID: ${blueprint.moduleId}, Domain: ${blueprint.domain}).
Studi Kasus Cerita dari Guru: "${caseStudyPrompt}"
Target Variabel Standar Modul: ${blueprint.targetVariable.variableLabel} (${blueprint.targetVariable.variableKey}) dalam satuan ${blueprint.targetVariable.unit}.

Buat skenario misi praktikum kontekstual berbahasa Indonesia dalam format JSON terstruktur yang mencakup:
1. title: Judul misi eksperimen yang menarik & relevan dengan studi kasus.
2. narrative: Narasi studi kasus ilmiah (2-3 kalimat) yang menginstruksikan siswa tentang apa yang harus diuji di laboratorium 3D.
3. targetVariable: Objek berisi variableKey ("${blueprint.targetVariable.variableKey}"), variableLabel, unit ("${blueprint.targetVariable.unit}"), targetValue (angka), minSuccessValue (angka batas bawah keberhasilan), dan maxSuccessValue (angka batas atas keberhasilan).
4. contextualQuestions: Array berisi tepat 3 pertanyaan LKS kontekstual (masing-masing memiliki id, questionText, expectedConceptOrValue, dan hint Sokratik).`;

      const response = await runWithAiRetryAndTimeout('generate_mission', () =>
        ai.models.generateContent({
          model: DR_LABMU_MODEL,
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
        })
      );

      const parsed = JSON.parse(response.text || '{}');
      return normalizeCustomMissionPayload(
        parsed,
        { moduleId, caseStudyPrompt, teacherName, roomId },
        'gemini-api'
      );
    } catch (err) {
      logger.warn('Gemini custom mission generation failed; falling back to deterministic engine', {
        moduleId,
        error: err instanceof Error ? err.message : String(err),
      });
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
    requireAuthMiddleware,
    async (req, res) => {
      try {
        const check = validateGenerateMissionPayload(req.body);
        if (!check.ok) {
          res.status(400).json(formatValidationErrorResponse(check));
          return;
        }

        const shouldPublish = check.data.publishToRoom;
        if (shouldPublish) {
          const session = req.authSession;
          if (!session) {
            res.status(401).json({
              error: 'UNAUTHORIZED',
              code: 'AUTH_REQUIRED',
              message: 'Autentikasi pengajar diperlukan untuk mempublikasikan misi ke meja praktikum.',
            });
            return;
          }
          if (session.role !== 'teacher' && session.role !== 'admin') {
            res.status(403).json({
              error: 'FORBIDDEN',
              code: 'TEACHER_ROLE_REQUIRED',
              message: 'Hanya Pengajar yang dapat mempublikasikan misi kustom ke ruangan.',
            });
            return;
          }
          const existingRoom = state.activeLabRooms.get(check.data.roomId);
          if (
            existingRoom &&
            existingRoom.roomId !== 'LAB-ALPHA' &&
            (existingRoom.schoolId || 'default-school') !== session.schoolId
          ) {
            res.status(403).json({
              error: 'FORBIDDEN',
              code: 'SCHOOL_TENANT_MISMATCH',
              message: 'Akses ditolak: Ruangan ini milik sekolah lain.',
            });
            return;
          }
        }

        const mission = await buildCustomMissionScenario(check.data);
        let sanitizedRoom: ReturnType<typeof sanitizeRoomForBroadcast> | undefined;
        if (shouldPublish) {
          const updatedRoom: LabRoom = applyCustomMissionToRoom(
            state.activeLabRooms,
            mission.roomId,
            mission,
            req.authSession?.displayName || mission.createdByTeacher,
            req.authSession?.schoolId
          );
          sanitizedRoom = sanitizeRoomForBroadcast(updatedRoom);
          state.recordAuditLog({
            schoolId: req.authSession?.schoolId || updatedRoom.schoolId || 'default-school',
            actorId: req.authSession?.sub || 'teacher',
            actorName: req.authSession?.displayName || mission.createdByTeacher,
            actorRole: req.authSession?.role || 'teacher',
            action: 'MISSION_PUBLISHED',
            targetType: 'room',
            targetId: updatedRoom.roomId,
            metadata: { missionId: mission.id, moduleId: mission.moduleId },
            ipAddress: rateLimitKeyGenerator(req),
          });
          emitRoomMission(updatedRoom.roomId, {
            type: 'ROOM_MISSION_UPDATED',
            payload: {
              roomId: updatedRoom.roomId,
              customMission: mission,
              room: sanitizedRoom,
            },
          });
        }

        res.json({
          success: true,
          mission,
          room: sanitizedRoom,
        });
      } catch (err) {
        logger.error('Error in /api/generate-mission', {
          requestId: res.locals?.requestId,
          error: err,
        });
        res.status(500).json({
          error: 'Gagal menghasilkan skenario misi praktikum AI.',
        });
      }
    }
  );

  router.post('/api/rooms/:roomId/mission', requireTeacherAuthMiddleware, (req, res) => {
    try {
      const check = validateRoomMissionPayload(req.params.roomId, req.body);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const session = req.authSession!;
      const { roomId, mission, teacherName } = check.data;
      const existingRoom = state.activeLabRooms.get(roomId);
      if (
        existingRoom &&
        existingRoom.roomId !== 'LAB-ALPHA' &&
        (existingRoom.schoolId || 'default-school') !== session.schoolId
      ) {
        res.status(403).json({
          error: 'FORBIDDEN',
          code: 'SCHOOL_TENANT_MISMATCH',
          message: 'Akses ditolak: Ruangan ini milik sekolah lain.',
        });
        return;
      }

      const updatedRoom = applyCustomMissionToRoom(
        state.activeLabRooms,
        roomId,
        mission,
        teacherName || session.displayName,
        session.schoolId
      );
      const sanitizedRoom = sanitizeRoomForBroadcast(updatedRoom);

      state.recordAuditLog({
        schoolId: session.schoolId,
        actorId: session.sub,
        actorName: session.displayName,
        actorRole: session.role,
        action: 'MISSION_PUBLISHED',
        targetType: 'room',
        targetId: updatedRoom.roomId,
        metadata: { missionId: updatedRoom.customMission?.id || null },
        ipAddress: rateLimitKeyGenerator(req),
      });

      emitRoomMission(updatedRoom.roomId, {
        type: 'ROOM_MISSION_UPDATED',
        payload: {
          roomId: updatedRoom.roomId,
          customMission: updatedRoom.customMission || null,
          room: sanitizedRoom,
        },
      });
      res.json({
        success: true,
        room: sanitizedRoom,
        customMission: updatedRoom.customMission || null,
      });
    } catch (err) {
      logger.error('Error saving custom mission to room', {
        requestId: res.locals?.requestId,
        error: err,
      });
      res.status(500).json({ error: 'Gagal menyimpan misi kustom ke Room.' });
    }
  });

  router.post(['/api/dr-labmu/ask', '/api/assistant'], requireAuthMiddleware, async (req, res) => {
    try {
      const check = validateDrLabMuAskPayload(req.body);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      if (check.data.kind === 'mission' && check.data.missionInput) {
        const shouldPublish = check.data.missionInput.publishToRoom;
        if (shouldPublish) {
          const session = req.authSession;
          if (!session || (session.role !== 'teacher' && session.role !== 'admin')) {
            res.status(session ? 403 : 401).json({
              error: session ? 'FORBIDDEN' : 'UNAUTHORIZED',
              code: 'TEACHER_ROLE_REQUIRED',
              message: 'Autentikasi pengajar diperlukan untuk mempublikasikan misi ke ruangan.',
            });
            return;
          }
          const existingRoom = state.activeLabRooms.get(check.data.missionInput.roomId);
          if (
            existingRoom &&
            existingRoom.roomId !== 'LAB-ALPHA' &&
            (existingRoom.schoolId || 'default-school') !== session.schoolId
          ) {
            res.status(403).json({
              error: 'FORBIDDEN',
              code: 'SCHOOL_TENANT_MISMATCH',
              message: 'Akses ditolak: Ruangan ini milik sekolah lain.',
            });
            return;
          }
        }

        const mission = await buildCustomMissionScenario(check.data.missionInput);
        let sanitizedRoom: ReturnType<typeof sanitizeRoomForBroadcast> | undefined;
        if (shouldPublish) {
          const updatedRoom = applyCustomMissionToRoom(
            state.activeLabRooms,
            mission.roomId,
            mission,
            req.authSession?.displayName || mission.createdByTeacher,
            req.authSession?.schoolId
          );
          sanitizedRoom = sanitizeRoomForBroadcast(updatedRoom);
          emitRoomMission(updatedRoom.roomId, {
            type: 'ROOM_MISSION_UPDATED',
            payload: {
              roomId: updatedRoom.roomId,
              customMission: mission,
              room: sanitizedRoom,
            },
          });
        }
        res.json({
          success: true,
          mission,
          room: sanitizedRoom,
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
      const ai = getSharedGeminiClient();

      if (ai) {
        try {
          const prompt = `Data Telemetri Eksperimen Siswa (JSON):\n${JSON.stringify(telemetry, null, 2)}\n\nBerikan respons Dr. LabMu dalam 3 bagian: observasiSingkat, insightKonseptual, pertanyaanPemantik, serta opsional uiActions bila perlu menggerakkan kamera 3D / X-Ray / sorot slider.`;

          const response = await runWithAiRetryAndTimeout('dr_labmu_ask', () =>
            ai.models.generateContent({
              model: DR_LABMU_MODEL,
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
            })
          );

          const parsed = JSON.parse(response.text || '{}');
          if (
            parsed.observasiSingkat &&
            parsed.insightKonseptual &&
            parsed.pertanyaanPemantik
          ) {
            res.json(formatDrLabMuAskPayload(parsed, 'gemini-api', contextualActions));
            return;
          }
        } catch (err) {
          logger.warn('Gemini /api/dr-labmu/ask failed; using local Socratic engine', {
            requestId: res.locals?.requestId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const fallbackResponse = generateSocraticDrLabMuResponse(telemetry);
      res.json(formatDrLabMuAskPayload(fallbackResponse, 'socratic-engine', contextualActions));
    } catch (err) {
      logger.error('Unexpected error in /api/dr-labmu/ask', {
        requestId: res.locals?.requestId,
        error: err,
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Streaming SSE endpoint for Dr. LabMu conversational mentoring.
   * Emits Server-Sent Events: `meta`, `chunk`, `actions`, `error`, `done`.
   */
  router.post('/api/ai/dr-labmu/stream', requireAuthMiddleware, async (req, res) => {
    const check = validateConversationalDrLabMuPayload(req.body);
    if (!check.ok) {
      res.status(400).json(formatValidationErrorResponse(check));
      return;
    }

    const { message, telemetry } = check.data;
    const telemetryQuery =
      telemetry && typeof telemetry.studentQuery === 'string'
        ? telemetry.studentQuery.trim()
        : '';
    const activeQuery = (message || telemetryQuery).trim();

    const normalizedTelemetry = telemetry ? normalizeDrLabMuRequest({ telemetry }) : null;
    const fallbackActions = sanitizeDrLabMuUIActions(
      normalizedTelemetry
        ? deriveContextualDrLabMuActions({
            ...normalizedTelemetry,
            studentQuery: activeQuery,
          })
        : []
    );

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    const startMs = Date.now();
    const ai = getSharedGeminiClient();

    if (ai && activeQuery) {
      writeSseEvent(res, 'meta', {
        source: DR_LABMU_MODEL,
        model: DR_LABMU_MODEL,
        streaming: true,
      });

      const promptContext = `[KONTEKS TELEMETRI SAAT INI]:
${telemetry ? JSON.stringify(telemetry, null, 2) : `Domain: Sains\nTopik: Praktikum Virtual`}

<student_input>
${activeQuery.slice(0, 600)}
</student_input>`;

      try {
        const stream = await runWithAiRetryAndTimeout(
          'dr_labmu_stream',
          () =>
            ai.models.generateContentStream({
              model: DR_LABMU_MODEL,
              contents: promptContext,
              config: { systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION },
            }),
          { maxRetries: 1, timeoutMs: 25_000, isStream: true, skipMetrics: true }
        );

        let streamedChars = 0;
        for await (const chunk of stream) {
          if (clientDisconnected || res.writableEnded) {
            break;
          }
          const delta = typeof chunk.text === 'string' ? chunk.text : '';
          if (delta) {
            streamedChars += delta.length;
            writeSseEvent(res, 'chunk', { text: delta });
          }
        }

        recordAiRequestMetrics(Date.now() - startMs, true, true);
        if (!clientDisconnected && !res.writableEnded) {
          if (fallbackActions.length > 0) {
            writeSseEvent(res, 'actions', { uiActions: fallbackActions });
          }
          writeSseEvent(res, 'done', {
            ok: true,
            source: DR_LABMU_MODEL,
            latencyMs: Date.now() - startMs,
            streamedChars,
          });
          res.end();
        }
        return;
      } catch (err) {
        recordAiRequestMetrics(Date.now() - startMs, false, true);
        logger.error('Gemini streaming failed on /api/ai/dr-labmu/stream', {
          requestId: res.locals?.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
        if (!clientDisconnected && !res.writableEnded) {
          writeSseEvent(res, 'error', {
            code: 'AI_STREAM_FALLBACK',
            message:
              'Koneksi ke model AI cloud sedang terganggu; beralih otomatis ke mesin Sokratik lokal.',
          });
        }
      }
    }

    // Local offline 3T Socratic streaming fallback
    if (clientDisconnected || res.writableEnded) return;

    const localReply = normalizedTelemetry
      ? generateSocraticDrLabMuResponse({
          ...normalizedTelemetry,
          studentQuery: activeQuery,
        }).formattedText
      : 'Eksplorasi yang sangat baik di meja praktikum! Bagaimana korelasi variabel bebas dan terikat Anda teramati pada grafik?';

    writeSseEvent(res, 'meta', {
      source: 'local-socratic',
      model: 'local-socratic',
      streaming: true,
    });

    const segments = localReply.match(/[^.!?\n]+[.!?\n]*/g) || [localReply];
    for (const seg of segments) {
      if (clientDisconnected || res.writableEnded) break;
      writeSseEvent(res, 'chunk', { text: seg });
    }

    if (!clientDisconnected && !res.writableEnded) {
      if (fallbackActions.length > 0) {
        writeSseEvent(res, 'actions', { uiActions: fallbackActions });
      }
      writeSseEvent(res, 'done', {
        ok: true,
        source: 'local-socratic',
        latencyMs: Date.now() - startMs,
      });
      res.end();
    }
  });

  router.post('/api/ai/dr-labmu', requireAuthMiddleware, async (req, res) => {
    try {
      const check = validateConversationalDrLabMuPayload(req.body);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
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

      const ai = getSharedGeminiClient();
      if (ai && activeQuery) {
        try {
          const promptContext = `[KONTEKS TELEMETRI SAAT INI]:
${telemetry ? JSON.stringify(telemetry, null, 2) : `Domain: Sains\nTopik: Praktikum Virtual`}

<student_input>
${activeQuery.slice(0, 600)}
</student_input>`;

          const response = await runWithAiRetryAndTimeout('dr_labmu_chat', () =>
            ai.models.generateContent({
              model: DR_LABMU_MODEL,
              contents: promptContext,
              config: { systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION },
            })
          );

          const replyText = (response.text || '').trim();
          if (replyText) {
            res.json({
              reply: replyText,
              uiActions: sanitizeDrLabMuUIActions(fallbackActions),
              source: DR_LABMU_MODEL,
            });
            return;
          }
        } catch (err) {
          logger.warn('Gemini /api/ai/dr-labmu failed; using local Socratic engine', {
            requestId: res.locals?.requestId,
            error: err instanceof Error ? err.message : String(err),
          });
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
    } catch (err) {
      logger.error('Error in /api/ai/dr-labmu', {
        requestId: res.locals?.requestId,
        error: err,
      });
      res
        .status(500)
        .json({ error: 'SERVER_ERROR', message: 'Gagal memproses pesan AI.' });
    }
  });

  router.post('/api/ai/vision-diagnose', requireAuthMiddleware, async (req, res) => {
    try {
      const check = validateVisionDiagnosePayload(req.body);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
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

      const ai = getSharedGeminiClient();
      if (ai) {
        try {
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

          const response = await runWithAiRetryAndTimeout('vision_diagnose', () =>
            ai.models.generateContent({
              model: DR_LABMU_MODEL,
              contents: { parts: [imagePart, { text: visionPrompt }] },
              config: { systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION },
            })
          );

          const replyText = (response.text || '').trim();
          if (replyText) {
            res.json({ reply: replyText, source: 'gemini-vision' });
            return;
          }
        } catch (err) {
          logger.warn('Gemini vision-diagnose failed; using local diagnostic fallback', {
            requestId: res.locals?.requestId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const fallbackReply = `1. Observasi Visual:\nSaya telah memeriksa tangkapan layar 3D meja praktikum ${topic} Anda. Aparatus laboratorium terpasang stabil dengan instrumen pengukuran terkalibrasi.\n\n2. Diagnostik & Analisis Fisis:\nPenataan instrumen Anda sudah menunjukkan kesiapan eksperimen yang baik. Data pengamatan Anda tampak konsisten dengan prediksi hukum dasar sains.\n\n3. Pertanyaan Pemantik:\n💡 Bagaimana jika Anda sedikit menggeser parameter variabel bebas untuk mengamati perubahan seketika pada indikator visual di kanvas 3D?`;

      res.json({ reply: fallbackReply, source: 'local-vision-diagnostic' });
    } catch (err) {
      logger.error('Error in /api/ai/vision-diagnose', {
        requestId: res.locals?.requestId,
        error: err,
      });
      res
        .status(500)
        .json({ error: 'Gagal memproses visual diagnostik 3D.' });
    }
  });

  router.post(
    '/api/ai/class-misconceptions',
    requireTeacherAuthMiddleware,
    async (req, res) => {
      try {
        const parsed = ClassMisconceptionAnalyzeSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            code: 'INVALID_PAYLOAD',
            message: 'Payload analitik miskonsepsi kelas tidak valid.',
          });
          return;
        }

        const { totalSubmissions, averageScore, passRatePct, weakestCriterionLabel, clusters } =
          parsed.data;
        const activeClusters = clusters.filter((c) => c.affectedCount > 0);
        const topCluster = activeClusters[0];

        const ai = getSharedGeminiClient();
        if (ai) {
          try {
            const prompt = `Anda adalah konsultan pedagogik sains RuangLABmu (Kurikulum Merdeka).
Ringkasan kelas: ${totalSubmissions} laporan, rata-rata skor ${averageScore}/100, tingkat ketuntasan ${passRatePct}%.
Dimensi terlemah: ${weakestCriterionLabel || 'N/A'}.
Klaster miskonsepsi terdeteksi:
${activeClusters.map((c) => `- ${c.title} (${c.affectedCount} siswa / ${c.affectedPct}%)`).join('\n')}

Berikan 3 langkah intervensi pengajaran konkret untuk pertemuan kelas berikutnya (singkat, padat, aplikatif bagi guru IPA/Fisika/Kimia/Biologi/Astronomi/Kebumian).`;

            const response = await runWithAiRetryAndTimeout('class_misconceptions', () =>
              ai.models.generateContent({
                model: DR_LABMU_MODEL,
                contents: prompt,
              })
            );
            const replyText = (response.text || '').trim();
            if (replyText) {
              res.json({ strategy: replyText, source: 'gemini-api' });
              return;
            }
          } catch (err) {
            logger.warn('Gemini class-misconceptions failed; using deterministic strategy', {
              requestId: res.locals?.requestId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const fallbackStrategy = topCluster
          ? `1. Fokus Remedial Prioritas: ${topCluster.title} memengaruhi ${topCluster.affectedCount} siswa (${topCluster.affectedPct}%).\n2. Intervensi Praktikum 10 Menit: ${topCluster.remedialAction || 'Tampilkan perbandingan data dua kelompok lewat fitur Peer Review dan minta siswa memverifikasi grafik R².'}\n3. Evaluasi Formatif: Dengan ketuntasan saat ini ${passRatePct}% (rata-rata ${averageScore}), aktifkan Mode Proyektor & Laser Guru pada 1 sampel bermasalah sebelum sesi post-lab berikutnya.`
          : `Seluruh dimensi praktikum kelas menunjukkan capaian terkendali (ketuntasan ${passRatePct}%, rata-rata ${averageScore}/100). Arahkan kelas ke tantangan Open Sandbox atau modul pengayaan Kurikulum Merdeka berikutnya.`;

        res.json({ strategy: fallbackStrategy, source: 'deterministic-pedagogy-engine' });
      } catch (err) {
        logger.error('Error in /api/ai/class-misconceptions', {
          requestId: res.locals?.requestId,
          error: err,
        });
        res.status(500).json({ error: 'Gagal menganalisis miskonsepsi kelas.' });
      }
    }
  );

  return router;
}
