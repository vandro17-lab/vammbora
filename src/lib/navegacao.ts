/**
 * NAVEGAÇÃO CURVA A CURVA (puro, sem rede nem tela).
 *
 * Transforma a resposta do roteador (OSRM, com `steps=true`) em um GUIA:
 * a linha do trajeto, a posição de cada manobra ao longo dela e os trechos
 * (pernas) até cada parada. Com o guia, cada leitura do GPS vira "onde estou
 * na rota, qual a próxima manobra e quanto falta".
 */

export type LatLng = [number, number];

export interface Manobra {
  tipo: string;
  modificador: string;
  rua: string;
  /** Saída da rotatória (1 = primeira). */
  saida?: number;
  /** Posição ao longo do trajeto, em metros desde o início. */
  metros: number;
  /** Índice da perna (trecho até uma parada) a que pertence. */
  perna: number;
}

export interface Perna { inicioM: number; fimM: number; segundos: number }

export interface Guia {
  geometria: LatLng[];
  /** Metros acumulados até cada ponto da geometria. */
  acumulado: number[];
  totalM: number;
  manobras: Manobra[];
  pernas: Perna[];
}

const RAD = Math.PI / 180;
export function metros(a: LatLng, b: LatLng): number {
  const x = (b[1] - a[1]) * RAD * Math.cos(((a[0] + b[0]) / 2) * RAD);
  const y = (b[0] - a[0]) * RAD;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/** Rumo (0 = norte, 90 = leste) do ponto a para o b. */
export function rumo(a: LatLng, b: LatLng): number {
  const x = (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * RAD);
  const y = b[0] - a[0];
  return (Math.atan2(x, y) / RAD + 360) % 360;
}

interface PassoOSRM {
  distance?: number; duration?: number; name?: string;
  geometry?: { coordinates?: [number, number][] };
  maneuver?: { type?: string; modifier?: string; exit?: number };
}
export interface RotaOSRM { legs?: Array<{ duration?: number; steps?: PassoOSRM[] }> }

// Manobras que não pedem ação do motorista (não viram instrução).
const SEM_ACAO = new Set(['new name', 'notification', 'use lane', 'exit roundabout', 'exit rotary']);

/** Monta o guia a partir de uma rota do OSRM pedida com steps + geojson. */
export function montarGuia(rota: RotaOSRM | null | undefined): Guia | null {
  const geometria: LatLng[] = [];
  const acumulado: number[] = [];
  const manobras: Manobra[] = [];
  const pernas: Perna[] = [];
  const empurrar = (p: LatLng) => {
    const ultimo = geometria[geometria.length - 1];
    if (ultimo && ultimo[0] === p[0] && ultimo[1] === p[1]) return;
    acumulado.push(ultimo ? acumulado[acumulado.length - 1] + metros(ultimo, p) : 0);
    geometria.push(p);
  };
  (rota?.legs ?? []).forEach((leg, perna) => {
    const inicioM = acumulado[acumulado.length - 1] ?? 0;
    for (const passo of leg.steps ?? []) {
      const coords = passo.geometry?.coordinates ?? [];
      if (coords[0]) empurrar([coords[0][1], coords[0][0]]);
      const tipo = passo.maneuver?.type ?? '';
      const modificador = passo.maneuver?.modifier ?? '';
      const semAcao = SEM_ACAO.has(tipo) || (tipo === 'continue' && (modificador === 'straight' || !modificador));
      if (tipo && !semAcao) {
        manobras.push({ tipo, modificador, rua: passo.name ?? '', saida: passo.maneuver?.exit, metros: acumulado[acumulado.length - 1] ?? 0, perna });
      }
      for (const c of coords.slice(1)) empurrar([c[1], c[0]]);
    }
    pernas.push({ inicioM, fimM: acumulado[acumulado.length - 1] ?? inicioM, segundos: Math.max(0, leg.duration ?? 0) });
  });
  if (geometria.length < 2) return null;
  return { geometria, acumulado, totalM: acumulado[acumulado.length - 1], manobras, pernas };
}

export interface PosicaoNaRota {
  /** Metros percorridos ao longo do trajeto. */
  metros: number;
  /** Distância entre a posição real e o trajeto (m). */
  desvioM: number;
  ponto: LatLng;
  rumo: number;
}

/**
 * Encaixa a posição do GPS no trajeto. `dicaM` = onde a van estava: a busca
 * olha primeiro logo à frente (rotas escolares passam mais de uma vez na mesma
 * rua, e a van não pode "pular" para outra passagem); se ali não encaixar, só
 * procura dali PARA A FRENTE — a navegação nunca anda para trás sozinha.
 */
export function projetarNaRota(guia: Guia, pos: LatLng, dicaM?: number): PosicaoNaRota {
  const { geometria: g, acumulado: ac } = guia;
  const buscar = (deM: number, ateM: number): PosicaoNaRota | null => {
    let melhor: PosicaoNaRota | null = null;
    for (let i = 0; i + 1 < g.length; i++) {
      if (ac[i + 1] < deM) continue;
      if (ac[i] > ateM) break;
      const a = g[i], b = g[i + 1];
      const kx = Math.cos(a[0] * RAD);
      const bx = (b[1] - a[1]) * kx, by = b[0] - a[0];
      const px = (pos[1] - a[1]) * kx, py = pos[0] - a[0];
      const comp2 = bx * bx + by * by;
      const t = comp2 ? Math.max(0, Math.min(1, (px * bx + py * by) / comp2)) : 0;
      const ponto: LatLng = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const desvioM = metros(pos, ponto);
      if (!melhor || desvioM < melhor.desvioM) melhor = { metros: ac[i] + (ac[i + 1] - ac[i]) * t, desvioM, ponto, rumo: rumo(a, b) };
    }
    return melhor;
  };
  const tudo = () => buscar(-Infinity, Infinity) as PosicaoNaRota;
  if (dicaM == null) return tudo();
  const perto = buscar(dicaM - 30, dicaM + 500);
  if (perto && perto.desvioM <= 45) return perto;
  return buscar(dicaM - 30, Infinity) ?? perto ?? tudo();
}

/** Ponto e rumo do trajeto a `m` metros do início. */
export function pontoEm(guia: Guia, m: number): { ponto: LatLng; rumo: number } {
  const { geometria: g, acumulado: ac } = guia;
  const alvo = Math.max(0, Math.min(guia.totalM, m));
  let lo = 0, hi = ac.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (ac[mid] <= alvo) lo = mid; else hi = mid; }
  const trecho = ac[hi] - ac[lo];
  const t = trecho ? (alvo - ac[lo]) / trecho : 0;
  return { ponto: [g[lo][0] + (g[hi][0] - g[lo][0]) * t, g[lo][1] + (g[hi][1] - g[lo][1]) * t], rumo: rumo(g[lo], g[hi]) };
}

