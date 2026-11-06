/**
 * Van ESCOLAR (ilustração vetorial original) — branca, com faixa amarela e a
 * identificação "ESCOLAR", conforme exigido. Sem dependências nem fotos externas.
 */
export function VanEscolar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 120" className={className} role="img" aria-label="Van escolar" xmlns="http://www.w3.org/2000/svg">
      {/* sombra */}
      <ellipse cx="110" cy="104" rx="90" ry="8" fill="#0b1f3a" opacity="0.08" />
      {/* corpo */}
      <path d="M14 86V52c0-6 5-11 11-11h120c4 0 8 2 11 5l32 32c2 2 3 5 3 8v0c0 6-5 11-11 11H25c-6 0-11-5-11-11Z" fill="#ffffff" stroke="#c9d6e4" strokeWidth="2.5" />
      {/* teto arredondado */}
      <path d="M25 41c0-6 5-11 11-11h96c6 0 11 5 11 11v0H25Z" fill="#f1f5f9" />
      {/* faixa amarela escolar */}
      <rect x="14" y="64" width="177" height="15" fill="#f5b400" />
      <text x="70" y="75.5" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" letterSpacing="2" fill="#0b1f3a">ESCOLAR</text>
      {/* janelas */}
      <rect x="34" y="44" width="26" height="16" rx="3" fill="#cfe4ff" />
      <rect x="66" y="44" width="26" height="16" rx="3" fill="#cfe4ff" />
      <rect x="98" y="44" width="26" height="16" rx="3" fill="#cfe4ff" />
      {/* para-brisa */}
      <path d="M150 46l18 18h-18V46Z" fill="#cfe4ff" />
      {/* rodas */}
      <circle cx="58" cy="92" r="13" fill="#0b1f3a" /><circle cx="58" cy="92" r="5.5" fill="#94a3b8" />
      <circle cx="160" cy="92" r="13" fill="#0b1f3a" /><circle cx="160" cy="92" r="5.5" fill="#94a3b8" />
      {/* farol */}
      <rect x="183" y="70" width="8" height="7" rx="2" fill="#f5b400" />
    </svg>
  );
}
