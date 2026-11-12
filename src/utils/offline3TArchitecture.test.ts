import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptiveFpsMonitor } from './threeStudioKit';
import {
  generateOfflineSocraticMentorResponse,
  detectOfflineAnomalies,
} from './offlineDrLabMuEngine';
import {
  createOfflinePacket,
  verifyAndParseRlabPacket,
  convertPacketToSubmission,
  computePacketChecksum,
} from './offlinePacketProtocol';
import os from 'os';

describe('3T-Ready Architecture: Pillar 1 - Adaptive FPS Monitor & Lite Mode', () => {
  it('creates an adaptive FPS monitor and calculates normal FPS without triggering low-FPS alert', () => {
    let alertTriggered = false;
    let reportedFps = 0;

    const monitor = createAdaptiveFpsMonitor(
      (fps) => {
        alertTriggered = true;
        reportedFps = fps;
      },
      25,
      1000
    );

    // Simulate 60 FPS (approx 16.6ms intervals) over 1200ms
    let simTime = 1000;
    for (let i = 0; i < 70; i++) {
      monitor.recordFrame(simTime);
      simTime += 16.6;
    }

    assert.equal(alertTriggered, false, '60 FPS simulation should not trigger low FPS alert');
  });

  it('detects low FPS (< 25 FPS) over sample window and fires callback', () => {
    let alertTriggered = false;
    let reportedFps = 0;

    const monitor = createAdaptiveFpsMonitor(
      (fps) => {
        alertTriggered = true;
        reportedFps = fps;
      },
      25,
      1000
    );

    // Simulate 15 FPS (approx 66.6ms intervals) over 1200ms
    let simTime = 1000;
    for (let i = 0; i < 20; i++) {
      monitor.recordFrame(simTime);
      simTime += 66.6;
    }

    assert.equal(alertTriggered, true, 'Low FPS should trigger callback');
    assert.ok(reportedFps < 25, 'Reported FPS should be below threshold 25');
  });
});

describe('3T-Ready Architecture: Pillar 2 - Local Socratic Offline Dr. LabMu Engine', () => {
  it('detects anomalies when regression R² is below 0.85 and identifies outlier row index', () => {
    const telemetryContext = {
      domain: 'Fisika' as const,
      topic: 'Bandul Matematis',
      educationLevel: 'SMA',
      currentParameters: { lengthM: 1.2 },
      recordedData: [
        { run: 1, x: 1, y: 2.0 },
        { run: 2, x: 2, y: 4.0 },
        { run: 3, x: 3, y: 6.0 },
        { run: 4, x: 4, y: 25.0 }, // Outlier jump
      ],
      analytics: {
        rSquared: 0.71,
        slope: 3.5,
        intercept: 0.2,
      },
      studentQuery: 'Kenapa grafik saya melompat jauh?',
    };

    const anomaly = detectOfflineAnomalies(telemetryContext);
    assert.equal(anomaly.hasAnomaly, true);
    assert.equal(anomaly.type, 'low-r2');
    assert.equal(anomaly.outlierRowIndex, 4);

    const response = generateOfflineSocraticMentorResponse(telemetryContext);
    assert.equal(response.detectedTrigger, 'anomaly-outlier');
    assert.ok(response.observation.includes('R² = 0.710'));
    assert.ok(response.dataHighlight.includes('ayunan'));
    assert.ok(response.formattedText.includes('💡 Pertanyaan Pemantik:'));
  });

  it('provides warm domain-specific local wisdom advice for chemistry without internet', () => {
    const telemetryContext = {
      domain: 'Kimia' as const,
      topic: 'Titrasi Asam Basa',
      educationLevel: 'SMA',
      currentParameters: { titrantMolarity: 0.1 },
      recordedData: [
        { run: 1, x: 10, y: 3.0 },
        { run: 2, x: 20, y: 7.0 },
        { run: 3, x: 25, y: 11.5 },
      ],
      analytics: {
        rSquared: 0.99,
        slope: 0.8,
        intercept: -1.0,
      },
      studentQuery: 'Bagaimana mengetahui titik ekivalen asam basa?',
    };

    const response = generateOfflineSocraticMentorResponse(telemetryContext);
    assert.ok(
      response.formattedText.toLowerCase().includes('jeruk nipis') ||
      response.formattedText.toLowerCase().includes('kapur sirih')
    );
    assert.ok(
      response.socraticQuestion.toLowerCase().includes('titran') ||
      response.socraticQuestion.toLowerCase().includes('volume')
    );
  });

  it('provides cultural Indonesian celestial wisdom for astronomy (Waluku & Crux Pari)', () => {
    const telemetryContext = {
      domain: 'Astronomi' as const,
      topic: 'Orbit Planet & Langit Malam',
      educationLevel: 'SMA',
      currentParameters: { semiMajorAxisAU: 1.0 },
      recordedData: [
        { run: 1, x: 1, y: 1 },
        { run: 2, x: 4, y: 8 },
        { run: 3, x: 9, y: 27 },
      ],
      analytics: {
        rSquared: 0.999,
        slope: 1.0,
        intercept: 0.0,
      },
      studentQuery: 'Ceritakan tentang rasi bintang waluku dan penunjuk arah nelayan',
    };

    const response = generateOfflineSocraticMentorResponse(telemetryContext);
    assert.ok(response.formattedText.includes('Waluku') || response.formattedText.includes('Pari'));
    assert.ok(response.formattedText.includes('Pranata Mangsa') || response.formattedText.includes('selatan'));
  });
});

