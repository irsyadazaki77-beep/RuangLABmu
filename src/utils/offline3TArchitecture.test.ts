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

  it('ignores frame samples when deltaMs > 250 (tab switch or browser minimize) without triggering false-positive low FPS', () => {
    let alertTriggered = false;

    const monitor = createAdaptiveFpsMonitor(
      () => {
        alertTriggered = true;
      },
      25,
      1000
    );

    let simTime = 1000;
    // 30 normal 60fps frames (16.6ms intervals)
    for (let i = 0; i < 30; i++) {
      monitor.recordFrame(simTime);
      simTime += 16.6;
    }

    // Student switches tab or minimizes browser: deltaMs = 3000ms!
    simTime += 3000;
    monitor.recordFrame(simTime);

    // Frame after returning: 16.6ms intervals
    for (let i = 0; i < 30; i++) {
      simTime += 16.6;
      monitor.recordFrame(simTime);
    }

    assert.equal(alertTriggered, false, 'Tab switch delta (> 250ms) must NOT trigger low-FPS false positive');
  });

  it('resetMonitor() successfully resets triggered state and accumulator', () => {
    let triggeredCount = 0;

    const monitor = createAdaptiveFpsMonitor(
      () => {
        triggeredCount += 1;
      },
      25,
      500
    );

    let simTime = 1000;
    // Simulate low FPS (80ms intervals = ~12.5 FPS)
    for (let i = 0; i < 10; i++) {
      monitor.recordFrame(simTime);
      simTime += 80;
    }

    assert.equal(triggeredCount, 1, 'Should trigger once');
    assert.equal(monitor.isTriggered(), true);

    // Reset monitor manually (e.g. user toggles lite mode off)
    monitor.resetMonitor();
    assert.equal(monitor.isTriggered(), false);

    // Simulate normal 60 FPS
    simTime += 16.6;
    for (let i = 0; i < 50; i++) {
      monitor.recordFrame(simTime);
      simTime += 16.6;
    }
    assert.equal(triggeredCount, 1, 'Normal FPS after reset should not trigger again');
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

  it('protects against NaN / Infinity when data rows < 2 and guides student to record at least 3 points', () => {
    const telemetryContext = {
      domain: 'Fisika' as const,
      topic: 'Hukum II Newton & Bidang Miring',
      educationLevel: 'SMA',
      currentParameters: { appliedForce: 15 },
      recordedData: [
        { run: 1, x: 15, y: 2.5 },
      ],
      analytics: {
        rSquared: NaN,
        slope: NaN,
        intercept: NaN,
      },
      studentQuery: 'Bagaimana tren grafik saya?',
    };

    const response = generateOfflineSocraticMentorResponse(telemetryContext);
    assert.equal(response.formattedText.includes('NaN'), false, 'Response must never contain string NaN');
    assert.equal(response.formattedText.includes('Infinity'), false, 'Response must never contain string Infinity');
    assert.ok(
      response.socraticQuestion.toLowerCase().includes('3 titik') ||
      response.socraticQuestion.toLowerCase().includes('minimal 3') ||
      response.formattedText.toLowerCase().includes('variasikan'),
      'Must guide student to record at least 3 points'
    );
  });

  it('protects against NaN / Infinity when independent variable variance Delta X === 0', () => {
    const telemetryContext = {
      domain: 'Kimia' as const,
      topic: 'Kinetika Reaksi & Suhu',
      educationLevel: 'SMA',
      currentParameters: { temperature: 300 },
      recordedData: [
        { run: 1, x: 25, y: 0.12 },
        { run: 2, x: 25, y: 0.13 },
        { run: 3, x: 25, y: 0.11 }, // All x are identical 25 (Delta X = 0)
      ],
      analytics: {
        rSquared: NaN,
        slope: Infinity,
        intercept: -Infinity,
      },
      studentQuery: 'Kenapa grafik saya garis vertikal lurus?',
    };

    const response = generateOfflineSocraticMentorResponse(telemetryContext);
    assert.equal(response.formattedText.includes('NaN'), false, 'Must not output NaN');
    assert.equal(response.formattedText.includes('Infinity'), false, 'Must not output Infinity');
    assert.ok(
      response.formattedText.toLowerCase().includes('variabel bebas') ||
      response.formattedText.toLowerCase().includes('variasi'),
      'Must advise varying the independent variable'
    );
    assert.ok(
      response.socraticQuestion.toLowerCase().includes('3 titik') ||
      response.socraticQuestion.toLowerCase().includes('variasikan')
    );
  });

  it('protects against non-finite analytics (slope Infinity / r2 NaN) even with multiple rows', () => {
    const telemetryContext = {
      domain: 'Biologi' as const,
      topic: 'Laju Fotosintesis Ingenhousz',
      educationLevel: 'SMA',
      recordedData: [
        { run: 1, x: 10, y: 5 },
        { run: 2, x: 20, y: 15 },
        { run: 3, x: 30, y: 25 },
      ],
      analytics: {
        rSquared: NaN,
        slope: Infinity,
      },
      studentQuery: 'Apakah laju fotosintesis sudah tepat?',
    };

    const response = generateOfflineSocraticMentorResponse(telemetryContext);
    assert.equal(response.formattedText.includes('NaN'), false);
    assert.equal(response.formattedText.includes('Infinity'), false);
    assert.ok(response.observation.length > 0);
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

  it('filters out virtual interfaces (WSL, Docker, VirtualBox, vEthernet, VMware) and prioritizes 192.168. and 10.', () => {
    const mockInterfaces = {
      'docker0': [
        { address: '172.17.0.1', family: 'IPv4', internal: false },
      ],
      'vboxnet0': [
        { address: '192.168.56.1', family: 'IPv4', internal: false },
      ],
      'vEthernet (WSL)': [
        { address: '172.28.16.1', family: 'IPv4', internal: false },
      ],
      'wlan0': [
        { address: '192.168.43.1', family: 'IPv4', internal: false },
      ],
      'eth0': [
        { address: '10.0.0.15', family: 'IPv4', internal: false },
      ],
    } as any;

    const virtualPattern = /wsl|docker|vbox|vethernet|vmware|virtual/i;
    const candidates: string[] = [];

    for (const [ifaceName, ifaceList] of Object.entries(mockInterfaces as Record<string, any[]>)) {
      if (!ifaceList || virtualPattern.test(ifaceName)) {
        continue;
      }
      for (const iface of ifaceList) {
        if (iface.family === 'IPv4' && !iface.internal) {
          if (iface.address.startsWith('192.168.56.') || iface.address.startsWith('172.17.')) {
            continue;
          }
          candidates.push(iface.address);
        }
      }
    }

    const uniqueIps = Array.from(new Set(candidates));
    const getPriority = (ip: string): number => {
      if (ip.startsWith('192.168.')) return 100;
      if (ip.startsWith('10.')) return 90;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 50;
      return 10;
    };
    uniqueIps.sort((a, b) => getPriority(b) - getPriority(a));

    assert.equal(uniqueIps[0], '192.168.43.1', 'Primary IP must be the Wi-Fi/Hotspot subnet 192.168.43.1');
    assert.equal(uniqueIps[1], '10.0.0.15', 'Second priority IP must be 10.0.0.15');
    assert.equal(uniqueIps.includes('172.17.0.1'), false, 'docker0 must be ignored');
    assert.equal(uniqueIps.includes('192.168.56.1'), false, 'vboxnet0 must be ignored');
    assert.equal(uniqueIps.includes('172.28.16.1'), false, 'vEthernet (WSL) must be ignored');
  });
});
