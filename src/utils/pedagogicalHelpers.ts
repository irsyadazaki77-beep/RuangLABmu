import type { AcademicLevel } from './scienceEngine';
import type { ExperimentRecord } from './scienceEngine';
import {
  computeRecordsRegressionSummary,
  type RecordsRegressionSummary,
} from './labTelemetryHelpers';

export type EducationLevel = AcademicLevel;

export interface GlossaryEntry {
  id: string;
  term: string;
  displayTitle: string;
  category: 'Statistika & Data' | 'Fisika & Astronomi' | 'Kimia' | 'Biologi & Fisiologi';
  explanation: string;
  analogy: string;
  aliases: string[];
}

export const SCIENCE_GLOSSARY: GlossaryEntry[] = [
  {
    id: 'r-squared',
    term: 'R²',
    displayTitle: 'Koefisien Determinasi (R²)',
    category: 'Statistika & Data',
    explanation:
      'Angka antara 0 sampai 1 (atau 0%–100%) yang menunjukkan seberapa rapi dan konsisten titik-titik datamu mengikuti garis tren lurus.',
    analogy:
      'Bayangkan menempelkan penggaris di atas deretan titik hasil ukur: jika hampir semua titik menempel pas di penggaris, R² mendekati 1 (100%).',
    aliases: ['r2', 'r^2', 'r-squared', 'koefisien determinasi', 'r²'],
  },
  {
    id: 'slope-gradien',
    term: 'Slope/Gradien',
    displayTitle: 'Slope / Gradien (Kemiringan Garis)',
    category: 'Statistika & Data',
    explanation:
      'Angka kemiringan grafik (m) yang menunjukkan seberapa besar perubahan Y setiap kali X naik 1 satuan. Positif berarti ikut naik; negatif berarti ikut turun.',
    analogy:
      'Seperti tingkat tanjakan jalan atau tangga: makin terjal tanjakannya, makin besar nilai gradiennya.',
    aliases: ['slope', 'gradien', 'slope/gradien', 'kemiringan'],
  },
  {
    id: 'outlier',
    term: 'Outlier',
    displayTitle: 'Outlier (Data Pencilan / Anomali)',
    category: 'Statistika & Data',
    explanation:
      'Satu atau beberapa titik data yang posisinya melenceng jauh dari pola mayoritas data lain, biasanya akibat kesalahan pembacaan alat atau kondisi ekstrem.',
    analogy:
      'Seperti satu siswa yang tingginya 210 cm di barisan anak SMP rata-rata 155 cm—bisa menggeser nilai rata-rata jika tidak ditandai.',
    aliases: ['outlier', 'pencilan', 'anomali'],
  },
  {
    id: 'eksentrisitas',
    term: 'Eksentrisitas',
    displayTitle: 'Eksentrisitas Orbit (e)',
    category: 'Fisika & Astronomi',
    explanation:
      'Ukuran seberapa gepeng atau lonjong bentuk lintasan elips orbit planet dibanding lingkaran sempurna (e = 0 bulat sempurna, mendekati 1 sangat lonjong).',
    analogy:
      'Lingkaran itu seperti roda sepeda (e = 0), sedangkan orbit lonjong (e = 0,6) seperti lintasan lari oval yang ditarik memanjang.',
    aliases: ['eksentrisitas', 'eccentricity', 'eksentrisitas orbit'],
  },
  {
    id: 'denaturasi',
    term: 'Denaturasi',
    displayTitle: 'Denaturasi Enzim / Protein',
    category: 'Biologi & Fisiologi',
    explanation:
      'Rusaknya bentuk lipatan 3D protein enzim akibat suhu terlalu tinggi atau pH ekstrem, sehingga enzim tidak bisa lagi mengikat substrat dan laju reaksi anjlok.',
    analogy:
      'Seperti putih telur bening yang berubah padat dan putih permanen saat digoreng—bentuk molekulnya terurai dan tidak bisa kembali seperti semula.',
    aliases: ['denaturasi', 'terdenaturasi', 'denaturasi termal'],
  },
  {
    id: 'osmosis',
    term: 'Osmosis',
    displayTitle: 'Osmosis (Difusi Pelarut Air)',
    category: 'Biologi & Fisiologi',
    explanation:
      'Perpindahan molekul air melewati membran semipermeabel dari larutan encer (banyak air) menuju larutan lebih pekat (banyak zat terlarut).',
    analogy:
      'Seperti irisan mentimun yang ditaburi garam lalu mengeluarkan air hingga layu karena air ditarik keluar ke permukaan yang lebih asin.',
    aliases: ['osmosis', 'osmotik', 'plasmolisis'],
  },
  {
    id: 'titik-ekivalen',
    term: 'Titik Ekivalen',
    displayTitle: 'Titik Ekivalen (Titrasi)',
    category: 'Kimia',
    explanation:
      'Momen tepat ketika jumlah mol asam (H⁺) dan mol basa (OH⁻) dalam labu Erlenmeyer habis bereaksi seimbang secara stoikiometri.',
    analogy:
      'Seperti timbangan dua lengan yang tepat datar di tengah karena beban kiri dan kanan sudah sama persis beratnya.',
    aliases: ['titik ekivalen', 'titik ekuivalen', 'ekivalen', 'ekuivalen'],
  },
  {
    id: 'vasokonstriksi',
    term: 'Vasokonstriksi',
    displayTitle: 'Vasokonstriksi (Penyempitan Pembuluh)',
    category: 'Biologi & Fisiologi',
    explanation:
      'Menyempitnya diameter dalam pembuluh darah (otot dinding berkontraksi atau tersumbat plak) yang membuat hambatan aliran melonjak drastis.',
    analogy:
      'Seperti memencet ujung selang air taman: lubang selang menyempit sedikit saja, tekanan dan semburan air di dalamnya langsung naik tajam.',
    aliases: ['vasokonstriksi', 'penyempitan pembuluh', 'resistensi vaskular'],
  },
  {
    id: 'potensial-aksi',
    term: 'Potensial Aksi',
    displayTitle: 'Potensial Aksi Neuron',
    category: 'Biologi & Fisiologi',
    explanation:
      'Lonjakan listrik sesaat pada membran sel saraf yang terjadi hanya jika rangsangan melewati ambang batas (-55 mV), lalu merambat cepat sepanjang akson.',
    analogy:
      'Seperti menekan pelatuk atau sakelar lampu pegas: jika tekanan kurang kuat lampu tidak menyala; begitu melewati ambang, lampu langsung menyala penuh!',
    aliases: ['potensial aksi', 'all-or-none', 'impuls saraf'],
  },
  {
    id: 'redshift',
    term: 'Redshift',
    displayTitle: 'Redshift Kosmik (Pergeseran Merah, z)',
    category: 'Fisika & Astronomi',
    explanation:
      'Merenggangnya panjang gelombang cahaya dari galaksi jauh ke arah warna merah karena ruang alam semesta mengembang saat cahaya sedang merambat ke Bumi.',
    analogy:
      'Mirip suara sirene ambulans yang nadanya terdengar lebih rendah saat menjauh—bedanya pada cahaya galaksi, gelombangnya bergeser ke arah merah.',
    aliases: ['redshift', 'geseran merah', 'redshift kosmik'],
  },
];

export function normalizeEducationLevel(level?: string | null): EducationLevel {
  const lower = String(level ?? 'sma').trim().toLowerCase();
  if (lower === 'smp') return 'smp';
  if (lower === 'mahasiswa' || lower === 'perguruan tinggi' || lower === 'university') {
    return 'mahasiswa';
  }
  return 'sma';
}

export function shouldShowConceptLabelsByDefault(level?: string | null): boolean {
  const norm = normalizeEducationLevel(level);
  return norm === 'smp' || norm === 'sma';
}

