import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  UserCheck,
  GraduationCap,
  ShieldCheck,
  LogOut,
  X,
  KeyRound,
  AlertCircle,
  Loader2,
  Building2,
} from 'lucide-react';
import { useAuthStore, type ClientAuthSession } from '../../stores/useAuthStore';
import { useLabStore } from '../../stores/useLabStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { DEFAULT_SCHOOL_ID } from '../../utils/offlineOutbox';
import { labSound } from '../../utils/soundEngine';

export interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDisplayName?: string;
}

interface AuthStatusResponse {
  mode: 'env' | 'claimed' | 'needs_bootstrap';
  requiresBootstrap: boolean;
  schoolId: string;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  defaultDisplayName = 'Alya Pratama',
}) => {
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setUserRole = useLabStore((s) => s.setUserRole);
  const activeRoomId = useCollabStore((s) => s.activeRoomId);

  const [roleTab, setRoleTab] = useState<'student' | 'teacher'>(
    session?.role === 'teacher' || session?.role === 'admin' ? 'teacher' : 'student'
  );
  const [schoolId, setSchoolId] = useState(session?.schoolId || DEFAULT_SCHOOL_ID);
  const [displayName, setDisplayName] = useState(session?.displayName || defaultDisplayName);
  const [roomId, setRoomId] = useState(session?.roomId || activeRoomId || '');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [teacherMode, setTeacherMode] = useState<'env' | 'claimed' | 'needs_bootstrap'>('claimed');
  const [statusLoading, setStatusLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setErrorMsg(null);
    setSuccessMsg(null);
    setPasscode('');
    setConfirmPasscode('');
    setStatusLoading(true);

    fetch(`/api/auth/status?schoolId=${encodeURIComponent(schoolId.trim() || DEFAULT_SCHOOL_ID)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AuthStatusResponse | null) => {
        if (active && data?.mode) {
          setTeacherMode(data.mode);
        }
      })
      .catch(() => {
        if (active) setTeacherMode('claimed');
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, schoolId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isBootstrapTeacher = roleTab === 'teacher' && teacherMode === 'needs_bootstrap';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanSchool = schoolId.trim() || DEFAULT_SCHOOL_ID;
    const cleanName =
      displayName.trim() || (roleTab === 'teacher' ? 'Pengajar RuangLABmu' : 'Siswa Praktikan');
    const cleanRoom = roomId.trim().toUpperCase();
    const cleanPass = passcode.trim();

    if (roleTab === 'teacher') {
      if (!cleanPass) {
        setErrorMsg('Masukkan PIN atau Passcode pengajar.');
        return;
      }
      if (isBootstrapTeacher) {
        if (cleanPass.length < 6) {
          setErrorMsg('PIN pengajar baru minimal 6 karakter.');
          return;
        }
        if (cleanPass !== confirmPasscode.trim()) {
          setErrorMsg('Konfirmasi PIN pengajar tidak cocok.');
          return;
        }
      }
    } else if (cleanRoom && !cleanPass) {
      setErrorMsg('PIN ruangan wajib diisi jika ingin mengikat sesi ke ruangan kolaborasi.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isBootstrapTeacher ? '/api/auth/bootstrap-teacher' : '/api/auth/session';
      const payload = isBootstrapTeacher
        ? { schoolId: cleanSchool, teacherName: cleanName, passcode: cleanPass }
        : {
            role: roleTab,
            schoolId: cleanSchool,
            displayName: cleanName,
            ...(cleanRoom ? { roomId: cleanRoom } : {}),
            ...(cleanPass ? { passcode: cleanPass } : {}),
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        session?: ClientAuthSession;
        message?: string;
      };

      if (!res.ok || !data.token || !data.session) {
        setErrorMsg(data.message || 'Autentikasi gagal. Periksa kembali kredensial Anda.');
        return;
      }

      labSound.playClick(780);
      setAuth(data.token, data.session);
      setUserRole(roleTab === 'teacher' ? 'pengajar' : 'siswa');
      setSuccessMsg(`Sesi ${roleTab === 'teacher' ? 'Pengajar' : 'Siswa'} aktif atas nama ${data.session.displayName}.`);
      setTimeout(() => {
        onClose();
      }, 650);
    } catch {
      setErrorMsg('Tidak dapat menjangkau server autentikasi (mode offline lokal tetap dapat digunakan).');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    labSound.playClick(460);
    clearAuth();
    setUserRole('siswa');
    setSuccessMsg('Sesi terautentikasi telah ditutup.');
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const hasValidSession = Boolean(token && session && session.exp > nowSec);

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Portal Akun & Sesi RuangLABmu"
      data-testid="user-auth-modal"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shadow-2xl overflow-hidden text-[var(--comfort-text)]">
        <div className="px-5 py-3.5 bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--comfort-accent)]" />
            <div>
              <h3 className="text-sm font-bold leading-tight">Akun &amp; Sesi Kelas</h3>
              <p className="text-2xs text-[var(--comfort-text-muted)]">
                Identitas terverifikasi untuk LKS, Ujian &amp; Buku Nilai
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal akun"
            className="p-2 min-w-[34px] min-h-[34px] rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:bg-[var(--comfort-elevated)] text-[var(--comfort-text-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {hasValidSession && session && (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{session.displayName}</span>
                </div>
                <div className="text-2xs text-[var(--comfort-text-muted)] font-mono mt-0.5 truncate">
                  {session.role === 'teacher' ? 'Pengajar' : 'Siswa'} · {session.schoolId}
                  {session.roomId ? ` · Room ${session.roomId}` : ''}
                </div>
              </div>
              <button
                type="button"
                data-testid="auth-logout-btn"
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 font-semibold text-2xs inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <LogOut className="w-3 h-3" />
                <span>Keluar</span>
              </button>
            </div>
          )}

          {/* Role switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
            <button
              type="button"
              data-testid="auth-tab-student"
              onClick={() => {
                labSound.playClick();
                setRoleTab('student');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                roleTab === 'student'
                  ? 'comfort-tab-active'
                  : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Siswa / Kelompok</span>
            </button>
            <button
              type="button"
              data-testid="auth-tab-teacher"
              onClick={() => {
                labSound.playClick();
                setRoleTab('teacher');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                roleTab === 'teacher'
                  ? 'comfort-tab-active'
                  : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Pengajar / Guru</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="space-y-1 block">
                <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                  Nama Tampilan
                </span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={roleTab === 'teacher' ? 'Nama Guru' : 'Nama Siswa'}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--comfort-accent)]"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-2xs font-semibold text-[var(--comfort-text-muted)] flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  <span>ID Sekolah</span>
                </span>
                <input
                  type="text"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  placeholder="default-school"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--comfort-accent)]"
                />
              </label>
            </div>

            {roleTab === 'student' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="space-y-1 block">
                  <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                    Kode Ruang (Opsional)
                  </span>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    placeholder="cth: LAB-ALPHA"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[var(--comfort-accent)]"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                    PIN Ruang {roomId.trim() ? '(Wajib)' : '(Jika ada)'}
                  </span>
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="6 digit PIN"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--comfort-accent)]"
                  />
                </label>
              </div>
            )}

            {roleTab === 'teacher' && (
              <div className="space-y-2.5">
                {statusLoading ? (
                  <div className="text-2xs text-[var(--comfort-text-muted)] flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memeriksa status kredensial server sekolah...</span>
                  </div>
                ) : isBootstrapTeacher ? (
                  <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5 text-2xs text-amber-800 dark:text-amber-200">
                    Server lokal ini belum memiliki PIN Pengajar untuk sekolah <strong>{schoolId}</strong>. Tetapkan PIN pertama Anda di bawah.
                  </div>
                ) : null}

                <label className="space-y-1 block">
                  <span className="text-2xs font-semibold text-[var(--comfort-text-muted)] flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    <span>{isBootstrapTeacher ? 'Buat PIN Pengajar (Min. 6 karakter)' : 'PIN / Passcode Pengajar'}</span>
                  </span>
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Masukkan PIN pengajar"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--comfort-accent)]"
                  />
                </label>

                {isBootstrapTeacher && (
                  <label className="space-y-1 block">
                    <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                      Konfirmasi PIN Pengajar
                    </span>
                    <input
                      type="password"
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value)}
                      placeholder="Ulangi PIN pengajar"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--comfort-accent)]"
                    />
                  </label>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-rose-700 dark:text-rose-300 text-2xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-emerald-700 dark:text-emerald-300 text-2xs font-semibold">
                {successMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg comfort-btn-secondary text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                data-testid="auth-submit-btn"
                className="px-4 py-2 rounded-lg comfort-tab-active text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isBootstrapTeacher
                    ? 'Aktifkan PIN Pengajar'
                    : roleTab === 'teacher'
                    ? 'Masuk sebagai Guru'
                    : 'Aktifkan Sesi Siswa'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
