import React, { Component, createRef, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react';

export interface WebGLErrorBoundaryProps {
  children: ReactNode;
  domain?: string;
  sceneName?: string;
  sceneTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
  onRecover?: () => void;
}

export interface WebGLErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isContextLost: boolean;
  retryKey: number;
  sceneKey?: number;
}

/**
 * WebGL Context-Loss & Runtime ErrorBoundary (`src/components/three/WebGLErrorBoundary.tsx`)
 * Listens for `webglcontextlost` (`event.preventDefault()`) and `webglcontextrestored`
 * on child `<canvas>` elements, and provides a clean recovery overlay with a manual
 * "Pulihkan Canvas 3D" / "Pulihkan Scene 3D" retry trigger.
 */
export class WebGLErrorBoundary extends Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  private containerRef = createRef<HTMLDivElement>();

  public state: WebGLErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
    isContextLost: false,
    retryKey: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<WebGLErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Kegagalan inisialisasi konteks WebGL 3D.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[RuangLABmu WebGLErrorBoundary — ${this.props.sceneTitle || '3D Lab'}]:`,
      error,
      errorInfo
    );
  }

  public componentDidMount(): void {
    const container = this.containerRef.current;
    if (!container) return;
    container.addEventListener('webglcontextlost', this.handleContextLost, true);
    container.addEventListener('webglcontextrestored', this.handleContextRestored, true);
  }

  public componentWillUnmount(): void {
    const container = this.containerRef.current;
    if (!container) return;
    container.removeEventListener('webglcontextlost', this.handleContextLost, true);
    container.removeEventListener('webglcontextrestored', this.handleContextRestored, true);
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.setState({
      isContextLost: true,
      errorMessage:
        'Konteks GPU WebGL terputus sementara (penghemat memori perangkat / perpindahan tab).',
    });
  };

  private handleContextRestored = (): void => {
    this.setState((prev) => ({
      isContextLost: false,
      hasError: false,
      errorMessage: '',
      retryKey: prev.retryKey + 1,
    }));
  };

  private handleManualRecover = (): void => {
    this.setState(
      (prev) => ({
        hasError: false,
        isContextLost: false,
        errorMessage: '',
        retryKey: prev.retryKey + 1,
      }),
      () => {
        if (this.props.onRetry) {
          this.props.onRetry();
        }
      }
    );
  };

  public render(): ReactNode {
    const showRecoveryOverlay = this.state.hasError || this.state.isContextLost;

    return (
      <div
        ref={this.containerRef}
        className="relative w-full h-full min-h-[280px]"
      >
        {!this.state.hasError && (
          <React.Fragment key={this.state.retryKey}>
            {this.props.children}
          </React.Fragment>
        )}

        {showRecoveryOverlay && (
          <div
            data-testid="lab-webgl-error-fallback"
            className="absolute inset-0 z-30 w-full h-full min-h-[280px] rounded-2xl bg-slate-950/90 backdrop-blur-md border border-amber-500/30 flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mb-3 shadow-inner">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono uppercase tracking-wider text-amber-300 mb-2">
              <Sparkles className="w-3 h-3" /> Proteksi Memori GPU 3T
            </div>
            <h3 className="text-sm font-bold text-slate-100 mb-1">
              {this.props.sceneTitle || 'Visualisasi 3D'} Sedang Dipulihkan
            </h3>
            <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
              Perangkat mengalami keterbatasan memori grafis WebGL, namun mesin simulasi numerik
              RK4 dan lembar kerja pengamatan Anda tetap aman.
            </p>
            {this.state.errorMessage && (
              <code className="text-[10px] font-mono text-amber-300/90 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 mb-4 max-w-sm truncate">
                {this.state.errorMessage}
              </code>
            )}
            <button
              type="button"
              onClick={this.handleManualRecover}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Pulihkan Canvas 3D
            </button>
          </div>
        )}
      </div>
    );
  }
}

export default WebGLErrorBoundary;