export function getGlossaryEntry(termOrAlias: string): GlossaryEntry | undefined {
  const key = termOrAlias.trim().toLowerCase();
  if (!key) return undefined;
  return SCIENCE_GLOSSARY.find(
    (entry) =>
      entry.id === key ||
      entry.term.toLowerCase() === key ||
      entry.aliases.some((alias) => alias.toLowerCase() === key)
  );
}

export function findGlossaryTermInText(text: string): GlossaryEntry | undefined {
  const lower = text.toLowerCase();
  return SCIENCE_GLOSSARY.find(
    (entry) =>
      lower.includes(entry.term.toLowerCase()) ||
      entry.aliases.some((alias) => alias.length > 1 && lower.includes(alias.toLowerCase()))
  );
}

// =============================================================================
// 1. REAL-TIME CAUSE-AND-EFFECT MICRO-INSIGHTS FOR PARAMETER SLIDERS
// =============================================================================

export function getPhysicsParameterFeedback(
  mode: string,
  paramKey: string,
  value: number,
  level: EducationLevel
): string {
  const isSmp = level === 'smp';

  if (mode === 'pendulum-harmonic') {
    if (paramKey === 'pendulumLength') {
      if (value >= 1.7) {
        return isSmp
          ? 'Tali diperpanjang -> ayunan terasa lebih lambat (waktu 1 ayunan makin lama).'
          : 'Panjang tali besar -> Periode T = 2π√(L/g) naik, frekuensi ayunan turun.';
      }
      if (value <= 0.7) {
        return isSmp
          ? 'Tali diperpendek -> ayunan bergerak cepat bolak-balik.'
          : 'L kecil -> Periode T mengecil & frekuensi harmonis meningkat cepat.';
      }
      return isSmp
        ? 'Mengubah panjang tali langsung mengubah cepat-lambatnya ayunan.'
        : 'Periode T sebanding dengan √L: tali lebih panjang -> periode naik.';
    }
    if (paramKey === 'pendulumAngle') {
      return value > 45
        ? isSmp
          ? 'Simpangan lebar -> ayunan menyapu jarak jauh dan melaju kencang di dasar.'
          : 'Simpangan besar (>15°) -> efek non-linier mulai menggeser aproksimasi harmonik.'
        : isSmp
        ? 'Sudut kecil membuat waktu tiap ayunan tetap stabil.'
        : 'Pada sudut kecil, periode T hampir tidak bergantung pada simpangan (isokron).';
    }
    if (paramKey === 'mass') {
      return isSmp
        ? 'Menariknya: bandul berat maupun ringan punya waktu ayun sama jika tali sama!'
        : 'Massa bandul saling meniadakan pada T = 2π√(L/g) -> periode tetap konstan.';
    }
  }

  if (mode === 'newton-incline') {
    if (paramKey === 'mass') {
      return value >= 18
        ? isSmp
          ? 'Benda makin berat -> lebih susah dipercepat dan gesekan ikut membesar.'
          : 'Inersia m besar -> percepatan a = ΣF/m menurun dan gaya normal N meningkat.'
        : isSmp
        ? 'Benda lebih ringan -> lebih mudah meluncur saat didorong gaya yang sama.'
        : 'Massa kecil memperbesar percepatan a untuk resultan gaya ΣF yang sama.';
    }
    if (paramKey === 'appliedForce') {
      if (value < 0) {
        return isSmp
          ? 'Gaya negatif menarik balok ke arah sebaliknya (menahan atau mundur).'
          : 'Gaya berlawanan arah sumbu utama -> ΣF berbalik arah dan memperlambat/membalik gerak.';
      }
      return value >= 120
        ? isSmp
          ? 'Dorongan sangat kuat -> balok melesat jauh lebih cepat!'
          : 'ΣF besar -> percepatan a meningkat sebanding lurus (Hukum II Newton: F ∝ a).'
        : isSmp
        ? 'Dorongan dinaikkan -> balok bergerak lebih cepat; diturunkan -> melambat.'
        : 'Menambah gaya F memperbesar resultan ΣF sehingga percepatan a ikut naik.';
    }
    if (paramKey === 'inclineAngle') {
      return value >= 30
        ? isSmp
          ? 'Papan makin curam -> tarikan gravitasi ke bawah papan jauh lebih kuat!'
          : 'Sudut θ besar -> komponen berat m·g·sinθ melonjak, gaya normal N = m·g·cosθ turun.'
        : isSmp
        ? 'Papan landai -> gaya gravitasi yang menarik turun balok lebih kecil.'
        : 'Sudut θ kecil -> gaya gesek lebih dominan dibanding komponen m·g·sinθ.';
    }
    if (paramKey === 'frictionCoeffKinetic') {
      return value >= 0.4
        ? isSmp
          ? 'Permukaan makin kasar -> rem gesekan kuat menahan laju balok.'
          : 'Koefisien μk tinggi -> gaya gesek fₖ = μk·N naik dan memangkas resultan ΣF.'
        : isSmp
        ? 'Permukaan licin -> balok meluncur mulus hampir tanpa hambatan.'
        : 'μk rendah -> kehilangan energi mekanik akibat gesekan minimal.';
    }
  }

  if (mode === 'projectile-gravity') {
    if (paramKey === 'initialVelocity') {
      return isSmp
        ? 'Kecepatan awal dinaikkan -> bola melambung lebih tinggi dan jatuh jauh lebih jauh.'
        : 'Jangkauan R ∝ v₀² -> menaikkan v₀ melipatgandakan jarak tempuh secara kuadratik.';
    }
    if (paramKey === 'launchAngle') {
      if (value >= 42 && value <= 48) {
        return isSmp
          ? 'Sudut ~45° adalah sudut terbaik untuk melempar bola sejauh mungkin!'
          : 'Sekitar θ = 45° menghasilkan sin(2θ) ≈ 1 -> jangkauan horizontal R maksimum.';
      }
      return value > 60
        ? isSmp
          ? 'Sudut sangat tinggi -> bola melambung tinggi ke atas, tapi jatuhnya lebih dekat.'
          : 'Komponen vertikal v₀·sinθ dominan -> tinggi Hmax naik, jangkauan horizontal menyusut.'
        : isSmp
        ? 'Sudut mendatar -> bola melesat rendah dan cepat menyentuh tanah.'
        : 'Komponen horizontal v₀·cosθ dominan namun waktu terbang singkat.';
    }
    if (paramKey === 'initialHeight') {
      return isSmp
        ? 'Menara lebih tinggi -> bola punya waktu melayang lebih lama sebelum jatuh.'
        : 'h₀ > 0 menambah waktu terbang total sehingga jangkauan R bergeser lebih jauh.';
    }
    if (paramKey === 'mass') {
      return isSmp
        ? 'Tanpa hambatan udara, bola berat dan ringan jatuh dengan lintasan yang sama.'
        : 'Dalam gerak parabola ideal, percepatan gravitasi g tidak bergantung pada massa m.';
    }
  }

  if (mode === 'spring-hooke') {
    if (paramKey === 'springConstantK') {
      return value >= 200
        ? isSmp
          ? 'Pegas makin kaku -> butuh tenaga besar untuk menarik, dan getarannya sangat cepat.'
          : 'Konstanta k besar -> gaya pemulih |Fₚ| = k·Δx naik & frekuensi sudut ω = √(k/m) meningkat.'
        : isSmp
        ? 'Pegas lebih lentur -> mudah ditarik panjang dan berayun lebih pelan.'
        : 'k kecil -> pegas lebih lunak, periode osilasi T memanjang.';
    }
    if (paramKey === 'springDisplacement') {
      return Math.abs(value) >= 1.2
        ? isSmp
          ? 'Tarikan jauh -> energi pegas tersimpan besar dan pegas menarik balik makin kuat.'
          : 'Simpangan Δx besar -> energi potensial Ep = ½k·Δx² melonjak kuadratik.'
        : isSmp
        ? 'Tarikan ringan -> gaya balik pegas kecil sesuai Hukum Hooke.'
        : 'Gaya pemulih Fₚ = -k·Δx selalu berlawanan arah dengan simpangan.';
    }
    if (paramKey === 'mass') {
      return isSmp
        ? 'Beban makin berat -> pegas berayun naik-turun lebih lambat.'
        : 'Massa beban m membesar -> periode T = 2π√(m/k) ikut naik.';
    }
    if (paramKey === 'dampingCoeff') {
      return value > 0.8
        ? isSmp
          ? 'Redaman kuat -> getaran pegas cepat berhenti seperti peredam kejut motor.'
          : 'Koefisien b tinggi -> amplitudo osilasi meluruh eksponensial lebih cepat.'
        : isSmp
        ? 'Redaman kecil -> pegas terus bergetar lama sebelum melambat.'
        : 'Redaman rendah menjaga energi mekanik osilasi bertahan lebih lama.';
    }
  }

  if (mode === 'collision-momentum') {
    if (paramKey === 'restitutionCoeff') {
      if (value >= 0.9) {
        return isSmp
          ? 'e ≈ 1 (lenting sempurna) -> kedua benda memantul penuh tanpa kehilangan energi gerak!'
          : 'Tumbukan lenting sempurna (e ≈ 1) -> momentum total & energi kinetik kekal.';
      }
      if (value <= 0.1) {
        return isSmp
          ? 'e ≈ 0 (tidak lenting) -> kedua benda menempel dan bergerak bersama setelah tabrakan.'
          : 'Inelastis sempurna (e ≈ 0) -> kecepatan akhir menyatu v\', sebagian Ek berubah menjadi panas.';
      }
      return isSmp
        ? 'Nilai e mengatur seberapa membalnya pantulan kedua benda saat bertabrakan.'
        : 'Koefisien restitusi e menentukan rasio kecepatan relatif pantulan pascatumbukan.';
    }
    return isSmp
      ? 'Benda bermassa lebih besar atau lebih cepat membawa momentum dorong lebih kuat.'
      : 'Momentum p = m·v kekal sebelum dan sesudah tumbukan pada sistem terisolasi.';
  }

  if (mode === 'stokes-viscosity') {
    if (paramKey === 'fluidViscosity') {
      return value >= 1.0
        ? isSmp
          ? 'Cairan makin kental (seperti madu) -> gaya hambat naik, bola tenggelam jauh lebih pelan.'
          : 'Viskositas η tinggi -> gaya gesek Stokes F = 6πηrv membesar & kecepatan terminal turun.'
        : isSmp
        ? 'Cairan lebih encer -> hambatan kecil sehingga bola cepat mencapai dasar.'
        : 'η rendah memperbesar kecepatan terminal v_t sebelum kesetimbangan gaya tercapai.';
    }
    if (paramKey === 'sphereRadius') {
      return isSmp
        ? 'Bola lebih besar lebih berat, sehingga mampu menembus cairan lebih cepat.'
        : 'Kecepatan terminal v_t sebanding dengan r² -> jari-jari bola naik membuat v_t melonjak!';
    }
    return isSmp
      ? 'Bola lebih padat punya gaya dorong ke bawah lebih besar dibanding gaya apung cairan.'
      : 'Selisih massa jenis (ρ_bola - ρ_fluida) menentukan besarnya gaya efektif ke bawah.';
  }

  if (mode === 'ohm-wheatstone') {
    if (paramKey === 'circuitVoltage') {
      return isSmp
        ? 'Tegangan baterai dinaikkan -> arus listrik yang mengalir di rangkaian ikut naik.'
        : 'Hukum Ohm (I = V/R): tegangan V naik memperbesar arus sirkuit secara proporsional.';
    }
    return isSmp
      ? 'Jika hambatan uji sama dengan pembanding, jarum jembatan tepat di angka nol (seimbang)!'
      : 'Jembatan Wheatstone seimbang (I_g = 0) saat rasio R₁/R₂ = R₃/Rx terpenuhi.';
  }

  if (mode === 'optics-young-slit') {
    if (paramKey === 'lightWavelength') {
      return value >= 620
        ? isSmp
          ? 'Cahaya merah (λ panjang) -> jarak antar garis terang-gelap di layar makin renggang.'
          : 'λ panjang (merah) -> jarak antar pita interferensi Δy = λL/d melebar.'
        : isSmp
        ? 'Cahaya biru/ungu (λ pendek) -> pola garis terang-gelap tampak lebih rapat.'
        : 'λ pendek (biru-ungu) memperkecil jarak antar frinji interferensi Δy.';
    }
    if (paramKey === 'slitDistance') {
      return isSmp
        ? 'Celah makin rapat -> pola garis cahaya justru menyebar lebih lebar di layar!'
        : 'Δy berbanding terbalik dengan jarak celah d -> d diperkecil membuat pita difraksi melebar.';
    }
    return isSmp
      ? 'Layar dijauhkan -> berkas cahaya melebar sehingga jarak antar garis terang makin besar.'
      : 'Jarak layar L berbanding lurus dengan jarak antar pita terang Δy = λL/d.';
  }

  if (mode === 'photoelectric-planck') {
    if (paramKey === 'lightWavelength') {
      return value <= 420
        ? isSmp
          ? 'Cahaya ungu/UV berenergi tinggi -> sanggup menendang elektron lepas dari logam!'
          : 'λ pendek -> frekuensi f & energi foton E = hc/λ tinggi -> energi kinetik elektron Ek naik.'
        : isSmp
        ? 'Cahaya merah berenergi rendah -> sering tidak cukup kuat melepaskan elektron.'
        : 'Jika energi foton hf < fungsi kerja logam W₀, fotoelektron tidak akan terpancar.';
    }
    return isSmp
      ? 'Logam dengan ikatan elektron kuat butuh cahaya berenergi lebih tinggi untuk melepas elektron.'
      : 'Fungsi kerja W₀ membatasi ambang frekuensi f₀; Ek_maks = hf - W₀.';
  }

  if (mode === 'orbital-gravity') {
    if (paramKey === 'separationDistance') {
      return isSmp
        ? 'Jarak dijauhkan 2x -> tarikan gravitasi melemah jauh hingga seperempatnya!'
        : 'Hukum kuadrat terbalik (F ∝ 1/r²): memperbesar jarak r memangkas gaya gravitasi drastis.';
    }
    return isSmp
      ? 'Massa lebih besar menghasilkan tarikan gravitasi antar benda yang lebih kuat.'
      : 'Gaya tarik gravitasi F = G·M₁·M₂/r² sebanding lurus dengan hasil kali kedua massa.';
  }

  return isSmp
    ? 'Menggeser variabel ini langsung mengubah hasil pengukuran di ruang 3D.'
    : 'Perubahan variabel bebas ini memperbarui keadaan sistem secara deterministik.';
}

