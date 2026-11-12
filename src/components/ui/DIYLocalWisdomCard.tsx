import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Compass,
  Lightbulb,
  CheckCircle2,
  TreeDeciduous,
  Leaf,
  FlaskConical,
  Scale,
  Moon,
  HeartPulse,
} from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

export interface DIYLocalWisdomCardProps {
  domain: string;
  moduleId?: string;
  defaultExpanded?: boolean;
}

interface DIYExperimentDetail {
  title: string;
  toolsNeeded: string[];
  steps: string[];
  scientificPrinciple: string;
  localCultureNote: string;
  icon: React.ReactNode;
}

export function getLocalWisdomForDomain(domain: string, moduleId = ''): DIYExperimentDetail {
  const dNorm = (domain || '').toLowerCase();
  const mNorm = (moduleId || '').toLowerCase();

  if (dNorm.includes('kimia') || dNorm.includes('chem')) {
    return {
      title: 'Indikator Asam-Basa Alami dari Kunyit & Bunga Sepatu',
      icon: <FlaskConical className="w-5 h-5 text-amber-500" />,
      toolsNeeded: [
        '1 ruas kunyit segar (diparut / diulek halus) atau 2 kuntum kelopak bunga sepatu merah',
        'Air perasan jeruk nipis / cuka makan dapur (perwakilan Asam)',
        'Air sabun mandi / air deterjen / kapur sirih (perwakilan Basa)',
        '3 buah gelas kaca bening / cangkir plastik bekas',
        'Sendok teh untuk mengaduk',
      ],
      steps: [
        'Larutkan parutan kunyit dengan sedikit air bersih, lalu saring cairannya (warna awal: kuning keemasan cerah).',
        'Tuangkan cairan kunyit secukupnya ke gelas 1 (berisi air jeruk/cuka) dan gelas 2 (berisi air deterjen/sabun).',
        'Amati seketika: larutan asam mempertahankan warna kuning cerah, sedangkan larutan basa mengubah kunyit menjadi merah kecokelatan / jingga tua pekat!',
        'Bila kedua gelas dicampurkan perlahan (reaksi netralisasi), amati perubahan warnanya kembali menuju kuning jingga.',
      ],
      scientificPrinciple:
        'Kunyit mengandung senyawa kurkumin yang bertindak sebagai indikator pH alami: berwarna kuning pada suasana asam (pH < 7) dan beralih ke merah kecokelatan pada suasana basa (pH > 8.5).',
      localCultureNote:
        'Kearifan Tradisional: Nenek moyang kita telah lama memanfaatkan kunyit dan kapur sirih dalam tradisi menyirih dan pewarnaan kain batik alami tanpa memerlukan zat kimia sintetis impor.',
    };
  }

  if (dNorm.includes('fisika') || dNorm.includes('phys')) {
    if (mNorm.includes('incline') || mNorm.includes('newton')) {
      return {
        title: 'Bidang Miring DIY dengan Papan Kayu & Baterai Bekas',
        icon: <Scale className="w-5 h-5 text-sky-500" />,
        toolsNeeded: [
          'Papan kayu triplek / buku tulis tebal bersampul licin',
          'Tumpukan 2–5 buah buku untuk mengatur ketinggian sudut bidang miring',
          'Benda gelinding: silinder baterai bekas, kelereng, atau botol kaca kecil',
          'Stopwatch di HP (atau hitungan detik ritmis 1-2-3)',
          'Penggaris 30 cm untuk mengukur panjang lintasan',
        ],
        steps: [
          'Sangga satu ujung papan kayu dengan 2 tumpukan buku, lalu ukur ketinggian ujungnya.',
          'Lepaskan silinder baterai dari puncak bidang tanpa didorong, catat waktu sampai menyentuh lantai.',
          'Tambahkan tumpukan buku agar sudut kemiringan semakin curam, lalu ulangi pengukuran waktu.',
          'Bandingkan waktu tempuh: sudut yang lebih curam menghasilkan percepatan (g · sin θ) yang lebih besar!',
        ],
        scientificPrinciple:
          'Gaya pendorong benda di bidang miring tanpa gesekan sebanding dengan komponen gravitasi sejajar bidang (W_x = m · g · sin θ).',
        localCultureNote:
          'Kearifan Tradisional: Prinsip bidang miring telah digunakan masyarakat pedesaan nusantara untuk menaikkan gelondongan kayu atau hasil panen gabah ke atas bak truk pengangkut.',
      };
    }
    return {
      title: 'Bandul Sederhana Harmonis dari Kerikil & Tali Rafia',
      icon: <Scale className="w-5 h-5 text-sky-500" />,
      toolsNeeded: [
        'Sebuah kerikil sungai / mur baut besi berukuran sedang',
        'Tali rafia tipis atau benang jahit (panjang 1 meter)',
        'Gantungan di kusen pintu, dahan pohon pekarangan, atau paku dinding',
        'Stopwatch di ponsel',
      ],
      steps: [
        'Ikat kerikil erat pada ujung tali dengan panjang tali terukur 80 cm.',
        'Gantungkan ujung atas tali pada paku atau kusen pintu rumah.',
        'Tarik kerikil sedikit menyimpang (sekitar 10 derajat, jangan terlalu lebar), lalu lepaskan.',
        'Hitung waktu yang dibutuhkan untuk 10 kali ayunan bolak-balik lengkap, lalu bagi dengan 10 untuk memperoleh Periode (T).',
        'Potong panjang tali menjadi separuhnya (40 cm) dan ulangi. Amati bahwa tali lebih pendek berayun lebih cepat!',
      ],
      scientificPrinciple:
        'Periode bandul hanya ditentukan oleh panjang tali (L) dan percepatan gravitasi bumi (g), sesuai rumus T = 2π√(L/g). Massa kerikil tidak memengaruhi waktu ayun.',
      localCultureNote:
        'Kearifan Tradisional: Konsep ayunan pendulum ini sama persis dengan ritme ayunan anak-anak dari sarung atau pelepah kelapa di pedesaan nusantara.',
    };
  }

  if (dNorm.includes('biologi') || dNorm.includes('bio')) {
    if (mNorm.includes('heart') || mNorm.includes('cardio') || mNorm.includes('anatomi')) {
      return {
        title: 'Pemeriksaan Denyut Nadi Radial Mandiri Saat Istirahat vs Olahraga',
        icon: <HeartPulse className="w-5 h-5 text-rose-500" />,
        toolsNeeded: [
          'Jari telunjuk dan jari tengah tangan sendiri',
          'Stopwatch ponsel atau jam dinding berjarum detik',
          'Buku catatan kecil',
        ],
        steps: [
          'Duduk rileks selama 3 menit. Letakkan dua jari di pergelangan tangan bagian dalam sejajar jempol (arteri radialis).',
          'Rasakan denyutan teratur pembuluh darah. Hitung jumlah denyut selama 60 detik penuh (kondisi istirahat).',
          'Lakukan lompat bintang (jumping jacks) atau lari di tempat santai selama 1 menit.',
          'Hitung kembali denyut nadi seketika setelah bergerak aktif. Catat lonjakan frekuensi denyut nadi Anda!',
        ],
        scientificPrinciple:
          'Aktivitas fisik meningkatkan kebutuhan oksigen di otot. Sistem saraf simpatik memicu nodus SA jantung berdenyut lebih cepat untuk menaikkan Curah Jantung (Cardiac Output = Heart Rate × Stroke Volume).',
        localCultureNote:
          'Kearifan Tradisional: Tabib dan sesepuh nusantara sejak lama menggunakan teknik perabaan denyut nadi pergelangan tangan untuk mendeteksi kebugaran dan kondisi fisik seseorang.',
      };
    }
    return {
      title: 'Demonstrasi Osmosis Sel Tumbuhan dengan Potongan Kentang & Garam',
      icon: <Leaf className="w-5 h-5 text-emerald-500" />,
      toolsNeeded: [
        '1 buah kentang / mentimun / singkong segar dipotong stik berukuran sama (misal 4 cm × 1 cm)',
        'Garam dapur (2 sendok makan dilarutkan dalam 1 gelas air bersih untuk larutan hipertonik)',
        'Air sumur / air biasa tanpa garam untuk gelas kontrol',
        '2 buah gelas / mangkuk kecil',
      ],
      steps: [
        'Raba tekstur awal potongan kentang: padat, kaku, dan renyah bila sedikit ditekuk.',
        'Rendam potongan kentang A di gelas air garam pekat, dan potongan B di gelas air sumur biasa selama 30 menit.',
        'Angkat kedua potongan dan rasakan perbedaannya: potongan di air garam menjadi lembek, lentur, dan menyusut!',
        'Potongan di air biasa tetap keras dan segar karena air masuk ke dalam vakuola sel (turgid).',
      ],
      scientificPrinciple:
        'Air berpindah melintasi membran semipermeabel dari larutan berkonsentrasi air tinggi ke larutan garam berkonsentrasi air lebih rendah (osmosis). Sel di air garam mengalami plasmolisis/krenasi.',
      localCultureNote:
        'Kearifan Tradisional: Prinsip penarikan air oleh garam ini merupakan fondasi pembuatan ikan asin dan asinan sayur tradisional nusantara agar tahan berbulan-bulan tanpa pembusukan bakteri.',
    };
  }

  // Default Astronomi
  return {
    title: 'Membaca Langit Malam 3T: Rasi Bintang Pari & Waluku (Orion)',
    icon: <Moon className="w-5 h-5 text-indigo-400" />,
    toolsNeeded: [
      'Langit malam cerah di luar rumah (daerah 3T sangat beruntung karena minim polusi cahaya)',
      'Mata telanjang yang telah beradaptasi dengan kegelapan selama 10 menit',
      'Peta bintang sederhana atau arahan arah mata angin',
    ],
    steps: [
      'Menghadap ke arah Selatan: cari 4 bintang terang membentuk layang-layang/salib kecil di langit malam. Itulah Rasi Pari (Crux). Tarik garis lurus dari bintang atas ke bintang bawah, teruskan ke horizon: itulah arah Selatan sejati!',
      'Menghadap ke arah Timur / langit atas: cari 3 bintang terang berbaris rapi di tengah rasi Orion. Orang Jawa dan nusantara menyebutnya Rasi Waluku (Bajak Sawah).',
      'Perhatikan warna bintang terang di rasi Orion: Betelgeuse tampak kemerahan (bintang raksasa merah dingin ~3.500 K), sedangkan Rigel tampak putih kebiruan (bintang panas ~12.000 K).',
      'Catat bentuk fase bulan malam ini (sabit, separuh, atau purnama).',
    ],
    scientificPrinciple:
      'Warna bintang mencerminkan suhu permukaannya sesuai Hukum Pergeseran Wien (λ_max · T = 2.898 × 10⁻³ m·K). Bintang biru jauh lebih panas dibanding bintang merah.',
    localCultureNote:
      'Kearifan Tradisional Nusantara: Nelayan Bugis dan pelaut tradisional nusantara melayari samudera berpedoman pada Bintang Pari. Petani tradisional Jawa menjadikan terbitnya Rasi Waluku sebagai awal musim tanam padi (Pranata Mangsa Kasanga).',
  };
}

