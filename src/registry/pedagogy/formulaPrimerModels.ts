import type { FormulaPrimerModel } from '../../components/ui/InteractiveFormulaPrimer';

export const FORMULA_PRIMER_MODELS: Record<string, FormulaPrimerModel> = {
  // =========================================================================
  // FISIKA (10 MODUL)
  // =========================================================================
  'newton-incline': {
    moduleId: 'newton-incline',
    title: 'Intuisi Hukum II Newton',
    outcomeSymbol: 'a',
    outcomeLabel: 'Percepatan Balok',
    outcomeUnit: 'm/s²',
    variables: [
      {
        key: 'F',
        symbol: 'ΣF',
        label: 'Resultan Gaya Dorong',
        unit: 'N',
        min: 10,
        max: 100,
        step: 5,
        defaultValue: 40,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'appliedForce',
      },
      {
        key: 'm',
        symbol: 'm',
        label: 'Massa Beban',
        unit: 'kg',
        min: 1,
        max: 20,
        step: 1,
        defaultValue: 4,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'mass',
      },
    ],
    computeOutcome: (v) => Number((v.F / Math.max(0.5, v.m)).toFixed(2)),
    buildIntuitiveSentence: (activeVar, v, outcome) => {
      const fRatio = Number((v.F / 40).toFixed(1));
      const mRatio = Number((v.m / 4).toFixed(1));
      if (activeVar.key === 'F') {
        return `Jika resultan gaya ΣF diatur menjadi ${v.F} N (${fRatio}× nilai awal) pada massa ${v.m} kg, maka percepatan a berubah sebanding lurus menjadi ${outcome} m/s².`;
      }
      return `Jika massa beban m diperbesar menjadi ${v.m} kg (${mRatio}× lipat), inersia meningkat sehingga percepatan a melambat berbanding terbalik menjadi ${outcome} m/s².`;
    },
  },

  'projectile-motion': {
    moduleId: 'projectile-motion',
    title: 'Intuisi Jangkauan Gerak Parabola',
    outcomeSymbol: 'R',
    outcomeLabel: 'Jangkauan Mendatar',
    outcomeUnit: 'm',
    variables: [
      {
        key: 'v0',
        symbol: 'v₀',
        label: 'Kecepatan Awal',
        unit: 'm/s',
        min: 10,
        max: 50,
        step: 2,
        defaultValue: 24,
        role: 'quadratic',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'initialVelocity',
      },
      {
        key: 'theta',
        symbol: 'θ',
        label: 'Sudut Elevasi',
        unit: '°',
        min: 15,
        max: 75,
        step: 5,
        defaultValue: 45,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'launchAngle',
      },
    ],
    computeOutcome: (v) => {
      const rad = (2 * v.theta * Math.PI) / 180;
      return Number(((v.v0 * v.v0 * Math.sin(rad)) / 9.81).toFixed(1));
    },
    buildIntuitiveSentence: (activeVar, v, outcome) => {
      if (activeVar.key === 'v0') {
        return `Karena R ∝ v₀², kecepatan awal ${v.v0} m/s pada sudut ${v.theta}° melontarkan proyektil sejauh ${outcome} m; menggandakan v₀ melipatempatkan jaraknya.`;
      }
      return `Pada sudut elevasi θ = ${v.theta}° (sin 2θ = ${Math.sin((2 * v.theta * Math.PI) / 180).toFixed(2)}), jangkauan datar mencapai ${outcome} m dengan puncak optimum di 45°.`;
    },
  },

  'pendulum-harmonic': {
    moduleId: 'pendulum-harmonic',
    title: 'Intuisi Bandul Matematis',
    outcomeSymbol: 'T',
    outcomeLabel: 'Periode Ayunan',
    outcomeUnit: 's',
    variables: [
      {
        key: 'L',
        symbol: 'L',
        label: 'Panjang Tali Bandul',
        unit: 'm',
        min: 0.5,
        max: 8.0,
        step: 0.5,
        defaultValue: 2.0,
        role: 'sqrt',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'length',
      },
      {
        key: 'g',
        symbol: 'g',
        label: 'Gravitasi Planet',
        unit: 'm/s²',
        min: 1.6,
        max: 24.8,
        step: 0.2,
        defaultValue: 9.8,
        role: 'inverse',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'gravity',
      },
    ],
    computeOutcome: (v) => Number((2 * Math.PI * Math.sqrt(v.L / Math.max(0.5, v.g))).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      const lFactor = Number((v.L / 2.0).toFixed(1));
      const tFactor = Number(Math.sqrt(v.L / 2.0).toFixed(2));
      return `Jika panjang tali L diubah ${lFactor}x lipat (${v.L} m) pada gravitasi ${v.g} m/s², periode ayunan T menjadi ${outcome} s (${tFactor}x lipat terhadap L awal) karena T ∝ √(L/g).`;
    },
  },

  'spring-hooke': {
    moduleId: 'spring-hooke',
    title: 'Intuisi Hukum Hooke & Elastisitas',
    outcomeSymbol: 'F',
    outcomeLabel: 'Gaya Pemulih Pegas',
    outcomeUnit: 'N',
    variables: [
      {
        key: 'k',
        symbol: 'k',
        label: 'Konstanta Pegas',
        unit: 'N/m',
        min: 10,
        max: 200,
        step: 10,
        defaultValue: 50,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'springConstantK',
      },
      {
        key: 'dx',
        symbol: 'Δx',
        label: 'Simpangan Pegas',
        unit: 'm',
        min: 0.1,
        max: 2.0,
        step: 0.1,
        defaultValue: 0.5,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'springDisplacement',
      },
    ],
    computeOutcome: (v) => Number((v.k * v.dx).toFixed(1)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Jika pegas berkekakuan k = ${v.k} N/m ditarik sejauh Δx = ${v.dx} m, gaya pemulih meningkat linear menjadi ${outcome} N berlawanan arah simpangan.`,
  },

  'collision-momentum': {
    moduleId: 'collision-momentum',
    title: 'Intuisi Kekekalan Momentum Tumbukan',
    outcomeSymbol: 'v′',
    outcomeLabel: 'Kecepatan Gabungan (e = 0)',
    outcomeUnit: 'm/s',
    variables: [
      {
        key: 'm1',
        symbol: 'm₁',
        label: 'Massa Troli Penabrak',
        unit: 'kg',
        min: 1,
        max: 10,
        step: 0.5,
        defaultValue: 2,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'mass',
      },
      {
        key: 'v1',
        symbol: 'v₁',
        label: 'Kecepatan Awal Troli 1',
        unit: 'm/s',
        min: 1,
        max: 12,
        step: 0.5,
        defaultValue: 6,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'initialVelocity',
      },
      {
        key: 'm2',
        symbol: 'm₂',
        label: 'Massa Troli Target (Diam)',
        unit: 'kg',
        min: 1,
        max: 10,
        step: 0.5,
        defaultValue: 2,
        role: 'inverse',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'collisionMass2',
      },
    ],
    computeOutcome: (v) => Number(((v.m1 * v.v1) / Math.max(0.5, v.m1 + v.m2)).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Momentum awal p = ${(v.m1 * v.v1).toFixed(1)} kg·m/s dibagi ke massa total ${(v.m1 + v.m2).toFixed(1)} kg menghasilkan kecepatan pascatumbukan tak lenting ${outcome} m/s.`,
  },

  'stokes-viscosity': {
    moduleId: 'stokes-viscosity',
    title: 'Intuisi Kecepatan Terminal Stokes',
    outcomeSymbol: 'vₜ',
    outcomeLabel: 'Kecepatan Terminal Bola',
    outcomeUnit: 'cm/s',
    variables: [
      {
        key: 'r',
        symbol: 'r',
        label: 'Jari-jari Bola Baja',
        unit: 'mm',
        min: 1,
        max: 8,
        step: 0.5,
        defaultValue: 3,
        role: 'quadratic',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'ballRadiusMm',
      },
      {
        key: 'eta',
        symbol: 'η',
        label: 'Viskositas Fluida',
        unit: 'Pa·s',
        min: 0.2,
        max: 2.0,
        step: 0.1,
        defaultValue: 0.9,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'viscosityCoeff',
      },
    ],
    computeOutcome: (v) => {
      const rM = v.r / 1000;
      const vt = (2 * rM * rM * 9.81 * (7800 - 1260)) / (9 * Math.max(0.1, v.eta));
      return Number((vt * 100).toFixed(1));
    },
    buildIntuitiveSentence: (activeVar, v, outcome) => {
      if (activeVar.key === 'r') {
        return `Karena vₜ ∝ r², bola berjari-jari ${v.r} mm jatuh dengan kecepatan terminal ${outcome} cm/s; menggandakan radius melonjakkan kelajuan 4× lipat.`;
      }
      return `Semakin kental fluida (η = ${v.eta} Pa·s), hambatan gesek Stokes makin besar sehingga kecepatan terminal menyusut berbanding terbalik menjadi ${outcome} cm/s.`;
    },
  },

  'ohm-wheatstone': {
    moduleId: 'ohm-wheatstone',
    title: 'Intuisi Kesetimbangan Wheatstone',
    outcomeSymbol: 'Rₓ',
    outcomeLabel: 'Hambatan Uji Terukur',
    outcomeUnit: 'Ω',
    variables: [
      {
        key: 'R3',
        symbol: 'R₃',
        label: 'Resistor Kalibrasi',
        unit: 'Ω',
        min: 50,
        max: 500,
        step: 10,
        defaultValue: 220,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'resistor3',
      },
      {
        key: 'R2',
        symbol: 'R₂',
        label: 'Resistor Rasio Cabang 2',
        unit: 'Ω',
        min: 50,
        max: 400,
        step: 50,
        defaultValue: 100,
        role: 'independent',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'resistor2',
      },
      {
        key: 'R1',
        symbol: 'R₁',
        label: 'Resistor Rasio Cabang 1',
        unit: 'Ω',
        min: 50,
        max: 400,
        step: 50,
        defaultValue: 100,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'resistor1',
      },
    ],
    computeOutcome: (v) => Number(((v.R3 * v.R2) / Math.max(10, v.R1)).toFixed(1)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Ketika galvanometer tepat di nol (seimbang), rasio R₂/R₁ = ${(v.R2 / v.R1).toFixed(2)}× mengkalibrasi R₃ = ${v.R3} Ω menjadi hambatan uji Rₓ = ${outcome} Ω.`,
  },

  'optics-young-slit': {
    moduleId: 'optics-young-slit',
    title: 'Intuisi Interferensi Celah Ganda Young',
    outcomeSymbol: 'Δy',
    outcomeLabel: 'Jarak Antar Pita Terang',
    outcomeUnit: 'mm',
    variables: [
      {
        key: 'lam',
        symbol: 'λ',
        label: 'Panjang Gelombang Laser',
        unit: 'nm',
        min: 400,
        max: 700,
        step: 10,
        defaultValue: 650,
        role: 'independent',
        colorClass: 'text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10',
        paramKey: 'wavelengthNm',
      },
      {
        key: 'L',
        symbol: 'L',
        label: 'Jarak Celah ke Layar',
        unit: 'm',
        min: 0.5,
        max: 3.0,
        step: 0.25,
        defaultValue: 1.5,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'screenDistanceM',
      },
      {
        key: 'd',
        symbol: 'd',
        label: 'Jarak Antar Celah',
        unit: 'mm',
        min: 0.1,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.25,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'slitDistanceMm',
      },
    ],
    computeOutcome: (v) => Number((((v.lam * 1e-9 * v.L) / (v.d * 1e-3)) * 1000).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Cahaya λ = ${v.lam} nm melewati celah berjarak d = ${v.d} mm menuju layar L = ${v.L} m membentuk jarak pita terang Δy = ${outcome} mm (Δy = λ·L/d).`,
  },

  'photoelectric-planck': {
    moduleId: 'photoelectric-planck',
    title: 'Intuisi Kuanta Foton Einstein',
    outcomeSymbol: 'V₀',
    outcomeLabel: 'Potensial Henti Elektron',
    outcomeUnit: 'V',
    variables: [
      {
        key: 'lam',
        symbol: 'λ',
        label: 'Panjang Gelombang Cahaya',
        unit: 'nm',
        min: 200,
        max: 700,
        step: 10,
        defaultValue: 400,
        role: 'inverse',
        colorClass: 'text-violet-600 dark:text-violet-400 border-violet-500/40 bg-violet-500/10',
        paramKey: 'wavelengthNm',
      },
      {
        key: 'W0',
        symbol: 'W₀',
        label: 'Fungsi Kerja Logam',
        unit: 'eV',
        min: 1.8,
        max: 4.5,
        step: 0.1,
        defaultValue: 2.1,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'workFunctionEv',
      },
    ],
    computeOutcome: (v) => {
      const ePhoton = 1239.8 / Math.max(100, v.lam);
      return Number(Math.max(0, ePhoton - v.W0).toFixed(2));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      const ePhoton = Number((1239.8 / v.lam).toFixed(2));
      if (outcome <= 0) {
        return `Energi foton pada λ = ${v.lam} nm hanya ${ePhoton} eV (< fungsi kerja W₀ = ${v.W0} eV), sehingga tidak ada elektron foto yang terlepas (V₀ = 0 V).`;
      }
      return `Foton λ = ${v.lam} nm membawa energi ${ePhoton} eV; setelah dikurangi fungsi kerja ${v.W0} eV, sisa energi kinetik elektron menghasilkan potensial henti V₀ = ${outcome} V.`;
    },
  },

  'gravity-orbital': {
    moduleId: 'gravity-orbital',
    title: 'Intuisi Kecepatan Lepas Gravitasi',
    outcomeSymbol: 'v lepas',
    outcomeLabel: 'Kecepatan Lepas Planet',
    outcomeUnit: 'km/s',
    variables: [
      {
        key: 'M',
        symbol: 'M',
        label: 'Massa Planet (relatif Bumi)',
        unit: 'M⊕',
        min: 0.1,
        max: 10.0,
        step: 0.1,
        defaultValue: 1.0,
        role: 'sqrt',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
      },
      {
        key: 'R',
        symbol: 'R',
        label: 'Radius Planet (relatif Bumi)',
        unit: 'R⊕',
        min: 0.4,
        max: 4.0,
        step: 0.1,
        defaultValue: 1.0,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
      },
    ],
    computeOutcome: (v) => Number((11.186 * Math.sqrt(v.M / Math.max(0.2, v.R))).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Planet bermassa ${v.M} M⊕ dan radius ${v.R} R⊕ membutuhkan kecepatan lepas ${outcome} km/s (dan kecepatan orbit rendah ${(outcome / Math.SQRT2).toFixed(2)} km/s).`,
  },

  // =========================================================================
  // KIMIA (6 MODUL)
  // =========================================================================
  'thermo-calorimetry': {
    moduleId: 'thermo-calorimetry',
    title: 'Intuisi Kalorimetri & Termokimia',
    outcomeSymbol: 'q',
    outcomeLabel: 'Energi Kalor Larutan',
    outcomeUnit: 'kJ',
    variables: [
      {
        key: 'm',
        symbol: 'm',
        label: 'Massa Larutan Air',
        unit: 'g',
        min: 100,
        max: 500,
        step: 50,
        defaultValue: 200,
        role: 'independent',
        colorClass: 'text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10',
        paramKey: 'solutionVolumeMl',
      },
      {
        key: 'dT',
        symbol: 'ΔT',
        label: 'Kenaikan Suhu Larutan',
        unit: '°C',
        min: 2,
        max: 30,
        step: 1,
        defaultValue: 10,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
      },
    ],
    computeOutcome: (v) => Number(((v.m * 4.184 * v.dT) / 1000).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Memanaskan m = ${v.m} g larutan air (c = 4,184 J/g·°C) sebesar ΔT = ${v.dT} °C menyerap kalor reaksi q = m·c·ΔT = ${outcome} kJ.`,
  },

  'acid-base-titration': {
    moduleId: 'acid-base-titration',
    title: 'Intuisi Stoikiometri Titrasi',
    outcomeSymbol: 'Vₑ',
    outcomeLabel: 'Volume Titik Ekuivalen',
    outcomeUnit: 'mL',
    variables: [
      {
        key: 'Ma',
        symbol: 'Mₐ',
        label: 'Molaritas Analit Asam',
        unit: 'M',
        min: 0.05,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.2,
        role: 'independent',
        colorClass: 'text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10',
        paramKey: 'analyteAcidConc',
      },
      {
        key: 'Mb',
        symbol: 'Mᵦ',
        label: 'Molaritas Titran Basa',
        unit: 'M',
        min: 0.05,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.25,
        role: 'inverse',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'titrantBaseConc',
      },
    ],
    computeOutcome: (v) => Number(((v.Ma * 25) / Math.max(0.05, v.Mb)).toFixed(1)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Pada 25 mL asam bermolaritas Mₐ = ${v.Ma} M yang dititrasi basa Mᵦ = ${v.Mb} M, titik ekuivalen netralisasi tercapai tepat pada Vₑ = ${outcome} mL.`,
  },

  'redox-electrochemistry': {
    moduleId: 'redox-electrochemistry',
    title: 'Intuisi Persamaan Nernst Sel Daniell',
    outcomeSymbol: 'E sel',
    outcomeLabel: 'Potensial Sel Aktual',
    outcomeUnit: 'V',
    variables: [
      {
        key: 'Cu',
        symbol: '[Cu²⁺]',
        label: 'Konsentrasi Ion Katoda',
        unit: 'M',
        min: 0.01,
        max: 2.0,
        step: 0.05,
        defaultValue: 1.0,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'cathodeConcM',
      },
      {
        key: 'Zn',
        symbol: '[Zn²⁺]',
        label: 'Konsentrasi Ion Anoda',
        unit: 'M',
        min: 0.01,
        max: 2.0,
        step: 0.05,
        defaultValue: 1.0,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'anodeConcM',
      },
    ],
    computeOutcome: (v) => {
      const q = Math.max(0.001, v.Zn) / Math.max(0.001, v.Cu);
      return Number((1.1 - (0.0592 / 2) * Math.log10(q)).toFixed(3));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Dengan [Zn²⁺] = ${v.Zn} M dan [Cu²⁺] = ${v.Cu} M (Q = ${(v.Zn / v.Cu).toFixed(2)}), Persamaan Nernst menghasilkan tegangan sel ${outcome} V relatif terhadap E° = 1,100 V.`,
  },

  'ideal-gas-boyle': {
    moduleId: 'ideal-gas-boyle',
    title: 'Intuisi Persamaan Gas Ideal',
    outcomeSymbol: 'P',
    outcomeLabel: 'Tekanan Gas Silinder',
    outcomeUnit: 'atm',
    variables: [
      {
        key: 'T',
        symbol: 'T',
        label: 'Suhu Mutlak Gas',
        unit: 'K',
        min: 200,
        max: 600,
        step: 20,
        defaultValue: 300,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'temperatureK',
      },
      {
        key: 'V',
        symbol: 'V',
        label: 'Volume Silinder',
        unit: 'L',
        min: 4,
        max: 30,
        step: 1,
        defaultValue: 15,
        role: 'inverse',
        colorClass: 'text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10',
        paramKey: 'volumeL',
      },
    ],
    computeOutcome: (v) => Number(((1.0 * 0.08206 * v.T) / Math.max(1, v.V)).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Untuk 1,0 mol gas pada suhu T = ${v.T} K dalam ruang V = ${v.V} L, tekanan gas bernilai ${outcome} atm (berbanding lurus dengan T dan terbalik dengan V).`,
  },

  'reaction-kinetics-arrhenius': {
    moduleId: 'reaction-kinetics-arrhenius',
    title: 'Intuisi Laju Reaksi Arrhenius',
    outcomeSymbol: 'k',
    outcomeLabel: 'Konstanta Laju Relatif',
    outcomeUnit: '×10⁻³ s⁻¹',
    variables: [
      {
        key: 'T',
        symbol: 'T',
        label: 'Suhu Reaksi',
        unit: '°C',
        min: 10,
        max: 80,
        step: 5,
        defaultValue: 30,
        role: 'independent',
        colorClass: 'text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10',
        paramKey: 'temperatureC',
      },
      {
        key: 'Ea',
        symbol: 'Eₐ',
        label: 'Energi Aktivasi',
        unit: 'kJ/mol',
        min: 30,
        max: 80,
        step: 2,
        defaultValue: 52,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'activationEnergyKj',
      },
    ],
    computeOutcome: (v) => {
      const tK = v.T + 273.15;
      const k = 1e8 * Math.exp((-v.Ea * 1000) / (8.314 * tK));
      return Number((k * 1000).toFixed(2));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Pada suhu ${v.T} °C dan energi aktivasi Eₐ = ${v.Ea} kJ/mol (A = 10⁸ s⁻¹), konstanta laju mencapai ${outcome} ×10⁻³ s⁻¹; menurunkan Eₐ dengan katalis langsung mempercepat reaksi secara eksponensial.`,
  },

  'spectrophotometry-beer': {
    moduleId: 'spectrophotometry-beer',
    title: 'Intuisi Hukum Lambert-Beer',
    outcomeSymbol: 'A',
    outcomeLabel: 'Absorbansi Optik',
    outcomeUnit: '',
    variables: [
      {
        key: 'c',
        symbol: 'c',
        label: 'Konsentrasi Analit',
        unit: 'mM',
        min: 0.02,
        max: 0.25,
        step: 0.02,
        defaultValue: 0.08,
        role: 'independent',
        colorClass: 'text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10',
        paramKey: 'concentrationMm',
      },
      {
        key: 'b',
        symbol: 'b',
        label: 'Tebal Kuvet',
        unit: 'cm',
        min: 0.5,
        max: 2.5,
        step: 0.5,
        defaultValue: 1.0,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'pathLengthCm',
      },
    ],
    computeOutcome: (v) => Number((9500 * v.b * (v.c / 1000)).toFixed(3)),
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      const pctT = Number((Math.pow(10, -outcome) * 100).toFixed(1));
      return `Pada c = ${v.c} mM dan tebal kuvet b = ${v.b} cm (ε = 9500 L/(mol·cm)), absorbansi tak berdimensi naik linear ke A = ${outcome} sehingga hanya ${pctT}% cahaya yang lolos ke detektor.`;
    },
  },

  // =========================================================================
  // BIOLOGI & ANATOMI (7 MODUL)
  // =========================================================================
  'photosynthesis-ingenhousz': {
    moduleId: 'photosynthesis-ingenhousz',
    title: 'Intuisi Laju Fotosintesis Ingenhousz',
    outcomeSymbol: 'R',
    outcomeLabel: 'Laju Gelembung O₂',
    outcomeUnit: '/mnt',
    variables: [
      {
        key: 'I',
        symbol: 'I',
        label: 'Intensitas Cahaya',
        unit: 'lux',
        min: 200,
        max: 5000,
        step: 200,
        defaultValue: 1600,
        role: 'independent',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'lightIntensityLux',
      },
      {
        key: 'CO2',
        symbol: '[CO₂]',
        label: 'Kadar Bikarbonat',
        unit: 'g/L',
        min: 0.2,
        max: 4.0,
        step: 0.2,
        defaultValue: 1.0,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'bicarbonateConc',
      },
    ],
    computeOutcome: (v) => Number(((v.I / (v.I + 800)) * (v.CO2 / (v.CO2 + 0.5)) * 72).toFixed(1)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Saat intensitas foton I = ${v.I} lux dan [NaHCO₃] = ${v.CO2} g/L, kloroplas Hydrilla melepaskan ${outcome} gelembung O₂/menit sebelum mencapai titik jenuh enzim Rubisco.`,
  },

  'enzyme-catalase': {
    moduleId: 'enzyme-catalase',
    title: 'Intuisi Kinetika Enzim Katalase',
    outcomeSymbol: 'v',
    outcomeLabel: 'Laju Penguraian H₂O₂',
    outcomeUnit: 'μmol/(L·s)',
    variables: [
      {
        key: 'S',
        symbol: '[S]',
        label: 'Konsentrasi Substrat H₂O₂',
        unit: 'mM',
        min: 1,
        max: 25,
        step: 0.5,
        defaultValue: 4.5,
        role: 'independent',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'substrateConcMm',
      },
      {
        key: 'T',
        symbol: 'T',
        label: 'Suhu Inkubasi Enzim',
        unit: '°C',
        min: 10,
        max: 70,
        step: 3,
        defaultValue: 37,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'temperatureC',
      },
    ],
    computeOutcome: (v) => {
      const mm = (120 * v.S) / (4.5 + v.S);
      const thermal = v.T > 60 ? 0.04 : Math.exp(-Math.pow((v.T - 37) / 14, 2));
      return Number((mm * thermal).toFixed(1));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      if (v.T >= 60) {
        return `Pada suhu ${v.T} °C, struktur tersier katalase mengalami denaturasi permanen sehingga laju reaksi merosot drastis ke ${outcome} μmol/(L·s) meskipun substrat melimpah.`;
      }
      return `Pada substrat [H₂O₂] = ${v.S} mM (Kₘ = 4,5 mM) dan suhu ${v.T} °C, katalase bekerja pada kecepatan ${outcome} μmol/(L·s) dan memuncak di suhu tubuh optimum 37 °C.`;
    },
  },

  'osmosis-plasmolysis': {
    moduleId: 'osmosis-plasmolysis',
    title: 'Intuisi Potensial Osmotik van ’t Hoff',
    outcomeSymbol: 'Ψₛ',
    outcomeLabel: 'Potensial Zat Terlarut',
    outcomeUnit: 'MPa',
    variables: [
      {
        key: 'C',
        symbol: 'C',
        label: 'Molaritas Sukrosa',
        unit: 'M',
        min: 0.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.4,
        role: 'independent',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'sucroseConcMolar',
      },
      {
        key: 'T',
        symbol: 'T',
        label: 'Suhu Larutan',
        unit: '°C',
        min: 10,
        max: 45,
        step: 5,
        defaultValue: 25,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'solutionTempC',
      },
    ],
    computeOutcome: (v) => Number((-1 * v.C * 0.008314 * (v.T + 273.15)).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      const state = v.C < 0.26 ? 'hipotonik (sel turgid)' : v.C <= 0.31 ? 'isotonik (setimbang)' : 'hipertonik (plasmolisis)';
      return `Larutan sukrosa ${v.C} M pada ${v.T} °C memiliki potensial zat terlarut Ψₛ = ${outcome} MPa, bersifat ${state} bagi jaringan kentang.`;
    },
  },

  'predator-prey-dynamics': {
    moduleId: 'predator-prey-dynamics',
    title: 'Intuisi Ekuilibrium Lotka-Volterra',
    outcomeSymbol: 'y*',
    outcomeLabel: 'Predator Setimbang',
    outcomeUnit: 'ind',
    variables: [
      {
        key: 'alpha',
        symbol: 'α',
        label: 'Laju Lahir Mangsa',
        unit: '/siklus',
        min: 0.2,
        max: 1.6,
        step: 0.1,
        defaultValue: 0.8,
        role: 'independent',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'preyGrowthRateAlpha',
      },
      {
        key: 'beta',
        symbol: 'β',
        label: 'Efisiensi Predasi',
        unit: '/ind',
        min: 0.01,
        max: 0.1,
        step: 0.01,
        defaultValue: 0.04,
        role: 'inverse',
        colorClass: 'text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10',
        paramKey: 'predationRateBeta',
      },
    ],
    computeOutcome: (v) => Number((v.alpha / Math.max(0.01, v.beta)).toFixed(1)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Dengan laju tumbuh mangsa α = ${v.alpha} dan koefisien predasi β = ${v.beta}, ekosistem mencapai keseimbangan populasi predator pada y* = α/β = ${outcome} individu.`,
  },

  'anatomy-cardiovascular-heart': {
    moduleId: 'anatomy-cardiovascular-heart',
    title: 'Intuisi Hemodinamika & Curah Jantung',
    outcomeSymbol: 'CO',
    outcomeLabel: 'Curah Jantung',
    outcomeUnit: 'L/mnt',
    variables: [
      {
        key: 'HR',
        symbol: 'HR',
        label: 'Denyut Jantung',
        unit: 'bpm',
        min: 50,
        max: 170,
        step: 5,
        defaultValue: 75,
        role: 'independent',
        colorClass: 'text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10',
        paramKey: 'heartRateBpm',
      },
      {
        key: 'r',
        symbol: 'r/r₀',
        label: 'Rasio Radius Arteri',
        unit: 'relatif',
        min: 0.5,
        max: 1.2,
        step: 0.05,
        defaultValue: 1.0,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'vesselRadiusRatio',
      },
    ],
    computeOutcome: (v) => {
      const sv = 70 * Math.min(1.15, Math.pow(v.r, 0.5));
      return Number(((v.HR * sv) / 1000).toFixed(2));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      const resFactor = Number((1 / Math.pow(Math.max(0.4, v.r), 4)).toFixed(1));
      return `Pada HR = ${v.HR} bpm dan radius arteri ${v.r}× normal, resistensi pembuluh menjadi ${resFactor}× lipat (Hukum Poiseuille 1/r⁴) dengan Curah Jantung ${outcome} L/menit.`;
    },
  },

  'anatomy-respiratory-lungs': {
    moduleId: 'anatomy-respiratory-lungs',
    title: 'Intuisi Ventilasi Menit Paru-Paru',
    outcomeSymbol: 'MV',
    outcomeLabel: 'Ventilasi Menit',
    outcomeUnit: 'L/mnt',
    variables: [
      {
        key: 'RR',
        symbol: 'RR',
        label: 'Frekuensi Napas',
        unit: '/mnt',
        min: 8,
        max: 34,
        step: 2,
        defaultValue: 14,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'respirationRate',
      },
      {
        key: 'effort',
        symbol: 'TV',
        label: 'Volume Tidal Napas',
        unit: 'mL',
        min: 250,
        max: 900,
        step: 50,
        defaultValue: 500,
        role: 'independent',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
      },
    ],
    computeOutcome: (v) => Number(((v.RR * v.effort) / 1000).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Menarik napas ${v.RR} kali/menit dengan volume tidal ${v.effort} mL mengalirkan total ${outcome} L udara segar per menit melintasi saluran pernapasan.`,
  },

  'anatomy-neural-synapse': {
    moduleId: 'anatomy-neural-synapse',
    title: 'Intuisi Konduksi Saltatorik Neuron',
    outcomeSymbol: 'v',
    outcomeLabel: 'Kecepatan Impuls Akson',
    outcomeUnit: 'm/s',
    variables: [
      {
        key: 'myelin',
        symbol: 'Mielin',
        label: 'Ketebalan Selubung Mielin',
        unit: '%',
        min: 0,
        max: 100,
        step: 10,
        defaultValue: 80,
        role: 'independent',
        colorClass: 'text-violet-600 dark:text-violet-400 border-violet-500/40 bg-violet-500/10',
        paramKey: 'myelinThickness',
      },
      {
        key: 'stim',
        symbol: 'V stim',
        label: 'Tegangan Stimulus',
        unit: 'mV',
        min: -70,
        max: -20,
        step: 5,
        defaultValue: -45,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'stimulusVoltageMv',
      },
    ],
    computeOutcome: (v) => {
      if (v.stim < -55) return 0;
      return Number((2 + v.myelin * 1.05).toFixed(1));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      if (v.stim < -55) {
        return `Stimulus ${v.stim} mV masih di bawah ambang −55 mV, sehingga sesuai Hukum All-or-None potensial aksi gagal terbentuk (0 m/s).`;
      }
      return `Stimulus ${v.stim} mV melampaui ambang −55 mV! Dengan mielin ${v.myelin}%, konduksi saltatorik melesatkan potensial aksi pada ${outcome} m/s.`;
    },
  },

  // =========================================================================
  // ASTRONOMI (5 MODUL)
  // =========================================================================
  'solar-kepler': {
    moduleId: 'solar-kepler',
    title: 'Intuisi Hukum III Kepler',
    outcomeSymbol: 'T',
    outcomeLabel: 'Periode Orbit Planet',
    outcomeUnit: 'thn',
    variables: [
      {
        key: 'a',
        symbol: 'a',
        label: 'Sumbu Semi-Mayor Orbit',
        unit: 'AU',
        min: 0.4,
        max: 10.0,
        step: 0.2,
        defaultValue: 1.0,
        role: 'quadratic',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'customSemiMajorAxisAu',
      },
      {
        key: 'Mstar',
        symbol: 'M*',
        label: 'Massa Bintang Induk',
        unit: 'M☉',
        min: 0.5,
        max: 4.0,
        step: 0.1,
        defaultValue: 1.0,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'centralStarMassSolar',
      },
    ],
    computeOutcome: (v) => Number(Math.sqrt(Math.pow(v.a, 3) / Math.max(0.2, v.Mstar)).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Jika jarak orbit a = ${v.a} AU mengelilingi bintang bermassa ${v.Mstar} M☉, periode revolusi T memerlukan ${outcome} tahun Bumi karena T² = a³/M*.`,
  },

  'milky-way-rotation': {
    moduleId: 'milky-way-rotation',
    title: 'Intuisi Kurva Rotasi Galaksi & Materi Gelap',
    outcomeSymbol: 'v obs',
    outcomeLabel: 'Kecepatan Rotasi Bintang',
    outcomeUnit: 'km/s',
    variables: [
      {
        key: 'r',
        symbol: 'r',
        label: 'Radius Galaktosentris',
        unit: 'kpc',
        min: 2,
        max: 25,
        step: 1,
        defaultValue: 10,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'galactocentricRadiusKpc',
      },
      {
        key: 'dm',
        symbol: 'f DM',
        label: 'Fraksi Halo Materi Gelap',
        unit: '×',
        min: 0.0,
        max: 1.5,
        step: 0.1,
        defaultValue: 1.0,
        role: 'independent',
        colorClass: 'text-violet-600 dark:text-violet-400 border-violet-500/40 bg-violet-500/10',
        paramKey: 'darkMatterHaloFraction',
      },
    ],
    computeOutcome: (v) => {
      const vVis2 = (260000 / Math.max(2, v.r)) * (1 - Math.exp(-v.r / 3));
      const vDm2 = v.dm * 38000 * (v.r / (v.r + 3.5));
      return Number(Math.sqrt(vVis2 + vDm2).toFixed(0));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Pada radius r = ${v.r} kpc dengan kontribusi halo materi gelap ${v.dm}×, kecepatan rotasi bintang bertahan di ${outcome} km/s (bandingkan saat f DM = 0 ketika kurva jatuh Keplerian).`,
  },

  'exoplanet-transit': {
    moduleId: 'exoplanet-transit',
    title: 'Intuisi Kedalaman Transit Eksoplanet',
    outcomeSymbol: 'ΔF/F',
    outcomeLabel: 'Penurunan Fluks Bintang',
    outcomeUnit: '%',
    variables: [
      {
        key: 'Rp',
        symbol: 'Rₚ',
        label: 'Radius Eksoplanet',
        unit: 'R⊕',
        min: 1,
        max: 16,
        step: 1,
        defaultValue: 11,
        role: 'quadratic',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'exoplanetRadiusEarth',
      },
      {
        key: 'Rs',
        symbol: 'R*',
        label: 'Radius Bintang Induk',
        unit: 'R☉',
        min: 0.4,
        max: 2.0,
        step: 0.1,
        defaultValue: 1.0,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'starRadiusSolar',
      },
    ],
    computeOutcome: (v) => Number((Math.pow(v.Rp / (v.Rs * 109.1), 2) * 100).toFixed(3)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Planet berjari-jari ${v.Rp} R⊕ yang melintas di depan bintang ${v.Rs} R☉ meredupkan kecerlangan bintang sebesar ${outcome}% (${Math.round(outcome * 10000)} ppm).`,
  },

  'stellar-wien-spectrum': {
    moduleId: 'stellar-wien-spectrum',
    title: 'Intuisi Hukum Pergeseran Wien',
    outcomeSymbol: 'λ maks',
    outcomeLabel: 'Puncak Spektrum Bintang',
    outcomeUnit: 'nm',
    variables: [
      {
        key: 'T',
        symbol: 'T',
        label: 'Suhu Efektif Fotosfer',
        unit: 'K',
        min: 3000,
        max: 20000,
        step: 500,
        defaultValue: 5800,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'starEffectiveTempK',
      },
    ],
    computeOutcome: (v) => Math.round(2897772 / Math.max(1000, v.T)),
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      const band =
        outcome < 380
          ? 'ultraviolet (bintang biru sangat panas kelas O/B)'
          : outcome <= 470
          ? 'ungu-biru (bintang putih-biru kelas A/F)'
          : outcome <= 560
          ? 'hijau-kuning (bintang putih kekuningan setipe Matahari, kelas G)'
          : outcome <= 750
          ? 'jingga-merah (bintang dingin kelas K)'
          : 'inframerah dekat (bintang kerdil/raksasa merah kelas M)';
      return `Pada suhu fotosfer T = ${v.T} K, puncak pancaran benda hitam bergeser ke λ maks = ${outcome} nm di spektrum ${band}.`;
    },
  },

  'hubble-expansion': {
    moduleId: 'hubble-expansion',
    title: 'Intuisi Hukum Ekspansi Hubble',
    outcomeSymbol: 'v',
    outcomeLabel: 'Kecepatan Resesi Galaksi',
    outcomeUnit: 'km/s',
    variables: [
      {
        key: 'd',
        symbol: 'd',
        label: 'Jarak Galaksi',
        unit: 'Mpc',
        min: 20,
        max: 500,
        step: 20,
        defaultValue: 200,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'galaxyDistanceMpc',
      },
      {
        key: 'H0',
        symbol: 'H₀',
        label: 'Konstanta Hubble',
        unit: 'km/s/Mpc',
        min: 60,
        max: 80,
        step: 1,
        defaultValue: 70,
        role: 'independent',
        colorClass: 'text-violet-600 dark:text-violet-400 border-violet-500/40 bg-violet-500/10',
        paramKey: 'hubbleConstantH0',
      },
    ],
    computeOutcome: (v) => Math.round(v.H0 * v.d),
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      const z = (outcome / 299792).toFixed(4);
      return `Galaksi sejauh d = ${v.d} Mpc dengan H₀ = ${v.H0} km/s/Mpc menjauh pada v = ${outcome} km/s, menghasilkan pergeseran merah kosmologis z ≈ ${z}.`;
    },
  },

  'standing-wave-melde': {
    moduleId: 'standing-wave-melde',
    title: 'Intuisi Cepat Rambat Gelombang Melde',
    outcomeSymbol: 'v',
    outcomeLabel: 'Cepat Rambat Dawai',
    outcomeUnit: 'm/s',
    variables: [
      {
        key: 'F',
        symbol: 'F',
        label: 'Gaya Tegangan Dawai',
        unit: 'N',
        min: 5,
        max: 100,
        step: 5,
        defaultValue: 20,
        role: 'sqrt',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
      },
      {
        key: 'mu',
        symbol: 'μ',
        label: 'Rapat Massa Linier',
        unit: 'g/m',
        min: 1,
        max: 20,
        step: 1,
        defaultValue: 5,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
      },
    ],
    computeOutcome: (v) => Number(Math.sqrt(v.F / Math.max(0.0005, v.mu / 1000)).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Dengan tegangan dawai F = ${v.F} N dan rapat massa linier μ = ${v.mu} g/m, gelombang transversal merambat pada kelajuan v = √(F/μ) = ${outcome} m/s.`,
  },

  'chemical-equilibrium-lechatelier': {
    moduleId: 'chemical-equilibrium-lechatelier',
    title: 'Intuisi Pergeseran Kesetimbangan Le Chatelier',
    outcomeSymbol: '%NO₂',
    outcomeLabel: 'Fraksi Gas NO₂ Cokelat',
    outcomeUnit: '%',
    variables: [
      {
        key: 'T',
        symbol: 'T',
        label: 'Suhu Reaktor',
        unit: '°C',
        min: 0,
        max: 100,
        step: 5,
        defaultValue: 25,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'equilibriumTempC',
      },
      {
        key: 'P',
        symbol: 'P',
        label: 'Tekanan Total Sistem',
        unit: 'atm',
        min: 0.2,
        max: 5.0,
        step: 0.2,
        defaultValue: 1.0,
        role: 'inverse',
        colorClass: 'text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10',
        paramKey: 'equilibriumPressureAtm',
      },
    ],
    computeOutcome: (v) => {
      const tK = v.T + 273.15;
      const kp = 0.148 * Math.exp((-57200 / 8.314) * (1 / tK - 1 / 298.15));
      const alpha = Math.sqrt(kp / (kp + 4 * Math.max(0.1, v.P)));
      return Number(((2 * alpha) / (1 + alpha) * 100).toFixed(1));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Pada suhu ${v.T} °C dan tekanan ${v.P} atm, disosiasi endotermik N₂O₄ ⇌ 2 NO₂ menghasilkan ${outcome}% gas NO₂ cokelat kemerahan di dalam reaktor.`,
  },

  'mendel-genetics-dihybrid': {
    moduleId: 'mendel-genetics-dihybrid',
    title: 'Intuisi Rasio Dihibrid Mendel 9:3:3:1',
    outcomeSymbol: 'E(RY)',
    outcomeLabel: 'Harapan Biji Bulat-Kuning',
    outcomeUnit: 'biji',
    variables: [
      {
        key: 'N',
        symbol: 'N',
        label: 'Total Populasi Biji F₂',
        unit: 'biji',
        min: 32,
        max: 640,
        step: 16,
        defaultValue: 160,
        role: 'independent',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'sampleSizeN',
      },
      {
        key: 'pR',
        symbol: 'p(R)',
        label: 'Frekuensi Gamet Alel R',
        unit: '',
        min: 0.2,
        max: 0.8,
        step: 0.05,
        defaultValue: 0.5,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'dominantAlleleFreqR',
      },
    ],
    computeOutcome: (v) => {
      const probRound = 1 - Math.pow(1 - v.pR, 2);
      const probYellow = 0.75;
      return Math.round(v.N * probRound * probYellow);
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Dari total N = ${v.N} biji F₂ dengan frekuensi alel gamet p(R) = ${v.pR}, jumlah biji dominan ganda Bulat-Kuning diperkirakan mencapai ${outcome} biji (9/16N saat p(R) = 0,50).`,
  },

  'planetary-atmosphere-greenhouse': {
    moduleId: 'planetary-atmosphere-greenhouse',
    title: 'Intuisi Suhu Permukaan & Efek Rumah Kaca',
    outcomeSymbol: 'Tₛ',
    outcomeLabel: 'Suhu Permukaan Planet',
    outcomeUnit: '°C',
    variables: [
      {
        key: 'A',
        symbol: 'A',
        label: 'Albedo Pantulan Planet',
        unit: '',
        min: 0.05,
        max: 0.85,
        step: 0.05,
        defaultValue: 0.30,
        role: 'inverse',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'planetaryAlbedo',
      },
      {
        key: 'co2',
        symbol: 'CO₂',
        label: 'Konsentrasi Gas Rumah Kaca',
        unit: 'ppm',
        min: 100,
        max: 2500,
        step: 50,
        defaultValue: 420,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'greenhouseGasPpm',
      },
    ],
    computeOutcome: (v) => {
      const absorbed = (1361 * (1 - v.A)) / 4;
      const tEq = Math.pow(absorbed / 5.670374e-8, 0.25);
      const eps = Math.max(0.05, Math.min(0.97, 0.78 + 0.085 * Math.log(v.co2 / 420)));
      const tS = tEq * Math.pow(2 / (2 - eps), 0.25);
      return Number((tS - 273.15).toFixed(1));
    },
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Dengan albedo A = ${v.A} dan kadar CO₂ = ${v.co2} ppm, efek rumah kaca menahan radiasi inframerah sehingga suhu rata-rata permukaan planet stabil di ${outcome} °C.`,
  },
};