export function getChemistryParameterFeedback(
  mode: string,
  paramKey: string,
  value: number,
  level: EducationLevel,
  extra?: { equivalenceVolumeMl?: number }
): string {
  const isSmp = level === 'smp';

  if (mode === 'acid-base-titration') {
    if (paramKey === 'titrantAddedMl') {
      const veq = extra?.equivalenceVolumeMl ?? 25;
      if (Math.abs(value - veq) <= 1.2) {
        return isSmp
          ? 'Tepat di Titik Ekivalen! Asam dan basa habis bereaksi dan warna indikator berubah cepat.'
          : 'Mendekati Titik Ekivalen (Vb ≈ Veq) -> kurva pH melompat tajam karena [H⁺] = [OH⁻].';
      }
      if (value < veq) {
        return isSmp
          ? `Masih suasana asam (${(veq - value).toFixed(1)} mL lagi menuju titik seimbang netral).`
          : `Zona pra-ekivalen (asam berlebih) -> pH naik bertahap sebagai larutan penyangga/asam sisa.`;
      }
      return isSmp
        ? 'Kelebihan basa dari buret -> larutan kini bersifat basa dan indikator berwarna pekat!'
        : 'Zona pasca-ekivalen -> kelebihan ion OH⁻ mendorong pH naik menuju daerah basa kuat.';
    }
    if (paramKey === 'titrantBaseConc') {
      return isSmp
        ? 'Basa di buret lebih pekat -> butuh volume tetesan lebih sedikit untuk menetralkan asam.'
        : 'Konsentrasi Mb naik -> volume titik ekivalen Veq = (Ma·Va)/Mb bergeser lebih kecil.';
    }
    if (paramKey === 'analyteAcidConc') {
      return isSmp
        ? 'Asam di labu lebih pekat -> butuh lebih banyak tetesan basa agar bisa netral.'
        : 'Ma lebih tinggi menaikkan mol asam awal -> Veq bergeser ke volume titran lebih besar.';
    }
  }

  if (mode === 'ideal-gas-boyle') {
    if (paramKey === 'gasVolumeL') {
      return value <= 7
        ? isSmp
          ? 'Ruang piston dipersempit -> partikel gas makin sering menumbuk dinding -> tekanan naik!'
          : 'Hukum Boyle (P·V = nRT): memperkecil volume V menekan partikel & menaikkan tekanan P.'
        : isSmp
        ? 'Ruang piston diperluas -> partikel gas lebih leluasa bergerak -> tekanan turun.'
        : 'Volume V membesar -> frekuensi tumbukan per satuan luas turun -> tekanan P menurun.';
    }
    if (paramKey === 'gasTemperatureK') {
      return value >= 450
        ? isSmp
          ? 'Suhu sangat panas -> molekul gas bergerak super cepat dan menekan dinding lebih keras!'
          : 'Suhu T (K) naik -> energi kinetik rata-rata molekul meningkat -> tekanan P naik (Gay-Lussac).'
        : isSmp
        ? 'Suhu dinaikkan -> gerak partikel gas makin lincah dan tekanan ikut bertambah.'
        : 'Tekanan berbanding lurus dengan suhu mutlak T pada volume konstan.';
    }
    if (paramKey === 'gasMoles') {
      return isSmp
        ? 'Jumlah gas ditambah -> lebih banyak molekul menumbuk dinding piston -> tekanan naik.'
        : 'Hukum Avogadro/Gas Ideal: jumlah mol n naik menambah tekanan total P pada V & T tetap.';
    }
  }

  if (mode === 'electrochemistry-cell') {
    if (paramKey === 'anodeConcM' || paramKey === 'cathodeConcM') {
      return isSmp
        ? 'Mengubah kepekatan larutan elektroda mengubah tegangan listrik (Volt) sel baterai.'
        : 'Persamaan Nernst: mengubah rasio [Anoda]/[Katoda] menggeser kuosien Q dan potensial E_sel.';
    }
    return isSmp
      ? 'Suhu larutan mempengaruhi kelincahan aliran ion pembawa muatan di jembatan garam.'
      : 'Suhu T (K) memengaruhi suku (RT/nF)·ln(Q) pada potensial sel Nernst.';
  }

  if (mode === 'spectrophotometry-beer') {
    if (paramKey === 'spectroConcMm') {
      return isSmp
        ? 'Larutan makin pekat -> lebih banyak cahaya yang terserap sehingga nilai absorbansi naik!'
        : 'Hukum Beer-Lambert (A = ε·l·C): konsentrasi C naik memperbesar absorbansi A secara linear.';
    }
    if (paramKey === 'spectroWavelengthNm') {
      return isSmp
        ? 'Warna cahaya yang tepat diserap paling kuat oleh larutan berwarna komplementernya.'
        : 'Nilai absorptivitas molar ε bergantung pada panjang gelombang λ terhadap puncak serapan sampel.';
    }
    return isSmp
      ? 'Wadah kuvet lebih tebal -> cahaya melewati lebih banyak partikel -> serapan naik.'
      : 'Panjang lintasan optik l berbanding lurus dengan absorbansi total A.';
  }

  // thermo-calorimetry & reaction-kinetics-arrhenius
  if (paramKey === 'initialTempC' || paramKey === 'kineticsTempC') {
    if (value > 45) {
      return isSmp
        ? 'Suhu > 45°C -> partikel bertumbukan sangat kencang (laju reaksi kimia naik cepat; pada reaksi enzim justru mulai rusak/terdenaturasi)!'
        : 'Suhu > 45°C -> fraksi molekul melampaui Ea melonjak eksponensial (Arrhenius), namun protein enzim mulai terdenaturasi!';
    }
    return isSmp
      ? 'Suhu dinaikkan -> partikel bergerak lebih cepat sehingga reaksi kimia berlangsung lebih kilat.'
      : 'Kenaikan suhu T memperbesar konstanta laju k = A·exp(-Ea/RT) dan frekuensi tumbukan efektif.';
  }
  if (paramKey === 'reactantConcentration') {
    return isSmp
      ? 'Zat reaktan lebih pekat -> partikel makin rapat dan mudah bertabrakan membentuk produk.'
      : 'Konsentrasi reaktan naik memperbanyak tumbukan per detik sehingga laju reaksi meningkat.';
  }
  if (paramKey === 'stirringRpm') {
    return isSmp
      ? 'Pengaduk dipercepat -> zat tercampur merata dan reaksi lebih cepat menyebar.'
      : 'Kecepatan pengadukan tinggi meminimalkan gradien difusi lokal antar reaktan.';
  }

  return isSmp
    ? 'Menggeser parameter ini mengubah kecepatan dan hasil reaksi di wadah 3D.'
    : 'Perubahan variabel ini menggeser kesetimbangan dan laju reaksi termodinamika.';
}

