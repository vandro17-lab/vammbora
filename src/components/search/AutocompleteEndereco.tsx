import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { buscarEnderecos, normalizarTexto, type MunicipioUF, type SugestaoEndereco } from '@/lib/geocode';
import { comporComNumero, numeroDoEndereco, rotuloTemNumero } from '@/lib/endereco';

export type { SugestaoEndereco };

/** Filtra a lista local (bairros/escolas de Araçatuba) pelo texto digitado. */
function filtrarLocais(locais: SugestaoEndereco[], q: string): SugestaoEndereco[] {
  // Com número digitado, compara só a parte da rua/lugar.
  const alvo = normalizarTexto(numeroDoEndereco(q).num ? numeroDoEndereco(q).rua : q);
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
 * Refina a cada tecla: mostra na hora sugestões LOCAIS (bairros/escolas do
 * catálogo) e busca endereços de RUA em paralelo — pelo proxy /api/mapas
 * (Geoapify, se GEOAPIFY_API_KEY estiver na Vercel) ou, sem nenhuma chave,
 * pelo Photon/OpenStreetMap. Degrada sem erro para o usuário.
 */
export function AutocompleteEndereco({
  id, value, onChange, placeholder, locais = [], onEscolher, municipio,
}: {
  id?: string;
  /** Município onde procurar o endereço (sem ele: o padrão de sempre). */
  municipio?: MunicipioUF;
  value: string;
  onChange: (texto: string, coord?: { lat: number; lng: number }) => void;
  placeholder?: string;
  locais?: SugestaoEndereco[];
  /** Avisado SEMPRE que uma sugestão é escolhida, com a coordenada dela.
   *  `soDaRua` = a pessoa digitou um número que a sugestão não trazia: o ponto
   *  é o da RUA, e o número ainda precisa ser localizado ou ajustado no mapa. */
  onEscolher?: (texto: string, sugestao: SugestaoEndereco, soDaRua: boolean) => void;
}) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [ativa, setAtiva] = useState(-1); // sugestão destacada pelo teclado
  const idLista = `${id ?? 'endereco'}-sugestoes`;
  const ignorar = useRef<string | null>(null); // valor recém-escolhido: não re-buscar

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || ignorar.current === value) {
      setSugestoes([]); setCarregando(false); setAberto(false);
      return;
    }

    // 1) Sugestões locais imediatas (atualizam a CADA tecla, refinando/limpando).
    const base = filtrarLocais(locais, q);
    setAtiva(-1);
    setSugestoes(base);
    setAberto(base.length > 0);

    // 2) Endereços de rua (a partir de 3 letras), com debounce.
    if (q.length < 3) { setCarregando(false); return; }
    const controlador = new AbortController();
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(async () => {
      const remoto = await buscarEnderecos(q, controlador.signal, municipio);
      if (!vivo) return;
      const vistos = new Set<string>();
      const merge: SugestaoEndereco[] = [];
      for (const s of [...remoto, ...base]) {
        if (vistos.has(s.rotulo)) continue;
        vistos.add(s.rotulo);
        merge.push(s);
        if (merge.length >= 6) break;
      }
      setSugestoes(merge);
      setAberto(merge.length > 0);
      setCarregando(false);
    }, 300);

    return () => { vivo = false; controlador.abort(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locais, municipio?.nome, municipio?.uf]);

  function escolher(s: SugestaoEndereco) {
    // Número digitado antes de escolher: o campo passa a mostrar a rua da
    // sugestão COM o número digitado. O ponto da sugestão é sempre repassado
    // (nunca se perde a coordenada); se a sugestão não era desse número, quem
    // usa o campo é avisado de que o ponto é só o da rua (`soDaRua`).
    const numeroDigitado = numeroDoEndereco(value).num;
    const texto = comporComNumero(s.rotulo, numeroDigitado);
    const soDaRua = !!numeroDigitado && !rotuloTemNumero(s.rotulo, numeroDigitado);
    ignorar.current = texto;
    onChange(texto, { lat: s.lat, lng: s.lng });
    onEscolher?.(texto, s, soDaRua);
    setSugestoes([]);
    setAtiva(-1);
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { if (aberto) { e.preventDefault(); setAberto(false); setAtiva(-1); } return; }
    if (!sugestoes.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAberto(true);
      const n = sugestoes.length;
      setAtiva((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a <= 0 ? n - 1 : a - 1)));
    } else if (e.key === 'Enter' && aberto && ativa >= 0 && sugestoes[ativa]) {
      e.preventDefault(); // escolhe a sugestão em vez de enviar o formulário
      escolher(sugestoes[ativa]);
    }
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
          onKeyDown={aoTeclar}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-activedescendant={aberto && ativa >= 0 ? `${idLista}-${ativa}` : undefined}
          aria-autocomplete="list"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>
      </div>
      {aberto && sugestoes.length > 0 && (
        <ul id={idLista} className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto overscroll-contain rounded-xl border border-navy-100 bg-white shadow-float" role="listbox">
          {sugestoes.map((s, i) => (
            <li key={`${s.rotulo}-${i}`} id={`${idLista}-${i}`} role="option" aria-selected={i === ativa}>
              <button
                type="button"
                tabIndex={-1}
                className={`flex min-h-[44px] w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-mint-50 ${i === ativa ? 'bg-mint-50' : ''}`}
                // Segurar o foco no campo (o toque/clique não fecha a lista antes
                // da escolha) e escolher no CLIQUE — rolar a lista com o dedo não
                // escolhe nada por engano.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(s)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
                <span className="text-navy-700">{s.rotulo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
