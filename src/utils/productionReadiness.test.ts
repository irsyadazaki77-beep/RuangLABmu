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
import {
  generateDeterministicCustomMission,
  normalizeCustomMissionPayload,
} from './collabProtocol';
import {
  saveLastOpenedModuleId,
  loadLastOpenedModuleId,
  claimDailyLabChallengeXP,
  resetGamificationProfile,
  XP_REWARDS,
} from '../services/gamificationEngine';

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

  it('AsyncSubmissionStore automatically creates an empty [] file when submissions.json does not exist at startup', async () => {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ruanglab-empty-init-'));
    const filePath = path.join(tmpDir, 'submissions.json');

    const store = new AsyncSubmissionStore<{ id: string }>(filePath, []);
    const initial = await store.init();
    assert.deepEqual(initial, []);

    const raw = await fs.promises.readFile(filePath, 'utf-8');
    assert.deepEqual(JSON.parse(raw), []);

    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('verifies Final Polish: index.html metadata/favicon, HTTP 429 handling, webglcontextrestored auto-recovery, and clean package.json dependencies', async () => {
    const root = process.cwd();

    // 1. index.html title, 4-domain meta description, and SVG favicons
    const indexHtml = await fs.promises.readFile(path.join(root, 'index.html'), 'utf-8');
    assert.ok(
      indexHtml.includes('RuangLABmu — Laboratorium Sains Virtual 3D') &&
        indexHtml.includes('Asisten Sokratik AI'),
      'index.html title and og:title must include RuangLABmu — Laboratorium Sains Virtual 3D & Asisten Sokratik AI'
    );
    assert.ok(
      indexHtml.includes('Fisika, Kimia, Biologi') && indexHtml.includes('Astronomi'),
      'index.html description must cover all 4 science domains'
    );
    assert.ok(
      indexHtml.includes('rel="icon" type="image/svg+xml" href="/pwa-192x192.svg"') &&
        indexHtml.includes('rel="apple-touch-icon" href="/pwa-192x192.svg"'),
      'index.html must include official /pwa-192x192.svg favicon and apple-touch-icon'
    );

    // 2. HTTP 429 friendly handling in useDrLabMuChat.ts and StudentWorksheetForm.tsx
    const chatHookSrc = await fs.promises.readFile(
      path.join(root, 'src/hooks/useDrLabMuChat.ts'),
      'utf-8'
    );
    const worksheetSrc = await fs.promises.readFile(
      path.join(root, 'src/components/analytics/StudentWorksheetForm.tsx'),
      'utf-8'
    );
    assert.ok(chatHookSrc.includes('res.status === 429') && chatHookSrc.includes('Retry-After'));
    assert.ok(worksheetSrc.includes('res.status === 429') && worksheetSrc.includes('Retry-After'));

    // 3. webglcontextrestored auto-recovery in LabErrorBoundary and all 4 *Scene3D.tsx
    const sceneFiles = [
      'src/components/common/LabErrorBoundary.tsx',
      'src/components/PhysicsScene3D.tsx',
      'src/components/ChemistryScene3D.tsx',
      'src/components/BiologyScene3D.tsx',
      'src/components/AstronomyScene3D.tsx',
    ];
    for (const relPath of sceneFiles) {
      const content = await fs.promises.readFile(path.join(root, relPath), 'utf-8');
      assert.ok(
        content.includes('webglcontextrestored') && content.includes('sceneKey'),
        `${relPath} must listen for webglcontextrestored and auto-recover via sceneKey`
      );
    }

    // 4. package.json separates build/typing packages into devDependencies
    const pkgJson = JSON.parse(
      await fs.promises.readFile(path.join(root, 'package.json'), 'utf-8')
    );
    const devOnlyPackages = [
      'vite',
      'typescript',
      'tsx',
      'esbuild',
      '@vitejs/plugin-react',
      '@tailwindcss/vite',
      '@types/node',
      '@types/express',
      '@types/ws',
      '@types/three',
    ];
    for (const pkg of devOnlyPackages) {
      assert.equal(
        pkg in (pkgJson.dependencies || {}),
        false,
        `${pkg} should not be in dependencies`
      );
      assert.equal(
        pkg in (pkgJson.devDependencies || {}),
        true,
        `${pkg} must be in devDependencies`
      );
    }
  });

  it('AI Custom Mission Builder generates structured JSON scenarios (Title, Narrative, Target Range, 3 Contextual LKS Questions)', () => {
    const titrationMission = generateDeterministicCustomMission({
      moduleId: 'acid-base-titration',
      caseStudyPrompt: 'Uji sampel air hujan di sekitar kawah gunung berapi dengan titrasi',
      teacherName: 'Dr. Hendra Kusuma',
      roomId: 'LAB-ALPHA',
    });

    assert.equal(titrationMission.moduleId, 'acid-base-titration');
    assert.equal(titrationMission.domain, 'chemistry');
    assert.equal(titrationMission.roomId, 'LAB-ALPHA');
    assert.ok(titrationMission.title.includes('Uji sampel air hujan'));
    assert.ok(titrationMission.narrative.includes('Dr. Hendra Kusuma'));
    assert.ok(
      titrationMission.targetVariable.minSuccessValue <=
        titrationMission.targetVariable.targetValue &&
        titrationMission.targetVariable.targetValue <=
          titrationMission.targetVariable.maxSuccessValue
    );
    assert.equal(titrationMission.contextualQuestions.length, 3);
    for (const q of titrationMission.contextualQuestions) {
      assert.ok(q.questionText.length > 10);
      assert.ok(q.expectedConceptOrValue.length > 5);
      assert.ok(q.hint.length > 5);
    }

    // Verify normalizeCustomMissionPayload normalizes Gemini JSON responses cleanly
    const normalized = normalizeCustomMissionPayload(
      {
        title: 'Investigasi Hujan Asam Vulkanik',
        narrative: 'Analisis derajat keasaman air hujan kawah vulkanik menggunakan titrasi NaOH.',
        targetVariable: {
          variableKey: 'currentPh',
          variableLabel: 'pH Ekuivalen',
          unit: 'pH',
          targetValue: 7.0,
          minSuccessValue: 6.85,
          maxSuccessValue: 7.15,
        },
        contextualQuestions: [
          {
            id: 'q1',
            questionText: 'Berapa volume NaOH pada titik ekuivalen?',
            expectedConceptOrValue: '25 mL',
            hint: 'Lihat lonjakan pH.',
          },
          {
            id: 'q2',
            questionText: 'Apa indikator terbaik untuk titrasi ini?',
            expectedConceptOrValue: 'Fenolftalein atau Bromtimol Biru',
            hint: 'Rentang pH sekitar 7-8.',
          },
          {
            id: 'q3',
            questionText: 'Bagaimana cara menghitung molaritas asam sampel?',
            expectedConceptOrValue: 'M_a * V_a = M_b * V_b',
            hint: 'Gunakan rumus stoikiometri netralisasi.',
          },
        ],
      },
      {
        moduleId: 'acid-base-titration',
        caseStudyPrompt: 'Uji sampel air hujan kawah',
        teacherName: 'Guru Kimia',
        roomId: 'LAB-VULKAN',
      },
      'gemini-api'
    );

    assert.equal(normalized.title, 'Investigasi Hujan Asam Vulkanik');
    assert.equal(normalized.roomId, 'LAB-VULKAN');
    assert.equal(normalized.contextualQuestions.length, 3);
    assert.equal(normalized.source, 'gemini-api');
  });

  it('Quick Start tracks last opened module and Daily Lab Challenge awards +250 XP bonus', () => {
    resetGamificationProfile();
    saveLastOpenedModuleId('pendulum-harmonic');
    assert.equal(loadLastOpenedModuleId(), 'pendulum-harmonic');

    assert.equal(XP_REWARDS.DAILY_CHALLENGE_BONUS, 250);
    const res = claimDailyLabChallengeXP(
      'solar-kepler',
      'Hukum Kepler & Tata Surya',
      '2026-11-11:solar-kepler'
    );
    assert.equal(res.xpDelta, 250);
    assert.equal(res.profile.xp, 250);

    // Duplicate claim on the same day seed does not double-award XP
    const duplicateRes = claimDailyLabChallengeXP(
      'solar-kepler',
      'Hukum Kepler & Tata Surya',
      '2026-11-11:solar-kepler'
    );
    assert.equal(duplicateRes.xpDelta, 0);
    assert.equal(duplicateRes.profile.xp, 250);
  });
});


