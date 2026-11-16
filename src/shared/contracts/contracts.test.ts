import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { WebSocket } from 'ws';
import {
  AutosavePayloadSchema,
  RoomRejoinSchema,
  RoomSnapshotSchema,
  SubmissionCreateSchema,
  GenerateMissionSchema,
  VisionDiagnoseSchema,
} from './restContracts';
import {
  ClientToServerMessageSchema,
  ServerToClientMessageSchema,
} from './wsContracts';
import { parseClientToServerWsMessage } from '../../../server/ws/wsAuth';
import { createLabServerState } from '../../../server/state/labServerState';
import { createCollabSocketServer } from '../../../server/ws/collabSocketServer';

describe('Shared Zod Contracts (REST & WebSocket)', () => {
  it('validates REST contracts and rejects malformed payloads', () => {
    const validAutosave = AutosavePayloadSchema.safeParse({
      storageKey: 'ruanglab_session_alya_newton',
      version: 3,
      studentId: 'alya',
      session: { moduleId: 'newton-incline' },
    });
    assert.equal(validAutosave.success, true);

    const invalidAutosave = AutosavePayloadSchema.safeParse({
      storageKey: '   ',
      version: Number.NaN,
      session: {},
    });
    assert.equal(invalidAutosave.success, false);

    const validRejoin = RoomRejoinSchema.safeParse({
      roomPin: '842619',
      participantId: 'stu-01',
    });
    assert.equal(validRejoin.success, true);

    const invalidRejoin = RoomRejoinSchema.safeParse({
      roomPin: '',
      participantId: '',
    });
    assert.equal(invalidRejoin.success, false);

    const validSnapshot = RoomSnapshotSchema.safeParse({
      roomPin: '842619',
      params: { mass: 4.5, angleDeg: 30 },
    });
    assert.equal(validSnapshot.success, true);
    assert.equal(
      RoomSnapshotSchema.safeParse({ roomPin: '842619', params: 'not-an-object' }).success,
      false
    );

    const validSubmission = SubmissionCreateSchema.safeParse({
      studentName: 'Budi Santoso',
      moduleId: 'newton-incline',
      domain: 'physics',
      quizScore: 85,
      observationData: [{ t: 1.5, x: '2.25' }],
    });
    assert.equal(validSubmission.success, true);

    const invalidSubmission = SubmissionCreateSchema.safeParse({
      studentName: 'Budi',
      moduleId: 'newton-incline',
      quizScore: 150,
    });
    assert.equal(invalidSubmission.success, false);

    assert.equal(
      GenerateMissionSchema.safeParse({
        moduleId: 'newton-incline',
        caseStudyPrompt: 'Simulasi luncuran peti bantuan di lereng gunung Papua',
        publishToRoom: true,
      }).success,
      true
    );
    assert.equal(
      GenerateMissionSchema.safeParse({
        moduleId: 'newton-incline',
        caseStudyPrompt: '   ',
      }).success,
      false
    );

    assert.equal(
      VisionDiagnoseSchema.safeParse({
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      }).success,
      true
    );
    assert.equal(
      VisionDiagnoseSchema.safeParse({
        image: 'https://example.com/not-data-url.png',
      }).success,
      false
    );
  });

  it('validates ClientToServer and ServerToClient WebSocket discriminated unions', () => {
    const validJoin = ClientToServerMessageSchema.safeParse({
      type: 'ROOM_JOIN',
      payload: {
        roomId: 'LAB-01',
        pin: '123456',
        name: 'Sinta',
        role: 'student',
      },
    });
    assert.equal(validJoin.success, true);

    const invalidParamSync = ClientToServerMessageSchema.safeParse({
      type: 'PARAM_VALUE_SYNC',
      payload: {
        groupId: 'Kelompok 1',
        paramKey: 'gravity',
        value: Number.NaN,
      },
    });
    assert.equal(invalidParamSync.success, false);

    const invalidType = parseClientToServerWsMessage({
      type: 'UNKNOWN_EVENT_TYPE',
      payload: {},
    });
    assert.equal(invalidType.ok, false);
    if (!invalidType.ok) {
      assert.ok(invalidType.issues.length > 0);
    }

    const validServerError = ServerToClientMessageSchema.safeParse({
      type: 'ERROR',
      payload: {
        code: 'VALIDATION_ERROR',
        message: 'Payload tidak valid',
        issues: [{ path: 'payload.value', message: 'Expected finite number' }],
      },
    });
    assert.equal(validServerError.success, true);

    const validRoomSync = ServerToClientMessageSchema.safeParse({
      type: 'ROOM_STATE_SYNC',
      payload: {
        room: {
          roomId: 'LAB-01',
          domain: 'physics',
          moduleId: 'newton-incline',
          isFrozenByTeacher: false,
          createdAt: Date.now(),
          clients: {},
        },
      },
    });
    assert.equal(validRoomSync.success, true);
  });

  it('rejects malformed WebSocket messages over a live WS connection with structured ERROR payload', async () => {
    const state = createLabServerState({ dbPath: ':memory:' });
    const server = http.createServer();
    const { wss } = createCollabSocketServer(server, state);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const wsUrl = `ws://127.0.0.1:${addr.port}/ws-lab`;

    const client = new WebSocket(wsUrl);
    try {
      const received = await new Promise<Array<{ type: string; payload?: Record<string, unknown> }>>(
        (resolve, reject) => {
          const messages: Array<{ type: string; payload?: Record<string, unknown> }> = [];
          const timeout = setTimeout(() => reject(new Error('WS validation test timed out')), 4000);

          client.on('open', () => {
            client.send(
              JSON.stringify({
                type: 'PARAM_VALUE_SYNC',
                payload: {
                  groupId: 'G1',
                  paramKey: '',
                  value: 'not-a-number',
                },
              })
            );
          });

          client.on('message', (raw) => {
            const parsed = JSON.parse(raw.toString()) as {
              type: string;
              payload?: Record<string, unknown>;
            };
            messages.push(parsed);
            if (parsed.type === 'ERROR') {
              clearTimeout(timeout);
              resolve(messages);
            }
          });

          client.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        }
      );

      const errorFrame = received.find((m) => m.type === 'ERROR');
      assert.ok(errorFrame);
      assert.equal(errorFrame.payload?.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(errorFrame.payload?.issues));
      assert.ok((errorFrame.payload?.issues as unknown[]).length > 0);
    } finally {
      client.close();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
      state.dispose();
    }
  });
});
