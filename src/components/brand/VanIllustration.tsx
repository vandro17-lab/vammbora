import { useId } from 'react';
import { cn } from '@/lib/utils';

interface Tema {
  topo: string;
  base: string;
  faixa: string;
  ceu1: string;
  ceu2: string;
  chao: string;
}

const TEMAS: Tema[] = [
  { topo: '#4f72bf', base: '#213d7d', faixa: '#3cc394', ceu1: '#dbe8fb', ceu2: '#f1f6fd', chao: '#c3d4ec' },
  { topo: '#1ba67a', base: '#116a51', faixa: '#a8eccf', ceu1: '#d8f3ea', ceu2: '#eefaf5', chao: '#bfe0d3' },
  { topo: '#2f52a0', base: '#102044', faixa: '#71dcb3', ceu1: '#dde7f7', ceu2: '#f2f6fc', chao: '#c0cfe6' },
  { topo: '#3cc394', base: '#128563', faixa: '#102044', ceu1: '#def4ec', ceu2: '#f0fbf6', chao: '#c6e3d7' },
  { topo: '#5c84cf', base: '#213d7d', faixa: '#3cc394', ceu1: '#e3edfb', ceu2: '#f4f8fe', chao: '#cdd9ee' },
];

function seed(s: string): number {
  return [...s].reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

/**
 * Ilustração premium de uma van (fictícia, 100% vetorial — segura de licença).
 * Carroceria com gradiente e brilho, vidros com reflexo, rodas com aro metálico,
 * sombra de contato e cena de fundo com brilho de sol. Varia conforme o nome.
 */
export function VanIllustration({ seedKey, className }: { seedKey: string; className?: string }) {
  const t = TEMAS[seed(seedKey) % TEMAS.length];
  const uid = useId().replace(/:/g, '');
  const g = (n: string) => `${uid}-${n}`;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <svg viewBox="0 0 400 240" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={g('ceu')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.ceu1} />
            <stop offset="100%" stopColor={t.ceu2} />
          </linearGradient>
          <radialGradient id={g('sol')} cx="78%" cy="26%" r="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={g('corpo')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.topo} />
            <stop offset="58%" stopColor={t.topo} />
            <stop offset="100%" stopColor={t.base} />
          </linearGradient>
          <linearGradient id={g('vidro')} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#eaf3ff" />
            <stop offset="100%" stopColor="#b7cdeb" />
          </linearGradient>
          <linearGradient id={g('aro')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4f7fb" />
            <stop offset="100%" stopColor="#9fb4cf" />
          </linearGradient>
          <filter id={g('sombra')} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Cena de fundo */}
        <rect width="400" height="240" fill={`url(#${g('ceu')})`} />
        <rect width="400" height="240" fill={`url(#${g('sol')})`} />
        {/* silhueta de cidade bem suave */}
        <g fill={t.chao} opacity="0.5">
          <rect x="20" y="150" width="26" height="40" rx="3" />
          <rect x="52" y="134" width="20" height="56" rx="3" />
          <rect x="300" y="146" width="22" height="44" rx="3" />
          <rect x="330" y="128" width="28" height="62" rx="3" />
          <rect x="364" y="150" width="18" height="40" rx="3" />
        </g>
        {/* chão */}
        <rect y="186" width="400" height="54" fill={t.chao} />
        <rect y="186" width="400" height="3" fill="#ffffff" opacity="0.35" />

        {/* Sombra de contato */}
        <ellipse cx="200" cy="200" rx="150" ry="14" fill="#0b1f3a" opacity="0.18" filter={`url(#${g('sombra')})`} />

        {/* ---------- VAN ---------- */}
        <g>
          {/* Corpo */}
          <path
            d="M70 176
               L70 120
               Q70 96 94 92
               L250 78
               Q266 76 278 86
               L322 120
               Q332 128 332 142
               L332 176
               Q332 184 324 184
               L78 184
               Q70 184 70 176 Z"
            fill={`url(#${g('corpo')})`}
          />
          {/* Brilho superior do corpo */}
          <path
            d="M74 118 Q74 100 96 96 L250 82 Q262 81 272 88 L250 92 L96 106 Q78 108 78 124 Z"
            fill="#ffffff"
            opacity="0.22"
          />
          {/* Faixa de acento */}
          <rect x="70" y="158" width="262" height="12" fill={t.faixa} />
          <rect x="70" y="158" width="262" height="3" fill="#ffffff" opacity="0.3" />

          {/* Para-brisa */}
          <path
            d="M284 96 L316 120 Q324 126 324 138 L324 146 L286 146 Q280 146 280 140 L280 102 Q280 95 284 96 Z"
            fill={`url(#${g('vidro')})`}
          />
          {/* Janelas laterais */}
          <g fill={`url(#${g('vidro')})`}>
            <rect x="96" y="104" width="54" height="40" rx="7" />
            <rect x="158" y="104" width="50" height="40" rx="7" />
            <rect x="216" y="104" width="50" height="40" rx="7" />
          </g>
          {/* Reflexo diagonal nas janelas */}
          <g opacity="0.5">
            <path d="M104 144 L128 104 L140 104 L116 144 Z" fill="#ffffff" />
            <path d="M224 144 L248 104 L258 104 L234 144 Z" fill="#ffffff" />
          </g>

          {/* Linha da porta */}
          <line x1="158" y1="150" x2="158" y2="182" stroke="#0b1f3a" strokeOpacity="0.18" strokeWidth="2" />
          <line x1="212" y1="150" x2="212" y2="182" stroke="#0b1f3a" strokeOpacity="0.18" strokeWidth="2" />

          {/* Retrovisor */}
          <path d="M280 112 l10 -4 2 7 -9 3 z" fill={t.base} />

          {/* Farol e lanterna */}
          <circle cx="326" cy="150" r="6" fill="#fff4cf" />
          <circle cx="326" cy="150" r="10" fill="#fff4cf" opacity="0.25" />
          <rect x="72" y="146" width="7" height="10" rx="2" fill="#f0a033" opacity="0.85" />

          {/* Rodas */}
          {[128, 272].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="184" r="24" fill="#111b2e" />
              <circle cx={cx} cy="184" r="23" fill="none" stroke="#2a3850" strokeWidth="2" />
              <circle cx={cx} cy="184" r="13" fill={`url(#${g('aro')})`} />
              <circle cx={cx} cy="184" r="4" fill="#64748b" />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <rect
                  key={a}
                  x={cx - 1.3}
                  y="172"
                  width="2.6"
                  height="9"
                  rx="1.3"
                  fill="#c7d3e3"
                  transform={`rotate(${a} ${cx} 184)`}
                />
              ))}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
