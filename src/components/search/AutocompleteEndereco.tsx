import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, LocateFixed } from 'lucide-react';
import { buscarEnderecos, geocodificarPreciso, separarRuaNumero, normalizarTexto, type SugestaoEndereco } from '@/lib/geocode';

export type { SugestaoEndereco };

/** Item exibido na lista. `exato` marca o endereço cujo NÚMERO foi localizado. */
type Item = SugestaoEndereco & { exato?: boolean };

/** Filtra a lista local (bairros/escolas de Araçatuba) pelo texto digitado. */
function filtrarLocais(locais: SugestaoEndereco[], q: string): SugestaoEndereco[] {
  const alvo = normalizarTexto(q);
  if (!alvo) return [];
  const out: SugestaoEndereco[] = [];
  const vistos = new Set<string>();
  for (const s of locais) {
    if (!normalizarTexto(s.rotulo).includes(alvo) || vistos.has(s.rotulo)) continue;
    vistos.add(s.rotulo);
    out.push(s);
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Campo de endereço com autocomplete de Araçatuba.
 *
 * A cada tecla mostra sugestões LOCAIS imediatas (bairros/escolas do catálogo) e
 * busca endereços de RUA em paralelo. Quando o texto já traz um NÚMERO de casa,
 * dispara também a geocodificação estruturada (Geoapify via proxy, ou OSM sem
 * chave) e, se o número for localizado com precisão, coloca esse endereço —
 * COM o número e com a coordenada exata — no topo da lista para o usuário tocar.
 * Toda sugestão escolhida carrega sua coordenada: a busca nunca fica sem ponto.
 */
export function AutocompleteEndereco({
  id, value, onChange, placeholder, locais = [],
}: {
  id?: string;
  value: string;
  onChange: (texto: string, coord?: { lat: number; lng: number }) => void;
  placeholder?: string;
  locais?: SugestaoEndereco[];
}) {
  const [sugestoes, setSugestoes] = useState<Item[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const ignorar = useRef<string | null>(null); // valor recém-escolhido: não re-buscar

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || ignorar.current === value) {
      setSugestoes([]); setCarregando(false); setAberto(false);
      return;
    }

    // 1) Sugestões locais imediatas (atualizam a CADA tecla, refinando/limpando).
    const base = filtrarLocais(locais, q);
    setSugestoes(base);
    setAberto(base.length > 0);

    // 2) Endereços de rua (a partir de 3 letras) + número exato, com debounce.
    if (q.length < 3) { setCarregando(false); return; }
    const controlador = new AbortController();
    let vivo = true;
    setCarregando(true);
    const t = window.setTimeout(async () => {
      const { num } = separarRuaNumero(q, '');
      const [remoto, preciso] = await Promise.all([
        buscarEnderecos(q, controlador.signal),
        num ? geocodificarPreciso(q, '', controlador.signal).catch(() => null) : Promise.resolve(null),
      ]);
      if (!vivo) return;
      const vistos = new Set<string>();
      const merge: Item[] = [];
      const empurrar = (s?: Item | null) => {
        if (!s || !s.rotulo || vistos.has(s.rotulo) || merge.length >= 6) return;
        vistos.add(s.rotulo); merge.push(s);
      };
      // O número localizado com precisão vem PRIMEIRO — é o que o usuário quer
      // tocar. Só o marcamos como exato quando o serviço confirmou o número.
      if (preciso && preciso.precisao === 'exato') {
        empurrar({ rotulo: preciso.rotulo, lat: preciso.lat, lng: preciso.lng, exato: true });
      }
      for (const s of [...remoto, ...base]) empurrar(s);
      setSugestoes(merge);
      setAberto(merge.length > 0);
      setCarregando(false);
    }, 250);

    return () => { vivo = false; controlador.abort(); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locais]);

  function escolher(s: Item) {
    // Se a sugestão já traz um número (endereço exato), usamos o rótulo dela.
    // Se o usuário digitou um número que a sugestão não tem (ex.: escolheu a
    // rua), preservamos o texto digitado COM o número — mas SEMPRE guardamos a
    // coordenada da sugestão como origem: assim a busca nunca fica sem ponto, e
    // o número é refinado na hora de buscar (geocodificarPreciso trata "Rua X, 123").
    const numeroDigitado = (value.match(/(\d{1,6})\s*$/) || [])[1] || '';
    const sugestaoTemNumero = /\d/.test(s.rotulo);
    const texto = numeroDigitado && !sugestaoTemNumero ? value.trim() : s.rotulo;
    ignorar.current = texto;
    onChange(texto, { lat: s.lat, lng: s.lng });
    setSugestoes([]);
    setAberto(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          id={id}
          className="field-input pr-9"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { ignorar.current = null; onChange(e.target.value); }}
          onFocus={() => { if (sugestoes.length) setAberto(true); }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-autocomplete="list"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>
      </div>
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-navy-100 bg-white shadow-float" role="listbox">
          {sugestoes.map((s, i) => (
            <li key={`${s.rotulo}-${i}`} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-mint-50"
                onMouseDown={(e) => { e.preventDefault(); escolher(s); }}
              >
                {s.exato
                  ? <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />}
                <span className="min-w-0 flex-1 text-navy-700">
                  {s.rotulo}
                  {s.exato && <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">número localizado</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
