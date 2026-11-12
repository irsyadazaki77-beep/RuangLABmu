import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as THREE from 'three';
import {
  AsyncSubmissionStore,
  verifyTeacherAuthorization,
} from './submissionPersistence';
import { disposeThreeSceneResources } from './threeStudioKit';

describe('Production Readiness — Async Persistence, Security & WebGL Disposal', () => {
  it('AsyncSubmissionStore handles 15 concurrent student submissions atomically without data loss', async () => {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ruanglab-sub-test-'));
    const filePath = path.join(tmpDir, 'submissions.json');

    interface MockSub {
      id: string;
      studentName: string;
      score: number;
    }

    const store = new AsyncSubmissionStore<MockSub>(filePath, [
      { id: 'SEED-1', studentName: 'Alya', score: 95 },
    ]);
    await store.init();

    // Simulate 15 students submitting concurrently in the same tick
    const concurrentPromises = Array.from({ length: 15 }, (_, idx) =>
      store.upsert({
        id: `SUB-CONCURRENT-${idx + 1}`,
        studentName: `Siswa ${idx + 1}`,
        score: 80 + idx,
      })
    );

    await Promise.all(concurrentPromises);
    await store.flush();

    const onDiskRaw = await fs.promises.readFile(filePath, 'utf-8');
    const onDiskParsed = JSON.parse(onDiskRaw) as MockSub[];

    assert.equal(onDiskParsed.length, 16);
    assert.ok(onDiskParsed.some((s) => s.id === 'SEED-1'));
    for (let i = 1; i <= 15; i += 1) {
      assert.ok(
        onDiskParsed.some((s) => s.id === `SUB-CONCURRENT-${i}`),
        `Missing concurrent submission SUB-CONCURRENT-${i}`
      );
    }

    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('server.ts contains zero blocking fs.writeFileSync calls and .gitignore excludes data/submissions.json', async () => {
    const serverSource = await fs.promises.readFile(
      path.join(process.cwd(), 'server.ts'),
      'utf-8'
    );
    assert.equal(
      serverSource.includes('writeFileSync'),
      false,
      'server.ts must not contain blocking fs.writeFileSync calls'
    );

    const gitignoreSource = await fs.promises.readFile(
      path.join(process.cwd(), '.gitignore'),
      'utf-8'
    );
    assert.equal(
      gitignoreSource.includes('data/submissions.json'),
      true,
      '.gitignore must exclude data/submissions.json'
    );
  });

  it('verifyTeacherAuthorization blocks unverified teacher role claims and allows PIN-verified teachers', () => {
    // 1. Spoofed teacher claim without PIN or socket ownership -> rejected
    const spoofed = verifyTeacherAuthorization({
      socketId: 'sock-student-99',
      claimedRole: 'Pengajar',
      providedPin: '',
      roomPin: '4821',
      roomTeacherSocketId: 'sock-teacher-1',
    });
    assert.equal(spoofed.authorized, false);
    assert.equal(spoofed.effectiveRole, 'Praktikan');

    // 2. Valid room PIN -> authorized
    const roomPinValid = verifyTeacherAuthorization({
      socketId: 'sock-teacher-2',
      claimedRole: 'Pengajar',
      providedPin: '4821',
      roomPin: '4821',
      roomTeacherSocketId: 'sock-teacher-1',
    });
    assert.equal(roomPinValid.authorized, true);
    assert.equal(roomPinValid.effectiveRole, 'Pengajar');

    // 3. Matching roomTeacherSocketId -> authorized
    const ownerSocketValid = verifyTeacherAuthorization({
      socketId: 'sock-teacher-1',
      claimedRole: 'teacher',
      roomPin: '4821',
      roomTeacherSocketId: 'sock-teacher-1',
    });
    assert.equal(ownerSocketValid.authorized, true);
    assert.equal(ownerSocketValid.effectiveRole, 'Pengajar');
  });

  it('disposeThreeSceneResources disposes all geometries, materials, texture maps, and renderer', () => {
    const scene = new THREE.Scene();
    const geom1 = new THREE.BoxGeometry(1, 1, 1);
    const geom2 = new THREE.SphereGeometry(1, 8, 8);
    const texMap = new THREE.Texture();
    const normalMap = new THREE.Texture();
    const envTex = new THREE.Texture();

    let geom1Disposed = false;
    let geom2Disposed = false;
    let texMapDisposed = false;
    let normalMapDisposed = false;
    let envTexDisposed = false;
    let rendererDisposed = false;

    geom1.addEventListener('dispose', () => {
      geom1Disposed = true;
    });
    geom2.addEventListener('dispose', () => {
      geom2Disposed = true;
    });
    texMap.addEventListener('dispose', () => {
      texMapDisposed = true;
    });
    normalMap.addEventListener('dispose', () => {
      normalMapDisposed = true;
    });
    envTex.addEventListener('dispose', () => {
      envTexDisposed = true;
    });

    const mat1 = new THREE.MeshStandardMaterial({ map: texMap, normalMap });
    const mat2 = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    const mesh1 = new THREE.Mesh(geom1, mat1);
    const mesh2 = new THREE.Mesh(geom2, [mat1, mat2]);
    scene.add(mesh1, mesh2);

    const mockRenderer = {
      renderLists: { dispose: () => {} },
      dispose: () => {
        rendererDisposed = true;
      },
    } as unknown as THREE.WebGLRenderer;

    const stats = disposeThreeSceneResources(scene, mockRenderer, envTex);

    assert.equal(geom1Disposed, true);
    assert.equal(geom2Disposed, true);
    assert.equal(texMapDisposed, true);
    assert.equal(normalMapDisposed, true);
    assert.equal(envTexDisposed, true);
    assert.equal(rendererDisposed, true);
    assert.ok(stats.geometriesDisposed >= 2);
    assert.ok(stats.materialsDisposed >= 2);
    assert.ok(stats.texturesDisposed >= 3);
    assert.equal(scene.children.length, 0);
  });
});
