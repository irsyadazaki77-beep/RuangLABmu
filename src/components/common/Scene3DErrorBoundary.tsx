import React from 'react';
import {
  WebGLErrorBoundary,
  type WebGLErrorBoundaryProps,
  type WebGLErrorBoundaryState,
} from '../three/WebGLErrorBoundary';

export type Props = WebGLErrorBoundaryProps;
export type Scene3DErrorBoundaryProps = WebGLErrorBoundaryProps;
export type Scene3DErrorBoundaryState = WebGLErrorBoundaryState;

export class Scene3DErrorBoundary extends React.Component<WebGLErrorBoundaryProps> {
  public render() {
    return <WebGLErrorBoundary {...this.props} />;
  }
}

export default Scene3DErrorBoundary;
