import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  DatabaseBackup,
  Download,
  RefreshCw,
  Lock,
  LogOut,
  FileClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { apiFetch } from '../../utils/apiClient';

interface AuditLogItem {
  id: number;
  school_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata_json: string;
  ip_address: string | null;
  created_at: number;
}

interface BackupFileEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  reason: string;
}

interface BackupStatusSummary {
  enabled: boolean;
  intervalMs: number;
  retentionCount: number;
  lastBackupAt: string | null;
  lastBackupFile: string | null;
  totalBackups: number;
}

export interface GradebookSecurityBackupPanelProps {
  onOpenAuthModal: (reason?: string) => void;
  onNotify: (msg: string) => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const GradebookSecurityBackupPanel: React.FC<GradebookSecurityBackupPanelProps> = ({
  onOpenAuthModal,
  onNotify,
}) => {
  const session = useAuthStore((s) => s.session);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isAuthed = Boolean(
    session && (session.role === 'teacher' || session.role === 'admin')
  );

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsOffset, setLogsOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [backupStatus, setBackupStatus] = useState<BackupStatusSummary | null>(null);
  const [backups, setBackups] = useState<BackupFileEntry[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  const LOG_PAGE_SIZE = 15;

  const loadAuditLogs = useCallback(async () => {
    if (!isAuthed) return;
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({
        limit: String(LOG_PAGE_SIZE),
        offset: String(logsOffset),
      });
      if (actionFilter) params.set('action', actionFilter);
      const res = await apiFetch(`/api/audit-logs?${params.toString()}`, {
        promptTeacherAuthOn401: true,
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setLogsTotal(Number(data.pagination?.total || 0));
      }
    } finally {
      setLoadingLogs(false);
    }
  }, [isAuthed, logsOffset, actionFilter]);

  const loadBackups = useCallback(async () => {
    if (!isAuthed) return;
    setLoadingBackups(true);
    try {
      const res = await apiFetch('/api/admin/backups', {
        promptTeacherAuthOn401: true,
      });
      if (res.ok) {
        const data = await res.json();
        setBackupStatus(data.status || null);
        setBackups(Array.isArray(data.backups) ? data.backups : []);
      }
    } finally {
      setLoadingBackups(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    if (isAuthed) {
      void loadAuditLogs();
      void loadBackups();
    }
  }, [isAuthed, loadAuditLogs, loadBackups]);

  const handleTriggerBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await apiFetch('/api/admin/backups', {
        method: 'POST',
        promptTeacherAuthOn401: true,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onNotify(`Backup SQLite berhasil dibuat: ${data.backup?.filename || 'tersimpan'}`);
        await Promise.all([loadBackups(), loadAuditLogs()]);
      } else {
        onNotify(data?.message || 'Gagal membuat backup database.');
      }
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    const res = await apiFetch(`/api/admin/backups/${encodeURIComponent(filename)}`, {
      promptTeacherAuthOn401: true,
    });
    if (!res.ok) {
      onNotify('Gagal mengunduh berkas backup.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onNotify(`Berkas backup ${filename} berhasil diunduh.`);
    void loadAuditLogs();
  };

  if (!isAuthed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--comfort-accent-soft)] border border-[var(--comfort-accent-border)] flex items-center justify-center text-[var(--comfort-accent)]">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="text-base font-bold text-[var(--comfort-text)]">
            Panel Keamanan, Audit Log &amp; Backup Database
          </h3>
          <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed">
            Verifikasi sesi pengajar terlebih dahulu untuk melihat riwayat audit penilaian, memicu hot backup SQLite, atau mengunduh salinan cadangan data praktikum sekolah.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onOpenAuthModal('Masuk sebagai Pengajar untuk mengakses Audit Log dan Backup Database.')
          }
          className="px-4 py-2 rounded-xl comfort-btn-primary text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <span>Verifikasi Sesi Pengajar</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
      {/* Authenticated Session Header */}
      <div className="p-4 rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--comfort-success-soft)] border border-[var(--comfort-success-border)] flex items-center justify-center text-[var(--comfort-success)]">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--comfort-text)]">
              Sesi Pengajar Aktif: {session?.displayName}
            </div>
            <div className="text-2xs font-mono text-[var(--comfort-text-muted)]">
              Tenant Sekolah: {session?.schoolId} · Peran: {session?.role}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            clearAuth();
            onNotify('Sesi pengajar dikunci kembali.');
          }}
          className="px-3 py-1.5 rounded-xl comfort-btn-secondary text-xs font-semibold hover:text-[var(--comfort-danger)] flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Kunci Sesi</span>
        </button>
      </div>

