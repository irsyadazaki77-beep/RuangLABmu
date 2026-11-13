import { EducationTier, ScienceDomain } from '../registry/experimentRegistry';

export interface LabSafetyLicense {
  licenseId: string;
  moduleId: string;
  moduleTitle: string;
  domain: ScienceDomain | string;
  studentName: string;
  studentGroup: string;
  tier: EducationTier;
  k3Complied: boolean;
  preLabQuizScorePct: number;
  issuedAtIso: string;
  issuedAtFormatted: string;
  status: 'TERVERIFIKASI' | 'BELUM_MEMENUHI_SYARAT';
}

export const SIM_LAB_STORAGE_KEY = 'ruanglab:sim_lab_licenses';
export const MIN_PASSING_PRELAB_SCORE = 75;

let memoryLicenseMap: Record<string, LabSafetyLicense> = {};

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function loadAllLabSafetyLicenses(): Record<string, LabSafetyLicense> {
  if (!hasLocalStorage()) {
    return { ...memoryLicenseMap };
  }
  try {
    const raw = window.localStorage.getItem(SIM_LAB_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAllLabSafetyLicenses(
  licenses: Record<string, LabSafetyLicense>
): void {
  memoryLicenseMap = { ...licenses };
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(SIM_LAB_STORAGE_KEY, JSON.stringify(licenses));
  } catch {
    // ignore storage quota error
  }
}

export function getLabSafetyLicenseForModule(
  moduleId: string
): LabSafetyLicense | null {
  const all = loadAllLabSafetyLicenses();
  return all[moduleId] || null;
}

export function generateDeterministicLicenseCode(
  moduleId: string,
  studentName: string
): string {
  const seed = `${moduleId}|${studentName}`.toUpperCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 99999;
  }
  const year = new Date().getFullYear();
  const suffix = String(Math.abs(hash)).padStart(5, '0');
  return `RLM-SIM-${year}-${suffix}`;
}

export function issueOrUpdateLabSafetyLicense(params: {
  moduleId: string;
  moduleTitle: string;
  domain: string;
  studentName: string;
  studentGroup: string;
  tier: EducationTier;
  k3Complied: boolean;
  preLabQuizScorePct: number;
}): LabSafetyLicense {
  const {
    moduleId,
    moduleTitle,
    domain,
    studentName,
    studentGroup,
    tier,
    k3Complied,
    preLabQuizScorePct,
  } = params;

  const isVerified = k3Complied && preLabQuizScorePct >= MIN_PASSING_PRELAB_SCORE;
  const now = new Date();

  const license: LabSafetyLicense = {
    licenseId: generateDeterministicLicenseCode(moduleId, studentName),
    moduleId,
    moduleTitle,
    domain,
    studentName,
    studentGroup,
    tier,
    k3Complied,
    preLabQuizScorePct,
    issuedAtIso: now.toISOString(),
    issuedAtFormatted: now.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: isVerified ? 'TERVERIFIKASI' : 'BELUM_MEMENUHI_SYARAT',
  };

  const all = loadAllLabSafetyLicenses();
  all[moduleId] = license;
  saveAllLabSafetyLicenses(all);

  return license;
}

export function buildLicenseVerificationText(license: LabSafetyLicense): string {
  return JSON.stringify({
    app: 'RuangLABmu SIM-Lab Verifier',
    id: license.licenseId,
    praktikan: license.studentName,
    kelompok: license.studentGroup,
    modul: license.moduleId,
    skorKuis: `${license.preLabQuizScorePct}%`,
    k3: license.k3Complied,
    status: license.status,
    terbit: license.issuedAtIso,
  });
}
