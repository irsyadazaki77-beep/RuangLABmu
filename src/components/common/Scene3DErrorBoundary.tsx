import { Component, ErrorInfo, ReactNode, createRef } from 'react';
import { AlertTriangle, RefreshCw, MonitorCog, Sparkles } from 'lucide-react';

export interface Scene3DErrorBoundaryProps {
  children: ReactNode;
  domain?: string;
  sceneName?: string;
  onRetry?: () => void;
}

export interface Scene3DErrorBoundaryState {
  hasError: boolean;
  isContextLost: boolean;
  errorMessage: string;
  retryCount: number;
  sceneKey: number;
}

/**
 * Scene3DErrorBoundary — Error Boundary & WebGL Context-Loss Recovery untuk seluruh Scene 3D.
 * Menangkap error runtime React/Three.js serta event `webglcontextlost` & `webglcontextrestored`
 * dengan UI fallback ramah siswa dan tombol "Pulihkan Scene 3D" tanpa reload halaman.
 */
export class Scene3DErrorBoundary extends Component<
  Scene3DErrorBoundaryProps,
  Scene3DErrorBoundaryState
> {
  private containerRef = createRef<HTMLDivElement>();

  public state: Scene3DErrorBoundaryState = {
    hasError: false,
    isContextLost: false,
    errorMessage: '',
    retryCount: 0,
    sceneKey: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<Scene3DErrorBoundaryState> {
    return {
      hasError: true,
      isContextLost: false,
      errorMessage:
        error?.message || 'Terjadi gangguan inisialisasi shader atau konteks WebGL.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[Scene3DErrorBoundary] Gagal merender scene 3D (${this.props.domain || 'Laboratorium'}):`,
      error,
      errorInfo
    );
  }

  public componentDidMount(): void {
    const el = this.containerRef.current;
    if (el) {
      el.addEventListener('webglcontextlost', this.handleWebGLContextLost, true);
      el.addEventListener('webglcontextrestored', this.handleWebGLContextRestored, true);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('webglcontextrestored', this.handleWebGLContextRestored, true);
    }
  }

  public componentWillUnmount(): void {
    const el = this.containerRef.current;
    if (el) {
      el.removeEventListener('webglcontextlost', this.handleWebGLContextLost, true);
      el.removeEventListener('webglcontextrestored', this.handleWebGLContextRestored, true);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('webglcontextrestored', this.handleWebGLContextRestored, true);
    }
  }

  private handleWebGLContextLost = (event: Event): void => {
    event.preventDefault();
    this.setState({
      hasError: true,
      isContextLost: true,
      errorMessage:
        'WebGL Context Lost: Driver GPU mereset sesi akselerasi perangkat keras. Klik Pulihkan Scene 3D untuk menginisialisasi ulang tanpa memuat ulang halaman.',
    });
  };

  private handleWebGLContextRestored = (): void => {
    this.resetErrorBoundary();
  };

  public resetErrorBoundary = (): void => {
    this.setState((prev) => ({
      hasError: false,
      isContextLost: false,
      errorMessage: '',
      retryCount: prev.retryCount + 1,
      sceneKey: prev.sceneKey + 1,
    }));
    this.props.onRetry?.();
  };

  private handleReloadScene = (): void => {
    this.resetErrorBoundary();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          ref={this.containerRef}
          data-testid="lab-webgl-error-fallback"
          role="alert"
          className="w-full h-full min-h-[360px] flex items-center justify-center p-6 bg-slate-950 text-slate-100 select-none"
        >
          <div className="max-w-lg w-full rounded-2xl bg-slate-900/95 border border-amber-500/40 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider">
                  Proteksi Kanvas WebGL {this.props.domain ? `• ${this.props.domain}` : ''}
                </span>
                <h3 className="text-base font-extrabold text-white">
                  {this.state.isContextLost
                    ? 'Sesi Grafis 3D Sedang Dipulihkan'
                    : 'Akselerasi Grafis 3D Mengalami Kendala'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Kanvas simulasi 3D mengalami kehilangan konteks GPU (WebGL Context Loss) atau kendala kompilasi shader. Jangan khawatir—seluruh data tabel pengamatan, hipotesis, dan LKS kamu tetap tersimpan dengan aman.
                </p>
              </div>
            </div>

            {this.state.errorMessage && (
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 px-3 py-2 text-[11px] font-mono text-amber-300/90 truncate">
                Diagnostik: {this.state.errorMessage}
              </div>
            )}

            <div className="rounded-xl bg-slate-800/60 border border-slate-700/70 p-3.5 space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-bold text-sky-300">
                <MonitorCog className="w-4 h-4 shrink-0" />
                <span>Tips Pemulihan Cepat untuk Siswa:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
                <li>
                  Klik tombol <b>Pulihkan Scene 3D</b> di bawah untuk menyalakan ulang laboratorium 3D secara instan tanpa kehilangan data praktikum.
                </li>
                <li>
                  <b>Chrome / Edge:</b> Pastikan <code className="text-sky-300">Settings → System → Use graphics acceleration</code> dalam keadaan aktif.
                </li>
                <li>
                  Tutup tab aplikasi 3D berat lainnya jika memori GPU (VRAM) perangkat sedang penuh.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tanpa Reload Halaman • Data Aman</span>
              </span>
              <button
                type="button"
                data-testid="reload-3d-scene-btn"
                onClick={this.handleReloadScene}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-sky-600/25 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Pulihkan Scene 3D</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={this.containerRef}
        key={this.state.sceneKey}
        className="w-full h-full relative"
      >
        {this.props.children}
      </div>
    );
  }
}

export default Scene3DErrorBoundary;
