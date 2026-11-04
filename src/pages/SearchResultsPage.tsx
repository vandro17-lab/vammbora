import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, ArrowLeft, SearchX, WifiOff, RefreshCw } from 'lucide-react';
import { paramsParaCriterios } from '@/lib/searchParams';
import { buscarMotoristas } from '@/lib/matching';
import { useVitrine } from '@/data/VitrineProvider';
import { CIDADE_PADRAO } from '@/data/cidades';
import { ResultCard } from '@/components/results/ResultCard';
import { WaitlistForm } from '@/components/results/WaitlistForm';
import { SearchLoadingScreen } from '@/components/search/SearchLoadingScreen';
import { Reveal } from '@/components/motion/Reveal';
import { TURNO_LABEL, plural, nomeDestinoParaExibicao } from '@/lib/utils';

function formatarData(iso?: string): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return d ? `${d}/${m}/${y}` : null;
}

export function SearchResultsPage() {
  const [sp] = useSearchParams();
  const criterios = useMemo(() => paramsParaCriterios(sp), [sp]);

  const { motoristas, destinos, destinosPorId, status, recarregar } = useVitrine();

  const { elegiveis, totalConsultados } = useMemo(
    () => buscarMotoristas(criterios, motoristas, destinos),
    [criterios, motoristas, destinos],
  );

  const [soComVaga, setSoComVaga] = useState(false);

  const carregando = status === 'carregando';
  const destino = criterios.destinoId ? destinosPorId[criterios.destinoId] : null;
  const listaFiltrada = soComVaga ? elegiveis.filter((r) => r.motorista.vagasDisponiveis > 0) : elegiveis;
  const dataAvulso = formatarData(criterios.dataAvulso);

  return (
    <>
      <AnimatePresence>
        {carregando && (
          <SearchLoadingScreen totalConsultados={totalConsultados} cidade={CIDADE_PADRAO.nome} />
        )}
      </AnimatePresence>

      <div className="container-page py-8" aria-busy={carregando}>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 transition-colors hover:text-navy-800"
        >
          <ArrowLeft className="h-4 w-4" /> Nova busca
        </Link>

        {/* Resumo da busca */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {destino ? `Vans para ${nomeDestinoParaExibicao(destino.nome)}` : `Vans em ${CIDADE_PADRAO.nome}`}
          </h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {criterios.endereco && (
            <span className="chip bg-white text-navy-600 ring-1 ring-navy-100">
              Região: {criterios.endereco}
            </span>
          )}
          {criterios.turno && (
            <span className="chip bg-white text-navy-600 ring-1 ring-navy-100">
              Turno: {TURNO_LABEL[criterios.turno]}
            </span>
          )}
          <span className="chip bg-white text-navy-600 ring-1 ring-navy-100">
            {criterios.contratacao === 'mensal'
              ? 'Mensal'
              : `Avulso${dataAvulso ? ` · ${dataAvulso}` : ''}`}
          </span>
        </div>

        {carregando ? (
          <div className="min-h-[40vh]" aria-hidden="true" />
        ) : status === 'erro' ? (
          <ErroConexao onTentar={recarregar} />
        ) : elegiveis.length === 0 ? (
          <NenhumResultado>
            <WaitlistForm criterios={criterios} />
          </NenhumResultado>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-sm text-navy-600">
                {plural(listaFiltrada.length, 'van encontrada', 'vans encontradas')} para esta busca
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-navy-700">
                <SlidersHorizontal className="h-4 w-4 text-navy-400" />
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-navy-300 text-mint-600"
                  checked={soComVaga}
                  onChange={(e) => setSoComVaga(e.target.checked)}
                />
                Só com vaga aberta
              </label>
            </div>

            {listaFiltrada.length === 0 ? (
              <p className="mt-10 text-center text-navy-500">
                Nenhuma van com vaga aberta agora. Desmarque o filtro para ver opções sob consulta.
              </p>
            ) : (
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {listaFiltrada.map((r, i) => (
                  <Reveal as="div" key={r.motorista.id} delay={Math.min(i * 0.08, 0.4)}>
                    <ResultCard resultado={r} />
                  </Reveal>
                ))}
              </div>
            )}

            <p className="mt-6 text-center text-xs text-navy-400">
              Vagas e horários são informados pelos motoristas. A rota e o ponto de embarque você
              combina no contato — a passagem no seu endereço ainda não é calculada automaticamente.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function ErroConexao({ onTentar }: { onTentar: () => void }) {
  return (
    <div className="mx-auto mt-12 max-w-md text-center">
      <WifiOff className="mx-auto h-12 w-12 text-navy-300" />
      <h2 className="mt-4 font-display text-xl font-bold">Não conseguimos carregar as vans</h2>
      <p className="mt-2 text-navy-600">
        Houve uma falha de conexão com o servidor. Isso não significa que não há vans — é só a
        conexão. Tente novamente.
      </p>
      <button className="btn btn-md btn-primary mt-5" onClick={onTentar}>
        <RefreshCw className="h-4 w-4" /> Tentar de novo
      </button>
    </div>
  );
}

function NenhumResultado({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <div className="mx-auto mb-8 max-w-lg text-center">
        <SearchX className="mx-auto h-12 w-12 text-navy-300" />
        <h2 className="mt-4 font-display text-2xl font-bold">Vamos encontrar outro caminho?</h2>
        <p className="mt-2 text-navy-600">
          Isso não significa que não existe — pode ser só questão de tempo ou de ajustar os filtros.
          Você pode registrar seu interesse para a equipe acompanhar a procura.
        </p>
      </div>
      {children}
    </div>
  );
}