export function getBiologyParameterFeedback(
  moduleId: string,
  paramKey: string,
  value: number,
  level: EducationLevel
): string {
  const isSmp = level === 'smp';

  if (moduleId === 'photosynthesis-ingenhousz') {
    if (paramKey === 'lightIntensityLux') {
      return value >= 1800
        ? isSmp
          ? 'Cahaya sangat terang -> gelembung oksigen O₂ melimpah hingga mendekati batas jenuh daun.'
          : 'Intensitas cahaya tinggi mendekati titik saturasi fotosintesis (hukum faktor pembatas Blackman).'
        : isSmp
        ? 'Cahaya dinaikkan -> tanaman Hydrilla menghasilkan gelembung oksigen lebih cepat!'
        : 'Intensitas foton lebih tinggi memicu lebih banyak eksitasi elektron pada Fotosistem II.';
    }
    if (paramKey === 'wavelengthNm') {
      if (value >= 500 && value <= 570) {
        return isSmp
          ? 'Cahaya hijau banyak dipantulkan daun -> fotosintesis paling lambat di warna ini!'
          : 'Spektrum hijau (~530 nm) kurang diserap klorofil a/b -> efisiensi fotosintesis minimum.';
      }
      return isSmp
        ? 'Cahaya biru (~440 nm) atau merah (~660 nm) paling disukai klorofil untuk berfotosintesis!'
        : 'Spektrum biru/merah berada tepat di puncak absorpsi klorofil a & b -> laju O₂ maksimal.';
    }
    if (paramKey === 'bicarbonateConc') {
      return isSmp
        ? 'Menambah NaHCO₃ memberi pasokan CO₂ lebih banyak sebagai bahan bakar fotosintesis.'
        : '[CO₂] terlarut naik mempercepat fiksasi karbon pada Siklus Calvin hingga batas jenuh.';
    }
    if (paramKey === 'waterTempC') {
      return value > 36
        ? 'Suhu air > 36°C -> enzim fotosintesis mulai terganggu/terdenaturasi, gelembung O₂ justru turun!'
        : isSmp
        ? 'Suhu hangat (~28–32°C) membantu kerja sel daun lebih optimal menghasilkan O₂.'
        : 'Suhu mendekati optimum mempercepat kerja enzim RuBisCO dalam stroma kloroplas.';
    }
  }

  if (moduleId === 'enzyme-catalase' || moduleId === 'enzyme-kinetics') {
    if (paramKey === 'temperatureC') {
      if (value > 45) {
        return isSmp
          ? 'Suhu > 45°C -> struktur enzim mulai terdenaturasi, laju reaksi melambat!'
          : 'Suhu > 45°C -> struktur tersier protein enzim terdenaturasi, sisi aktif rusak & V turun drastis!';
      }
      if (value >= 34 && value <= 41) {
        return isSmp
          ? 'Suhu optimal (~37°C, suhu tubuh) -> enzim bekerja paling lincah menghasilkan busa O₂!'
          : 'Suhu optimum katalase (~37°C) -> energi aktivasi tercapai maksimal tanpa denaturasi.';
      }
      return isSmp
        ? 'Suhu dingin -> gerak molekul melambat sehingga enzim bekerja lebih pelan.'
        : 'Pada T < 30°C, energi kinetik rendah memperlambat laju tumbukan enzim-substrat.';
    }
    if (paramKey === 'solutionPH') {
      return Math.abs(value - 7) <= 1.2
        ? isSmp
          ? 'pH netral (~7) adalah kondisi paling nyaman bagi enzim katalase untuk bekerja.'
          : 'pH optimum (~7.0) menjaga muatan ionik sisi aktif enzim tetap utuh mengikat substrat.'
        : isSmp
        ? 'pH terlalu asam/basa mengganggu bentuk enzim -> busa reaksi berkurang!'
        : 'pH ekstrem mengubah ionisasi gugus aktif enzim & menurunkan aktivitas katalitik.';
    }
    if (paramKey === 'substrateConcMm') {
      return isSmp
        ? 'Substrat H₂O₂ ditambah -> reaksi makin ramai hingga semua enzim sibuk bekerja.'
        : 'Kinetika Michaelis-Menten: [S] naik mendorong v menuju asimtot Vmax.';
    }
    return isSmp
      ? 'Lebih banyak enzim tersedia -> lebih banyak substrat dapat diuraikan sekaligus.'
      : 'Volume enzim lebih besar menaikkan Vmax efektif secara proporsional.';
  }

  if (moduleId === 'osmosis-plasmolysis' || moduleId === 'cell-osmosis-tonicity') {
    if (paramKey === 'sucroseConcMolar') {
      if (value > 0.35) {
        return isSmp
          ? 'Larutan lebih pekat (hipertonik) -> air keluar dari sel -> sel mengerut (plasmolisis)!'
          : 'Lingkungan hipertonik (Ψs luar lebih negatif) -> air keluar secara osmosis & memicu plasmolisis.';
      }
      if (value < 0.22) {
        return isSmp
          ? 'Larutan encer (hipotonik) -> air masuk ke sel -> sel membengkak dan kencang (turgid)!'
          : 'Lingkungan hipotonik -> potensial air luar tinggi mendorong air masuk & menaikkan tekanan turgor.';
      }
      return isSmp
        ? 'Mendekati isotonik (~0.28 M) -> air keluar dan masuk hampir seimbang, massa sel tetap.'
        : 'Titik kesetimbangan isotonik (Ψw dalam ≈ Ψw luar) -> fluks neto air ≈ 0.';
    }
    return isSmp
      ? 'Suhu lebih hangat mempercepat gerak molekul air yang keluar-masuk melewati membran sel.'
      : 'Persamaan van \'t Hoff (Π = iMRT): suhu T memengaruhi tekanan osmotik larutan.';
  }

  if (moduleId === 'predator-prey-dynamics') {
    if (paramKey === 'preyPopulationX') {
      return isSmp
        ? 'Mangsa banyak -> makanan predator melimpah sehingga populasi predator akan ikut naik.'
        : 'Kepadatan mangsa x tinggi memperbesar suku interaksi δ·x·y bagi pertumbuhan predator.';
    }
    if (paramKey === 'predatorPopulationY') {
      return isSmp
        ? 'Terlalu banyak predator -> mangsa cepat habis diburu dan populasi mangsa merosot!'
        : 'Jika y > α/β, laju dx/dt menjadi negatif sehingga populasi mangsa menurun.';
    }
    return isSmp
      ? 'Mengubah laju berkembang biak atau berburu menggeser titik keseimbangan ekosistem.'
      : 'Parameter α dan β menggeser titik ekuilibrium koeksistensi (x*, y*) pada ruang fase.';
  }

  if (moduleId === 'anatomy-cardiovascular-heart') {
    if (paramKey === 'vesselRadiusRatio') {
      if (value <= 0.75) {
        return isSmp
          ? 'Pembuluh menyempit -> hambatan naik drastis -> tekanan darah melonjak!'
          : 'Vasokonstriksi (r menyempit): Hukum Poiseuille (R ∝ 1/r⁴) melipatgandakan resistensi & MAP melonjak!';
      }
      if (value >= 1.05) {
        return isSmp
          ? 'Pembuluh melebar (rileks) -> darah mengalir lancar dan tekanan darah lebih rendah.'
          : 'Vasodilatasi (r membesar) menurunkan resistensi vaskular sistemik secara tajam (∝ 1/r⁴).';
      }
      return isSmp
        ? 'Diameter pembuluh normal menjaga aliran darah lancar dan tekanan tetap sehat.'
        : 'Rasio lumen r/r₀ = 1.0 menjaga resistensi vaskular dalam rentang fisiologis normal.';
    }
    if (paramKey === 'heartRateBpm') {
      return value > 140
        ? isSmp
          ? 'Detak sangat cepat -> pompa lebih sering, tapi waktu bilik terisi darah jadi makin singkat!'
          : 'Takikardia (>140 bpm) menaikkan CO, namun memperpendek fase pengisian diastolik (SV sedikit turun).'
        : isSmp
        ? 'Detak jantung dinaikkan -> jumlah darah yang dipompa tiap menit (curah jantung) ikut naik.'
        : 'Curah jantung CO = HR × SV meningkat seiring naiknya laju pacu nodus SA.';
    }
    if (paramKey === 'bloodViscosity') {
      return isSmp
        ? 'Darah makin kental -> jantung harus memompa lebih keras untuk mendorongnya.'
        : 'Viskositas η naik meningkatkan resistensi Poiseuille (R ∝ η) dan beban kerja ventrikel kiri.';
    }
    return isSmp
      ? 'Aktivitas fisik naik -> otot butuh lebih banyak oksigen sehingga jantung berdetak lebih aktif.'
      : 'Intensitas aktivitas meningkatkan kebutuhan metabolik O₂ dan volume sekuncup (Frank-Starling).';
  }

  if (moduleId === 'anatomy-respiratory-lungs') {
    if (paramKey === 'airwayResistance') {
      return value >= 2.0
        ? isSmp
          ? 'Saluran napas menyempit (seperti asma) -> udara sulit masuk-keluar sehingga volume napas turun!'
          : 'Bronkokonstriksi menaikkan resistensi jalan napas & menurunkan Volume Tidal (TV) efektif.'
        : isSmp
        ? 'Saluran napas lega -> udara keluar-masuk alveolus dengan lancar.'
        : 'Resistensi bronkial normal menjaga ventilasi semenit (V̇E) optimal.';
    }
    if (paramKey === 'altitudeMeters') {
      return value >= 3500
        ? isSmp
          ? 'Makin tinggi di gunung -> udara makin tipis, kadar oksigen darah (SpO₂) mulai turun!'
          : 'Hipobarik (>3500 mdpl) menurunkan tekanan parsial PAO₂ -> saturasi SpO₂ turun pada kurva Hill.'
        : isSmp
        ? 'Ketinggian rendah -> tekanan udara cukup tinggi untuk mendorong O₂ masuk ke darah.'
        : 'Tekanan barometrik permukaan laut menjaga gradien difusi O₂ alveolus-kapiler optimal.';
    }
    if (paramKey === 'diaphragmEffort') {
      return isSmp
        ? 'Otot diafragma menarik lebih kuat -> rongga dada mengembang lebih besar & napas lebih dalam!'
        : 'Kontraksi diafragma memperbesar tekanan negatif intrapleura (Hukum Boyle) -> Volume Tidal naik.';
    }
    return isSmp
      ? 'Napas lebih cepat menaikkan total udara yang masuk ke paru-paru tiap menit.'
      : 'Ventilasi semenit V̇E = RR × TV meningkat sebanding dengan frekuensi napas.';
  }

  if (moduleId === 'anatomy-neural-synapse') {
    if (paramKey === 'stimulusVoltageMv') {
      if (value < -55) {
        return isSmp
          ? 'Rangsangan masih di bawah ambang (-55 mV) -> sinyal gagal terbentuk & tidak merambat!'
          : 'Sub-ambang (V < -55 mV): kanal Na⁺ gagal membuka penuh (Hukum All-or-None tidak terpicu).';
      }
      return isSmp
        ? 'Melewati ambang (-55 mV) -> sinyal listrik menyala penuh & meluncur ke ujung saraf!'
        : 'Melampaui ambang (-55 mV) -> depolarisasi eksplosif memicu potensial aksi penuh menuju sinapsis.';
    }
    if (paramKey === 'myelinThickness') {
      return value >= 60
        ? isSmp
          ? 'Selubung mielin tebal -> sinyal melompat cepat dari celah ke celah (konduksi saltatorik)!'
          : 'Mielinisasi tebal mempercepat konduksi saltatorik antar-Nodus Ranvier secara signifikan.'
        : isSmp
        ? 'Mielin tipis/hilang -> sinyal merambat pelan tanpa lompatan.'
        : 'Demielinisasi menurunkan resistansi membran & memperlambat kecepatan rambat impuls.';
    }
    return isSmp
      ? 'Keseimbangan ion Na⁺ dan K⁺ di luar sel mengatur kesiapan saraf menembakkan listrik.'
      : 'Gradien konsentrasi ion menggeser potensial kesetimbangan Nernst (ENa / EK) & membran.';
  }

  return isSmp
    ? 'Mengubah variabel ini langsung memengaruhi proses biologis pada model 3D.'
    : 'Perubahan parameter fisiologis ini memperbarui respons biologis sistem.';
}

