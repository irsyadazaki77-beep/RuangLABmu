/**
 * RuangLABmu Real-Time Collaboration Protocol
 * Phase 3 & 4: 3D Spatial Cursors, Parameter Locking Mutex, Room Isolation & Teacher Controls
 */

export interface SpatialCursorPayload {
  userId: string;
  userName: string;
  role: 'Siswa' | 'Pengajar';
  groupId: string;
  domain: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  color: string;
  position: [number, number, number]; // 3D world coordinates [x, y, z]
  normal?: [number, number, number];  // Surface normal vector
  hoveredObject?: string;             // e.g., "Buret Asam", "Beban M1", "Planet Bumi"
  updatedAt: number;
}

export interface ParameterLockPayload {
  groupId: string;
  domain: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  paramKey: string;      // e.g., "gravity", "mass", "inclineAngle"
  lockedByUserId: string;
  lockedByName: string;
  expiresAt: number;     // Auto-expire after 5000ms to prevent deadlocks on disconnect
}

export interface StudentLiveTelemetry {
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi' | string;
  topic?: string;
  moduleId: string;
  moduleTitle?: string;
  trialsCount?: number;
  recordsCount?: number;
  currentParameters?: Record<string, number | string | boolean | undefined>;
  rSquared: number;
  currentActivity?: string;
  status?: string;
  lastUpdated: string;
  parametersSummary?: string;
  studentName?: string;
}

export interface LabRoomClient {
  socketId: string;
  userId: string;
  name: string;
  role: 'teacher' | 'student';
  groupId?: string;
  joinedAt: number;
  telemetry?: StudentLiveTelemetry;
}

export interface LabRoom {
  roomId: string;
  pin: string;
  domain: 'physics' | 'chemistry' | 'biology' | 'astronomy';
  moduleId: string;
  teacherSocketId?: string;
  teacherName?: string;
  isFrozenByTeacher: boolean;
  createdAt: number;
  clients: Record<string, LabRoomClient>;
}

export type CollabWSMessage =
  | { type: 'CURSOR_3D_MOVE'; payload: SpatialCursorPayload }
  | { type: 'CURSOR_3D_LEAVE'; payload: { userId: string; groupId: string } }
  | { type: 'PARAM_LOCK_ACQUIRE'; payload: ParameterLockPayload }
  | { type: 'PARAM_LOCK_RELEASE'; payload: { groupId: string; domain: string; paramKey: string; userId: string } }
  | { type: 'PARAM_VALUE_SYNC'; payload: { groupId: string; domain: string; paramKey: string; value: number; updatedBy: string } }
  | { type: 'PARAM_LOCKS_SYNC'; payload: { locks: ParameterLockPayload[] } }
  | { type: 'ROOM_CREATE'; payload: { roomId?: string; pin: string; domain: 'physics' | 'chemistry' | 'biology' | 'astronomy'; moduleId: string; teacherName: string; teacherUserId: string } }
  | { type: 'ROOM_CREATED'; payload: { room: LabRoom } }
  | { type: 'ROOM_JOIN'; payload: { roomId: string; pin: string; name: string; role: 'teacher' | 'student'; userId: string; groupId?: string } }
  | { type: 'ROOM_JOINED'; payload: { room: LabRoom; client: LabRoomClient } }
  | { type: 'ROOM_ERROR'; payload: { message: string; code: string } }
  | { type: 'ROOM_LEAVE'; payload: { roomId: string; userId: string } }
  | { type: 'TEACHER_FREEZE_TOGGLE'; payload: { roomId: string; isFrozen: boolean; teacherName: string } }
  | { type: 'STUDENT_TELEMETRY_SYNC'; payload: { roomId: string; studentName: string; userId: string; telemetry: StudentLiveTelemetry } }
  | { type: 'ROOM_STATE_SYNC'; payload: { room: LabRoom } };

/**
 * Deterministic color palette for student avatars, laser pointers, and cursor badges
 */
export const USER_COLOR_PALETTE: Record<string, string> = {
  'Alya Pratama': '#38bdf8',       // Sky Blue
  'Bima Wijaya': '#34d399',        // Emerald Green
  'Citra Lestari': '#f472b6',      // Coral Pink
  'Dimas Nugroho': '#fbbf24',      // Amber Gold
  'Elena Putri': '#a78bfa',        // Lavender Purple
  'Dr. Hendra Kusuma': '#f87171',  // Red Rose (Pengajar)
};

export function getUserColor(userName: string, role?: string): string {
  if (role === 'Pengajar' || role === 'teacher' || userName.toLowerCase().includes('pengajar') || userName.toLowerCase().includes('dr.')) {
    return '#f87171';
  }
  return USER_COLOR_PALETTE[userName] || '#60a5fa';
}

/**
 * Helper to generate random 5-character uppercase Room ID (e.g., LAB-42)
 */
export function generateRandomRoomId(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const num = Math.floor(10 + Math.random() * 89);
  const code = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
  return `LAB-${code}${num}`;
}
