/**
 * Captures the active 3D WebGL canvas as a JPEG data URL for Dr. LabMu Vision 3D diagnostics.
 * Falls back to a labeled synthetic canvas when WebGL readback is unavailable.
 */
export function capture3DCanvasSnapshot(readableTopic: string): string {
  const webglCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  if (webglCanvas) {
    try {
      const dataUrl = webglCanvas.toDataURL('image/jpeg', 0.85);
      if (dataUrl) return dataUrl;
    } catch {
      // Fallback below
    }
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 480;
  tempCanvas.height = 270;
  const ctx = tempCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 480, 270);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`RuangLABmu 3D Snapshot — ${readableTopic}`, 24, 130);
    return tempCanvas.toDataURL('image/jpeg', 0.85);
  }
  return '';
}
