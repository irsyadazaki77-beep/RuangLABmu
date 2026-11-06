/**
 * RuangLABmu Real-Time Collaboration Protocol
 * Phase 3: 3D Spatial Laser Cursors, Parameter Locking Mutex, and Live Value Synchronization
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

export type CollabWSMessage =
  | { type: 'CURSOR_3D_MOVE'; payload: SpatialCursorPayload }
  | { type: 'CURSOR_3D_LEAVE'; payload: { userId: string; groupId: string } }
  | { type: 'PARAM_LOCK_ACQUIRE'; payload: ParameterLockPayload }
  | { type: 'PARAM_LOCK_RELEASE'; payload: { groupId: string; domain: string; paramKey: string; userId: string } }
  | { type: 'PARAM_VALUE_SYNC'; payload: { groupId: string; domain: string; paramKey: string; value: number; updatedBy: string } }
  | { type: 'PARAM_LOCKS_SYNC'; payload: { locks: ParameterLockPayload[] } };

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
  if (role === 'Pengajar' || userName.toLowerCase().includes('pengajar') || userName.toLowerCase().includes('dr.')) {
    return '#f87171';
  }
  return USER_COLOR_PALETTE[userName] || '#60a5fa';
}
