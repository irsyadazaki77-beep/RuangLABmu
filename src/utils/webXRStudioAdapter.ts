/**
 * WebXR & Spatial Computing Studio Adapter (Fase 1 — Tugas 1)
 * Menyediakan:
 * 1. Inisialisasi & pengecekan sesi WebXR (`navigator.xr.isSessionSupported('immersive-vr')`)
 * 2. Konfigurasi `renderer.xr.enabled = true` dan helper `VRButton` / custom UI button
 * 3. Pengendali Interaksi Spasial (VR Controllers kiri & kanan) dengan Laser Pointer Raycaster
 *    untuk memilih, menggeser alat 3D, dan mengubah parameter eksperimen secara spasial.
 * 4. Progressive Enhancement: Jika perangkat tidak memiliki sensor headset VR fisik,
 *    antarmuka desktop/mobile tetap berfungsi normal dan mendukung simulasi laser pointer spasial.
 */

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

export interface SpatialRaycastHit {
  controllerIndex: 0 | 1;
  hand: 'left' | 'right';
  objectName: string;
  point: [number, number, number];
  distance: number;
  parameterDelta?: number;
}

export interface WebXRStateSnapshot {
  isHardwareVRSupported: boolean;
  isProgressiveVRAvailable: boolean;
  isSessionActive: boolean;
  sessionMode: 'none' | 'native-webxr' | 'spatial-laser-rig';
  activeHandHover: SpatialRaycastHit | null;
  lastSpatialAction: string | null;
}

export interface VRControllerInteractionOptions {
  onSelectObject?: (hit: SpatialRaycastHit) => void;
  onSpatialParameterStep?: (delta: number, hand: 'left' | 'right', objectName: string) => void;
}

export interface VRControllerRigHandle {
  controllerLeft: THREE.Group;
  controllerRight: THREE.Group;
  laserGroup: THREE.Group;
  reticleMesh: THREE.Mesh;
  updateSpatialRaycasters: () => SpatialRaycastHit | null;
  setSimulatedRigVisible: (visible: boolean) => void;
  updatePointerNDC: (ndcX: number, ndcY: number, isPressed?: boolean) => void;
  dispose: () => void;
}

// Pre-allocated math objects outside render loop to guarantee Zero GC at 60/90 FPS
const _tempMatrix = new THREE.Matrix4();
const _rayOrigin = new THREE.Vector3();
const _rayDirection = new THREE.Vector3();
const _pointerNDC = new THREE.Vector2(0, 0);
const _laserEndLocal = new THREE.Vector3(0, 0, -6);

let currentXRState: WebXRStateSnapshot = {
  isHardwareVRSupported: false,
  isProgressiveVRAvailable: true,
  isSessionActive: false,
  sessionMode: 'none',
  activeHandHover: null,
  lastSpatialAction: null,
};

type XRStateListener = (state: WebXRStateSnapshot) => void;
const xrStateListeners = new Set<XRStateListener>();

interface ActiveXRSceneRegistration {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  rig: VRControllerRigHandle;
  activeSession: any | null;
}

let activeRegistration: ActiveXRSceneRegistration | null = null;

