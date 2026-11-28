import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJupyterNotebookDocument,
  formatDesmosTableTSV,
  formatGeoGebraTableCSV,
} from './jupyterNotebookExporter';

describe('v2.3 Pilar 3: Jupyter Notebook (.ipynb) & Desmos/GeoGebra Exporter', () => {
  const samplePoints = [
    { x: 1, y: 2.1 },
    { x: 2, y: 4.0 },
    { x: 3, y: 6.2 },
    { x: 4, y: 7.9 },
  ];

  it('generates valid nbformat 4.5 Jupyter Notebook JSON with numpy, scipy, and student data', () => {
    const nb = buildJupyterNotebookDocument({
      moduleTitle: 'Hukum II Newton & Bidang Miring',
      domain: 'Fisika',
      studentName: 'Alya Putri',
      hypothesisText: 'Percepatan berbanding lurus dengan sinus sudut bidang.',
      xLabel: 'sin(θ)',
      yLabel: 'a (m/s²)',
      points: samplePoints,
    });

    assert.strictEqual(nb.nbformat, 4);
    assert.strictEqual(nb.nbformat_minor, 5);
    assert.strictEqual(nb.cells.length, 3);
    assert.strictEqual(nb.cells[0].cell_type, 'markdown');
    assert.strictEqual(nb.cells[1].cell_type, 'code');
    assert.strictEqual(nb.cells[2].cell_type, 'code');

    const code1 = nb.cells[1].source.join('');
    const code2 = nb.cells[2].source.join('');
    assert.ok(code1.includes('import numpy as np'));
    assert.ok(code1.includes('from scipy.optimize import curve_fit'));
    assert.ok(code1.includes('x_data = np.array([1, 2, 3, 4]'));
    assert.ok(code2.includes('r_squared'));
    assert.ok(code2.includes('plt.scatter'));
  });

  it('formats Desmos TSV and GeoGebra CSV tables accurately', () => {
    const tsv = formatDesmosTableTSV(samplePoints, 'x_1', 'y_1');
    assert.ok(tsv.startsWith('x_1\ty_1\n1\t2.1'));
    assert.strictEqual(tsv.split('\n').length, 5);

    const csv = formatGeoGebraTableCSV(samplePoints, 'Sudut', 'Percepatan');
    assert.ok(csv.startsWith('"Sudut","Percepatan"\n1,2.1'));
    assert.strictEqual(csv.split('\n').length, 5);
  });
});
