import * as THREE from 'three';
import { SpatialCursorPayload } from './collabProtocol';

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
