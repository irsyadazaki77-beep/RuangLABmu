export type StudioDomain = 'physics' | 'chemistry' | 'biology' | 'astronomy';
export type StudioCameraPreset = 'isometric' | 'front' | 'top' | 'focus' | 'ecliptic';

export interface CameraPresetPose {
  pos: [number, number, number];
  target: [number, number, number];
}

export interface ApparatusInspectionInfo {
  id: string;
  title: string;
  category: string;
  roleSummary: string;
  scientificConcept: string;
  relatedFormula: string;
  interactionHint: string;
  paramKey?: string;
}

type ModeCameraMap = Record<string, Record<'isometric' | 'front' | 'top' | 'focus', CameraPresetPose>>;

const PHYSICS_CAMERAS: ModeCameraMap = {
  incline: {
    isometric: { pos: [5.2, 4.8, 10.6], target: [0.0, 1.4, 0.0] },
    front: { pos: [0.0, 2.5, 12.2], target: [0.0, 1.4, 0.0] },
    top: { pos: [0.0, 13.5, 0.6], target: [0.0, 1.0, 0.0] },
    focus: { pos: [2.4, 2.8, 6.4], target: [0.0, 1.5, 0.0] },
  },
  projectile: {
    isometric: { pos: [5.4, 5.2, 11.8], target: [0.6, 1.8, 0.0] },
    front: { pos: [0.6, 2.8, 13.4], target: [0.6, 1.8, 0.0] },
    top: { pos: [0.6, 14.8, 0.6], target: [0.6, 1.2, 0.0] },
    focus: { pos: [-1.0, 2.6, 6.2], target: [-1.8, 1.4, 0.0] },
  },
  pendulum: {
    isometric: { pos: [4.4, 4.2, 9.2], target: [0.0, 2.2, 0.0] },
    front: { pos: [0.0, 2.4, 10.6], target: [0.0, 2.2, 0.0] },
    top: { pos: [0.0, 12.4, 0.5], target: [0.0, 1.8, 0.0] },
    focus: { pos: [2.1, 2.3, 5.6], target: [0.0, 1.8, 0.0] },
  },
  spring: {
    isometric: { pos: [4.4, 4.2, 9.0], target: [0.0, 2.2, 0.0] },
    front: { pos: [0.0, 2.4, 10.4], target: [0.0, 2.2, 0.0] },
    top: { pos: [0.0, 12.0, 0.5], target: [0.0, 1.8, 0.0] },
    focus: { pos: [2.1, 2.4, 5.4], target: [0.0, 2.0, 0.0] },
  },
  collision: {
    isometric: { pos: [4.8, 4.6, 10.6], target: [0.0, 1.2, 0.0] },
    front: { pos: [0.0, 2.3, 12.0], target: [0.0, 1.2, 0.0] },
    top: { pos: [0.0, 13.2, 0.5], target: [0.0, 1.0, 0.0] },
    focus: { pos: [2.4, 2.4, 6.0], target: [0.0, 1.2, 0.0] },
  },
  stokes: {
    isometric: { pos: [4.2, 4.0, 8.8], target: [0.0, 2.2, 0.0] },
    front: { pos: [0.0, 2.4, 10.0], target: [0.0, 2.2, 0.0] },
    top: { pos: [0.0, 11.8, 0.5], target: [0.0, 1.9, 0.0] },
    focus: { pos: [1.9, 2.4, 5.2], target: [0.0, 2.2, 0.0] },
  },
  wheatstone: {
    isometric: { pos: [4.5, 5.0, 9.2], target: [0.0, 1.15, 0.0] },
    front: { pos: [0.0, 2.8, 10.6], target: [0.0, 1.15, 0.0] },
    top: { pos: [0.0, 11.2, 0.5], target: [0.0, 1.0, 0.0] },
    focus: { pos: [2.0, 2.8, 5.4], target: [0.0, 1.2, 0.0] },
  },
  optics: {
    isometric: { pos: [5.0, 4.4, 10.6], target: [0.2, 1.45, 0.0] },
    front: { pos: [0.2, 2.4, 12.0], target: [0.2, 1.45, 0.0] },
    top: { pos: [0.2, 13.0, 0.5], target: [0.2, 1.2, 0.0] },
    focus: { pos: [2.6, 2.2, 6.0], target: [1.8, 1.5, 0.0] },
  },
  photoelectric: {
    isometric: { pos: [4.6, 4.2, 9.4], target: [0.0, 1.6, 0.0] },
    front: { pos: [0.0, 2.3, 10.8], target: [0.0, 1.6, 0.0] },
    top: { pos: [0.0, 12.0, 0.5], target: [0.0, 1.4, 0.0] },
    focus: { pos: [2.1, 2.2, 5.6], target: [0.0, 1.65, 0.0] },
  },
  gravity: {
    isometric: { pos: [5.0, 5.0, 10.4], target: [0.0, 1.7, 0.0] },
    front: { pos: [0.0, 2.6, 11.8], target: [0.0, 1.7, 0.0] },
    top: { pos: [0.0, 13.2, 0.5], target: [0.0, 1.6, 0.0] },
    focus: { pos: [2.5, 2.6, 6.0], target: [0.0, 1.8, 0.0] },
  },
};