export function getAstronomyParameterFeedback(
  mode: string,
  paramKey: string,
  value: number,
  level: EducationLevel
): string {
  const isSmp = level === 'smp';

  if (mode === 'solar-kepler') {
    if (paramKey === 'customSemiMajorAxisAu') {
      return value >= 5
        ? isSmp
          ? 'Planet dijauhkan dari Matahari -> lintasan makin luas dan 1 kali orbit butuh bertahun-tahun!'
          : 'Hukum III Kepler (T² ∝ a³): orbit lebih jauh memperpanjang periode T jauh lebih cepat dari a.'
        : isSmp
        ? 'Planet dekat Matahari -> tarikan gravitasi kuat sehingga mengorbit dengan sangat cepat!'
        : 'Semi-mayor a kecil mempercepat kecepatan orbit rata-rata & memangkas periode T.';
    }
    if (paramKey === 'customEccentricity') {
      if (value >= 0.45) {
        return isSmp
          ? 'Orbit makin lonjong -> planet melesat kencang saat dekat Matahari & melambat jauh di ujungnya!'
          : 'Eksentrisitas tinggi (e ≥ 0.45) -> selisih kecepatan perihelion vs aphelion sangat kontras (Kepler II).';
      }
      if (value <= 0.06) {
        return isSmp
          ? 'e mendekati 0 -> lintasan orbit nyaris lingkaran sempurna dengan kecepatan hampir tetap.'
          : 'e ≈ 0 menghasilkan orbit sirkular dengan jarak & kelajuan orbital konstan.';
      }
      return isSmp
        ? 'Orbit elips sedang -> planet sedikit lebih cepat saat berada paling dekat dengan Matahari.'
        : 'Eksentrisitas elips e memengaruhi kelajuan sesaat antara titik perihelion dan aphelion (Kepler II).';
    }
    return isSmp
      ? 'Bintang pusat lebih bermassa -> gravitasi lebih kuat -> planet mengorbit lebih cepat.'
      : 'Massa bintang M* membesar menurunkan periode orbit T = √(a³/M*).';
  }

  if (mode === 'milkyway-galaxy') {
    if (paramKey === 'darkMatterHaloFraction') {
      return value <= 0.1
        ? isSmp
          ? 'Tanpa materi gelap -> bintang di tepi galaksi berputar sangat pelan seperti aturan Kepler.'
          : 'Fraksi halo DM ≈ 0 -> kurva rotasi turun tajam (v ∝ 1/√R) sesuai prediksi massa tampak saja.'
        : isSmp
        ? 'Halo materi gelap ditambah -> bintang di tepi galaksi tetap berputar kencang!'
        : 'Gravitasi tambahan halo materi gelap menjaga kurva rotasi galaksi tetap datar pada R besar.';
    }
    return isSmp
      ? 'Jarak ke pusat galaksi memengaruhi besarnya massa yang menarik bintang tersebut berputar.'
      : 'Radius galaktosentrik R menentukan massa terkurung M(R) yang mengatur kecepatan rotasi.';
  }

  if (mode === 'stellar-exoplanet') {
    if (paramKey === 'exoplanetRadiusEarth') {
      return isSmp
        ? 'Planet lebih besar -> menutupi lebih banyak cahaya bintang saat melintas di depannya!'
        : 'Kedalaman transit ΔF/F = (Rp/R*)² -> radius planet Rp naik memperdalam kurva cahaya secara kuadratik.';
    }
    return isSmp
      ? 'Bintang induk lebih besar membuat bayangan planet yang melintas terlihat lebih kecil.'
      : 'Radius bintang R* atau jarak orbit menggeser persentase redupan fluks & zona laik huni.';
  }

  if (mode === 'stellar-wien-spectrum') {
    if (paramKey === 'starEffectiveTempK') {
      if (value >= 10000) {
        return isSmp
          ? 'Bintang sangat panas -> warnanya bergeser menjadi biru-putih terang!'
          : 'Hukum Pergeseran Wien (λmax·T = b): suhu T naik menggeser puncak spektrum ke biru/UV.';
      }
      if (value <= 4000) {
        return isSmp
          ? 'Bintang lebih dingin -> tampak berwarna jingga-kemerahan!'
          : 'Suhu fotosfer rendah (kelas K/M) menggeser puncak radiasi Wien ke panjang gelombang merah/IR.';
      }
      return isSmp
        ? 'Suhu sedang (~5800 K seperti Matahari) -> bintang memancarkan cahaya putih-kekuningan.'
        : 'Rentang suhu kelas G–A menempatkan puncak panjang gelombang Wien di spektrum cahaya tampak.';
    }
    return isSmp
      ? 'Bintang dengan ukuran radius lebih besar memancarkan total cahaya jauh lebih terang.'
      : 'Luminositas Stefan-Boltzmann L = 4πR²σT⁴ melonjak kuadratik terhadap radius bintang R*.';
  }

  if (mode === 'hubble-expansion') {
    if (paramKey === 'galaxyDistanceMpc') {
      return value >= 300
        ? isSmp
          ? 'Galaksi sangat jauh -> menjauh jauh lebih cepat & cahayanya bergeser merah (Redshift) lebih besar!'
          : 'Hukum Hubble (v = H₀·d): jarak kosmik d besar menghasilkan kecepatan resesi & redshift z tinggi.'
        : isSmp
        ? 'Makin jauh jarak galaksi dari kita, makin cepat pula ia bergerak menjauh.'
        : 'Kecepatan resesi galaksi berbanding lurus dengan jaraknya dalam ruang yang mengembang.';
    }
    return isSmp
      ? 'Konstanta Hubble menunjukkan seberapa cepat alam semesta kita mengembang saat ini.'
      : 'Nilai H₀ menentukan laju ekspansi ruang dan estimasi umur alam semesta (t₀ ≈ 1/H₀).';
  }

  return isSmp
    ? 'Mengubah parameter ini langsung memperbarui simulasi tata surya dan kosmos 3D.'
    : 'Parameter astrofisika diperbarui secara real-time pada pemodelan 3D.';
}

