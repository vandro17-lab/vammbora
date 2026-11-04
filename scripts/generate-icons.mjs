// Gera os ícones PNG do PWA a partir de SVGs definidos aqui.
// Uso: npm run icons  (requer "sharp", já em devDependencies)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/icons');

// Ícone "any": van sobre fundo arredondado.
const iconeAny = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#0b1f3a"/>
  ${vanPath(1)}
</svg>`;

// Ícone maskable: mesma arte, fundo cheio e mais respiro (área de segurança ~20%).
const iconeMaskable = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0b1f3a"/>
  <g transform="translate(51.2 51.2) scale(0.8)">
    ${vanPath(1)}
  </g>
</svg>`;

function vanPath() {
  // Van centralizada na viewBox 512, desenhada em coordenadas simples.
  return `
  <g transform="translate(96 150)">
    <rect x="0" y="40" width="320" height="150" rx="34" fill="#2f52a0"/>
    <rect x="22" y="66" width="92" height="64" rx="14" fill="#eef3fb"/>
    <rect x="126" y="66" width="76" height="64" rx="14" fill="#eef3fb"/>
    <rect x="214" y="66" width="70" height="64" rx="14" fill="#eef3fb"/>
    <rect x="0" y="150" width="320" height="22" fill="#3cc394"/>
    <circle cx="82" cy="196" r="34" fill="#07132a"/>
    <circle cx="82" cy="196" r="14" fill="#eef3fb"/>
    <circle cx="238" cy="196" r="34" fill="#07132a"/>
    <circle cx="238" cy="196" r="14" fill="#eef3fb"/>
  </g>`;
}

async function png(svg, file, size) {
  const out = path.join(OUT, file);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log('gerado:', path.relative(process.cwd(), out));
}

await mkdir(OUT, { recursive: true });
await png(iconeAny(192), 'icon-192.png', 192);
await png(iconeAny(512), 'icon-512.png', 512);
await png(iconeMaskable(192), 'maskable-192.png', 192);
await png(iconeMaskable(512), 'maskable-512.png', 512);
await png(iconeAny(180), 'apple-touch-icon.png', 180);
console.log('Ícones do PWA gerados com sucesso.');