/** Próxima manobra à frente da posição, dentro da perna atual. */
export function proximaManobra(guia: Guia, m: number, perna: number): { manobra: Manobra; distanciaM: number } | null {
  const proxima = guia.manobras.find((x) => x.perna === perna && x.metros > m + 8 && x.tipo !== 'depart');
  return proxima ? { manobra: proxima, distanciaM: proxima.metros - m } : null;
}

/** Trecho de linha entre dois pontos do trajeto (para pintar o já percorrido). */
export function recorte(guia: Guia, deM: number, ateM: number): LatLng[] {
  const de = Math.max(0, deM), ate = Math.min(guia.totalM, ateM);
  if (ate <= de) return [];
  const linha: LatLng[] = [pontoEm(guia, de).ponto];
  guia.acumulado.forEach((a, i) => { if (a > de && a < ate) linha.push(guia.geometria[i]); });
  linha.push(pontoEm(guia, ate).ponto);
  return linha;
}

/* ------------------------------ textos em pt-BR ----------------------------- */

export type Seta = 'esquerda' | 'direita' | 'leve-esquerda' | 'leve-direita' | 'frente' | 'retorno' | 'rotatoria' | 'chegada';

export function setaDaManobra(m: Manobra): Seta {
  if (m.tipo === 'arrive') return 'chegada';
  if (m.tipo === 'roundabout' || m.tipo === 'rotary') return 'rotatoria';
  switch (m.modificador) {
    case 'uturn': return 'retorno';
    case 'left': case 'sharp left': return 'esquerda';
    case 'right': case 'sharp right': return 'direita';
    case 'slight left': return 'leve-esquerda';
    case 'slight right': return 'leve-direita';
    default: return 'frente';
  }
}

