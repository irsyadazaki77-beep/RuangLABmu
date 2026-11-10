import { useEffect, useRef, useState, useCallback } from 'react';
import { ExperimentRecord, LabNotification } from '../utils/scienceEngine';
import { GroupTaskItem, CollabNoteItem } from '../components/CollaborationAndDataSection';
import { StudentProgressItem } from '../components/TeacherDashboardView';
import { MysterySampleChallenge, MysterySubmissionResult } from '../utils/mysteryChallengeEngine';
import { useCollabStore } from '../stores/useCollabStore';
import { StudentLiveTelemetry, LabRoom } from '../utils/collabProtocol';

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
  deleteRecord: (id: string) => void;
  toggleTask: (id: string, studentName?: string) => void;
  createTask: (title: string, groupId?: string, domain?: string) => void;
  createNote: (text: string, author: string, role: 'Siswa' | 'Pengajar', groupId?: string) => void;
  submitQuizScore: (studentName: string, score: number, correctCount: number) => void;
  pushNotification: (notif: LabNotification) => void;
  broadcastTeacherFeedback: (targetStudentId: string, message: string, author: string) => void;
  broadcastMysteryChallenge: (challenge: MysterySampleChallenge, author: string) => void;
  submitMysteryExam: (studentName: string, result: MysterySubmissionResult, challengeTitle: string) => void;
  dismissMysteryChallenge: () => void;
  createRoom: (pin: string, domain: 'physics' | 'chemistry' | 'biology' | 'astronomy', moduleId: string, customRoomId?: string) => void;
  joinRoom: (roomId: string, pin: string, joinAsRole?: 'teacher' | 'student') => void;
  leaveRoom: () => void;
  toggleTeacherFreeze: (isFrozen: boolean) => void;
  syncStudentTelemetry: (telemetry: Omit<StudentLiveTelemetry, 'studentName' | 'lastUpdated'>) => void;
  syncParameterChange: (paramKey: string, value: number, targetGroupId?: string, targetDomain?: string) => void;
}

const STORAGE_KEY = 'ruanglab_client_cache_v2';

export const WS_BASE_RECONNECT_MS = 1000;
export const WS_MAX_RECONNECT_MS = 15000;
export const WS_MAX_JITTER_MS = 400;
export const MAX_OUTBOX_QUEUE_SIZE = 250;

/**
 * Computes exponential backoff reconnect delay:
 * min(1000 * 2^attempt, 15000) ms + random jitter
 */
export function calculateReconnectDelay(
  attempt: number,
  randomFn: () => number = Math.random
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const baseDelay = Math.min(
    WS_BASE_RECONNECT_MS * Math.pow(2, safeAttempt),
    WS_MAX_RECONNECT_MS
  );
  const clampedRand = Math.max(0, Math.min(1, randomFn()));
  const jitter = Math.round(clampedRand * WS_MAX_JITTER_MS);
  return baseDelay + jitter;
}

export interface OutboxQueuedEvent {
  type: string;
  payload: unknown;
  queuedAt: number;
}

/**
 * FIFO Offline Outbox Queue for buffering parameter/state changes while
 * WebSocket connection is offline or reconnecting, and flushing sequentially upon reconnect.
 */
export class OfflineOutboxQueue {
  private queue: OutboxQueuedEvent[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity: number = MAX_OUTBOX_QUEUE_SIZE) {
    this.maxCapacity = Math.max(1, maxCapacity);
  }

  public enqueue(type: string, payload: unknown, nowMs: number = Date.now()): void {
    // Coalesce consecutive PARAM_VALUE_SYNC updates for the same groupId + paramKey
    if (type === 'PARAM_VALUE_SYNC' && isPlainObject(payload)) {
      const paramKey = payload.paramKey;
      const groupId = payload.groupId;
      if (typeof paramKey === 'string') {
        const existingIdx = this.queue.findIndex(
          (item) =>
            item.type === 'PARAM_VALUE_SYNC' &&
            isPlainObject(item.payload) &&
            item.payload.paramKey === paramKey &&
            item.payload.groupId === groupId
        );
        if (existingIdx !== -1) {
          this.queue.splice(existingIdx, 1);
        }
      }
    }

    if (this.queue.length >= this.maxCapacity) {
      this.queue.shift();
    }

    this.queue.push({
      type,
      payload,
      queuedAt: nowMs,
    });
  }

  public flush(sendFn: (serializedMessage: string) => void): number {
    let flushedCount = 0;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        sendFn(JSON.stringify({ type: item.type, payload: item.payload }));
        flushedCount += 1;
      }
    }
    return flushedCount;
  }

  public size(): number {
    return this.queue.length;
  }

  public peekAll(): ReadonlyArray<OutboxQueuedEvent> {
    return [...this.queue];
  }

  public clear(): void {
    this.queue = [];
  }
}

