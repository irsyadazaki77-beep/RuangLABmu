import { ExperimentRecord } from './scienceEngine';
import {
  ExperimentModule,
  EducationTier,
} from '../registry/experimentRegistry';

export interface AcademicReportData {
  experimentTitle: string;
  studentName: string;
  groupId: string;
  tier: EducationTier;
  dateStr: string;
  timeStr: string;
  domain: string;
  module?: ExperimentModule;
  records: ExperimentRecord[];
  regressionSummary?: {
    slope: number;
    intercept: number;
    rSquared: number;
    formula: string;
    expectedSlopeMeaning?: string;
    modelLabel?: string;
    equationString?: string;
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
    hypothesisSummary &&
    (hypothesisSummary.independentVar ||
      hypothesisSummary.dependentVar ||
      hypothesisSummary.hypothesisText ||
      hypothesisSummary.reflectionText)
      ? `
  <div class="section-title">II-B. Perumusan Hipotesis & Identifikasi Variabel</div>
  <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px 14px; border-radius: 4px; font-size: 10pt; margin: 6px 0;">
    <div><strong>Variabel Bebas (X):</strong> ${hypothesisSummary.independentVar || '-'}</div>
    <div><strong>Variabel Terikat (Y):</strong> ${hypothesisSummary.dependentVar || '-'}</div>
    <div style="margin-top: 4px;"><strong>Hipotesis Awal:</strong> <em>${hypothesisSummary.hypothesisText || '-'}</em></div>
    ${
      hypothesisSummary.reflectionText
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
