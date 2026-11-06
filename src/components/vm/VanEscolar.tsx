/**
 * Van ESCOLAR — ilustração vetorial original, dimensional (sombreado, cromado,
 * vidros com reflexo). Brasileira: faixa amarela e identificação "ESCOLAR".
 * Sem fotos nem dependências externas; segura de licença.
 *
 * Observação de fidelidade: a referência usa um render 3D/fotográfico da van
 * sobre uma estrada ao entardecer — isso não é reproduzível como vetor
 * licenciável 1:1. Esta é a van vetorial mais próxima (volume por gradientes),
 * mantendo proporção, faixa amarela e "ESCOLAR".
 */
export function VanEscolar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 150" className={className} role="img" aria-label="Van escolar" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vmVanBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f3f6fa" />
          <stop offset="1" stopColor="#dbe4ee" />
        </linearGradient>
        <linearGradient id="vmVanRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e7edf4" />
        </linearGradient>
        <linearGradient id="vmVanGlass" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#dbeeff" />
          <stop offset="0.5" stopColor="#a7cdf0" />
          <stop offset="1" stopColor="#7fb0e6" />
        </linearGradient>
        <linearGradient id="vmVanBand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd23d" />
          <stop offset="1" stopColor="#f2a900" />
        </linearGradient>
        <radialGradient id="vmVanTire" cx="0.5" cy="0.42" r="0.6">
          <stop offset="0" stopColor="#4b5563" />
          <stop offset="0.7" stopColor="#1f2937" />
          <stop offset="1" stopColor="#0b1220" />
        </radialGradient>
        <linearGradient id="vmVanHub" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>

      {/* sombra no chão */}
      <ellipse cx="130" cy="131" rx="104" ry="10" fill="#07132a" opacity="0.16" />

      {/* corpo */}
      <path d="M20 108V58c0-9 7-16 16-16h120c6 0 11 2 15 6l48 46c3 3 5 7 5 11v3c0 6-5 11-11 11H34c-8 0-14-6-14-14Z"
        fill="url(#vmVanBody)" stroke="#c3d2e2" strokeWidth="1.4" />
      {/* teto */}
      <path d="M36 42c0-9 7-16 16-16h92c7 0 13 5 15 12l1 4H36v0Z" fill="url(#vmVanRoof)" stroke="#d3deea" strokeWidth="1" />

      {/* janelas laterais */}
      <g>
        <rect x="46" y="48" width="30" height="20" rx="4" fill="url(#vmVanGlass)" />
        <rect x="82" y="48" width="30" height="20" rx="4" fill="url(#vmVanGlass)" />
        <rect x="118" y="48" width="26" height="20" rx="4" fill="url(#vmVanGlass)" />
        {/* reflexo */}
        <path d="M49 66l10-15h6l-10 15z" fill="#ffffff" opacity="0.35" />
        <path d="M85 66l10-15h6l-10 15z" fill="#ffffff" opacity="0.35" />
      </g>

      {/* para-brisa (frente, à direita) */}
      <path d="M152 48l34 32c2 2 1 4-2 4h-30V48Z" fill="url(#vmVanGlass)" />
      <path d="M156 52v26h22z" fill="#ffffff" opacity="0.28" />

      {/* faixa amarela ESCOLAR */}
      <rect x="20" y="78" width="168" height="18" fill="url(#vmVanBand)" />
      <rect x="20" y="78" width="168" height="2.4" fill="#ffffff" opacity="0.45" />
      <text x="58" y="91.5" fontFamily="'Plus Jakarta Sans', Arial, sans-serif" fontSize="12" fontWeight="800" letterSpacing="2.5" fill="#0b1f3a">ESCOLAR</text>

      {/* frente: para-choque, grade, farol */}
      <path d="M200 96h24c5 0 9 4 9 9v3c0 6-5 11-11 11h-22V96Z" fill="#e7edf4" stroke="#c3d2e2" strokeWidth="1" />
      <rect x="214" y="86" width="18" height="9" rx="3" fill="#ffe08a" stroke="#f2a900" strokeWidth="1" />
      <rect x="206" y="112" width="24" height="5" rx="2.5" fill="#9fb0c4" />

      {/* retrovisor */}
      <path d="M150 54l-10-4v6l10 3z" fill="#cbd6e4" stroke="#aebccd" strokeWidth="0.8" />

      {/* rodas */}
      <g>
        <circle cx="74" cy="114" r="18" fill="url(#vmVanTire)" />
        <circle cx="74" cy="114" r="8.2" fill="url(#vmVanHub)" stroke="#64748b" strokeWidth="1" />
        <circle cx="74" cy="114" r="2.4" fill="#475569" />
        <circle cx="178" cy="114" r="18" fill="url(#vmVanTire)" />
        <circle cx="178" cy="114" r="8.2" fill="url(#vmVanHub)" stroke="#64748b" strokeWidth="1" />
        <circle cx="178" cy="114" r="2.4" fill="#475569" />
      </g>

      {/* brilho superior do corpo */}
      <path d="M40 46c6-2 110-2 118 1-40-1-80-1-118-1z" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}
