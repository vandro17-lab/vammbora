import { useState } from 'react';
import { Sparkles, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Rota, Veiculo } from '@/types/motorista';
import type { MatrizViaria, PontoGeo } from '@/engine/encaixe-geografico';
import { obterMatrizViaria, FalhaMatriz } from '@/lib/matriz-viaria';
import { criarMatrizDemo } from '@/lib/encaixe';
import { sugerirRotaDoCadastro, type SugestaoDoCadastro } from '@/lib/otimizacao-rota';
import { minutosParaTextoHora } from '@/lib/utils';

/**
 * VanBora 2.0 — sugestão de uma ordem melhor para as paradas, comparada à rota
 * atual. Somente leitura: NUNCA altera a rota cadastrada; o motorista decide.
 */
export function SugestaoRotaMelhor({ rota, veiculo }: { rota: Rota; veiculo: Veiculo | null }) {
  const [estado, setEstado] = useState<'ocioso' | 'calculando' | 'pronto'>('ocioso');
  const [res, setRes] = useState<SugestaoDoCadastro | null>(null);
  const [estimativa, setEstimativa] = useState(false);

  async function calcular() {
    setEstado('calculando');
    const pontos: PontoGeo[] = [];
    for (const p of rota.paradas) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
      const id = p.tipo === 'escola' && p.destinoId ? p.destinoId : p.id;
      if (!pontos.some((x) => x.id === id)) pontos.push({ id, nome: p.rotulo, lat: p.lat, lng: p.lng });
    }
    let matriz: MatrizViaria;
    let aproximada = false;
    try {
      matriz = await obterMatrizViaria(pontos);
    } catch (e) {
      if (!(e instanceof FalhaMatriz)) { setRes({ sugestao: null, exigeCombinarHorarios: false, paradas: [], alunosComHorarioAlterado: 0, maiorMudancaMin: 0, motivo: 'Não foi possível calcular agora. Tente novamente.' }); setEstado('pronto'); return; }
      // Sem trajetos reais (demonstração/sem sessão): estimativa por distância, identificada como tal.
      matriz = criarMatrizDemo();
      aproximada = true;
    }
    setEstimativa(aproximada);
    setRes(sugerirRotaDoCadastro(rota, veiculo, matriz));
    setEstado('pronto');
  }

  const s = res?.sugestao ?? null;
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
      <p className="inline-flex items-center gap-2 font-display font-bold text-navy-900">
        <Sparkles className="h-4 w-4 text-mint-600" /> Sugestão de rota melhor
      </p>
      <p className="mt-0.5 text-xs leading-snug text-navy-500">
        Compara a ordem atual das paradas com a melhor ordem possível, sem perder o horário das escolas nem o combinado com as famílias. Sua rota não é alterada.
      </p>

      {estado !== 'pronto' && (
        <button onClick={calcular} disabled={estado === 'calculando'} className="btn btn-primary mt-3 w-full disabled:opacity-60">
          {estado === 'calculando' ? 'Calculando…' : 'Ver sugestão'}
        </button>
      )}

      {estado === 'pronto' && res && !s && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{res.motivo}</p>
      )}

      {estado === 'pronto' && s && !s.melhorou && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-mint-50 p-3 text-xs font-semibold text-mint-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {s.motivo ?? (s.provadoOtimo
            ? 'Sua rota já está na melhor ordem possível.'
            : 'Não encontramos uma ordem melhor que a atual.')}
        </p>
      )}

      {estado === 'pronto' && s?.melhorou && res && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-navy-50 p-3">
              <p className="text-[11px] text-navy-500">Rota atual</p>
              <p className="font-display text-lg font-extrabold text-navy-900">{s.antes.duracaoMin} min</p>
              <p className="text-[11px] text-navy-500">{(s.antes.metros / 1000).toFixed(1).replace('.', ',')} km · sai {minutosParaTextoHora(s.antes.partidaMin)}</p>
            </div>
            <div className="rounded-2xl bg-mint-50 p-3">
              <p className="text-[11px] text-mint-700">Sugestão</p>
              <p className="font-display text-lg font-extrabold text-mint-800">{s.depois.duracaoMin} min</p>
              <p className="text-[11px] text-mint-700">{(s.depois.metros / 1000).toFixed(1).replace('.', ',')} km · sai {minutosParaTextoHora(s.depois.partidaMin)}</p>
            </div>
          </div>
          <p className="text-sm font-semibold text-navy-800">
            Economia de {s.economiaMin} min{s.economiaMetros > 0 ? ` e ${(s.economiaMetros / 1000).toFixed(1).replace('.', ',')} km` : ''} por viagem.
          </p>
          <ol className="divide-y divide-navy-50 rounded-2xl ring-1 ring-navy-100">
            {res.paradas.map((p, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint-100 text-[11px] font-bold text-mint-700">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-navy-700">{p.nome}</span>
                <span className="shrink-0 text-xs tabular-nums text-navy-500">
                  {p.antesMin != null && p.antesMin !== p.chegadaMin && <>{minutosParaTextoHora(p.antesMin)} <ArrowRight className="inline h-3 w-3" /> </>}
                  <strong className="text-navy-800">{minutosParaTextoHora(p.chegadaMin)}</strong>
                </span>
              </li>
            ))}
          </ol>
          <p className={res.exigeCombinarHorarios ? 'rounded-xl bg-amber-50 p-3 text-xs text-amber-900' : 'rounded-xl bg-navy-50 p-3 text-xs text-navy-600'}>
            {res.exigeCombinarHorarios
              ? `Atenção: esta ordem muda o horário de ${res.alunosComHorarioAlterado} aluno(s) em até ${res.maiorMudancaMin} min — além do combinado. Só adote depois de combinar com as famílias. Os horários das escolas continuam atendidos.`
              : res.alunosComHorarioAlterado > 0
                ? `${res.alunosComHorarioAlterado} aluno(s) mudam de horário em até ${res.maiorMudancaMin} min, dentro do combinado. Horários das escolas atendidos.`
                : 'Nenhum aluno muda de horário. Horários das escolas atendidos.'}
            {' '}{s.provadoOtimo ? 'Todas as ordens possíveis foram testadas.' : ''}
          </p>
          <p className="text-[11px] leading-snug text-navy-400">
            {estimativa ? 'Tempos estimados pela distância (sem trajeto real das ruas) — use como indicação. ' : 'Tempos pelos trajetos reais das ruas (estimativa, não garantia de trânsito). '}
            Para adotar, reordene as paradas em "Editar rota".
          </p>
        </div>
      )}
    </div>
  );
}
