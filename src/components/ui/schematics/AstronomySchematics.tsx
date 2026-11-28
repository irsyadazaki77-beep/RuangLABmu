import React from 'react';
import { DomainSchematicProps } from './PhysicsSchematics';

export const AstronomySchematics: React.FC<DomainSchematicProps> = ({
  moduleId,
  keyText,
  accent,
}) => {
  // 1. Spectroscopic Binary Stars & Doppler Shift (doppler-redshift-binary) — check exact moduleId first before 'spektroskopi'/'bintang' substring fallbacks
  if (
    moduleId === 'doppler-redshift-binary' ||
    keyText.includes('biner') ||
    keyText.includes('binary') ||
    keyText.includes('doppler')
  ) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Binary Orbit around Barycenter (+) */}
        <ellipse cx="90" cy="54" rx="54" ry="24" strokeDasharray="3 2" strokeOpacity="0.6" />
        <line x1="85" y1="54" x2="95" y2="54" stroke="#f59e0b" />
        <line x1="90" y1="49" x2="90" y2="59" stroke="#f59e0b" />
        {/* Star 1 (blueshifted) & Star 2 (redshifted) */}
        <circle cx="52" cy="40" r="8" fill="#60a5fa" fillOpacity="0.3" stroke="#60a5fa" />
        <text x="46" y="43" fill="#60a5fa" fontSize="8" fontFamily="IBM Plex Mono, monospace" stroke="none">
          M₁
        </text>
        <circle cx="128" cy="68" r="6" fill="#f97316" fillOpacity="0.3" stroke="#f97316" />
        <text x="123" y="71" fill="#f97316" fontSize="8" fontFamily="IBM Plex Mono, monospace" stroke="none">
          M₂
        </text>
        {/* H-alpha Doppler Spectrum Bar */}
        <rect x="164" y="34" width="90" height="22" rx="3" fill="#0f172a" fillOpacity="0.5" stroke={accent} />
        <line x1="209" y1="34" x2="209" y2="56" stroke="#94a3b8" strokeDasharray="2 2" />
        <line x1="194" y1="35" x2="194" y2="55" stroke="#38bdf8" strokeWidth="2.2" />
        <line x1="224" y1="35" x2="224" y2="55" stroke="#ef4444" strokeWidth="2.2" />
        <text x="168" y="74" fill="#38bdf8" fontSize="8" fontFamily="IBM Plex Mono, monospace" stroke="none">
          −Δλ
        </text>
        <text x="200" y="74" fill={accent} fontSize="8" fontFamily="IBM Plex Mono, monospace" stroke="none">
          H-α
        </text>
        <text x="228" y="74" fill="#ef4444" fontSize="8" fontFamily="IBM Plex Mono, monospace" stroke="none">
          +Δλ
        </text>
      </g>
    );
  }

  // 2. Planetary Atmosphere, Albedo & Greenhouse Effect (planetary-atmosphere-greenhouse)
  if (
    moduleId === 'planetary-atmosphere-greenhouse' ||
    keyText.includes('greenhouse') ||
    keyText.includes('albedo') ||
    keyText.includes('atmosfer')
  ) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Planet + Greenhouse Atmosphere Shell */}
        <circle cx="116" cy="56" r="24" fill="#38bdf8" fillOpacity="0.22" stroke="#38bdf8" />
        <circle cx="116" cy="56" r="34" stroke="#10b981" strokeDasharray="4 2" strokeOpacity="0.7" />
        {/* Incoming solar ray + Albedo reflection */}
        <line x1="36" y1="26" x2="94" y2="46" stroke="#f59e0b" strokeWidth="1.8" />
        <line x1="90" y1="42" x2="62" y2="62" stroke="#fde047" strokeDasharray="3 2" />
        {/* Trapped IR bouncing */}
        <path d="M 136 44 Q 152 38, 140 58" stroke="#ef4444" strokeWidth="1.6" />
        <text x="164" y="42" fill="#f59e0b" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          S₀·(1−A)
        </text>
        <text x="164" y="64" fill="#ef4444" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Tₛ &gt; Tₑq (CO₂)
        </text>
      </g>
    );
  }

  // 3. Galactic Rotation Curve & Dark Matter Halo (milky-way-rotation)
  if (keyText.includes('milky') || keyText.includes('rotasi') || keyText.includes('dark matter')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="44" y1="18" x2="44" y2="90" strokeOpacity="0.5" />
        <line x1="44" y1="90" x2="238" y2="90" strokeOpacity="0.5" />
        {/* Observed Flat Rotation Curve (with Dark Matter Halo) */}
        <path
          d="M 44 90 Q 68 28 112 34 L 234 32"
          stroke="#38bdf8"
          strokeWidth="2"
          className="transition-transform duration-500 group-hover:-translate-y-0.5"
        />
        {/* Expected Keplerian Decline (Visible Matter Only) */}
        <path d="M 78 44 Q 130 74 232 82" stroke="#f43f5e" strokeDasharray="4 3" />
        <text x="136" y="26" fill="#38bdf8" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          v_obs (Dark Matter)
        </text>
        <text x="148" y="72" fill="#f43f5e" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Keplerian (r⁻¹/²)
        </text>
      </g>
    );
  }

  // 4. Exoplanet Transit Photometry & Light Curve Dip (exoplanet-transit)
  if (keyText.includes('exoplanet') || keyText.includes('transit') || keyText.includes('eksoplanet')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Host Star Disk & Transiting Exoplanet */}
        <circle cx="88" cy="40" r="22" fill="#f59e0b" fillOpacity="0.22" stroke="#f59e0b" />
        <line x1="44" y1="44" x2="132" y2="44" strokeDasharray="3 2" strokeOpacity="0.5" />
        <circle
          cx="84"
          cy="44"
          r="6"
          fill="#0f172a"
          stroke="#38bdf8"
          className="transition-transform duration-500 group-hover:translate-x-2"
        />
        {/* Photometric Transit Light Curve Dip at bottom/right */}
        <path
          d="M 142 36 L 166 36 L 176 74 L 208 74 L 218 36 L 242 36"
          stroke="#38bdf8"
          strokeWidth="1.8"
        />
        <text x="176" y="90" fill="#38bdf8" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          ΔF/F = (Rₚ/R*)²
        </text>
      </g>
    );
  }

  // 5. Stellar Spectroscopy & Wien's Displacement Law (stellar-wien-spectrum)
  if (keyText.includes('wien') || keyText.includes('stellar') || keyText.includes('spektroskopi')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="42" y1="18" x2="42" y2="90" strokeOpacity="0.5" />
        <line x1="42" y1="90" x2="238" y2="90" strokeOpacity="0.5" />
        {/* Hot Blue Star Planck Curve (shorter λ_max) */}
        <path d="M 46 90 C 64 90, 74 16, 94 16 C 118 16, 146 86, 232 88" stroke="#38bdf8" />
        <line x1="94" y1="16" x2="94" y2="90" stroke="#38bdf8" strokeDasharray="2 2" strokeOpacity="0.6" />
        {/* Cooler Red/Orange Star Planck Curve (longer λ_max) */}
        <path d="M 52 90 C 86 90, 114 48, 142 48 C 174 48, 198 86, 236 89" stroke="#f59e0b" />
        <line x1="142" y1="48" x2="142" y2="90" stroke="#f59e0b" strokeDasharray="2 2" strokeOpacity="0.6" />
        <text x="102" y="26" fill="#38bdf8" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          λ_max · T = b
        </text>
      </g>
    );
  }

  // 6. Hubble Expansion & Cosmological Redshift (hubble-expansion)
  if (keyText.includes('hubble') || keyText.includes('redshift') || keyText.includes('ekspansi')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="44" y1="18" x2="44" y2="88" strokeOpacity="0.5" />
        <line x1="44" y1="88" x2="238" y2="88" strokeOpacity="0.5" />
        {/* Linear Hubble Law v = H0 * d */}
        <line x1="44" y1="88" x2="226" y2="24" stroke="#f43f5e" strokeWidth="1.8" />
        {[
          [82, 74],
          [128, 58],
          [174, 42],
          [212, 29],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="3.5" fill="#f59e0b" stroke="none" />
        ))}
        <text x="64" y="34" fill="#f43f5e" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          v = H₀ · d (z &gt; 0)
        </text>
      </g>
    );
  }

  // 7. Default Astronomy: Kepler Elliptical Orbit (solar-kepler)
  return (
    <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="38" y1="54" x2="238" y2="54" strokeDasharray="3 3" strokeOpacity="0.4" />
      <line x1="138" y1="16" x2="138" y2="92" strokeDasharray="3 3" strokeOpacity="0.4" />
      <ellipse
        cx="138"
        cy="54"
        rx="84"
        ry="34"
        className="transition-all duration-500 group-hover:stroke-indigo-400"
      />
      {/* Swept Equal Area Sector (Kepler's 2nd Law) */}
      <path
        d="M 102 54 L 54 54 A 84 34 0 0 1 78 30 Z"
        fill={accent}
        fillOpacity="0.16"
        stroke="none"
      />
      {/* Central star at focus F1 */}
      <circle cx="102" cy="54" r="7" fill="#f59e0b" fillOpacity="0.85" stroke="#fde047" />
      {/* Orbiting planet & tangential velocity vector */}
      <g className="transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-0.5">
        <circle cx="198" cy="30" r="5" fill="#38bdf8" stroke="#e0f2fe" />
        <line x1="198" y1="30" x2="174" y2="20" stroke="#38bdf8" />
        <path d="M 179 19 L 174 20 L 177 25" stroke="#38bdf8" />
      </g>
      <text x="42" y="88" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
        T² ∝ a³
      </text>
    </g>
  );
};
