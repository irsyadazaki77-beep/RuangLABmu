import React from 'react';

export interface SciFormulaProps {
  text: string;
  className?: string;
  serifVars?: boolean;
}

export interface ChemFormulaProps {
  formula: string;
  className?: string;
}

const SYMBOL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bDelta\s*/g, 'Δ'],
  [/\bdelta\s*/g, 'δ'],
  [/\btheta\b/gi, 'θ'],
  [/\blambda\b/gi, 'λ'],
  [/\bomega\b/gi, 'ω'],
  [/\balpha\b/gi, 'α'],
  [/\bbeta\b/gi, 'β'],
  [/\bgamma\b/gi, 'γ'],
  [/\bmu\b/g, 'μ'],
  [/\bpi\b/gi, 'π'],
  [/\brho\b/gi, 'ρ'],
  [/\bsigma\b/gi, 'σ'],
  [/\btau\b/gi, 'τ'],
  [/\bphi\b/gi, 'φ'],
  [/\+-|\+\/-/g, '±'],
  [/\s+\*\s+/g, ' · '],
  [/->|-->/g, ' → '],
  [/<=>|<->/g, ' ⇌ '],
  [/>=/g, '≥'],
  [/<=/g, '≤'],
];

function normalizeUnicodeSuperscriptsAndSubscripts(raw: string): string {
  return raw
    .replace(/₀/g, '_0')
    .replace(/₁/g, '_1')
    .replace(/₂/g, '_2')
    .replace(/₃/g, '_3')
    .replace(/₄/g, '_4')
    .replace(/₅/g, '_5')
    .replace(/₆/g, '_6')
    .replace(/₇/g, '_7')
    .replace(/₈/g, '_8')
    .replace(/₉/g, '_9')
    .replace(/⁰/g, '^0')
    .replace(/¹/g, '^1')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5')
    .replace(/⁶/g, '^6')
    .replace(/⁷/g, '^7')
    .replace(/⁸/g, '^8')
    .replace(/⁹/g, '^9')
    .replace(/⁺/g, '^+')
    .replace(/⁻/g, '^-');
}

/**
 * `<SciFormula />` formats plain-text scientific notation, units, and physics equations
 * (e.g. `v0`, `m/s^2`, `R^2`, `E_k`, `F_net`, `Delta H`, `T^2 / a^3`, `10^-3`) into
 * semantic HTML `<sub />` and `<sup />` with proper mathematical symbols (Δ, θ, λ, π, ±)
 * and optional italic serif styling for physics variables.
 */
