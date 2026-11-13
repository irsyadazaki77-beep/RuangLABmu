import { Component, ErrorInfo, ReactNode, createRef } from 'react';
import { AlertTriangle, RefreshCw, MonitorCog } from 'lucide-react';

export interface LabErrorBoundaryProps {
  children: ReactNode;
  domain?: string;
  sceneName?: string;
  onRetry?: () => void;
}

export interface LabErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  retryCount: number;
  sceneKey: number;
}

/**
 * Error Boundary khusus kanvas 3D WebGL (PhysicsScene3D, ChemistryScene3D, BiologyScene3D, AstronomyScene3D).
 * Menangkap runtime crash React/Three.js maupun event `webglcontextlost` dan `webglcontextrestored` dari GPU
 * agar aplikasi tidak pernah mengalami white-screen crash dan dapat memulihkan kanvas 3D secara otomatis.
 */
export class LabErrorBoundary extends Component<LabErrorBoundaryProps, LabErrorBoundaryState> {
  private containerRef = createRef<HTMLDivElement>();

  public state: LabErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
    retryCount: 0,
    sceneKey: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<LabErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi gangguan inisialisasi shader atau konteks WebGL.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[LabErrorBoundary] Gagal merender scene 3D (${this.props.domain || 'Laboratorium'}):`,
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
      errorMessage: 'WebGL Context Lost: Driver GPU mereset sesi akselerasi perangkat keras.',
    });
  };

  private handleWebGLContextRestored = (): void => {
    this.resetErrorBoundary();
  };

  public resetErrorBoundary = (): void => {
    this.setState((prev) => ({
      hasError: false,
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
                  Akselerasi Grafis 3D Mengalami Kendala
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Kanvas simulasi 3D mengalami kehilangan konteks GPU (WebGL Context Loss) atau kendala kompilasi shader. Data tabel pengamatan dan LKS Anda tetap tersimpan dengan aman.
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
                <span>Panduan Mengaktifkan Hardware Acceleration di Browser:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
                <li>
                  <b>Chrome / Edge:</b> Buka <code className="text-sky-300">Settings → System</code>, aktifkan <i>&ldquo;Use graphics acceleration when available&rdquo;</i>, lalu klik <b>Relaunch</b>.
                </li>
                <li>
                  <b>Firefox:</b> Buka <code className="text-sky-300">Settings → General → Performance</code>, centang <i>&ldquo;Use recommended performance settings&rdquo;</i>.
                </li>
                <li>
                  Tutup tab aplikasi 3D berat lainnya jika memori GPU (VRAM) perangkat sedang penuh.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="reload-3d-scene-btn"
                onClick={this.handleReloadScene}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-sky-600/25 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Muat Ulang Scene</span>
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
export default LabErrorBoundary;
