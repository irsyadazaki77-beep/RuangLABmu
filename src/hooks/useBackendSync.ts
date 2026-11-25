import { useEffect, useRef, useState, useCallback } from 'react';
import { ExperimentRecord, LabNotification } from '../utils/scienceEngine';
import { GroupTaskItem, CollabNoteItem } from '../components/CollaborationAndDataSection';
import { StudentProgressItem } from '../components/TeacherDashboardView';
import { MysterySampleChallenge, MysterySubmissionResult } from '../utils/mysteryChallengeEngine';
import { useCollabStore } from '../stores/useCollabStore';
import {
  StudentLiveTelemetry,
  LabRoom,
  CustomAIMissionPayload,
  ParameterLockPayload,
  validateTeacherCameraSyncPayload,
  validateTeacherLaserRayPayload,
} from '../utils/collabProtocol';
import { ServerToClientMessageSchema } from '../shared/contracts/wsContracts';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { DEFAULT_SCHOOL_ID, flushOfflineOutbox } from '../utils/offlineOutbox';
import { useAuthStore } from '../stores/useAuthStore';
import { apiFetch } from '../utils/apiClient';

export interface BackendSyncState {
  records: ExperimentRecord[];
  tasks: GroupTaskItem[];
  notes: CollabNoteItem[];
  students: StudentProgressItem[];
  notifications: LabNotification[];
  activeMysteryChallenge: MysterySampleChallenge | null;
  mysterySubmissions: MysterySubmissionResult[];
  wsConnected: boolean;
  isHydrated: boolean;
}

export interface UseBackendSyncReturn extends BackendSyncState {
  ws: WebSocket | null;
  addRecord: (record: ExperimentRecord) => void;
  updateRecord: (id: string, patch: Partial<ExperimentRecord>) => void;
  deleteRecord: (id: string) => void;
  clearRecords: () => void;
  toggleTask: (id: string, studentName?: string) => void;
  createTask: (title: string, groupId?: string, domain?: string) => void;
  createNote: (text: string, author: string, role: 'Siswa' | 'Pengajar', groupId?: string) => void;
  submitQuizScore: (studentName: string, score: number, correctCount: number) => void;
  pushNotification: (notif: LabNotification) => void;
  broadcastTeacherFeedback: (targetStudentId: string, message: string, author: string) => void;
  broadcastMysteryChallenge: (challenge: MysterySampleChallenge, author: string) => void;
  activateMysteryChallenge: (challenge: MysterySampleChallenge) => void;
  submitMysteryExam: (studentName: string, result: MysterySubmissionResult, challengeTitle: string) => void;
  dismissMysteryChallenge: () => void;
  createRoom: (pin: string, domain: 'physics' | 'chemistry' | 'biology' | 'astronomy', moduleId: string, customRoomId?: string) => void;
  joinRoom: (roomId: string, pin: string, joinAsRole?: 'teacher' | 'student') => void;
  leaveRoom: () => void;
  toggleTeacherFreeze: (isFrozen: boolean) => void;
  syncStudentTelemetry: (telemetry: Omit<StudentLiveTelemetry, 'studentName' | 'lastUpdated'>) => void;
  syncParameterChange: (paramKey: string, value: number, targetGroupId?: string, targetDomain?: string) => void;
  publishCustomMission: (mission: CustomAIMissionPayload | null, targetRoomId?: string) => void;
}

const STORAGE_KEY = 'ruanglab_client_cache_v2';

import {
  WS_BASE_RECONNECT_MS,
  WS_MAX_RECONNECT_MS,
  WS_MAX_JITTER_MS,
  MAX_OUTBOX_QUEUE_SIZE,
  isPlainObject,
  isBrowserOnline,
  shouldScheduleWsReconnect,
  calculateReconnectDelay,
  OfflineOutboxQueue,
  type OutboxQueuedEvent,
} from './wsOutboxQueue';

export {
  WS_BASE_RECONNECT_MS,
  WS_MAX_RECONNECT_MS,
  WS_MAX_JITTER_MS,
  MAX_OUTBOX_QUEUE_SIZE,
  isPlainObject,
  isBrowserOnline,
  shouldScheduleWsReconnect,
  calculateReconnectDelay,
  OfflineOutboxQueue,
  type OutboxQueuedEvent,
};

