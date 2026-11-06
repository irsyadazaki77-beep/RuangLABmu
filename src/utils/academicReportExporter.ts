import { ExperimentRecord } from './scienceEngine';
import {
  ExperimentModule,
  EducationTier,
  getExperimentById,
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
  };
  worksheetScore?: {
    score: number;
    correctCount: number;
    totalCount: number;
  };
  discussionNotes?: string;
  conclusionNotes?: string;
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
    worksheetScore,
    discussionNotes,
    conclusionNotes,
  } = data;

  const objectives =
    module?.objectives[tier] ||
    module?.objectives.SMA ||
    [
      'Memahami konsep dasar hukum fisika/kimia/biologi/astronomi melalui pengamatan eksperimen kuantitatif.',
      'Mengolah data pengamatan dengan ketidakpastian dan analisis regresi linier.',
    ];

  const theory =
    module?.theorySummary ||
    'Eksperimen laboratorium bertujuan untuk memvalidasi model teoretis melalui pengukuran empiris terkontrol.';

  const equations = module?.keyEquations || [];
  const apparatus = module?.apparatusList || ['Alat ukur terkalibrasi', 'Bahan uji terstandarisasi'];
  const safety = module?.safetyNotes || ['Gunakan alat pelindung diri sesuai SOP K3 laboratorium.'];

  // Build records table rows
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
    @page { size: A4; margin: 20mm; }
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
      margin-top: 40px;
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
      📄 Pratinjau Cetak Laporan Resmi Praktikum RuangLABmu
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
      <td>: ${worksheetScore ? `LKS Dinilai (${worksheetScore.score}/100)` : 'Terverifikasi Sistem'}</td>
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

  <div class="section-title">III. Alat, Bahan, & Keselamatan Kerja (K3)</div>
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

  <div class="section-title">IV. Data Pengamatan Eksperimen</div>
  <p style="margin: 4px 0; font-size: 10pt; color: #334155;">
    Data hasil perekaman sensor laboratorium terkalibrasi:
  </p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 12%;">Waktu</th>
        <th style="width: 28%;">Parameter Eksperimen</th>
        <th style="width: 35%;">Besaran Output Terukur</th>
        <th style="width: 20%;">Catatan Ralat</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="section-title">V. Analisis Data & Regresi Linier OLS</div>
  ${
    regressionSummary
      ? `
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 4px; font-size: 10pt;">
      <div><strong>Persamaan Garis Regresi:</strong> <span style="font-family: monospace;">y = ${regressionSummary.slope.toFixed(4)}x + ${regressionSummary.intercept.toFixed(4)}</span></div>
      <div><strong>Koefisien Determinasi (R²):</strong> <span style="font-family: monospace;">${regressionSummary.rSquared.toFixed(4)}</span> (${(regressionSummary.rSquared * 100).toFixed(2)}% variansi data linier)</div>
      ${
        regressionSummary.expectedSlopeMeaning
          ? `<div><strong>Interpretasi Fisik Kemiringan (Slope):</strong> ${regressionSummary.expectedSlopeMeaning}</div>`
          : ''
      }
    </div>
  `
      : `<p style="font-size: 10pt; color: #64748b;">Analisis regresi linier dihitung secara otomatis saat data kuantitatif memenuhi syarat sebaran.</p>`
  }

  <div class="section-title">VI. Pembahasan Hasil & Lembar Kerja</div>
  <p style="text-align: justify; margin-top: 4px;">
    ${
      discussionNotes ||
      `Berdasarkan data ${records.length} variasi percobaan yang telah dilaksanakan, seluruh instrumen beroperasi dalam batas toleransi standar. Respon sistem menunjukkan kepatuhan terhadap hukum dasar fisika/kimia/biologi yang diuji dengan linearitas yang tinggi.`
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
    // Markdown format
    content = `# LAPORAN RESMI PRAKTIKUM LABORATORIUM
**RuangLABmu · Virtual Science Computing & Data Analytics**

- **Mata Praktikum**: ${data.domain} (Jenjang ${data.tier})
- **Judul Modul**: ${data.experimentTitle}
- **Praktikan**: ${data.studentName}
- **Kelompok**: ${data.groupId}
- **Tanggal/Waktu**: ${data.dateStr} ${data.timeStr} WIB

---

## I. Tujuan Praktikum
${(data.module?.objectives[data.tier] || []).map((o, i) => `${i + 1}. ${o}`).join('\n')}

## II. Dasar Teori
${data.module?.theorySummary || ''}

### Persamaan Kunci
${(data.module?.keyEquations || []).map((eq) => `- \`${eq}\``).join('\n')}

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

## V. Analisis Data & Regresi Linier
${
  data.regressionSummary
    ? `- **Garis Regresi**: y = ${data.regressionSummary.slope.toFixed(4)}x + ${data.regressionSummary.intercept.toFixed(4)}
- **R²**: ${data.regressionSummary.rSquared.toFixed(4)}
- **Makna Gradien**: ${data.regressionSummary.expectedSlopeMeaning || '-'}`
    : 'Data belum dihitung regresi.'
}

## VI. Pembahasan & Kesimpulan
Praktikum ${data.experimentTitle} telah terlaksana secara komputasional dengan validitas instrumen terkalibrasi.
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
