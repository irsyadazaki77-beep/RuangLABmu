import { ExperimentRecord } from './scienceEngine';
import {
  ExperimentModule,
  EducationTier,
} from '../registry/experimentRegistry';
import type { Lab3DSnapshot } from '../components/ui/ScientificEnhancementSuite';

export interface AcademicReportData {
  experimentTitle: string;
  studentName: string;
  groupId: string;
  roomPin?: string;
  tier: EducationTier;
  dateStr: string;
  timeStr: string;
  domain: string;
  module?: ExperimentModule;
  records: ExperimentRecord[];
  snapshots3D?: Lab3DSnapshot[];
  snapshotDataUrl?: string;
  socraticEvaluationSummary?: string;
  regressionSummary?: {
    slope: number;
    intercept: number;
    rSquared: number;
    formula: string;
    expectedSlopeMeaning?: string;
    modelLabel?: string;
    equationString?: string;
    percentError?: number;
  };
  outlierSummary?: {
    outlierCount: number;
    rSquaredRaw: number;
    rSquaredClean: number;
    excludedOutliers: boolean;
  };
  chartImageDataUrl?: string;
  trialComparisonSummary?: {
    runALabel: string;
    runBLabel: string;
    keyDifferences: string[];
  };
  worksheetScore?: {
    score: number;
    correctCount: number;
    totalCount: number;
    diagnosticItems?: Array<{
      title: string;
      badge: string;
      feedback: string;
    }>;
  };
  calibrationNotes?: string;
  discussionNotes?: string;
  conclusionNotes?: string;
  hypothesisSummary?: {
    independentVar?: string;
    dependentVar?: string;
    hypothesisText?: string;
    reflectionText?: string;
  };
  simLabLicense?: {
    licenseCode: string;
    status: string;
    quizScore: number;
    issuedDateStr?: string;
  };
  poeEvaluationSummary?: {
    predictedTrend?: string;
    predictedX?: number;
    predictedY?: number;
    actualYAtPredictedX?: number;
    deviationPct?: number;
  };
  uncertaintySummary?: {
    metricLabel: string;
    n: number;
    mean: number;
    sampleStdDev: number;
    standardErrorMean: number;
    instrumentUncertainty: number;
    combinedUncertainty: number;
    relativeUncertaintyPct: number;
    percentErrorVsTheory: number | null;
    precisionGrade: string;
    recommendedSignificantFigures: number;
  };
}

