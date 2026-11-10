import type { Precisao, PontoPreciso } from '@/lib/geocode';

/**
 * REGRAS ÚNICAS de endereço geográfico (puras, sem rede) — usadas por todas as
 * telas que pedem endereço: busca da família, construtor de rotas (saída e
 * casas) e simulador de encaixe.
 *
 * Princípio: texto digitado NÃO é coordenada validada. Um endereço só tem
 * ponto quando (a) o provedor localizou, (b) a pessoa escolheu uma sugestão ou
 * (c) a pessoa marcou o ponto no mapa. E o número só é dado como localizado
 * quando o provedor confirmou aquele número.
 */

export interface Coord { lat: number; lng: number }

const TIPO_VIA = /^(rua|r|avenida|av|travessa|tv|alameda|al|pra[cç]a|p[cç]a|rodovia|rod|estrada|viela|largo)\.?$/i;
const CEP = /\b\d{5}-?\d{3}\b/g;
const SUFIXO_CIDADE = /,?\s*(ara[cç]atuba|s[aã]o paulo|\bsp\b|brasil|brazil)\b.*$/i;

/**
 * Separa o NÚMERO DO IMÓVEL do restante do endereço, onde quer que ele esteja:
 * "Rua X, 450", "Rua X 450", "Rua X, 450 - Centro", "Rua X nº 450, Centro".
 * Não confunde número que faz parte do nome ("Rua 9 de Julho", "Avenida 2") nem
 * CEP. Devolve `num` vazio quando não há número de imóvel.
 */
export function numeroDoEndereco(texto: string): { rua: string; num: string } {
  const limpo = texto.replace(CEP, ' ').replace(SUFIXO_CIDADE, '').replace(/\s+/g, ' ').trim();
  const semNumero = { rua: limpo.replace(/[,\s-]+$/, ''), num: '' };
  // 1) número logo após vírgula ou "nº"; 2) número no fim do primeiro trecho.
  const m =
    limpo.match(/^(.+?)\s*(?:,\s*(?:n[º°o]?\.?\s*)?|\s+n[º°o]\.?\s*)(\d{1,6})(?=\s*(?:[,-]|$))/i) ??
    limpo.match(/^([^,]+?)\s+(\d{1,6})(?=\s*(?:[,-]|$))/);
  if (!m) return semNumero;
  const rua = m[1].replace(/[,\s-]+$/, '').trim();
  // "Avenida 2", "Rua 15": o número é o NOME da via, não o do imóvel.
  if (!rua || TIPO_VIA.test(rua)) return semNumero;
  return { rua, num: m[2] };
}

/** O rótulo (de uma sugestão) já traz exatamente esse número de imóvel? */
export function rotuloTemNumero(rotulo: string, numero: string): boolean {
  return !!numero && numeroDoEndereco(rotulo).num === numero;
}

/**
 * Texto do campo ao escolher uma sugestão DEPOIS de digitar um número: mantém
 * a rua/bairro da sugestão e o número que a pessoa digitou
 * ("Rua José Geraldo, Centro" + "450" → "Rua José Geraldo, 450, Centro").
 */
export function comporComNumero(rotuloSugestao: string, numero: string): string {
  if (!numero || rotuloTemNumero(rotuloSugestao, numero)) return rotuloSugestao;
  const partes = rotuloSugestao.split(',').map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) return rotuloSugestao;
  const atual = numeroDoEndereco(rotuloSugestao);
  const via = atual.num ? atual.rua : partes[0];
  // Descarta o número que a sugestão trazia (era de outro imóvel).
  const resto = partes.slice(1).filter((p) => !(atual.num && p.replace(/^n[º°o]?\.?\s*/i, '') === atual.num));
  return [via, numero, ...resto].join(', ');
}

export interface PontoSugestao extends Coord {
  /** A sugestão escolhida já era do número pedido (o provedor trouxe o número). */
  temNumero?: boolean;
}

export interface PontoEscolhido {
  coord: Coord | null;
  precisao: Precisao | undefined;
  /** Endereço como o provedor o reconheceu (para conferência). */
  rotulo: string | null;
}