function notifyXRListeners() {
  const snapshot = { ...currentXRState };
  xrStateListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeWebXRState(listener: XRStateListener): () => void {
  xrStateListeners.add(listener);
  listener({ ...currentXRState });
  return () => {
    xrStateListeners.delete(listener);
  };
}

export function getWebXRState(): WebXRStateSnapshot {
  return { ...currentXRState };
}

/**
 * 1. Mengecek apakah browser dan perangkat mendukung sesi WebXR `immersive-vr`.
 *    Aman dipanggil di lingkungan tanpa WebXR (progressive enhancement).
 */
export async function checkImmersiveVRSupport(allowIframeProbe = false): Promise<boolean> {
  try {
    const docAny =
      typeof document !== 'undefined'
        ? (document as unknown as {
            permissionsPolicy?: { allowsFeature?: (f: string) => boolean };
            featurePolicy?: { allowsFeature?: (f: string) => boolean };
          })
        : undefined;
    const policy = docAny?.permissionsPolicy ?? docAny?.featurePolicy;
    const explicitPolicyAllowed =
      policy && typeof policy.allowsFeature === 'function'
        ? policy.allowsFeature('xr-spatial-tracking')
        : undefined;
    const isEmbeddedIframe =
      typeof window !== 'undefined' &&
      (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();

    if (
      explicitPolicyAllowed === false ||
      (isEmbeddedIframe && !allowIframeProbe && explicitPolicyAllowed !== true)
    ) {
      currentXRState = {
        ...currentXRState,
        isHardwareVRSupported: false,
        isProgressiveVRAvailable: true,
      };
      notifyXRListeners();
      return false;
    }

    if (
      typeof navigator !== 'undefined' &&
      'xr' in navigator &&
      navigator.xr &&
      typeof (navigator.xr as any).isSessionSupported === 'function'
    ) {
      const supported = await (navigator.xr as any).isSessionSupported('immersive-vr');
      currentXRState = {
        ...currentXRState,
        isHardwareVRSupported: Boolean(supported),
        isProgressiveVRAvailable: true,
      };
      notifyXRListeners();
      return Boolean(supported);
    }
  } catch {
    // Fallback gracefully on non-XR browsers or restricted iframes
  }

  currentXRState = {
    ...currentXRState,
    isHardwareVRSupported: false,
    isProgressiveVRAvailable: true,
  };
  notifyXRListeners();
  return false;
}

/**
 * 2. Mengaktifkan dukungan WebXR pada instance `THREE.WebGLRenderer`.
 */
export function enableWebXRRenderer(
  renderer: THREE.WebGLRenderer,
  referenceSpaceType: XRReferenceSpaceType = 'local-floor'
): void {
  if (!renderer || !renderer.xr) return;
  try {
    renderer.xr.enabled = true;
    if (typeof renderer.xr.setReferenceSpaceType === 'function') {
      renderer.xr.setReferenceSpaceType(referenceSpaceType);
    }
  } catch {
    // Ignore if WebGL context does not support XR reference space configuration
  }
}

/**
 * 3. Mengonfigurasi tombol standar WebXR (`VRButton`) atau mengembalikannya sebagai elemen DOM.
 */
export function createStandardVRButtonElement(
  renderer: THREE.WebGLRenderer
): HTMLElement | null {
  if (typeof document === 'undefined' || !renderer) return null;
  try {
    enableWebXRRenderer(renderer);
    return VRButton.createButton(renderer);
  } catch {
    return null;
  }
}

/**
 * Membangun geometri komposit wand controller VR beserta sinar laser pointer & ujung cincin bidik.
 */
function buildControllerLaserWand(hand: 'left' | 'right'): {
  wandGroup: THREE.Group;
  laserLine: THREE.Line;
} {
  const wandGroup = new THREE.Group();
  wandGroup.name = `vr-controller-wand-${hand}`;

  const primaryHex = hand === 'left' ? 0x38bdf8 : 0x10b981;

  // 1. Primary body handle
  const bodyGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.14, 16);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.75,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.set(0, 0, 0.05);
  wandGroup.add(bodyMesh);

  // 2. Secondary tracking halo ring
  const ringGeo = new THREE.TorusGeometry(0.036, 0.005, 12, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: 0.2,
    metalness: 0.6,
    emissive: primaryHex,
    emissiveIntensity: 0.45,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.set(0, 0.01, -0.02);
  wandGroup.add(ringMesh);

  // 3. Laser emitter tip + ray line along -Z
  const laserPositions = new Float32Array([0, 0, 0, 0, 0, -6]);
  const laserGeo = new THREE.BufferGeometry();
  laserGeo.setAttribute('position', new THREE.BufferAttribute(laserPositions, 3));
  const laserMat = new THREE.LineBasicMaterial({
    color: primaryHex,
    transparent: true,
    opacity: 0.85,
  });
  const laserLine = new THREE.Line(laserGeo, laserMat);
  laserLine.name = `vr-laser-line-${hand}`;
  wandGroup.add(laserLine);

  return { wandGroup, laserLine };
}

/**
 * 4. Menyiapkan Pengendali Interaksi Spasial (VR Controllers kiri & kanan)
 *    lengkap dengan `THREE.Raycaster` untuk memilih & menggeser alat 3D / parameter.
 */
export function setupVRControllersAndLaserPointers(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options?: VRControllerInteractionOptions
): VRControllerRigHandle {
  enableWebXRRenderer(renderer);

  const laserGroup = new THREE.Group();
  laserGroup.name = 'ruanglab-webxr-laser-rig';
  scene.add(laserGroup);

  const controllerLeft = renderer.xr?.getController
    ? renderer.xr.getController(0)
    : new THREE.Group();
  const controllerRight = renderer.xr?.getController
    ? renderer.xr.getController(1)
    : new THREE.Group();

  controllerLeft.name = 'xr-controller-left';
  controllerRight.name = 'xr-controller-right';

  const leftWand = buildControllerLaserWand('left');
  const rightWand = buildControllerLaserWand('right');

  controllerLeft.add(leftWand.wandGroup);
  controllerRight.add(rightWand.wandGroup);

  laserGroup.add(controllerLeft, controllerRight);

  // Spatial hit reticle ring
  const reticleGeo = new THREE.RingGeometry(0.05, 0.085, 24);
  const reticleMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });
  const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
  reticleMesh.visible = false;
  reticleMesh.renderOrder = 999;
  laserGroup.add(reticleMesh);

  // Initially hide wand meshes unless XR session or spatial laser mode is active
  laserGroup.visible = false;

  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.05;
  raycaster.far = 25;

  let simulatedRigActive = false;
  let lastHoveredHit: SpatialRaycastHit | null = null;

  const triggerSpatialSelect = (hand: 'left' | 'right') => {
    if (!lastHoveredHit) return;
    const delta = hand === 'right' ? 1 : -1;
    const actionLabel = `VR ${hand === 'right' ? 'Kanan' : 'Kiri'}: Interaksi ${lastHoveredHit.objectName} (${delta > 0 ? '+Step' : '-Step'})`;
    currentXRState = {
      ...currentXRState,
      lastSpatialAction: actionLabel,
    };
    notifyXRListeners();
    options?.onSelectObject?.(lastHoveredHit);
    options?.onSpatialParameterStep?.(delta, hand, lastHoveredHit.objectName);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ruanglab:xr-spatial-select', {
          detail: {
            ...lastHoveredHit,
            parameterDelta: delta,
          },
        })
      );
    }
  };

  const onLeftSelectStart = () => triggerSpatialSelect('left');
  const onRightSelectStart = () => triggerSpatialSelect('right');

  controllerLeft.addEventListener('selectstart' as any, onLeftSelectStart as any);
  controllerRight.addEventListener('selectstart' as any, onRightSelectStart as any);

  const collectInteractableMeshes = (): THREE.Object3D[] => {
    const targets: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        obj !== reticleMesh &&
        !obj.name.startsWith('vr-') &&
        !laserGroup.children.includes(obj) &&
        obj.visible
      ) {
        // Skip huge background floors to prioritize lab apparatus
        if (obj.geometry instanceof THREE.PlaneGeometry) return;
        targets.push(obj);
      }
    });
    return targets;
  };

  const updateLaserLength = (line: THREE.Line, dist: number) => {
    const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.setXYZ(1, 0, 0, -Math.max(0.2, Math.min(12, dist)));
      posAttr.needsUpdate = true;
    }
  };

  const updateSpatialRaycasters = (): SpatialRaycastHit | null => {
    const isPresenting = Boolean(renderer.xr?.isPresenting);
    if (!isPresenting && !simulatedRigActive) {
      if (laserGroup.visible) laserGroup.visible = false;
      return null;
    }

    laserGroup.visible = true;

    // Position simulated controllers ergonomically in front of camera when running in spatial desktop VR mode
    if (!isPresenting && simulatedRigActive) {
      const camForward = _rayDirection.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const camRight = _rayOrigin.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const camUp = _laserEndLocal.set(0, 1, 0).applyQuaternion(camera.quaternion);

      controllerLeft.position
        .copy(camera.position)
        .addScaledVector(camForward, 1.35)
        .addScaledVector(camRight, -0.42)
        .addScaledVector(camUp, -0.28);
      controllerLeft.quaternion.copy(camera.quaternion);
      controllerLeft.rotateY(-0.12 + _pointerNDC.x * 0.35);
      controllerLeft.rotateX(_pointerNDC.y * 0.28);

      controllerRight.position
        .copy(camera.position)
        .addScaledVector(camForward, 1.35)
        .addScaledVector(camRight, 0.42)
        .addScaledVector(camUp, -0.28);
      controllerRight.quaternion.copy(camera.quaternion);
      controllerRight.rotateY(0.12 + _pointerNDC.x * 0.35);
      controllerRight.rotateX(_pointerNDC.y * 0.28);

      controllerLeft.updateMatrixWorld(true);
      controllerRight.updateMatrixWorld(true);
    }

    const targets = collectInteractableMeshes();
    if (targets.length === 0) {
      reticleMesh.visible = false;
      return null;
    }

    // Raycast from Right controller first, then Left controller
    const controllers: Array<{
      ctrl: THREE.Group;
      line: THREE.Line;
      idx: 0 | 1;
      hand: 'left' | 'right';
    }> = [
      { ctrl: controllerRight, line: rightWand.laserLine, idx: 1, hand: 'right' },
      { ctrl: controllerLeft, line: leftWand.laserLine, idx: 0, hand: 'left' },
    ];

    for (const item of controllers) {
      _tempMatrix.identity().extractRotation(item.ctrl.matrixWorld);
      _rayOrigin.setFromMatrixPosition(item.ctrl.matrixWorld);
      _rayDirection.set(0, 0, -1).applyMatrix4(_tempMatrix).normalize();

      raycaster.ray.origin.copy(_rayOrigin);
      raycaster.ray.direction.copy(_rayDirection);

      const intersects = raycaster.intersectObjects(targets, false);
      if (intersects.length > 0) {
        const hit = intersects[0];
        updateLaserLength(item.line, hit.distance);

        reticleMesh.visible = true;
        reticleMesh.position.copy(hit.point);
        if (hit.face) {
          _laserEndLocal.copy(hit.point).add(hit.face.normal);
          reticleMesh.lookAt(_laserEndLocal);
        } else {
          reticleMesh.lookAt(camera.position);
        }

        const resolvedName =
          hit.object.name ||
          hit.object.parent?.name ||
          'Aparatus Laboratorium 3D';

        lastHoveredHit = {
          controllerIndex: item.idx,
          hand: item.hand,
          objectName: resolvedName,
          point: [
            Number(hit.point.x.toFixed(2)),
            Number(hit.point.y.toFixed(2)),
            Number(hit.point.z.toFixed(2)),
          ],
          distance: Number(hit.distance.toFixed(2)),
        };

        if (
          !currentXRState.activeHandHover ||
          currentXRState.activeHandHover.objectName !== lastHoveredHit.objectName
        ) {
          currentXRState = {
            ...currentXRState,
            activeHandHover: lastHoveredHit,
          };
          notifyXRListeners();
        }
        return lastHoveredHit;
      } else {
        updateLaserLength(item.line, 6);
      }
    }

    reticleMesh.visible = false;
    if (currentXRState.activeHandHover !== null) {
      currentXRState = {
        ...currentXRState,
        activeHandHover: null,
      };
      notifyXRListeners();
    }
    lastHoveredHit = null;
    return null;
  };

  const setSimulatedRigVisible = (visible: boolean) => {
    simulatedRigActive = visible;
    laserGroup.visible = visible;
    if (!visible) {
      reticleMesh.visible = false;
    }
  };

  const updatePointerNDC = (ndcX: number, ndcY: number, isPressed = false) => {
    _pointerNDC.set(ndcX, ndcY);
    if (isPressed && simulatedRigActive) {
      updateSpatialRaycasters();
      triggerSpatialSelect(ndcX >= 0 ? 'right' : 'left');
    }
  };

  const dispose = () => {
    controllerLeft.removeEventListener('selectstart' as any, onLeftSelectStart as any);
    controllerRight.removeEventListener('selectstart' as any, onRightSelectStart as any);
    scene.remove(laserGroup);
    reticleGeo.dispose();
    reticleMat.dispose();
  };

  return {
    controllerLeft,
    controllerRight,
    laserGroup,
    reticleMesh,
    updateSpatialRaycasters,
    setSimulatedRigVisible,
    updatePointerNDC,
    dispose,
  };
}

