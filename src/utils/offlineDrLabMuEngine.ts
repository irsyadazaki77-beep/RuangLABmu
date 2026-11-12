import {
  DrLabMuStructuredResponse,
  DrLabMuTelemetryPayload,
} from './engines/statisticsAndRegression';

export type DrLabMuTelemetryContext = DrLabMuTelemetryPayload | {
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  topic: string;
  educationLevel?: string;
  currentParameters?: Record<string, any>;
  recordedData?: Array<any>;
  analytics?: {
    rSquared: number;
    slope?: number;
    intercept?: number;
    equation?: string;
  };
  studentQuery?: string;
};

export interface OfflineSocraticInsight {
  observation: string;
  dataHighlight: string;
  socraticQuestion: string;
  detectedTrigger: 'anomaly-outlier' | 'concept-analogy' | 'direct-answer-refusal' | 'off-topic-refusal';
  analogyDomain: string;
}

/**
 * Checks if a telemetry payload has regression anomalies or outlier data points.
 */
export function detectOfflineAnomalies(telemetry: DrLabMuTelemetryContext): {
  hasAnomaly: boolean;
  type: 'outlier' | 'low-r2' | 'few-data' | 'nominal';
  message: string;
  outlierRowIndex?: number;
} {
  const records = telemetry.recordedData || [];
  if (records.length === 0) {
    return {
      hasAnomaly: false,
      type: 'few-data',
      message: 'Belum ada data percobaan yang dicatat ke tabel observasi.',
    };
  }

  if (records.length < 3) {
    return {
      hasAnomaly: false,
      type: 'few-data',
      message: 'Tabel observasi baru memiliki kurang dari 3 titik data.',
    };
  }

  const r2 = telemetry.analytics?.rSquared ?? 1;
  if (r2 < 0.85) {
    // Attempt to locate potential outlier
    let maxDeviationIndex = -1;
    let maxDev = -1;
    const meanY =
      records.reduce((acc: number, r: any) => {
        const val = typeof r.y1 === 'number' ? r.y1 : typeof r.y === 'number' ? r.y : 0;
        return acc + val;
      }, 0) / records.length;

    records.forEach((r: any, idx: number) => {
      const yVal = typeof r.y1 === 'number' ? r.y1 : typeof r.y === 'number' ? r.y : 0;
      const dev = Math.abs(yVal - meanY);
      if (dev > maxDev) {
        maxDev = dev;
        maxDeviationIndex = idx;
      }
    });

    return {
      hasAnomaly: true,
      type: 'low-r2',
      message: `Koefisien determinasi regresi Anda (R² = ${r2.toFixed(3)}) berada di bawah 0.85.`,
      outlierRowIndex: maxDeviationIndex >= 0 ? maxDeviationIndex + 1 : undefined,
    };
  }

  return {
    hasAnomaly: false,
    type: 'nominal',
    message: `Data percobaan terdistribusi sangat rapi dengan linieritas tinggi (R² = ${r2.toFixed(3)}).`,
  };
}

/**
 * Generates everyday Indonesian analogies and rich Socratic guidance for students in 3T areas
 * without requiring any external internet connection or server LLM.
 */
