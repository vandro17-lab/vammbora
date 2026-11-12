/**
 * PERFIL PROFISSIONAL DO MOTORISTA — regras puras (sem banco, sem tela).
 *
 * As mesmas regras são conferidas de novo no servidor pela RPC
 * `salvar_perfil_motorista` (migração 20261112205224): aqui servem para
 * avisar cedo, em linguagem simples, e para montar o rascunho do formulário.
 */

export const NOME_MIN = 2;
export const NOME_MAX = 60;
export const APRESENTACAO_MAX = 600;

/** Exemplo de ajuda (Documento Mestre §5.2). Só aparece como dica, nunca é gravado. */
export const EXEMPLO_APRESENTACAO =
  'Olá! Sou o Tio João e trabalho com transporte escolar há 15 anos. Atendo escolas de Araçatuba e gosto de manter uma boa comunicação com as famílias.';

export type EtapaPerfil = 'nome' | 'apresentacao' | 'contato' | 'revisao';

export const ETAPAS_PERFIL: { id: EtapaPerfil; nome: string }[] = [
  { id: 'nome', nome: 'Nome' },
  { id: 'apresentacao', nome: 'Apresentação' },
  { id: 'contato', nome: 'Contato' },
  { id: 'revisao', nome: 'Revisão' },
];

/** O que o motorista preenche no formulário. */
export interface RascunhoPerfil {
  nome: string;
  cidadeId: string;
  apresentacao: string;
  /** WhatsApp OBRIGATÓRIO, privado (como o motorista digitou, com ou sem máscara). */
  whatsapp: string;
  /** Escolha separada: famílias podem tocar em "Conversar no WhatsApp" no
   *  perfil publicado. Desligada por padrão. */
  contatoDireto: boolean;
}

export const apenasDigitos = (s: string): string => (s ?? '').replace(/\D/g, '');

/**
 * Celular brasileiro → formato internacional sem "+" (55 + DDD + 9 + 8 dígitos).
 * Aceita com ou sem o 55 e com qualquer máscara. Inválido → null.
 */
export function normalizarWhatsapp(texto: string): string | null {
  let d = apenasDigitos(texto);
  if (/^[1-9][1-9]9\d{8}$/.test(d)) d = `55${d}`;
  return /^55[1-9][1-9]9\d{8}$/.test(d) ? d : null;
}

/** Máscara progressiva "(DD) 9XXXX-XXXX" enquanto o motorista digita. */
export function mascararWhatsapp(texto: string): string {
  let d = apenasDigitos(texto);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Problema da etapa, em linguagem simples; null = pode continuar. */
export function validarEtapa(etapa: EtapaPerfil, r: RascunhoPerfil): string | null {
  if (etapa === 'nome') {
    const nome = r.nome.trim();
    if (nome.length < NOME_MIN) return 'Escreva como as famílias vão chamar você (pelo menos 2 letras).';
    if (nome.length > NOME_MAX) return `O nome pode ter no máximo ${NOME_MAX} letras.`;
    if (!r.cidadeId) return 'Escolha a cidade onde você atende.';
  }
  if (etapa === 'apresentacao' && r.apresentacao.trim().length > APRESENTACAO_MAX) {
    return `A apresentação pode ter no máximo ${APRESENTACAO_MAX} caracteres.`;
  }
  if (etapa === 'contato') {
    if (!apenasDigitos(r.whatsapp)) return 'Informe o seu WhatsApp (com DDD).';
    if (!normalizarWhatsapp(r.whatsapp)) return 'Confira o WhatsApp: DDD e número de celular, como (18) 99999-0000.';
  }
  return null;
}

/** Primeira etapa com problema (para a revisão levar o motorista até ela). */
export function primeiraEtapaComProblema(r: RascunhoPerfil): { etapa: EtapaPerfil; erro: string } | null {
  for (const { id } of ETAPAS_PERFIL) {
    const erro = validarEtapa(id, r);
    if (erro) return { etapa: id, erro };
  }
  return null;
}

/** Rascunho inicial: perfil salvo, ou dados da conta para começar. */
export function rascunhoInicial(
  perfil: { nome: string; cidadeId: string; descricao: string | null; whatsapp: string | null; contatoWhatsappAtivo: boolean } | null,
  conta: { nome?: string | null; cidadeId: string },
): RascunhoPerfil {
  if (perfil) {
    return {
      nome: perfil.nome,
      cidadeId: perfil.cidadeId,
      apresentacao: perfil.descricao ?? '',
      whatsapp: perfil.whatsapp ? mascararWhatsapp(perfil.whatsapp) : '',
      contatoDireto: !!perfil.contatoWhatsappAtivo,
    };
  }
  return { nome: (conta.nome ?? '').trim().slice(0, NOME_MAX), cidadeId: conta.cidadeId, apresentacao: '', whatsapp: '', contatoDireto: false };
}

/** Situação do perfil diante da vitrine (vinda do servidor). */
export interface SituacaoPublicacao {
  temPerfil: boolean;
  anuncioAtivo: boolean;
  suspenso: boolean;
  visivel: boolean;
  /** Rotas concluídas, não pausadas, com van própria: as que a busca AVALIA.
   *  Não são vagas: quem decide vaga e encaixe é o motor, a cada busca. */
  rotasDisponiveis: number;
}

export interface ItemPublicacao { id: 'perfil' | 'publicado'; texto: string; feito: boolean }

/**
 * O que é preciso para o PERFIL aparecer às famílias (mesma regra de
 * `motorista_elegivel` no servidor). Documentos e rotas NÃO são exigidos.
 */
export function itensDePublicacao(s: SituacaoPublicacao): ItemPublicacao[] {
  return [
    { id: 'perfil', texto: 'Perfil profissional preenchido', feito: s.temPerfil },
    { id: 'publicado', texto: 'Perfil publicado', feito: s.anuncioAtivo },
  ];
}

/** Frase única e honesta sobre a visibilidade do perfil. */
export function textoDaSituacao(s: SituacaoPublicacao): string {
  if (!s.temPerfil) return 'Crie seu perfil profissional para poder aparecer às famílias.';
  if (s.suspenso) return 'Seu perfil está suspenso pela equipe VanBora e não aparece às famílias.';
  if (s.visivel) return 'Seu perfil está visível para as famílias.';
  if (!s.anuncioAtivo) return 'Seu perfil ainda não aparece. Toque em “Publicar perfil” quando quiser.';
  return 'Seu perfil ainda não aparece às famílias.';
}

/** Frase sobre as rotas oferecidas (sem inventar vagas). */
export function textoDasRotas(n: number): string {
  if (n <= 0) return 'No momento, nenhuma rota sua está disponível na busca. Conclua uma rota ou retome uma oferta pausada.';
  return `${n === 1 ? '1 rota disponível' : `${n} rotas disponíveis`} na busca. Só aparece${n === 1 ? '' : 'm'} para famílias que cabem no trajeto, no horário e nas vagas.`;
}