/**
 * Mendaftarkan scene 3D aktif agar tombol `[🥽 Masuk Mode VR]` di `StandardLabViewShell.tsx`
 * dapat langsung mengalihkan kanvas ke sesi imersif VR 3D dengan kontrol laser pointer.
 */
export function registerActiveXRScene(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options?: VRControllerInteractionOptions
): VRControllerRigHandle {
  enableWebXRRenderer(renderer);
  const rig = setupVRControllersAndLaserPointers(renderer, scene, camera, options);

  // Attach pointer listeners on canvas for spatial laser simulation when in desktop VR preview
  const domEl = renderer.domElement;
  const onPointerMove = (e: PointerEvent) => {
    if (currentXRState.sessionMode !== 'spatial-laser-rig') return;
    const rect = domEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    rig.updatePointerNDC(nx, ny, false);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (currentXRState.sessionMode !== 'spatial-laser-rig') return;
    const rect = domEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    rig.updatePointerNDC(nx, ny, true);
  };

  if (domEl && typeof domEl.addEventListener === 'function') {
    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerdown', onPointerDown);
  }

  const origDispose = rig.dispose;
  rig.dispose = () => {
    if (domEl && typeof domEl.removeEventListener === 'function') {
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerdown', onPointerDown);
    }
    origDispose();
    if (activeRegistration?.rig === rig) {
      activeRegistration = null;
    }
  };

  activeRegistration = {
    renderer,
    scene,
    camera,
    rig,
    activeSession: null,
  };

  // Preserve active spatial mode across module switches
  if (currentXRState.isSessionActive && currentXRState.sessionMode === 'spatial-laser-rig') {
    rig.setSimulatedRigVisible(true);
  }

  // Trigger async hardware WebXR detection
  void checkImmersiveVRSupport();

  return rig;
}

