import { useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import type { CriteriosBusca } from '@/types';
import { DESTINOS_POR_ID } from '@/data/destinos';
import { TURNO_LABEL } from '@/lib/utils';

/**
 * Lista de interesse quando não há van compatível.
 * Coleta só o necessário, com consentimento explícito. Nesta fase (Etapa 1)
 * NÃO envia para servidor — apenas confirma localmente. A gravação real virá
 * com o Supabase (tabela waitlist_requests) na Etapa 2.
 */
export function WaitlistForm({ criterios }: { criterios: CriteriosBusca }) {
  const [enviado, setEnviado] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [consent, setConsent] = useState(false);

  const destino = criterios.destinoId ? DESTINOS_POR_ID[criterios.destinoId] : null;

  if (enviado) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-mint-500" />
        <h3 className="mt-4 font-display text-xl font-bold">Interesse registrado!</h3>
        <p className="mt-2 text-navy-600">
          Assim que surgir uma van compatível na sua região, um motorista poderá te chamar. Você não
          fica preso a nada.
        </p>
        <p className="mt-4 inline-flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-left text-xs text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Protótipo: nesta versão o registro é apenas local, para demonstração. O envio real será
          ativado com o banco de dados seguro.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setEnviado(true);
      }}
      className="card mx-auto max-w-lg p-6 sm:p-8"
    >
      <h3 className="font-display text-xl font-bold">Quer entrar na lista de interesse?</h3>
      <p className="mt-1.5 text-sm text-navy-600">
        Avisamos quando uma van atender{' '}
        {destino ? <strong>{destino.nome}</strong> : 'sua região'}
        {criterios.turno && (
          <>
            {' '}
            no turno <strong>{TURNO_LABEL[criterios.turno]}</strong>
          </>
        )}
        .
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

      <button type="submit" className="btn btn-lg btn-primary mt-6 w-full" disabled={!consent}>
        Entrar na lista de interesse
      </button>
    </form>
  );
}
