import React, { Component, createRef, ErrorInfo, ReactNode } from 'react';
import { Activity, AlertTriangle, RotateCcw, Sparkles } from 'lucide-react';
import { Simulation2DFallbackView } from './Simulation2DFallbackView';
import { DOMAIN_TO_EN, useLabStore, type AnyLabDomain } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';

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
  contextLossCount: number;
  use2DFallback: boolean;
  retryKey: number;
  preservedParamSummary: string;
  sceneKey?: number;
}

function captureActiveParamSummary(): string {
  try {
    const snap = useLabStore.getState().liveParamSnapshot;
    const entries = Object.entries(snap).slice(0, 4);
    if (entries.length === 0) return '';
    return entries
      .map(([k, v]) => `${k}=${v.value}${v.unit ? v.unit : ''}`)
      .join(' · ');
  } catch {
    return '';
  }
}

/**
 * WebGL Context-Loss & Runtime ErrorBoundary (`src/components/three/WebGLErrorBoundary.tsx`)
 * Listens for `webglcontextlost` (`event.preventDefault()`) and `webglcontextrestored`
 * on child `<canvas>` elements, preserves active simulation parameter snapshots,
 * provides a calm recovery overlay, and offers an instant Mode Ringan 2D fallback.
 */
export class WebGLErrorBoundary extends Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  private containerRef = createRef<HTMLDivElement>();
  private unsubPrefer2D: (() => void) | null = null;

  public state: WebGLErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
    isContextLost: false,
    contextLossCount: 0,
    use2DFallback: useUIStore.getState().prefer2DFallback,
    retryKey: 0,
    preservedParamSummary: '',
  };

  public static getDerivedStateFromError(error: Error): Partial<WebGLErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Kegagalan inisialisasi konteks WebGL 3D.',
      preservedParamSummary: captureActiveParamSummary(),
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
    if (container) {
      container.addEventListener('webglcontextlost', this.handleContextLost, true);
      container.addEventListener('webglcontextrestored', this.handleContextRestored, true);
    }
    this.unsubPrefer2D = useUIStore.subscribe((state, prev) => {
      if (state.prefer2DFallback !== prev.prefer2DFallback) {
        this.setState({ use2DFallback: state.prefer2DFallback });
      }
    });
  }

  public componentWillUnmount(): void {
    const container = this.containerRef.current;
    if (container) {
      container.removeEventListener('webglcontextlost', this.handleContextLost, true);
      container.removeEventListener('webglcontextrestored', this.handleContextRestored, true);
    }
    this.unsubPrefer2D?.();
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    const summary = captureActiveParamSummary();
    this.setState((prev) => {
      const nextCount = prev.contextLossCount + 1;
      const autoFallback2D = nextCount >= 2;
      return {
        isContextLost: true,
        contextLossCount: nextCount,
        use2DFallback: prev.use2DFallback || autoFallback2D,
        preservedParamSummary: summary || prev.preservedParamSummary,
        errorMessage:
          'Konteks GPU WebGL dijeda sementara (hemat memori / perpindahan tab). Data simulasi Anda tetap tersimpan.',
      };
    });
  };

  private handleContextRestored = (): void => {
    this.setState(
      (prev) => ({
        isContextLost: false,
        hasError: false,
        errorMessage: '',
        retryKey: prev.retryKey + 1,
      }),
      () => {
        this.props.onRecover?.();
      }
    );
  };

  private handleManualRecover = (): void => {
    useUIStore.getState().setPrefer2DFallback(false);
    this.setState(
      (prev) => ({
        hasError: false,
        isContextLost: false,
        use2DFallback: false,
        errorMessage: '',
        retryKey: prev.retryKey + 1,
      }),
      () => {
        if (this.props.onRetry) {
          this.props.onRetry();
        }
        if (this.props.onRecover) {
          this.props.onRecover();
        }
      }
    );
  };

  private handleSwitchTo2DFallback = (): void => {
    useUIStore.getState().setPrefer2DFallback(true);
    this.setState((prev) => ({
      use2DFallback: true,
      preservedParamSummary: prev.preservedParamSummary || captureActiveParamSummary(),
    }));
  };

  public render(): ReactNode {
    const normalizedDomain =
      this.props.domain && this.props.domain.toLowerCase() in DOMAIN_TO_EN
        ? DOMAIN_TO_EN[this.props.domain.toLowerCase() as AnyLabDomain]
        : undefined;

    if (this.state.use2DFallback) {
      return (
        <div
          ref={this.containerRef}
          className="relative w-full h-full min-h-[280px]"
        >
          <Simulation2DFallbackView
            sceneTitle={this.props.sceneTitle || this.props.sceneName}
            domain={normalizedDomain}
            contextLostReason={
              this.state.hasError || this.state.isContextLost
                ? this.state.errorMessage
                : undefined
            }
            onRestore3D={this.handleManualRecover}
          />
        </div>
      );
    }

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
            className="absolute inset-0 z-30 w-full h-full min-h-[280px] rounded-2xl bg-slate-950/95 border border-amber-500/30 flex flex-col items-center justify-center p-6 text-center select-none"
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
            <p className="text-xs text-slate-400 max-w-md mb-3 leading-relaxed">
              Perangkat mengalami keterbatasan memori grafis WebGL, namun mesin simulasi numerik
              dan lembar kerja pengamatan Anda tetap aman.
            </p>
            {this.state.preservedParamSummary && (
              <p className="text-[11px] font-mono text-sky-300 bg-sky-500/10 px-3 py-1 rounded-lg border border-sky-500/25 mb-3 max-w-md truncate">
                Snapshot Aktif: {this.state.preservedParamSummary}
              </p>
            )}
            {this.state.errorMessage && (
              <code className="text-[10px] font-mono text-amber-300/90 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 mb-4 max-w-sm truncate">
                {this.state.errorMessage}
              </code>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleManualRecover}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Pulihkan Canvas 3D
              </button>
              <button
                type="button"
                data-testid="switch-to-2d-fallback-btn"
                onClick={this.handleSwitchTo2DFallback}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Activity className="w-3.5 h-3.5" />
                Gunakan Mode Ringan 2D
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default WebGLErrorBoundary;

