import type {
  CollabNote,
  GroupTask,
  ServerExperimentRecord,
  ServerNotification,
  StudentProgress,
} from '../state/labServerState';
import { authorizeTeacherAction } from './wsAuth';
import type { ExtWebSocket, WsHandlerServices } from './wsTypes';

export function handleRecordCreate(
  rec: ServerExperimentRecord,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  if (!state.experimentRecords.some((r) => r.id === rec.id)) {
    state.experimentRecords.unshift(rec);
  }
  const stu = state.studentRoster.find((s) => s.name === rec.studentName);
  if (stu) {
    stu.trialsRecorded += 1;
    stu.completionPct = Math.min(100, stu.completionPct + 8);
    stu.lastActive = 'Baru saja';
    stu.activeDomain = rec.domain;
    stu.currentActivity = `Merekam data: ${rec.experimentTitle}`;
    if (stu.completionPct >= 90) stu.status = 'Selesai';
  }
  state.persistServerState();
  broadcastAll({
    type: 'record:created',
    payload: { record: rec, students: state.studentRoster },
  });
}

export function handleRecordDelete(
  id: string,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  const idx = state.experimentRecords.findIndex((r) => r.id === id);
  if (idx !== -1) {
    state.experimentRecords.splice(idx, 1);
    state.persistServerState();
    broadcastAll({
      type: 'record:deleted',
      payload: { id },
    });
  }
}

export function handleTaskToggle(
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  const taskId = typeof payload.id === 'string' ? payload.id : '';
  const task = state.groupTasks.find((t) => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    task.completedBy = task.completed
      ? (typeof payload.studentName === 'string' && payload.studentName) || 'Siswa'
      : undefined;
    state.persistServerState();
    broadcastAll({ type: 'task:updated', payload: { tasks: state.groupTasks } });
  }
}

export function handleTaskCreate(
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  const title = typeof payload.title === 'string' ? payload.title : '';
  if (!title) return;
  const newTask: GroupTask = {
    id: typeof payload.id === 'string' && payload.id ? payload.id : `task-${Date.now()}`,
    groupId:
      typeof payload.groupId === 'string' && payload.groupId
        ? payload.groupId
        : 'Kelompok 1 — Mekanika',
    title,
    domain:
      payload.domain === 'Kimia' ||
      payload.domain === 'Biologi' ||
      payload.domain === 'Astronomi'
        ? payload.domain
        : 'Fisika',
    completed: false,
  };
  state.groupTasks.push(newTask);
  state.persistServerState();
  broadcastAll({ type: 'task:updated', payload: { tasks: state.groupTasks } });
}

