import { contextoDoInteresse, linhasDoContexto } from '@/lib/contexto-interesse';
import type { CartaoRotaRealDados } from '@/lib/busca-rotas-reais-cliente';
import { nomeDestinoParaExibicao } from '@/lib/utils';
import { useState } from 'react';
import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { CriteriosBusca } from '@/types';
import { DESTINOS_POR_ID } from '@/data/destinos';
import { TURNO_LABEL } from '@/lib/utils';
import { registrarInteresse } from '@/data/source';

/**
 * Lista de interesse quando não há van compatível.
 * Coleta só o necessário, com consentimento explícito.
 * - Com Supabase configurado: grava em `waitlist_requests` via RPC segura.
 * - Sem Supabase (demo): o envio é apenas simulado (não gravado).
 * NÃO promete aviso automático: ainda não há esse fluxo implementado.
 */
export function WaitlistForm({ criterios, cartao = null }: {
  criterios: CriteriosBusca;
  /** Rota em que a família se interessou (opcional). O pedido leva o contexto
   *  dela — sentido, horários calculados e versão — e continua NÃO reservando vaga. */
  cartao?: CartaoRotaRealDados | null;
}) {
  const contexto = contextoDoInteresse(criterios, cartao);
  const [enviado, setEnviado] = useState(false);
  const [foiSimulacao, setFoiSimulacao] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [consent, setConsent] = useState(false);

  const destino = criterios.destinoId ? DESTINOS_POR_ID[criterios.destinoId] : null;

  function validar(): string | null {
    if (nome.trim().length < 2) return 'Digite seu nome.';
    const digitos = whatsapp.replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 13) return 'Digite um WhatsApp válido com DDD.';
    if (!consent) return 'Confirme o consentimento para continuar.';
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Evita envio duplicado (clique duplo ou reenvio enquanto grava).
    if (enviando || enviado) return;
    setErro(null);
    const problema = validar();
    if (problema) { setErro(problema); return; }

    setEnviando(true);
    try {
      // Espera a confirmação REAL da gravação; só então mostra sucesso.
      const r = await registrarInteresse({
        cidadeId: criterios.cidadeId,
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        consentimento: consent,
        regiao: criterios.endereco || undefined,
        destinoId: criterios.destinoId,
        turno: criterios.turno,
        // Sentido(s), horário de cada um e, se houver, a rota e as condições do encaixe.
        contexto,
      });
      if (r.ok) {
        setFoiSimulacao(!!r.demo);
        setEnviado(true);
      } else {
        setErro(r.erro ?? 'Não foi possível registrar agora. Verifique sua conexão e tente de novo.');
      }
    } catch {
      setErro('Falha de conexão. Nada foi gravado — tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-mint-500" />
        <h3 className="mt-4 font-display text-xl font-bold">
          {foiSimulacao ? 'Interesse registrado (demonstração)' : 'Interesse registrado!'}
        </h3>
        <p className="mt-2 text-navy-600">
          Seus dados ficam guardados para a equipe conectar você a um motorista quando houver uma
          rota que combine. Você não fica preso a nada.
        </p>
        <p className="mt-3 text-sm text-navy-500">
          Ainda <strong>não</strong> existe aviso automático: o contato é feito manualmente pela
          equipe/motorista. {cartao ? 'Seu interesse nesta rota ' : 'Este registro '}<strong>não reserva vaga</strong>.
        </p>
        {foiSimulacao && (
          <p className="mt-4 inline-flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-left text-xs text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Modo demonstração: este envio foi apenas <strong>simulado</strong> e não foi gravado. Com
            o banco de dados ligado, ele é gravado de verdade e com segurança.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-lg p-6 sm:p-8">
      <h3 className="font-display text-xl font-bold">{cartao ? `Tenho interesse em “${cartao.rotaNome}”` : 'Quer entrar na lista de interesse?'}</h3>
      <div className="mt-3 rounded-xl bg-navy-50 p-3 text-sm text-navy-700" data-testid="contexto-interesse">
        <p className="font-semibold">Vai junto com o seu pedido:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">{linhasDoContexto(contexto).map((l, i) => <li key={i}>{l}</li>)}</ul>
        <p className="mt-2 text-xs text-navy-500">Seu endereço não é enviado ao motorista. Este pedido <strong>não reserva vaga</strong> e nenhuma mensagem é enviada automaticamente: a equipe faz a ponte com o motorista.</p>
      </div>
      <p className="mt-1.5 text-sm text-navy-600">
        Deixe seu contato para {destino ? <strong>{nomeDestinoParaExibicao(destino.nome)}</strong> : 'sua região'}
        {criterios.turno && (
          <>
            {' '}
            no turno <strong>{TURNO_LABEL[criterios.turno]}</strong>
          </>
        )}
        . A equipe guarda seus dados para te conectar a um motorista quando houver uma rota que
        combine.
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
