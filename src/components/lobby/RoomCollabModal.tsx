import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { KeyRound, QrCode as QrCodeIcon, Wifi, X } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';
import { generateRandomRoomId, generateRandomRoomPin } from '../../utils/collabProtocol';
import { UserRole } from '../../stores/useLabStore';

const DEFAULT_MODULE_BY_DOMAIN: Record<
  'physics' | 'chemistry' | 'biology' | 'astronomy',
  string
> = {
  physics: 'newton-incline',
  chemistry: 'acid-base-titration',
  biology: 'photosynthesis-ingenhousz',
  astronomy: 'solar-kepler',
};

export interface RoomCollabModalProps {
  isOpen: boolean;
  mode: 'create' | 'join';
  roomError: string | null;
  userRole: UserRole;
  lanInfo: {
    ip: string;
    port: number;
    localUrl: string;
    allLanIps: string[];
  } | null;
  onOpenMode: (mode: 'create' | 'join') => void;
  onClose: () => void;
  onSetRoomError: (err: string | null) => void;
  onSetUserRole: (role: UserRole) => void;
  onCreateRoom?: (
    pin: string,
    domain: 'physics' | 'chemistry' | 'biology' | 'astronomy',
    moduleId: string,
    customRoomId?: string
  ) => void;
  onJoinRoom?: (roomId: string, pin: string, joinAsRole?: 'teacher' | 'student') => void;
}

