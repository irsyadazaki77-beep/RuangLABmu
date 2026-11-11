import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  checkImmersiveVRSupport,
  enableWebXRRenderer,
  setupVRControllersAndLaserPointers,
  toggleImmersiveVRSession,
  getWebXRState,
} from './webXRStudioAdapter';
import {
  evaluateVADFrame,
  cleanSpeechTextForLocale,
  selectPreferredTTSVoice,
  aiVoiceAssistant,
} from '../services/aiVoiceAssistant';

describe('Fase 1: Immersive WebXR Adapter & Full-Duplex AI Voice Assistant', () => {
  it('TUGAS 1: checkImmersiveVRSupport degrades gracefully via progressive enhancement when hardware XR is absent', async () => {
    const supported = await checkImmersiveVRSupport();
    assert.strictEqual(typeof supported, 'boolean');
    const state = getWebXRState();
    assert.strictEqual(state.isProgressiveVRAvailable, true);
  });

  it('TUGAS 1: enableWebXRRenderer enables renderer.xr.enabled and setupVRControllersAndLaserPointers raycasts 3D apparatus', () => {
    let refSpace: string | null = null;
    const mockRenderer = {
      xr: {
        enabled: false,
        isPresenting: false,
        setReferenceSpaceType: (type: string) => {
          refSpace = type;
        },
        getController: (idx: number) => {
          const g = new THREE.Group();
          g.name = `mock-xr-ctrl-${idx}`;
          return g;
        },
      },
    } as unknown as THREE.WebGLRenderer;

    enableWebXRRenderer(mockRenderer, 'local-floor');
    assert.strictEqual(mockRenderer.xr.enabled, true);
    assert.strictEqual(refSpace, 'local-floor');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 100);
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 1.5, 0);
    camera.updateMatrixWorld(true);

    // Add a 3D lab apparatus mesh directly in front of the right spatial laser pointer
    const apparatusMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8 })
    );
    apparatusMesh.name = 'Balok_Bidang_Miring_3D';
    apparatusMesh.position.set(0.4, 1.2, 1.5);
    apparatusMesh.updateMatrixWorld(true);
    scene.add(apparatusMesh);

    const rig = setupVRControllersAndLaserPointers(mockRenderer, scene, camera);
    assert.strictEqual(rig.controllerLeft.name, 'xr-controller-left');
    assert.strictEqual(rig.controllerRight.name, 'xr-controller-right');

    // Activate simulated spatial rig and verify raycast hits the 3D apparatus
    rig.setSimulatedRigVisible(true);
    const hit = rig.updateSpatialRaycasters();
    assert.ok(hit, 'Expected spatial controller raycaster to intersect 3D lab apparatus');
    assert.strictEqual(hit?.objectName, 'Balok_Bidang_Miring_3D');

    rig.dispose();
  });

  it('TUGAS 1: toggleImmersiveVRSession toggles spatial VR mode on and off cleanly', async () => {
    const activeState = await toggleImmersiveVRSession();
    assert.strictEqual(activeState.isSessionActive, true);
    assert.strictEqual(activeState.sessionMode, 'spatial-laser-rig');

    const exitedState = await toggleImmersiveVRSession();
    assert.strictEqual(exitedState.isSessionActive, false);
    assert.strictEqual(exitedState.sessionMode, 'none');
  });

  it('TUGAS 2: evaluateVADFrame prevents audio feedback loops when Dr. LabMu is speaking', () => {
    // When Dr. LabMu is speaking, microphone capture is strictly blocked regardless of RMS energy
    const blockedFrame = evaluateVADFrame(0.35, true);
    assert.strictEqual(blockedFrame.shouldCaptureAudio, false);
    assert.strictEqual(blockedFrame.isSpeechDetected, false);
    assert.strictEqual(blockedFrame.normalizedLevel, 0);

    // When Dr. LabMu is silent and student speaks above threshold, VAD triggers speech detection
    const speakingFrame = evaluateVADFrame(0.12, false);
    assert.strictEqual(speakingFrame.shouldCaptureAudio, true);
    assert.strictEqual(speakingFrame.isSpeechDetected, true);
    assert.ok(speakingFrame.normalizedLevel > 0.5);
  });

  it('TUGAS 2: cleanSpeechTextForLocale and selectPreferredTTSVoice support both id-ID and en-US', () => {
    const idCleaned = cleanSpeechTextForLocale(
      'Nilai **R²** = 0.992 dengan ΔT = 25°C dan a = 9.8 m/s²',
      'id-ID'
    );
    assert.ok(idCleaned.includes('R kuadrat'));
    assert.ok(idCleaned.includes('derajat Celsius'));
    assert.ok(idCleaned.includes('meter per detik kuadrat'));

    const enCleaned = cleanSpeechTextForLocale(
      'Value **R²** = 0.992 with ΔT = 25°C and a = 9.8 m/s²',
      'en-US'
    );
    assert.ok(enCleaned.includes('R squared'));
    assert.ok(enCleaned.includes('degrees Celsius'));
    assert.ok(enCleaned.includes('meters per second squared'));

    const mockVoices = [
      { name: 'English US Default', lang: 'en-US', default: true },
      { name: 'Google Bahasa Indonesia Natural', lang: 'id-ID', default: false },
    ] as unknown as SpeechSynthesisVoice[];

    const chosenId = selectPreferredTTSVoice(mockVoices, 'id-ID');
    assert.strictEqual(chosenId?.lang, 'id-ID');

    const chosenEn = selectPreferredTTSVoice(mockVoices, 'en-US');
    assert.strictEqual(chosenEn?.lang, 'en-US');
  });

  it('TUGAS 2: aiVoiceAssistant processes spoken prompt and mutes mic during TTS playback', async () => {
    aiVoiceAssistant.setLocale('id-ID');
    const reply = await aiVoiceAssistant.handleUserSpokenPrompt(
      'Dok, bagaimana pengaruh gaya dorong terhadap percepatan balok?'
    );
    assert.ok(reply.length > 10);

    const stateWhileSpeaking = aiVoiceAssistant.getState();
    assert.strictEqual(stateWhileSpeaking.status, 'speaking');
    assert.strictEqual(stateWhileSpeaking.isMicMutedForTTS, true);
    assert.strictEqual(
      stateWhileSpeaking.lastUserTranscript,
      'Dok, bagaimana pengaruh gaya dorong terhadap percepatan balok?'
    );

    aiVoiceAssistant.stopFullDuplexSession();
  });
});
