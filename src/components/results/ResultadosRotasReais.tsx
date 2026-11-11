import { Loader2 } from 'lucide-react';
import type { CriteriosBusca } from '@/types';
import type { RespostaBuscaReal, SituacaoSentido } from '@/lib/busca-rotas-reais-cliente';
import { avisoIdaEVolta, avisosDoSentido, type AvisoBusca } from '@/lib/busca-mensagens';
import { CartaoRotaReal } from '@/components/results/CartaoRotaReal';
import { WaitlistForm } from '@/components/results/WaitlistForm';
import { cn } from '@/lib/utils';

/**
 * Resultado da busca sobre rotas reais, POR SENTIDO. Cada sentido mostra os
 * seus cartões e, à parte, o que ficou sem resposta — separando ausência de
 * oferta, incompatibilidade, dados insuficientes e avaliação incompleta.
 */
export function ResultadosRotasReais({ resposta, criterios, continuando, onContinuar, onTentar }: {
  resposta: RespostaBuscaReal; criterios: CriteriosBusca; continuando: boolean; onContinuar: () => void; onTentar: () => void;
}) {
  const total = resposta.resultados.length;
  const pacote = avisoIdaEVolta(resposta);
  const varios = resposta.sentidos.length > 1;
  return (
    <>
      {total > 0 && (
        <p className="text-sm text-navy-600">
          {total} {total === 1 ? 'rota encontrada' : 'rotas encontradas'}. Horários estimados — a vaga é confirmada pelo motorista.
        </p>
      )}
      {pacote && <p role="status" data-testid="aviso-pacote" className="mt-3 rounded-xl bg-navy-50 p-3 text-sm text-navy-700 ring-1 ring-navy-100">{pacote}</p>}
      {resposta.sentidos.map((s) => (
        <SecaoSentido key={s.sentido} s={s} resposta={resposta} titulo={varios} continuando={continuando} onContinuar={onContinuar} onTentar={onTentar} />
      ))}
      {total === 0 && <div className="mt-6"><WaitlistForm criterios={criterios} /></div>}
    </>
  );
}

function SecaoSentido({ s, resposta, titulo, continuando, onContinuar, onTentar }: {
  s: SituacaoSentido; resposta: RespostaBuscaReal; titulo: boolean; continuando: boolean; onContinuar: () => void; onTentar: () => void;
}) {
  const cartoes = resposta.resultados.filter((r) => r.sentido === s.sentido);
  const avisos = avisosDoSentido(s);
  return (
    <section className="mt-5" data-testid={`sentido-${s.sentido}`}>
      {titulo && <h2 className="font-display text-xl font-bold text-navy-900">{s.sentido === 'ida' ? 'Ida — até a escola' : 'Volta — até em casa'}</h2>}
      {cartoes.length > 0 && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cartoes.map((r) => <CartaoRotaReal key={r.rotaId + r.sentido} r={r} />)}</div>
      )}
      {avisos.map((a) => <Aviso key={a.tipo} a={a} continuando={continuando} onContinuar={onContinuar} onTentar={onTentar} />)}
    </section>
  );
}

const ESTILO: Record<AvisoBusca['tipo'], string> = {
  sem_oferta: 'bg-navy-50 text-navy-700 ring-navy-100',
  incompativel: 'bg-navy-50 text-navy-700 ring-navy-100',
  dados_insuficientes: 'bg-navy-50 text-navy-700 ring-navy-100',
  avaliacao_incompleta: 'bg-amber-50 text-amber-900 ring-amber-200',
  erro: 'bg-amber-50 text-amber-900 ring-amber-200',
};

function Aviso({ a, continuando, onContinuar, onTentar }: { a: AvisoBusca; continuando: boolean; onContinuar: () => void; onTentar: () => void }) {
  return (
    <div role="status" data-testid={`aviso-${a.tipo}`} className={cn('mt-3 rounded-xl p-4 text-sm ring-1', ESTILO[a.tipo])}>
      <p>{a.texto}</p>
      {a.acao && (
        // Falha de UM sentido é refeita sem refazer (nem perder) o que o outro já trouxe.
        <button type="button" disabled={continuando} className="btn btn-primary mt-3" onClick={a.acao === 'continuar' || a.tipo === 'erro' ? onContinuar : onTentar}>
          {continuando ? <><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</> : a.acao === 'continuar' ? 'Continuar avaliação' : 'Tentar de novo'}
        </button>
      )}
    </div>
  );
}
