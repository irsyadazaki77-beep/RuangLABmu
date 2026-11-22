import {
  calculateCardiovascularHeart,
  calculateRespiratoryLungs,
  calculateNeuralSynapse,
} from '../../../utils/engines/biologyEngine';

export type AnatomyModuleId =
  | 'anatomy-cardiovascular-heart'
  | 'anatomy-respiratory-lungs'
  | 'anatomy-neural-synapse';

export type AnatomyMode = AnatomyModuleId;
export type AnatomyLayerMode = 'outer' | 'xray' | 'cross-section';

export interface AnatomyPinDef {
  id: string;
  num: number;
  name: string;
  mode: AnatomyModuleId;
  position: [number, number, number];
  cameraTarget: [number, number, number];
  cameraOffset: [number, number, number];
  subtitle: string;
  description: string;
  getLiveMetrics: (p: Record<string, number>) => { label: string; value: string }[];
}

export const evalHeart = (p: Record<string, number>, timeSec = 0.5) =>
  calculateCardiovascularHeart({
    heartRateBpm: p.heartRateBpm ?? 72,
    vesselRadiusRatio: p.vesselRadiusRatio ?? 1.0,
    bloodViscosity: p.bloodViscosity ?? 3.2,
    exerciseIntensity: p.exerciseIntensity ?? 15,
    timeSec,
  });

export const ANATOMY_PINS: AnatomyPinDef[] = [
  {
    id: 'pin-aorta',
    num: 1,
    name: 'Aorta (Lengkung Aorta)',
    mode: 'anatomy-cardiovascular-heart',
    position: [0.25, 1.55, 0.25],
    cameraTarget: [0.15, 1.25, 0.1],
    cameraOffset: [2.2, 1.8, 3.2],
    subtitle: 'Arteri Elastis Terbesar Tubuh',
    description:
      'Menerima darah kaya oksigen bertekanan tinggi dari Ventrikel Kiri saat sistol dan mendistribusikannya ke seluruh sirkulasi sistemik.',
    getLiveMetrics: (p) => {
      const m = evalHeart(p);
      return [
        { label: 'Tekanan Sistolik / Diastolik', value: `${m.systolicMmHg} / ${m.diastolicMmHg} mmHg` },
        { label: 'Mean Arterial Pressure (MAP)', value: `${m.meanArterialPressure} mmHg` },
        { label: 'Resistensi Vaskular (Poiseuille)', value: `${m.vascularResistance} PRU` },
      ];
    },
  },
  {
    id: 'pin-left-ventricle',
    num: 2,
    name: 'Ventrikel Kiri (Miokardium)',
    mode: 'anatomy-cardiovascular-heart',
    position: [0.68, -0.35, 0.72],
    cameraTarget: [0.4, -0.25, 0.3],
    cameraOffset: [2.4, 0.9, 3.1],
    subtitle: 'Bilik Pompa Utama Sistemik',
    description:
      'Memiliki dinding otot jantung (miokardium) paling tebal untuk memompa Stroke Volume melewati katup aorta melawan resistensi sistemik.',
    getLiveMetrics: (p) => {
      const m = evalHeart(p);
      return [
        { label: 'Stroke Volume (SV)', value: `${m.strokeVolumeMl} mL/detak` },
        { label: 'Curah Jantung (Cardiac Output)', value: `${m.cardiacOutputLMin} L/menit` },
        { label: 'Frekuensi Detak (HR)', value: `${Math.round(p.heartRateBpm ?? 72)} bpm` },
      ];
    },
  },
  {
    id: 'pin-right-atrium',
    num: 3,
    name: 'Atrium Kanan & Vena Cava',
    mode: 'anatomy-cardiovascular-heart',
    position: [-0.95, 0.55, 0.45],
    cameraTarget: [-0.55, 0.35, 0.2],
    cameraOffset: [-2.6, 1.3, 3.2],
    subtitle: 'Muara Aliran Balik Vena & Nodus SA',
    description:
      'Menerima darah deoksigenasi dari Vena Cava Superior/Inferior serta menjadi lokasi Nodus Sinoatrial (pacemaker alami pemicu gelombang P pada EKG).',
    getLiveMetrics: (p) => {
      const m = evalHeart(p, 0.16 * (60 / (p.heartRateBpm ?? 72)));
      return [
        { label: 'Potensial Pacemaker (EKG P-Wave)', value: `${m.ecgVoltageMv.toFixed(2)} mV` },
        { label: 'Viskositas Darah (η)', value: `${(p.bloodViscosity ?? 3.2).toFixed(1)} cP` },
        { label: 'Aliran Balik Vena', value: `${m.cardiacOutputLMin} L/menit` },
      ];
    },
  },
  {
    id: 'pin-alveolus',
    num: 4,
    name: 'Alveolus & Bronkiolus Respiratorius',
    mode: 'anatomy-respiratory-lungs',
    position: [1.15, 0.25, 0.65],
    cameraTarget: [0.4, 0.15, 0.1],
    cameraOffset: [2.2, 1.3, 3.8],
    subtitle: 'Unit Pertukaran Gas Kapiler-Alveolar',
    description:
      'Kantung udara mikroskopis tempat difusi O₂ menuju kapiler paru dan pelepasan CO₂ berdasarkan gradien tekanan parsial barometrik.',
    getLiveMetrics: (p) => {
      const m = calculateRespiratoryLungs({
        respirationRate: p.respirationRate ?? 15,
        diaphragmEffort: p.diaphragmEffort ?? 50,
        airwayResistance: p.airwayResistance ?? 1.0,
        altitudeMeters: p.altitudeMeters ?? 0,
        timeSec: 0.5,
      });
      return [
        { label: 'Tekanan O₂ Alveolus (PAO₂)', value: `${m.alveolarPo2MmHg} mmHg` },
        { label: 'Saturasi Oksihemoglobin (SpO₂)', value: `${m.spo2Percent}%` },
        { label: 'Ventilasi Menit (VE)', value: `${m.minuteVentilationLMin} L/menit` },
      ];
    },
  },
  {
    id: 'pin-ranvier',
    num: 5,
    name: 'Nodus Ranvier & Selubung Mielin',
    mode: 'anatomy-neural-synapse',
    position: [0.35, 0.32, 0.35],
    cameraTarget: [0.2, 0.0, 0.0],
    cameraOffset: [1.6, 1.4, 3.6],
    subtitle: 'Celah Kanal Ion Na⁺/K⁺ Berpintu Tegangan',
    description:
      'Celah mikro di antara segmen selubung mielin tempat terkonsentrasinya kanal Na⁺/K⁺ untuk melompatkan potensial aksi secara saltatorik.',
    getLiveMetrics: (p) => {
      const m = calculateNeuralSynapse({
        stimulusVoltageMv: p.stimulusVoltageMv ?? -35,
        myelinThickness: p.myelinThickness ?? 75,
        extracellularNaMm: p.extracellularNaMm ?? 145,
        extracellularKMm: p.extracellularKMm ?? 4.5,
        timeSec: 0.22,
      });
      return [
        { label: 'Hukum All-or-None', value: m.actionPotentialTriggered ? 'TERPICU (Depolarisasi)' : 'SUB-THRESHOLD' },
        { label: 'Kecepatan Konduksi Saltatorik', value: `${m.conductionVelocityMs} m/s` },
        { label: 'Potensial Nernst (ENa / EK)', value: `${m.nernstNaMv} / ${m.nernstKMv} mV` },
      ];
    },
  },
];