export function generateOfflineSocraticMentorResponse(
  telemetry: DrLabMuTelemetryContext
): DrLabMuStructuredResponse {
  const { domain, topic, educationLevel, currentParameters, recordedData, analytics, studentQuery } = telemetry;
  const anomaly = detectOfflineAnomalies(telemetry);
  const qLower = (studentQuery || '').toLowerCase();
  const r2Str = (analytics?.rSquared ?? 0).toFixed(3);
  const slopeVal = analytics?.slope ?? 0;
  const recCount = (recordedData || []).length;

  let observation = '';
  let dataHighlight = '';
  let socraticQuestion = '';
  let trigger: DrLabMuStructuredResponse['detectedTrigger'] = 'concept-analogy';

  // --- 1. HANDLING DATA ANOMALY / OUTLIER ---
  if (anomaly.hasAnomaly && anomaly.type === 'low-r2') {
    trigger = 'anomaly-outlier';
    observation = `Halo peneliti muda! Saya mencatat data Anda di modul ${topic} (${recCount} titik data). Terlihat garis regresi kuantitatif menunjukkan nilai R² = ${r2Str}, yang menandakan adanya satu atau dua titik percobaan yang melompat dari tren umum.`;

    if (domain === 'Fisika') {
      dataHighlight = `Bayangkan saat Anda mengayunkan ayunan atau menggantungkan batu di seutas tali kelapa. Jika sesekali tali tersenggol ranting atau dorongan awal tidak stabil, ayunannya akan bergoyang liar sebelum stabil kembali. Periksa kembali baris data ${
        anomaly.outlierRowIndex ? `ke-${anomaly.outlierRowIndex}` : 'terakhir'
      }: apakah ada nilai yang dicatat saat sistem belum mencapai osilasi stabil?`;
      socraticQuestion = `Bagaimana jika Anda mengulangi 1 kali pengukuran pada titik tersebut dengan memastikan sudut simpangan awal tidak terlalu besar?`;
    } else if (domain === 'Kimia') {
      dataHighlight = `Seperti membuat minuman teh manis atau larutan kunyit dapur: bila satu tetes terakhir ditambahkan terlalu tergesa-gesa tanpa diaduk merata, warnanya langsung berubah pekat mendadak. Pada titik ekuivalen titrasi atau kalorimeter, perubahan volume tetesan ke-sekian sering kali sangat sensitif.`;
      socraticQuestion = `Coba perhatikan perubahan volume buret Anda: apakah pada saat mendekati lonjakan pH Anda meneteskan titran secara perlahan (drop-by-drop)?`;
    } else if (domain === 'Biologi') {
      dataHighlight = `Dalam pengamatan sel atau enzim, ibarat memotong singkong/kentang untuk direndam air garam dapur: bila ketebalan irisan tidak seragam atau suhu air mendadak naik, laju difusi air akan tampak timpang antar wadah.`;
      socraticQuestion = `Apakah variabel kontrol (seperti volume pelarut dan suhu awal) sudah Anda jaga tetap seragam di setiap tabung percobaan?`;
    } else {
      // Astronomi
      dataHighlight = `Seperti pelaut tradisional yang mengamati bintang Pari di langit malam pesisir: bila sesekali awan tipis melintas, posisi tampak bintang bisa sedikit bergeser dalam catatan pandangan mata.`;
      socraticQuestion = `Apakah periode orbit atau jarak fokus elips Anda telah dihitung menggunakan hukum ketiga Kepler secara konsisten?`;
    }

    return {
      observation,
      dataHighlight,
      socraticQuestion,
      detectedTrigger: trigger,
      formattedText: `${observation}\n\n${dataHighlight}\n\n💡 Pertanyaan Pemantik:\n${socraticQuestion}`,
    };
  }

  // --- 2. DOMAIN-SPECIFIC PEDAGOGICAL SOCRATIC REASONING ---
  if (domain === 'Fisika') {
    if (qLower.includes('sudut') || qLower.includes('kemiringan') || qLower.includes('incline') || qLower.includes('newton')) {
      observation = `Pengamatan yang sangat tajam pada mekanika gerak dan bidang miring (${educationLevel})!`;
      dataHighlight = `Coba bayangkan saat kita mendorong gerobak kayu bermuatan kelapa di jalan tanjakan pegunungan: semakin curam jalan yang kita pilih, gaya ke bawah terasa semakin berat, namun jarak tempuh ke puncak menjadi lebih pendek. Di simulasi, percepatan benda dipengaruhi oleh komponen gaya gravitasi sejajar bidang (g · sin θ).`;
      socraticQuestion = `Bila Anda menaikkan sudut kemiringan sebesar 15 derajat lagi, apakah waktu tempuh benda menuju dasar bidang akan semakin singkat atau semakin lama?`;
    } else if (qLower.includes('bandul') || qLower.includes('tali') || qLower.includes('periode') || qLower.includes('panjang')) {
      observation = `Eksplorasi harmonik yang sangat terstruktur pada sistem bandul (${topic})!`;
      dataHighlight = `Pernahkah Anda memperhatikan jam dinding kayu pendulum atau ayunan anak-anak di pekarangan desa? Ternyata anak kecil dan orang dewasa berayun dengan waktu bolak-balik (periode) yang nyaris persis sama bila panjang tali ayunannya sama! Massa beban tidak memengaruhi periode, hanya panjang tali dan percepatan gravitasi bumi yang menentukannya.`;
      socraticQuestion = `Jika panjang tali Anda gandakan menjadi 4 kali lipat dari nilai saat ini (${currentParameters?.lengthM || 1.2} m), menurut rumus T = 2π√(L/g), berapa kali lipat periode ayunannya akan bertambah?`;
    } else {
      observation = `Eksperimen Fisika Anda menunjukkan tren data yang konsisten (R² = ${r2Str}, Slope = ${slopeVal.toFixed(3)}).`;
      dataHighlight = `Hukum-hukum fisika bekerja tanpa pamrih di sekitar kita, dari perahu nelayan yang melaju saat didayung ke belakang (Hukum III Newton: Aksi-Reaksi) hingga pegas kasur yang meredam tekanan. Data terukur Anda saat ini mencerminkan hukum alam tersebut.`;
      socraticQuestion = `Bagaimana prediksi grafik Anda bila Anda mengubah satu variabel bebas secara ekstrem ke nilai batas minimum?`;
    }
  } else if (domain === 'Kimia') {
    if (qLower.includes('titrasi') || qLower.includes('ph') || qLower.includes('asam') || qLower.includes('basa')) {
      observation = `Analisis stoikiometri asam-basa yang sangat teliti di meja laboratorium virtual Kimia!`;
      dataHighlight = `Di kehidupan sehari-hari daerah sekitar kita, asam dan basa ada di mana-mana: rasa asam segar jeruk nipis dan cuka makan merupakan asam, sementara kapur sirih dan air sabun mandi adalah basa. Ketika keduanya bereaksi dalam jumlah mol yang setara, mereka saling menetralkan menghasilkan air dan garam. Di sekitar pH 7, satu tetes kecil saja mampu membalikkan warna indikator secara dramatis!`;
      socraticQuestion = `Berapakah volume titran yang tercatat saat kurva titrasi Anda mengalami lompatan kemiringan vertikal paling tajam?`;
    } else if (qLower.includes('suhu') || qLower.includes('kalor') || qLower.includes('kinetika') || qLower.includes('laju')) {
      observation = `Pengamatan termokimia dan laju kinetika reaksi yang sangat menarik (${educationLevel})!`;
      dataHighlight = `Ibarat memanggang ubi di bara api atau membuat tapai ketan: ragi dan panas yang pas akan mempercepat proses fermentasi karena partikel-partikel bahan bergerak lebih lincah dan sering bertumbukan dengan energi yang cukup (energi aktivasi Arrhenius).`;
      socraticQuestion = `Apakah kenaikan suhu simulasi saat ini mempercepat pencapaian titik akhir reaksi secara linear atau eksponensial?`;
    } else {
      observation = `Pencatatan data reaksi kimia berjalan sangat baik dengan R² = ${r2Str}.`;
      dataHighlight = `Setiap molekul bereaksi dengan rasio stoikiometri yang pasti. Hukum Kekekalan Massa Lavoisier memastikan materi tidak hilang, melainkan bertransformasi menjadi ikatan zat baru.`;
      socraticQuestion = `Bila konsentrasi reaktan dinaikkan dua kali lipat, bagaimana pengaruhnya terhadap jumlah produk yang dihasilkan?`;
    }
  } else if (domain === 'Biologi') {
    if (qLower.includes('fotosintesis') || qLower.includes('cahaya') || qLower.includes('oksigen') || qLower.includes('daun')) {
      observation = `Pengamatan biologis yang mengagumkan tentang fotosintesis Ingenhousz (${educationLevel})!`;
      dataHighlight = `Perhatikan dedaunan pohon kelapa atau tanaman air di sungai yang terpapar sinar matahari pagi: gelembung-gelembung halus yang terperangkap di bawah daun adalah gas oksigen murni (O₂), bukti fotosintesis mengubah energi surya dan air menjadi karbohidrat kehidupan!`;
      socraticQuestion = `Jika intensitas cahaya dinaikkan namun gelembung oksigen tidak lagi bertambah, faktor pembatas apakah (misal CO₂ atau suhu) yang mulai menahan laju fotosintesis?`;
    } else if (qLower.includes('nadi') || qLower.includes('jantung') || qLower.includes('darah') || qLower.includes('anatomi')) {
      observation = `Kajian fisiologi kardiovaskular dan denyut jantung manusia yang sangat bermakna!`;
      dataHighlight = `Tempelkan dua jari Anda di pergelangan tangan sendiri: denyut ritmis yang terasa adalah gelombang tekanan darah saat bilik kiri jantung (ventrikel sinister) berkontraksi memompa darah ke seluruh tubuh. Saat kita mendayung atau berlari, otot memerlukan lebih banyak oksigen, sehingga nodus SA memerintahkan jantung berdetak lebih cepat.`;
      socraticQuestion = `Menurut data simulasi Anda, berapa curah jantung (Cardiac Output) yang dihasilkan dari perkalian Stroke Volume dengan Heart Rate saat ini?`;
    } else {
      observation = `Pengamatan fenomena biologi dan seluler tercatat dengan baik (${recCount} data).`;
      dataHighlight = `Sel hidup senantiasa menjaga keseimbangan dinamis (homeostasis) terhadap lingkungannya, layaknya sel darah merah yang bertahan dalam plasma darah yang isotonik.`;
      socraticQuestion = `Apa yang terjadi pada sel bila konsentrasi larutan di luar sel dibuat lebih pekat (hipertonik) dibandingkan cairan di dalam sel?`;
    }
  } else {
    // Astronomi
    if (qLower.includes('kepler') || qLower.includes('orbit') || qLower.includes('planet') || qLower.includes('periode')) {
      observation = `Penjelajahan astrofisika dan mekanika orbit langit yang sangat inspiratif (${educationLevel})!`;
      dataHighlight = `Sejak ratusan tahun silam, nenek moyang kita telah membaca langit malam yang jernih di laut nusantara. Johannes Kepler menemukan bahwa orbit planet bukanlah lingkaran sempurna, melainkan elips dengan matahari berada di salah satu titik fokusnya. Karena itu, saat komet atau planet berada di titik terdekat (perihelion), ia meluncur jauh lebih cepat dibanding saat di titik terjauh (aphelion).`;
      socraticQuestion = `Apakah rasio T²/a³ pada planet yang Anda uji sudah mendekati angka konstan sesuai Hukum III Kepler?`;
    } else if (qLower.includes('bintang') || qLower.includes('rasi') || qLower.includes('galaksi') || qLower.includes('waluku') || qLower.includes('pari')) {
      observation = `Pengamatan astrometri langit malam yang kaya kearifan kosmos nusantara!`;
      dataHighlight = `Di daerah minim polusi lampu, langit malam memancarkan kilau ratusan ribu bintang. Rasi Bintang Pari (Crux) menjadi kompas alami penunjuk arah selatan sejati bagi para nelayan, sedangkan Rasi Waluku (Tiga Bintang Sabuk Orion / Bajak Sawah) menjadi penanda kalender musim tanam padi tradisional (Pranata Mangsa) bagi para petani.`;
      socraticQuestion = `Bagaimana hubungan antara warna spektrum cahaya bintang (biru vs merah) dengan suhu permukaan efektifnya menurut Hukum Pergeseran Wien?`;
    } else {
      observation = `Koleksi data observasi astronomi Anda tersusun dengan presisi (R² = ${r2Str}).`;
      dataHighlight = `Gaya gravitasi bekerja di seluruh penjuru semesta, mengikat bulan ke bumi, bumi ke matahari, dan matahari ke pusat galaksi Bima Sakti kita.`;
      socraticQuestion = `Bila jarak antar dua massa benda Anda gandakan menjadi dua kali lipat, menjadi seberapa besarkah gaya tarik gravitasi yang tersisa?`;
    }
  }

  return {
    observation,
    dataHighlight,
    socraticQuestion,
    detectedTrigger: trigger,
    formattedText: `${observation}\n\n${dataHighlight}\n\n💡 Pertanyaan Pemantik Reflektif:\n${socraticQuestion}`,
  };
}
