import React from 'react';
import { ScienceDomain } from '../../registry/experimentRegistry';

export const DOMAIN_SCHEMATIC_COLORS: Record<ScienceDomain, string> = {
  fisika: '#0ea5e9',
  kimia: '#14b8a6',
  biologi: '#10b981',
  astronomi: '#6366f1',
};

export interface ModuleSchematicIllustrationProps {
  moduleId: string;
  domain: ScienceDomain;
  title?: string;
  subCategory?: string;
  className?: string;
}

export const ModuleSchematicIllustration: React.FC<ModuleSchematicIllustrationProps> = ({
  moduleId,
  domain,
  title = '',
  subCategory = '',
  className = '',
}) => {
  const accent = DOMAIN_SCHEMATIC_COLORS[domain] || '#0ea5e9';
  const keyText = `${moduleId} ${title} ${subCategory}`.toLowerCase();

  const renderSchematicPaths = () => {
    if (domain === 'fisika') {
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
    }

    if (domain === 'kimia') {
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
    }

    if (domain === 'biologi') {
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
    }

    // ASTRONOMI DOMAIN
    // 1. Galactic Rotation Curve & Dark Matter Halo (milky-way-rotation)
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

    // 2. Exoplanet Transit Photometry & Light Curve Dip (exoplanet-transit)
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

    // 3. Stellar Spectroscopy & Wien's Displacement Law (stellar-wien-spectrum)
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

    // 4. Hubble Expansion & Cosmological Redshift (hubble-expansion)
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

    // 5. Default Astronomy: Kepler Elliptical Orbit (solar-kepler)
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

  return (
    <svg
      viewBox="0 0 280 110"
      className={`w-full h-full block select-none ${className}`}
      role="img"
      aria-label={`Skematik Ilmiah ${domain} - ${moduleId}`}
    >
      {renderSchematicPaths()}
    </svg>
  );
};
