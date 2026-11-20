import type { WebSocket, WebSocketServer } from 'ws';
import type { LabServerState } from '../state/labServerState';
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
  domain?: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  roomId?: string;
  isAlive?: boolean;
  remoteIp?: string;
}

export interface WsBackpressureStats {
  droppedNonCriticalFrames: number;
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
  getBackpressureStats: () => WsBackpressureStats;
}

export interface WsHandlerServices {
  state: LabServerState;
  broadcastAll: (payload: unknown) => void;
  broadcastRoom: (roomId: string, payload: unknown, excludeWs?: WebSocket) => void;
  broadcastGroup: (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket,
    roomIdScope?: string
  ) => void;
}
