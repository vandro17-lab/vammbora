import { useEffect, type ReactNode } from 'react';
import { POLITICA_PRIVACIDADE_VERSAO } from '@/lib/interesse';
import { CONTROLADOR_PRIVACIDADE, controladorCompleto } from '@/lib/controlador-privacidade';
import { PaginaPublica } from './PaginaPublica';

function dataPorExtenso(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${d} de ${meses[m - 1]} de ${a}`;
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-extrabold tracking-tight">{titulo}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-neutral-800">{children}</div>
    </section>
  );
}

/** Política de Privacidade do pré-lançamento — pública, sem login. */
export function PrivacidadePage() {
  useEffect(() => { document.title = 'Política de Privacidade — VanBora'; }, []);
  const c = CONTROLADOR_PRIVACIDADE;
  const lista = 'list-disc space-y-1.5 pl-5';

  return (
    <PaginaPublica voltar>
      <article className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
        <div className="rounded-3xl bg-white p-6 shadow-[0_10px_30px_rgb(0_0_0/0.08)] ring-1 ring-black/5 sm:p-10">
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Versão {POLITICA_PRIVACIDADE_VERSAO} · Última atualização: {dataPorExtenso(POLITICA_PRIVACIDADE_VERSAO)}.
          </p>

          <div className="mt-6 space-y-3 text-base leading-relaxed text-neutral-800">
            <p>
              O VanBora é uma plataforma de transporte escolar em desenvolvimento, com lançamento inicial previsto para
              Araçatuba/SP. O aplicativo <strong>ainda não foi lançado</strong>. Nesta fase, coletamos apenas
              manifestações de interesse de motoristas de transporte escolar e de famílias que procuram esse serviço.
            </p>
            <p>
              Esta política explica quais dados pessoais tratamos nesses cadastros de interesse, para quê, por quanto
              tempo e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </div>

          <Secao titulo="1. Quais dados coletamos">
            <p><strong>Cadastro de interesse de motoristas:</strong></p>
            <ul className={lista}>
              <li>nome completo;</li>
              <li>número de WhatsApp;</li>
              <li>e-mail (opcional).</li>
            </ul>
            <p><strong>Cadastro de interesse de famílias:</strong></p>
            <ul className={lista}>
              <li>nome completo do responsável;</li>
              <li>número de WhatsApp;</li>
              <li>e-mail (opcional);</li>
              <li>endereço de embarque (rua ou avenida, número, bairro e, se informado, complemento), em Araçatuba/SP;</li>
              <li>nome da escola de destino, período (manhã, tarde ou noite) e, se informado, tipo de transporte (ida, volta ou ida e volta).</li>
            </ul>
            <p>
              Não pedimos CPF, documentos, nome ou data de nascimento da criança, nem localização do aparelho. Pedimos
              que esses dados não sejam incluídos nos campos de texto livre.
            </p>
            <p>
              <strong>Registro do consentimento:</strong> guardamos a data e a hora em que você aceitou esta política e a
              versão aceita.
            </p>
            <p>
              <strong>Dados técnicos de segurança:</strong> para evitar envios automáticos e abuso do formulário,
              registramos por até 24 horas um identificador técnico derivado do endereço IP (um código que não permite
              ler o IP) e o horário do envio. Nosso provedor de hospedagem também pode manter registros técnicos de
              acesso.
            </p>
            <p>
              Interessados que chegam por formulários de anúncios (por exemplo, da Meta) têm nome, telefone/WhatsApp e
              respostas daquele formulário tratados para as mesmas finalidades descritas aqui.
            </p>
          </Secao>

          <Secao titulo="2. Para que usamos os dados">
            <ul className={lista}>
              <li>manter a lista de interessados no lançamento do VanBora;</li>
              <li>entrar em contato, pelo WhatsApp ou e-mail informado, com novidades sobre o lançamento, a disponibilidade do serviço e o futuro cadastro;</li>
              <li>no caso das famílias, entender onde há procura (bairros, escolas e períodos) para planejar o início da operação;</li>
              <li>prevenir fraudes e abusos no formulário.</li>
            </ul>
            <p>
              A base legal é o seu <strong>consentimento</strong> (art. 7º, I, da LGPD), dado ao marcar a caixa de
              concordância no formulário, e o legítimo interesse na proteção do serviço contra abuso (art. 7º, IX).
            </p>
            <p>
              Registrar interesse não cria conta, não contrata transporte, não reserva vaga e não garante atendimento.
              Não enviamos mensagens automáticas neste momento: o contato, quando ocorrer, será feito pela equipe.
            </p>
          </Secao>

          <Secao titulo="3. Com quem compartilhamos">
            <p>Não vendemos nem alugamos dados pessoais. Os dados podem ser acessados apenas por:</p>
            <ul className={lista}>
              <li>a equipe do VanBora autorizada a administrar os cadastros;</li>
              <li>prestadores de serviço necessários ao funcionamento do site e do banco de dados — hospedagem do site (Vercel) e banco de dados (Supabase) —, que tratam os dados em nosso nome;</li>
              <li>plataformas de anúncios (como a Meta), apenas em relação aos formulários preenchidos nelas;</li>
              <li>autoridades públicas, quando houver obrigação legal ou ordem judicial.</li>
            </ul>
            <p>
              Nesta fase de pré-lançamento, os dados das famílias <strong>não são repassados a motoristas</strong>, e os
              dados dos motoristas não são repassados a famílias. Esses prestadores podem armazenar dados em servidores
              fora do Brasil, observadas as garantias previstas na LGPD.
            </p>
          </Secao>

          <Secao titulo="4. Armazenamento e segurança">
            <ul className={lista}>
              <li>os cadastros ficam em banco de dados com acesso restrito: não há consulta ou listagem pública;</li>
              <li>o envio do formulário é feito por conexão criptografada (HTTPS) e validado no servidor;</li>
              <li>somente administradores autenticados e autorizados visualizam os cadastros;</li>
              <li>aplicamos limites de envio para reduzir abuso.</li>
            </ul>
            <p>Nenhum sistema é totalmente imune a incidentes. Se ocorrer um incidente relevante com seus dados, comunicaremos conforme a LGPD.</p>
          </Secao>

          <Secao titulo="5. Por quanto tempo guardamos">
            <p>
              Mantemos os cadastros de interesse enquanto durar o pré-lançamento e pelo período necessário para avisar
              sobre o início do serviço, ou até que você peça a exclusão ou retire o consentimento — o que ocorrer
              primeiro. Dados técnicos de segurança do formulário são apagados em até 24 horas. Podemos manter
              informações estritamente necessárias para cumprir obrigações legais ou exercer direitos.
            </p>
          </Secao>

          <Secao titulo="6. Seus direitos">
            <p>Você pode, a qualquer momento e sem custo:</p>
            <ul className={lista}>
              <li>confirmar se tratamos seus dados e pedir acesso a eles;</li>
              <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>pedir a exclusão dos dados e retirar o consentimento;</li>
              <li>pedir que paremos de enviar mensagens;</li>
              <li>saber com quem os dados foram compartilhados;</li>
              <li>pedir a portabilidade, nos termos da regulamentação;</li>
              <li>apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
            </ul>
            <p>Para exercer esses direitos, use o canal indicado abaixo. Podemos pedir informações para confirmar que o pedido é do titular.</p>
          </Secao>

          <Secao titulo="7. Crianças e adolescentes">
            <p>
              Os formulários são destinados a adultos (motoristas e responsáveis). Não coletamos dados de identificação
              de crianças. O endereço de embarque e a escola são informados pelo responsável apenas para indicar a
              necessidade de transporte.
            </p>
          </Secao>

          <Secao titulo="8. Responsável pelo tratamento e contato">
            {controladorCompleto(c) ? (
              <>
                <p>
                  <strong>Responsável (controlador):</strong> {c.nome}{c.documento ? ` — ${c.documento}` : ''}{c.localidade ? `, ${c.localidade}` : ''}.
                </p>
                <p><strong>Canal para solicitações de privacidade:</strong> {c.canalContato}</p>
              </>
            ) : (
              <div role="note" className="rounded-2xl border-2 border-dashed border-black bg-[#FFC700]/25 p-4">
                <p className="font-bold">ATENÇÃO — PREENCHER ANTES DE PUBLICAR</p>
                <p className="mt-1">Faltam informações que só o responsável pelo VanBora pode fornecer:</p>
                <ul className={`${lista} mt-2`}>
                  <li>nome completo ou razão social do responsável pelo tratamento (e CPF/CNPJ, se aplicável);</li>
                  <li>canal real (e-mail) para solicitações de privacidade.</li>
                </ul>
              </div>
            )}
          </Secao>

          <Secao titulo="9. Alterações desta política">
            <p>
              Esta política pode ser atualizada. A versão vigente fica sempre nesta página, com a data da última
              atualização. A versão aceita por você fica registrada junto ao seu cadastro.
            </p>
          </Secao>

          <p className="mt-8 text-sm text-neutral-600">
            Esta página não representa abertura de cadastro de vans, contratação de transporte nem promessa de
            lançamento em data específica.
          </p>
        </div>
      </article>
    </PaginaPublica>
  );
}