const CHEMISTRY_CAMERAS: ModeCameraMap = {
  calorimetry: {
    isometric: { pos: [4.6, 5.1, 10.2], target: [0.0, 1.5, 0.0] },
    front: { pos: [0.0, 2.7, 11.2], target: [0.0, 1.5, 0.0] },
    top: { pos: [0.0, 13.0, 0.5], target: [0.0, 1.1, 0.0] },
    focus: { pos: [2.0, 2.5, 5.4], target: [0.0, 1.45, 0.0] },
  },
  titration: {
    isometric: { pos: [5.2, 5.6, 12.0], target: [0.0, 2.25, 0.0] },
    front: { pos: [0.0, 3.2, 13.0], target: [0.0, 2.25, 0.0] },
    top: { pos: [0.0, 14.5, 0.5], target: [0.0, 1.8, 0.0] },
    focus: { pos: [2.2, 2.5, 5.6], target: [0.0, 1.55, 0.0] },
  },
  electrochemistry: {
    isometric: { pos: [5.0, 5.2, 10.8], target: [0.0, 1.6, 0.0] },
    front: { pos: [0.0, 2.8, 11.8], target: [0.0, 1.6, 0.0] },
    top: { pos: [0.0, 13.6, 0.5], target: [0.0, 1.4, 0.0] },
    focus: { pos: [2.2, 2.5, 5.8], target: [0.0, 1.65, 0.0] },
  },
  'ideal-gas': {
    isometric: { pos: [4.6, 5.0, 10.2], target: [0.0, 1.65, 0.0] },
    front: { pos: [0.0, 2.7, 11.2], target: [0.0, 1.65, 0.0] },
    top: { pos: [0.0, 13.0, 0.5], target: [0.0, 1.4, 0.0] },
    focus: { pos: [2.0, 2.5, 5.4], target: [0.0, 1.6, 0.0] },
  },
  kinetics: {
    isometric: { pos: [4.6, 5.0, 10.2], target: [0.0, 1.55, 0.0] },
    front: { pos: [0.0, 2.6, 11.2], target: [0.0, 1.55, 0.0] },
    top: { pos: [0.0, 13.0, 0.5], target: [0.0, 1.3, 0.0] },
    focus: { pos: [2.0, 2.5, 5.4], target: [0.0, 1.5, 0.0] },
  },
  spectrophotometry: {
    isometric: { pos: [5.0, 5.0, 10.8], target: [0.0, 1.5, 0.0] },
    front: { pos: [0.0, 2.6, 11.8], target: [0.0, 1.5, 0.0] },
    top: { pos: [0.0, 13.4, 0.5], target: [0.0, 1.3, 0.0] },
    focus: { pos: [2.2, 2.4, 5.6], target: [0.0, 1.45, 0.0] },
  },
};

const BIOLOGY_CAMERAS: ModeCameraMap = {
  photosynthesis: {
    isometric: { pos: [3.6, 4.4, 9.8], target: [-0.2, 1.55, 0.0] },
    front: { pos: [-0.2, 2.4, 10.8], target: [-0.2, 1.55, 0.0] },
    top: { pos: [0.0, 12.2, 0.5], target: [-0.15, 0.9, 0.0] },
    focus: { pos: [1.5, 2.2, 4.8], target: [0.0, 1.35, 0.0] },
  },
  enzyme: {
    isometric: { pos: [3.6, 4.3, 8.9], target: [0.0, 1.5, 0.0] },
    front: { pos: [0.0, 2.4, 9.8], target: [0.0, 1.5, 0.0] },
    top: { pos: [0.0, 11.6, 0.5], target: [0.0, 1.0, 0.0] },
    focus: { pos: [1.5, 2.2, 4.6], target: [0.0, 1.4, 0.0] },
  },
  osmosis: {
    isometric: { pos: [3.5, 4.2, 8.6], target: [0.0, 1.4, 0.0] },
    front: { pos: [0.0, 2.3, 9.4], target: [0.0, 1.4, 0.0] },
    top: { pos: [0.0, 11.2, 0.5], target: [0.0, 1.0, 0.0] },
    focus: { pos: [1.4, 2.1, 4.5], target: [0.0, 1.35, 0.0] },
  },
  'predator-prey': {
    isometric: { pos: [3.9, 4.6, 9.4], target: [0.0, 1.2, 0.0] },
    front: { pos: [0.0, 2.5, 10.2], target: [0.0, 1.2, 0.0] },
    top: { pos: [0.0, 12.0, 0.5], target: [0.0, 0.8, 0.0] },
    focus: { pos: [1.6, 2.2, 5.0], target: [0.0, 1.15, 0.0] },
  },
  'anatomy-heart': {
    isometric: { pos: [0.35, 1.6, 6.9], target: [0.0, 0.15, 0.0] },
    front: { pos: [0.0, 0.85, 7.3], target: [0.0, 0.15, 0.0] },
    top: { pos: [0.0, 7.4, 0.5], target: [0.0, 0.0, 0.0] },
    focus: { pos: [1.4, 0.85, 3.8], target: [0.15, 0.05, 0.0] },
  },
  'anatomy-lungs': {
    isometric: { pos: [0.0, 1.55, 7.3], target: [0.0, 0.15, 0.0] },
    front: { pos: [0.0, 0.85, 7.7], target: [0.0, 0.15, 0.0] },
    top: { pos: [0.0, 7.8, 0.5], target: [0.0, 0.0, 0.0] },
    focus: { pos: [1.35, 0.85, 4.0], target: [0.0, 0.15, 0.0] },
  },
  'anatomy-neuron': {
    isometric: { pos: [0.5, 1.65, 7.8], target: [0.0, 0.1, 0.0] },
    front: { pos: [0.0, 0.85, 8.2], target: [0.0, 0.1, 0.0] },
    top: { pos: [0.0, 8.2, 0.5], target: [0.0, 0.0, 0.0] },
    focus: { pos: [1.55, 0.85, 4.2], target: [0.2, 0.05, 0.0] },
  },
};