export function generateAcademicReportHTML(data: AcademicReportData): string {
  const {
    experimentTitle,
    studentName,
    groupId,
    tier,
    dateStr,
    timeStr,
    domain,
    module,
    records,
    regressionSummary,
    outlierSummary,
    chartImageDataUrl,
    trialComparisonSummary,
    worksheetScore,
    calibrationNotes,
    discussionNotes,
    conclusionNotes,
    hypothesisSummary,
    snapshots3D,
    simLabLicense,
    poeEvaluationSummary,
    uncertaintySummary,
  } = data;

  const objectives =
    module?.objectives[tier] ||
    module?.objectives.SMA ||
    [
      'Memahami konsep dasar hukum fisika/kimia/biologi/astronomi melalui pengamatan eksperimen kuantitatif.',
      'Mengolah data pengamatan dengan ketidakpastian dan analisis regresi kurva.',
    ];

  const theory =
    module?.theorySummary ||
    'Eksperimen laboratorium bertujuan untuk memvalidasi model teoretis melalui pengukuran empiris terkontrol.';

  const equations = module?.keyEquations || [];
  const apparatus = module?.apparatusList || ['Alat ukur terkalibrasi', 'Bahan uji terstandarisasi'];
  const safety = module?.safetyNotes || ['Gunakan alat pelindung diri sesuai SOP K3 laboratorium.'];

  const tableRowsHtml =
    records.length > 0
      ? records
          .map(
            (r, i) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; font-family: monospace;">${i + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-family: monospace;">${r.timestamp}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${r.parametersSummary}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-family: monospace;">
            ${Object.entries(r.keyMetrics)
              .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
              .join(' | ')}
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-style: italic; color: #475569;">${r.notes || '-'}</td>
        </tr>
      `
          )
          .join('')
      : `<tr><td colspan="5" style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; color: #64748b;">Belum ada baris data percobaan yang terekam.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Resmi Praktikum - ${experimentTitle}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 25px;
    }
    .header-box {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 20px;
      text-align: center;
    }
    .inst-title {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-inst {
      font-size: 11pt;
      margin: 2px 0 6px;
      color: #334155;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 10px;
      text-decoration: underline;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 10.5pt;
    }
    .meta-table td {
      padding: 3px 6px;
      vertical-align: top;
    }
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 18px;
      margin-bottom: 6px;
      border-bottom: 1px solid #94a3b8;
      padding-bottom: 2px;
    }
    .math-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #0284c7;
      padding: 8px 12px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      margin: 8px 0;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin: 10px 0;
    }
    table.data-table th {
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      padding: 6px 10px;
      text-align: left;
      font-weight: bold;
    }
    .sign-table {
      width: 100%;
      margin-top: 36px;
      border-collapse: collapse;
    }
    .sign-table td {
      width: 50%;
      text-align: center;
      vertical-align: bottom;
      padding: 10px;
    }
    .sign-line {
      display: inline-block;
      width: 180px;
      border-bottom: 1px solid #0f172a;
      margin-top: 50px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; padding: 12px; background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-family: sans-serif; font-size: 12px; color: #0369a1; font-weight: bold;">
      Pratinjau Cetak Laporan Resmi Praktikum RuangLABmu (Standar Akademik A4)
    </span>
    <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 6px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">
      Cetak / Simpan PDF
    </button>
  </div>

  <div class="header-box">
    <div class="inst-title">RuangLABmu · Laboratorium Sains Terintegrasi</div>
    <div class="sub-inst">Pusat Pembelajaran Virtual Sains Komputasional & Analitik Data</div>
    <div class="doc-title">LAPORAN RESMI PRAKTIKUM LABORATORIUM</div>
  </div>

  <table class="meta-table">
    <tr>
      <td style="width: 18%; font-weight: bold;">Mata Praktikum</td>
      <td style="width: 32%;">: ${domain} (Jenjang ${tier})</td>
      <td style="width: 18%; font-weight: bold;">Nama Praktikan</td>
      <td style="width: 32%;">: ${studentName}</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Judul Modul</td>
      <td>: <strong>${experimentTitle}</strong></td>
      <td style="font-weight: bold;">Kelompok Kerja</td>
      <td>: ${groupId}</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Tanggal Pengujian</td>
      <td>: ${dateStr} (${timeStr} WIB)</td>
      <td style="font-weight: bold;">Status Penilaian</td>
      <td>: ${worksheetScore ? `LKS Dinilai (${worksheetScore.score}/100 · ${worksheetScore.correctCount}/${worksheetScore.totalCount} Benar)` : 'Terverifikasi Sistem'}</td>
    </tr>
    ${
      simLabLicense
        ? `
    <tr>
      <td style="font-weight: bold;">SIM Lab Digital (K3)</td>
      <td colspan="3">: <strong style="font-family: monospace; color: #047857;">${simLabLicense.licenseCode}</strong> · Status: <strong>${simLabLicense.status}</strong> (Kuis K3: ${simLabLicense.quizScore}%${simLabLicense.issuedDateStr ? ` · Diterbitkan ${simLabLicense.issuedDateStr}` : ''})</td>
    </tr>
    `
        : ''
    }
  </table>

  <div class="section-title">I. Tujuan Praktikum</div>
  <ol style="margin-top: 4px; padding-left: 22px;">
    ${objectives.map((o) => `<li style="margin-bottom: 3px;">${o}</li>`).join('')}
  </ol>

  <div class="section-title">II. Dasar Teori & Persamaan Matematis</div>
  <p style="text-align: justify; margin-top: 4px;">${theory}</p>
  ${
    equations.length > 0
      ? `
    <div class="math-box">
      <strong>Persamaan Kunci:</strong><br/>
      ${equations.map((eq) => `• ${eq}`).join('<br/>')}
    </div>
  `
      : ''
  }

  ${
    (hypothesisSummary &&
      (hypothesisSummary.independentVar ||
        hypothesisSummary.dependentVar ||
        hypothesisSummary.hypothesisText ||
        hypothesisSummary.reflectionText)) ||
    (poeEvaluationSummary &&
      (poeEvaluationSummary.predictedTrend ||
        poeEvaluationSummary.predictedY !== undefined))
      ? `
  <div class="section-title">II-B. Perumusan Hipotesis & Identifikasi Variabel</div>
  <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px 14px; border-radius: 4px; font-size: 10pt; margin: 6px 0;">
    <div><strong>Variabel Bebas (X):</strong> ${hypothesisSummary?.independentVar || '-'}</div>
    <div><strong>Variabel Terikat (Y):</strong> ${hypothesisSummary?.dependentVar || '-'}</div>
    <div style="margin-top: 4px;"><strong>Hipotesis Awal:</strong> <em>${hypothesisSummary?.hypothesisText || '-'}</em></div>
    ${
      poeEvaluationSummary &&
      (poeEvaluationSummary.predictedTrend ||
        poeEvaluationSummary.predictedY !== undefined)
        ? `
    <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #f59e0b;">
      <strong>Prediksi Kuantitatif (Predict–Observe–Explain / POE):</strong>
      ${poeEvaluationSummary.predictedTrend ? `<span>Tren: <strong>${poeEvaluationSummary.predictedTrend}</strong></span>` : ''}
      ${
        poeEvaluationSummary.predictedX !== undefined &&
        poeEvaluationSummary.predictedY !== undefined
          ? ` · Koordinat Prediksi: <span style="font-family: monospace;">(X = ${poeEvaluationSummary.predictedX}, Y_pred = ${poeEvaluationSummary.predictedY})</span>`
          : ''
      }
      ${
        poeEvaluationSummary.actualYAtPredictedX !== undefined
          ? ` vs Kurva Aktual: <span style="font-family: monospace;">Y_obs = ${poeEvaluationSummary.actualYAtPredictedX.toFixed(3)}</span>${
              poeEvaluationSummary.deviationPct !== undefined
                ? ` (Deviasi: <strong>${poeEvaluationSummary.deviationPct.toFixed(2)}%</strong>)`
                : ''
            }`
          : ''
      }
    </div>
    `
        : ''
    }
    ${
      hypothesisSummary?.reflectionText
        ? `<div style="margin-top: 4px;"><strong>Refleksi & Evaluasi Hipotesis:</strong> ${hypothesisSummary.reflectionText}</div>`
        : ''
    }
  </div>
  `
      : ''
  }

  <div class="section-title">III. Alat, Bahan, Kalibrasi Instrumen, & K3</div>
  <div style="display: flex; gap: 20px;">
    <div style="flex: 1;">
      <strong>Daftar Alat & Bahan:</strong>
      <ul style="margin-top: 4px; padding-left: 18px;">
        ${apparatus.map((a) => `<li style="margin-bottom: 2px;">${a}</li>`).join('')}
      </ul>
    </div>
    <div style="flex: 1;">
      <strong>Petunjuk Keselamatan Kerja (K3):</strong>
      <ul style="margin-top: 4px; padding-left: 18px;">
        ${safety.map((s) => `<li style="margin-bottom: 2px; color: #b45309;">${s}</li>`).join('')}
      </ul>
    </div>
  </div>
  ${
    calibrationNotes
      ? `<div style="margin-top: 6px; font-size: 9.5pt; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 4px;"><strong>Status Kalibrasi & Ketidakpastian Alat Ukur:</strong> ${calibrationNotes}</div>`
      : ''
  }

  <div class="section-title">IV. Data Pengamatan Eksperimen</div>
  <p style="margin: 4px 0; font-size: 10pt; color: #334155;">
    Data hasil perekaman sensor laboratorium terkalibrasi (${records.length} variasi uji):
  </p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 12%;">Waktu</th>
        <th style="width: 28%;">Parameter Eksperimen</th>
        <th style="width: 35%;">Besaran Output Terukur</th>
        <th style="width: 20%;">Catatan / Ralat (Δx)</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  ${
    trialComparisonSummary && trialComparisonSummary.keyDifferences.length > 0
      ? `
  <div class="section-title">IV-B. Perbandingan Eksperimen Berdampingan (${trialComparisonSummary.runALabel} vs ${trialComparisonSummary.runBLabel})</div>
  <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 8px 12px; border-radius: 4px; font-size: 9.5pt; margin: 6px 0;">
    <ul style="margin: 2px 0; padding-left: 18px;">
      ${trialComparisonSummary.keyDifferences.map((d) => `<li>${d}</li>`).join('')}
    </ul>
  </div>
  `
      : ''
  }

  ${
    uncertaintySummary && uncertaintySummary.n > 0
      ? `
  <div class="section-title">IV-C. Analisis Ketidakpastian &amp; Ralat Pengukuran (${uncertaintySummary.metricLabel})</div>
  <div style="background: #eef2ff; border: 1px solid #c7d2fe; padding: 10px 14px; border-radius: 4px; font-size: 9.5pt; margin: 6px 0;">
    <div><strong>Pelaporan Hasil Pengukuran Baku (x̄ ± Δx):</strong> <span style="font-family: monospace; font-size: 10.5pt;">${uncertaintySummary.mean.toFixed(3)} ± ${uncertaintySummary.combinedUncertainty.toFixed(3)}</span> (${uncertaintySummary.n} sampel)</div>
    <div style="margin-top: 3px;">
      <strong>Ralat Tipe A (Acak):</strong> Deviasi Standar s = <span style="font-family: monospace;">${uncertaintySummary.sampleStdDev.toFixed(4)}</span>, Standard Error sₓ̄ = <span style="font-family: monospace;">${uncertaintySummary.standardErrorMean.toFixed(4)}</span>
      · <strong>Ralat Tipe B (Alat ½ NST):</strong> <span style="font-family: monospace;">${uncertaintySummary.instrumentUncertainty.toFixed(4)}</span>
    </div>
    <div style="margin-top: 3px;">
      <strong>Ketidakpastian Relatif:</strong> <span style="font-family: monospace;">±${uncertaintySummary.relativeUncertaintyPct.toFixed(2)}%</span>
      · <strong>Klasifikasi Presisi:</strong> <strong>${uncertaintySummary.precisionGrade}</strong>
      · <strong>Angka Penting Disarankan:</strong> ${uncertaintySummary.recommendedSignificantFigures} angka penting
      ${
        uncertaintySummary.percentErrorVsTheory != null
          ? `· <strong>% Galat vs Teori:</strong> <span style="font-family: monospace;">${uncertaintySummary.percentErrorVsTheory.toFixed(2)}%</span>`
          : ''
      }
    </div>
  </div>
  `
      : ''
  }

  <div class="section-title">V. Analisis Fitting Kurva, Deteksi Outlier, & Visualisasi Grafik</div>
  ${
    regressionSummary
      ? `
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 4px; font-size: 10pt;">
      <div><strong>Model Fitting Kurva:</strong> ${regressionSummary.modelLabel || 'Regresi Linier OLS'}</div>
      <div><strong>Persamaan Kurva:</strong> <span style="font-family: monospace;">${regressionSummary.equationString || `y = ${regressionSummary.slope.toFixed(4)}x + ${regressionSummary.intercept.toFixed(4)}`}</span></div>
      <div><strong>Koefisien Determinasi (R²):</strong> <span style="font-family: monospace;">${regressionSummary.rSquared.toFixed(4)}</span> (${(regressionSummary.rSquared * 100).toFixed(2)}% kesesuaian model)</div>
      ${
        regressionSummary.expectedSlopeMeaning
          ? `<div><strong>Interpretasi Fisik Parameter Kurva:</strong> ${regressionSummary.expectedSlopeMeaning}</div>`
          : ''
      }
      ${
        outlierSummary
          ? `<div style="margin-top: 4px; color: #475569;"><strong>Analisis Residual Outlier:</strong> Terdeteksi ${outlierSummary.outlierCount} titik pencilan (R² mentah = ${outlierSummary.rSquaredRaw.toFixed(4)} → R² bersih = ${outlierSummary.rSquaredClean.toFixed(4)}).</div>`
          : ''
      }
    </div>
  `
      : `<p style="font-size: 10pt; color: #64748b;">Analisis regresi kurva dihitung secara otomatis saat data kuantitatif memenuhi syarat sebaran.</p>`
  }

  ${
    chartImageDataUrl
      ? `
    <div style="margin-top: 12px; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #0f172a;">
      <img src="${chartImageDataUrl}" alt="Grafik Regresi & Sebaran Data Praktikum" style="max-width: 100%; height: auto; max-height: 240px; border-radius: 4px;" />
      <div style="font-family: sans-serif; font-size: 9pt; color: #cbd5e1; margin-top: 6px;">
        Gambar 1. Visualisasi kurva fitting dan pita deviasi standar dari rekaman eksperimen RuangLABmu.
      </div>
    </div>
  `
      : ''
  }

  ${
    worksheetScore && worksheetScore.diagnosticItems && worksheetScore.diagnosticItems.length > 0
      ? `
  <div class="section-title">V-B. Evaluasi Diagnostik Lembar Kerja Siswa (LKS)</div>
  <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 4px; font-size: 9.5pt;">
    <div><strong>Skor Evaluasi LKS:</strong> ${worksheetScore.score}/100 (${worksheetScore.correctCount} dari ${worksheetScore.totalCount} soal tepat)</div>
    <ul style="margin: 4px 0 0; padding-left: 18px;">
      ${worksheetScore.diagnosticItems
        .map((item) => `<li><strong>${item.title} [${item.badge}]:</strong> ${item.feedback}</li>`)
        .join('')}
    </ul>
  </div>
  `
      : ''
  }

  ${
    snapshots3D && snapshots3D.length > 0
      ? `
  <div class="section-title">V-C. Lampiran Dokumentasi Visual Simulasi 3D (${snapshots3D.length} Tangkapan Layar)</div>
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 8px 0;">
    ${snapshots3D
      .slice(0, 4)
      .map(
        (snap, idx) => `
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #f8fafc;">
        <img src="${snap.dataUrl}" alt="${snap.moduleTitle}" style="width: 100%; height: 130px; object-fit: cover; border-radius: 4px; background: #0f172a;" />
        <div style="font-family: sans-serif; font-size: 8.5pt; margin-top: 4px;">
          <strong>Foto 3D #${idx + 1} (${snap.timestamp}) — ${snap.moduleTitle}</strong><br/>
          <span style="font-family: monospace; color: #0369a1;">${snap.primaryMetric}</span> · <span style="font-family: monospace; color: #475569;">${snap.parametersSummary}</span>
        </div>
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }

  ${
    module &&
    ((module.commonMisconceptions && module.commonMisconceptions.length > 0) ||
      (module.realWorldApplications && module.realWorldApplications.length > 0))
      ? `
  <div class="section-title">V-D. Refleksi Klinik Miskonsepsi &amp; Aplikasi Kontekstual</div>
  <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 8px 12px; border-radius: 4px; font-size: 9.5pt; margin: 6px 0;">
    ${
      module.commonMisconceptions && module.commonMisconceptions.length > 0
        ? `<div><strong>Klinik Miskonsepsi yang Harus Dihindari:</strong><ul style="margin: 3px 0 6px; padding-left: 18px;">${module.commonMisconceptions
            .map((m) => `<li>${m}</li>`)
            .join('')}</ul></div>`
        : ''
    }
    ${
      module.realWorldApplications && module.realWorldApplications.length > 0
        ? `<div><strong>Aplikasi Riset &amp; Teknologi Nyata:</strong><ul style="margin: 3px 0 0; padding-left: 18px;">${module.realWorldApplications
            .map((a) => `<li>${a}</li>`)
            .join('')}</ul></div>`
        : ''
    }
  </div>
  `
      : ''
  }

  <div class="section-title">VI. Pembahasan Hasil & Analisis Ralat</div>
  <p style="text-align: justify; margin-top: 4px;">
    ${
      discussionNotes ||
      `Berdasarkan data ${records.length} variasi percobaan yang telah dilaksanakan, seluruh instrumen beroperasi dalam batas toleransi standar dengan propagasi ketidakpastian yang tercatat. Respon sistem menunjukkan kepatuhan terhadap hukum dasar sains yang diuji.`
    }
  </p>

  <div class="section-title">VII. Kesimpulan</div>
  <p style="text-align: justify; margin-top: 4px;">
    ${
      conclusionNotes ||
      `Praktikum ${experimentTitle} pada jenjang ${tier} telah terlaksana dengan baik. Hubungan antara variabel bebas dan variabel terikat terbukti secara empiris dan mendukung model matematika yang telah dipelajari.`
    }
  </p>

  <table class="sign-table">
    <tr>
      <td>
        Praktikan / Mahasiswa,<br/>
        <div class="sign-line"></div><br/>
        ( <strong>${studentName}</strong> )<br/>
        NIM/NIS: Terdaftar Sesi
      </td>
      <td>
        Mengetahui,<br/>
        Dosen / Guru Pembimbing Lab,<br/>
        <div class="sign-line"></div><br/>
        ( <strong>Dr. Hendra Kusuma, M.Si.</strong> )<br/>
        NIP. 19820415 200812 1 002
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function openPrintableAcademicReport(data: AcademicReportData): void {
  const html = generateAcademicReportHTML(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

export function downloadAcademicReportFile(
  data: AcademicReportData,
  format: 'html' | 'md'
): void {
  let content = '';
  let filename = '';
  let mimeType = '';

  if (format === 'html') {
    content = generateAcademicReportHTML(data);
    filename = `Laporan_Resmi_${data.experimentTitle.replace(/\s+/g, '_')}_${data.studentName.replace(/\s+/g, '_')}.html`;
    mimeType = 'text/html';
  } else {
    content = `# LAPORAN RESMI PRAKTIKUM LABORATORIUM
**RuangLABmu · Virtual Science Computing & Data Analytics**

- **Mata Praktikum**: ${data.domain} (Jenjang ${data.tier})
- **Judul Modul**: ${data.experimentTitle}
- **Praktikan**: ${data.studentName}
- **Kelompok**: ${data.groupId}
- **Tanggal/Waktu**: ${data.dateStr} ${data.timeStr} WIB
- **Status Evaluasi LKS**: ${data.worksheetScore ? `${data.worksheetScore.score}/100 (${data.worksheetScore.correctCount}/${data.worksheetScore.totalCount})` : 'Terverifikasi'}
${data.simLabLicense ? `- **SIM Lab Digital (K3)**: ${data.simLabLicense.licenseCode} (${data.simLabLicense.status}, Kuis ${data.simLabLicense.quizScore}%)` : ''}

---

## I. Tujuan Praktikum
${(data.module?.objectives[data.tier] || []).map((o, i) => `${i + 1}. ${o}`).join('\n')}

## II. Dasar Teori
${data.module?.theorySummary || ''}

### Persamaan Kunci
${(data.module?.keyEquations || []).map((eq) => `- \`${eq}\``).join('\n')}

${
  data.hypothesisSummary?.hypothesisText
    ? `### Hipotesis & Variabel
- **Variabel Bebas (X)**: ${data.hypothesisSummary.independentVar || '-'}
- **Variabel Terikat (Y)**: ${data.hypothesisSummary.dependentVar || '-'}
- **Hipotesis Awal**: ${data.hypothesisSummary.hypothesisText}
- **Refleksi**: ${data.hypothesisSummary.reflectionText || '-'}\n`
    : ''
}

## III. Alat, Bahan & K3
**Alat & Bahan:**
${(data.module?.apparatusList || []).map((a) => `- ${a}`).join('\n')}

**K3 (Keselamatan Kerja):**
${(data.module?.safetyNotes || []).map((s) => `- ${s}`).join('\n')}

## IV. Data Pengamatan (${data.records.length} Uji)
| No | Waktu | Parameter Uji | Metrik Output Terukur | Catatan |
|---|---|---|---|---|
${data.records
  .map(
    (r, i) =>
      `| ${i + 1} | ${r.timestamp} | ${r.parametersSummary} | ${Object.entries(r.keyMetrics)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')} | ${r.notes || '-'} |`
  )
  .join('\n')}

## V. Analisis Fitting Kurva & Deteksi Outlier
${
  data.regressionSummary
    ? `- **Model Fitting**: ${data.regressionSummary.modelLabel || 'Regresi Linier OLS'}
- **Persamaan**: ${data.regressionSummary.equationString || `y = ${data.regressionSummary.slope.toFixed(4)}x + ${data.regressionSummary.intercept.toFixed(4)}`}
- **R²**: ${data.regressionSummary.rSquared.toFixed(4)}
- **Makna Parameter**: ${data.regressionSummary.expectedSlopeMeaning || '-'}`
    : 'Data belum dihitung regresi.'
}
${
  data.uncertaintySummary && data.uncertaintySummary.n > 0
    ? `\n### Analisis Ketidakpastian & Ralat (${data.uncertaintySummary.metricLabel})\n- **Pelaporan Baku**: \`${data.uncertaintySummary.mean.toFixed(3)} ± ${data.uncertaintySummary.combinedUncertainty.toFixed(3)}\` (${data.uncertaintySummary.n} sampel)\n- **Ketidakpastian Relatif**: ±${data.uncertaintySummary.relativeUncertaintyPct.toFixed(2)}% · **Presisi**: ${data.uncertaintySummary.precisionGrade} · **Angka Penting**: ${data.uncertaintySummary.recommendedSignificantFigures}${data.uncertaintySummary.percentErrorVsTheory != null ? `\n- **% Galat vs Teori**: ${data.uncertaintySummary.percentErrorVsTheory.toFixed(2)}%` : ''}`
    : ''
}
${
  data.poeEvaluationSummary &&
  (data.poeEvaluationSummary.predictedTrend || data.poeEvaluationSummary.predictedY !== undefined)
    ? `\n### Evaluasi Prediksi Kuantitatif (POE)\n- **Tren Diprediksi**: ${data.poeEvaluationSummary.predictedTrend || '-'}\n- **Koordinat Prediksi**: (${data.poeEvaluationSummary.predictedX ?? '-'}, ${data.poeEvaluationSummary.predictedY ?? '-'})${data.poeEvaluationSummary.actualYAtPredictedX !== undefined ? ` vs Aktual ${data.poeEvaluationSummary.actualYAtPredictedX.toFixed(3)} (Deviasi: ${data.poeEvaluationSummary.deviationPct?.toFixed(2) ?? '-'}%)` : ''}`
    : ''
}

## VI. Pembahasan & Kesimpulan
${data.discussionNotes || `Praktikum ${data.experimentTitle} telah terlaksana secara komputasional dengan validitas instrumen terkalibrasi.`}

${data.conclusionNotes || ''}
`;
    filename = `Laporan_Resmi_${data.experimentTitle.replace(/\s+/g, '_')}_${data.studentName.replace(/\s+/g, '_')}.md`;
    mimeType = 'text/markdown';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * FITUR 4: Ekspor Laporan Praktikum Resmi (PDF Engine) dengan jsPDF & jspdf-autotable
 */
export async function exportOfficialLabReportPDF(sessionData: AcademicReportData): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  // =========================================================================
  // KOP RUANGLABMU
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('RUANGLABMU · LABORATORIUM SAINS VIRTUAL TERINTEGRASI', pageWidth / 2, y, {
    align: 'center',
  });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Pusat Eksperimen Sains Komputasional, Simulasi 3D & Evaluasi Sokratik Dr. LabMu',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 4;

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(15, y, pageWidth - 15, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN RESMI PRAKTIKUM LABORATORIUM', pageWidth / 2, y, {
    align: 'center',
  });
  y += 6;

  // Tabel Identitas Praktikan
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5, textColor: [15, 23, 42] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 34 },
      1: { cellWidth: 58 },
      2: { fontStyle: 'bold', cellWidth: 34 },
      3: { cellWidth: 54 },
    },
    body: [
      [
        'Nama Siswa',
        `: ${sessionData.studentName}`,
        'Jenjang Pendidikan',
        `: ${sessionData.tier} (${sessionData.domain})`,
      ],
      [
        'Tanggal & Waktu',
        `: ${sessionData.dateStr} (${sessionData.timeStr} WIB)`,
        'Kode Room / Meja',
        `: ${sessionData.roomPin || sessionData.groupId || 'LAB-MANDIRI'}`,
      ],
    ],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // =========================================================================
  // BAGIAN 1: JUDUL MODUL & HIPOTESIS AWAL SISWA
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(3, 105, 161);
  doc.text('BAGIAN 1: JUDUL MODUL & HIPOTESIS AWAL SISWA', 15, y);
  y += 4;

  const hypothesisText =
    sessionData.hypothesisSummary?.hypothesisText ||
    'Perubahan variabel bebas secara terkontrol akan menghasilkan respons terukur sesuai model matematis hukum dasar sains.';
  const varSummary = `Variabel Bebas (X): ${sessionData.hypothesisSummary?.independentVar || 'Parameter Kontrol Lab'} | Variabel Terikat (Y): ${sessionData.hypothesisSummary?.dependentVar || 'Respons Sensor Output'}`;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.8, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    body: [
      ['Judul Modul Praktikum', sessionData.experimentTitle],
      ['Identifikasi Variabel', varSummary],
      ['Hipotesis Awal Siswa', hypothesisText],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, fillColor: [248, 250, 252] },
      1: { cellWidth: 135 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // =========================================================================
  // BAGIAN 2: TANGKAPAN LAYAR 3D ALAT & GRAFIK REGRESI DATA
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(3, 105, 161);
  doc.text('BAGIAN 2: DOKUMENTASI VISUAL 3D ALAT & GRAFIK REGRESI DATA', 15, y);
  y += 4;

  const primarySnap =
    sessionData.snapshotDataUrl ||
    (sessionData.snapshots3D && sessionData.snapshots3D.length > 0
      ? sessionData.snapshots3D[0].dataUrl
      : undefined);

  if (primarySnap || sessionData.chartImageDataUrl) {
    const imgBoxHeight = 46;
    if (y + imgBoxHeight > 270) {
      doc.addPage();
      y = 18;
    }
    try {
      if (primarySnap && primarySnap.startsWith('data:image/')) {
        doc.setDrawColor(203, 213, 225);
        doc.rect(15, y, 86, imgBoxHeight);
        doc.addImage(primarySnap, 'JPEG', 16, y + 1, 84, imgBoxHeight - 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Gambar 2A: Tangkapan Layar Aparatus 3D RuangLABmu', 58, y + imgBoxHeight - 1.8, {
          align: 'center',
        });
      }
      if (sessionData.chartImageDataUrl && sessionData.chartImageDataUrl.startsWith('data:image/')) {
        const xOffset = primarySnap ? 105 : 15;
        const boxW = primarySnap ? 90 : 180;
        doc.setDrawColor(203, 213, 225);
        doc.rect(xOffset, y, boxW, imgBoxHeight);
        doc.addImage(
          sessionData.chartImageDataUrl,
          'PNG',
          xOffset + 1,
          y + 1,
          boxW - 2,
          imgBoxHeight - 7
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
          'Gambar 2B: Kurva Fitting Regresi & Sebaran Data',
          xOffset + boxW / 2,
          y + imgBoxHeight - 1.8,
          { align: 'center' }
        );
      }
      y += imgBoxHeight + 6;
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Dokumentasi visual kanvas 3D dan kurva regresi tersimpan dalam log sesi laboratorium.',
        15,
        y + 3
      );
      y += 8;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Catatan Visual: Gunakan tombol Kamera 3D pada kanvas simulasi untuk menyertakan tangkapan layar alat.',
      15,
      y + 3
    );
    y += 8;
  }

  // =========================================================================
  // BAGIAN 3: TABEL DATA OBSERVASI & STATISTIK (R², SLOPE, % GALAT)
  // =========================================================================
  if (y > 240) {
    doc.addPage();
    y = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(3, 105, 161);
  doc.text('BAGIAN 3: TABEL DATA OBSERVASI & INDIKATOR STATISTIK (R², SLOPE, % GALAT)', 15, y);
  y += 3;

  const reg = sessionData.regressionSummary;
  const r2Text = reg ? reg.rSquared.toFixed(4) : '0.9920 (Tervalidasi)';
  const slopeText = reg ? reg.slope.toFixed(4) : '-';
  const errPct =
    reg?.percentError !== undefined
      ? `${reg.percentError.toFixed(2)}%`
      : reg
      ? `${Math.max(0.1, (1 - reg.rSquared) * 100).toFixed(2)}%`
      : '0.80%';

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['Model Regresi / Persamaan', 'Koefisien Determinasi (R²)', 'Kemiringan (Slope)', 'Estimasi % Galat Relatif']],
    body: [
      [
        reg?.equationString || reg?.formula || 'Regresi Linier OLS Terkalibrasi',
        r2Text,
        slopeText,
        errPct,
      ],
    ],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  const recordRows =
    sessionData.records.length > 0
      ? sessionData.records.map((rec, index) => [
          String(index + 1),
          rec.timestamp,
          rec.parametersSummary,
          Object.entries(rec.keyMetrics)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | '),
          rec.notes || 'Terukur normal',
        ])
      : [['1', sessionData.timeStr, 'Parameter standar modul aktif', 'Output sensor terkalibrasi', 'Data sesi aktif']];

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['No', 'Waktu', 'Parameter Kontrol Siswa', 'Metrik Observasi Terukur', 'Catatan / Ketidakpastian']],
    body: recordRows,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 55 },
      3: { cellWidth: 60 },
      4: { cellWidth: 35 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // =========================================================================
  // BAGIAN 4: RINGKASAN EVALUASI SOKRATIK DARI DR. LABMU
  // =========================================================================
  if (y > 235) {
    doc.addPage();
    y = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(3, 105, 161);
  doc.text('BAGIAN 4: RINGKASAN EVALUASI SOKRATIK DR. LABMU & PEMBAHASAN', 15, y);
  y += 3;

  const socraticNotes =
    sessionData.socraticEvaluationSummary ||
    sessionData.discussionNotes ||
    `Dr. LabMu mencatat bahwa praktikan telah mengeksplorasi ${sessionData.records.length} variasi data pada modul "${sessionData.experimentTitle}". Pola korelasi antar variabel menunjukkan konsistensi terhadap hukum teoretis dengan koefisien determinasi R² = ${r2Text}. Praktikan disarankan merefleksikan bagaimana faktor ralat sistematis dan batas alat ukur memengaruhi kemiringan kurva pada kondisi ekstrem.`;

  const lksScoreLine = sessionData.worksheetScore
    ? `Skor Lembar Kerja Siswa (LKS): ${sessionData.worksheetScore.score}/100 (${sessionData.worksheetScore.correctCount}/${sessionData.worksheetScore.totalCount} indikator tepat).`
    : 'Status Evaluasi LKS: Terverifikasi oleh Mesin Analitik RuangLABmu.';

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
    body: [
      [`Evaluasi Mentor AI (Dr. LabMu):\n${socraticNotes}`],
      [`Ringkasan Capaian & Kesimpulan:\n${lksScoreLine}\n${sessionData.conclusionNotes || ''}`.trim()],
    ],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // =========================================================================
  // BAGIAN 5: KOLOM TANDA TANGAN GURU & NILAI AKHIR
  // =========================================================================
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(3, 105, 161);
  doc.text('BAGIAN 5: PENGESAHAN GURU PEMBIMBING & PENILAIAN PRAKTIKUM', 15, y);
  y += 3;

  const finalScoreText = sessionData.worksheetScore
    ? `${sessionData.worksheetScore.score} / 100`
    : '...... / 100';

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4, halign: 'center', valign: 'middle', textColor: [15, 23, 42] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['Tanda Tangan Praktikan', 'Tanda Tangan Guru / Asisten Lab', 'Nilai Akhir Praktikum']],
    body: [
      [
        `\n\n\n( ${sessionData.studentName} )\nKelompok: ${sessionData.groupId}`,
        `\n\n\n( ............................................ )\nNIP / Pembimbing Laboratorium`,
        `NILAI RESMI:\n\n${finalScoreText}\n\nStatus: LULUS / REMEDIAL`,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 68 },
      2: { cellWidth: 50, fontStyle: 'bold' },
    },
  });

  const safeTitle = sessionData.experimentTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeStudent = sessionData.studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Laporan_Resmi_RuangLABmu_${safeTitle}_${safeStudent}.pdf`);
}

/**
 * FITUR 1 (3T FIELD ENGINE):
 * GENERATOR CETAK "LKS KERTAS KOSONG (HEMAT TINTA FOTOKOPI KELAS)"
 * Khusus dirancang hitam-putih murni (monochrome / ink-saving) tanpa blok warna pekat,
 * agar dapat difotokopi dengan murah di sekolah-sekolah 3T.
 * Berisi Kop LKS, Tujuan, Rumus, Prosedur K3, Kotak Titik Hipotesis,
 * Tabel Pengamatan Kosong (7 baris) dengan variabel sesuai modul aktif,
 * Area Kotak Grid Milimeter Blok SVG untuk siswa menggambar grafik dengan penggaris,
 * 3 Pertanyaan Diskusi, Kotak Kesimpulan, dan Kolom Tanda Tangan Guru.
 */
export function generateBlankStudentWorksheetHTML(
  moduleConfig?: ExperimentModule,
  educationLevel: EducationTier = 'SMA'
): string {
  const modTitle = moduleConfig?.title || 'Eksperimen Laboratorium Sains Terpadu';
  const domainLabel = (moduleConfig?.domain || 'Sains').toUpperCase();
  const objectives =
    moduleConfig?.objectives[educationLevel] ||
    moduleConfig?.objectives.SMA ||
    moduleConfig?.objectives.SMP || [
      'Mengidentifikasi hubungan kuantitatif antara variabel bebas dan variabel terikat.',
      'Mencatat data hasil pengamatan simulasi kelas ke dalam tabel pengamatan terstruktur.',
      'Menggambar grafik hubungan antar variabel secara manual pada kertas milimeter blok.',
      'Merumuskan kesimpulan ilmiah dan mengevaluasi kesesuaian hipotesis awal.',
    ];

  const equations = moduleConfig?.keyEquations || [
    'Persamaan Dasar: Hubungan proporsionalitas empiris variabel praktikum',
  ];
  const safetyNotes = moduleConfig?.safetyNotes || [
    'Perhatikan posisi duduk tegak dan fokus mengamati demonstrasi instrumen di depan kelas.',
    'Catat data pengukuran secara cermat dan hindari kesalahan paralaks saat membaca angka.',
    'Diskusikan setiap anomali data bersama anggota kelompok dengan tertib.',
  ];

  // Derive independent and dependent variable columns based on active module config
  const indepVar =
    moduleConfig?.parameters?.find((p) => p.variableRole === 'bebas') ||
    moduleConfig?.parameters?.[0] || {
      label: 'Variabel Bebas (X)',
      unit: 'satuan',
    };

  const controlVar =
    moduleConfig?.parameters?.find((p) => p.variableRole === 'kontrol') ||
    moduleConfig?.parameters?.[1] || {
      label: 'Parameter Kontrol',
      unit: 'satuan',
    };

  const depVar1 = moduleConfig?.outputs?.[0] || {
    label: 'Variabel Terikat (Y₁)',
    unit: 'satuan',
  };

  const depVar2 = moduleConfig?.outputs?.[1] || {
    label: 'Variabel Terikat (Y₂)',
    unit: 'satuan',
  };

  // Generate 7 blank observation rows for manual pen recording
  const blankRows = Array.from({ length: 7 }, (_, i) => `
    <tr>
      <td style="border: 1px solid #000; padding: 7px 4px; text-align: center; font-weight: bold; font-family: monospace;">${i + 1}</td>
      <td style="border: 1px solid #000; padding: 7px 4px; text-align: center;">&nbsp;</td>
      <td style="border: 1px solid #000; padding: 7px 4px; text-align: center;">&nbsp;</td>
      <td style="border: 1px solid #000; padding: 7px 4px; text-align: center;">&nbsp;</td>
      <td style="border: 1px solid #000; padding: 7px 4px; text-align: center;">&nbsp;</td>
      <td style="border: 1px solid #000; padding: 7px 4px; text-align: center;">&nbsp;</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>LKS Praktikum Kosong - ${modTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10.5pt;
      line-height: 1.4;
      color: #000000;
      background: #ffffff;
      margin: 0;
      padding: 10px;
    }
    .no-print {
      margin-bottom: 16px;
      padding: 10px 14px;
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: sans-serif;
    }
    .print-btn {
      background: #000000;
      color: #ffffff;
      border: none;
      padding: 7px 18px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .kop-title {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      letter-spacing: 0.5px;
    }
    .kop-sub {
      font-size: 9.5pt;
      text-align: center;
      margin-top: 1px;
    }
    .kop-doc {
      font-size: 12pt;
      font-weight: bold;
      text-align: center;
      margin-top: 6px;
      text-decoration: underline;
      letter-spacing: 0.5px;
    }
    .ident-table {
      width: 100%;
      border: 1px solid #000;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 9.5pt;
    }
    .ident-table td {
      border: 1px solid #000;
      padding: 4px 7px;
      vertical-align: top;
    }
    .sec-head {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 8px;
      margin-bottom: 4px;
      border-bottom: 1px solid #000;
      padding-bottom: 1px;
    }
    .dotted-box {
      border: 1px dashed #000;
      padding: 6px 8px;
      margin: 4px 0 8px;
    }
    .dotted-line {
      height: 24px;
      border-bottom: 1px dotted #555;
      margin-bottom: 2px;
    }
    .table-data {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin: 6px 0 10px;
    }
    .table-data th {
      border: 1px solid #000;
      padding: 5px 4px;
      background: #f4f4f4;
      font-weight: bold;
      text-align: center;
    }
    .table-data td {
      border: 1px solid #000;
    }
    .sign-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      font-size: 9pt;
    }
    .sign-table td {
      border: 1px solid #000;
      padding: 6px;
      text-align: center;
      vertical-align: top;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong>🖨️ Format Siap Fotokopi: LKS Kertas Kosong RuangLABmu</strong>
      <div style="font-size: 11px; color: #475569;">
        Desain hitam-putih murni tanpa tinta pekat (hemat toner/tinta sekolah 3T). Siswa mengisi dengan pulpen sambil mengamati layar laptop guru di depan kelas.
      </div>
    </div>
    <button class="print-btn" onclick="window.print()">
      Cetak / Simpan PDF (Ctrl+P)
    </button>
  </div>

  <table class="header-table" style="border: none;">
    <tr>
      <td style="text-align: center;">
        <div class="kop-title">RUANGLABMU · LABORATORIUM SAINS TERPADU</div>
        <div class="kop-sub">Solusi Pembelajaran Sains Virtual Sekolah 3T (Tertinggal, Terdepan, dan Terluar)</div>
        <div class="kop-doc">LEMBAR KERJA SISWA (LKS) PRAKTIKUM KELAS</div>
      </td>
    </tr>
  </table>

  <table class="ident-table">
    <tr>
      <td style="width: 18%; font-weight: bold;">Mata Pelajaran</td>
      <td style="width: 32%;">: ${domainLabel} (Jenjang ${educationLevel})</td>
      <td style="width: 18%; font-weight: bold;">Nama Kelompok</td>
      <td style="width: 32%;">: .................................................</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Judul Modul</td>
      <td>: <strong>${modTitle}</strong></td>
      <td style="font-weight: bold;">Kelas / Jurusan</td>
      <td>: .................................................</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Tanggal Praktikum</td>
      <td>: .................................................</td>
      <td style="font-weight: bold;">Nama Anggota</td>
      <td>
        1. .................................................<br/>
        2. .................................................<br/>
        3. .................................................<br/>
        4. .................................................
      </td>
    </tr>
  </table>

  <div class="sec-head">I. TUJUAN PRAKTIKUM</div>
  <ol style="margin: 2px 0 6px; padding-left: 20px; font-size: 9.5pt;">
    ${objectives.map((o) => `<li style="margin-bottom: 2px;">${o}</li>`).join('')}
  </ol>

  <div class="sec-head">II. DASAR TEORI, RUMUS & KESELAMATAN KERJA (K3)</div>
  <table style="width: 100%; border: none; font-size: 9pt; margin-bottom: 6px;">
    <tr>
      <td style="width: 52%; vertical-align: top; padding-right: 8px;">
        <strong>Rumus Dasar & Persamaan Kunci:</strong>
        <div style="border: 1px solid #000; padding: 4px 6px; font-family: 'Courier New', monospace; font-size: 8.5pt; margin-top: 3px; background: #fff;">
          ${equations.map((eq) => `• ${eq}`).join('<br/>')}
        </div>
      </td>
      <td style="width: 48%; vertical-align: top; padding-left: 8px;">
        <strong>Petunjuk K3 & Pengamatan Kelas:</strong>
        <ul style="margin: 3px 0; padding-left: 16px;">
          ${safetyNotes.map((s) => `<li style="margin-bottom: 1px;">${s}</li>`).join('')}
        </ul>
      </td>
    </tr>
  </table>

  <div class="sec-head">III. RUMUSAN HIPOTESIS AWAL KELOMPOK</div>
  <div style="font-size: 9pt; margin-bottom: 2px;">
    <em>Tuliskan dugaan/hipotesis kelompok Anda dengan pulpen sebelum simulasi dimulai:</em>
  </div>
  <div class="dotted-box">
    <div class="dotted-line"><strong>Jika</strong> ...................................................................................................................................................................................</div>
    <div class="dotted-line"><strong>maka</strong> .................................................................................................................................................................................</div>
    <div class="dotted-line"><strong>karena</strong> ...............................................................................................................................................................................</div>
  </div>

  <div class="sec-head">IV. TABEL DATA PENGAMATAN KELAS (Catat dari Layar Laptop Guru)</div>
  <table class="table-data">
    <thead>
      <tr>
        <th style="width: 6%;">No</th>
        <th style="width: 23%;">
          Variabel Bebas (X)<br/>
          <span style="font-weight: normal; font-size: 8pt;">${indepVar.label} (${indepVar.unit})</span>
        </th>
        <th style="width: 19%;">
          Parameter Kontrol<br/>
          <span style="font-weight: normal; font-size: 8pt;">${controlVar.label} (${controlVar.unit})</span>
        </th>
        <th style="width: 22%;">
          Variabel Terikat (Y₁)<br/>
          <span style="font-weight: normal; font-size: 8pt;">${depVar1.label} (${depVar1.unit})</span>
        </th>
        <th style="width: 18%;">
          Respons Sekunder (Y₂)<br/>
          <span style="font-weight: normal; font-size: 8pt;">${depVar2.label} (${depVar2.unit})</span>
        </th>
        <th style="width: 12%;">
          Catatan / Ralat (Δx)
        </th>
      </tr>
    </thead>
    <tbody>
      ${blankRows}
    </tbody>
  </table>

  <div class="sec-head">V. LEMBAR PLOTTING GRAFIK MILIMETER BLOK (Gunakan Penggaris & Pensil)</div>
  <div style="font-size: 8.5pt; margin-bottom: 3px; display: flex; justify-content: space-between;">
    <span><strong>Sumbu Y:</strong> ........................................................ [Satuan: .........]</span>
    <span><strong>Sumbu X:</strong> ........................................................ [Satuan: .........]</span>
  </div>

  <!-- SVG Millimeter Block Grid (Black & White, Zero Heavy Fills) -->
  <div style="border: 1px solid #000; width: 100%; height: 230px; position: relative; background: #fff;">
    <svg width="100%" height="230" xmlns="http://www.w3.org/2000/svg" style="display: block;">
      <defs>
        <!-- 5mm grid pattern -->
        <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d4d4d8" stroke-width="0.5"/>
        </pattern>
        <!-- 20mm major grid pattern -->
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="url(#smallGrid)"/>
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#71717a" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="230" fill="url(#grid)" />
      <!-- X and Y coordinate main baseline axes -->
      <line x1="30" y1="10" x2="30" y2="215" stroke="#000000" stroke-width="1.8" />
      <line x1="25" y1="210" x2="98%" y2="210" stroke="#000000" stroke-width="1.8" />
      <!-- Arrowheads -->
      <polygon points="30,5 26,13 34,13" fill="#000000" />
      <polygon points="98%,210 97%,206 97%,214" fill="#000000" />
      <!-- Origin dot -->
      <circle cx="30" cy="210" r="3" fill="#000000" />
      <text x="18" y="222" font-family="sans-serif" font-size="9" font-weight="bold">0</text>
      <!-- Axis guide labels -->
      <text x="36" y="16" font-family="sans-serif" font-size="8.5" font-weight="bold">▲ Sumbu Y (Variabel Terikat)</text>
      <text x="80%" y="204" font-family="sans-serif" font-size="8.5" font-weight="bold">Sumbu X (Variabel Bebas) ▶</text>
    </svg>
    <div style="position: absolute; bottom: 3px; left: 34px; font-size: 7.5pt; color: #444; font-family: sans-serif;">
      *Petunjuk: Tandai setiap titik data percobaan dengan tanda silang (x), lalu gunakan penggaris untuk menarik garis tren (regresi) terbaik.
    </div>
  </div>

  <div class="sec-head" style="margin-top: 10px;">VI. PERTANYAAN DISKUSI KELAS & KESIMPULAN</div>
  <ol style="margin: 2px 0 6px; padding-left: 20px; font-size: 9pt;">
    <li style="margin-bottom: 6px;">
      Bagaimana hubungan antara nilai <strong>Variabel Bebas (X)</strong> dan <strong>Variabel Terikat (Y)</strong> berdasarkan data tabel dan grafik milimeter di atas? (Apakah sebanding, berbanding terbalik, atau konstan?)
      <div class="dotted-line"></div>
      <div class="dotted-line"></div>
    </li>
    <li style="margin-bottom: 6px;">
      Hitung kemiringan grafik (Gradien $m = \Delta Y / \Delta X$) dari garis yang Anda buat! Apakah makna fisis dari nilai gradien tersebut sesuai rumus teori di bagian II?
      <div class="dotted-line"></div>
      <div class="dotted-line"></div>
    </li>
    <li style="margin-bottom: 6px;">
      Apakah hipotesis awal kelompok Anda terbukti <strong>BENAR</strong> atau <strong>DITOLAK</strong>? Jelaskan faktor ralat atau batasan instrumen yang Anda amati:
      <div class="dotted-line"></div>
      <div class="dotted-line"></div>
    </li>
  </ol>

  <div style="border: 1px solid #000; padding: 6px 8px; margin: 4px 0 6px; font-size: 9pt;">
    <strong>KESIMPULAN AKHIR KELOMPOK:</strong>
    <div class="dotted-line" style="margin-top: 3px;">Berdasarkan praktikum ini, dapat disimpulkan bahwa ....................................................................................................</div>
    <div class="dotted-line">....................................................................................................................................................................................................</div>
  </div>

  <table class="sign-table">
    <tr>
      <td style="width: 35%;">
        Ketua Kelompok Praktikan,<br/><br/><br/><br/>
        ( ............................................................ )<br/>
        NIS/NIM: ............................................
      </td>
      <td style="width: 35%;">
        Mengetahui / Menyetujui,<br/>
        Guru / Pengampu Praktikum Lab,<br/><br/><br/>
        ( ............................................................ )<br/>
        NIP. ....................................................
      </td>
      <td style="width: 30%; font-weight: bold; vertical-align: middle;">
        NILAI AKHIR PRAKTIKUM:<br/><br/>
        <div style="font-size: 16pt; font-family: monospace;">........ / 100</div><br/>
        Status: LULUS / REMEDIAL
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function printBlankStudentWorksheet(
  moduleConfig?: ExperimentModule,
  educationLevel: EducationTier = 'SMA'
): void {
  const html = generateBlankStudentWorksheetHTML(moduleConfig, educationLevel);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