export const DIYLocalWisdomCard: React.FC<DIYLocalWisdomCardProps> = ({
  domain,
  moduleId = '',
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const wisdom = getLocalWisdomForDomain(domain, moduleId);

  return (
    <div
      data-testid="diy-local-wisdom-card"
      className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/70 via-stone-50/50 to-teal-50/40 dark:from-emerald-950/25 dark:via-slate-900/90 dark:to-teal-950/20 p-4 sm:p-5 shadow-xs transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            {wisdom.icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">
                🌿 Praktikum Alat Sekitar · 3T Ready
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Tanpa Alat Lab Mahal
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug mt-0.5">
              {wisdom.title}
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setIsExpanded(!isExpanded);
          }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Sembunyikan Panduan Alat Sekitar' : 'Tampilkan Panduan Alat Sekitar'}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-3.5 border-t border-emerald-500/20 space-y-3.5 text-xs">
          {/* Tools needed */}
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Bahan & Alat Mudah Ditemukan di Rumah:</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1 text-slate-600 dark:text-slate-300 text-[11px]">
              {wisdom.toolsNeeded.map((tool, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{tool}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Steps */}
          <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-emerald-500/20 space-y-1.5">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Langkah Percobaan Mandiri:</span>
            </div>
            <ol className="space-y-1 pl-1 text-[11px] text-slate-700 dark:text-slate-300">
              {wisdom.steps.map((st, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    {i + 1}.
                  </span>
                  <span>{st}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Scientific Principle & Local Culture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
            <div className="p-2.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-500/20 text-slate-700 dark:text-sky-200/90 leading-relaxed">
              <strong className="block text-sky-800 dark:text-sky-300 font-bold mb-0.5 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                Hubungan dengan Simulasi 3D:
              </strong>
              {wisdom.scientificPrinciple}
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-500/20 text-slate-700 dark:text-amber-200/90 leading-relaxed">
              <strong className="block text-amber-800 dark:text-amber-300 font-bold mb-0.5 flex items-center gap-1">
                <TreeDeciduous className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Kearifan Tradisional Lokal:
              </strong>
              {wisdom.localCultureNote}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