const ASTRONOMY_CAMERAS: ModeCameraMap = {
  kepler: {
    isometric: { pos: [0.0, 9.2, 14.2], target: [0, 0, 0] },
    front: { pos: [0.0, 1.4, 15.6], target: [0, 0, 0] },
    top: { pos: [0.0, 19.2, 0.5], target: [0, 0, 0] },
    focus: { pos: [2.5, 4.2, 8.6], target: [0, 0, 0] },
  },
  'milky-way': {
    isometric: { pos: [0.0, 9.8, 14.8], target: [0, 0, 0] },
    front: { pos: [0.0, 1.8, 16.0], target: [0, 0, 0] },
    top: { pos: [0.0, 19.8, 0.5], target: [0, 0, 0] },
    focus: { pos: [2.8, 4.6, 9.0], target: [0, 0, 0] },
  },
  exoplanet: {
    isometric: { pos: [3.4, 3.2, 10.2], target: [0, 0.2, 0] },
    front: { pos: [0.0, 0.9, 10.6], target: [0, 0.4, 0] },
    top: { pos: [0.0, 13.0, 0.5], target: [0, 0.5, 0] },
    focus: { pos: [0.0, 1.3, 8.8], target: [0, 0.85, 0] },
  },
  wien: {
    isometric: { pos: [3.4, 4.0, 10.6], target: [0, 0.1, 0] },
    front: { pos: [0.0, 1.3, 11.4], target: [0, 0.1, 0] },
    top: { pos: [0.0, 14.2, 0.5], target: [0, 0, 0] },
    focus: { pos: [2.2, 2.2, 7.2], target: [0, 0.1, 0] },
  },
  hubble: {
    isometric: { pos: [2.2, 8.2, 14.0], target: [0, 0, 0] },
    front: { pos: [0.0, 1.6, 15.2], target: [0, 0, 0] },
    top: { pos: [0.0, 18.6, 0.5], target: [0, 0, 0] },
    focus: { pos: [2.6, 3.8, 8.4], target: [0, 0, 0] },
  },
};

export function normalizeStudioModeKey(domain: StudioDomain, rawMode: string): string {
  const m = (rawMode || '').toLowerCase();
  if (domain === 'physics') {
    if (m.includes('projectile')) return 'projectile';
    if (m.includes('pendulum')) return 'pendulum';
    if (m.includes('spring')) return 'spring';
    if (m.includes('collision')) return 'collision';
    if (m.includes('stokes')) return 'stokes';
    if (m.includes('wheatstone') || m.includes('ohm')) return 'wheatstone';
    if (m.includes('optics') || m.includes('young')) return 'optics';
    if (m.includes('photoelectric') || m.includes('planck')) return 'photoelectric';
    if (m.includes('gravity') || m.includes('orbital')) return 'gravity';
    return 'incline';
  }
  if (domain === 'chemistry') {
    if (m.includes('titration') || m.includes('acid')) return 'titration';
    if (m.includes('electro') || m.includes('redox')) return 'electrochemistry';
    if (m.includes('gas') || m.includes('boyle')) return 'ideal-gas';
    if (m.includes('kinetic') || m.includes('arrhenius')) return 'kinetics';
    if (m.includes('spectro') || m.includes('beer')) return 'spectrophotometry';
    return 'calorimetry';
  }
  if (domain === 'biology') {
    if (m.includes('enzyme') || m.includes('catalase')) return 'enzyme';
    if (m.includes('osmosis') || m.includes('plasmolysis')) return 'osmosis';
    if (m.includes('predator') || m.includes('prey')) return 'predator-prey';
    if (m.includes('heart') || m.includes('cardio')) return 'anatomy-heart';
    if (m.includes('lung') || m.includes('respir')) return 'anatomy-lungs';
    if (m.includes('neural') || m.includes('neuron') || m.includes('synapse')) return 'anatomy-neuron';
    return 'photosynthesis';
  }
  if (m.includes('milky') || m.includes('galaxy') || m.includes('rotation')) return 'milky-way';
  if (m.includes('exoplanet') || m.includes('transit')) return 'exoplanet';
  if (m.includes('wien') || m.includes('stellar') || m.includes('spectrum')) return 'wien';
  if (m.includes('hubble') || m.includes('expansion')) return 'hubble';
  return 'kepler';
}

export function getAdaptiveCameraPose(
  domain: StudioDomain,
  mode: string,
  preset: StudioCameraPreset = 'isometric'
): CameraPresetPose {
  const normalizedPreset: 'isometric' | 'front' | 'top' | 'focus' =
    preset === 'ecliptic' ? 'front' : preset;
  const canonicalMode = normalizeStudioModeKey(domain, mode);

  const map =
    domain === 'physics'
      ? PHYSICS_CAMERAS
      : domain === 'chemistry'
      ? CHEMISTRY_CAMERAS
      : domain === 'biology'
      ? BIOLOGY_CAMERAS
      : ASTRONOMY_CAMERAS;

  const modeEntry = map[canonicalMode] || Object.values(map)[0];
  return modeEntry[normalizedPreset] || modeEntry.isometric;
}

