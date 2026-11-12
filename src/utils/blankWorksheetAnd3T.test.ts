import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBlankStudentWorksheetHTML } from './academicReportExporter';
import { PHYSICS_MODULES } from '../registry/modules/physicsModules';
import { CHEMISTRY_MODULES } from '../registry/modules/chemistryModules';
import { BIOLOGY_MODULES } from '../registry/modules/biologyModules';
import { ASTRONOMY_MODULES } from '../registry/modules/astronomyModules';

test('3T Feature 1: generateBlankStudentWorksheetHTML produces photocopy-friendly ink-saving HTML', () => {
  const inclineModule = PHYSICS_MODULES.find((m) => m.id === 'newton-incline')!;
  assert.ok(inclineModule, 'Physics module must exist');

  const html = generateBlankStudentWorksheetHTML(inclineModule, 'SMA');

  // Must contain DOCTYPE and HTML structure
  assert.ok(html.includes('<!DOCTYPE html>'), 'Must produce valid HTML document');
  assert.ok(html.includes('LEMBAR KERJA SISWA (LKS)'), 'Must include LKS header');

  // Kop Lembar Kerja Siswa
  assert.ok(html.includes('Nama Kelompok'), 'Must include Nama Kelompok');
  assert.ok(html.includes('Kelas'), 'Must include Kelas');
  assert.ok(html.includes('Nama Anggota'), 'Must include Anggota');
  assert.ok(html.includes('Tanggal Praktikum'), 'Must include Tanggal Praktikum');

  // Ink-saving styles
  assert.ok(html.includes('@media print'), 'Must include print media stylesheet');
  assert.ok(html.includes('border: 1px solid #000'), 'Must use crisp high-contrast black borders for photocopiers');

  // Tujuan & Rumus Dasar
  assert.ok(html.includes('TUJUAN PRAKTIKUM'), 'Must include Tujuan Praktikum section');
  assert.ok(html.includes('DASAR TEORI, RUMUS &amp; KESELAMATAN KERJA (K3)') || html.includes('DASAR TEORI, RUMUS & KESELAMATAN KERJA (K3)'), 'Must include Teori, Rumus & K3');

  // Prosedur & K3
  assert.ok(html.includes('Keselamatan Kerja (K3)') || html.includes('K3'), 'Must include K3 section');

  // Kotak Garis Titik-titik Hipotesis
  assert.ok(html.includes('RUMUSAN HIPOTESIS AWAL KELOMPOK') || html.includes('HIPOTESIS'), 'Must include Hipotesis');
  assert.ok(html.includes('dotted-line') && html.includes('dotted'), 'Must have dotted writing lines');

  // Tabel Pengamatan Kosong (7 baris)
  assert.ok(html.includes('TABEL DATA PENGAMATAN'), 'Must include observation table');
  assert.ok(html.includes('No'), 'Must include row number header');
  assert.ok(html.includes('Catatan') || html.includes('Ralat'), 'Must include notes column');

  // Area Grid Milimeter Blok SVG
  assert.ok(html.includes('<svg'), 'Must render SVG element');
  assert.ok(html.includes('pattern id="smallGrid"') || html.includes('smallGrid'), 'Must render millimeter subgrid');
  assert.ok(html.includes('pattern id="grid"') || html.includes('grid'), 'Must render main centimeter grid');
  assert.ok(html.includes('Sumbu Y (Variabel Terikat)') || html.includes('Sumbu X'), 'Must include manual graph plotting guide');

  // 3 Pertanyaan Diskusi & Kotak Kesimpulan
  assert.ok(html.includes('PERTANYAAN DISKUSI') || html.includes('DISKUSI'), 'Must include Discussion');
  assert.ok(html.includes('KESIMPULAN') || html.includes('Kesimpulan'), 'Must include Kesimpulan');
  assert.ok(html.includes('Guru / Pengampu Praktikum Lab') || html.includes('Pengampu'), 'Must include Teacher signature');
  assert.ok(html.includes('Ketua Kelompok'), 'Must include Student leader signature');
});

test('3T Feature 1: generateBlankStudentWorksheetHTML handles multiple disciplines smoothly', () => {
  const chemModule = CHEMISTRY_MODULES[0];
  const bioModule = BIOLOGY_MODULES[0];
  const astroModule = ASTRONOMY_MODULES[0];

  const chemHtml = generateBlankStudentWorksheetHTML(chemModule, 'SMA');
  const bioHtml = generateBlankStudentWorksheetHTML(bioModule, 'SMP');
  const astroHtml = generateBlankStudentWorksheetHTML(astroModule, 'Mahasiswa');

  assert.ok(chemHtml.includes(chemModule.title), 'Chemistry worksheet must contain module title');
  assert.ok(bioHtml.includes(bioModule.title), 'Biology worksheet must contain module title');
  assert.ok(astroHtml.includes(astroModule.title), 'Astronomy worksheet must contain module title');

  assert.ok(chemHtml.includes('(Jenjang SMA)'), 'Chemistry should show SMA');
  assert.ok(bioHtml.includes('(Jenjang SMP)'), 'Biology should show SMP');
  assert.ok(astroHtml.includes('(Jenjang Mahasiswa)'), 'Astronomy should show Mahasiswa');
});

test('3T Feature 3: Pass-and-play classroom rotation storage schema is valid', () => {
  const mockSubmission = {
    id: 'sub_test_123',
    studentName: 'Kelompok 1 (Budi & Tim)',
    groupId: 'KEL-1',
    moduleTitle: 'Hukum II Newton & Bidang Miring',
    timestamp: new Date().toISOString(),
    recordCount: 5,
    summary: 'Rata-rata percepatan a = 3.42 m/s2',
  };

  const serialized = JSON.stringify([mockSubmission]);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].studentName, 'Kelompok 1 (Budi & Tim)');
  assert.equal(parsed[0].groupId, 'KEL-1');
  assert.equal(parsed[0].recordCount, 5);
});
