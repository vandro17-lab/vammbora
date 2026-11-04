import { Clock, AlertCircle, CheckCircle2, Gauge } from 'lucide-react';
import type { Rota, Veiculo, ParadaRota } from '@/types/motorista';
import { planejarRotaDoCadastro } from '@/lib/rota-para-motor';
import { minutosParaTextoHora } from '@/lib/utils';

/**
 * Mostra o resultado do MOTOR REAL (planejarRota) sobre a rota montada.
 * O motorista informa os minutos entre as paradas (não inventamos). Com os dados
 * completos, o motor calcula o horário de saída e a chegada em cada parada.
 * Honesto quando faltam dados: diz o que falta e NÃO afirma previsão.
 */
export function PlanoMotor({
  rota,
  setRota,
  veiculo,
}: {
  rota: Rota;
  setRota: (r: Rota) => void;
  veiculo: Veiculo | null;
}) {
  const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  // Paradas que têm "próxima" (todas menos a última) recebem o campo de minutos.
  const comProxima = ordenadas.slice(0, -1);

  function setTempo(id: string, valor: string) {
    const min = valor === '' ? null : Math.max(0, Number(valor.replace(/\D/g, '')));
    setRota({
      ...rota,
      paradas: rota.paradas.map((p) => (p.id === id ? { ...p, tempoAteProximaMin: min } : p)),
    });
  }

  const { plano, dadosFaltantes } = planejarRotaDoCadastro(rota, veiculo);
  const porId = (id: string) => ordenadas.find((p) => p.id === id);

  return (
    <div className="card mt-4 p-5">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-mint-600" />
        <h2 className="font-display font-bold">Horários da viagem (calculado pelo sistema)</h2>
      </div>

      {comProxima.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-navy-600">Quanto tempo leva de uma parada até a próxima?</p>
          {comProxima.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-navy-700">
                {rotuloCurto(p)} → {rotuloCurto(ordenadas[i + 1])}
              </span>
              <input
                className="h-9 w-20 rounded-lg border border-navy-200 px-2 text-center"
                inputMode="numeric"
                placeholder="min"
                value={p.tempoAteProximaMin ?? ''}
                onChange={(e) => setTempo(p.id, e.target.value)}
                aria-label={`Minutos de ${rotuloCurto(p)} até a próxima`}
              />
              <span className="text-navy-400">min</span>
            </div>
          ))}
        </div>
      )}

      {plano?.valido ? (
        <div className="mt-4 rounded-xl bg-mint-50 p-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-mint-800">
            <CheckCircle2 className="h-4 w-4" /> Plano calculado pelo motor de compatibilidade
          </p>
          {plano.saida != null && (
            <p className="mt-1 text-sm text-navy-700">
              Horário de saída sugerido: <strong>{minutosParaTextoHora(plano.saida)}</strong>
            </p>
          )}
          <ul className="mt-2 space-y-1 text-sm text-navy-600">
            {plano.paradas.map((pp) => (
              <li key={pp.id} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-navy-400" />
                  {porId(pp.id) ? rotuloCurto(porId(pp.id)!) : pp.id}
                </span>
                <span className="font-medium text-navy-800">chega {minutosParaTextoHora(pp.chegada)}</span>
              </li>
            ))}
          </ul>
          {plano.alertas.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">{plano.alertas.join(' · ')}</p>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <p className="inline-flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-4 w-4" /> Ainda não dá para calcular os horários
          </p>
          <ul className="mt-1 list-disc pl-5">
            {dadosFaltantes.slice(0, 4).map((m, i) => <li key={i}>{m}</li>)}
          </ul>
          <p className="mt-2 text-xs">Você pode salvar a rota assim mesmo — o cálculo entra quando os dados estiverem completos.</p>
        </div>
      )}
    </div>
  );
}

function rotuloCurto(p: ParadaRota): string {
  if (p.tipo === 'saida') return 'Saída';
  if (p.tipo === 'escola') return p.destinoNome || 'Escola';
  return p.rotulo || 'Casa';
}
