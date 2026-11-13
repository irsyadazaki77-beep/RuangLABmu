import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface Interactive3DObjectOptions {
  id?: string;
  interactive?: boolean;
  type?: 'draggable' | 'clickable';
  paramKey?: string;
  draggableParam?: string;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  hoverColor?: number;
  cursor?: string;
  currentValue?: number;
  onClick?: (obj: THREE.Object3D, hitPoint: THREE.Vector3) => void;
  onDrag?: (deltaX: number, deltaY: number, hitPoint: THREE.Vector3) => void;
  metadata?: Record<string, unknown>;
}

export interface ThreeInteractionManagerOptions {
  camera: THREE.Camera;
  domElement: HTMLElement;
  controls?: OrbitControls | null;
  sceneForCursor?: THREE.Scene | null;
  defaultHoverColor?: number;
  dragSpanPx?: number;
  getInteractiveObjects: () => THREE.Object3D[];
  getParamValue?: (paramKey: string) => number | undefined;
  onHoverChange?: (object: THREE.Object3D | null, hitPoint: THREE.Vector3 | null) => void;
  onDragStart?: (object: THREE.Object3D, paramKey?: string) => void;
  onDragUpdate?: (object: THREE.Object3D, paramKey: string, newValue: number, label?: string) => void;
  onDragEnd?: (object: THREE.Object3D, paramKey?: string) => void;
  onClick?: (object: THREE.Object3D, hitPoint: THREE.Vector3) => void;
  onCursorMove3D?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
}

/**
 * Pure helper to compute snapped, clamped parameter values from pointer drag deltas.
 */
export function computeDraggedParameterValue(
  startValue: number,
  deltaX: number,
  deltaY: number,
  min: number,
  max: number,
  step = 1,
  dragSpanPx = 280
): number {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 100;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const sensitivity = (safeMax - safeMin) / Math.max(40, dragSpanPx);
  // Upward vertical drag (-deltaY) or rightward horizontal drag (+deltaX) increases value
  const dominantDelta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
  const raw = startValue + dominantDelta * sensitivity;
  const clamped = Math.max(safeMin, Math.min(safeMax, raw));
  const stepped = Math.round(clamped / safeStep) * safeStep;
  const finalClamped = Math.max(safeMin, Math.min(safeMax, stepped));
  return Number(finalClamped.toFixed(safeStep >= 1 ? 0 : 3));
}

function isObjectInteractive(obj: THREE.Object3D): boolean {
  const ud = obj.userData as Interactive3DObjectOptions | undefined;
  if (!ud) return false;
  return Boolean(ud.interactive || ud.draggableParam || ud.paramKey || ud.type === 'clickable');
}

function resolveInteractiveOptions(obj: THREE.Object3D): {
  kind: 'draggable' | 'clickable';
  paramKey?: string;
  min: number;
  max: number;
  step: number;
  label?: string;
  hoverColor?: number;
  cursor?: string;
  currentValue?: number;
  onClick?: (obj: THREE.Object3D, hitPoint: THREE.Vector3) => void;
  onDrag?: (deltaX: number, deltaY: number, hitPoint: THREE.Vector3) => void;
} {
  const ud = (obj.userData || {}) as Interactive3DObjectOptions;
  const paramKey = ud.paramKey || ud.draggableParam;
  const kind = ud.type ?? (paramKey || ud.onDrag ? 'draggable' : 'clickable');
  return {
    kind,
    paramKey,
    min: ud.min ?? 0,
    max: ud.max ?? 100,
    step: ud.step ?? 1,
    label: ud.label,
    hoverColor: ud.hoverColor,
    cursor: ud.cursor,
    currentValue: ud.currentValue,
    onClick: ud.onClick,
    onDrag: ud.onDrag,
  };
}

/**
 * ThreeInteractionHelper
 * Centralized utility for Three.js Raycasting, Hover Emissive Glow, and Direct Drag Manipulation.
 * Supports both `userData.interactive` and legacy `userData.draggableParam` metadata.
 * Automatically disables OrbitControls during active drag to prevent camera jitter.
 */
