import { LabSubmission } from '../types/submissionTypes';

export interface RuangLabMuOfflinePacket {
  version: '1.0';
  format: 'RLAB_OFFLINE_PACKET';
  packetId: string;
  studentName: string;
  studentId?: string;
  roomId?: string;
  domain: string;
  moduleId: string;
  submittedAt: string;
  hypothesisText: string;
  observationData: Array<Record<string, number | string>>;
  regressionMetrics: {
    rSquared: number;
    slope: number;
    equation: string;
  };
  quizAnswers: Array<{
    questionId: string;
    selectedAnswer: number | string;
    isCorrect: boolean;
  }>;
  quizScore: number;
  conclusionText: string;
  telemetryLog?: any[];
  integrityChecksum: string;
}

/**
 * Calculates a deterministic anti-tamper checksum for the packet payload.
 */
export function computePacketChecksum(payload: Omit<RuangLabMuOfflinePacket, 'integrityChecksum'>): string {
  const content = [
    payload.packetId,
    payload.studentName,
    payload.studentId || '',
    payload.domain,
    payload.moduleId,
    payload.submittedAt,
    payload.quizScore,
    payload.regressionMetrics.rSquared.toFixed(4),
    payload.observationData.length,
    payload.conclusionText.length,
  ].join('|');

  let hash = 5381;
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `RLAB-${hex.toUpperCase()}`;
}

/**
 * Creates a signed .rlab offline assignment packet.
 */
export function createOfflinePacket(
  params: Omit<RuangLabMuOfflinePacket, 'version' | 'format' | 'packetId' | 'integrityChecksum'> & {
    packetId?: string;
  }
): RuangLabMuOfflinePacket {
  const packetId = params.packetId || `RLAB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const partial: Omit<RuangLabMuOfflinePacket, 'integrityChecksum'> = {
    version: '1.0',
    format: 'RLAB_OFFLINE_PACKET',
    packetId,
    studentName: params.studentName || 'Siswa Praktikan',
    studentId: params.studentId || 'KLP-01',
    roomId: params.roomId || 'LAB-3T',
    domain: params.domain || 'Fisika',
    moduleId: params.moduleId || 'lab-experiment',
    submittedAt: params.submittedAt || new Date().toISOString(),
    hypothesisText: params.hypothesisText || '',
    observationData: params.observationData || [],
    regressionMetrics: params.regressionMetrics || {
      rSquared: 0,
      slope: 0,
      equation: 'y = 0x + 0',
    },
    quizAnswers: params.quizAnswers || [],
    quizScore: params.quizScore ?? 100,
    conclusionText: params.conclusionText || '',
    telemetryLog: params.telemetryLog || [],
  };

  const integrityChecksum = computePacketChecksum(partial);
  return {
    ...partial,
    integrityChecksum,
  };
}

/**
 * Generates and downloads a `.rlab` file on the client's browser.
 */
export function downloadOfflineRlabPacket(packet: RuangLabMuOfflinePacket): void {
  if (typeof document === 'undefined') return;

  const jsonStr = JSON.stringify(packet, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeName = packet.studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeMod = packet.moduleId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeName}_${safeMod}_TugasLuring.rlab`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates, checks integrity, and parses a `.rlab` file string.
 */
export function verifyAndParseRlabPacket(fileContent: string): {
  valid: boolean;
  packet?: RuangLabMuOfflinePacket;
  error?: string;
} {
  try {
    const raw = JSON.parse(fileContent);
    if (!raw || typeof raw !== 'object') {
      return { valid: false, error: 'Berkas bukan format JSON yang valid.' };
    }

    if (raw.format !== 'RLAB_OFFLINE_PACKET') {
      return { valid: false, error: 'Bukan berkas resmi RuangLABmu (.rlab).' };
    }

    const { integrityChecksum, ...rest } = raw;
    if (!integrityChecksum) {
      return { valid: false, error: 'Berkas tidak memiliki checksum integritas anti-tamper.' };
    }

    const expectedChecksum = computePacketChecksum(rest);
    if (integrityChecksum !== expectedChecksum) {
      return {
        valid: false,
        error: `Integritas berkas tidak lolos verifikasi (checksum terdeteksi diubah).`,
      };
    }

    return {
      valid: true,
      packet: raw as RuangLabMuOfflinePacket,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Gagal membaca berkas: ${err?.message || 'Format tidak valid'}`,
    };
  }
}

/**
 * Converts a verified `.rlab` packet into a standard `LabSubmission` for the teacher's Gradebook.
 */
export function convertPacketToSubmission(packet: RuangLabMuOfflinePacket): LabSubmission {
  return {
    id: packet.packetId,
    studentName: packet.studentName,
    studentId: packet.studentId,
    roomId: packet.roomId,
    domain: packet.domain,
    moduleId: packet.moduleId,
    submittedAt: packet.submittedAt,
    hypothesisText: packet.hypothesisText,
    observationData: packet.observationData,
    regressionMetrics: packet.regressionMetrics,
    quizAnswers: packet.quizAnswers,
    quizScore: packet.quizScore,
    conclusionText: packet.conclusionText,
    telemetryLog: packet.telemetryLog,
  };
}