// =============================================================================
// 2. AUTOMATIC LKS DATA PATTERN TRANSLATOR ("💡 Ringkasan Pola Datamu")
// =============================================================================

export interface ObservationPatternTranslation {
  status: 'empty' | 'insufficient' | 'constant-x' | 'ready';
  pointsCount: number;
  rSquared: number;
  rSquaredPct: number;
  slope: number;
  trendDirection: 'naik' | 'turun' | 'stabil' | 'belum-jelas';
  xLabel: string;
  yLabel: string;
  headline: string;
  summaryText: string;
  guidanceText: string;
}

function inferReadableAxes(
  records: ExperimentRecord[],
  domain?: string,
  moduleId?: string
): { xLabel: string; yLabel: string } {
  const hint = `${moduleId || ''} ${records[0]?.experimentTitle || ''} ${records[0]?.parametersSummary || ''}`.toLowerCase();

  if (hint.includes('bandul') || hint.includes('pendulum')) {
    return { xLabel: 'Panjang Tali (L)', yLabel: 'Periode Ayunan (T)' };
  }
  if (hint.includes('pegas') || hint.includes('hooke')) {
    return { xLabel: 'Simpangan Pegas (Δx)', yLabel: 'Gaya Pemulih (|Fp|)' };
  }
  if (hint.includes('parabola') || hint.includes('projectile')) {
    return { xLabel: 'Kecepatan Awal (v₀)', yLabel: 'Jangkauan (R)' };
  }
  if (hint.includes('stokes') || hint.includes('viskositas')) {
    return { xLabel: 'Jari-jari Bola (r)', yLabel: 'Kecepatan Terminal (vₜ)' };
  }
  if (hint.includes('ohm') || hint.includes('wheatstone')) {
    return { xLabel: 'Hambatan Uji (Rx)', yLabel: 'Arus Galvanometer (Ig)' };
  }
  if (hint.includes('young') || hint.includes('interferensi')) {
    return { xLabel: 'Panjang Gelombang (λ)', yLabel: 'Jarak Pita Terang (Δy)' };
  }
  if (hint.includes('fotolistrik') || hint.includes('photoelectric')) {
    return { xLabel: 'Panjang Gelombang (λ)', yLabel: 'Energi Kinetik Maks (Ek)' };
  }
  if (hint.includes('newton') || hint.includes('bidang miring')) {
    return { xLabel: 'Gaya Dorong (F)', yLabel: 'Percepatan (a)' };
  }
  if (hint.includes('titrasi') || hint.includes('asam')) {
    return { xLabel: 'Volume Titran (Vb)', yLabel: 'pH Larutan' };
  }
  if (hint.includes('boyle') || hint.includes('gas')) {
    return { xLabel: 'Volume Gas (V)', yLabel: 'Tekanan Gas (P)' };
  }
  if (hint.includes('galvani') || hint.includes('elektrokimia')) {
    return { xLabel: 'Konsentrasi Anoda', yLabel: 'Potensial Sel (E_sel)' };
  }
  if (hint.includes('spektro') || hint.includes('beer')) {
    return { xLabel: 'Konsentrasi Sampel (C)', yLabel: 'Absorbansi (A)' };
  }
  if (hint.includes('termokimia') || hint.includes('kalorimetri') || hint.includes('kinetika') || hint.includes('arrhenius')) {
    return { xLabel: 'Suhu Pemanas (T)', yLabel: 'Respons Reaksi (ΔT / Laju)' };
  }
  if (hint.includes('fotosintesis') || hint.includes('ingenhousz')) {
    return { xLabel: 'Intensitas Cahaya (I)', yLabel: 'Laju Gelembung O₂' };
  }
  if (hint.includes('katalase') || hint.includes('enzim')) {
    return { xLabel: 'Variabel Uji Enzim', yLabel: 'Kecepatan Reaksi Enzim (v)' };
  }
  if (hint.includes('osmosis') || hint.includes('plasmolisis')) {
    return { xLabel: 'Konsentrasi Sukrosa (C)', yLabel: 'Perubahan Massa Sel (Δm)' };
  }
  if (hint.includes('jantung') || hint.includes('kardio')) {
    return { xLabel: 'Frekuensi Detak (HR)', yLabel: 'Curah Jantung (CO)' };
  }
  if (hint.includes('paru') || hint.includes('respirasi')) {
    return { xLabel: 'Variabel Respirasi', yLabel: 'Keluaran Ventilasi / SpO₂' };
  }
  if (hint.includes('saraf') || hint.includes('neuron') || hint.includes('sinaps')) {
    return { xLabel: 'Variabel Stimulus / Mielin', yLabel: 'Respons Impuls Saraf' };
  }
  if (hint.includes('kepler') || hint.includes('orbit')) {
    return { xLabel: 'Pangkat Tiga Jarak (a³)', yLabel: 'Kuadrat Periode (T²)' };
  }
  if (hint.includes('hubble') || hint.includes('ekspansi')) {
    return { xLabel: 'Jarak Galaksi (d)', yLabel: 'Kecepatan Resesi (v)' };
  }
  if (hint.includes('wien')) {
    return { xLabel: 'Suhu Fotosfer (T*)', yLabel: 'Puncak Gelombang Wien (λmax)' };
  }
  if (hint.includes('eksoplanet') || hint.includes('transit')) {
    return { xLabel: 'Radius Eksoplanet (Rp)', yLabel: 'Kedalaman Transit (%)' };
  }
  if (hint.includes('galaksi') || hint.includes('bima sakti')) {
    return { xLabel: 'Jarak Galaktosentrik (R)', yLabel: 'Kecepatan Rotasi (v)' };
  }

  const dom = (domain || records[0]?.domain || '').toLowerCase();
  if (dom === 'kimia') return { xLabel: 'Variabel Bebas Kimia (X)', yLabel: 'Respons Larutan (Y)' };
  if (dom === 'biologi') return { xLabel: 'Variabel Lingkungan/Fisiologis (X)', yLabel: 'Respons Biologis (Y)' };
  if (dom === 'astronomi') return { xLabel: 'Parameter Astrofisika (X)', yLabel: 'Keluaran Observasi (Y)' };
  return { xLabel: 'Variabel Bebas (X)', yLabel: 'Hasil Pengukuran (Y)' };
}

