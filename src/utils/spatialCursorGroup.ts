import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SpatialCursorPayload } from './collabProtocol';
import { useCollabStore } from '../stores/useCollabStore';
import { emitLabEvent, LAB_EVENTS } from './labEventBus';

interface CursorVisualInstance {
  group: THREE.Group;
  sphere: THREE.Mesh;
  halo: THREE.Mesh;
  laserLine: THREE.Line;
  laserGeo: THREE.BufferGeometry;
  laserMat: THREE.LineBasicMaterial;
  sprite: THREE.Sprite;
  spriteMat: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  lastTextKey: string;
}

/**
 * Creates a crisp 2D canvas sprite for user cursor name tags and hovered 3D objects.
 */
function createCursorBadgeTexture(
  userName: string,
  userColor: string,
  hoveredObject?: string
): { texture: THREE.CanvasTexture; width: number; height: number } {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = hoveredObject ? 110 : 72;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Pill background with rounded corners and glowing border
    const radius = 16;
    const x = 6;
    const y = 6;
    const w = canvas.width - 12;
    const h = canvas.height - 12;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    // Dark glass background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fill();

    // Color-accented border
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = userColor;
    ctx.stroke();
    ctx.restore();

    // Color dot indicator
    ctx.beginPath();
    ctx.arc(32, hoveredObject ? 36 : 36, 9, 0, Math.PI * 2);
    ctx.fillStyle = userColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // User Name Text
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText(userName, 52, hoveredObject ? 36 : 36);

    // Laser status or Hovered Object Text
    if (hoveredObject) {
      ctx.font = '500 17px monospace, sans-serif';
      ctx.fillStyle = userColor;
      ctx.fillText(`🎯 ${hoveredObject}`, 32, 78);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return { texture, width: canvas.width, height: canvas.height };
}

/**
 * SpatialCursorManager
 * Manages rendering of real-time 3D laser pointers, glowing orb markers, and canvas sprites
 * for remote student lab partners inside Three.js scenes.
 */
export class SpatialCursorManager {
  private parentScene: THREE.Scene;
  private cursorRootGroup: THREE.Group;
  private instances = new Map<string, CursorVisualInstance>();

  constructor(scene: THREE.Scene) {
    this.parentScene = scene;
    this.cursorRootGroup = new THREE.Group();
    this.cursorRootGroup.name = 'SpatialLaserCursors';
    this.parentScene.add(this.cursorRootGroup);
  }

  /**
   * Updates or instantiates visual elements for all remote cursors.
   */
  public update(
    remoteCursors: Record<string, SpatialCursorPayload>,
    cameraPos?: THREE.Vector3
  ): void {
    const activeIds = new Set(Object.keys(remoteCursors));

    // Remove cursors that left or timed out
    for (const [userId, instance] of this.instances.entries()) {
      if (!activeIds.has(userId)) {
        this.disposeInstance(instance);
        this.cursorRootGroup.remove(instance.group);
        this.instances.delete(userId);
      }
    }

    // Add or update active cursors
    for (const [userId, cursor] of Object.entries(remoteCursors)) {
      let instance = this.instances.get(userId);
      const textKey = `${cursor.userName}:${cursor.color}:${cursor.hoveredObject || ''}`;

      if (!instance) {
        instance = this.createInstance(cursor);
        this.instances.set(userId, instance);
        this.cursorRootGroup.add(instance.group);
      } else if (instance.lastTextKey !== textKey) {
        // Re-generate texture if label or hovered object changed
        instance.texture.dispose();
        instance.spriteMat.dispose();

        const { texture } = createCursorBadgeTexture(
          cursor.userName,
          cursor.color,
          cursor.hoveredObject
        );
        instance.texture = texture;
        instance.spriteMat = new THREE.SpriteMaterial({
          map: texture,
          depthTest: false,
          transparent: true,
        });
        instance.sprite.material = instance.spriteMat;
        instance.lastTextKey = textKey;
        const aspect = cursor.hoveredObject ? 0.52 : 0.35;
        instance.sprite.scale.set(1.8, 1.8 * aspect, 1);
      }

      // Smoothly interpolate (LERP = 0.25) from current mesh position toward incoming target position
      const [targetX, targetY, targetZ] = cursor.position;
      const curPos = instance.sphere.position;
      const isInitialPlacement =
        curPos.x === 0 && curPos.y === 0 && curPos.z === 0 && instance.lastTextKey === textKey;
      const tx = isInitialPlacement ? targetX : curPos.x + (targetX - curPos.x) * 0.25;
      const ty = isInitialPlacement ? targetY : curPos.y + (targetY - curPos.y) * 0.25;
      const tz = isInitialPlacement ? targetZ : curPos.z + (targetZ - curPos.z) * 0.25;

      instance.sphere.position.set(tx, ty, tz);
      instance.halo.position.set(tx, Math.max(0.02, ty - 0.05), tz);
      instance.sprite.position.set(tx, ty + (cursor.hoveredObject ? 0.6 : 0.45), tz);

      // Virtual Laser Origin: from elevated perspective or camera offset toward target point
      const originX = cameraPos ? cameraPos.x * 0.75 + tx * 0.25 : tx + 1.2;
      const originY = cameraPos ? cameraPos.y * 0.85 + 0.5 : ty + 3.8;
      const originZ = cameraPos ? cameraPos.z * 0.75 + tz * 0.25 : tz + 2.4;

      const positions = instance.laserGeo.attributes.position as THREE.BufferAttribute;
      positions.setXYZ(0, originX, originY, originZ);
      positions.setXYZ(1, tx, ty, tz);
      positions.needsUpdate = true;
    }
  }

  private createInstance(cursor: SpatialCursorPayload): CursorVisualInstance {
    const group = new THREE.Group();
    group.name = `cursor-${cursor.userId}`;

    const colorHex = new THREE.Color(cursor.color);

    // 1. Glowing Sphere Marker
    const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.85,
      roughness: 0.1,
      metalness: 0.1,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.castShadow = false;

    // 2. Halo Ground Disc
    const haloGeo = new THREE.RingGeometry(0.08, 0.26, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;

    // 3. Laser Beam Line
    const laserGeo = new THREE.BufferGeometry();
    const [tx, ty, tz] = cursor.position;
    const lineVertices = new Float32Array([tx + 1.2, ty + 3.8, tz + 2.4, tx, ty, tz]);
    laserGeo.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));
    const laserMat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.68,
      linewidth: 2,
    });
    const laserLine = new THREE.Line(laserGeo, laserMat);

    // 4. Sprite Badge
    const { texture } = createCursorBadgeTexture(
      cursor.userName,
      cursor.color,
      cursor.hoveredObject
    );
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    const aspect = cursor.hoveredObject ? 0.52 : 0.35;
    sprite.scale.set(1.8, 1.8 * aspect, 1);
    sprite.center.set(0.5, 0.0);

    group.add(laserLine, sphere, halo, sprite);

    return {
      group,
      sphere,
      halo,
      laserLine,
      laserGeo,
      laserMat,
      sprite,
      spriteMat,
      texture,
      lastTextKey: `${cursor.userName}:${cursor.color}:${cursor.hoveredObject || ''}`,
    };
  }

  private disposeInstance(instance: CursorVisualInstance): void {
    instance.sphere.geometry.dispose();
    (instance.sphere.material as THREE.Material).dispose();

    instance.halo.geometry.dispose();
    (instance.halo.material as THREE.Material).dispose();

    instance.laserGeo.dispose();
    instance.laserMat.dispose();

    instance.texture.dispose();
    instance.spriteMat.dispose();
  }

  /**
   * Completely cleans up all materials, textures, and scene meshes.
   */
  public dispose(): void {
    for (const instance of this.instances.values()) {
      this.disposeInstance(instance);
      this.cursorRootGroup.remove(instance.group);
    }
    this.instances.clear();
    this.parentScene.remove(this.cursorRootGroup);
  }
}