export class ThreeInteractionManager {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private controls: OrbitControls | null = null;
  private sceneForCursor: THREE.Scene | null = null;
  private defaultHoverColor: number;
  private dragSpanPx: number;
  private getInteractiveObjects: () => THREE.Object3D[];
  private getParamValue?: (paramKey: string) => number | undefined;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private hoveredObject: THREE.Object3D | null = null;
  private originalEmissives = new Map<
    THREE.Mesh,
    { color: THREE.Color; intensity: number }
  >();

  private isDragging = false;
  private dragObject: THREE.Object3D | null = null;
  private dragStartPointer = { x: 0, y: 0 };
  private dragStartValue = 0;
  private lastCursorEmitMs = 0;

  private onHoverChange?: (object: THREE.Object3D | null, hitPoint: THREE.Vector3 | null) => void;
  private onDragStart?: (object: THREE.Object3D, paramKey?: string) => void;
  private onDragUpdate?: (object: THREE.Object3D, paramKey: string, newValue: number, label?: string) => void;
  private onDragEnd?: (object: THREE.Object3D, paramKey?: string) => void;
  private onClickCallback?: (object: THREE.Object3D, hitPoint: THREE.Vector3) => void;
  private onCursorMove3D?: ThreeInteractionManagerOptions['onCursorMove3D'];

  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor(options: ThreeInteractionManagerOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.controls = options.controls ?? null;
    this.sceneForCursor = options.sceneForCursor ?? null;
    this.defaultHoverColor = options.defaultHoverColor ?? 0x38bdf8;
    this.dragSpanPx = options.dragSpanPx ?? 280;
    this.getInteractiveObjects = options.getInteractiveObjects;
    this.getParamValue = options.getParamValue;
    this.onHoverChange = options.onHoverChange;
    this.onDragStart = options.onDragStart;
    this.onDragUpdate = options.onDragUpdate;
    this.onDragEnd = options.onDragEnd;
    this.onClickCallback = options.onClick;
    this.onCursorMove3D = options.onCursorMove3D;

    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);