export const SciFormula: React.FC<SciFormulaProps> = ({
  text,
  className = '',
  serifVars = false,
}) => {
  if (!text) return null;

  let processed = normalizeUnicodeSuperscriptsAndSubscripts(text);
  for (const [pattern, replacement] of SYMBOL_REPLACEMENTS) {
    processed = processed.replace(pattern, replacement);
  }

  // Convert shorthand physics/chemical tokens like v0, H0, R1, R2, Rx, Km, Vmax, CO2, H2O, O2 into explicit _{sub}
  processed = processed
    .replace(/_(\d+)/g, '_{$1}')
    .replace(/\b(CO|H|O|N|Cl|Na|Ca|Mg)(2|3|4|6|12)\b/g, '$1_{$2}')
    .replace(/C_6H_12O_6/g, 'C_{6}H_{12}O_{6}')
    .replace(/H_2O_2/g, 'H_{2}O_{2}')
    .replace(/H_2O\b/g, 'H_{2}O')
    .replace(/\b([vVtTrREFIkKmMpPH])(0|1|2|3|x|y|max|m|p|k|g|s|w|a|b|obs|disk|bulge|halo|sel|awal|akhir)\b/g, '$1_{$2}')
    .replace(/\b(R)\^(2)\b/g, 'R^2');

  // Tokenize by explicit superscripts (^{...} or ^token) and subscripts (_{...} or _token)
  const tokenRegex = /(\^\{[^}]+\}|\^[+-]?\d+|\^[a-zA-Z]+|_\{[^}]+\}|_[a-zA-Z0-9*+-]+)/g;
  const parts = processed.split(tokenRegex).filter((p) => p.length > 0);

  return (
    <span className={`inline-flex items-baseline whitespace-nowrap ${className}`}>
      {parts.map((part, idx) => {
        if (part.startsWith('^')) {
          const content = part.startsWith('^{') ? part.slice(2, -1) : part.slice(1);
          return (
            <sup
              key={idx}
              className="text-[0.72em] leading-none font-mono font-semibold ml-[0.5px] -top-[0.38em] relative"
            >
              {content}
            </sup>
          );
        }
        if (part.startsWith('_')) {
          const content = part.startsWith('_{') ? part.slice(2, -1) : part.slice(1);
          return (
            <sub
              key={idx}
              className="text-[0.72em] leading-none font-mono font-semibold ml-[0.5px] -bottom-[0.18em] relative"
            >
              {content}
            </sub>
          );
        }
        if (serifVars) {
          // Italicize single-letter physics symbols while keeping numbers/operators upright
          const subParts = part.split(/(\b[a-zA-Z]\b)/g);
          return (
            <React.Fragment key={idx}>
              {subParts.map((sp, sIdx) =>
                /^[a-zA-Z]$/.test(sp) && sp !== 's' && sp !== 'm' && sp !== 'g' && sp !== 'L' ? (
                  <i key={sIdx} className="font-serif italic pr-[1px]">
                    {sp}
                  </i>
                ) : (
                  <React.Fragment key={sIdx}>{sp}</React.Fragment>
                )
              )}
            </React.Fragment>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
};

/**
 * `<ChemFormula />` formats plain-text chemical formulas and reaction equations
 * (e.g. `H2SO4`, `CO2`, `NaHCO3`, `Cu^2+`, `SO4^2-`, `2H2O2 -> 2H2O + O2`)
 * into semantic `<sub />` and `<sup />` elements.
 */
export const ChemFormula: React.FC<ChemFormulaProps> = ({
  formula,
  className = '',
}) => {
  if (!formula) return null;

  const normalized = normalizeUnicodeSuperscriptsAndSubscripts(formula)
    .replace(/->|-->/g, ' → ')
    .replace(/<=>|<->/g, ' ⇌ ');

  // Match ionic charges like ^2+, ^-, _{(aq)}, or element stoichiometric subscripts like H2, O4
  const tokens = normalized.split(
    /(\^\{[^}]+\}|\^\d*[+-]|_\{[^}]+\}|_[0-9]+|(?<=[A-Za-z)\]])\d+)/g
  );

  return (
    <span className={`inline-flex items-baseline font-mono ${className}`}>
      {tokens.map((tok, idx) => {
        if (!tok) return null;
        if (tok.startsWith('^')) {
          const charge = tok.startsWith('^{') ? tok.slice(2, -1) : tok.slice(1);
          return (
            <sup
              key={idx}
              className="text-[0.72em] leading-none font-bold -top-[0.38em] relative"
            >
              {charge}
            </sup>
          );
        }
        if (tok.startsWith('_')) {
          const sub = tok.startsWith('_{') ? tok.slice(2, -1) : tok.slice(1);
          return (
            <sub
              key={idx}
              className="text-[0.72em] leading-none font-semibold -bottom-[0.18em] relative"
            >
              {sub}
            </sub>
          );
        }
        if (/^\d+$/.test(tok)) {
          return (
            <sub
              key={idx}
              className="text-[0.72em] leading-none font-semibold -bottom-[0.18em] relative"
            >
              {tok}
            </sub>
          );
        }
        return <React.Fragment key={idx}>{tok}</React.Fragment>;
      })}
    </span>
  );
};