describe('3T-Ready Architecture: Pillar 3 - Offline .rlab Packet Protocol', () => {
  it('creates a cryptographically hashed .rlab packet with valid integrity', () => {
    const packet = createOfflinePacket({
      studentName: 'Wayan Sudirman',
      studentId: 'NIS-8821',
      roomId: 'LAB-BALI-3T',
      domain: 'Kimia',
      moduleId: 'titrasi-asam-basa',
      submittedAt: '2026-11-12T04:00:00.000Z',
      hypothesisText: 'Titik ekivalen terjadi pada pH 7 ketika mol asam sama dengan mol basa.',
      observationData: [
        { x: 10, y: 3.2 },
        { x: 20, y: 7.0 },
        { x: 25, y: 11.2 },
      ],
      regressionMetrics: {
        rSquared: 0.985,
        slope: 0.52,
        equation: 'pH = 0.52 * V + 1.2',
      },
      quizAnswers: [
        { questionId: 'q1', selectedAnswer: 2, isCorrect: true },
        { questionId: 'q2', selectedAnswer: 0, isCorrect: true },
      ],
      quizScore: 95,
      conclusionText: 'Konsentrasi sampel terbukti 0.102 M dengan akurasi 98%.',
    });

    assert.equal(packet.format, 'RLAB_OFFLINE_PACKET');
    assert.equal(packet.studentName, 'Wayan Sudirman');
    assert.equal(packet.quizScore, 95);
    assert.ok(packet.integrityChecksum.startsWith('RLAB-'), 'Checksum must start with RLAB-');

    const jsonString = JSON.stringify(packet, null, 2);
    const parsed = verifyAndParseRlabPacket(jsonString);

    assert.equal(parsed.valid, true);
    assert.ok(parsed.packet !== undefined);
    assert.equal(parsed.packet?.studentName, 'Wayan Sudirman');
  });

  it('detects tampering or corruption in .rlab packet checksum', () => {
    const packet = createOfflinePacket({
      studentName: 'Wayan Sudirman',
      studentId: 'NIS-8821',
      domain: 'Kimia',
      moduleId: 'titrasi-asam-basa',
      submittedAt: '2026-11-12T04:00:00.000Z',
      hypothesisText: 'Hipotesis awal...',
      observationData: [{ x: 1, y: 2 }],
      regressionMetrics: { rSquared: 0.99, slope: 1, equation: 'y=x' },
      quizAnswers: [],
      quizScore: 80,
      conclusionText: 'Kesimpulan...',
    });

    // Tamper with score without updating checksum
    packet.quizScore = 100;
    const tamperedJson = JSON.stringify(packet);
    const result = verifyAndParseRlabPacket(tamperedJson);

    assert.equal(result.valid, false, 'Tampered packet must fail integrity check');
    assert.ok(result.error?.includes('Integritas berkas tidak lolos'));
  });

  it('converts verified packet into gradebook submission format', () => {
    const packet = createOfflinePacket({
      studentName: 'Wayan Sudirman',
      studentId: 'NIS-8821',
      roomId: 'LAB-BALI-3T',
      domain: 'Kimia',
      moduleId: 'titrasi-asam-basa',
      submittedAt: '2026-11-12T04:00:00.000Z',
      hypothesisText: 'Hipotesis awal...',
      observationData: [{ x: 1, y: 2 }],
      regressionMetrics: { rSquared: 0.99, slope: 1, equation: 'y=x' },
      quizAnswers: [],
      quizScore: 92,
      conclusionText: 'Kesimpulan tuntas.',
    });

    const sub = convertPacketToSubmission(packet);
    assert.equal(sub.studentName, 'Wayan Sudirman');
    assert.equal(sub.quizScore, 92);
    assert.equal(sub.domain, 'Kimia');
    assert.equal(sub.moduleId, 'titrasi-asam-basa');
  });
});

describe('3T-Ready Architecture: Pillar 5 - LAN Hotspot Network Interface Detection', () => {
  it('detects system IPv4 network interfaces safely without crashing', () => {
    const interfaces = os.networkInterfaces();
    assert.ok(typeof interfaces === 'object', 'Interfaces must be an object');

    let candidateIp = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          candidateIp = net.address;
          break;
        }
      }
    }
    assert.ok(typeof candidateIp === 'string', 'Candidate IP must be string');
    assert.ok(candidateIp.includes('.'), 'Candidate IP should be IPv4 dot notation');
  });
});