      {/* Hot SQLite Backup Section */}
      <div className="rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DatabaseBackup className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />
            <div>
              <h4 className="text-xs font-bold text-[var(--comfort-text)]">
                Backup Otomatis SQLite (Hot VACUUM INTO)
              </h4>
              <p className="text-2xs text-[var(--comfort-text-muted)] tabular-nums">
                Retensi {backupStatus?.retentionCount ?? 7} berkas terbaru · Total tersimpan:{' '}
                {backupStatus?.totalBackups ?? backups.length}
                {backupStatus?.lastBackupAt
                  ? ` · Terakhir: ${new Date(backupStatus.lastBackupAt).toLocaleString('id-ID')}`
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadBackups()}
              disabled={loadingBackups}
              className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              aria-label="Segarkan daftar backup"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleTriggerBackup}
              disabled={creatingBackup || backupStatus?.enabled === false}
              className="min-h-[34px] px-3 py-1.5 rounded-xl comfort-btn-primary disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {creatingBackup ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <DatabaseBackup className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{creatingBackup ? 'Membuat Backup...' : 'Buat Backup Sekarang'}</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-[var(--comfort-border)]">
          {backups.length === 0 ? (
            <div className="p-4 text-xs text-[var(--comfort-text-muted)]">
              Belum ada berkas backup tersimpan. Klik &ldquo;Buat Backup Sekarang&rdquo; untuk membuat cadangan konsisten tanpa menghentikan praktikum.
            </div>
          ) : (
            backups.map((b) => (
              <div
                key={b.filename}
                className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-mono font-semibold text-[var(--comfort-text)]">
                    {b.filename}
                  </div>
                  <div className="text-2xs text-[var(--comfort-text-muted)] tabular-nums">
                    {formatBytes(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString('id-ID')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadBackup(b.filename)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg comfort-btn-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
                  <span>Unduh</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Audit Log Trail */}
      <div className="rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileClock className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />
            <h4 className="text-xs font-bold text-[var(--comfort-text)]">
              Jejak Audit Aktivitas Pengajar ({logsTotal} entri)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setLogsOffset(0);
              }}
              aria-label="Filter aksi audit"
              className="px-2.5 py-1 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs text-[var(--comfort-text)]"
            >
              <option value="">Semua Aksi</option>
              <option value="SUBMISSION_GRADED">Penilaian Laporan</option>
              <option value="SUBMISSION_BATCH_GRADED">Penilaian Massal</option>
              <option value="MISSION_PUBLISHED">Publikasi Misi AI</option>
              <option value="ROOM_CREATED">Pembuatan Room</option>
              <option value="TEACHER_FREEZE_TOGGLE">Kunci / Buka Layar</option>
              <option value="BACKUP_CREATED">Backup Dibuat</option>
              <option value="AUTH_LOGIN_SUCCESS">Login Berhasil</option>
              <option value="AUTH_LOGIN_FAILED">Login Gagal</option>
            </select>
            <button
              type="button"
              onClick={() => void loadAuditLogs()}
              disabled={loadingLogs}
              className="p-1.5 rounded-lg border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              aria-label="Segarkan audit log"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--comfort-surface-subtle)] text-2xs text-[var(--comfort-text-muted)] border-b border-[var(--comfort-border)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Waktu</th>
                <th className="px-3 py-2 font-semibold">Aktor</th>
                <th className="px-3 py-2 font-semibold">Aksi</th>
                <th className="px-3 py-2 font-semibold">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--comfort-border)]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-center text-[var(--comfort-text-muted)]">
                    Belum ada catatan audit pada filter ini.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 font-mono text-2xs text-[var(--comfort-text-muted)] whitespace-nowrap tabular-nums">
                      {new Date(entry.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-2 font-semibold text-[var(--comfort-text)]">
                      {entry.actor_name}
                    </td>
                    <td className="px-3 py-2 font-mono text-2xs text-[var(--comfort-accent)]">
                      {entry.action}
                    </td>
                    <td className="px-3 py-2 font-mono text-2xs text-[var(--comfort-text-muted)]">
                      {entry.target_type ? `${entry.target_type}: ` : ''}
                      {entry.target_id || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {logsTotal > LOG_PAGE_SIZE && (
          <div className="px-4 py-2.5 bg-[var(--comfort-surface-subtle)] border-t border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[var(--comfort-text-muted)] font-mono tabular-nums">
              Menampilkan {logsOffset + 1}–{Math.min(logsOffset + logs.length, logsTotal)} dari{' '}
              {logsTotal}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={logsOffset === 0}
                onClick={() => setLogsOffset((prev) => Math.max(0, prev - LOG_PAGE_SIZE))}
                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[var(--comfort-border)] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                disabled={logsOffset + LOG_PAGE_SIZE >= logsTotal}
                onClick={() => setLogsOffset((prev) => prev + LOG_PAGE_SIZE)}
                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[var(--comfort-border)] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradebookSecurityBackupPanel;
