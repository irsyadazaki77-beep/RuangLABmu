import React, { useState } from 'react';
import {
  PackageCheck,
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
    if (mNorm.includes('redox') || mNorm.includes('electro')) {
      return {
        title: 'Sel Volta Alami dari Jeruk Nipis, Koin Tembaga & Paku Seng',
        icon: <FlaskConical className="w-5 h-5 text-amber-500" />,
        toolsNeeded: [
          '3–4 buah jeruk nipis / belimbing wuluh segar',
          'Koin tembaga (atau potongan kabel tembaga) sebagai katoda (+)',
          'Paku besi galvanis berlapis seng (Zn) sebagai anoda (−)',
          'Kabel penjepit buaya sederhana dan 1 buah lampu LED tegangan rendah (1,8 V)',
        ],
        steps: [
          'Tekan perlahan jeruk nipis di atas meja agar sari asam sitrat di dalamnya mudah menghantarkan ion.',
          'Tancapkan satu paku seng dan satu koin tembaga berjarak ~2 cm pada setiap jeruk tanpa saling bersentuhan.',
          'Hubungkan 3–4 jeruk secara seri (tembaga jeruk 1 ke paku seng jeruk 2, dst.) agar tegangan total mencapai > 2,2 V.',
          'Sambungkan ujung rangkaian ke kaki LED (+ ke tembaga, − ke seng) dan amati nyala redup LED!',
        ],
        scientificPrinciple:
          'Asam sitrat berperan sebagai elektrolit; seng teroksidasi melepaskan elektron (Zn → Zn²⁺ + 2e⁻) yang mengalir menuju elektroda tembaga menghasilkan gaya gerak listrik (GGL) sel.',
        localCultureNote:
          'Kearifan Tradisional: Pemanfaatan jeruk nipis dan belimbing wuluh kaya asam organik juga digunakan masyarakat nusantara untuk membersihkan karat dan kerak oksida logam pada keris maupun perkakas kuningan.',
      };
    }
    if (mNorm.includes('calorim') || mNorm.includes('gas') || mNorm.includes('kinetic')) {
      return {
        title: 'Reaksi Endotermik & Tekanan Gas CO₂ dari Soda Kue + Cuka',
        icon: <FlaskConical className="w-5 h-5 text-amber-500" />,
        toolsNeeded: [
          '1 botol plastik bening bekas air mineral',
          '2 sendok teh soda kue (NaHCO₃) dan 50 mL cuka dapur (CH₃COOH)',
          '1 buah balon karet dan corong kertas sederhana',
          'Air dingin vs air hangat (opsional untuk membandingkan laju reaksi)',
        ],
        steps: [
          'Tuangkan 50 mL cuka ke dalam botol plastik, lalu pegang dinding botol untuk merasakan suhu awalnya.',
          'Masukkan soda kue ke dalam balon menggunakan corong kertas, lalu pasang mulut balon erat pada bibir botol.',
          'Angkat balon agar soda kue jatuh ke dalam cuka: amati balon mengembang cepat terisi gas CO₂!',
          'Raba kembali dinding bawah botol: terasa dingin karena reaksi NaHCO₃ + CH₃COOH menyerap kalor (endotermik).',
        ],
        scientificPrinciple:
          'Reaksi asam-bikarbonat menyerap kalor lingkungan (ΔH > 0, endotermik) dan melepaskan gas CO₂ yang meningkatkan jumlah mol gas n sehingga tekanan P dan volume balon V membesar sesuai PV = nRT.',
        localCultureNote:
          'Kearifan Tradisional: Prinsip pelepasan gas CO₂ dari ragi dan pengembang alami telah lama dimanfaatkan dalam pembuatan kue apem, bika ambon, dan roti kukus tradisional nusantara.',
      };
    }
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
        'Kunyit mengandung senyawa kurkumin yang bertindak sebagai indikator pH alami: berwarna kuning pada suasana asam (pH < 7) dan beralih ke merah kecokelatan pada suasana basa (pH > 8,5).',
      localCultureNote:
        'Kearifan Tradisional: Nenek moyang kita telah lama memanfaatkan kunyit dan kapur sirih dalam tradisi menyirih dan pewarnaan kain batik alami tanpa memerlukan zat kimia sintetis impor.',
    };
  }

  if (dNorm.includes('fisika') || dNorm.includes('phys')) {
    if (mNorm.includes('optic') || mNorm.includes('photoelectric')) {
      return {
        title: 'Kisi Difraksi Spektrum Pelangi dari Keping CD Bekas & Senter HP',
        icon: <Scale className="w-5 h-5 text-sky-500" />,
        toolsNeeded: [
          '1 keping CD atau DVD bekas (memiliki alur mikro ~1,6 μm sebagai kisi difraksi)',
          'Senter HP atau cahaya matahari yang masuk melalui celah kardus sempit',
          'Kertas karton putih sebagai layar pengamatan',
          'Ruangan yang agak redup agar pita spektrum terlihat tajam',
        ],
        steps: [
          'Arahkan berkas cahaya senter HP dengan sudut miring (~45°) ke permukaan mengilap keping CD.',
          'Tangkap cahaya pantulan pada kertas karton putih di dekatnya dan amati terurainya cahaya putih menjadi pita warna merah hingga ungu.',
          'Ubah sudut datang cahaya dan perhatikan pergeseran posisi pita terang orde ke-1 dan ke-2.',
          'Bandingkan pita merah (λ lebih panjang, sudut belok lebih besar) dengan pita biru-ungu (λ lebih pendek).',
        ],
        scientificPrinciple:
          'Alur data mikroskopis pada keping CD bekerja sebagai kisi difraksi berjarak d ≈ 1,6 μm yang menguraikan panjang gelombang cahaya sesuai persamaan interferensi d · sin θ = m · λ.',
        localCultureNote:
          'Kearifan Tradisional: Fenomena pelangi dan kilau warna-warni struktur mikro juga tampak pada bulu burung cenderawasih serta cangkang kerang mutiara di perairan timur Indonesia.',
      };
    }
    if (mNorm.includes('wheatstone') || mNorm.includes('ohm')) {
      return {
        title: 'Uji Hambatan & Konduktivitas Bahan dengan Baterai AA dan LED',
        icon: <Scale className="w-5 h-5 text-sky-500" />,
        toolsNeeded: [
          '2 buah baterai AA (total 3 V) dan 1 buah lampu LED + resistor 100 Ω',
          'Kabel tembaga kecil atau potongan foil aluminium sebagai penghantar',
          'Bahan uji: isi pensil grafit 2B, sendok logam, karet penghapus, dan air garam',
        ],
        steps: [
          'Rangkai baterai, resistor pengaman, dan LED secara seri dengan dua ujung kabel uji terbuka.',
          'Sentuhkan kedua ujung kabel ke sendok logam: LED menyala terang karena hambatan logam sangat kecil.',
          'Goreskan garis tebal dengan pensil grafit 2B di kertas (panjang 2 cm lalu 8 cm) dan sentuhkan ujung kabel: amati nyala LED makin redup saat jalur grafit makin panjang!',
          'Uji pada karet penghapus (isolator): arus terhenti karena hambatan sangat besar.',
        ],
        scientificPrinciple:
          'Sesuai Hukum Ohm (I = V / R) dan rumus resistansi kawat (R = ρ · L / A), semakin panjang lintasan konduktor grafit, semakin besar hambatannya sehingga arus I yang mengalir ke LED mengecil.',
        localCultureNote:
          'Kearifan Tradisional: Pemahaman bahan penghantar dan isolator alami sangat penting dalam keselamatan instalasi listrik rumah tangga pedesaan serta perlindungan sambaran petir.',
      };
    }
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
          'Gaya pendorong benda di bidang miring tanpa gesekan sebanding dengan komponen gravitasi sejajar bidang (Wₓ = m · g · sin θ).',
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
    if (mNorm.includes('photosynthesis')) {
      return {
        title: 'Uji Gelembung Oksigen Fotosintesis dengan Daun Segar & Gelas Air',
        icon: <Leaf className="w-5 h-5 text-emerald-500" />,
        toolsNeeded: [
          '2 gelas kaca bening berisi air bersih (1 gelas ditambah sejumput soda kue sebagai sumber CO₂)',
          '2 helai daun segar yang baru dipetik (daun bayam, melati, atau tanaman air akuarium)',
          'Cahaya matahari pagi langsung dan tempat teduh sebagai pembanding',
        ],
        steps: [
          'Rendam masing-masing daun segar di dalam gelas air hingga tercelup penuh (tindih sedikit dengan kerikil bersih).',
          'Letakkan gelas pertama di bawah sinar matahari langsung dan gelas kedua di ruangan teduh selama 20–30 menit.',
          'Amati permukaan daun: gelembung-gelembung halus gas oksigen (O₂) jauh lebih banyak muncul pada gelas di bawah sinar matahari!',
          'Tambahkan sejumput soda kue ke air dan amati pertambahan laju gelembung karena suplai CO₂ meningkat.',
        ],
        scientificPrinciple:
          'Energi cahaya matahari memicu fotolisis air di kloroplas daun menghasilkan gas O₂ terlarut yang berkumpul menjadi gelembung di permukaan stomata.',
        localCultureNote:
          'Kearifan Tradisional: Penanaman pohon rindang di pekarangan rumah dan sistem subak/wanatani nusantara memanfaatkan fotosintesis untuk menyejukkan udara sekaligus menyuplai oksigen bersih.',
      };
    }
    if (mNorm.includes('lung') || mNorm.includes('respir')) {
      return {
        title: 'Model Mekanisme Paru-Paru & Diafragma dari Botol Plastik dan Balon',
        icon: <HeartPulse className="w-5 h-5 text-sky-500" />,
        toolsNeeded: [
          '1 botol plastik bening bekas ukuran 600 mL yang dipotong bagian bawahnya',
          '2 buah balon karet (1 balon kecil untuk paru-paru, 1 balon besar untuk diafragma)',
          '1 sedotan plastik, karet gelang, dan plastisin/lilin mainan penutup mulut botol',
        ],
        steps: [
          'Ikat balon kecil di ujung sedotan menggunakan karet gelang, lalu masukkan ke dalam botol dan rapatkan leher botol dengan plastisin.',
          'Potong leher balon besar lalu rentangkan menutup alas botol yang terbuka sebagai membran diafragma.',
          'Tarik membran balon bawah ke arah luar: amati balon paru-paru di dalam botol langsung mengembang (inspirasi)!',
          'Lepaskan atau dorong sedikit ke dalam: balon paru-paru mengempis (ekspirasi).',
        ],
        scientificPrinciple:
          'Menarik diafragma memperbesar volume rongga dada sehingga tekanan intrapleura turun di bawah tekanan atmosfer (Hukum Boyle, P₁V₁ = P₂V₂) dan udara mengalir masuk ke paru-paru.',
        localCultureNote:
          'Kearifan Tradisional: Teknik olah napas perut (diafragma) digunakan dalam pencak silat dan seni tarik suara tradisional nusantara untuk memaksimalkan kapasitas vital paru-paru.',
      };
    }
    if (mNorm.includes('heart') || mNorm.includes('cardio') || mNorm.includes('neural') || mNorm.includes('anatomi')) {
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
        'Air berpindah melintasi membran semipermeabel dari potensial air tinggi ke larutan garam hipertonik (osmosis). Sel tumbuhan di air garam kehilangan tekanan turgor sehingga mengalami plasmolisis.',
      localCultureNote:
        'Kearifan Tradisional: Prinsip penarikan air oleh garam ini merupakan fondasi pembuatan ikan asin dan asinan sayur tradisional nusantara agar tahan berbulan-bulan tanpa pembusukan bakteri.',
    };
  }

  return {
    title: 'Membaca Langit Malam 3T: Rasi Bintang Pari & Waluku (Orion)',
    icon: <Moon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />,
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
      'Warna bintang mencerminkan suhu permukaannya sesuai Hukum Pergeseran Wien (λ maks · T = 2,898 × 10⁻³ m·K). Bintang biru jauh lebih panas dibanding bintang merah.',
    localCultureNote:
      'Kearifan Tradisional Nusantara: Nelayan Bugis dan pelaut tradisional nusantara melayari samudera berpedoman pada Bintang Pari. Petani tradisional Jawa memanfaatkan terbitnya Rasi Waluku sebagai penanda musim dalam kalender musiman tradisional Pranata Mangsa.',
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
      className="rounded-2xl border border-emerald-500/35 bg-[var(--comfort-surface)] p-4 sm:p-5 shadow-xs transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            {wisdom.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
              <span className="font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                <Leaf className="w-3 h-3" aria-hidden="true" />
                Praktikum Alat Sekitar · 3T Ready
              </span>
              <span className="text-[var(--comfort-text-muted)] font-sans">
                · Tanpa Alat Lab Mahal
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold text-[var(--comfort-text)] leading-snug mt-0.5">
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
          className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] transition cursor-pointer shrink-0"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-3.5 border-t border-[var(--comfort-border)] space-y-3.5 text-xs">
          <div>
            <div className="font-bold text-[var(--comfort-text)] flex items-center gap-1.5 mb-1.5">
              <PackageCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Bahan &amp; Alat Mudah Ditemukan di Rumah:</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1 text-[var(--comfort-text-muted)] text-[11px]">
              {wisdom.toolsNeeded.map((tool, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{tool}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-1.5">
            <div className="font-bold text-[var(--comfort-text)] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Langkah Percobaan Mandiri:</span>
            </div>
            <ol className="space-y-1 pl-1 text-[11px] text-[var(--comfort-text-muted)]">
              {wisdom.steps.map((st, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {i + 1}.
                  </span>
                  <span>{st}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-[var(--comfort-text)] leading-relaxed">
              <strong className="text-sky-700 dark:text-sky-300 font-bold mb-0.5 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                Hubungan dengan Simulasi 3D:
              </strong>
              {wisdom.scientificPrinciple}
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[var(--comfort-text)] leading-relaxed">
              <strong className="text-amber-800 dark:text-amber-300 font-bold mb-0.5 flex items-center gap-1">
                <TreeDeciduous className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
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
