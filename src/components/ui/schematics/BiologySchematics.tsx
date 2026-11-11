import React from 'react';
import { DomainSchematicProps } from './PhysicsSchematics';

export const BiologySchematics: React.FC<DomainSchematicProps> = ({
  keyText,
  accent,
}) => {
  // 1. Ingenhousz Photosynthesis (photosynthesis-ingenhousz)
  if (
    keyText.includes('photosynthesis') ||
    keyText.includes('ingenhousz') ||
    keyText.includes('fotosintesis')
  ) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Beaker & Inverted Funnel with Test Tube */}
        <path d="M 88 38 L 88 92 Q 88 96 92 96 L 168 96 Q 172 96 172 92 L 172 38" strokeOpacity="0.75" />
        {/* Inverted glass funnel + collection tube */}
        <path d="M 102 92 L 122 58 L 122 20 Q 122 14 130 14 Q 138 14 138 20 L 138 58 L 158 92" />
        {/* Hydrilla aquatic plant sprigs */}
        <path d="M 130 92 L 130 68 M 130 82 L 120 75 M 130 76 L 140 70" strokeWidth="1.8" />
        {/* Rising O2 Bubbles */}
        <g className="transition-transform duration-500 group-hover:-translate-y-1.5">
          <circle cx="130" cy="52" r="2.2" fill="#38bdf8" stroke="none" />
          <circle cx="128" cy="39" r="2.8" fill="#38bdf8" stroke="none" />
          <circle cx="132" cy="27" r="3.2" fill="#38bdf8" stroke="none" />
        </g>
        {/* Incoming Light Rays (hv) */}
        <line x1="46" y1="26" x2="78" y2="48" stroke="#f59e0b" />
        <path d="M 72 48 L 78 48 L 76 42" stroke="#f59e0b" />
        <line x1="46" y1="44" x2="78" y2="66" stroke="#f59e0b" />
        <path d="M 72 66 L 78 66 L 76 60" stroke="#f59e0b" />
        <text x="180" y="34" fill="#38bdf8" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          O₂ ↑
        </text>
      </g>
    );
  }

  // 2. Michaelis-Menten Enzyme Kinetics (enzyme-catalase)
  if (keyText.includes('enzyme') || keyText.includes('enzim') || keyText.includes('katalase')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="44" y1="18" x2="44" y2="90" strokeOpacity="0.5" />
        <line x1="44" y1="90" x2="238" y2="90" strokeOpacity="0.5" />
        {/* Vmax asymptote */}
        <line x1="44" y1="24" x2="234" y2="24" strokeDasharray="4 3" strokeOpacity="0.55" />
        {/* ½ Vmax & Km dashed guides */}
        <line x1="44" y1="57" x2="96" y2="57" strokeDasharray="2 2" stroke="#f59e0b" strokeOpacity="0.8" />
        <line x1="96" y1="57" x2="96" y2="90" strokeDasharray="2 2" stroke="#f59e0b" strokeOpacity="0.8" />
        {/* Hyperbolic saturation curve */}
        <path
          d="M 44 90 Q 68 32 232 27"
          className="transition-all duration-500 group-hover:stroke-emerald-400"
        />
        <circle cx="96" cy="57" r="3.5" fill="#f59e0b" stroke="#f59e0b" />
        <text x="195" y="20" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Vₘₐₓ
        </text>
        <text x="90" y="101" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Kₘ
        </text>
      </g>
    );
  }

  // 3. Lotka-Volterra Predator-Prey Dynamics (predator-prey-dynamics)
  if (keyText.includes('predator') || keyText.includes('lotka') || keyText.includes('populasi')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="38" y1="88" x2="242" y2="88" strokeOpacity="0.45" />
        {/* Prey curve (emerald) */}
        <path
          d="M 42 72 Q 66 18, 90 54 T 138 54 T 186 54 T 234 54"
          className="transition-transform duration-500 group-hover:translate-x-1"
        />
        {/* Predator curve (lagging phase, amber) */}
        <path
          d="M 42 82 Q 80 28, 106 60 T 154 60 T 202 60 T 238 66"
          stroke="#f59e0b"
          strokeDasharray="4 2"
          className="transition-transform duration-500 group-hover:translate-x-1"
        />
        <text x="58" y="24" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Mangsa (x)
        </text>
        <text x="132" y="28" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Predator (y)
        </text>
      </g>
    );
  }

  // 4. Kardiovaskular & Hemodinamika Jantung (anatomy-cardiovascular-heart)
  if (
    keyText.includes('cardiovascular') ||
    keyText.includes('heart') ||
    keyText.includes('jantung') ||
    keyText.includes('hemodinamika')
  ) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Stylized 4-Chamber Heart & Aortic Arch */}
        <path
          d="M 76 42 C 76 28, 56 26, 56 42 C 56 58, 76 74, 76 86 C 76 74, 96 58, 96 42 C 96 26, 76 28, 76 42 Z"
          fill="#ef4444"
          fillOpacity="0.18"
          stroke="#ef4444"
          strokeWidth="1.8"
        />
        {/* Interventricular & Atrioventricular Septum Cross */}
        <line x1="76" y1="38" x2="76" y2="82" stroke="#f87171" strokeOpacity="0.7" strokeDasharray="2 2" />
        <line x1="60" y1="52" x2="92" y2="52" stroke="#f87171" strokeOpacity="0.7" strokeDasharray="2 2" />
        {/* Aortic Arch & Superior Vena Cava */}
        <path d="M 76 34 C 76 18, 92 18, 94 30" stroke="#ef4444" strokeWidth="2.2" />
        <path d="M 66 32 L 66 18" stroke="#38bdf8" strokeWidth="2.2" />
        {/* Real-time P-Q-R-S-T ECG Waveform Trace */}
        <path
          d="M 114 62 L 130 62 Q 136 52 142 62 L 150 62 L 154 70 L 160 22 L 166 80 L 171 62 L 184 62 Q 194 46 204 62 L 236 62"
          stroke="#10b981"
          strokeWidth="1.8"
          className="transition-all duration-500 group-hover:stroke-rose-400"
        />
        <circle cx="160" cy="22" r="2.5" fill="#ef4444" stroke="none" />
        <text x="150" y="16" fill="#ef4444" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          QRS (CO)
        </text>
        <text x="182" y="88" fill={accent} fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          EKG P-Q-R-S-T
        </text>
      </g>
    );
  }

  // 5. Mekanika Respirasi & Spirometri Paru-Paru (anatomy-respiratory-lungs)
  if (
    keyText.includes('respiratory') ||
    keyText.includes('lungs') ||
    keyText.includes('paru') ||
    keyText.includes('spirometri')
  ) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Trachea & Primary Bronchi Bifurcation */}
        <line x1="78" y1="16" x2="78" y2="42" stroke="#38bdf8" strokeWidth="2.5" />
        <path d="M 78 42 L 62 56 M 78 42 L 94 56" stroke="#38bdf8" strokeWidth="2" />
        {/* Bronchioles */}
        <path d="M 62 56 L 54 66 M 62 56 L 66 68 M 94 56 L 88 68 M 94 56 L 102 66" stroke="#38bdf8" strokeOpacity="0.8" />
        {/* Right & Left Lung Lobes */}
        <path
          d="M 72 34 C 52 34, 44 58, 46 78 C 48 86, 68 84, 72 76 Z"
          fill="#38bdf8"
          fillOpacity="0.16"
          stroke="#38bdf8"
        />
        <path
          d="M 84 34 C 104 34, 112 58, 110 78 C 108 86, 88 84, 84 76 Z"
          fill="#38bdf8"
          fillOpacity="0.16"
          stroke="#38bdf8"
        />
        {/* Diaphragm Dome */}
        <path d="M 42 88 Q 78 74 114 88" stroke="#f59e0b" strokeWidth="2" />
        {/* Spirometry Tidal Volume & Hill SpO2 Curve */}
        <path
          d="M 132 64 Q 144 38, 156 64 T 180 64 Q 194 18, 208 64 T 236 64"
          stroke={accent}
          strokeWidth="1.8"
        />
        <text x="136" y="26" fill="#38bdf8" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          TV &amp; SpO₂ (%)
        </text>
      </g>
    );
  }

  // 6. Neurofisiologi & Potensial Aksi Neuron (anatomy-neural-synapse)
  if (
    keyText.includes('neural') ||
    keyText.includes('synapse') ||
    keyText.includes('neuron') ||
    keyText.includes('saraf')
  ) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Multipolar Soma & Dendrites */}
        <circle cx="56" cy="54" r="11" fill="#a855f7" fillOpacity="0.22" stroke="#a855f7" strokeWidth="1.8" />
        <circle cx="56" cy="54" r="3.5" fill="#e879f9" stroke="none" />
        <path d="M 46 46 L 34 36 M 44 54 L 30 54 M 46 62 L 34 72 M 56 42 L 52 28 M 56 66 L 52 80" stroke="#a855f7" />
        {/* Long Axon & Myelin Sheath Segments with Nodes of Ranvier */}
        <line x1="67" y1="54" x2="148" y2="54" stroke="#38bdf8" strokeWidth="1.8" />
        {[74, 98, 122].map((mx) => (
          <rect
            key={mx}
            x={mx}
            y="48"
            width="16"
            height="12"
            rx="4"
            fill="#f59e0b"
            fillOpacity="0.28"
            stroke="#f59e0b"
          />
        ))}
        {/* Synaptic Boutons */}
        <path d="M 148 54 L 160 44 M 148 54 L 160 64" stroke="#38bdf8" />
        <circle cx="162" cy="43" r="3" fill="#38bdf8" />
        <circle cx="162" cy="65" r="3" fill="#38bdf8" />
        {/* Action Potential Spike Graph (+40 mV peak, -55 mV threshold) */}
        <line x1="176" y1="70" x2="244" y2="70" stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity="0.6" />
        <path
          d="M 178 76 L 192 76 Q 198 70 202 22 L 212 86 Q 220 76 240 76"
          stroke="#22d3ee"
          strokeWidth="1.8"
        />
        <text x="184" y="20" fill="#22d3ee" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          +40 mV
        </text>
      </g>
    );
  }

  // 7. Cell Osmosis & Plasmolysis Membrane (osmosis-plasmolysis)
  return (
    <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Semipermeable phospholipid bilayer */}
      {[58, 82, 106, 130, 154, 178, 202].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="40" r="5" fill={accent} fillOpacity="0.2" />
          <line x1={cx - 2} y1="45" x2={cx - 2} y2="54" strokeOpacity="0.7" />
          <line x1={cx + 2} y1="45" x2={cx + 2} y2="54" strokeOpacity="0.7" />
          <circle cx={cx} cy="68" r="5" fill={accent} fillOpacity="0.2" />
          <line x1={cx - 2} y1="63" x2={cx - 2} y2="54" strokeOpacity="0.7" />
          <line x1={cx + 2} y1="63" x2={cx + 2} y2="54" strokeOpacity="0.7" />
        </g>
      ))}
      {/* Aquaporin channel & osmotic water flux arrow */}
      <path
        d="M 142 18 L 142 88"
        stroke="#38bdf8"
        strokeWidth="2"
        className="transition-transform duration-500 group-hover:translate-y-1"
      />
      <path d="M 137 82 L 142 88 L 147 82" stroke="#38bdf8" strokeWidth="2" />
      <text x="152" y="26" fill="#38bdf8" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
        H₂O (Ψw)
      </text>
    </g>
  );
};
