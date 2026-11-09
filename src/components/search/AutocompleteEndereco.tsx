import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { buscarEnderecos, normalizarTexto, separarRuaNumero, type SugestaoEndereco } from '@/lib/geocode';

export type { SugestaoEndereco };

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

function rotuloComNumero(rotulo: string, numero: string): string {
  if (!numero || new RegExp(`\\b${numero}\\b`).test(rotulo)) return rotulo;
  const [rua, ...complemento] = rotulo.split(',').map((parte) => parte.trim());
  return [rua, numero, ...complemento].filter(Boolean).join(', ');
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
  id, value, onChange, placeholder, locais = [],
}: {
  id?: string;
  value: string;
  onChange: (texto: string, coord?: { lat: number; lng: number }) => void;
  placeholder?: string;
  locais?: SugestaoEndereco[];
}) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
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

    // 2) Endereços de rua (a partir de 3 letras), com debounce.
    if (q.length < 3) { setCarregando(false); return; }
    const controlador = new AbortController();
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(async () => {
      const remoto = await buscarEnderecos(q, controlador.signal);
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
    }, 250);

    return () => { vivo = false; controlador.abort(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locais]);

  function escolher(s: SugestaoEndereco) {
    // Se o usuário informou um número, preserva exatamente o texto digitado.
    // Sugestões de rua frequentemente vêm com outro número (ou sem número) e
    // não podem substituir o endereço solicitado.
    const numeroDigitado = separarRuaNumero(value, '').num;
    const texto = numeroDigitado ? value.trim() : s.rotulo;
    ignorar.current = texto;
    // Se mantivemos um número que a sugestão não tinha, a coordenada da sugestão
    // é só da RUA — não a usamos; deixamos o formulário geocodificar o texto COM
    // número na hora de buscar (geocodificarPreciso trata "Rua X, 123").
    if (numeroDigitado) onChange(texto);
    else onChange(texto, { lat: s.lat, lng: s.lng });
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
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
                <span className="text-navy-700">{rotuloComNumero(s.rotulo, separarRuaNumero(value, '').num)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
