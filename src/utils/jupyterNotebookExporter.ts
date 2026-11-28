/**
 * Computational Science Exporter (v2.3 Pilar 3 — RuangLABmu)
 * Menghasilkan:
 * 1. Berkas Jupyter Notebook standar RFC (nbformat 4.5, `.ipynb`) siap eksekusi di Google Colab / JupyterLab
 *    lengkap dengan numpy, scipy.optimize.curve_fit, perhitungan R², dan grafik regresi Matplotlib.
 * 2. Format salin cepat tabel Desmos (TSV tab-delimited) & GeoGebra Spreadsheet (CSV).
 */

export interface ComputationalDataPoint {
  x: number;
  y: number;
}

export interface JupyterExportOptions {
  moduleTitle: string;
  domain: string;
  studentName?: string;
  hypothesisText?: string;
  xLabel: string;
  yLabel: string;
  points: ComputationalDataPoint[];
}

export interface JupyterNotebookCell {
  cell_type: 'markdown' | 'code';
  metadata: Record<string, unknown>;
  source: string[];
  execution_count?: null;
  outputs?: unknown[];
}

export interface JupyterNotebookDocument {
  nbformat: 4;
  nbformat_minor: 5;
  metadata: {
    kernelspec: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info: {
      name: string;
      version: string;
    };
  };
  cells: JupyterNotebookCell[];
}

function sanitizePythonString(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

/**
 * Menghasilkan objek JSON Jupyter Notebook v4.5 valid dari data eksperimen siswa.
 */
export function buildJupyterNotebookDocument(
  options: JupyterExportOptions
): JupyterNotebookDocument {
  const safeTitle = options.moduleTitle || 'Eksperimen RuangLABmu';
  const safeDomain = options.domain || 'Sains';
  const safeStudent = options.studentName || 'Praktikan RuangLABmu';
  const safeXLabel = sanitizePythonString(options.xLabel || 'Variabel Bebas (X)');
  const safeYLabel = sanitizePythonString(options.yLabel || 'Variabel Terikat (Y)');

  const validPoints = options.points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  const xArr = validPoints.map((p) => Number(p.x.toFixed(6))).join(', ');
  const yArr = validPoints.map((p) => Number(p.y.toFixed(6))).join(', ');

  const markdownLines = [
    `# Laporan Komputasi Praktikum: ${safeTitle}\n`,
    `\n`,
    `- **Platform**: RuangLABmu Virtual Science Laboratory\n`,
    `- **Domain**: ${safeDomain}\n`,
    `- **Nama Praktikan**: ${safeStudent}\n`,
    `- **Jumlah Sampel**: ${validPoints.length} titik pengamatan\n`,
    options.hypothesisText
      ? `- **Hipotesis Awal**: ${options.hypothesisText.replace(/\r?\n/g, ' ')}\n`
      : '',
  ].filter(Boolean);

  const setupCodeLines = [
    'import numpy as np\n',
    'import matplotlib.pyplot as plt\n',
    'from scipy.optimize import curve_fit\n',
    '\n',
    '# Data pengamatan riil dari simulasi RuangLABmu\n',
    `x_data = np.array([${xArr}], dtype=float)\n`,
    `y_data = np.array([${yArr}], dtype=float)\n`,
    '\n',
    'print(f"Total sampel: {len(x_data)} titik")\n',
  ];

  const analysisCodeLines = [
    'def linear_model(x, m, c):\n',
    '    return m * x + c\n',
    '\n',
    'if len(x_data) >= 2:\n',
    '    popt, pcov = curve_fit(linear_model, x_data, y_data)\n',
    '    m_fit, c_fit = popt\n',
    '    perr = np.sqrt(np.diag(pcov))\n',
    '    y_pred = linear_model(x_data, m_fit, c_fit)\n',
    '    ss_res = np.sum((y_data - y_pred) ** 2)\n',
    '    ss_tot = np.sum((y_data - np.mean(y_data)) ** 2)\n',
    '    r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 1.0\n',
    '    print(f"Slope (m)     = {m_fit:.5f} ± {perr[0]:.5f}")\n',
    '    print(f"Intercept (c) = {c_fit:.5f} ± {perr[1]:.5f}")\n',
    '    print(f"R²            = {r_squared:.5f}")\n',
    '\n',
    '    plt.figure(figsize=(8, 5), dpi=120)\n',
    '    plt.scatter(x_data, y_data, color="#0284c7", label="Data Eksperimen", zorder=3)\n',
    '    x_line = np.linspace(np.min(x_data), np.max(x_data), 100)\n',
    '    plt.plot(x_line, linear_model(x_line, m_fit, c_fit), color="#f59e0b", linewidth=2,\n',
    '             label=f"Fit Linier: y = {m_fit:.3f}x + {c_fit:.3f} (R²={r_squared:.4f})")\n',
    `    plt.title("${sanitizePythonString(safeTitle)}")\n`,
    `    plt.xlabel("${safeXLabel}")\n`,
    `    plt.ylabel("${safeYLabel}")\n`,
    '    plt.grid(True, linestyle="--", alpha=0.45)\n',
    '    plt.legend()\n',
    '    plt.tight_layout()\n',
    '    plt.show()\n',
    'else:\n',
    '    print("Minimal 2 titik data diperlukan untuk regresi kurva.")\n',
  ];

  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.11.0',
      },
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: markdownLines,
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: setupCodeLines,
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: analysisCodeLines,
      },
    ],
  };
}

/**
 * Mengonversi data pengamatan menjadi string TSV (tab-delimited) siap tempel ke Desmos Graphing Calculator.
 */
export function formatDesmosTableTSV(
  points: ComputationalDataPoint[],
  xLabel = 'x_1',
  yLabel = 'y_1'
): string {
  const header = `${xLabel}\t${yLabel}`;
  const rows = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => `${Number(p.x.toFixed(6))}\t${Number(p.y.toFixed(6))}`);
  return [header, ...rows].join('\n');
}

/**
 * Mengonversi data pengamatan menjadi CSV ringan siap impor ke GeoGebra Spreadsheet.
 */
export function formatGeoGebraTableCSV(
  points: ComputationalDataPoint[],
  xLabel = 'X',
  yLabel = 'Y'
): string {
  const header = `"${xLabel.replace(/"/g, '""')}","${yLabel.replace(/"/g, '""')}"`;
  const rows = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => `${Number(p.x.toFixed(6))},${Number(p.y.toFixed(6))}`);
  return [header, ...rows].join('\n');
}

/**
 * Memicu unduhan berkas `.ipynb` di browser.
 */
export function downloadJupyterNotebook(options: JupyterExportOptions): string {
  const doc = buildJupyterNotebookDocument(options);
  const json = JSON.stringify(doc, null, 2);

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const slug = (options.moduleTitle || 'eksperimen')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 42);
    const blob = new Blob([json], { type: 'application/x-ipynb+json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruanglabmu_${slug || 'notebook'}.ipynb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return json;
}