export interface TeacherCollabBridgeHandle {
  tick: (nowMs?: number) => void;
  dispose: () => void;
}

/**
 * Attaches FASE 4 Teacher Live 3D Laser Pointer + Follow Teacher Camera Sync
 * cleanly to any Three.js scene with deterministic GPU resource disposal.
 */
export function attachTeacherCollabBridge(opts: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  domElement: HTMLElement;
}): TeacherCollabBridgeHandle {
  const { scene, camera, controls, domElement } = opts;

  const laserGroup = new THREE.Group();
  laserGroup.name = 'TeacherLaserPointerGroup';
  laserGroup.visible = false;

  const dotGeo = new THREE.SphereGeometry(0.11, 20, 20);
  const dotMat = new THREE.MeshStandardMaterial({
    color: 0xff2e4c,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.15,
    metalness: 0.1,
  });
  const dotMesh = new THREE.Mesh(dotGeo, dotMat);
  dotMesh.castShadow = false;

  const ringGeo = new THREE.RingGeometry(0.14, 0.28, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xf87171,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);

  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 4, 2, 0, 0, 0]), 3));
  const beamMat = new THREE.LineBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.72,
  });
  const beamLine = new THREE.Line(beamGeo, beamMat);

  const badge = createCursorBadgeTexture('Laser Guru', '#ef4444');
  const spriteMat = new THREE.SpriteMaterial({
    map: badge.texture,
    depthTest: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.75, 0.62, 1);
  sprite.center.set(0.5, 0);

  laserGroup.add(beamLine, dotMesh, ringMesh, sprite);
  scene.add(laserGroup);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const desiredCamPos = new THREE.Vector3();
  const desiredCamTarget = new THREE.Vector3();
  const normalVec = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);

  let lastLocalEmitAt = 0;
  let isApplyingTeacherCam = false;
  let prevSyncEnabled = useCollabStore.getState().teacherCameraSyncEnabled;

  const isRayTargetMesh = (obj: THREE.Object3D): boolean => {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.name === 'TeacherLaserPointerGroup' || cur.name === 'SpatialLaserCursors') {
        return false;
      }
      cur = cur.parent;
    }
    return true;
  };

  const handlePointerMove = (e: PointerEvent) => {
    const state = useCollabStore.getState();
    if (!state.teacherLaserActive) return;

    const now = performance.now();
    if (now - lastLocalEmitAt < 30) return;
    lastLocalEmitAt = now;

    const rect = domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(scene.children, true).filter((h) => isRayTargetMesh(h.object));
    if (hits.length === 0) return;

    const hit = hits[0];
    const point: [number, number, number] = [hit.point.x, hit.point.y, hit.point.z];
    const normal: [number, number, number] | undefined = hit.face
      ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z]
      : undefined;

    state.setLocalTeacherLaserPreview({
      roomId: state.activeRoomId || 'LAB-ALPHA',
      teacherName: state.teacherName || 'Pengajar',
      point,
      normal,
      hoveredObject: hit.object.name || undefined,
      active: true,
      updatedAt: Date.now(),
    });

    emitLabEvent(LAB_EVENTS.TEACHER_LASER_EMIT, {
      point,
      normal,
      hoveredObject: hit.object.name || undefined,
      active: true,
    });
  };

  const handlePointerLeave = () => {
    const state = useCollabStore.getState();
    if (!state.teacherLaserActive) return;
    state.setLocalTeacherLaserPreview(null);
    emitLabEvent(LAB_EVENTS.TEACHER_LASER_EMIT, {
      point: [0, 0, 0],
      active: false,
    });
  };

  const handleControlsChange = () => {
    if (isApplyingTeacherCam) return;
    const state = useCollabStore.getState();
    if (!state.teacherCameraSyncEnabled) return;
    emitLabEvent(LAB_EVENTS.TEACHER_CAMERA_EMIT, {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      enabled: true,
    });
  };

  const unsubStore = useCollabStore.subscribe((state) => {
    if (state.teacherCameraSyncEnabled !== prevSyncEnabled) {
      prevSyncEnabled = state.teacherCameraSyncEnabled;
      emitLabEvent(LAB_EVENTS.TEACHER_CAMERA_EMIT, {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
        enabled: state.teacherCameraSyncEnabled,
      });
    }
  });

  domElement.addEventListener('pointermove', handlePointerMove);
  domElement.addEventListener('pointerleave', handlePointerLeave);
  controls.addEventListener('change', handleControlsChange);

  const tick = (nowMs: number = performance.now()) => {
    const state = useCollabStore.getState();
    const activeLaser = state.remoteTeacherLaser || state.localTeacherLaserPreview;

    if (activeLaser && activeLaser.active) {
      laserGroup.visible = true;
      const [px, py, pz] = activeLaser.point;
      dotMesh.position.set(px, py, pz);

      if (activeLaser.normal) {
        normalVec.set(activeLaser.normal[0], activeLaser.normal[1], activeLaser.normal[2]).normalize();
        ringMesh.position.set(px + normalVec.x * 0.02, py + normalVec.y * 0.02, pz + normalVec.z * 0.02);
        ringMesh.quaternion.setFromUnitVectors(zAxis, normalVec);
      } else {
        ringMesh.position.set(px, py + 0.02, pz);
        ringMesh.rotation.set(-Math.PI / 2, 0, 0);
      }

      const pulse = 1 + 0.35 * Math.sin(nowMs * 0.01);
      ringMesh.scale.set(pulse, pulse, 1);
      ringMat.opacity = 0.5 + 0.35 * Math.cos(nowMs * 0.01);

      sprite.position.set(px, py + 0.48, pz);

      const beamAttr = beamGeo.attributes.position as THREE.BufferAttribute;
      beamAttr.setXYZ(0, camera.position.x * 0.72 + px * 0.28, camera.position.y * 0.88 + 0.35, camera.position.z * 0.72 + pz * 0.28);
      beamAttr.setXYZ(1, px, py, pz);
      beamAttr.needsUpdate = true;
    } else {
      laserGroup.visible = false;
    }

    if (
      state.remoteTeacherCameraSync &&
      state.remoteTeacherCameraSync.enabled &&
      state.followTeacherCamera &&
      !state.teacherCameraSyncEnabled
    ) {
      const sync = state.remoteTeacherCameraSync;
      desiredCamPos.set(sync.position[0], sync.position[1], sync.position[2]);
      desiredCamTarget.set(sync.target[0], sync.target[1], sync.target[2]);
      if (
        camera.position.distanceToSquared(desiredCamPos) > 1e-4 ||
        controls.target.distanceToSquared(desiredCamTarget) > 1e-4
      ) {
        isApplyingTeacherCam = true;
        camera.position.lerp(desiredCamPos, 0.14);
        controls.target.lerp(desiredCamTarget, 0.14);
        controls.update();
        isApplyingTeacherCam = false;
      }
    }
  };

  const dispose = () => {
    domElement.removeEventListener('pointermove', handlePointerMove);
    domElement.removeEventListener('pointerleave', handlePointerLeave);
    controls.removeEventListener('change', handleControlsChange);
    unsubStore();

    dotGeo.dispose();
    dotMat.dispose();
    ringGeo.dispose();
    ringMat.dispose();
    beamGeo.dispose();
    beamMat.dispose();
    badge.texture.dispose();
    spriteMat.dispose();
    scene.remove(laserGroup);
  };

  return { tick, dispose };
}
