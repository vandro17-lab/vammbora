import { useEffect, useRef, useState } from 'react';
import { MapPinned } from 'lucide-react';
import { AutocompleteEndereco } from '@/components/search/AutocompleteEndereco';
import { SeletorPontoMapa } from '@/components/motorista/SeletorPontoMapa';
import { geocodificarPreciso, reverseGeocodificar, type Precisao, type SugestaoEndereco } from '@/lib/geocode';
import { avisoEndereco, escolherPonto, numeroDoEndereco, type Coord, type EnderecoCampo, type PontoSugestao } from '@/lib/endereco';
import { cn } from '@/lib/utils';

const COR_AVISO = { neutro: 'bg-navy-50 text-navy-700', ok: 'bg-mint-50 text-mint-800', alerta: 'bg-amber-50 text-amber-800' } as const;

/**
 * CAMPO ÚNICO DE ENDEREÇO do app (família, construtor de rotas, simulador).
 *
 * Junta, com as mesmas regras em todas as telas:
 *  - sugestões enquanto digita (rua e número no mesmo campo);
 *  - localização do endereço completo, tentando o número;
 *  - aviso honesto quando o mapa só tem a rua, com ajuste do ponto no mapa;
 *  - o ponto só existe quando veio do provedor, de uma sugestão escolhida ou
 *    do mapa — e é descartado/refeito quando o texto muda.
 *
 * `mapa`: 'sempre' mostra o mapa de ajuste junto; 'sob-demanda' mostra um botão
 * que o abre (telas compactas).
 */
export function CampoEndereco({
  id, valor, onChange, locais = [], placeholder, mapa = 'sob-demanda',
}: {
  id?: string;
  /** Estado atual (controlado por quem usa o campo). */
  valor: EnderecoCampo;
  onChange: (e: EnderecoCampo) => void;
  locais?: SugestaoEndereco[];
  placeholder?: string;
  mapa?: 'sempre' | 'sob-demanda';
}) {
  const [enderecoNoMapa, setEnderecoNoMapa] = useState<string | null>(null);
  const [mapaAberto, setMapaAberto] = useState(false);
  // Ponto que a pessoa já confirmou PARA O TEXTO ATUAL (sugestão escolhida ou
  // ponto recebido pronto): é a reserva se o número não for encontrado.
  const confirmado = useRef<({ texto: string } & PontoSugestao) | null>(
    valor.coord && valor.precisao !== 'ajustado'
      ? { texto: valor.texto, ...valor.coord, temNumero: valor.precisao === 'exato' } : null,
  );
  // Ponto marcado à mão vale mais que qualquer geocodificação posterior.
  const ajustadoAMao = useRef(valor.precisao === 'ajustado');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const texto = valor.texto;

  // Localiza o texto atual (com espera, cancelando consultas antigas).
  useEffect(() => {
    const endereco = texto.trim();
    if (endereco.length < 3 || ajustadoAMao.current) return;
    const reservaAgora = () => (confirmado.current?.texto === texto ? confirmado.current : null);
    const reserva = reservaAgora();
    const { num } = numeroDoEndereco(endereco);
    // Sugestão escolhida e nada de número a procurar (ou ela já era do número):
    // o ponto está decidido, não há o que consultar.
    if (reserva && (!num || reserva.temNumero)) return;

    const ctrl = new AbortController();
    let vivo = true;
    const t = setTimeout(async () => {
      let achado = null;
      try { achado = await geocodificarPreciso(endereco, '', ctrl.signal, { aceitarSemNumero: true }); }
      catch { /* mapa indisponível: fica o que já havia (reserva) */ }
      if (!vivo || ajustadoAMao.current) return; // resposta antiga ou ponto já marcado à mão
      const r = escolherPonto(achado, reservaAgora()); // a sugestão pode ter sido escolhida durante a consulta
      setEnderecoNoMapa(r.rotulo);
      onChangeRef.current({ texto, coord: r.coord, precisao: r.precisao, validando: false });
    }, 650);
    return () => { vivo = false; ctrl.abort(); clearTimeout(t); };
  }, [texto]);

  function aoDigitarOuEscolher(t: string, c?: Coord) {
    ajustadoAMao.current = false;
    setEnderecoNoMapa(null);
    if (c) return; // escolha de sugestão: tratada em aoEscolher (tem o ponto e a precisão)
    confirmado.current = null;
    // Texto mudou: o ponto anterior deixa de valer até ser localizado de novo.
    onChange({ texto: t, coord: null, precisao: undefined, validando: t.trim().length >= 3 });
  }

  function aoEscolher(t: string, s: SugestaoEndereco, soDaRua: boolean) {
    const { num } = numeroDoEndereco(t);
    confirmado.current = { texto: t, lat: s.lat, lng: s.lng, temNumero: !!num && !soDaRua };
    // Com número ainda não confirmado, o ponto da rua vale já e a busca pelo
    // número segue em seguida.
    // (Se o texto não mudou, não haverá nova consulta: não fica "validando".)
    onChange({ texto: t, coord: { lat: s.lat, lng: s.lng }, precisao: num && !soDaRua ? 'exato' : 'rua', validando: !!num && soDaRua && t !== texto });
  }

  // Ponto marcado no mapa: assume o ponto e mostra o endereço embaixo dele.
  function aoMarcar(lat: number, lng: number) {
    ajustadoAMao.current = true;
    setEnderecoNoMapa(null);
    onChange({ texto, coord: { lat, lng }, precisao: 'ajustado', validando: false });
    reverseGeocodificar(lat, lng).then((r) => { if (r && ajustadoAMao.current) setEnderecoNoMapa(r); }).catch(() => {});
  }

  const aviso = avisoEndereco(valor);
  const mostrarMapa = mapa === 'sempre' || mapaAberto;
  const precisao: Precisao | undefined = valor.precisao;

  return (
    <div>
      <AutocompleteEndereco
        id={id} value={texto} locais={locais} placeholder={placeholder}
        onChange={aoDigitarOuEscolher} onEscolher={aoEscolher}
      />
      {aviso && <p role="status" data-testid="aviso-endereco" data-tom={aviso.tom} className={cn('mt-2 rounded-xl p-2.5 text-sm', COR_AVISO[aviso.tom])}>{aviso.texto}</p>}
      {mapa === 'sob-demanda' && !mapaAberto && texto.trim().length >= 3 && !valor.validando && precisao !== 'exato' && (
        <button type="button" onClick={() => setMapaAberto(true)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-mint-700 hover:text-mint-800">
          <MapPinned className="h-4 w-4" /> {valor.coord ? 'Ajustar o ponto no mapa' : 'Marcar o ponto no mapa'}
        </button>
      )}
      {mostrarMapa && (
        <div className="mt-3">
          <SeletorPontoMapa ponto={valor.coord} precisao={precisao} onMover={aoMarcar} />
          {enderecoNoMapa && <p className="mt-1 text-xs text-navy-500">No mapa: {enderecoNoMapa}</p>}
        </div>
      )}
    </div>
  );
}