const finito = (p: Coord | null | undefined): p is Coord => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/**
 * Decide o ponto de um endereço a partir do que existe, do MAIS confiável para
 * o menos:
 *   1) geocodificação que confirmou o número  → 'exato';
 *   2) sugestão escolhida que já era do número → 'exato';
 *   3) posição calculada pelos números vizinhos → 'estimado';
 *   4) sugestão escolhida (só a rua)           → 'rua' (ponto da via);
 *   5) geocodificação só da rua                → 'rua';
 *   6) nada confiável                          → sem ponto.
 * Um resultado apenas "aproximado" (bairro/cidade) NUNCA substitui a sugestão
 * escolhida nem vira ponto por conta própria.
 */
export function escolherPonto(preciso: PontoPreciso | null, sugestao: PontoSugestao | null): PontoEscolhido {
  if (finito(preciso) && preciso.precisao === 'exato') {
    return { coord: { lat: preciso.lat, lng: preciso.lng }, precisao: 'exato', rotulo: preciso.rotulo || null };
  }
  if (finito(sugestao) && sugestao.temNumero) {
    return { coord: { lat: sugestao.lat, lng: sugestao.lng }, precisao: 'exato', rotulo: null };
  }
  if (finito(preciso) && preciso.precisao === 'estimado') {
    return { coord: { lat: preciso.lat, lng: preciso.lng }, precisao: 'estimado', rotulo: preciso.rotulo || null };
  }
  if (finito(sugestao)) {
    return { coord: { lat: sugestao.lat, lng: sugestao.lng }, precisao: 'rua', rotulo: null };
  }
  if (finito(preciso) && preciso.precisao === 'rua') {
    return { coord: { lat: preciso.lat, lng: preciso.lng }, precisao: 'rua', rotulo: preciso.rotulo || null };
  }
  return { coord: null, precisao: undefined, rotulo: null };
}

/** Estado de um campo de endereço, como as telas o recebem. */
export interface EnderecoCampo {
  texto: string;
  /** Ponto validado (provedor, sugestão escolhida ou marcado no mapa) — ou null. */
  coord: Coord | null;
  precisao?: Precisao;
  /** Ainda consultando o mapa para o texto atual. */
  validando: boolean;
  /** Rua já marcada no mapa; ainda procurando a posição do número. */
  refinando?: boolean;
}

export const ENDERECO_VAZIO: EnderecoCampo = { texto: '', coord: null, precisao: undefined, validando: false };

export type TomAviso = 'neutro' | 'ok' | 'alerta';

/** Mensagem única de situação do endereço (mesma regra em todas as telas). */
export function avisoEndereco(e: EnderecoCampo): { tom: TomAviso; texto: string } | null {
  const texto = e.texto.trim();
  if (texto.length < 3) return null;
  if (e.validando) return { tom: 'neutro', texto: 'Localizando o endereço no mapa…' };
  const { num } = numeroDoEndereco(texto);
  if (!e.coord) {
    return { tom: 'alerta', texto: 'Não localizamos esse endereço. Confira a rua, escolha uma sugestão ou toque no mapa para marcar o ponto.' };
  }
  if (e.precisao === 'ajustado') return { tom: 'ok', texto: 'Ponto marcado por você no mapa ✓' };
  if (e.precisao === 'exato') return { tom: 'ok', texto: num ? `Número ${num} localizado ✓ — confira no mapa se precisar.` : 'Endereço localizado ✓' };
  if (e.precisao === 'estimado') return { tom: 'neutro', texto: `O mapa não tem o número ${num} cadastrado: marcamos a posição estimada pelos números vizinhos. Confira e, se precisar, arraste o alfinete até a porta.` };
  if (num && e.refinando) return { tom: 'neutro', texto: `Rua marcada no mapa. Procurando a posição do número ${num}…` };
  if (num) return { tom: 'alerta', texto: `Localizamos a rua, mas o mapa não tem o número ${num}. O ponto está na rua — ajuste no mapa: arraste o alfinete até a porta certa.` };
  return { tom: 'neutro', texto: 'Rua marcada no mapa. Informe o número ou arraste o alfinete até o ponto certo.' };
}
