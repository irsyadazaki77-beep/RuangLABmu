import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Lock, KeyRound, X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore, type ClientAuthSession } from '../../stores/useAuthStore';
import { DEFAULT_SCHOOL_ID } from '../../utils/offlineOutbox';

export interface TeacherAuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: (session: ClientAuthSession) => void;
  reason?: string | null;
  defaultTeacherName?: string;
  schoolId?: string;
}

interface AuthStatusResponse {
  mode: 'env' | 'claimed' | 'needs_bootstrap';
  requiresBootstrap: boolean;
  schoolId: string;
}

export const TeacherAuthGateModal: React.FC<TeacherAuthGateModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  reason,
  defaultTeacherName = 'Dr. Hendra Kusuma',
  schoolId = DEFAULT_SCHOOL_ID,
}) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [statusLoading, setStatusLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'env' | 'claimed' | 'needs_bootstrap'>('claimed');
  const [teacherName, setTeacherName] = useState(defaultTeacherName);
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setErrorMsg(null);
    setPasscode('');
    setConfirmPasscode('');
    setStatusLoading(true);

    fetch(`/api/auth/status?schoolId=${encodeURIComponent(schoolId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AuthStatusResponse | null) => {
        if (!cancelled && data && data.mode) {
          setAuthMode(data.mode);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthMode('claimed');
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
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

  if (!isOpen) return null;

  const isBootstrap = authMode === 'needs_bootstrap';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedPasscode = passcode.trim();
    if (!trimmedPasscode) {
      setErrorMsg('Silakan masukkan PIN/Passcode pengajar.');
      return;
    }

    if (isBootstrap) {
      if (trimmedPasscode.length < 6) {
        setErrorMsg('PIN/Passcode pengajar minimal 6 karakter.');
        return;
      }
      if (trimmedPasscode !== confirmPasscode.trim()) {
        setErrorMsg('Konfirmasi PIN tidak cocok.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = isBootstrap ? '/api/auth/bootstrap-teacher' : '/api/auth/session';
      const bodyPayload = isBootstrap
        ? {
            schoolId,
            teacherName: teacherName.trim() || defaultTeacherName,
            passcode: trimmedPasscode,
          }
        : {
            role: 'teacher',
            schoolId,
            displayName: teacherName.trim() || defaultTeacherName,
            passcode: trimmedPasscode,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'TEACHER_BOOTSTRAP_REQUIRED') {
          setAuthMode('needs_bootstrap');
        }
        setErrorMsg(data?.message || data?.error || 'Verifikasi pengajar gagal.');
        return;
      }

      if (data?.token && data?.session) {
        setAuth(String(data.token), data.session as ClientAuthSession);
        onAuthenticated?.(data.session as ClientAuthSession);
        onClose();
      } else {
        setErrorMsg('Respons sesi dari server tidak lengkap.');
      }
    } catch {
      setErrorMsg('Gagal menghubungi server lokal untuk verifikasi pengajar.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Autentikasi Pengajar RuangLABmu"
      data-testid="teacher-auth-gate-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600/15 border border-sky-500/35 flex items-center justify-center text-sky-600 dark:text-sky-400">
              {isBootstrap ? <KeyRound className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--comfort-text)]">
                {isBootstrap ? 'Atur PIN Pengajar Pertama Kali' : 'Verifikasi Akses Pengajar'}
              </h3>
              <p className="text-2xs text-[var(--comfort-text-muted)]">
                Token sesi aman lokal (offline-ready, tidak disimpan di disk browser)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog autentikasi"
            className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {reason && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs text-[var(--comfort-text)]">
              {reason}
            </div>
          )}

          {statusLoading ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-[var(--comfort-text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memeriksa status keamanan server...</span>
            </div>
          ) : (
            <>
              {isBootstrap && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  Server lokal belum memiliki PIN pengajar. Buat PIN pengajar baru (minimal 6 karakter) untuk mengunci akses penilaian, misi kustom, audit log, dan backup database.
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="teacher-auth-name"
                  className="block text-xs font-semibold text-[var(--comfort-text)]"
                >
                  Nama Pengajar
                </label>
                <input
                  id="teacher-auth-name"
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs text-[var(--comfort-text)] focus:outline-none focus:border-sky-500"
                  placeholder="Dr. Hendra Kusuma"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="teacher-auth-passcode"
                  className="block text-xs font-semibold text-[var(--comfort-text)]"
                >
                  {isBootstrap ? 'Buat PIN / Passcode Pengajar (min. 6 karakter)' : 'PIN / Passcode Pengajar'}
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="teacher-auth-passcode"
                    data-testid="teacher-auth-passcode-input"
                    type="password"
                    autoComplete={isBootstrap ? 'new-password' : 'current-password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs text-[var(--comfort-text)] focus:outline-none focus:border-sky-500"
                    placeholder="Masukkan PIN pengajar..."
                    autoFocus
                  />
                </div>
              </div>

              {isBootstrap && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="teacher-auth-confirm"
                    className="block text-xs font-semibold text-[var(--comfort-text)]"
                  >
                    Konfirmasi PIN / Passcode
                  </label>
                  <input
                    id="teacher-auth-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs text-[var(--comfort-text)] focus:outline-none focus:border-sky-500"
                    placeholder="Ulangi PIN pengajar..."
                  />
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-500/12 border border-rose-500/35 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[var(--comfort-border)] text-xs font-semibold text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="teacher-auth-submit-btn"
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isBootstrap ? 'Simpan PIN & Masuk' : 'Verifikasi Sesi'}</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
};

export default TeacherAuthGateModal;