export function translateObservationPattern(input: {
  records: ExperimentRecord[];
  regressionSummary?: RecordsRegressionSummary;
  domain?: string;
  moduleId?: string;
}): ObservationPatternTranslation {
  const { records, domain, moduleId } = input;
  const numericPoints = records.filter(
    (r) =>
      typeof r.numericX === 'number' &&
      typeof r.numericY1 === 'number' &&
      Number.isFinite(r.numericX) &&
      Number.isFinite(r.numericY1)
  );
  const { xLabel, yLabel } = inferReadableAxes(records, domain, moduleId);
  const summary = input.regressionSummary ?? computeRecordsRegressionSummary(records);

  if (numericPoints.length === 0) {
    return {
      status: 'empty',
      pointsCount: 0,
      rSquared: 0,
      rSquaredPct: 0,
      slope: 0,
      trendDirection: 'belum-jelas',
      xLabel,
      yLabel,
      headline: 'Belum Ada Data Percobaan Tercatat',
      summaryText:
        'Belum ada data numerik dari meja simulasi 3D. Kembali sebentar ke Tahap 2, ubah nilai variabel bebas minimal 3 kali, lalu tekan "+ Catat Data".',
      guidanceText:
        'Tips menulis kesimpulan: catat minimal 3 variasi nilai agar aplikasi bisa membacakan pola naik/turun datamu secara otomatis.',
    };
  }

  if (numericPoints.length < 3) {
    return {
      status: 'insufficient',
      pointsCount: numericPoints.length,
      rSquared: Number.isFinite(summary.rSquared) ? summary.rSquared : 0,
      rSquaredPct: Math.round(
        Math.min(1, Math.max(0, Number.isFinite(summary.rSquared) ? summary.rSquared : 0)) * 100
      ),
      slope: Number.isFinite(summary.slope) ? summary.slope : 0,
      trendDirection: 'belum-jelas',
      xLabel,
      yLabel,
      headline: `Baru Tercatat ${numericPoints.length} Titik Data (Butuh Minimal 3)`,
      summaryText: `Kamu baru mencatat ${numericPoints.length} data. Tambahkan ${3 - numericPoints.length} data lagi dengan nilai ${xLabel} yang berbeda agar pola hubungan terhadap ${yLabel} bisa dibaca dengan akurat.`,
      guidanceText:
        'Dengan minimal 3 titik data, kita bisa mengetahui apakah hubungannya naik lurus, turun, atau memiliki titik penyimpangan (outlier).',
    };
  }

  const xValues = numericPoints.map((p) => p.numericX as number);
  const yValues = numericPoints.map((p) => p.numericY1 as number);
  const xSpan = Math.max(...xValues) - Math.min(...xValues);
  const ySpan = Math.max(...yValues) - Math.min(...yValues);

  if (xSpan < 1e-6) {
    return {
      status: 'constant-x',
      pointsCount: numericPoints.length,
      rSquared: 0,
      rSquaredPct: 0,
      slope: 0,
      trendDirection: 'belum-jelas',
      xLabel,
      yLabel,
      headline: `Nilai ${xLabel} Masih Sama di Semua Data`,
      summaryText: `Berdasarkan ${numericPoints.length} data yang kamu catat, semua nilai ${xLabel} masih identik (${xValues[0]}). Coba geser slider ${xLabel} ke beberapa angka berbeda lalu catat ulang.`,
      guidanceText:
        'Untuk menguji hubungan sebab-akibat, hanya variabel bebas yang perlu diubah-ubah ke minimal 3 nilai berbeda.',
    };
  }

  const safeR2 = Number.isFinite(summary.rSquared)
    ? Math.min(1, Math.max(0, summary.rSquared))
    : 0;
  const rSquaredPct = Math.round(safeR2 * 100);
  const safeSlope = Number.isFinite(summary.slope) ? summary.slope : 0;

  // Classify slope relative to observed Y/X scale so tiny rounding noise stays 'stabil'
  const scaleRatio = (Math.abs(safeSlope) * xSpan) / Math.max(1e-6, ySpan, Math.abs(yValues[0]));
  const trendDirection: 'naik' | 'turun' | 'stabil' =
    ySpan < 1e-5 || scaleRatio < 0.03
      ? 'stabil'
      : safeSlope > 0
      ? 'naik'
      : 'turun';

  const trendPhrase =
    trendDirection === 'naik'
      ? `${yLabel} ikut naik`
      : trendDirection === 'turun'
      ? `${yLabel} ikut turun`
      : `${yLabel} cenderung stabil (tidak banyak berubah)`;

  const consistencyPhrase =
    trendDirection === 'stabil'
      ? 'cukup konsisten'
      : rSquaredPct >= 85
      ? 'secara konsisten'
      : rSquaredPct >= 60
      ? 'dengan pola yang cukup jelas (sedikit melengkung atau bervariasi)'
      : 'namun titik data masih menyebar (kemungkinan hubungan non-linear atau ada outlier)';

  const summaryText =
    trendDirection === 'stabil'
      ? `Berdasarkan ${numericPoints.length} data yang kamu catat, saat ${xLabel} dinaikkan, ${trendPhrase}. Ini menandakan ${xLabel} tidak memengaruhi ${yLabel} secara signifikan.`
      : `Berdasarkan ${numericPoints.length} data yang kamu catat, saat ${xLabel} dinaikkan, ${trendPhrase} ${consistencyPhrase} dengan tingkat kerapian data (R²) sebesar ${rSquaredPct}%.`;

  const guidanceText =
    rSquaredPct < 75 && trendDirection !== 'stabil'
      ? 'Cek grafik regresi di atas: jika ada 1 titik yang melenceng jauh (outlier) atau kurvanya melengkung, sebutkan hal tersebut di kesimpulanmu!'
      : 'Gunakan pola hubungan di atas untuk membandingkan apakah hasil percobaan sesuai dengan hipotesis awalmu.';

  return {
    status: 'ready',
    pointsCount: numericPoints.length,
    rSquared: safeR2,
    rSquaredPct,
    slope: safeSlope,
    trendDirection,
    xLabel,
    yLabel,
    headline:
      trendDirection === 'naik'
        ? `Pola Positif: ${xLabel} ↑ maka ${yLabel} ↑`
        : trendDirection === 'turun'
        ? `Pola Terbalik: ${xLabel} ↑ maka ${yLabel} ↓`
        : `Pola Stabil: ${yLabel} Relatif Tetap`,
    summaryText,
    guidanceText,
  };
}

