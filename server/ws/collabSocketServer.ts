import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyTeacherAuthorization } from '../../src/utils/submissionPersistence';
import {
  CustomAIMissionPayload,
  LabRoom,
  LabRoomClient,
  ParameterLockPayload,
  SpatialCursorPayload,
  generateRandomRoomId,
  validateTeacherCameraSyncPayload,
  validateTeacherLaserRayPayload,
} from '../../src/utils/collabProtocol';
import type {
  CollabNote,
  GroupTask,
  LabServerState,
  ServerExperimentRecord,
  ServerNotification,
  StudentProgress,
} from '../state/labServerState';
import { buildRoomReconnectSnapshot } from '../utils/collabReconnectSync';

export interface ExtWebSocket extends WebSocket {
  socketId: string;
  userId?: string;
  userName?: string;
  role?: 'Siswa' | 'Pengajar';
  groupId?: string;
  domain?: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  roomId?: string;
}

export interface CollabSocketContext {
  wss: WebSocketServer;
  broadcastAll: (payload: unknown) => void;
  broadcastRoom: (roomId: string, payload: unknown, excludeWs?: WebSocket) => void;
  broadcastGroup: (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket,
    roomIdScope?: string
  ) => void;
}

export function applyCustomMissionToRoom(
  activeLabRooms: Map<string, LabRoom>,
  roomIdRaw: string,
  mission: CustomAIMissionPayload | null,
  teacherName?: string
): LabRoom {
  const targetRoomId = (roomIdRaw || 'LAB-ALPHA').toUpperCase().trim();
  let room = activeLabRooms.get(targetRoomId);
  if (!room) {
    room = {
      roomId: targetRoomId,
      pin: '1234',
      domain: mission?.domain || 'physics',
      moduleId: mission?.moduleId || 'newton-incline',
      teacherName: teacherName || mission?.createdByTeacher || 'Dr. Hendra Kusuma',
      isFrozenByTeacher: false,
      createdAt: Date.now(),
      clients: {},
      customMission: mission,
    };
    activeLabRooms.set(targetRoomId, room);
  } else {
    room.customMission = mission;
    if (mission) {
      room.domain = mission.domain;
      room.moduleId = mission.moduleId;
    }
  }
  return room;
}

