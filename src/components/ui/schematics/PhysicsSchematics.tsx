import React from 'react';

export interface DomainSchematicProps {
  moduleId: string;
  keyText: string;
  accent: string;
}

export const PhysicsSchematics: React.FC<DomainSchematicProps> = ({
  moduleId,
  keyText,
  accent,
}) => {
  // 1. Newton's 2nd Law & Inclined Plane (newton-incline)
  if (
    keyText.includes('newton') ||
    keyText.includes('incline') ||
    keyText.includes('bidang miring')
  ) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Right-triangle Inclined Plane */}
        <polygon
          points="44,92 224,92 44,28"
          fill={accent}
          fillOpacity="0.08"
          strokeOpacity="0.85"
        />
        {/* Angle arc θ at bottom-right vertex (224,92) */}
        <path d="M 184 92 A 40 40 0 0 1 188 79" strokeOpacity="0.7" />
        <text x="168" y="88" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          θ
        </text>

        {/* Sliding Block on the Slope + Force Vectors */}
        <g
          transform="translate(116, 53) rotate(19.6)"
          className="transition-transform duration-500 group-hover:translate-x-2 group-hover:translate-y-0.5"
        >
          {/* Mass Block m */}
          <rect
            x="-18"
            y="-22"
            width="36"
            height="22"
            rx="3"
            fill={accent}
            fillOpacity="0.22"
          />
          <text
            x="-5"
            y="-8"
            fill={accent}
            fontSize="9"
            fontWeight="bold"
            fontFamily="IBM Plex Mono, monospace"
            stroke="none"
          >
            m
          </text>

          {/* Normal Force Vector N (upward perpendicular to slope) */}
          <line x1="0" y1="-22" x2="0" y2="-45" stroke="#10b981" />
          <path d="M -3.5 -40 L 0 -45 L 3.5 -40" stroke="#10b981" />
          <text x="5" y="-36" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
            N
          </text>

          {/* Down-slope Driving Force Vector mg sin θ */}
          <line x1="18" y1="-11" x2="56" y2="-11" stroke="#f59e0b" strokeWidth="1.8" />
          <path d="M 50 -14.5 L 56 -11 L 50 -7.5" stroke="#f59e0b" strokeWidth="1.8" />
          <text x="24" y="-16" fill="#f59e0b" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
            mg·sinθ
          </text>

          {/* Kinetic Friction Vector fk (up-slope) */}
          <line x1="-18" y1="-8" x2="-42" y2="-8" stroke="#f43f5e" />
          <path d="M -37 -11 L -42 -8 L -37 -5" stroke="#f43f5e" />
          <text x="-42" y="-13" fill="#f43f5e" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
            fₖ
          </text>
        </g>
      </g>
    );
  }

  // 2. Projectile Motion / Parabolic Trajectory (projectile-motion)
  if (keyText.includes('projectile') || keyText.includes('parabola') || keyText.includes('projektil')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Ground & vertical axis */}
        <line x1="32" y1="90" x2="248" y2="90" strokeOpacity="0.5" />
        <line x1="40" y1="20" x2="40" y2="94" strokeOpacity="0.5" />
        {/* Parabolic trajectory curve */}
        <path
          d="M 40 88 Q 138 -6 234 88"
          strokeDasharray="4 3"
          className="transition-all duration-500 group-hover:stroke-sky-400"
        />
        {/* Launch velocity vector v0 */}
        <path d="M 40 88 L 82 48" stroke="#f59e0b" strokeWidth="1.8" />
        <path d="M 75 48 L 82 48 L 81 55" stroke="#f59e0b" strokeWidth="1.8" />
        <path d="M 64 88 A 24 24 0 0 0 58 72" strokeOpacity="0.7" />
        <text x="67" y="82" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          θ₀
        </text>
        {/* Apex height h_max dashed line */}
        <line x1="137" y1="41" x2="137" y2="90" strokeDasharray="2 2" strokeOpacity="0.4" />
        {/* Projectile sphere at apex & horizontal velocity vector vx */}
        <circle
          cx="137"
          cy="41"
          r="6"
          fill={accent}
          fillOpacity="0.25"
          className="transition-transform duration-500 group-hover:translate-x-2"
        />
        <line x1="137" y1="41" x2="174" y2="41" stroke="#f59e0b" />
        <path d="M 169 38 L 174 41 L 169 44" stroke="#f59e0b" />
        <text x="142" y="33" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          vₓ = v₀cosθ
        </text>
      </g>
    );
  }

  // 3. Harmonic Pendulum (pendulum-harmonic)
  if (keyText.includes('pendulum') || keyText.includes('bandul')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Support ceiling */}
        <line x1="105" y1="14" x2="175" y2="14" strokeWidth="2" strokeOpacity="0.85" />
        <line x1="118" y1="14" x2="124" y2="8" strokeOpacity="0.45" />
        <line x1="138" y1="14" x2="144" y2="8" strokeOpacity="0.45" />
        <line x1="158" y1="14" x2="164" y2="8" strokeOpacity="0.45" />
        {/* Vertical equilibrium dashed line */}
        <line x1="140" y1="14" x2="140" y2="96" strokeDasharray="3 3" strokeOpacity="0.45" />
        {/* Ghost equilibrium bob */}
        <circle cx="140" cy="86" r="8" strokeDasharray="2 2" strokeOpacity="0.35" />
        {/* Swinging rod & bob */}
        <g className="transition-transform duration-500 origin-[140px_14px] group-hover:rotate-6">
          <line x1="140" y1="14" x2="188" y2="76" />
          <circle cx="192" cy="81" r="10" fill={accent} fillOpacity="0.22" />
          {/* Tangential restoring force vector -mg sin θ */}
          <path d="M 183 87 L 158 96" stroke="#f59e0b" strokeWidth="1.7" />
          <path d="M 164 97 L 158 96 L 161 91" stroke="#f59e0b" strokeWidth="1.7" />
        </g>
        {/* Swing arc trajectory */}
        <path d="M 88 81 Q 140 105 192 81" strokeDasharray="4 3" strokeOpacity="0.55" />
        <path d="M 140 36 A 22 22 0 0 0 154 32" strokeOpacity="0.7" />
        <text x="145" y="46" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          θ
        </text>
        <text x="170" y="45" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          L
        </text>
      </g>
    );
  }

  // 4. Hooke's Law & Spring Oscillation (spring-hooke)
  if (keyText.includes('spring') || keyText.includes('hooke') || keyText.includes('pegas')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Top ceiling support */}
        <line x1="65" y1="16" x2="145" y2="16" strokeWidth="2" strokeOpacity="0.85" />
        <line x1="78" y1="16" x2="85" y2="9" strokeOpacity="0.45" />
        <line x1="98" y1="16" x2="105" y2="9" strokeOpacity="0.45" />
        <line x1="118" y1="16" x2="125" y2="9" strokeOpacity="0.45" />
        {/* Helical spring zig-zag coil */}
        <path
          d="M 105 16 L 105 24 L 91 30 L 119 38 L 91 46 L 119 54 L 91 62 L 105 68 L 105 74"
          className="transition-transform duration-500 group-hover:scale-y-105 origin-top"
        />
        {/* Suspended mass block */}
        <rect
          x="89"
          y="74"
          width="32"
          height="22"
          rx="4"
          fill={accent}
          fillOpacity="0.2"
          className="transition-transform duration-500 group-hover:translate-y-1"
        />
        <text x="100" y="88" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          m
        </text>
        {/* Equilibrium & displacement Δx */}
        <line x1="48" y1="52" x2="175" y2="52" strokeDasharray="3 3" strokeOpacity="0.45" />
        <path d="M 142 52 L 142 84" stroke="#f59e0b" />
        <path d="M 138 79 L 142 84 L 146 79" stroke="#f59e0b" />
        <text x="150" y="72" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Δx
        </text>
        {/* Sinusoidal SHM wave trace on right */}
        <path
          d="M 178 52 Q 190 26, 202 52 T 226 52 T 250 52"
          strokeOpacity="0.75"
          className="transition-transform duration-500 group-hover:translate-x-1"
        />
      </g>
    );
  }

  // 5. 1D Collision & Momentum Conservation (collision-momentum)
  if (keyText.includes('collision') || keyText.includes('tumbukan') || keyText.includes('momentum')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Linear Air Track */}
        <line x1="28" y1="78" x2="252" y2="78" strokeOpacity="0.7" />
        <line x1="28" y1="83" x2="252" y2="83" strokeDasharray="6 4" strokeOpacity="0.4" />
        {/* Cart / Sphere 1 (moving right) */}
        <g className="transition-transform duration-500 group-hover:translate-x-2">
          <circle cx="94" cy="60" r="16" fill={accent} fillOpacity="0.22" />
          <text x="86" y="63" fill={accent} fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
            m₁
          </text>
          <line x1="112" y1="54" x2="136" y2="54" stroke="#f59e0b" strokeWidth="1.8" />
          <path d="M 131 50.5 L 136 54 L 131 57.5" stroke="#f59e0b" strokeWidth="1.8" />
          <text x="115" y="47" fill="#f59e0b" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
            v₁
          </text>
        </g>
        {/* Cart / Sphere 2 (moving left) */}
        <g className="transition-transform duration-500 group-hover:-translate-x-2">
          <circle cx="186" cy="60" r="16" fill="#f59e0b" fillOpacity="0.18" stroke="#f59e0b" />
          <text x="178" y="63" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
            m₂
          </text>
          <line x1="168" y1="64" x2="144" y2="64" stroke="#10b981" strokeWidth="1.8" />
          <path d="M 149 60.5 L 144 64 L 149 67.5" stroke="#10b981" strokeWidth="1.8" />
          <text x="150" y="74" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
            v₂
          </text>
        </g>
        {/* Impact spark lines at center */}
        <line x1="140" y1="32" x2="140" y2="42" stroke="#f43f5e" strokeOpacity="0.7" />
        <line x1="132" y1="36" x2="136" y2="43" stroke="#f43f5e" strokeOpacity="0.7" />
        <line x1="148" y1="36" x2="144" y2="43" stroke="#f43f5e" strokeOpacity="0.7" />
      </g>
    );
  }

  // 6. Fluid Viscosity & Stokes' Law (stokes-viscosity)
  if (keyText.includes('stokes') || keyText.includes('viskositas') || keyText.includes('fluida')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Tall Graduated Viscosity Tube */}
        <path d="M 114 14 L 114 94 Q 114 98 118 98 L 162 98 Q 166 98 166 94 L 166 14" />
        {/* Fluid meniscus & graduation marks */}
        <path d="M 114 26 Q 140 30 166 26" strokeOpacity="0.6" />
        <rect x="115" y="27" width="50" height="70" fill={accent} fillOpacity="0.1" stroke="none" />
        {[38, 52, 66, 80].map((y) => (
          <line key={y} x1="114" y1={y} x2="122" y2={y} strokeOpacity="0.5" />
        ))}
        {/* Falling sphere inside viscous fluid */}
        <g className="transition-transform duration-500 group-hover:translate-y-2">
          <circle cx="140" cy="56" r="7" fill={accent} fillOpacity="0.35" />
          {/* Upward Stokes drag Fs + Buoyancy FA */}
          <line x1="140" y1="49" x2="140" y2="33" stroke="#10b981" strokeWidth="1.6" />
          <path d="M 136.5 38 L 140 33 L 143.5 38" stroke="#10b981" strokeWidth="1.6" />
          {/* Downward Weight W */}
          <line x1="140" y1="63" x2="140" y2="83" stroke="#f59e0b" strokeWidth="1.6" />
          <path d="M 136.5 78 L 140 83 L 143.5 78" stroke="#f59e0b" strokeWidth="1.6" />
        </g>
        <text x="174" y="42" fill="#10b981" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Fₛ + Fₐ
        </text>
        <text x="174" y="82" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          W = mg
        </text>
      </g>
    );
  }

  // 7. Ohm's Law & Wheatstone Bridge Circuit (ohm-wheatstone)
  if (
    moduleId === 'ohm-wheatstone' ||
    keyText.includes('ohm') ||
    keyText.includes('wheatstone')
  ) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Diamond Wheatstone Bridge */}
        <polygon
          points="140,16 204,54 140,92 76,54"
          fill={accent}
          fillOpacity="0.06"
          strokeOpacity="0.85"
        />
        {/* Left & Right Lead Wires */}
        <line x1="36" y1="54" x2="76" y2="54" />
        <line x1="204" y1="54" x2="244" y2="54" />
        {/* Central Galvanometer G */}
        <line x1="140" y1="16" x2="140" y2="41" strokeDasharray="2 2" />
        <line x1="140" y1="67" x2="140" y2="92" strokeDasharray="2 2" />
        <circle cx="140" cy="54" r="13" fill={accent} fillOpacity="0.18" stroke="#f59e0b" />
        <text x="136" y="57" fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="IBM Plex Mono, monospace" stroke="none">
          G
        </text>
        {/* Resistor labels R1, R2, R3, Rx */}
        <text x="92" y="31" fill={accent} fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          R₁
        </text>
        <text x="176" y="31" fill={accent} fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          R₂
        </text>
        <text x="92" y="84" fill={accent} fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          R₃
        </text>
        <text x="176" y="84" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
          Rₓ
        </text>
      </g>
    );
  }

  // 8. Young's Double-Slit Interference (optics-young-slit)
  if (keyText.includes('optics') || keyText.includes('slit') || keyText.includes('young') || keyText.includes('optik')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round">
        {/* Plane wave fronts */}
        <line x1="42" y1="24" x2="42" y2="86" strokeOpacity="0.45" />
        <line x1="56" y1="24" x2="56" y2="86" strokeOpacity="0.7" />
        <line x1="70" y1="24" x2="70" y2="86" />
        {/* Double slit barrier */}
        <line x1="92" y1="16" x2="92" y2="38" strokeWidth="2.2" />
        <line x1="92" y1="47" x2="92" y2="63" strokeWidth="2.2" />
        <line x1="92" y1="72" x2="92" y2="94" strokeWidth="2.2" />
        {/* Radial diffracted wavefronts */}
        <path d="M 94 28 A 22 22 0 0 1 94 56" strokeOpacity="0.75" />
        <path d="M 94 16 A 38 38 0 0 1 94 70" strokeOpacity="0.55" />
        <path d="M 94 54 A 22 22 0 0 1 94 82" strokeOpacity="0.75" />
        <path d="M 94 40 A 38 38 0 0 1 94 94" strokeOpacity="0.55" />
        {/* Interference intensity fringe curve on screen */}
        <line x1="210" y1="16" x2="210" y2="94" strokeDasharray="2 2" strokeOpacity="0.5" />
        <path
          d="M 212 18 Q 228 25, 212 32 Q 238 42, 212 55 Q 246 55, 212 55 Q 238 68, 212 78 Q 228 85, 212 92"
          stroke="#38bdf8"
          className="transition-transform duration-500 group-hover:translate-x-1"
        />
      </g>
    );
  }

  // 9. Photoelectric Effect & Planck's Constant (photoelectric-planck)
  if (keyText.includes('photoelectric') || keyText.includes('fotolistrik') || keyText.includes('planck')) {
    return (
      <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Metal Cathode Target Plate */}
        <rect x="78" y="80" width="124" height="10" rx="2" fill={accent} fillOpacity="0.25" />
        {/* Incoming Wavy UV Photon Beam (hf) */}
        <path
          d="M 44 22 Q 54 14, 62 26 T 80 38 T 98 50 T 116 62 L 128 76"
          stroke="#f59e0b"
          strokeWidth="1.8"
        />
        <path d="M 121 75 L 128 76 L 127 69" stroke="#f59e0b" strokeWidth="1.8" />
        <text x="44" y="44" fill="#f59e0b" fontSize="9" fontFamily="IBM Plex Mono, monospace" stroke="none">
          γ (h·f)
        </text>
        {/* Ejected Photoelectrons (e-) */}
        <g className="transition-transform duration-500 group-hover:translate-x-1.5 group-hover:-translate-y-1.5">
          <line x1="142" y1="74" x2="188" y2="30" stroke="#10b981" strokeDasharray="3 2" />
          <circle cx="192" cy="26" r="6" fill="#10b981" fillOpacity="0.25" stroke="#10b981" />
          <text x="202" y="29" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
            e⁻ (Eₖ)
          </text>
          <line x1="156" y1="74" x2="210" y2="48" stroke="#10b981" strokeDasharray="3 2" />
          <circle cx="215" cy="45" r="5" fill="#10b981" fillOpacity="0.25" stroke="#10b981" />
        </g>
      </g>
    );
  }

  // 10. Universal Gravitation & Escape Velocity (gravity-orbital)
  return (
    <g stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Bound circular orbit dashed */}
      <circle cx="96" cy="58" r="34" strokeDasharray="3 3" strokeOpacity="0.45" />
      {/* Hyperbolic escape trajectory (v >= v_esc) */}
      <path
        d="M 62 58 Q 62 18 228 16"
        stroke="#f59e0b"
        strokeDasharray="4 2"
        className="transition-transform duration-500 group-hover:translate-x-1"
      />
      {/* Primary Planet M1 */}
      <circle cx="96" cy="58" r="14" fill={accent} fillOpacity="0.25" />
      <text x="89" y="61" fill={accent} fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
        M₁
      </text>
      {/* Secondary Mass m2 & Mutual Attraction Fg */}
      <circle cx="198" cy="58" r="8" fill="#10b981" fillOpacity="0.25" stroke="#10b981" />
      <text x="193" y="77" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
        m₂
      </text>
      <line x1="114" y1="58" x2="142" y2="58" stroke="#f59e0b" />
      <path d="M 137 55 L 142 58 L 137 61" stroke="#f59e0b" />
      <line x1="186" y1="58" x2="158" y2="58" stroke="#f59e0b" />
      <path d="M 163 55 L 158 58 L 163 61" stroke="#f59e0b" />
      <text x="142" y="51" fill="#f59e0b" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
        F_g
      </text>
      <text x="180" y="30" fill="#f59e0b" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" stroke="none">
        v_esc
      </text>
    </g>
  );
};
