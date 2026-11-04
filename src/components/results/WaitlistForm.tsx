import { nomeDestinoParaExibicao } from '@/lib/utils';
import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { CriteriosBusca } from '@/types';
import { useVitrine } from '@/data/VitrineProvider';
import { TURNO_LABEL } from '@/lib/utils';
import { registrarInteresse } from '@/data/source';

/**
 * Lista de interesse quando não há van compatível.
 * Coleta só o necessário, com consentimento explícito.
 * - Com Supabase configurado: grava em `waitlist_requests` via RPC segura.
 * - Sem Supabase (demo): o envio é apenas simulado (não gravado).
 * NÃO promete aviso automático: ainda não há esse fluxo implementado.
 */
export function WaitlistForm({ criterios }: { criterios: CriteriosBusca }) {
  const [enviado, setEnviado] = useState(false);
  const [foiSimulacao, setFoiSimulacao] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [consent, setConsent] = useState(false);

  const { destinosPorId } = useVitrine();
  const destino = criterios.destinoId ? destinosPorId[criterios.destinoId] : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await registrarInteresse({
      cidadeId: criterios.cidadeId,
      nome,
      whatsapp,
      consentimento: consent,
      regiao: criterios.endereco || undefined,
      destinoId: criterios.destinoId,
      turno: criterios.turno,
    });
    setEnviando(false);
    if (r.ok) {
      setFoiSimulacao(!!r.demo);
      setEnviado(true);
    } else {
      setErro(r.erro ?? 'Não foi possível registrar agora. Tente novamente.');
    }
  }

  if (enviado) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        {!foiSimulacao && <CheckCircle2 className="mx-auto h-12 w-12 text-mint-500" />}
        <h3 className="mt-4 font-display text-xl font-bold">
          {foiSimulacao ? 'Cadastro disponível em breve' : 'Interesse registrado!'}
        </h3>
        <p className="mt-2 text-navy-600">
          {foiSimulacao
            ? 'Seus dados não foram enviados nem salvos. O cadastro na lista estará disponível em breve.'
            : 'Seu contato foi enviado para a equipe acompanhar a procura na sua região.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-lg p-6 sm:p-8">
      <h3 className="font-display text-xl font-bold">Quer entrar na lista de interesse?</h3>
      <p className="mt-1.5 text-sm text-navy-600">
        Deixe seu contato para {destino ? <strong>{nomeDestinoParaExibicao(destino.nome)}</strong> : 'sua região'}
        {criterios.turno && (
          <>
            {' '}
            no turno <strong>{TURNO_LABEL[criterios.turno]}</strong>
          </>
        )}
        . Registre sua procura por uma van na região.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label" htmlFor="wl-nome">
            Seu nome
          </label>
          <input
            id="wl-nome"
            className="field-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="wl-zap">
            WhatsApp para contato
          </label>
          <input
            id="wl-zap"
            className="field-input"
            placeholder="(18) 99999-0000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            inputMode="tel"
            required
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-navy-600">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-navy-300 text-mint-600"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />
          <span>
            Autorizo o Vambora a guardar meu contato apenas para me avisar sobre vans compatíveis.
            Posso pedir a remoção a qualquer momento. Não informo endereço completo do aluno aqui.
          </span>
        </label>
      </div>

      {erro && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {erro}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-sheen btn-lg btn-primary mt-6 w-full"
        disabled={!consent || enviando}
      >
        {enviando ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Enviando…
          </>
        ) : (
          'Entrar na lista de interesse'
        )}
      </button>
    </form>
  );
}

