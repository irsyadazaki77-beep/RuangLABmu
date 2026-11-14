import type { WebSocket, WebSocketServer } from 'ws';
import type { LabServerState } from '../state/labServerState';

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