const INSPECTION_CATALOG: Record<string, ApparatusInspectionInfo> = {
  // Physics
  'incline:block': {
    id: 'incline:block',
    title: 'Balok Uji Dinamika',
    category: 'Fisika · Mekanika',
    roleSummary: 'Benda uji bermassa m yang mengalami dorongan luar F, gaya berat m·g, gaya normal N, dan gesek kinetis fₖ.',
    scientificConcept: 'Hukum II Newton menguraikan gaya berat ke sumbu sejajar bidang (m·g·sin θ) dan tegak lurus bidang (m·g·cos θ).',
    relatedFormula: 'a = (F − m·g·sin θ − μₖ·m·g·cos θ) / m',
    interactionHint: 'Ubah sudut kemiringan θ atau gaya dorong F di Panel Variabel untuk melihat arah dan panjang vektor gaya berubah real-time.',
    paramKey: 'appliedForce',
  },
  'incline:ramp': {
    id: 'incline:ramp',
    title: 'Bidang Miring Berbusur Derajat',
    category: 'Fisika · Alat Ukur',
    roleSummary: 'Lintasan miring dengan sudut elevasi θ yang dapat diatur dan skala panjang sentimeter terkalibrasi.',
    scientificConcept: 'Semakin besar sudut θ, komponen gravitasi pendorong bertambah sementara gaya normal dan gesek berkurang.',
    relatedFormula: 'N = m·g·cos θ,   fₖ = μₖ·N',
    interactionHint: 'Aktifkan mistar Ukur 3D di dok bawah untuk mengukur jarak luncur balok secara langsung.',
    paramKey: 'inclineAngle',
  },
  'projectile:cannon': {
    id: 'projectile:cannon',
    title: 'Peluncur Proyektil & Proyektil',
    category: 'Fisika · Kinematika 2D',
    roleSummary: 'Laras peluncur bersudut elevasi θ dan kecepatan awal v₀ yang menembakkan proyektil melintasi lintasan parabola.',
    scientificConcept: 'Gerak horizontal bersifat konstan (GLB) sedangkan vertikal dipercepat gravitasi −g (GLBB).',
    relatedFormula: 'R = (v₀²·sin 2θ) / g,   Hₘₐₖₛ = (v₀²·sin²θ) / (2g)',
    interactionHint: 'Coba pasangan sudut 30° dan 60° pada ketinggian awal 0 m untuk membuktikan jarak jangkauan R yang sama.',
    paramKey: 'launchAngle',
  },
  'pendulum:bob': {
    id: 'pendulum:bob',
    title: 'Bandul Matematis & Tali Gantung',
    category: 'Fisika · Getaran Harmonik',
    roleSummary: 'Beban logam berayun isokronik pada ujung tali sepanjang L untuk mengukur percepatan gravitasi lokal.',
    scientificConcept: 'Untuk sudut kecil (≤ 15°), periode ayunan hanya bergantung pada panjang tali L dan gravitasi g, bebas dari massa beban.',
    relatedFormula: 'T = 2π·√(L / g)',
    interactionHint: 'Ubah panjang tali L menjadi 4× lipat dan amati periode ayunan T melambat tepat 2× lipat.',
    paramKey: 'length',
  },
  'spring:coil': {
    id: 'spring:coil',
    title: 'Pegas Heliks & Beban Osilator',
    category: 'Fisika · Elastisitas',
    roleSummary: 'Pegas baja berkonstanta k yang menghasilkan gaya pemulih elastis berlawanan arah simpangan.',
    scientificConcept: 'Hukum Hooke menghasilkan gerak harmonik vertikal dengan periode T = 2π·√(m/k).',
    relatedFormula: 'F = −k·Δx,   T = 2π·√(m / k)',
    interactionHint: 'Naikkan konstanta pegas k untuk melihat osilasi menjadi jauh lebih cepat dan kaku.',
    paramKey: 'springConstantK',
  },
  'collision:carts': {
    id: 'collision:carts',
    title: 'Rel Udara & Troli Tumbukan',
    category: 'Fisika · Momentum & Impuls',
    roleSummary: 'Dua troli beroda minim gesekan untuk menguji tumbukan lenting sempurna (e = 1) hingga tak lenting (e = 0).',
    scientificConcept: 'Momentum linear total p = m₁v₁ + m₂v₂ selalu kekal meski energi kinetik terdisipasi saat e < 1.',
    relatedFormula: 'm₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′',
    interactionHint: 'Ubah koefisien restitusi e dari 1,0 ke 0,0 untuk membandingkan tumbukan memantul vs menempel.',
    paramKey: 'restitutionCoeff',
  },
  'stokes:tube': {
    id: 'stokes:tube',
    title: 'Tabung Fluida Kental & Bola Uji',
    category: 'Fisika · Dinamika Fluida',
    roleSummary: 'Silinder kaca berskala berisi gliserol/minyak tempat bola baja mencapai kecepatan terminal konstan.',
    scientificConcept: 'Kecepatan terminal tercapai saat gaya berat diseimbangkan sempurna oleh gaya apung Archimedes dan gaya seret Stokes.',
    relatedFormula: 'vₜ = 2·r²·g·(ρₛ − ρₗ) / (9·η)',
    interactionHint: 'Perbesar jari-jari bola r dan saksikan kecepatan jatuh melonjak sebanding dengan r².',
    paramKey: 'ballRadiusMm',
  },
  'wheatstone:bridge': {
    id: 'wheatstone:bridge',
    title: 'Jembatan Wheatstone & Galvanometer',
    category: 'Fisika · Listrik Arus Searah',
    roleSummary: 'Rangkaian empat resistor berbentuk belah ketupat dengan galvanometer tengah untuk pengukuran hambatan metode nol.',
    scientificConcept: 'Saat jarum galvanometer tepat di 0 mV, perbandingan hambatan cabang kiri sama dengan cabang kanan.',
    relatedFormula: 'Rₓ = R₃ · (R₂ / R₁)   saat Vg = 0',
    interactionHint: 'Geser resistor kalibrasi R₃ hingga beda potensial jembatan Vg tepat mencapai nol.',
    paramKey: 'resistor3',
  },
  'optics:slit': {
    id: 'optics:slit',
    title: 'Laser Monokromatik, Celah Ganda & Layar',
    category: 'Fisika · Optika Gelombang',
    roleSummary: 'Sumber laser berpanjang gelombang λ menyinari celah berjarak d membentuk pita interferensi terang-gelap di layar.',
    scientificConcept: 'Gelombang koheren dari dua celah saling menguatkan (pita terang) dan meniadakan (pita gelap).',
    relatedFormula: 'Δy = (λ · L) / d',
    interactionHint: 'Ganti panjang gelombang λ dari merah (650 nm) ke biru (450 nm) dan amati pita terang merapat.',
    paramKey: 'wavelengthNm',
  },
  'photoelectric:cell': {
    id: 'photoelectric:cell',
    title: 'Tabung Vakum Fotolistrik & Katoda',
    category: 'Fisika · Fisika Kuantum',
    roleSummary: 'Pelat logam katoda berenergi ikat W₀ yang melepaskan elektron foto ketika ditembak foton berfrekuensi tinggi.',
    scientificConcept: 'Hanya foton dengan E = h·c/λ > W₀ yang sanggup melepaskan elektron; kelebihan energi menjadi Eₖ maks.',
    relatedFormula: 'e·V₀ = h·f − W₀',
    interactionHint: 'Turunkan panjang gelombang λ menuju violet (≤ 420 nm) untuk melihat aliran elektron foto mulai terbentuk.',
    paramKey: 'wavelengthNm',
  },
  'gravity:planet': {
    id: 'gravity:planet',
    title: 'Planet Sentral & Satelit Pengorbit',
    category: 'Fisika · Gravitasi Universal',
    roleSummary: 'Sistem dua benda yang menunjukkan keseimbangan gaya gravitasi Newton dan percepatan sentripetal orbit.',
    scientificConcept: 'Kecepatan lepas selalu √2 kali kecepatan orbit lingkaran pada jarak r yang sama.',
    relatedFormula: 'v orbit = √(G·M / r),   v lepas = √(2·G·M / R)',
    interactionHint: 'Perbesar massa planet sentral dan amati kecepatan orbit serta kecepatan lepas meningkat.',
    paramKey: 'secondaryMass',
  },

  // Chemistry
  'calorimetry:vessel': {
    id: 'calorimetry:vessel',
    title: 'Kalorimeter Terisolasi & Termometer',
    category: 'Kimia · Termokimia',
    roleSummary: 'Bejana berinsulasi dengan pengaduk magnetik dan termometer digital untuk menangkap seluruh kalor reaksi.',
    scientificConcept: 'Kalor reaksi netralisasi eksotermik dilepas ke larutan sehingga suhu naik sebanding dengan jumlah mol bereaksi.',
    relatedFormula: 'q = m · c · ΔT,   ΔH = −q / n',
    interactionHint: 'Naikkan konsentrasi reaktan untuk mengamati kenaikan ΔT lebih tinggi namun ΔH molar tetap ~ −57,3 kJ/mol.',
    paramKey: 'reactantConcentration',
  },
  'titration:burette': {
    id: 'titration:burette',
    title: 'Buret Skala 50 mL & Labu Erlenmeyer',
    category: 'Kimia · Volumetri Asam-Basa',
    roleSummary: 'Buret kaca borosilikat bertutup kran presisi yang meneteskan titran NaOH ke analit HCl berindikator fenolftalein.',
    scientificConcept: 'Tepat saat mol OH⁻ = mol H⁺ (titik ekuivalen), pH melonjak tajam membentuk kurva sigmoid dan larutan berubah merah muda.',
    relatedFormula: 'Mₐ · Vₐ = Mᵦ · Vᵦ,   pH = −log₁₀[H⁺]',
    interactionHint: 'Gunakan tombol Probe pH 3D di dok bawah atau tambahkan volume titran mendekati Vₑ untuk melihat perubahan warna indikator.',
    paramKey: 'titrantAddedMl',
  },
  'electrochemistry:cell': {
    id: 'electrochemistry:cell',
    title: 'Sel Volta Daniell (Anoda Zn · Katoda Cu)',
    category: 'Kimia · Elektrokimia',
    roleSummary: 'Dua gelas setengah sel dihubungkan jembatan garam KNO₃ dan voltmeter digital pengukur potensial sel.',
    scientificConcept: 'Elektron mengalir dari anoda Zn (oksidasi) ke katoda Cu (reduksi); tegangan aktual mengikuti Persamaan Nernst.',
    relatedFormula: 'E = E° − (0,0592 / 2)·log([Zn²⁺] / [Cu²⁺])',
    interactionHint: 'Encerkan [Zn²⁺] ke 0,01 M dan lihat tegangan voltmeter naik melampaui E° = 1,100 V.',
    paramKey: 'anodeConcM',
  },
  'ideal-gas:piston': {
    id: 'ideal-gas:piston',
    title: 'Silinder Piston Gas & Manometer',
    category: 'Kimia · Teori Kinetik Gas',
    roleSummary: 'Silinder transparan berisi partikel gas bergerak acak dengan piston pengatur volume V dan pengukur tekanan P.',
    scientificConcept: 'Memperkecil volume menaikkan frekuensi tumbukan molekul ke dinding (Hukum Boyle); memanaskan mempercepat gerak partikel.',
    relatedFormula: 'P · V = n · R · T',
    interactionHint: 'Bandingkan kompresi mode Isotermal vs Adiabatik untuk melihat lonjakan tekanan ekstra pada proses adiabatik.',
    paramKey: 'volumeL',
  },
  'kinetics:beaker': {
    id: 'kinetics:beaker',
    title: 'Reaktor Kinetika & Pengatur Suhu',
    category: 'Kimia · Laju Reaksi',
    roleSummary: 'Wadah reaksi bermolekul dinamis yang menunjukkan frekuensi tumbukan efektif melampaui energi aktivasi Eₐ.',
    scientificConcept: 'Persamaan Arrhenius menunjukkan kenaikan suhu atau penurunan Eₐ mempercepat reaksi secara eksponensial.',
    relatedFormula: 'k = A · e^(−Eₐ / R·T),   t½ = 0,693 / k',
    interactionHint: 'Naikkan suhu reaksi tiap 10°C dan amati waktu paruh reaksi menyusut tajam.',
    paramKey: 'temperatureC',
  },
  'spectrophotometry:cuvette': {
    id: 'spectrophotometry:cuvette',
    title: 'Spektrofotometer UV-Vis & Kuvet Sampel',
    category: 'Kimia · Kimia Analitik',
    roleSummary: 'Berkas monokromatik λ menembus kuvet sampel berkonsentrasi c menuju fotodioda pengukur transmitansi.',
    scientificConcept: 'Hukum Lambert-Beer menghubungkan absorbansi A secara linear terhadap konsentrasi analit dan lebar kuvet.',
    relatedFormula: 'A = ε · b · c = −log₁₀(T)',
    interactionHint: 'Ubah konsentrasi c dan perhatikan pelemahan intensitas sinar keluar kuvet.',
    paramKey: 'concentrationMm',
  },

  // Biology & Anatomy
  'photosynthesis:hydrilla': {
    id: 'photosynthesis:hydrilla',
    title: 'Aparatus Ingenhousz & Hydrilla',
    category: 'Biologi · Fisiologi Tumbuhan',
    roleSummary: 'Tanaman air Hydrilla di bawah corong kaca terbalik yang melepaskan aliran gelembung gas O₂ saat disinari lampu.',
    scientificConcept: 'Klorofil paling aktif menyerap spektrum biru (~435 nm) dan merah (~660 nm), sedangkan cahaya hijau dipantulkan.',
    relatedFormula: '6 CO₂ + 6 H₂O + Cahaya → C₆H₁₂O₆ + 6 O₂',
    interactionHint: 'Ganti warna spektrum cahaya ke hijau (~530 nm) dan saksikan produksi gelembung O₂ turun drastis.',
    paramKey: 'wavelengthNm',
  },
  'enzyme:tube': {
    id: 'enzyme:tube',
    title: 'Tabung Reaksi Katalase & Kolom Busa O₂',
    category: 'Biologi · Enzimologi',
    roleSummary: 'Ekstrak hati kaya katalase bereaksi dengan H₂O₂ membentuk busa oksigen tinggi pada suhu 37°C dan pH 7.',
    scientificConcept: 'Enzim mempercepat reaksi tanpa ikut habis, namun rusak permanen (denaturasi) pada suhu panas > 55–65°C.',
    relatedFormula: 'v = (Vₘₐₖₛ · [S]) / (Kₘ + [S])',
    interactionHint: 'Naikkan suhu di atas 60°C untuk mengamati kolom busa lenyap akibat denaturasi protein enzim.',
    paramKey: 'temperatureC',
  },
  'osmosis:cell': {
    id: 'osmosis:cell',
    title: 'Model Sel Tumbuhan & Larutan Sukrosa',
    category: 'Biologi · Transport Membran',
    roleSummary: 'Visualisasi vakuola dan membran plasma di dalam dinding selulosa kaku saat direndam berbagai molaritas gula.',
    scientificConcept: 'Air mengalir dari potensial tinggi ke rendah; di larutan hipertonik membran menyusut lepas (plasmolisis).',
    relatedFormula: 'Ψₛ = −i · C · R · T',
    interactionHint: 'Geser konsentrasi sukrosa dari 0,0 M (turgid) ke 0,8 M (plasmolisis) untuk melihat perubahan ukuran vakuola.',
    paramKey: 'sucroseConcMolar',
  },
  'predator-prey:biome': {
    id: 'predator-prey:biome',
    title: 'Ekosistem Dinamika Mangsa & Predator',
    category: 'Biologi · Ekologi Kuantitatif',
    roleSummary: 'Habitat spasial 3D tempat populasi mangsa (hijau) dan predator (merah) berinteraksi dalam siklus periodik.',
    scientificConcept: 'Model Lotka-Volterra menghasilkan osilasi siklik dengan puncak predator tertinggal di belakang puncak mangsa.',
    relatedFormula: 'dx/dt = αx − βxy,   dy/dt = δxy − γy',
    interactionHint: 'Amati bagaimana lonjakan mangsa memicu peningkatan predator beberapa siklus kemudian.',
    paramKey: 'preyGrowthRateAlpha',
  },
  'anatomy:heart': {
    id: 'anatomy:heart',
    title: 'Anatomi Jantung 4 Ruang & Pembuluh',
    category: 'Biologi · Sistem Kardiovaskular',
    roleSummary: 'Model 3D jantung berdenyut real-time dengan aliran darah kaya O₂ (merah) dan miskin O₂ (biru) serta sinyal EKG.',
    scientificConcept: 'Curah jantung CO = (HR × SV)/1000 dan resistensi pembuluh meningkat ekstrem (∝ 1/r⁴) saat arteri menyempit.',
    relatedFormula: 'CO = (HR × SV) / 1000,   R ∝ η / r⁴',
    interactionHint: 'Perkecil rasio radius pembuluh r/r₀ untuk mengamati dampak penyempitan aterosklerosis pada hemodinamika.',
    paramKey: 'vesselRadiusRatio',
  },
  'anatomy:lungs': {
    id: 'anatomy:lungs',
    title: 'Paru-Paru, Bronkus & Kubah Diafragma',
    category: 'Biologi · Sistem Respirasi',
    roleSummary: 'Model toraks 3D yang menunjukkan pengembangan lobus paru seiring kontraksi kubah diafragma (Hukum Boyle).',
    scientificConcept: 'Ventilasi menit MV = RR × TV dan pengikatan O₂ hemoglobin mengikuti kurva saturasi sigmoid Hill.',
    relatedFormula: 'MV = (RR × TV) / 1000',
    interactionHint: 'Naikkan ketinggian lokasi (mdpl) untuk melihat penurunan saturasi SpO₂ pada kondisi hipoksia gunung tinggi.',
    paramKey: 'altitudeMeters',
  },
  'anatomy:neuron': {
    id: 'anatomy:neuron',
    title: 'Neuron Bermielin & Celah Sinapsis',
    category: 'Biologi · Sistem Saraf',
    roleSummary: 'Struktur dendrit, badan sel, akson berselubung mielin (Nodus Ranvier), dan terminal sinapsis pelepas neurotransmiter.',
    scientificConcept: 'Stimulus ≥ −55 mV memicu depolarisasi All-or-None (+30 mV) yang melompat cepat melalui konduksi saltatorik.',
    relatedFormula: 'E ion = (61,5 / z) · log₁₀([luar] / [dalam])',
    interactionHint: 'Ubah ketebalan selubung mielin dari 0% ke 100% dan bandingkan kecepatan rambat impuls.',
    paramKey: 'myelinThickness',
  },

  // Astronomy
  'kepler:orbit': {
    id: 'kepler:orbit',
    title: 'Bintang Induk & Planet Berorbit Elips',
    category: 'Astronomi · Mekanika Orbit',
    roleSummary: 'Simulasi orbit elips dengan eksentrisitas e dan sumbu semi-mayor a yang mematuhi ketiga Hukum Kepler.',
    scientificConcept: 'Planet melesat paling cepat di perihelion dan memenuhi hubungan kuadrat periode T² = a³ / M*.',
    relatedFormula: 'T² = a³ / M*',
    interactionHint: 'Naikkan eksentrisitas e ke 0,60 untuk melihat perbedaan kelajuan perihelion vs aphelion secara dramatis.',
    paramKey: 'customEccentricity',
  },
  'milky-way:galaxy': {
    id: 'milky-way:galaxy',
    title: 'Piringan Spiral Bima Sakti & Halo Materi Gelap',
    category: 'Astronomi · Astrofisika Galaksi',
    roleSummary: 'Ribuan bintang piringan spiral yang diselubungi halo tak tampak Materi Gelap penjaga kurva rotasi datar.',
    scientificConcept: 'Tanpa halo materi gelap, kecepatan bintang pinggiran akan meluruh 1/√r; keberadaannya mempertahankan ~220 km/s.',
    relatedFormula: 'v(r) = √(G · M(<r) / r)',
    interactionHint: 'Turunkan fraksi materi gelap ke 0 untuk membandingkan prediksi Keplerian vs observasi Vera Rubin.',
    paramKey: 'darkMatterHaloFraction',
  },
  'exoplanet:system': {
    id: 'exoplanet:system',
    title: 'Bintang Induk & Transit Eksoplanet',
    category: 'Astronomi · Fotometri Eksoplanet',
    roleSummary: 'Eksoplanet melintasi piringan bintang menciptakan gerhana mini yang terekam sebagai penurunan kurva cahaya.',
    scientificConcept: 'Persentase redupnya cahaya bintang mengungkap langsung rasio ukuran planet terhadap bintangnya.',
    relatedFormula: 'ΔF / F = (Rₚ / R*)²',
    interactionHint: 'Ubah sudut kamera ke Depan (Ekliptika) untuk menyaksikan peristiwa transit tepat sejajar garis pandang.',
    paramKey: 'exoplanetRadiusEarth',
  },
  'wien:star': {
    id: 'wien:star',
    title: 'Fotosfer Bintang & Spektrum Benda Hitam',
    category: 'Astronomi · Spektroskopi Bintang',
    roleSummary: 'Model fotosfer bintang dengan warna pijar fisik berubah dari merah dingin (~3000 K) hingga biru super panas (>12.000 K).',
    scientificConcept: 'Hukum Wien menggeser puncak spektrum ke λ lebih pendek saat suhu naik, sementara daya pancar melonjak ∝ T⁴.',
    relatedFormula: 'λ maks · T = 2,898 × 10⁶ nm·K,   L ∝ R²·T⁴',
    interactionHint: 'Geser suhu efektif T dari 3000 K ke 15.000 K dan amati pergeseran warna dan luminositas bintang.',
    paramKey: 'starEffectiveTempK',
  },
  'hubble:cosmos': {
    id: 'hubble:cosmos',
    title: 'Jaring Galaksi & Ekspansi Ruang Waktu',
    category: 'Astronomi · Kosmologi',
    roleSummary: 'Gugus galaksi pada berbagai jarak Mpc yang memerah (redshift) seiring peregangan metrik ruang semesta.',
    scientificConcept: 'Makin jauh sebuah galaksi, makin besar kecepatan resesinya (v = H₀·d) dan pergeseran merah spektrumnya.',
    relatedFormula: 'v = H₀ · d,   z = (λ obs − λ₀) / λ₀',
    interactionHint: 'Naikkan jarak galaksi d untuk mengamati pergeseran garis spektrum menjauh ke arah warna merah.',
    paramKey: 'galaxyDistanceMpc',
  },
};