/**
 * Mengaktifkan atau keluar dari sesi Mode VR Lab (baik native WebXR headset maupun Spatial Laser VR Rig).
 */
export async function toggleImmersiveVRSession(): Promise<WebXRStateSnapshot> {
  // If already active, exit session cleanly
  if (currentXRState.isSessionActive) {
    if (activeRegistration?.activeSession) {
      try {
        await activeRegistration.activeSession.end();
      } catch {
        // ignore
      }
      activeRegistration.activeSession = null;
    }
    activeRegistration?.rig.setSimulatedRigVisible(false);
    currentXRState = {
      ...currentXRState,
      isSessionActive: false,
      sessionMode: 'none',
      activeHandHover: null,
      lastSpatialAction: 'Sesi Mode VR diakhiri — kembali ke tampilan laboratorium standar.',
    };
    notifyXRListeners();
    return { ...currentXRState };
  }

  // 1. Try starting a native hardware WebXR `immersive-vr` session first if supported
  const hwSupported = await checkImmersiveVRSupport();
  if (
    hwSupported &&
    activeRegistration?.renderer &&
    typeof navigator !== 'undefined' &&
    'xr' in navigator &&
    navigator.xr
  ) {
    try {
      const sessionInit: XRSessionInit = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
      };
      const session = await (navigator.xr as any).requestSession('immersive-vr', sessionInit);
      enableWebXRRenderer(activeRegistration.renderer);
      await activeRegistration.renderer.xr.setSession(session);
      activeRegistration.activeSession = session;

      session.addEventListener('end', () => {
        if (activeRegistration) {
          activeRegistration.activeSession = null;
        }
        currentXRState = {
          ...currentXRState,
          isSessionActive: false,
          sessionMode: 'none',
          activeHandHover: null,
        };
        notifyXRListeners();
      });

      currentXRState = {
        ...currentXRState,
        isSessionActive: true,
        sessionMode: 'native-webxr',
        lastSpatialAction: 'Sesi WebXR Imersif Aktif — Gunakan controller VR kiri/kanan.',
      };
      notifyXRListeners();
      return { ...currentXRState };
    } catch {
      // Fallback to Spatial Laser VR Rig if headset session request was declined or unavailable
    }
  }

  // 2. Progressive Enhancement: Activate Spatial Laser-Pointer VR Rig inside the 3D viewport
  if (activeRegistration) {
    enableWebXRRenderer(activeRegistration.renderer);
    activeRegistration.rig.setSimulatedRigVisible(true);
    activeRegistration.rig.updateSpatialRaycasters();
  }

  currentXRState = {
    ...currentXRState,
    isSessionActive: true,
    sessionMode: 'spatial-laser-rig',
    lastSpatialAction:
      'Mode VR Spasial Aktif — Arahkan Laser Pointer Kiri/Kanan untuk memilih & menggeser alat 3D.',
  };
  notifyXRListeners();
  return { ...currentXRState };
}