export function handleNoteCreate(
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  const text = typeof payload.text === 'string' ? payload.text : '';
  if (!text) return;
  const note: CollabNote = {
    id: typeof payload.id === 'string' && payload.id ? payload.id : `note-${Date.now()}`,
    groupId:
      typeof payload.groupId === 'string' && payload.groupId
        ? payload.groupId
        : 'Kelompok 1 — Mekanika',
    author:
      typeof payload.author === 'string' && payload.author
        ? payload.author
        : 'Alya Pratama',
    role: payload.role === 'Pengajar' ? 'Pengajar' : 'Siswa',
    text,
    timestamp: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
  if (!state.collabNotes.some((n) => n.id === note.id)) {
    state.collabNotes.push(note);
    state.persistServerState();
    broadcastAll({ type: 'note:created', payload: { note } });
  }
}

export function handleQuizSubmit(
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  const studentName = String(payload.studentName || 'Siswa');
  const score = Number(payload.score || 0);
  const correctCount = Number(payload.correctCount || 0);

  const stu = state.studentRoster.find((s) => s.name === studentName);
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
  state.notifications.unshift(notif);
  state.persistServerState();
  broadcastAll({
    type: 'quiz:submitted',
    payload: { students: state.studentRoster, notification: notif },
  });
}

export function handleNotificationPush(
  notif: ServerNotification,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  if (!state.notifications.some((n) => n.id === notif.id)) {
    state.notifications.unshift(notif);
    state.persistServerState();
    broadcastAll({
      type: 'notification:pushed',
      payload: { notification: notif },
    });
  }
}

export function handleTeacherFeedback(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  const auth = authorizeTeacherAction(ws, payload, state.activeLabRooms);
  if (!auth.authorized) return;

  const targetStudentId =
    typeof payload.targetStudentId === 'string' ? payload.targetStudentId : undefined;
  const message = typeof payload.message === 'string' ? payload.message : '';
  const author =
    typeof payload.author === 'string' && payload.author
      ? payload.author
      : 'Dr. Hendra Kusuma';

  const targetStu = state.studentRoster.find((s) => s.id === targetStudentId);
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
    message: `${author}: "${message}"`,
  };
  state.notifications.unshift(notif);
  const note: CollabNote = {
    id: `note-tf-${Date.now()}`,
    groupId: targetStu ? targetStu.groupId : 'Semua Kelompok',
    author,
    role: 'Pengajar',
    text: targetStu ? `@${targetStu.name}: ${message}` : `[PENGUMUMAN KELAS] ${message}`,
    timestamp: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
  state.collabNotes.push(note);
  if (targetStu && targetStu.status === 'Butuh Bantuan') {
    targetStu.status = 'Nominal';
  }
  state.persistServerState();
  broadcastAll({
    type: 'teacher:broadcasted',
    payload: { notification: notif, note, students: state.studentRoster },
  });
}

export function handleMysteryBroadcast(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  const auth = authorizeTeacherAction(ws, payload, state.activeLabRooms);
  if (!auth.authorized) return;

  const challenge = (payload.challenge || {}) as Record<string, unknown>;
  const author =
    typeof payload.author === 'string' && payload.author
      ? payload.author
      : 'Dr. Hendra Kusuma';
  const codename = String(
    challenge.codename || challenge.codeName || challenge.id || 'MISTERI'
  );
  const title = String(challenge.title || 'Sampel Misteri');

  const notif: ServerNotification = {
    id: `notif-mys-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    severity: 'critical',
    domain: 'Pengajar',
    title: `UJIAN PRAKTIKUM MISTERI: ${title}`,
    message: `${author} mengirim sampel misteri [${codename}] ke meja kerja Anda.`,
  };
  state.notifications.unshift(notif);
  state.persistServerState();
  broadcastAll({
    type: 'mystery:broadcasted',
    payload: { challenge, notification: notif },
  });
}

export function handleMysterySubmit(
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastAll } = services;
  const studentName = String(payload.studentName || 'Siswa');
  const challengeTitle = String(payload.challengeTitle || 'Ujian Misteri');
  const result = (payload.result || {}) as Record<string, unknown>;
  const score = Number(result.score || 0);
  const passed = Boolean(result.passed);

  const stu = state.studentRoster.find((s) => s.name === studentName);
  if (stu) {
    stu.completionPct = Math.min(100, Math.max(stu.completionPct, score));
    stu.currentActivity = `Ujian Sampel Misteri: ${score}/100 (${passed ? 'LULUS' : 'REMEDIAL'})`;
    stu.lastActive = 'Baru saja';
    if (passed) stu.status = 'Selesai';
  }
  const guessVal = String(result.studentGuess ?? result.submittedValue ?? '-');
  const guessUnit = result.unit ? ` ${String(result.unit)}` : '';
  const errPct = String(result.errorPercentage ?? result.errorPercent ?? 0);
  const notif: ServerNotification = {
    id: `notif-mys-sub-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    severity: passed ? 'nominal' : 'elevated',
    domain: 'Pengajar',
    title: `Hasil Ujian Misteri ${studentName}: ${score}/100`,
    message: `${studentName} menebak ${guessVal}${guessUnit} pada "${challengeTitle}" (Galat: ${errPct}%).`,
  };
  state.notifications.unshift(notif);
  state.persistServerState();
  broadcastAll({
    type: 'mystery:submitted',
    payload: {
      studentName,
      result,
      students: state.studentRoster,
      notification: notif,
    },
  });
}