export interface ValidatedWsMessage {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Strict runtime payload type-guard for incoming WebSocket messages backed by shared Zod contracts.
 * Rejects malformed/corrupted payloads before they can crash state handlers.
 */
export function isValidBackendWsMessage(candidate: unknown): candidate is ValidatedWsMessage {
  const zodChecked = ServerToClientMessageSchema.safeParse(candidate);
  if (zodChecked.success) {
    return true;
  }
  return false;
}

/**
 * Safely deserializes a raw WebSocket string frame and validates it with `isValidBackendWsMessage`.
 * Returns `null` for malformed JSON or corrupted payloads without throwing.
 */
export function parseAndValidateWsMessage(rawData: unknown): ValidatedWsMessage | null {
  if (typeof rawData !== 'string' || rawData.trim().length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(rawData);
    if (isValidBackendWsMessage(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export interface ActiveRoomSessionCredentials {
  roomId: string;
  pin: string;
  role: 'teacher' | 'student';
}

export function buildReconnectRoomJoinMessage(
  session: ActiveRoomSessionCredentials | null,
  fallbackRoomId: string | null,
  fallbackPin: string | null,
  identity: {
    userId: string;
    name: string;
    role: 'Siswa' | 'Pengajar';
    groupId: string;
  }
): {
  type: 'ROOM_JOIN';
  payload: {
    roomId: string;
    pin: string;
    name: string;
    role: 'teacher' | 'student';
    userId: string;
    groupId: string;
    isReconnect: true;
  };
} | null {
  const roomId = (session?.roomId || fallbackRoomId || '').toUpperCase().trim();
  const pin = session?.pin ?? fallbackPin;
  if (!roomId || typeof pin !== 'string' || !pin.trim()) {
    return null;
  }

  return {
    type: 'ROOM_JOIN',
    payload: {
      roomId,
      pin: pin.trim(),
      name: identity.name,
      role: session?.role || (identity.role === 'Pengajar' ? 'teacher' : 'student'),
      userId: identity.userId,
      groupId: identity.groupId,
      isReconnect: true,
    },
  };
}

export function useBackendSync(
  studentName: string,
  groupId: string,
  role: 'Siswa' | 'Pengajar' = 'Siswa',
  domain: string = 'fisika'
): UseBackendSyncReturn {
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [tasks, setTasks] = useState<GroupTaskItem[]>([]);
  const [notes, setNotes] = useState<CollabNoteItem[]>([]);
  const [students, setStudents] = useState<StudentProgressItem[]>([]);
  const [notifications, setNotifications] = useState<LabNotification[]>([]);
  const [activeMysteryChallenge, setActiveMysteryChallenge] = useState<MysterySampleChallenge | null>(null);
  const [mysterySubmissions, setMysterySubmissions] = useState<MysterySubmissionResult[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const outboxQueueRef = useRef<OfflineOutboxQueue>(new OfflineOutboxQueue());
  const activeRoomSessionRef = useRef<ActiveRoomSessionCredentials | null>(null);
  const identityRef = useRef({ studentName, groupId, role, domain });
  identityRef.current = { studentName, groupId, role, domain };

  // 1. Initial REST Hydration
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const res = await apiFetch('/api/lab-state');
        if (res.ok && !cancelled) {
          const data: unknown = await res.json();
          if (isPlainObject(data)) {
            if (Array.isArray(data.records)) setRecords(data.records as ExperimentRecord[]);
            if (Array.isArray(data.tasks)) setTasks(data.tasks as GroupTaskItem[]);
            if (Array.isArray(data.notes)) setNotes(data.notes as CollabNoteItem[]);
            if (Array.isArray(data.students)) setStudents(data.students as StudentProgressItem[]);
            if (Array.isArray(data.notifications)) setNotifications(data.notifications as LabNotification[]);
          }
          setIsHydrated(true);
          return;
        }
      } catch {
        // Fallback to local cache
      }

      // Local storage cache recovery
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved && !cancelled) {
          const parsed: unknown = JSON.parse(saved);
          if (isPlainObject(parsed)) {
            if (Array.isArray(parsed.records)) setRecords(parsed.records as ExperimentRecord[]);
            if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks as GroupTaskItem[]);
            if (Array.isArray(parsed.notes)) setNotes(parsed.notes as CollabNoteItem[]);
          }
        }
      } catch {
        // ignore storage error
      }
      if (!cancelled) setIsHydrated(true);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save to local cache on changes
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ records, tasks, notes })
      );
    } catch {
      // ignore storage error
    }
  }, [records, tasks, notes, isHydrated]);

  // 2. WebSocket Connection, Exponential Backoff Reconnect, Outbox Flush & Validated Routing
  useEffect(() => {
    let unmounted = false;
    let attemptCount = 0;

    const connectWs = () => {
      if (unmounted || !isBrowserOnline()) return;
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.CONNECTING ||
          wsRef.current.readyState === WebSocket.OPEN)
      ) {
        return;
      }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-lab`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        useCollabStore.getState().setWsConnected(true);
        attemptCount = 0;

        const storeSnapshot = useCollabStore.getState();
        const activeRoomId = storeSnapshot.activeRoomId;
        const currentIdentity = identityRef.current;
        const userId = `user-${currentIdentity.studentName.replace(/\s+/g, '-').toLowerCase()}`;

        // 1. Identify client session
        const authState = useAuthStore.getState();
        socket.send(
          JSON.stringify({
            type: 'client:identify',
            payload: {
              userId,
              userName: currentIdentity.studentName,
              role: currentIdentity.role,
              groupId: currentIdentity.groupId,
              domain: currentIdentity.domain,
              roomId: activeRoomId,
              schoolId: authState.session?.schoolId || DEFAULT_SCHOOL_ID,
              sessionToken: authState.token || undefined,
              teacherPin:
                currentIdentity.role === 'Pengajar'
                  ? storeSnapshot.roomPin || activeRoomSessionRef.current?.pin || undefined
                  : undefined,
            },
          })
        );

        // 2. Automatically re-join active room on reconnect so server restores
        //    room membership, teacherSocketId, freeze state, customMission & paramLocks
        const reconnectJoinMsg = buildReconnectRoomJoinMessage(
          activeRoomSessionRef.current,
          storeSnapshot.activeRoomId,
          storeSnapshot.roomPin,
          {
            userId,
            name: currentIdentity.studentName,
            role: currentIdentity.role,
            groupId: currentIdentity.groupId,
          }
        );
        if (reconnectJoinMsg && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(reconnectJoinMsg));
        }

        // 3. Sequentially flush any offline outbox events queued while reconnecting
        outboxQueueRef.current.flush((serializedMsg) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(serializedMsg);
          }
        });
        void flushOfflineOutbox({ force: true });
      };

      socket.onmessage = (event: MessageEvent) => {
        if (unmounted) return;

        // Strict Runtime Payload Guard
        const msg = parseAndValidateWsMessage(event.data);
        if (!msg) {
          return;
        }

        const { type, payload } = msg;

        if (type === 'init:state') {
          if (Array.isArray(payload.records)) setRecords(payload.records as ExperimentRecord[]);
          if (Array.isArray(payload.tasks)) setTasks(payload.tasks as GroupTaskItem[]);
          if (Array.isArray(payload.notes)) setNotes(payload.notes as CollabNoteItem[]);
          if (Array.isArray(payload.students)) setStudents(payload.students as StudentProgressItem[]);
          if (Array.isArray(payload.notifications)) {
            setNotifications(payload.notifications as LabNotification[]);
          }
          if (Array.isArray(payload.paramLocks)) {
            useCollabStore
              .getState()
              .syncLocks(payload.paramLocks as ParameterLockPayload[]);
          }
        } else if (type === 'ROOM_CREATED' && isPlainObject(payload.room)) {
          const room = payload.room as unknown as LabRoom;
          const store = useCollabStore.getState();
          activeRoomSessionRef.current = {
            roomId: room.roomId,
            pin: room.pin,
            role: 'teacher',
          };
          store.setActiveRoom(room);
          store.closeRoomModal();
          setNotifications((prev) => [
            {
              id: `notif-room-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              severity: 'nominal',
              domain: 'Kolaborasi',
              title: `Meja Praktikum [${room.roomId}] Dibuat`,
              message: `PIN Ruangan: ${room.pin}. Bagikan kode ini kepada siswa untuk bergabung ke meja praktikum.`,
            },
            ...prev.slice(0, 24),
          ]);
        } else if (type === 'ROOM_JOINED' && isPlainObject(payload.room)) {
          const room = payload.room as unknown as LabRoom;
          const store = useCollabStore.getState();
          const joinedClientRole =
            isPlainObject(payload.client) && payload.client.role === 'teacher'
              ? 'teacher'
              : identityRef.current.role === 'Pengajar'
              ? 'teacher'
              : 'student';
          const effectivePin =
            room.pin || activeRoomSessionRef.current?.pin || store.roomPin || '';
          activeRoomSessionRef.current = {
            roomId: room.roomId,
            pin: effectivePin,
            role: joinedClientRole,
          };
          store.setActiveRoom({ ...room, pin: effectivePin });
          store.closeRoomModal();
          if (Array.isArray(payload.paramLocks)) {
            store.syncLocks(payload.paramLocks as ParameterLockPayload[]);
          }
          if (!payload.isReconnect) {
            setNotifications((prev) => [
              {
                id: `notif-join-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
                severity: 'nominal',
                domain: 'Kolaborasi',
                title: `Bergabung ke Meja [${room.roomId}]`,
                message: `Anda telah terhubung ke meja praktikum bersama ${Object.keys(room.clients || {}).length} peserta.`,
              },
              ...prev.slice(0, 24),
            ]);
          }
        } else if (type === 'ROOM_STATE_SYNC' && isPlainObject(payload.room)) {
          useCollabStore.getState().setActiveRoom(payload.room as unknown as LabRoom);
        } else if (type === 'PARAM_LOCKS_SYNC' && Array.isArray(payload.locks)) {
          useCollabStore
            .getState()
            .syncLocks(payload.locks as ParameterLockPayload[]);
        } else if (type === 'PARAM_LOCK_RESET_ALL') {
          useCollabStore.getState().clearLocks();
        } else if (type === 'PARAM_LOCK_ACQUIRE') {
          useCollabStore
            .getState()
            .setLock(
              String(payload.paramKey),
              payload as unknown as ParameterLockPayload
            );
        } else if (type === 'PARAM_LOCK_RELEASE') {
          useCollabStore.getState().releaseLock(String(payload.paramKey));
        } else if (type === 'ROOM_MISSION_UPDATED') {
          const store = useCollabStore.getState();
          if (isPlainObject(payload.room)) {
            store.setActiveRoom(payload.room as unknown as LabRoom);
          }
          const customMission = (payload.customMission as CustomAIMissionPayload | null) ?? null;
          store.setActiveCustomMission(customMission);
          if (customMission) {
            setNotifications((prev) => [
              {
                id: `notif-aimission-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
                severity: 'nominal',
                domain: 'Pengajar',
                title: `Misi Praktikum AI Baru: ${customMission.title}`,
                message: `Guru (${customMission.createdByTeacher}) menyiarkan studi kasus baru di meja [${customMission.roomId}].`,
              },
              ...prev.slice(0, 24),
            ]);
          }
        } else if (type === 'ROOM_ERROR' && typeof payload.message === 'string') {
          if (payload.code === 'ROOM_NOT_FOUND' || payload.code === 'INVALID_PIN') {
            activeRoomSessionRef.current = null;
          }
          useCollabStore.getState().setRoomError(payload.message);
        } else if (type === 'TEACHER_FREEZE_TOGGLE') {
          useCollabStore
            .getState()
            .setTeacherFreeze(
              Boolean(payload.isFrozen),
              typeof payload.teacherName === 'string' ? payload.teacherName : undefined
            );
        } else if (type === 'TEACHER_LASER_RAY') {
          const validated = validateTeacherLaserRayPayload(payload);
          if (validated) {
            useCollabStore.getState().setRemoteTeacherLaser(validated.active ? validated : null);
          }
        } else if (type === 'TEACHER_CAMERA_SYNC') {
          const validated = validateTeacherCameraSyncPayload(payload);
          if (validated) {
            useCollabStore.getState().setRemoteTeacherCameraSync(validated.enabled ? validated : null);
          }
        } else if (type === 'STUDENT_TELEMETRY_SYNC' && isPlainObject(payload.telemetry)) {
          const t = payload.telemetry as unknown as StudentLiveTelemetry;
          if (t.studentName) {
            useCollabStore.getState().updateStudentTelemetry(t.studentName, t);
          }
        } else if (type === 'record:created' && isPlainObject(payload.record)) {
          const newRecord = payload.record as unknown as ExperimentRecord;
          setRecords((prev) => {
            if (prev.some((r) => r.id === newRecord.id)) return prev;
            return [newRecord, ...prev];
          });
          if (Array.isArray(payload.students)) {
            setStudents(payload.students as StudentProgressItem[]);
          }
        } else if (type === 'record:deleted' && typeof payload.id === 'string') {
          setRecords((prev) => prev.filter((r) => r.id !== payload.id));
        } else if (type === 'task:updated' && Array.isArray(payload.tasks)) {
          setTasks(payload.tasks as GroupTaskItem[]);
        } else if (type === 'note:created' && isPlainObject(payload.note)) {
          const newNote = payload.note as unknown as CollabNoteItem;
          setNotes((prev) => {
            if (prev.some((n) => n.id === newNote.id)) return prev;
            return [...prev, newNote];
          });
        } else if (type === 'notification:pushed' && isPlainObject(payload.notification)) {
          const notif = payload.notification as unknown as LabNotification;
          setNotifications((prev) => [notif, ...prev.slice(0, 24)]);
        } else if (type === 'quiz:submitted') {
          if (Array.isArray(payload.students)) {
            setStudents(payload.students as StudentProgressItem[]);
          }
          if (isPlainObject(payload.notification)) {
            const notif = payload.notification as unknown as LabNotification;
            setNotifications((prev) => [notif, ...prev.slice(0, 24)]);
          }
        } else if (type === 'teacher:broadcasted') {
          if (isPlainObject(payload.notification)) {
            const notif = payload.notification as unknown as LabNotification;
            setNotifications((prev) => [notif, ...prev.slice(0, 24)]);
          }
          if (isPlainObject(payload.note)) {
            const note = payload.note as unknown as CollabNoteItem;
            setNotes((prev) => [...prev, note]);
          }
          if (Array.isArray(payload.students)) {
            setStudents(payload.students as StudentProgressItem[]);
          }
        } else if (type === 'mystery:broadcasted') {
          if (isPlainObject(payload.challenge)) {
            setActiveMysteryChallenge(payload.challenge as unknown as MysterySampleChallenge);
          }
          if (isPlainObject(payload.notification)) {
            const notif = payload.notification as unknown as LabNotification;
            setNotifications((prev) => [notif, ...prev.slice(0, 24)]);
          }
        } else if (type === 'mystery:submitted') {
          if (isPlainObject(payload.result)) {
            const res = payload.result as unknown as MysterySubmissionResult;
            setMysterySubmissions((prev) => [res, ...prev]);
          }
          if (Array.isArray(payload.students)) {
            setStudents(payload.students as StudentProgressItem[]);
          }
          if (isPlainObject(payload.notification)) {
            const notif = payload.notification as unknown as LabNotification;
            setNotifications((prev) => [notif, ...prev.slice(0, 24)]);
          }
        }
      };

      socket.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        useCollabStore.getState().setWsConnected(false);
        wsRef.current = null;

        if (!shouldScheduleWsReconnect({ unmounted, isOnline: isBrowserOnline() })) {
          return;
        }

        // Auto-reconnect with exponential backoff: min(1000 * 2^attempt, 15000) ms + random jitter
        const reconnectDelay = calculateReconnectDelay(attemptCount);
        attemptCount += 1;
        reconnectTimerRef.current = window.setTimeout(connectWs, reconnectDelay);
      };

      socket.onerror = () => {
        if (
          socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN
        ) {
          socket.close();
        }
      };
    };

    const handleOffline = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setWsConnected(false);
      useCollabStore.getState().setWsConnected(false);
      const activeWs = wsRef.current;
      if (
        activeWs &&
        (activeWs.readyState === WebSocket.CONNECTING ||
          activeWs.readyState === WebSocket.OPEN)
      ) {
        activeWs.close();
      }
    };

    const handleOnline = () => {
      if (unmounted) return;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      attemptCount = 0;
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWs();
      }
      void flushOfflineOutbox({ force: true });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    if (isBrowserOnline()) {
      connectWs();
    }

    return () => {
      unmounted = true;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const activeWs = wsRef.current;
      wsRef.current = null;
      if (activeWs) {
        activeWs.onopen = null;
        activeWs.onmessage = null;
        activeWs.onclose = null;
        activeWs.onerror = null;
        if (activeWs.readyState === WebSocket.OPEN) {
          activeWs.close();
        } else if (activeWs.readyState === WebSocket.CONNECTING) {
          activeWs.addEventListener(
            'open',
            () => {
              activeWs.close();
            },
            { once: true }
          );
        }
      }
    };
  }, []);

  // Re-identify over the existing open WebSocket when identity/role/domain changes
  useEffect(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const storeSnapshot = useCollabStore.getState();
    const userId = `user-${studentName.replace(/\s+/g, '-').toLowerCase()}`;
    const authState = useAuthStore.getState();
    socket.send(
      JSON.stringify({
        type: 'client:identify',
        payload: {
          userId,
          userName: studentName,
          role,
          groupId,
          domain,
          roomId: storeSnapshot.activeRoomId,
          schoolId: authState.session?.schoolId || DEFAULT_SCHOOL_ID,
          sessionToken: authState.token || undefined,
          teacherPin:
            role === 'Pengajar'
              ? storeSnapshot.roomPin || activeRoomSessionRef.current?.pin || undefined
              : undefined,
        },
      })
    );
  }, [studentName, groupId, role, domain]);

  /**
   * Sends a WebSocket message immediately if connected, or queues it in the
   * local OfflineOutboxQueue while reconnecting to be flushed in FIFO order upon reconnect.
   */
  const sendWs = useCallback((type: string, payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      outboxQueueRef.current.enqueue(type, payload);
    }
  }, []);

  const syncParameterChange = useCallback(
    (paramKey: string, value: number, targetGroupId?: string, targetDomain?: string) => {
      sendWs('PARAM_VALUE_SYNC', {
        groupId: targetGroupId || groupId,
        domain: targetDomain || domain,
        paramKey,
        value,
        updatedBy: `user-${studentName.replace(/\s+/g, '-').toLowerCase()}`,
      });
    },
    [sendWs, groupId, domain, studentName]
  );

  const addRecord = useCallback(
    (record: ExperimentRecord) => {
      setRecords((prev) => [record, ...prev]);
      sendWs('record:create', record);
    },
    [sendWs]
  );

  const updateRecord = useCallback(
    (id: string, patch: Partial<ExperimentRecord>) => {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const deleteRecord = useCallback(
    (id: string) => {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      sendWs('record:delete', { id });
    },
    [sendWs]
  );

  const clearRecords = useCallback(() => {
    setRecords([]);
  }, []);

  const toggleTask = useCallback(
    (id: string, name?: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, completed: !t.completed, completedBy: !t.completed ? name || studentName : undefined }
            : t
        )
      );
      sendWs('task:toggle', { id, studentName: name || studentName });
    },
    [sendWs, studentName]
  );

  const createTask = useCallback(
    (title: string, targetGroupId?: string, targetDomain?: string) => {
      const newTask: GroupTaskItem = {
        id: `task-${Date.now()}`,
        groupId: targetGroupId || groupId,
        title,
        domain: (targetDomain as 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi') || 'Fisika',
        completed: false,
      };
      setTasks((prev) => [...prev, newTask]);
      sendWs('task:create', newTask);
    },
    [sendWs, groupId]
  );

  const createNote = useCallback(
    (text: string, author: string, authorRole: 'Siswa' | 'Pengajar', targetGroupId?: string) => {
      const newNote: CollabNoteItem = {
        id: `note-${Date.now()}`,
        groupId: targetGroupId || groupId,
        author,
        role: authorRole,
        text,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setNotes((prev) => [...prev, newNote]);
      sendWs('note:create', newNote);
    },
    [sendWs, groupId]
  );

  const submitQuizScore = useCallback(
    (sName: string, score: number, correctCount: number) => {
      sendWs('quiz:submit', { studentName: sName, score, correctCount });
    },
    [sendWs]
  );

  const pushNotification = useCallback(
    (notif: LabNotification) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 24)]);
      sendWs('notification:push', notif);
    },
    [sendWs]
  );

  const broadcastTeacherFeedback = useCallback(
    (targetStudentId: string, message: string, author: string) => {
      const activePin =
        useCollabStore.getState().roomPin || activeRoomSessionRef.current?.pin || undefined;
      sendWs('teacher:feedback', {
        targetStudentId,
        message,
        author,
        teacherPin: activePin,
        sessionToken: useAuthStore.getState().token || undefined,
      });
    },
    [sendWs]
  );

  const broadcastMysteryChallenge = useCallback(
    (challenge: MysterySampleChallenge, author: string) => {
      const activePin =
        useCollabStore.getState().roomPin || activeRoomSessionRef.current?.pin || undefined;
      setActiveMysteryChallenge(challenge);
      sendWs('mystery:broadcast', {
        challenge,
        author,
        teacherPin: activePin,
        sessionToken: useAuthStore.getState().token || undefined,
      });
    },
    [sendWs]
  );

  const submitMysteryExam = useCallback(
    (sName: string, result: MysterySubmissionResult, challengeTitle: string) => {
      setMysterySubmissions((prev) => [result, ...prev]);
      sendWs('mystery:submit', { studentName: sName, result, challengeTitle });
    },
    [sendWs]
  );

  const dismissMysteryChallenge = useCallback(() => {
    setActiveMysteryChallenge(null);
  }, []);

  const activateMysteryChallenge = useCallback((challenge: MysterySampleChallenge) => {
    setActiveMysteryChallenge(challenge);
  }, []);

  const createRoom = useCallback(
    (
      pin: string,
      roomDomain: 'physics' | 'chemistry' | 'biology' | 'astronomy',
      moduleId: string,
      customRoomId?: string
    ) => {
      useCollabStore.getState().setRoomError(null);
      if (customRoomId) {
        activeRoomSessionRef.current = {
          roomId: customRoomId.toUpperCase().trim(),
          pin: pin.trim(),
          role: 'teacher',
        };
      }
      const authState = useAuthStore.getState();
      sendWs('ROOM_CREATE', {
        roomId: customRoomId,
        schoolId: authState.session?.schoolId || DEFAULT_SCHOOL_ID,
        pin,
        domain: roomDomain,
        moduleId,
        teacherName: studentName,
        teacherUserId: `user-${studentName.replace(/\s+/g, '-').toLowerCase()}`,
        sessionToken: authState.token || undefined,
      });
    },
    [sendWs, studentName]
  );

  const joinRoom = useCallback(
    (roomId: string, pin: string, joinAsRole?: 'teacher' | 'student') => {
      useCollabStore.getState().setRoomError(null);
      const resolvedRole = joinAsRole || (role === 'Pengajar' ? 'teacher' : 'student');
      useCollabStore.getState().setRoomPin(pin.trim());
      activeRoomSessionRef.current = {
        roomId: roomId.toUpperCase().trim(),
        pin: pin.trim(),
        role: resolvedRole,
      };
      const authState = useAuthStore.getState();
      sendWs('ROOM_JOIN', {
        roomId,
        pin,
        teacherPin: resolvedRole === 'teacher' ? pin.trim() : undefined,
        sessionToken: authState.token || undefined,
        schoolId: authState.session?.schoolId || DEFAULT_SCHOOL_ID,
        name: studentName,
        role: resolvedRole,
        userId: `user-${studentName.replace(/\s+/g, '-').toLowerCase()}`,
        groupId,
      });
    },
    [sendWs, studentName, role, groupId]
  );

  const leaveRoom = useCallback(() => {
    activeRoomSessionRef.current = null;
    sendWs('ROOM_LEAVE', {});
    useCollabStore.getState().leaveRoom();
  }, [sendWs]);

  const toggleTeacherFreeze = useCallback(
    (isFrozen: boolean) => {
      const storeState = useCollabStore.getState();
      const roomId = storeState.activeRoomId;
      const roomPin = storeState.roomPin || activeRoomSessionRef.current?.pin || undefined;
      storeState.setTeacherFreeze(isFrozen, studentName);
      if (roomId) {
        sendWs('TEACHER_FREEZE_TOGGLE', {
          roomId,
          isFrozen,
          teacherName: studentName,
          teacherPin: roomPin,
          sessionToken: useAuthStore.getState().token || undefined,
        });
      }
    },
    [sendWs, studentName]
  );

  // Bridge Teacher 3D Laser & Camera Sync events over WebSocket (throttled)
  const lastLaserEmitRef = useRef<number>(0);
  const lastCamSyncEmitRef = useRef<number>(0);
  const camSeqRef = useRef<number>(0);

  useEffect(() => {
    const unsubLaser = subscribeLabEvent(LAB_EVENTS.TEACHER_LASER_EMIT, (detail) => {
      if (!detail || role !== 'Pengajar') return;
      const now = Date.now();
      if (detail.active && now - lastLaserEmitRef.current < 33) return;
      lastLaserEmitRef.current = now;
      const collabState = useCollabStore.getState();
      const roomId = collabState.activeRoomId || 'LAB-ALPHA';
      const activePin = collabState.roomPin || activeRoomSessionRef.current?.pin || undefined;
      sendWs('TEACHER_LASER_RAY', {
        roomId,
        teacherName: studentName,
        teacherPin: activePin,
        point: detail.point,
        normal: detail.normal,
        hoveredObject: detail.hoveredObject,
        active: detail.active,
        updatedAt: now,
      });
    });

    const unsubCam = subscribeLabEvent(LAB_EVENTS.TEACHER_CAMERA_EMIT, (detail) => {
      if (!detail || role !== 'Pengajar') return;
      const now = Date.now();
      if (detail.enabled && now - lastCamSyncEmitRef.current < 50) return;
      lastCamSyncEmitRef.current = now;
      camSeqRef.current += 1;
      const collabState = useCollabStore.getState();
      const roomId = collabState.activeRoomId || 'LAB-ALPHA';
      const activePin = collabState.roomPin || activeRoomSessionRef.current?.pin || undefined;
      sendWs('TEACHER_CAMERA_SYNC', {
        roomId,
        teacherName: studentName,
        teacherPin: activePin,
        enabled: detail.enabled,
        position: detail.position,
        target: detail.target,
        seq: camSeqRef.current,
        updatedAt: now,
      });
    });

    return () => {
      unsubLaser();
      unsubCam();
    };
  }, [role, sendWs, studentName]);

  const syncStudentTelemetry = useCallback(
    (telemetry: Omit<StudentLiveTelemetry, 'studentName' | 'lastUpdated'>) => {
      const roomId = useCollabStore.getState().activeRoomId;
      const fullTelemetry: StudentLiveTelemetry = {
        ...telemetry,
        studentName,
        lastUpdated: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      useCollabStore.getState().updateStudentTelemetry(studentName, fullTelemetry);
      if (roomId) {
        sendWs('STUDENT_TELEMETRY_SYNC', {
          roomId,
          studentName,
          telemetry: fullTelemetry,
        });
      }
    },
    [sendWs, studentName]
  );

  const publishCustomMission = useCallback(
    (mission: CustomAIMissionPayload | null, targetRoomId?: string) => {
      const collabState = useCollabStore.getState();
      const roomId = (targetRoomId || collabState.activeRoomId || 'LAB-ALPHA')
        .toUpperCase()
        .trim();
      const activePin = collabState.roomPin || activeRoomSessionRef.current?.pin || undefined;
      collabState.setActiveCustomMission(mission);
      sendWs('ROOM_SET_CUSTOM_MISSION', {
        roomId,
        customMission: mission,
        teacherName: studentName,
        teacherPin: activePin,
        sessionToken: useAuthStore.getState().token || undefined,
      });
    },
    [sendWs, studentName]
  );

  return {
    records,
    tasks,
    notes,
    students,
    notifications,
    activeMysteryChallenge,
    mysterySubmissions,
    wsConnected,
    isHydrated,
    ws: wsRef.current,
    addRecord,
    updateRecord,
    deleteRecord,
    clearRecords,
    toggleTask,
    createTask,
    createNote,
    submitQuizScore,
    pushNotification,
    broadcastTeacherFeedback,
    broadcastMysteryChallenge,
    activateMysteryChallenge,
    submitMysteryExam,
    dismissMysteryChallenge,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleTeacherFreeze,
    syncStudentTelemetry,
    syncParameterChange,
    publishCustomMission,
  };
}
