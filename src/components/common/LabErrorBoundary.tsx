import {
  Scene3DErrorBoundary,
  type Scene3DErrorBoundaryProps,
  type Scene3DErrorBoundaryState,
} from './Scene3DErrorBoundary';

/**
 * LabErrorBoundary wraps Scene3DErrorBoundary to provide WebGL context-loss
 * (`webglcontextlost` / `webglcontextrestored`) auto-recovery and `sceneKey`
 * remounting without full page reload.
 */
export const WEBGL_CONTEXT_RESTORED_EVENT = 'webglcontextrestored' as const;
export type LabErrorBoundarySceneKey = Scene3DErrorBoundaryState['sceneKey'];

export type LabErrorBoundaryProps = Scene3DErrorBoundaryProps;
export type LabErrorBoundaryState = Scene3DErrorBoundaryState;
export { Scene3DErrorBoundary, Scene3DErrorBoundary as LabErrorBoundary };
export default Scene3DErrorBoundary;
