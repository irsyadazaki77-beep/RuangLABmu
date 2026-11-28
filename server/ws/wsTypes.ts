import type { WebSocket, WebSocketServer } from 'ws';
import type { SessionTokenClaims } from '../auth/sessionToken';
import type { LabServerState } from '../state/labServerState';
import type { RealtimeEventBus } from './realtimeEventBus';
export type {
  ClientIdentifyPayload,
  ClientToServerMessage,
  ServerToClientMessage,
  WsErrorPayload,
  WsValidationIssue,
} from '../../src/shared/contracts/wsContracts';

export interface ExtWebSocket extends WebSocket {
  socketId: string;
  userId?: string;
  userName?: string;
  role?: 'Siswa' | 'Pengajar';
  groupId?: string;
  domain?: 'fisika' | 'kimia' | 'biologi' | 'astronomi' | 'kebumian';
  roomId?: string;
  schoolId?: string;
  sessionClaims?: SessionTokenClaims | null;
  msgTimestamps?: number[];
  rateLimitNotifiedAt?: number;
  isAlive?: boolean;
  remoteIp?: string;
}

export interface WsBackpressureStats {
  droppedNonCriticalFrames: number;
  rateLimitedDrops?: number;
}

export interface CollabSocketContext {
  wss: WebSocketServer;
  eventBus: RealtimeEventBus;
  broadcastAll: (payload: unknown) => void;
  broadcastRoom: (roomId: string, payload: unknown, excludeWs?: WebSocket) => void;
  broadcastSchool: (schoolId: string, payload: unknown, excludeWs?: WebSocket) => void;
  broadcastSchoolTeachers: (schoolId: string, payload: unknown, excludeWs?: WebSocket) => void;
  broadcastGroup: (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket,
    roomIdScope?: string,
    schoolIdScope?: string
  ) => void;
  getBackpressureStats: () => WsBackpressureStats;
}

export interface WsHandlerServices {
  state: LabServerState;
  eventBus?: RealtimeEventBus;
  broadcastAll: (payload: unknown) => void;
  broadcastRoom: (roomId: string, payload: unknown, excludeWs?: WebSocket) => void;
  broadcastSchool?: (schoolId: string, payload: unknown, excludeWs?: WebSocket) => void;
  broadcastSchoolTeachers?: (schoolId: string, payload: unknown, excludeWs?: WebSocket) => void;
  broadcastGroup: (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket,
    roomIdScope?: string,
    schoolIdScope?: string
  ) => void;
}