const naRua = (rua: string) => (!rua ? '' : ` ${/^(largo|beco|viaduto|anel|contorno|acesso|trevo)\b/i.test(rua) ? 'no' : 'na'} ${rua}`);
const pelaRua = (rua: string) => (!rua ? '' : ` ${/^(largo|beco|viaduto|anel|contorno|acesso|trevo)\b/i.test(rua) ? 'pelo' : 'pela'} ${rua}`);
const ORDINAL = ['', 'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta'];

/** Instrução curta da manobra ("Vire à direita na Rua X"). */
export function textoManobra(m: Manobra): string {
  if (m.tipo === 'arrive') return 'Você chegou';
  if (m.tipo === 'depart') return `Siga${pelaRua(m.rua)}`;
  if (m.tipo === 'roundabout' || m.tipo === 'rotary') {
    const saida = m.saida && ORDINAL[m.saida] ? `pegue a ${ORDINAL[m.saida]} saída` : 'siga pela rotatória';
    return `Na rotatória, ${saida}${m.rua ? ` para a ${m.rua}` : ''}`;
  }
  switch (m.modificador) {
    case 'uturn': return `Faça o retorno${naRua(m.rua)}`;
    case 'left': return `Vire à esquerda${naRua(m.rua)}`;
    case 'right': return `Vire à direita${naRua(m.rua)}`;
    case 'sharp left': return `Vire acentuadamente à esquerda${naRua(m.rua)}`;
    case 'sharp right': return `Vire acentuadamente à direita${naRua(m.rua)}`;
    case 'slight left': return `Mantenha-se à esquerda${naRua(m.rua)}`;
    case 'slight right': return `Mantenha-se à direita${naRua(m.rua)}`;
    default: return `Siga em frente${pelaRua(m.rua)}`;
  }
}

/** "200 m", "1,2 km". */
export function textoDistancia(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}

/** Distância por extenso, para a voz. */
export function falaDistancia(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 50) * 50)} metros`;
  const km = Math.round(m / 100) / 10;
  if (km === 1) return '1 quilômetro';
  return `${String(km).replace('.', ' vírgula ')} quilômetros`;
}

/** O que a voz diz ao se aproximar de uma manobra. */
export function falaManobra(m: Manobra, distanciaM: number, destino?: string): string {
  const texto = m.tipo === 'arrive' ? `você chega${destino ? ` em ${destino}` : ' ao destino'}` : textoManobra(m);
  if (distanciaM <= 40) return m.tipo === 'arrive' ? `Você chegou${destino ? `: ${destino}` : ''}` : texto;
  return `Em ${falaDistancia(distanciaM)}, ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`;
}

/** "5 min", "1 h 05". */
export function textoDuracao(segundos: number): string {
  const min = Math.max(1, Math.round(segundos / 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** Tempo restante até o fim da perna, proporcional ao que falta percorrer. */
export function segundosAteFimDaPerna(guia: Guia, perna: number, m: number): number {
  const p = guia.pernas[perna];
  if (!p) return 0;
  const tamanho = p.fimM - p.inicioM;
  return tamanho > 0 ? p.segundos * Math.max(0, Math.min(1, (p.fimM - m) / tamanho)) : 0;
}

/** Busca o guia no roteador público OSRM (pontos na ordem de passagem). */
export async function buscarGuia(pontos: { lat: number; lng: number }[], signal?: AbortSignal): Promise<Guia | null> {
  if (pontos.length < 2) return null;
  const coords = pontos.map((p) => `${p.lng},${p.lat}`).join(';');
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false&geometries=geojson&steps=true`, { signal });
    if (!r.ok) return null;
    const d = (await r.json()) as { routes?: RotaOSRM[] };
    return montarGuia(d.routes?.[0]);
  } catch {
    return null;
  }
}