export interface ValidatedWsMessage {
  type: string;
  payload: Record<string, unknown>;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Strict runtime payload type-guard for incoming WebSocket messages.
 * Rejects malformed/corrupted payloads before they can crash state handlers.
 */
export function isValidBackendWsMessage(candidate: unknown): candidate is ValidatedWsMessage {
  if (!isPlainObject(candidate)) return false;
  if (!isNonEmptyString(candidate.type)) return false;
  if (!isPlainObject(candidate.payload)) return false;

  const { type, payload } = candidate;

  switch (type) {
    case 'init:state': {
      if (payload.records !== undefined && !Array.isArray(payload.records)) return false;
      if (payload.tasks !== undefined && !Array.isArray(payload.tasks)) return false;
      if (payload.notes !== undefined && !Array.isArray(payload.notes)) return false;
      if (payload.students !== undefined && !Array.isArray(payload.students)) return false;
      if (payload.notifications !== undefined && !Array.isArray(payload.notifications)) return false;
      return true;
    }

    case 'ROOM_CREATED':
    case 'ROOM_JOINED':
    case 'ROOM_STATE_SYNC': {
      if (!isPlainObject(payload.room)) return false;
      return isNonEmptyString(payload.room.roomId) && typeof payload.room.pin === 'string';
    }

    case 'ROOM_ERROR': {
      return isNonEmptyString(payload.message);
    }

    case 'TEACHER_FREEZE_TOGGLE': {
      return typeof payload.isFrozen === 'boolean';
    }

    case 'STUDENT_TELEMETRY_SYNC': {
      if (!isPlainObject(payload.telemetry)) return false;
      return isNonEmptyString(payload.telemetry.studentName);
    }

    case 'record:created': {
      if (!isPlainObject(payload.record)) return false;
      return (
        isNonEmptyString(payload.record.id) &&
        typeof payload.record.experimentTitle === 'string'
      );
    }

    case 'record:deleted': {
      return isNonEmptyString(payload.id);
    }

    case 'task:updated': {
      return Array.isArray(payload.tasks);
    }

    case 'note:created': {
      if (!isPlainObject(payload.note)) return false;
      return isNonEmptyString(payload.note.id) && typeof payload.note.text === 'string';
    }

    case 'notification:pushed': {
      if (!isPlainObject(payload.notification)) return false;
      return (
        isNonEmptyString(payload.notification.id) &&
        typeof payload.notification.title === 'string'
      );
    }

    case 'quiz:submitted': {
      if (payload.students !== undefined && !Array.isArray(payload.students)) return false;
      if (payload.notification !== undefined && !isPlainObject(payload.notification)) return false;
      return true;
    }

    case 'teacher:broadcasted': {
      if (payload.notification !== undefined && !isPlainObject(payload.notification)) return false;
      if (payload.note !== undefined && !isPlainObject(payload.note)) return false;
      if (payload.students !== undefined && !Array.isArray(payload.students)) return false;
      return true;
    }

    case 'mystery:broadcasted': {
      if (payload.challenge !== undefined && !isPlainObject(payload.challenge)) return false;
      if (payload.notification !== undefined && !isPlainObject(payload.notification)) return false;
      return true;
    }

    case 'mystery:submitted': {
      if (payload.result !== undefined && !isPlainObject(payload.result)) return false;
      if (payload.students !== undefined && !Array.isArray(payload.students)) return false;
      if (payload.notification !== undefined && !isPlainObject(payload.notification)) return false;
      return true;
    }

    case 'PARAM_VALUE_SYNC': {
      return (
        isNonEmptyString(payload.paramKey) &&
        isFiniteNumber(payload.value) &&
        typeof payload.groupId === 'string'
      );
    }

    case 'CURSOR_3D_MOVE': {
      return (
        isNonEmptyString(payload.userId) &&
        Array.isArray(payload.position) &&
        payload.position.length === 3 &&
        isFiniteNumber(payload.position[0]) &&
        isFiniteNumber(payload.position[1]) &&
        isFiniteNumber(payload.position[2])
      );
    }

    case 'CURSOR_3D_LEAVE': {
      return isNonEmptyString(payload.userId);
    }

    case 'PARAM_LOCK_ACQUIRE': {
      return (
        isNonEmptyString(payload.paramKey) &&
        isNonEmptyString(payload.lockedByUserId) &&
        isFiniteNumber(payload.expiresAt)
      );
    }

    case 'PARAM_LOCK_RELEASE': {
      return isNonEmptyString(payload.paramKey) && typeof payload.groupId === 'string';
    }

    case 'PARAM_LOCKS_SYNC': {
      return Array.isArray(payload.locks);
    }

    case 'session:autosaved': {
      return isNonEmptyString(payload.sessionKey) && isFiniteNumber(payload.version);
    }

    default:
      // Unknown message types are rejected by strict guard
      return false;
  }
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

  // 1. Initial REST Hydration
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const res = await fetch('/api/lab-state');
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
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-lab`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        useCollabStore.getState().setWsConnected(true);
        attemptCount = 0;

        const activeRoomId = useCollabStore.getState().activeRoomId;
        // 1. Identify client session
        socket.send(
          JSON.stringify({
            type: 'client:identify',
            payload: {
              userId: `user-${studentName.replace(/\s+/g, '-').toLowerCase()}`,
              userName: studentName,
              role,
              groupId,
              domain,
              roomId: activeRoomId,
            },
          })
        );

        // 2. Sequentially flush any offline outbox events queued while reconnecting
        outboxQueueRef.current.flush((serializedMsg) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(serializedMsg);
          }
        });
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
        } else if (type === 'ROOM_CREATED' && isPlainObject(payload.room)) {
          const room = payload.room as unknown as LabRoom;
          const store = useCollabStore.getState();
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
          store.setActiveRoom(room);
          store.closeRoomModal();
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
        } else if (type === 'ROOM_STATE_SYNC' && isPlainObject(payload.room)) {
          useCollabStore.getState().setActiveRoom(payload.room as unknown as LabRoom);
        } else if (type === 'ROOM_ERROR' && typeof payload.message === 'string') {
          useCollabStore.getState().setRoomError(payload.message);
        } else if (type === 'TEACHER_FREEZE_TOGGLE') {
          useCollabStore
            .getState()
            .setTeacherFreeze(
              Boolean(payload.isFrozen),
              typeof payload.teacherName === 'string' ? payload.teacherName : undefined
            );
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

        // Auto-reconnect with exponential backoff: min(1000 * 2^attempt, 15000) ms + random jitter
        const reconnectDelay = calculateReconnectDelay(attemptCount);
        attemptCount += 1;
        reconnectTimerRef.current = window.setTimeout(connectWs, reconnectDelay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connectWs();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
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

  const deleteRecord = useCallback(
    (id: string) => {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      sendWs('record:delete', { id });
    },
    [sendWs]
  );

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
      sendWs('teacher:feedback', { targetStudentId, message, author });
    },
    [sendWs]
  );

  const broadcastMysteryChallenge = useCallback(
    (challenge: MysterySampleChallenge, author: string) => {
      setActiveMysteryChallenge(challenge);
      sendWs('mystery:broadcast', { challenge, author });
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

  const createRoom = useCallback(
    (
      pin: string,
      roomDomain: 'physics' | 'chemistry' | 'biology' | 'astronomy',
      moduleId: string,
      customRoomId?: string
    ) => {
      useCollabStore.getState().setRoomError(null);
      sendWs('ROOM_CREATE', {
        roomId: customRoomId,
        pin,
        domain: roomDomain,
        moduleId,
        teacherName: studentName,
        teacherUserId: `user-${studentName.replace(/\s+/g, '-').toLowerCase()}`,
      });
    },
    [sendWs, studentName]
  );

  const joinRoom = useCallback(
    (roomId: string, pin: string, joinAsRole?: 'teacher' | 'student') => {
      useCollabStore.getState().setRoomError(null);
      sendWs('ROOM_JOIN', {
        roomId,
        pin,
        name: studentName,
        role: joinAsRole || (role === 'Pengajar' ? 'teacher' : 'student'),
        userId: `user-${studentName.replace(/\s+/g, '-').toLowerCase()}`,
        groupId,
      });
    },
    [sendWs, studentName, role, groupId]
  );

  const leaveRoom = useCallback(() => {
    sendWs('ROOM_LEAVE', {});
    useCollabStore.getState().leaveRoom();
  }, [sendWs]);

  const toggleTeacherFreeze = useCallback(
    (isFrozen: boolean) => {
      const roomId = useCollabStore.getState().activeRoomId;
      useCollabStore.getState().setTeacherFreeze(isFrozen, studentName);
      if (roomId) {
        sendWs('TEACHER_FREEZE_TOGGLE', {
          roomId,
          isFrozen,
          teacherName: studentName,
        });
      }
    },
    [sendWs, studentName]
  );

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
    deleteRecord,
    toggleTask,
    createTask,
    createNote,
    submitQuizScore,
    pushNotification,
    broadcastTeacherFeedback,
    broadcastMysteryChallenge,
    submitMysteryExam,
    dismissMysteryChallenge,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleTeacherFreeze,
    syncStudentTelemetry,
    syncParameterChange,
  };
}
