import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface Interactive3DObjectOptions {
  id?: string;
  type: 'draggable' | 'clickable';
  paramKey?: string;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  hoverColor?: number;
  cursor?: string;
  onClick?: (obj: THREE.Object3D, hitPoint: THREE.Vector3) => void;
  onDrag?: (deltaX: number, deltaY: number, hitPoint: THREE.Vector3) => void;
  metadata?: Record<string, unknown>;
}

export interface ThreeInteractionManagerOptions {
  camera: THREE.Camera;
  domElement: HTMLElement;
  controls?: OrbitControls | null;
  getInteractiveObjects: () => THREE.Object3D[];
  onHoverChange?: (object: THREE.Object3D | null, hitPoint: THREE.Vector3 | null) => void;
  onDragStart?: (object: THREE.Object3D, paramKey?: string) => void;
  onDragUpdate?: (object: THREE.Object3D, paramKey: string, newValue: number) => void;
  onDragEnd?: (object: THREE.Object3D, paramKey?: string) => void;
  onClick?: (object: THREE.Object3D, hitPoint: THREE.Vector3) => void;
}

/**
 * ThreeInteractionHelper
 * Centralized utility for Three.js Raycasting, Hover Emissive Glow, and Direct Drag Manipulation.
 * Automatically disables OrbitControls during active drag to prevent camera jitter.
 */
export class ThreeInteractionManager {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private controls: OrbitControls | null = null;
  private getInteractiveObjects: () => THREE.Object3D[];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private hoveredObject: THREE.Object3D | null = null;
  private originalEmissives = new Map<THREE.Mesh, THREE.Color>();

  private isDragging = false;
  private dragObject: THREE.Object3D | null = null;
  private dragStartPointer = { x: 0, y: 0 };
  private dragStartValue = 0;

