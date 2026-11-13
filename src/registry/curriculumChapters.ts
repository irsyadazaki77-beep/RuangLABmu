export type CompetencyTier = 'Dasar (SMP)' | 'Menengah (SMA)' | 'Lanjut (Mahasiswa / OSN)';

export interface CurriculumChapter {
  id: string;
  chapterNumber: number;
  title: string;
  shortTitle: string;
  domain: 'fisika' | 'kimia' | 'biologi' | 'astronomi' | 'sains-terpadu';
  competencyTier: CompetencyTier;
  targetGrades: string;
  overviewDescription: string;
  coreCompetencies: string[];
  prerequisites: string[];
  moduleIds: string[];
  realWorldTheme: string;
}

export const CURRICULUM_CHAPTERS: CurriculumChapter[] = [
  {
    id: 'bab-1-kinematika-dinamika',
    chapterNumber: 1,
    title: 'Bab 1: Kinematika & Dinamika Gerak Klasik',
    shortTitle: 'Bab 1: Dinamika Gerak',
    domain: 'fisika',
    competencyTier: 'Dasar (SMP)',
    targetGrades: 'SMP Kelas 7-8 & SMA Kelas 10',
    overviewDescription:
      'Mempelajari dasar gerak translasi, pengaruh gaya resultan pada percepatan benda (Hukum II Newton), gerak lengkung dua dimensi (parabola), serta tarikan gravitasi universal antarbenda.',
    coreCompetencies: [
      'Menghubungkan resultan gaya, massa, dan percepatan (ΣF = m·a) serta pengaruh gesekan pada bidang miring.',
      'Membedakan gerak lurus beraturan (GLB horizontal) dan GLBB vertikal pada trajektori peluru.',
      'Menghitung kecepatan lepas minimum wahana antariksa dari sumur potensial gravitasi planet.',
    ],
    prerequisites: ['Operasi aljabar dasar', 'Trigonometri sudut istimewa (sin, cos)'],
    moduleIds: ['newton-incline', 'projectile-motion', 'gravity-orbital'],
    realWorldTheme: 'Rekayasa transportasi, roket luar angkasa & keselamatan lereng perbukitan',
  },
  {
    id: 'bab-2-getaran-fluida',
    chapterNumber: 2,
    title: 'Bab 2: Getaran Harmonik, Elastisitas & Dinamika Fluida',
    shortTitle: 'Bab 2: Getaran & Fluida',
    domain: 'fisika',
    competencyTier: 'Menengah (SMA)',
    targetGrades: 'SMA Kelas 11 & Kuliah Fisika Dasar',
    overviewDescription:
      'Mengkaji osilasi periodik bandul matematis, sifat pemulih pegas elastik Hooke, perambatan energi mekanik, dan gaya gesek kental dalam aliran fluida laminar.',
    coreCompetencies: [
      'Membuktikan hubungan periode ayunan bandul sederhana terhadap panjang tali dan percepatan gravitasi.',
      'Menentukan konstanta elastisitas pegas (k) serta hukum kekekalan energi potensial pegas.',
      'Mengukur viskositas zat cair dan kecepatan terminal jatuh bebas menggunakan Hukum Stokes.',
    ],
    prerequisites: ['Kinematika GLB/GLBB', 'Konsep massa jenis fluida'],
    moduleIds: ['pendulum-harmonic', 'spring-hooke', 'stokes-viscosity'],
    realWorldTheme: 'Sistem suspensi kendaraan, jam pendulum presisi & pelumas mesin industri',
  },
  {
    id: 'bab-3-gelombang-kuantum',
    chapterNumber: 3,
    title: 'Bab 3: Gelombang, Optika Fisik & Fisika Kuantum',
    shortTitle: 'Bab 3: Gelombang & Kuantum',
    domain: 'fisika',
    competencyTier: 'Lanjut (Mahasiswa / OSN)',
    targetGrades: 'SMA Kelas 12, Olimpiade Fisika & Mahasiswa Fisika/Teknik',
    overviewDescription:
      'Menyelidiki fenomena interferensi gelombang cahaya celah ganda Young, dualisme gelombang-partikel cahaya pada efek fotolistrik Planck, serta hukum kekekalan momentum tumbukan 1D.',
    coreCompetencies: [
      'Menghitung panjang gelombang monokromatik cahaya dari pola pita terang-gelap celah ganda.',
      'Menganalisis frekuensi ambang f0 dan penentuan konstanta Planck (h) melalui potensial henti elektron foto.',
      'Menganalisis koefisien elastisitas restitusi (e) dan disipasi energi kinetik pada tabrakan.',
    ],
    prerequisites: ['Gelombang transversal', 'Konsep kuantum foton'],
    moduleIds: ['collision-momentum', 'ohm-wheatstone', 'optics-young-slit', 'photoelectric-planck'],
    realWorldTheme: 'Sensor panel surya fotovoltaik, serat optik telekomunikasi & jembatan pengukuran listrik',
  },
  {
    id: 'bab-4-termodinamika-kinetika',
    chapterNumber: 4,
    title: 'Bab 4: Termodinamika & Kinetika Reaksi Kimia',
    shortTitle: 'Bab 4: Termodinamika & Kinetika',
    domain: 'kimia',
    competencyTier: 'Menengah (SMA)',
    targetGrades: 'SMA Kelas 11 & Kuliah Kimia Dasar',
    overviewDescription:
      'Mengevaluasi transfer energi termal reaksi kimia (kalorimetri), hukum kompresi gas ideal Boyle-Gay Lussac, serta pengaruh temperatur dan energi aktivasi terhadap kecepatan reaksi.',
    coreCompetencies: [
      'Menghitung perubahan entalpi reaksi standar (ΔH) dan energi bebas Gibbs (ΔG) pada netralisasi asam-basa.',
      'Membuktikan hubungan tekanan dan volume gas ideal pada proses isotermal dan adiabatik.',
      'Menentukan energi aktivasi (Ea) menggunakan plot linier Persamaan Svante Arrhenius.',
    ],
    prerequisites: ['Stoikiometri mol', 'Konsep suhu mutlak Kelvin'],
    moduleIds: ['thermo-calorimetry', 'ideal-gas-boyle', 'reaction-kinetics-arrhenius'],
    realWorldTheme: 'Pemanas ramah lingkungan, motor bakar kompresi piston & preservasi makanan suhu rendah',
  },
  {
    id: 'bab-5-larutan-elektrokimia',
    chapterNumber: 5,
    title: 'Bab 5: Larutan, Titrasi Volumetri & Elektrokimia Modern',
    shortTitle: 'Bab 5: Titrasi & Elektrokimia',
    domain: 'kimia',
    competencyTier: 'Lanjut (Mahasiswa / OSN)',
    targetGrades: 'SMA Kelas 11-12 & Mahasiswa Kimia/Farmasi/Teknik Kimia',
    overviewDescription:
      'Melakukan analisis volumetri presisi kuantitatif asam-basa, konversi energi kimia menjadi listrik pada sel Volta Daniell, serta spektrometri absorbansi sinar UV-Vis.',
    coreCompetencies: [
      'Menentukan titik ekuivalen netralisasi dan perubahan pH larutan melalui titrasi sigmoidal.',
      'Menghitung potensial sel non-standar menggunakan Persamaan Nernst dan deret kereaktifan Volta.',
      'Menerapkan Hukum Lambert-Beer (A = ε·b·c) untuk analisis konsentrasi zat terlarut berwarna.',
    ],
    prerequisites: ['Konsep pH dan asam basa', 'Penyetaraan reaksi redoks'],
    moduleIds: ['acid-base-titration', 'redox-electrochemistry', 'spectrophotometry-beer'],
    realWorldTheme: 'Industri baterai kendaraan listrik nikel, pengolahan air bersih & uji laboratorium klinis',
  },
  {
    id: 'bab-6-fisiologi-biokimia',
    chapterNumber: 6,
    title: 'Bab 6: Fisiologi Sel, Enzimologi & Ekologi Kuantitatif',
    shortTitle: 'Bab 6: Sel & Enzim',
    domain: 'biologi',
    competencyTier: 'Dasar (SMP)',
    targetGrades: 'SMP Kelas 8-9 & SMA Kelas 11-12',
    overviewDescription:
      'Mengamati bioproses fotosintesis pada daun Hydrilla, kerja enzim katalase penangkal radikal bebas, transportasi air osmotik membran sel, dan model populasi rantai makanan.',
    coreCompetencies: [
      'Membuktikan pembentukan gas oksigen pada reaksi fotosintesis serta faktor pembatasnya (cahaya, CO2, suhu).',
      'Menganalisis kinetika enzim Michaelis-Menten dan fenomena denaturasi protein akibat suhu tinggi.',
      'Memprediksi potensial air, turgiditas, dan plasmolisis pada jaringan tumbuhan dalam larutan hipertonik.',
      'Memodelkan siklus osilasi populasi mangsa dan pemangsa menggunakan persamaan Lotka-Volterra.',
    ],
    prerequisites: ['Struktur sel tumbuhan & hewan', 'Konsep rantai makanan'],
    moduleIds: ['photosynthesis-ingenhousz', 'enzyme-catalase', 'osmosis-plasmolysis', 'predator-prey-dynamics'],
    realWorldTheme: 'Pertanian hidroponik modern, bioteknologi fermentasi & konservasi satwa liar Indonesia',
  },
  {
    id: 'bab-7-anatomi-manusia',
    chapterNumber: 7,
    title: 'Bab 7: Anatomi Manusia 3D & Sistem Fisiologi Organ',
    shortTitle: 'Bab 7: Anatomi 3D',
    domain: 'biologi',
    competencyTier: 'Menengah (SMA)',
    targetGrades: 'SMA Kelas 11 & Mahasiswa Kedokteran/Kesehatan',
    overviewDescription:
      'Eksplorasi spasial interaktif 3D jantung berdenyut, dinamika vaskular Poiseuille, mekanisme pernapasan paru-paru barometrik, dan perambatan impuls listrik potensial aksi neuron.',
    coreCompetencies: [
      'Menganalisis curah jantung (CO = HR × SV) dan lonjakan resistensi vaskular akibat penyempitan lumen arteri.',
      'Menghitung ventilasi semenit paru-paru dan penurunan saturasi oksigen darah (SpO2) di dataran tinggi.',
      'Membuktikan prinsip All-or-None dan peningkatan kecepatan rambat konduksi saltatorik pada sel saraf bermielin.',
    ],
    prerequisites: ['Sistem peredaran darah, pernapasan, dan koordinasi manusia'],
    moduleIds: ['anatomy-cardiovascular-heart', 'anatomy-respiratory-lungs', 'anatomy-neural-synapse'],
    realWorldTheme: 'Diagnosis medis kardiologi, adaptasi pendaki gunung tinggi & ilmu bedah saraf',
  },
  {
    id: 'bab-8-astrofisika-kosmologi',
    chapterNumber: 8,
    title: 'Bab 8: Astrofisika Observasional & Kosmologi Modern',
    shortTitle: 'Bab 8: Astrofisika',
    domain: 'astronomi',
    competencyTier: 'Lanjut (Mahasiswa / OSN)',
    targetGrades: 'SMA Kelas 10-12, Olimpiade Sains Nasional (OSN) & Mahasiswa Astronomi',
    overviewDescription:
      'Menjelajahi dinamika orbit Tata Surya Hukum Kepler, bukti empiris keberadaan halo materi gelap (Dark Matter), fotometri pencarian eksoplanet baru, suhu bintang Wien, dan ekspansi ruang waktu Hubble.',
    coreCompetencies: [
      'Membuktikan Hukum III Kepler (T² ∝ a³) dan menghitung kecepatan gerak planet di perihelion/aphelion.',
      'Menganalisis kurva rotasi galaksi spiral datar sebagai bukti keberadaan materi gelap non-barionik.',
      'Menentukan radius eksoplanet baru dari penurunan fluks cahaya transit bintang induk.',
      'Mengklasifikasikan kelas spektral bintang Harvard dan menghitung kecepatan resesi galaksi (v = H0·d).',
    ],
    prerequisites: ['Gravitasi Newton', 'Spektrum gelombang elektromagnetik'],
    moduleIds: ['solar-kepler', 'milky-way-rotation', 'exoplanet-transit', 'stellar-wien-spectrum', 'hubble-expansion'],
    realWorldTheme: 'Eksplorasi wahana antariksa, observatorium Bosscha/Timau NTT & pencarian kehidupan ekstrasurya',
  },
];

export function getChapterByModuleId(moduleId: string): CurriculumChapter | undefined {
  return CURRICULUM_CHAPTERS.find((ch) => ch.moduleIds.includes(moduleId));
}

export function getChaptersByTier(tier: CompetencyTier | 'Semua'): CurriculumChapter[] {
  if (tier === 'Semua') return CURRICULUM_CHAPTERS;
  return CURRICULUM_CHAPTERS.filter((ch) => ch.competencyTier === tier);
}