export const RoomCollabModal: React.FC<RoomCollabModalProps> = ({
  isOpen,
  mode,
  roomError,
  userRole,
  lanInfo,
  onOpenMode,
  onClose,
  onSetRoomError,
  onSetUserRole,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [formRoomId, setFormRoomId] = useState<string>('');
  const [formPin, setFormPin] = useState<string>('');
  const [formDomain, setFormDomain] = useState<
    'physics' | 'chemistry' | 'biology' | 'astronomy'
  >('physics');
  const [formRole, setFormRole] = useState<'teacher' | 'student'>(
    userRole === 'pengajar' ? 'teacher' : 'student'
  );
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ roomId: string; domain: string; teacherName?: string; clientCount: number }>
  >([]);
  const [selectedLanIp, setSelectedLanIp] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    if (lanInfo?.ip && !selectedLanIp) {
      setSelectedLanIp(lanInfo.ip);
    }
  }, [lanInfo?.ip, selectedLanIp]);

  useEffect(() => {
    const ip = selectedLanIp || lanInfo?.ip;
    if (!ip) return;
    const port = lanInfo?.port || 3000;
    const cleanRoom = mode === 'create' ? formRoomId.trim().toUpperCase() : '';
    const url = cleanRoom
      ? `http://${ip}:${port}/?room=${encodeURIComponent(cleanRoom)}`
      : `http://${ip}:${port}`;
    QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((dataUrl) => setQrCodeDataUrl(dataUrl))
      .catch(() => {});
  }, [selectedLanIp, lanInfo?.ip, lanInfo?.port, mode, formRoomId]);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'create') {
      setFormRoomId((prev) => prev || generateRandomRoomId());
      setFormPin((prev) => prev || generateRandomRoomPin());
    } else {
      setFormRoomId('');
      setFormPin('');
    }
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.rooms)) {
          setAvailableRooms(data.rooms);
        }
      })
      .catch(() => {});
  }, [isOpen, mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    labSound.playClick(680);
    onSetRoomError(null);
    if (mode === 'create') {
      const code = (formRoomId || generateRandomRoomId()).toUpperCase().trim();
      const pinCode = (formPin || generateRandomRoomPin()).trim();
      onSetUserRole('pengajar');
      if (onCreateRoom) {
        onCreateRoom(pinCode, formDomain, DEFAULT_MODULE_BY_DOMAIN[formDomain], code);
      }
    } else {
      const code = formRoomId.toUpperCase().trim();
      const pinCode = formPin.trim();
      if (!code || !pinCode) {
        onSetRoomError('Masukkan Kode Ruangan (Room ID) dan Kode PIN terlebih dahulu.');
        return;
      }
      onSetUserRole(formRole === 'teacher' ? 'pengajar' : 'siswa');
      if (onJoinRoom) {
        onJoinRoom(code, pinCode, formRole);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pengaturan Meja Praktikum"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-md w-full rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
            <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h3 className="text-base font-bold">
                  {mode === 'create'
                    ? 'Buat Meja Praktikum Baru'
                    : 'Masuk Meja Praktikum dengan PIN'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup Modal Meja Praktikum"
                className="p-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--comfort-surface-subtle)] rounded-lg border border-[var(--comfort-border)]">
              <button
                type="button"
                onClick={() => {
                  onOpenMode('join');
                  setFormRoomId('');
                  setFormPin('');
                }}
                className={`py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'join'
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                Masuk dengan PIN
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenMode('create');
                  setFormRoomId(generateRandomRoomId());
                  setFormPin(generateRandomRoomPin());
                }}
                className={`py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'create'
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                + Buat Room
              </button>
            </div>

            {roomError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/35 text-xs font-medium text-rose-700 dark:text-rose-300">
                {roomError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--comfort-text-muted)] mb-1">
                  Kode Meja Praktikum (4–6 Karakter Unik)
                </label>
                <input
                  type="text"
                  value={formRoomId}
                  onChange={(e) => setFormRoomId(e.target.value.toUpperCase())}
                  placeholder="Contoh: LAB-ALPHA"
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono text-sm font-bold text-sky-700 dark:text-sky-300 uppercase focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--comfort-text-muted)] mb-1">
                  Kode PIN Keamanan Meja
                </label>
                <input
                  type="text"
                  data-testid="room-pin-input"
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value)}
                  placeholder="Masukkan PIN 4–6 digit"
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono text-sm font-bold text-[var(--comfort-text)] focus:outline-none focus:border-sky-500"
                />
              </div>

              {mode === 'create' ? (
                <div>
                  <label className="block text-xs font-semibold text-[var(--comfort-text-muted)] mb-1">
                    Domain Sains Praktikum
                  </label>
                  <select
                    value={formDomain}
                    onChange={(e) =>
                      setFormDomain(
                        e.target.value as 'physics' | 'chemistry' | 'biology' | 'astronomy'
                      )
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs font-semibold text-[var(--comfort-text)]"
                  >
                    <option value="physics">Fisika (Mekanika, Gelombang, Optik)</option>
                    <option value="chemistry">Kimia (Termokimia, Titrasi, Elektrokimia)</option>
                    <option value="biology">Biologi (Fotosintesis, Enzim, Osmosis)</option>
                    <option value="astronomy">Astronomi (Hukum Kepler &amp; Astrofisika)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[var(--comfort-text-muted)] mb-1">
                    Peran Peserta di Meja Praktikum
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormRole('student')}
                      className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                        formRole === 'student'
                          ? 'bg-sky-500/12 border-sky-500 text-sky-700 dark:text-sky-300'
                          : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
                      }`}
                    >
                      Siswa Praktikan
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormRole('teacher')}
                      className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                        formRole === 'teacher'
                          ? 'bg-amber-500/12 border-amber-500 text-amber-700 dark:text-amber-300'
                          : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
                      }`}
                    >
                      Guru Pengampu
                    </button>
                  </div>
                </div>
              )}

              {mode === 'join' && availableRooms.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <div className="text-2xs font-mono text-[var(--comfort-text-muted)]">
                    Meja Aktif Tersedia:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableRooms.map((r) => (
                      <button
                        key={r.roomId}
                        type="button"
                        onClick={() => {
                          setFormRoomId(r.roomId);
                          setFormPin('');
                        }}
                        className="px-2.5 py-1 rounded-md bg-[var(--comfort-surface-subtle)] hover:border-sky-500 border border-[var(--comfort-border)] text-2xs font-mono text-sky-700 dark:text-sky-300 cursor-pointer tabular-nums"
                      >
                        {r.roomId} ({r.clientCount} peserta)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div
                data-testid="lan-hotspot-info-card"
                className="p-3.5 rounded-lg bg-amber-500/8 border border-amber-500/25 text-xs space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                    <Wifi className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Mode LAN Kelas 3T (Tanpa Kuota Internet)</span>
                  </div>
                  {lanInfo?.allLanIps && lanInfo.allLanIps.length > 1 && (
                    <span className="text-2xs font-mono text-amber-700 dark:text-amber-300 tabular-nums">
                      {lanInfo.allLanIps.length} IP
                    </span>
                  )}
                </div>

                <p className="text-2xs leading-relaxed text-[var(--comfort-text-muted)]">
                  Nyalakan Hotspot Wi-Fi di laptop Guru, lalu siswa membuka alamat IP lokal atau memindai QR Code berikut untuk praktikum bersama tanpa kuota:
                </p>

                {lanInfo?.allLanIps && lanInfo.allLanIps.length > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-[var(--comfort-surface-subtle)] p-2 rounded-lg border border-[var(--comfort-border)]">
                    <label className="text-2xs font-semibold text-[var(--comfort-text-muted)] shrink-0">
                      IP Guru:
                    </label>
                    <select
                      value={selectedLanIp}
                      onChange={(e) => {
                        setSelectedLanIp(e.target.value);
                        labSound.playClick();
                      }}
                      className="flex-1 text-xs font-mono font-bold bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-md px-2 py-1 text-sky-700 dark:text-sky-300 focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {lanInfo.allLanIps.map((ip) => (
                        <option key={ip} value={ip}>
                          {ip} {ip.startsWith('192.168.') || ip.startsWith('10.') ? '★' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 bg-[var(--comfort-surface-subtle)] px-3 py-2 rounded-lg border border-[var(--comfort-border)] font-mono text-xs">
                  <span className="text-[var(--comfort-text-muted)]">URL LAN:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 select-all">
                    {`http://${selectedLanIp || lanInfo?.ip || '192.168.43.1'}:${lanInfo?.port || 3000}`}
                  </span>
                </div>

                {qrCodeDataUrl && (
                  <div className="flex items-center gap-3 p-2.5 bg-[var(--comfort-surface)] rounded-lg border border-[var(--comfort-border)]">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code Meja Praktikum LAN"
                      data-testid="lan-room-qr-code"
                      className="w-20 h-20 rounded-md bg-white p-1 border border-[var(--comfort-border)] shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <QrCodeIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Pindai Kode QR Meja Praktikum</span>
                      </div>
                      <p className="text-2xs leading-relaxed text-[var(--comfort-text-muted)]">
                        Arahkan kamera HP siswa ke QR ini untuk bergabung ke meja praktikum LAN tanpa kuota.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] hover:opacity-90 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs cursor-pointer"
                >
                  {mode === 'create' ? 'Buka Meja Praktikum' : 'Gabung Sekarang'}
                </button>
              </div>
            </form>
          </div>
    </div>
  );
};