  private onHoverChange?: (object: THREE.Object3D | null, hitPoint: THREE.Vector3 | null) => void;
  private onDragStart?: (object: THREE.Object3D, paramKey?: string) => void;
  private onDragUpdate?: (object: THREE.Object3D, paramKey: string, newValue: number) => void;
  private onDragEnd?: (object: THREE.Object3D, paramKey?: string) => void;
  private onClickCallback?: (object: THREE.Object3D, hitPoint: THREE.Vector3) => void;

  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor(options: ThreeInteractionManagerOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.controls = options.controls ?? null;
    this.getInteractiveObjects = options.getInteractiveObjects;
    this.onHoverChange = options.onHoverChange;
    this.onDragStart = options.onDragStart;
    this.onDragUpdate = options.onDragUpdate;
    this.onDragEnd = options.onDragEnd;
    this.onClickCallback = options.onClick;

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

  private updatePointer(e: PointerEvent) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerMove(e: PointerEvent) {
    this.updatePointer(e);

    if (this.isDragging && this.dragObject) {
      const deltaX = e.clientX - this.dragStartPointer.x;
      const deltaY = e.clientY - this.dragStartPointer.y;
      const opts = this.dragObject.userData as Interactive3DObjectOptions;

      if (opts.paramKey && this.onDragUpdate) {
        const min = opts.min ?? 0;
        const max = opts.max ?? 100;
        const step = opts.step ?? 1;
        const sensitivity = (max - min) / 260; // 260px drag = full range
        const computed = this.dragStartValue + deltaX * sensitivity - deltaY * sensitivity * 0.5;
        const clamped = Math.max(min, Math.min(max, Math.round(computed / step) * step));
        const finalVal = Number(clamped.toFixed(3));
        this.onDragUpdate(this.dragObject, opts.paramKey, finalVal);
      }

      if (opts.onDrag) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hitPoint = this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(5));
        opts.onDrag(deltaX, deltaY, hitPoint);
      }
      return;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.getInteractiveObjects();
    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      // Find outermost interactive parent or mesh
      let hitMesh: THREE.Object3D | null = null;
      for (const hit of intersects) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur.parent && !cur.userData?.interactive) {
          cur = cur.parent;
        }
        if (cur && cur.userData?.interactive) {
          hitMesh = cur;
          break;
        }
        if (hit.object.userData?.interactive) {
          hitMesh = hit.object;
          break;
        }
      }

      if (!hitMesh && intersects[0].object) {
        hitMesh = intersects[0].object;
      }

      const hitPoint = intersects[0].point;

      if (hitMesh !== this.hoveredObject) {
        this.clearHover();
        this.applyHover(hitMesh);
      }
      this.onHoverChange?.(this.hoveredObject, hitPoint);
    } else {
      if (this.hoveredObject) {
        this.clearHover();
        this.onHoverChange?.(null, null);
      }
    }
  }

  private handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return; // Only primary mouse button
    this.updatePointer(e);

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.getInteractiveObjects();
    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      let targetObj: THREE.Object3D | null = null;
      for (const hit of intersects) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur.parent && !cur.userData?.interactive) {
          cur = cur.parent;
        }
        if (cur && cur.userData?.interactive) {
          targetObj = cur;
          break;
        }
        if (hit.object.userData?.interactive) {
          targetObj = hit.object;
          break;
        }
      }

      if (!targetObj && intersects[0].object) {
        targetObj = intersects[0].object;
      }

      if (targetObj) {
        const opts = targetObj.userData as Interactive3DObjectOptions;

        if (opts.type === 'draggable') {
          this.isDragging = true;
          this.dragObject = targetObj;
          this.dragStartPointer = { x: e.clientX, y: e.clientY };
          this.dragStartValue = Number(targetObj.userData.currentValue ?? opts.min ?? 0);

          if (this.controls) {
            this.controls.enabled = false;
          }
          this.domElement.style.cursor = 'grabbing';
          this.onDragStart?.(targetObj, opts.paramKey);
        } else if (opts.type === 'clickable') {
          if (opts.onClick) {
            opts.onClick(targetObj, intersects[0].point);
          }
          this.onClickCallback?.(targetObj, intersects[0].point);
        }
      }
    }
  }

  private handlePointerUp(_e: PointerEvent) {
    if (this.isDragging && this.dragObject) {
      const opts = this.dragObject.userData as Interactive3DObjectOptions;
      this.isDragging = false;
      this.dragObject = null;

      if (this.controls) {
        this.controls.enabled = true;
      }
      this.domElement.style.cursor = this.hoveredObject ? 'grab' : 'default';
      this.onDragEnd?.(this.dragObject ?? undefined as unknown as THREE.Object3D, opts.paramKey);
    }
  }

  private applyHover(obj: THREE.Object3D | null) {
    if (!obj) return;
    this.hoveredObject = obj;
    const opts = obj.userData as Interactive3DObjectOptions;

    // Apply grab or pointer cursor
    if (opts.type === 'draggable') {
      this.domElement.style.cursor = opts.cursor || 'grab';
    } else {
      this.domElement.style.cursor = opts.cursor || 'pointer';
    }

    // Apply emissive glow to all child meshes
    const glowColor = opts.hoverColor ?? 0x38bdf8;
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material;
        if (mat && 'emissive' in mat && (mat as THREE.MeshStandardMaterial).emissive) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (!this.originalEmissives.has(mesh)) {
            this.originalEmissives.set(mesh, stdMat.emissive.clone());
          }
          stdMat.emissive.setHex(glowColor);
          if ('emissiveIntensity' in stdMat) {
            stdMat.emissiveIntensity = 0.45;
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
        if (mat && 'emissive' in mat && this.originalEmissives.has(mesh)) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          const orig = this.originalEmissives.get(mesh);
          if (orig) stdMat.emissive.copy(orig);
          if ('emissiveIntensity' in stdMat) {
            stdMat.emissiveIntensity = 0.0;
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