// =============================================================================
// 3. PURE 3D-TO-2D ANCHOR PROJECTION HELPER FOR CONCEPT LABELS OVERLAY
// =============================================================================

export interface ConceptProjectionResult {
  visible: boolean;
  x: number;
  y: number;
}

export function projectWorldAnchorToViewport(
  ndcX: number,
  ndcY: number,
  ndcZ: number,
  width: number,
  height: number,
  paddingX = 56,
  paddingY = 24
): ConceptProjectionResult {
  if (
    !Number.isFinite(ndcX) ||
    !Number.isFinite(ndcY) ||
    !Number.isFinite(ndcZ) ||
    width < 320 ||
    height < 200
  ) {
    return { visible: false, x: 0, y: 0 };
  }

  // Behind camera or beyond frustum depth, or way outside screen bounds
  if (ndcZ < -1 || ndcZ > 1 || Math.abs(ndcX) > 1.35 || Math.abs(ndcY) > 1.35) {
    return { visible: false, x: 0, y: 0 };
  }

  const rawX = (ndcX * 0.5 + 0.5) * width;
  const rawY = (-ndcY * 0.5 + 0.5) * height;

  const minX = Math.min(paddingX, width * 0.4);
  const maxX = Math.max(minX, width - paddingX);
  const minY = Math.min(48, height * 0.25);
  const maxY = Math.max(minY, height - paddingY);

  return {
    visible: true,
    x: Math.min(maxX, Math.max(minX, rawX)),
    y: Math.min(maxY, Math.max(minY, rawY)),
  };
}

export interface GlossaryPopoverPosition {
  top: number;
  left: number;
  width: number;
  placeAbove: boolean;
}

export function computeGlossaryPopoverPosition(
  rect: { left: number; width: number; top: number; bottom: number },
  viewportWidth: number,
  viewportHeight: number
): GlossaryPopoverPosition {
  const safeVw = Math.max(240, Number.isFinite(viewportWidth) ? viewportWidth : 360);
  const safeVh = Math.max(240, Number.isFinite(viewportHeight) ? viewportHeight : 640);
  const gutter = 12;
  const width = Math.min(310, Math.max(180, safeVw - gutter * 2));
  const estHeight = 192;

  const placeAbove =
    rect.bottom + estHeight + gutter > safeVh && rect.top - estHeight - gutter > 8;
  const rawLeft = rect.left + rect.width / 2 - width / 2;
  const maxLeft = Math.max(gutter, safeVw - width - gutter);
  const left = Math.max(gutter, Math.min(maxLeft, rawLeft));
  const top = placeAbove
    ? Math.max(gutter, rect.top - 8)
    : Math.max(gutter, Math.min(safeVh - 20, rect.bottom + 8));

  return { top, left, width, placeAbove };
}