    this.domElement.addEventListener('pointermove', this.boundPointerMove);
    this.domElement.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerUp);
  }

  public setControls(controls: OrbitControls | null) {
    this.controls = controls;
  }

  public setCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  private updatePointer(e: PointerEvent): boolean {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }

  private resolveHitTarget(intersects: THREE.Intersection[]): THREE.Object3D | null {
    for (const hit of intersects) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur && cur.parent && !isObjectInteractive(cur)) {
        cur = cur.parent;
      }
      if (cur && isObjectInteractive(cur)) {
        return cur;
      }
      if (isObjectInteractive(hit.object)) {
        return hit.object;
      }
    }
    return intersects[0]?.object ?? null;
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.updatePointer(e)) return;

    if (this.isDragging && this.dragObject) {
      const deltaX = e.clientX - this.dragStartPointer.x;
      const deltaY = e.clientY - this.dragStartPointer.y;
      const resolved = resolveInteractiveOptions(this.dragObject);

      if (resolved.paramKey && this.onDragUpdate) {
        const finalVal = computeDraggedParameterValue(
          this.dragStartValue,
          deltaX,
          deltaY,
          resolved.min,
          resolved.max,
          resolved.step,
          this.dragSpanPx
        );
        this.onDragUpdate(this.dragObject, resolved.paramKey, finalVal, resolved.label);
      }

      if (resolved.onDrag) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hitPoint = this.raycaster.ray.origin
          .clone()
          .add(this.raycaster.ray.direction.clone().multiplyScalar(5));
        resolved.onDrag(deltaX, deltaY, hitPoint);
      }
      return;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.getInteractiveObjects();
    const intersects = targets.length > 0 ? this.raycaster.intersectObjects(targets, true) : [];

    if (intersects.length > 0) {
      const hitMesh = this.resolveHitTarget(intersects);
      const hitPoint = intersects[0].point;

      if (hitMesh !== this.hoveredObject) {
        this.clearHover();
        this.applyHover(hitMesh);
      }
      this.onHoverChange?.(this.hoveredObject, hitPoint);
    } else if (this.hoveredObject) {
      this.clearHover();
      this.onHoverChange?.(null, null);
    }

    if (this.onCursorMove3D && this.sceneForCursor) {
      const now = performance.now();
      if (now - this.lastCursorEmitMs >= 45) {
        const sceneHits = this.raycaster.intersectObjects(this.sceneForCursor.children, true);
        if (sceneHits.length > 0) {
          const hit = sceneHits[0];
          this.onCursorMove3D(
            [hit.point.x, hit.point.y, hit.point.z],
            hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : undefined,
            hit.object.name
          );
          this.lastCursorEmitMs = now;
        }
      }
    }
  }

  private handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    if (!this.updatePointer(e)) return;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.getInteractiveObjects();
    const intersects = targets.length > 0 ? this.raycaster.intersectObjects(targets, true) : [];
    if (intersects.length === 0) return;

    const targetObj = this.resolveHitTarget(intersects);
    if (!targetObj) return;

    const resolved = resolveInteractiveOptions(targetObj);
    if (resolved.kind === 'draggable' && (resolved.paramKey || resolved.onDrag)) {
      this.isDragging = true;
      this.dragObject = targetObj;
      this.dragStartPointer = { x: e.clientX, y: e.clientY };
      const liveVal = resolved.paramKey ? this.getParamValue?.(resolved.paramKey) : undefined;
      this.dragStartValue =
        typeof liveVal === 'number' && Number.isFinite(liveVal)
          ? liveVal
          : Number(resolved.currentValue ?? resolved.min ?? 0);

      if (this.controls) {
        this.controls.enabled = false;
      }
      this.domElement.style.cursor = 'grabbing';
      this.onDragStart?.(targetObj, resolved.paramKey);
    } else {
      resolved.onClick?.(targetObj, intersects[0].point);
      this.onClickCallback?.(targetObj, intersects[0].point);
    }
  }

  private handlePointerUp(_e: PointerEvent) {
    if (this.isDragging && this.dragObject) {
      const endedObj = this.dragObject;
      const resolved = resolveInteractiveOptions(endedObj);
      this.isDragging = false;
      this.dragObject = null;

      if (this.controls) {
        this.controls.enabled = true;
      }
      this.domElement.style.cursor = this.hoveredObject ? 'grab' : 'default';
      this.onDragEnd?.(endedObj, resolved.paramKey);
    }
  }

  private applyHover(obj: THREE.Object3D | null) {
    if (!obj) return;
    this.hoveredObject = obj;
    const resolved = resolveInteractiveOptions(obj);

    this.domElement.style.cursor =
      resolved.cursor || (resolved.kind === 'draggable' ? 'grab' : 'pointer');

    const glowColor = resolved.hoverColor ?? this.defaultHoverColor;
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material;
        if (mat && 'emissive' in mat && (mat as THREE.MeshStandardMaterial).emissive) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (!this.originalEmissives.has(mesh)) {
            this.originalEmissives.set(mesh, {
              color: stdMat.emissive.clone(),
              intensity: typeof stdMat.emissiveIntensity === 'number' ? stdMat.emissiveIntensity : 0,
            });
          }
          stdMat.emissive.setHex(glowColor);
          if ('emissiveIntensity' in stdMat) {
            stdMat.emissiveIntensity = Math.max(0.45, stdMat.emissiveIntensity || 0);
          }
        }
      }
    });
  }

  private clearHover() {
    if (!this.hoveredObject) return;

    this.hoveredObject.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material;
        const saved = this.originalEmissives.get(mesh);
        if (mat && 'emissive' in mat && saved) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          stdMat.emissive.copy(saved.color);
          if ('emissiveIntensity' in stdMat) {
            stdMat.emissiveIntensity = saved.intensity;
          }
        }
      }
    });

    this.originalEmissives.clear();
    this.hoveredObject = null;
    this.domElement.style.cursor = 'default';
  }

  public dispose() {
    this.clearHover();
    if (this.controls) {
      this.controls.enabled = true;
    }
    this.domElement.removeEventListener('pointermove', this.boundPointerMove);
    this.domElement.removeEventListener('pointerdown', this.boundPointerDown);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);
  }
}
