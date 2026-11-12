/**
 * Identificação do RESPONSÁVEL pelo tratamento de dados (controlador) e canal
 * de privacidade exibidos na Política de Privacidade.
 *
 * ATENÇÃO — PREENCHER ANTES DE PUBLICAR EM PRODUÇÃO.
 * Estes dados não podem ser inventados: precisam ser fornecidos pelo
 * responsável pelo VanBora. Enquanto estiverem `null`, a página /privacidade
 * mostra um aviso visível de pendência.
 */
export const CONTROLADOR_PRIVACIDADE: {
  /** Nome completo (pessoa física) ou razão social. */
  nome: string | null;
  /** CPF/CNPJ — opcional, recomendável para pessoa jurídica. */
  documento: string | null;
  /** Cidade/UF do responsável. */
  localidade: string | null;
  /** E-mail (ou outro canal real) para pedidos de privacidade. */
  canalContato: string | null;
} = {
  nome: null,
  documento: null,
  localidade: null,
  canalContato: null,
};

export const controladorCompleto = (c = CONTROLADOR_PRIVACIDADE) => !!c.nome && !!c.canalContato;
