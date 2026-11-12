/** Ilustrações simples (SVG) dos dois perfis do pré-lançamento. Decorativas. */

export function IlustracaoVan({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} aria-hidden="true" focusable="false">
      <path d="M8 18c0-4 3-7 7-7h44c4 0 7 1 10 5l12 14c4 1 7 4 7 9v8H8V18z" fill="#fff" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      <path d="M8 30h80v10H8z" fill="#FFC700" />
      <path d="M8 18c0-4 3-7 7-7h44c4 0 7 1 10 5l12 14c4 1 7 4 7 9v8H8V18z" fill="none" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      <rect x="15" y="16" width="16" height="10" rx="2" fill="#000" />
      <rect x="35" y="16" width="16" height="10" rx="2" fill="#000" />
      <path d="M55 16h8c2 0 3 1 4 2l7 8H55V16z" fill="#000" />
      <circle cx="28" cy="48" r="8" fill="#000" /><circle cx="28" cy="48" r="3.5" fill="#F5F5F5" />
      <circle cx="70" cy="48" r="8" fill="#000" /><circle cx="70" cy="48" r="3.5" fill="#F5F5F5" />
    </svg>
  );
}

export function IlustracaoFamilia({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} aria-hidden="true" focusable="false">
      {/* responsável */}
      <circle cx="36" cy="13" r="9" fill="#000" />
      <path d="M20 58V40c0-9 7-15 16-15s16 6 16 15v18z" fill="#000" />
      {/* criança com mochila */}
      <rect x="70" y="36" width="11" height="15" rx="4" fill="#000" />
      <circle cx="64" cy="27" r="7" fill="#FFC700" stroke="#000" strokeWidth="3" />
      <path d="M53 58V47c0-6 5-10 11-10s11 4 11 10v11z" fill="#FFC700" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      {/* mãos dadas */}
      <path d="M50 44l6 3" stroke="#000" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