export function resolveApparatusInspection(
  domain: StudioDomain,
  mode: string,
  hintKeyOrLabel?: string
): ApparatusInspectionInfo {
  const canonical = normalizeStudioModeKey(domain, mode);
  const hint = (hintKeyOrLabel || '').toLowerCase();

  if (domain === 'physics') {
    if (canonical === 'incline') {
      if (hint.includes('ramp') || hint.includes('bidang') || hint.includes('normal') || hint.includes('gesek')) {
        return INSPECTION_CATALOG['incline:ramp'];
      }
      return INSPECTION_CATALOG['incline:block'];
    }
    if (canonical === 'projectile') return INSPECTION_CATALOG['projectile:cannon'];
    if (canonical === 'pendulum') return INSPECTION_CATALOG['pendulum:bob'];
    if (canonical === 'spring') return INSPECTION_CATALOG['spring:coil'];
    if (canonical === 'collision') return INSPECTION_CATALOG['collision:carts'];
    if (canonical === 'stokes') return INSPECTION_CATALOG['stokes:tube'];
    if (canonical === 'wheatstone') return INSPECTION_CATALOG['wheatstone:bridge'];
    if (canonical === 'optics') return INSPECTION_CATALOG['optics:slit'];
    if (canonical === 'photoelectric') return INSPECTION_CATALOG['photoelectric:cell'];
    if (canonical === 'gravity') return INSPECTION_CATALOG['gravity:planet'];
    return INSPECTION_CATALOG['incline:block'];
  }

  if (domain === 'chemistry') {
    if (canonical === 'titration') return INSPECTION_CATALOG['titration:burette'];
    if (canonical === 'electrochemistry') return INSPECTION_CATALOG['electrochemistry:cell'];
    if (canonical === 'ideal-gas') return INSPECTION_CATALOG['ideal-gas:piston'];
    if (canonical === 'kinetics') return INSPECTION_CATALOG['kinetics:beaker'];
    if (canonical === 'spectrophotometry') return INSPECTION_CATALOG['spectrophotometry:cuvette'];
    return INSPECTION_CATALOG['calorimetry:vessel'];
  }

  if (domain === 'biology') {
    if (canonical === 'enzyme') return INSPECTION_CATALOG['enzyme:tube'];
    if (canonical === 'osmosis') return INSPECTION_CATALOG['osmosis:cell'];
    if (canonical === 'predator-prey') return INSPECTION_CATALOG['predator-prey:biome'];
    if (canonical === 'anatomy-heart') return INSPECTION_CATALOG['anatomy:heart'];
    if (canonical === 'anatomy-lungs') return INSPECTION_CATALOG['anatomy:lungs'];
    if (canonical === 'anatomy-neuron') return INSPECTION_CATALOG['anatomy:neuron'];
    return INSPECTION_CATALOG['photosynthesis:hydrilla'];
  }

  if (canonical === 'milky-way') return INSPECTION_CATALOG['milky-way:galaxy'];
  if (canonical === 'exoplanet') return INSPECTION_CATALOG['exoplanet:system'];
  if (canonical === 'wien') return INSPECTION_CATALOG['wien:star'];
  if (canonical === 'hubble') return INSPECTION_CATALOG['hubble:cosmos'];
  return INSPECTION_CATALOG['kepler:orbit'];
}
