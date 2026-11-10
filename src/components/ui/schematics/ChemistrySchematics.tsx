import React from 'react';
import { DomainSchematicProps } from './PhysicsSchematics';

export const ChemistrySchematics: React.FC<DomainSchematicProps> = ({
  keyText,
  accent,
}) => {
  // 1. Calorimetry & Neutralization Enthalpy (thermo-calorimetry)
  if (keyText.includes('calorimetry') || keyText.includes('kalorimetri')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Insulated Double-Wall Calorimeter Vessel */}
        <rect x="74" y="34" width="76" height="60" rx="5" strokeOpacity="0.85" />
        <rect x="82" y="40" width="60" height="48" rx="3" fill={accent} fillOpacity="0.14" strokeDasharray="3 2" />
        {/* Lid */}
        <line x1="68" y1="34" x2="156" y2="34" strokeWidth="2.2" />
        {/* Immersion Thermometer */}
        <line x1="104" y1="12" x2="104" y2="74" stroke="#f43f5e" strokeWidth="2" />
        <circle cx="104" cy="76" r="4" fill="#f43f5e" stroke="#f43f5e" />
        {/* Stirrer rod */}
        <path d="M 124 14 L 124 76 L 132 76" strokeOpacity="0.8" />
        {/* ΔT Rising Curve on right */}
        <path
          d="M 172 82 L 188 82 Q 198 32 236 32"
          stroke="#f59e0b"
          className="transition-transform duration-500 group-hover:-translate-y-0.5"
        />
        <text x="186" y="26" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          q = m·c·ΔT
        </text>
      </g>
    );
  }

  // 2. Voltaic / Galvanic Cell & Nernst (redox-electrochemistry)
  if (keyText.includes('redox') || keyText.includes('elektro') || keyText.includes('volta')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Left Beaker (Anode Zn) */}
        <path d="M 56 38 L 56 90 Q 56 94 60 94 L 106 94 Q 110 94 110 90 L 110 38" />
        <line x1="56" y1="58" x2="110" y2="58" strokeOpacity="0.45" />
        <rect x="68" y="28" width="10" height="52" rx="1.5" fill={accent} fillOpacity="0.22" />
        {/* Right Beaker (Cathode Cu) */}
        <path d="M 166 38 L 166 90 Q 166 94 170 94 L 216 94 Q 220 94 220 90 L 220 38" />
        <line x1="166" y1="58" x2="220" y2="58" strokeOpacity="0.45" />
        <rect x="198" y="28" width="10" height="52" rx="1.5" fill="#f59e0b" fillOpacity="0.22" stroke="#f59e0b" />
        {/* U-shaped Salt Bridge */}
        <path d="M 96 68 L 96 42 Q 96 34 104 34 L 172 34 Q 180 34 180 42 L 180 68" strokeOpacity="0.8" />
        {/* External wire & Voltmeter */}
        <path d="M 73 28 L 73 16 L 126 16" />
        <path d="M 150 16 L 203 16 L 203 28" />
        <circle cx="138" cy="16" r="10" fill={accent} fillOpacity="0.15" />
        <text x="134" y="19" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          V
        </text>
      </g>
    );
  }

  // 3. Ideal Gas Law & Isothermal Piston Compression (ideal-gas-boyle)
  if (keyText.includes('gas') || keyText.includes('boyle')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Gas Cylinder */}
        <path d="M 64 20 L 64 92 L 128 92 L 128 20" />
        {/* Movable Piston Plunger */}
        <g className="transition-transform duration-500 group-hover:translate-y-1.5">
          <rect x="66" y="42" width="60" height="8" fill={accent} fillOpacity="0.3" />
          <line x1="96" y1="14" x2="96" y2="42" strokeWidth="2.2" />
          <line x1="82" y1="14" x2="110" y2="14" strokeWidth="2.2" />
        </g>
        {/* Kinetic gas particles inside chamber */}
        {[
          [78, 62],
          [108, 66],
          [88, 78],
          [114, 82],
          [96, 58],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2.5" fill="#f59e0b" stroke="none" />
        ))}
        {/* P-V Isotherm Hyperbola on right */}
        <line x1="158" y1="22" x2="158" y2="90" strokeOpacity="0.5" />
        <line x1="158" y1="90" x2="240" y2="90" strokeOpacity="0.5" />
        <path d="M 166 28 Q 174 80 234 84" stroke="#f59e0b" />
        <text x="184" y="48" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          P·V = nRT
        </text>
      </g>
    );
  }

  // 4. Reaction Kinetics & Arrhenius Activation Barrier (reaction-kinetics-arrhenius)
  if (keyText.includes('kinetics') || keyText.includes('arrhenius') || keyText.includes('laju')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="42" y1="16" x2="42" y2="92" strokeOpacity="0.5" />
        <line x1="42" y1="92" x2="242" y2="92" strokeOpacity="0.5" />
        {/* Uncatalyzed pathway */}
        <path d="M 48 64 L 82 64 C 108 64, 118 18, 138 18 C 158 18, 168 80, 196 80 L 234 80" />
        {/* Catalyzed lower Ea pathway */}
        <path
          d="M 82 64 C 108 64, 118 38, 138 38 C 158 38, 168 80, 196 80"
          stroke="#f59e0b"
          strokeDasharray="4 3"
          className="transition-transform duration-500 group-hover:translate-y-0.5"
        />
        <line x1="138" y1="18" x2="138" y2="64" strokeDasharray="2 2" strokeOpacity="0.6" />
        <text x="144" y="34" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Eₐ
        </text>
        <text x="202" y="73" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          ΔH
        </text>
      </g>
    );
  }

  // 5. UV-Vis Spectrophotometry & Lambert-Beer Law (spectrophotometry-beer)
  if (keyText.includes('spectrophotometry') || keyText.includes('beer') || keyText.includes('spektro')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Incident Light Beam I0 */}
        <line x1="38" y1="54" x2="108" y2="54" stroke="#f59e0b" strokeWidth="2.5" />
        <path d="M 102 50 L 108 54 L 102 58" stroke="#f59e0b" strokeWidth="2" />
        <text x="58" y="45" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          I₀
        </text>
        {/* Quartz Cuvette (pathlength b) */}
        <rect
          x="112"
          y="24"
          width="44"
          height="62"
          rx="3"
          fill={accent}
          fillOpacity="0.24"
        />
        <text x="128" y="98" fill={accent} fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          b (cm)
        </text>
        {/* Attenuated Transmitted Beam I */}
        <line x1="156" y1="54" x2="214" y2="54" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 2" />
        <path d="M 209 51 L 214 54 L 209 57" stroke="#f59e0b" />
        <text x="180" y="45" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          I
        </text>
        {/* Photodiode Detector */}
        <rect x="218" y="38" width="16" height="32" rx="3" fill={accent} fillOpacity="0.18" />
      </g>
    );
  }

  // 6. Acid-Base Titration & Sigmoidal pH Curve (acid-base-titration)
  return (
    <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Burette tip */}
      <path d="M 76 12 L 76 42 L 80 48 L 80 54 L 84 54 L 84 48 L 88 42 L 88 12" />
      <line x1="72" y1="45" x2="92" y2="45" stroke="#f59e0b" />
      {/* Falling titrant droplet */}
      <circle
        cx="82"
        cy="63"
        r="2.5"
        fill={accent}
        className="transition-transform duration-500 group-hover:translate-y-2"
      />
      {/* Erlenmeyer flask */}
      <path d="M 75 68 L 75 74 L 60 94 L 104 94 L 89 74 L 89 68" />
      <path d="M 65 87 Q 82 84 99 87 L 103 93 L 61 93 Z" fill={accent} fillOpacity="0.2" stroke="none" />
      {/* Sigmoidal pH titration curve on right */}
      <path
        d="M 134 86 C 164 85, 174 82, 180 54 C 186 26, 196 22, 232 20"
        className="transition-all duration-500 group-hover:stroke-teal-400"
      />
      <circle cx="180" cy="54" r="3.5" fill="#f59e0b" stroke="#f59e0b" />
      <text x="188" y="57" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
        pH 7.0
      </text>
    </g>
  );
};
