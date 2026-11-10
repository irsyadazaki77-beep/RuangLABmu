import { useEffect, useRef, useState, useCallback } from 'react';
import { ExperimentRecord, LabNotification } from '../utils/scienceEngine';
import { GroupTaskItem, CollabNoteItem } from '../components/CollaborationAndDataSection';
import { StudentProgressItem } from '../components/TeacherDashboardView';
import { MysterySampleChallenge, MysterySubmissionResult } from '../utils/mysteryChallengeEngine';
import { useCollabStore } from '../stores/useCollabStore';
import { StudentLiveTelemetry } from '../utils/collabProtocol';

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
}

const STORAGE_KEY = 'ruanglab_client_cache_v2';

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

  // 1. Initial REST Hydration
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const res = await fetch('/api/lab-state');
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (Array.isArray(data.records)) setRecords(data.records);
          if (Array.isArray(data.tasks)) setTasks(data.tasks);
          if (Array.isArray(data.notes)) setNotes(data.notes);
          if (Array.isArray(data.students)) setStudents(data.students);
          if (Array.isArray(data.notifications)) setNotifications(data.notifications);
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
          const parsed = JSON.parse(saved);
          if (parsed.records) setRecords(parsed.records);
          if (parsed.tasks) setTasks(parsed.tasks);
          if (parsed.notes) setNotes(parsed.notes);
        }
      } catch {
        // ignore storage error
      }
      if (!cancelled) setIsHydrated(true);
    };

    hydrate();
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

  // 2. WebSocket Connection & Event Routing
  useEffect(() => {
    let unmounted = false;
    let retryCount = 0;

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
        retryCount = 0;
        const activeRoomId = useCollabStore.getState().activeRoomId;
        // Identify
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
      };

      socket.onmessage = (event) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init:state' && msg.payload) {
            if (Array.isArray(msg.payload.records)) setRecords(msg.payload.records);
            if (Array.isArray(msg.payload.tasks)) setTasks(msg.payload.tasks);
            if (Array.isArray(msg.payload.notes)) setNotes(msg.payload.notes);
            if (Array.isArray(msg.payload.students)) setStudents(msg.payload.students);
            if (Array.isArray(msg.payload.notifications)) setNotifications(msg.payload.notifications);
          } else if (msg.type === 'ROOM_CREATED' && msg.payload?.room) {
            const store = useCollabStore.getState();
            store.setActiveRoom(msg.payload.room);
            store.closeRoomModal();
            setNotifications((prev) => [
              {
                id: `notif-room-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                severity: 'nominal',
                domain: 'Kolaborasi',
                title: `Meja Praktikum [${msg.payload.room.roomId}] Dibuat`,
                message: `PIN Ruangan: ${msg.payload.room.pin}. Bagikan kode ini kepada siswa untuk bergabung ke meja praktikum.`,
              },
              ...prev.slice(0, 24),
            ]);
          } else if (msg.type === 'ROOM_JOINED' && msg.payload?.room) {
            const store = useCollabStore.getState();
            store.setActiveRoom(msg.payload.room);
            store.closeRoomModal();
            setNotifications((prev) => [
              {
                id: `notif-join-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                severity: 'nominal',
                domain: 'Kolaborasi',
                title: `Bergabung ke Meja [${msg.payload.room.roomId}]`,
                message: `Anda telah terhubung ke meja praktikum bersama ${Object.keys(msg.payload.room.clients || {}).length} peserta.`,
              },
              ...prev.slice(0, 24),
            ]);
          } else if (msg.type === 'ROOM_STATE_SYNC' && msg.payload?.room) {
            useCollabStore.getState().setActiveRoom(msg.payload.room);
          } else if (msg.type === 'ROOM_ERROR' && msg.payload?.message) {
            useCollabStore.getState().setRoomError(msg.payload.message);
          } else if (msg.type === 'TEACHER_FREEZE_TOGGLE' && msg.payload) {
            useCollabStore.getState().setTeacherFreeze(Boolean(msg.payload.isFrozen), msg.payload.teacherName);
          } else if (msg.type === 'STUDENT_TELEMETRY_SYNC' && msg.payload?.telemetry) {
            const t = msg.payload.telemetry as StudentLiveTelemetry;
            if (t.studentName) {
              useCollabStore.getState().updateStudentTelemetry(t.studentName, t);
            }
          } else if (msg.type === 'record:created' && msg.payload?.record) {
            setRecords((prev) => {
              if (prev.some((r) => r.id === msg.payload.record.id)) return prev;
              return [msg.payload.record, ...prev];
            });
            if (msg.payload.students) setStudents(msg.payload.students);
          } else if (msg.type === 'record:deleted' && msg.payload?.id) {
            setRecords((prev) => prev.filter((r) => r.id !== msg.payload.id));
          } else if (msg.type === 'task:updated' && msg.payload?.tasks) {
            setTasks(msg.payload.tasks);
          } else if (msg.type === 'note:created' && msg.payload?.note) {
            setNotes((prev) => {
              if (prev.some((n) => n.id === msg.payload.note.id)) return prev;
              return [...prev, msg.payload.note];
            });
          } else if (msg.type === 'notification:pushed' && msg.payload?.notification) {
            setNotifications((prev) => [msg.payload.notification, ...prev.slice(0, 24)]);
          } else if (msg.type === 'quiz:submitted' && msg.payload) {
            if (msg.payload.students) setStudents(msg.payload.students);
            if (msg.payload.notification) {
              setNotifications((prev) => [msg.payload.notification, ...prev.slice(0, 24)]);
            }
          } else if (msg.type === 'teacher:broadcasted' && msg.payload) {
            if (msg.payload.notification) {
              setNotifications((prev) => [msg.payload.notification, ...prev.slice(0, 24)]);
            }
            if (msg.payload.note) {
              setNotes((prev) => [...prev, msg.payload.note]);
            }
            if (msg.payload.students) setStudents(msg.payload.students);
          } else if (msg.type === 'mystery:broadcasted' && msg.payload) {
            if (msg.payload.challenge) setActiveMysteryChallenge(msg.payload.challenge);
            if (msg.payload.notification) {
              setNotifications((prev) => [msg.payload.notification, ...prev.slice(0, 24)]);
            }
          } else if (msg.type === 'mystery:submitted' && msg.payload) {
            if (msg.payload.result) {
              setMysterySubmissions((prev) => [msg.payload.result, ...prev]);
            }
            if (msg.payload.students) setStudents(msg.payload.students);
            if (msg.payload.notification) {
              setNotifications((prev) => [msg.payload.notification, ...prev.slice(0, 24)]);
            }
          }
        } catch (err) {
          console.error('Error handling backend sync message:', err);
        }
      };

      socket.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        useCollabStore.getState().setWsConnected(false);
        wsRef.current = null;
        retryCount++;
        const baseDelay = Math.min(1000 * Math.pow(1.5, Math.min(retryCount, 6)), 12000);
        const jitter = Math.random() * 500;
        const reconnectDelay = Math.round(baseDelay + jitter);
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

  const sendWs = useCallback((type: string, payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

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
  };
}

