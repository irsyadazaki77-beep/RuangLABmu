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

  // 4. Cell Osmosis & Plasmolysis Membrane (osmosis-plasmolysis)
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