export function createCollabSocketServer(
  server: http.Server,
  state: LabServerState
): CollabSocketContext {
  const {
    experimentRecords,
    groupTasks,
    collabNotes,
    studentRoster,
    notifications,
    parameterLocks,
    activeLabRooms,
    pruneExpiredLocks,
    persistServerState,
  } = state;

  const wss = new WebSocketServer({ server, path: '/ws-lab' });

  const broadcastAll = (payload: unknown) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    });
  };

  const broadcastRoom = (
    roomId: string,
    payload: unknown,
    excludeWs?: WebSocket
  ) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (
        client.readyState === WebSocket.OPEN &&
        client.roomId === roomId &&
        client !== excludeWs
      ) {
        client.send(raw);
      }
    });
  };

  const broadcastGroup = (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket,
    roomIdScope?: string
  ) => {
    if (roomIdScope) {
      broadcastRoom(roomIdScope, payload, excludeWs);
      return;
    }
    const raw = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        if (
          !targetGroupId ||
          client.groupId === targetGroupId ||
          client.role === 'Pengajar' ||
          !client.groupId
        ) {
          client.send(raw);
        }
      }
    });
  };

  wss.on('connection', (socket) => {
    const ws = socket as ExtWebSocket;
    ws.socketId = 'sock-' + Math.random().toString(36).slice(2, 9);

    pruneExpiredLocks();

    ws.send(
      JSON.stringify({
        type: 'init:state',
        payload: {
          records: experimentRecords,
          tasks: groupTasks,
          notes: collabNotes,
          students: studentRoster,
          notifications,
          paramLocks: Array.from(parameterLocks.values()),
        },
      })
    );

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'client:identify' && msg.payload) {
          ws.userId = msg.payload.userId;
          ws.userName = msg.payload.userName;
          ws.groupId = msg.payload.groupId;
          ws.domain = msg.payload.domain;
          if (msg.payload.roomId) {
            ws.roomId = msg.payload.roomId.toUpperCase().trim();
          }
          const activeRoom = ws.roomId ? activeLabRooms.get(ws.roomId) : undefined;
          const authCheck = verifyTeacherAuthorization({
            socketId: ws.socketId,
            claimedRole: msg.payload.role,
            providedPin: msg.payload.teacherPin || msg.payload.pin,
            providedToken: msg.payload.teacherToken,
            roomPin: activeRoom?.pin,
            roomTeacherSocketId: activeRoom?.teacherSocketId,
            isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
          });
          ws.role = authCheck.authorized ? 'Pengajar' : 'Siswa';
        } else if (msg.type === 'ROOM_CREATE' && msg.payload) {
          const {
            pin,
            domain,
            moduleId,
            teacherName,
            teacherUserId,
            roomId: customId,
          } = msg.payload;
          const roomId = (customId || generateRandomRoomId()).toUpperCase().trim();
          const newRoom: LabRoom = {
            roomId,
            pin: String(pin || '1234').trim(),
            domain: domain || 'physics',
            moduleId: moduleId || 'newton-incline',
            teacherSocketId: ws.socketId,
            teacherName: teacherName || ws.userName || 'Guru',
            isFrozenByTeacher: false,
            createdAt: Date.now(),
            clients: {
              [ws.socketId]: {
                socketId: ws.socketId,
                userId: teacherUserId || ws.userId || 'teacher-1',
                name: teacherName || ws.userName || 'Guru',
                role: 'teacher',
                joinedAt: Date.now(),
              },
            },
          };
          activeLabRooms.set(roomId, newRoom);
          ws.roomId = roomId;
          ws.role = 'Pengajar';

          ws.send(JSON.stringify({ type: 'ROOM_CREATED', payload: { room: newRoom } }));
          broadcastRoom(roomId, { type: 'ROOM_STATE_SYNC', payload: { room: newRoom } });
        } else if (msg.type === 'ROOM_JOIN' && msg.payload) {
          const {
            roomId: rawRoomId,
            pin: inputPin,
            name,
            role,
            userId,
            groupId,
            isReconnect,
          } = msg.payload;
          const roomId = (rawRoomId || '').toUpperCase().trim();
          const room = activeLabRooms.get(roomId);

          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'ROOM_ERROR',
                payload: {
                  message: `Meja praktikum [${roomId}] tidak ditemukan. Periksa kembali kode ruangan.`,
                  code: 'ROOM_NOT_FOUND',
                },
              })
            );
            return;
          }

          if (room.pin && String(room.pin).trim() !== String(inputPin || '').trim()) {
            ws.send(
              JSON.stringify({
                type: 'ROOM_ERROR',
                payload: {
                  message: `Kode PIN untuk meja [${roomId}] salah. Hubungi guru atau pembuat meja.`,
                  code: 'INVALID_PIN',
                },
              })
            );
            return;
          }

          if (ws.roomId && ws.roomId !== roomId && activeLabRooms.has(ws.roomId)) {
            const prev = activeLabRooms.get(ws.roomId)!;
            delete prev.clients[ws.socketId];
            broadcastRoom(ws.roomId, { type: 'ROOM_STATE_SYNC', payload: { room: prev } });
          }

          const clientRole =
            role === 'teacher' || role === 'Pengajar' ? 'teacher' : 'student';
          const resolvedUserId = userId || ws.userId || `user-${Date.now()}`;

          // Remove stale client entries for the same userId inside this room on reconnect
          for (const [existingSockId, existingClient] of Object.entries(room.clients)) {
            if (existingSockId !== ws.socketId && existingClient.userId === resolvedUserId) {
              delete room.clients[existingSockId];
            }
          }

          const roomClient: LabRoomClient = {
            socketId: ws.socketId,
            userId: resolvedUserId,
            name: name || ws.userName || 'Siswa',
            role: clientRole,
            groupId: groupId || ws.groupId,
            joinedAt: Date.now(),
          };

          room.clients[ws.socketId] = roomClient;
          ws.roomId = roomId;
          ws.userId = roomClient.userId;
          ws.userName = roomClient.name;
          ws.groupId = roomClient.groupId;
          ws.role = clientRole === 'teacher' ? 'Pengajar' : 'Siswa';
          if (clientRole === 'teacher') {
            room.teacherSocketId = ws.socketId;
            room.teacherName = roomClient.name;
          }

          pruneExpiredLocks();
          const snapshot = buildRoomReconnectSnapshot(
            room,
            roomClient,
            parameterLocks,
            Boolean(isReconnect)
          );

          ws.send(JSON.stringify(snapshot.roomJoinedMessage));
          ws.send(JSON.stringify(snapshot.paramLocksSyncMessage));
          broadcastRoom(roomId, snapshot.roomStateSyncMessage);
        } else if (msg.type === 'ROOM_LEAVE') {
          if (ws.roomId && activeLabRooms.has(ws.roomId)) {
            const room = activeLabRooms.get(ws.roomId)!;
            delete room.clients[ws.socketId];
            if (room.teacherSocketId === ws.socketId) {
              room.teacherSocketId = undefined;
            }
            const oldId = ws.roomId;
            ws.roomId = undefined;
            broadcastRoom(oldId, { type: 'ROOM_STATE_SYNC', payload: { room } });
          }
        } else if (msg.type === 'TEACHER_FREEZE_TOGGLE' && msg.payload) {
          const { roomId, isFrozen, teacherName, teacherPin, pin } = msg.payload;
          const targetRoomId = (roomId || ws.roomId || '').toUpperCase().trim();
          const room = activeLabRooms.get(targetRoomId);
          if (room) {
            const authCheck = verifyTeacherAuthorization({
              socketId: ws.socketId,
              claimedRole: 'Pengajar',
              providedPin: teacherPin || pin,
              roomPin: room.pin,
              roomTeacherSocketId: room.teacherSocketId,
              isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
            });
            if (!authCheck.authorized) {
              ws.send(
                JSON.stringify({
                  type: 'ROOM_ERROR',
                  payload: {
                    message: authCheck.reason || 'Akses Pengajar ditolak.',
                    code: 'UNAUTHORIZED_TEACHER',
                  },
                })
              );
              return;
            }
            room.isFrozenByTeacher = Boolean(isFrozen);
            broadcastRoom(targetRoomId, {
              type: 'TEACHER_FREEZE_TOGGLE',
              payload: {
                roomId: targetRoomId,
                isFrozen: room.isFrozenByTeacher,
                teacherName: teacherName || ws.userName || room.teacherName || 'Guru',
              },
            });
            broadcastRoom(targetRoomId, { type: 'ROOM_STATE_SYNC', payload: { room } });
          }
        } else if (msg.type === 'TEACHER_LASER_RAY' && msg.payload) {
          const targetRoomId = (msg.payload.roomId || ws.roomId || 'LAB-ALPHA')
            .toString()
            .toUpperCase()
            .trim();
          const room = activeLabRooms.get(targetRoomId);
          const authCheck = verifyTeacherAuthorization({
            socketId: ws.socketId,
            claimedRole: 'Pengajar',
            providedPin: msg.payload.teacherPin || msg.payload.pin,
            roomPin: room?.pin,
            roomTeacherSocketId: room?.teacherSocketId,
            isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
          });
          if (!authCheck.authorized) {
            return;
          }
          const validated = validateTeacherLaserRayPayload({
            ...msg.payload,
            roomId: targetRoomId,
            teacherName: msg.payload.teacherName || ws.userName || room?.teacherName || 'Pengajar',
          });
          if (!validated) return;
          if (room) {
            broadcastRoom(targetRoomId, { type: 'TEACHER_LASER_RAY', payload: validated }, ws);
          } else {
            broadcastGroup(ws.groupId, { type: 'TEACHER_LASER_RAY', payload: validated }, ws, ws.roomId);
          }
        } else if (msg.type === 'TEACHER_CAMERA_SYNC' && msg.payload) {
          const targetRoomId = (msg.payload.roomId || ws.roomId || 'LAB-ALPHA')
            .toString()
            .toUpperCase()
            .trim();
          const room = activeLabRooms.get(targetRoomId);
          const authCheck = verifyTeacherAuthorization({
            socketId: ws.socketId,
            claimedRole: 'Pengajar',
            providedPin: msg.payload.teacherPin || msg.payload.pin,
            roomPin: room?.pin,
            roomTeacherSocketId: room?.teacherSocketId,
            isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
          });
          if (!authCheck.authorized) {
            return;
          }
          const validated = validateTeacherCameraSyncPayload({
            ...msg.payload,
            roomId: targetRoomId,
            teacherName: msg.payload.teacherName || ws.userName || room?.teacherName || 'Pengajar',
          });
          if (!validated) return;
          if (room) {
            broadcastRoom(targetRoomId, { type: 'TEACHER_CAMERA_SYNC', payload: validated }, ws);
          } else {
            broadcastGroup(ws.groupId, { type: 'TEACHER_CAMERA_SYNC', payload: validated }, ws, ws.roomId);
          }
        } else if (msg.type === 'ROOM_SET_CUSTOM_MISSION' && msg.payload) {
          const { roomId, customMission, teacherName } = msg.payload;
          const targetRoomId = (roomId || ws.roomId || 'LAB-ALPHA').toUpperCase().trim();
          const updatedRoom = applyCustomMissionToRoom(
            activeLabRooms,
            targetRoomId,
            (customMission as CustomAIMissionPayload | null) ?? null,
            teacherName || ws.userName
          );
          broadcastAll({
            type: 'ROOM_MISSION_UPDATED',
            payload: {
              roomId: updatedRoom.roomId,
              customMission: updatedRoom.customMission || null,
              room: updatedRoom,
            },
          });
          broadcastRoom(updatedRoom.roomId, {
            type: 'ROOM_STATE_SYNC',
            payload: { room: updatedRoom },
          });
        } else if (msg.type === 'STUDENT_TELEMETRY_SYNC' && msg.payload) {
          const { roomId, studentName, telemetry } = msg.payload;
          const targetRoomId = (roomId || ws.roomId || '').toUpperCase().trim();
          const room = activeLabRooms.get(targetRoomId);
          if (room) {
            const client = room.clients[ws.socketId];
            if (client) {
              client.telemetry = {
                ...telemetry,
                studentName: studentName || client.name,
                lastUpdated: new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
              };
            }
            broadcastRoom(targetRoomId, {
              type: 'STUDENT_TELEMETRY_SYNC',
              payload: {
                roomId: targetRoomId,
                studentName: studentName || ws.userName,
                telemetry: client?.telemetry || telemetry,
              },
            });
          }
        } else if (msg.type === 'CURSOR_3D_MOVE' && msg.payload) {
          const cursor: SpatialCursorPayload = msg.payload;
          ws.userId = cursor.userId;
          ws.userName = cursor.userName;
          ws.role = cursor.role;
          ws.groupId = cursor.groupId;
          ws.domain = cursor.domain;

          broadcastGroup(
            cursor.groupId,
            { type: 'CURSOR_3D_MOVE', payload: cursor },
            ws,
            ws.roomId
          );
        } else if (msg.type === 'CURSOR_3D_LEAVE' && msg.payload) {
          broadcastGroup(
            msg.payload.groupId,
            { type: 'CURSOR_3D_LEAVE', payload: msg.payload },
            ws,
            ws.roomId
          );
        } else if (msg.type === 'PARAM_LOCK_ACQUIRE' && msg.payload) {
          const reqLock: ParameterLockPayload = msg.payload;
          ws.userId = reqLock.lockedByUserId;
          ws.userName = reqLock.lockedByName;
          ws.groupId = reqLock.groupId;

          const lockKey = `${ws.roomId || reqLock.groupId}:${reqLock.paramKey}`;
          const existing = parameterLocks.get(lockKey);
          const now = Date.now();

          if (
            !existing ||
            now > existing.expiresAt ||
            existing.lockedByUserId === reqLock.lockedByUserId
          ) {
            const grantedLock: ParameterLockPayload = {
              ...reqLock,
              expiresAt:
                now +
                (reqLock.expiresAt && reqLock.expiresAt > now
                  ? Math.min(reqLock.expiresAt - now, 8000)
                  : 5000),
            };
            parameterLocks.set(lockKey, grantedLock);
            broadcastGroup(
              reqLock.groupId,
              { type: 'PARAM_LOCK_ACQUIRE', payload: grantedLock },
              undefined,
              ws.roomId
            );
          }
        } else if (msg.type === 'PARAM_LOCK_RELEASE' && msg.payload) {
          const { groupId, paramKey, userId } = msg.payload;
          const lockKey = `${ws.roomId || groupId}:${paramKey}`;
          const existing = parameterLocks.get(lockKey);
          if (existing && existing.lockedByUserId === userId) {
            parameterLocks.delete(lockKey);
            broadcastGroup(
              groupId,
              { type: 'PARAM_LOCK_RELEASE', payload: msg.payload },
              undefined,
              ws.roomId
            );
          }
        } else if (msg.type === 'PARAM_VALUE_SYNC' && msg.payload) {
          broadcastGroup(
            msg.payload.groupId,
            { type: 'PARAM_VALUE_SYNC', payload: msg.payload },
            ws,
            ws.roomId
          );
        } else if (msg.type === 'record:create' && msg.payload) {
          const rec: ServerExperimentRecord = msg.payload;
          if (!experimentRecords.some((r) => r.id === rec.id)) {
            experimentRecords.unshift(rec);
          }
          const stu = studentRoster.find((s) => s.name === rec.studentName);
          if (stu) {
            stu.trialsRecorded += 1;
            stu.completionPct = Math.min(100, stu.completionPct + 8);
            stu.lastActive = 'Baru saja';
            stu.activeDomain = rec.domain;
            stu.currentActivity = `Merekam data: ${rec.experimentTitle}`;
            if (stu.completionPct >= 90) stu.status = 'Selesai';
          }
          persistServerState();
          broadcastAll({
            type: 'record:created',
            payload: { record: rec, students: studentRoster },
          });
        } else if (msg.type === 'record:delete' && msg.payload?.id) {
          const idx = experimentRecords.findIndex((r) => r.id === msg.payload.id);
          if (idx !== -1) {
            experimentRecords.splice(idx, 1);
            persistServerState();
            broadcastAll({
              type: 'record:deleted',
              payload: { id: msg.payload.id },
            });
          }
        } else if (msg.type === 'task:toggle' && msg.payload?.id) {
          const task = groupTasks.find((t) => t.id === msg.payload.id);
          if (task) {
            task.completed = !task.completed;
            task.completedBy = task.completed
              ? msg.payload.studentName || 'Siswa'
              : undefined;
            persistServerState();
            broadcastAll({ type: 'task:updated', payload: { tasks: groupTasks } });
          }
        } else if (msg.type === 'task:create' && msg.payload?.title) {
          const newTask: GroupTask = {
            id: msg.payload.id || `task-${Date.now()}`,
            groupId: msg.payload.groupId || 'Kelompok 1 — Mekanika',
            title: msg.payload.title,
            domain: msg.payload.domain || 'Fisika',
            completed: false,
          };
          groupTasks.push(newTask);
          persistServerState();
          broadcastAll({ type: 'task:updated', payload: { tasks: groupTasks } });
        } else if (msg.type === 'note:create' && msg.payload?.text) {
          const note: CollabNote = {
            id: msg.payload.id || `note-${Date.now()}`,
            groupId: msg.payload.groupId || 'Kelompok 1 — Mekanika',
            author: msg.payload.author || 'Alya Pratama',
            role: msg.payload.role || 'Siswa',
            text: msg.payload.text,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          if (!collabNotes.some((n) => n.id === note.id)) {
            collabNotes.push(note);
            persistServerState();
            broadcastAll({ type: 'note:created', payload: { note } });
          }
        } else if (msg.type === 'quiz:submit' && msg.payload) {
          const { studentName, score, correctCount } = msg.payload;
          const stu = studentRoster.find((s) => s.name === studentName);
          if (stu) {
            (stu as StudentProgress & { quizScore?: number }).quizScore = score;
            stu.completionPct = Math.min(100, Math.max(stu.completionPct, 85));
            stu.currentActivity = `Menyelesaikan LKS & Kuis (Skor: ${score}/100)`;
            stu.lastActive = 'Baru saja';
            if (score >= 75) stu.status = 'Selesai';
          }
          const notif: ServerNotification = {
            id: `notif-quiz-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            severity: 'nominal',
            domain: 'Pengajar',
            title: `Skor LKS ${studentName} Masuk (${score}/100)`,
            message: `${studentName} menjawab ${correctCount} soal LKS dengan benar. Nilai rubrik telah diperbarui otomatis.`,
          };
          notifications.unshift(notif);
          persistServerState();
          broadcastAll({
            type: 'quiz:submitted',
            payload: { students: studentRoster, notification: notif },
          });
        } else if (msg.type === 'notification:push' && msg.payload) {
          const notif: ServerNotification = msg.payload;
          if (!notifications.some((n) => n.id === notif.id)) {
            notifications.unshift(notif);
            if (notifications.length > 25) notifications.pop();
            persistServerState();
            broadcastAll({
              type: 'notification:pushed',
              payload: { notification: notif },
            });
          }
        } else if (msg.type === 'teacher:feedback' && msg.payload) {
          const authCheck = verifyTeacherAuthorization({
            socketId: ws.socketId,
            claimedRole: 'Pengajar',
            providedPin: msg.payload.teacherPin || msg.payload.pin,
            isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
          });
          if (!authCheck.authorized) {
            return;
          }
          const { targetStudentId, message, author } = msg.payload;
          const targetStu = studentRoster.find((s) => s.id === targetStudentId);
          const notif: ServerNotification = {
            id: `notif-tf-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            severity: 'elevated',
            domain: 'Pengajar',
            title: targetStu
              ? `Pesan Guru untuk ${targetStu.name}`
              : 'Pengumuman Kelas dari Pengajar',
            message: `${author || 'Dr. Hendra Kusuma'}: "${message}"`,
          };
          notifications.unshift(notif);
          const note: CollabNote = {
            id: `note-tf-${Date.now()}`,
            groupId: targetStu ? targetStu.groupId : 'Semua Kelompok',
            author: author || 'Dr. Hendra Kusuma',
            role: 'Pengajar',
            text: targetStu
              ? `@${targetStu.name}: ${message}`
              : `[PENGUMUMAN KELAS] ${message}`,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          collabNotes.push(note);
          if (targetStu && targetStu.status === 'Butuh Bantuan') {
            targetStu.status = 'Nominal';
          }
          persistServerState();
          broadcastAll({
            type: 'teacher:broadcasted',
            payload: { notification: notif, note, students: studentRoster },
          });
        } else if (msg.type === 'mystery:broadcast' && msg.payload) {
          const authCheck = verifyTeacherAuthorization({
            socketId: ws.socketId,
            claimedRole: 'Pengajar',
            providedPin: msg.payload.teacherPin || msg.payload.pin,
            isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
          });
          if (!authCheck.authorized) {
            return;
          }
          const { challenge, author } = msg.payload;
          const codename =
            challenge.codename || challenge.codeName || challenge.id || 'MISTERI';
          const notif: ServerNotification = {
            id: `notif-mys-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            severity: 'critical',
            domain: 'Pengajar',
            title: `UJIAN PRAKTIKUM MISTERI: ${challenge.title}`,
            message: `${author || 'Dr. Hendra Kusuma'} mengirim sampel misteri [${codename}] ke meja kerja Anda.`,
          };
          notifications.unshift(notif);
          persistServerState();
          broadcastAll({
            type: 'mystery:broadcasted',
            payload: { challenge, notification: notif },
          });
        } else if (msg.type === 'mystery:submit' && msg.payload) {
          const { studentName, result, challengeTitle } = msg.payload;
          const stu = studentRoster.find((s) => s.name === studentName);
          if (stu) {
            stu.completionPct = Math.min(100, Math.max(stu.completionPct, result.score));
            stu.currentActivity = `Ujian Sampel Misteri: ${result.score}/100 (${result.passed ? 'LULUS' : 'REMEDIAL'})`;
            stu.lastActive = 'Baru saja';
            if (result.passed) stu.status = 'Selesai';
          }
          const guessVal = result.studentGuess ?? result.submittedValue ?? '-';
          const guessUnit = result.unit ? ` ${result.unit}` : '';
          const errPct = result.errorPercentage ?? result.errorPercent ?? 0;
          const notif: ServerNotification = {
            id: `notif-mys-sub-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            severity: result.passed ? 'nominal' : 'elevated',
            domain: 'Pengajar',
            title: `Hasil Ujian Misteri ${studentName}: ${result.score}/100`,
            message: `${studentName} menebak ${guessVal}${guessUnit} pada "${challengeTitle}" (Galat: ${errPct}%).`,
          };
          notifications.unshift(notif);
          persistServerState();
          broadcastAll({
            type: 'mystery:submitted',
            payload: {
              studentName,
              result,
              students: studentRoster,
              notification: notif,
            },
          });
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        for (const [key, lock] of parameterLocks.entries()) {
          if (lock.lockedByUserId === ws.userId) {
            parameterLocks.delete(key);
            broadcastGroup(
              lock.groupId,
              {
                type: 'PARAM_LOCK_RELEASE',
                payload: {
                  groupId: lock.groupId,
                  domain: lock.domain,
                  paramKey: lock.paramKey,
                  userId: ws.userId,
                },
              },
              undefined,
              ws.roomId
            );
          }
        }
        if (ws.groupId) {
          broadcastGroup(
            ws.groupId,
            {
              type: 'CURSOR_3D_LEAVE',
              payload: { userId: ws.userId, groupId: ws.groupId },
            },
            undefined,
            ws.roomId
          );
        }
      }

      if (ws.roomId && activeLabRooms.has(ws.roomId)) {
        const room = activeLabRooms.get(ws.roomId)!;
        delete room.clients[ws.socketId];
        if (room.teacherSocketId === ws.socketId) {
          room.teacherSocketId = undefined;
        }
        broadcastRoom(ws.roomId, { type: 'ROOM_STATE_SYNC', payload: { room } });
      }
    });
  });

  return { wss, broadcastAll, broadcastRoom, broadcastGroup };
}
