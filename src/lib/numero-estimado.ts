/**
 * ESTIMATIVA DO NÚMERO DO IMÓVEL pelos vizinhos (pura, sem rede).
 *
 * Quando o mapa conhece a rua mas não o número pedido, quase sempre ele
 * conhece OUTROS números da mesma rua. Como a numeração cresce ao longo da via,
 * a posição do número pedido fica entre os dois vizinhos mais próximos (um
 * menor e um maior), na proporção dos números. É uma ESTIMATIVA — nunca é
 * apresentada como número localizado.
 */

export interface NumeroConhecido { num: number; lat: number; lng: number }

export interface PosicaoEstimada {
  lat: number;
  lng: number;
  /** O mapa já tinha exatamente esse número (não é estimativa). */
  exato: boolean;
  /** Números vizinhos usados na conta (para explicar à pessoa). */
  vizinhos: number[];
}

/** Distância aproximada em metros (suficiente para trechos de rua). */
export function metrosEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

// Limites de bom senso: além deles a conta deixa de ser confiável.
const MAX_METROS_ENTRE_VIZINHOS = 2500;
const MAX_METROS_ALEM_DO_ULTIMO = 400;
const VIZINHO_DE_PORTA = 40; // diferença de numeração tratada como "ali do lado"

export function estimarPorVizinhos(alvo: number, conhecidos: NumeroConhecido[]): PosicaoEstimada | null {
  if (!Number.isFinite(alvo) || alvo <= 0) return null;
  // Um ponto por número (média, se o mapa tiver o mesmo número mais de uma vez).
  const porNumero = new Map<number, { lat: number; lng: number; n: number }>();
  for (const c of conhecidos) {
    if (!Number.isFinite(c.num) || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    const a = porNumero.get(c.num) ?? { lat: 0, lng: 0, n: 0 };
    porNumero.set(c.num, { lat: a.lat + c.lat, lng: a.lng + c.lng, n: a.n + 1 });
  }
  const todos: NumeroConhecido[] = [...porNumero.entries()]
    .map(([num, v]) => ({ num, lat: v.lat / v.n, lng: v.lng / v.n }))
    .sort((a, b) => a.num - b.num);
  if (!todos.length) return null;

  const igual = todos.find((c) => c.num === alvo);
  if (igual) return { lat: igual.lat, lng: igual.lng, exato: true, vizinhos: [alvo] };

  const cercar = (lista: NumeroConhecido[]) => {
    let menor: NumeroConhecido | null = null;
    let maior: NumeroConhecido | null = null;
    for (const c of lista) {
      if (c.num < alvo) menor = c;
      else if (!maior) maior = c;
    }
    return { menor, maior };
  };
  // Pares e ímpares ficam em lados opostos da rua: prefere o mesmo lado.
  const mesmoLado = todos.filter((c) => c.num % 2 === alvo % 2);
  let { menor, maior } = cercar(mesmoLado);
  if (!menor || !maior) ({ menor, maior } = cercar(todos));

  if (menor && maior) {
    if (metrosEntre(menor, maior) > MAX_METROS_ENTRE_VIZINHOS) return null;
    const t = (alvo - menor.num) / (maior.num - menor.num);
    return {
      lat: menor.lat + (maior.lat - menor.lat) * t,
      lng: menor.lng + (maior.lng - menor.lng) * t,
      exato: false, vizinhos: [menor.num, maior.num],
    };
  }

  // Número além do último conhecido (antes do primeiro ou depois do último).
  const porProximidade = [...todos].sort((a, b) => Math.abs(a.num - alvo) - Math.abs(b.num - alvo));
  const [perto, seguinte] = porProximidade;
  if (Math.abs(perto.num - alvo) <= VIZINHO_DE_PORTA) {
    return { lat: perto.lat, lng: perto.lng, exato: false, vizinhos: [perto.num] };
  }
  if (!seguinte) return null;
  // Continua na mesma direção e no mesmo ritmo dos dois últimos conhecidos.
  const passo = (alvo - perto.num) / (perto.num - seguinte.num);
  const metros = Math.abs(passo) * metrosEntre(perto, seguinte);
  if (!Number.isFinite(metros) || metros > MAX_METROS_ALEM_DO_ULTIMO) return null;
  return {
    lat: perto.lat + (perto.lat - seguinte.lat) * passo,
    lng: perto.lng + (perto.lng - seguinte.lng) * passo,
    exato: false, vizinhos: [seguinte.num, perto.num].sort((a, b) => a - b),
  };
}
