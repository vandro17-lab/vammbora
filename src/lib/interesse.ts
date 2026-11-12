/**
 * PRÉ-LANÇAMENTO — regras do cadastro de interesse (motorista e família).
 *
 * Fonte ÚNICA de máscara, normalização e validação: o formulário (navegador) e
 * o endpoint /api/interesse (servidor) usam exatamente estas funções. O banco
 * repete as regras essenciais (função registrar_interesse_lancamento + CHECKs).
 *
 * Módulo puro: sem React, sem DOM, sem rede.
 */

/** Versão da Política de Privacidade aceita no envio (gravada com o consentimento). */
export const POLITICA_PRIVACIDADE_VERSAO = '2026-11-11';

/** Campo-isca do formulário: invisível para pessoas; robôs que preenchem tudo caem nele. */
export const CAMPO_ISCA = 'vb_confirmacao';

export const ROTAS_PRE_LANCAMENTO = {
  inicio: '/',
  motorista: '/interesse/motorista',
  familia: '/interesse/familia',
  privacidade: '/privacidade',
} as const;

export type TipoInteresse = 'motorista' | 'familia';
export type Periodo = 'manha' | 'tarde' | 'noite';
export type TipoTransporte = 'ida' | 'volta' | 'ida_volta';

export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'manha', rotulo: 'Manhã' },
  { valor: 'tarde', rotulo: 'Tarde' },
  { valor: 'noite', rotulo: 'Noite' },
];
export const TIPOS_TRANSPORTE: { valor: TipoTransporte; rotulo: string }[] = [
  { valor: 'ida', rotulo: 'Ida' },
  { valor: 'volta', rotulo: 'Volta' },
  { valor: 'ida_volta', rotulo: 'Ida e volta' },
];

/** Cidade inicial do lançamento (o formulário não pede cidade nesta fase). */
export const CIDADE_LANCAMENTO = { cidade: 'Araçatuba', uf: 'SP' } as const;

/** Campos do formulário, como o usuário os digita. */
export interface DadosInteresse {
  nome: string;
  whatsapp: string;
  email: string;
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
  escola: string;
  periodo: string;
  transporte: string;
  consentimento: boolean;
}
export type CampoInteresse = keyof DadosInteresse;
export type ErrosInteresse = Partial<Record<CampoInteresse, string>>;

export const DADOS_VAZIOS: DadosInteresse = {
  nome: '', whatsapp: '', email: '', rua: '', numero: '', bairro: '', complemento: '',
  escola: '', periodo: '', transporte: '', consentimento: false,
};

/** O que segue para o banco (nomes das colunas de prelaunch_leads). */
export interface PayloadInteresse {
  lead_type: TipoInteresse;
  full_name: string;
  whatsapp_e164: string;
  email: string | null;
  street_address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  address_complement: string | null;
  city: string | null;
  state: string | null;
  school_name: string | null;
  school_shift: Periodo | null;
  transport_direction: TipoTransporte | null;
  consent_accepted: true;
  privacy_policy_version: string;
  source: string;
}

/* ------------------------------ texto ------------------------------ */

/** Remove espaços nas pontas e reduz sequências de espaços a um só. */
export function limparTexto(valor: unknown): string {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : '';
}

/* ----------------------------- WhatsApp ----------------------------- */

/** DDDs em uso no Brasil (Anatel). */
export const DDDS_VALIDOS: ReadonlySet<string> = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

/**
 * Dígitos nacionais (DDD + número), no máximo 11. Aceita colar com pontuação,
 * com "+55"/"55" na frente e com o "0" de operadora antes do DDD.
 */
export function digitosNacionais(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  const comMais = valor.trim().startsWith('+');
  let d = valor.replace(/\D/g, '').slice(0, 14);
  if (comMais && d.startsWith('55')) d = d.slice(2);
  else if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length > 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 11);
}

/** Máscara visual progressiva: "(DD) 9XXXX-XXXX". Nunca devolve letras. */
export function mascararWhatsApp(valor: unknown): string {
  const d = digitosNacionais(valor);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Celular brasileiro em E.164 ("+55DD9XXXXXXXX") ou null se inválido.
 * Exige 11 dígitos, DDD existente e o 9 inicial do celular.
 */
export function normalizarWhatsApp(valor: unknown): string | null {
  const d = digitosNacionais(valor);
  if (d.length !== 11) return null;
  if (!DDDS_VALIDOS.has(d.slice(0, 2))) return null;
  if (d[2] !== '9') return null;
  if (/^(\d)\1{8}$/.test(d.slice(2))) return null; // 9 dígitos iguais: não é número real
  return `+55${d}`;
}

/** Mensagem específica para o erro de WhatsApp (ou null se estiver válido). */
export function erroWhatsApp(valor: unknown): string | null {
  const d = digitosNacionais(valor);
  if (d.length === 0) return 'Informe seu WhatsApp com DDD.';
  if (d.length < 11) return 'Número incompleto. Use DDD + 9 dígitos, ex.: (18) 99999-9999.';
  if (!DDDS_VALIDOS.has(d.slice(0, 2))) return 'DDD inválido. Confira os dois primeiros dígitos.';
  if (d[2] !== '9') return 'Informe um celular: depois do DDD o número começa com 9.';
  if (normalizarWhatsApp(valor) === null) return 'Número inválido. Confira o WhatsApp informado.';
  return null;
}

/* ------------------------------ e-mail ------------------------------ */

export function emailValido(valor: string): boolean {
  if (valor.length < 6 || valor.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(valor)) return false;
  const [local, dominio] = valor.split('@');
  if (local.length > 64) return false;
  if (valor.includes('..') || local.startsWith('.') || local.endsWith('.')) return false;
  if (dominio.startsWith('.') || dominio.startsWith('-')) return false;
  return true;
}

/* ------------------------------ campos ------------------------------ */

const NOME_PERMITIDO = /^[\p{L}][\p{L}\p{M}'’.\- ]*$/u;

function erroNome(nome: string): string | null {
  if (!nome) return 'Informe seu nome completo.';
  if (nome.length < 5) return 'Nome muito curto. Informe nome e sobrenome.';
  if (nome.length > 120) return 'Nome muito longo (máximo de 120 caracteres).';
  if (!NOME_PERMITIDO.test(nome)) return 'Use apenas letras no nome.';
  if (nome.split(' ').filter((p) => p.replace(/[^\p{L}]/gu, '').length >= 2).length < 2) {
    return 'Informe nome e sobrenome.';
  }
  return null;
}

/** Número do endereço: "123", "123A" ou "S/N" (devolve normalizado) — null se inválido. */
export function normalizarNumeroEndereco(valor: unknown): string | null {
  const v = limparTexto(valor).toUpperCase().replace(/\s/g, '');
  if (/^S\/?N$/.test(v)) return 'S/N';
  if (/^\d{1,6}[A-Z]?$/.test(v)) return v;
  return null;
}

const ehPeriodo = (v: unknown): v is Periodo => v === 'manha' || v === 'tarde' || v === 'noite';
const ehTransporte = (v: unknown): v is TipoTransporte => v === 'ida' || v === 'volta' || v === 'ida_volta';
export const ehTipoInteresse = (v: unknown): v is TipoInteresse => v === 'motorista' || v === 'familia';

export type ResultadoValidacao =
  | { ok: true; payload: PayloadInteresse }
  | { ok: false; erros: ErrosInteresse };

/**
 * Valida e normaliza um envio. Aceita entrada não confiável (o servidor chama
 * com o JSON recebido): qualquer coisa que não seja texto vira campo vazio.
 */
export function validarInteresse(tipo: TipoInteresse, entrada: unknown): ResultadoValidacao {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  const erros: ErrosInteresse = {};

  const nome = limparTexto(e.nome);
  const eNome = erroNome(nome);
  if (eNome) erros.nome = eNome;

  const whatsapp = normalizarWhatsApp(e.whatsapp);
  const eWhats = erroWhatsApp(e.whatsapp);
  if (eWhats) erros.whatsapp = eWhats;

  // E-mail é opcional: só valida quando preenchido.
  const email = limparTexto(e.email).toLowerCase();
  if (email && !emailValido(email)) erros.email = 'E-mail inválido. Confira ou deixe em branco.';

  let rua: string | null = null, numero: string | null = null, bairro: string | null = null;
  let complemento: string | null = null, escola: string | null = null;
  let periodo: Periodo | null = null, transporte: TipoTransporte | null = null;

  if (tipo === 'familia') {
    rua = limparTexto(e.rua);
    if (!rua) erros.rua = 'Informe a rua ou avenida do embarque.';
    else if (rua.length < 3) erros.rua = 'Endereço muito curto.';
    else if (rua.length > 120) erros.rua = 'Endereço muito longo (máximo de 120 caracteres).';

    numero = normalizarNumeroEndereco(e.numero);
    if (!limparTexto(e.numero)) erros.numero = 'Informe o número (ou S/N).';
    else if (!numero) erros.numero = 'Número inválido. Ex.: 123, 123A ou S/N.';

    bairro = limparTexto(e.bairro);
    if (!bairro) erros.bairro = 'Informe o bairro.';
    else if (bairro.length < 2) erros.bairro = 'Bairro muito curto.';
    else if (bairro.length > 80) erros.bairro = 'Bairro muito longo (máximo de 80 caracteres).';

    complemento = limparTexto(e.complemento) || null;
    if (complemento && complemento.length > 80) erros.complemento = 'Complemento muito longo (máximo de 80 caracteres).';

    escola = limparTexto(e.escola);
    if (!escola) erros.escola = 'Informe o nome da escola.';
    else if (escola.length < 3) erros.escola = 'Nome da escola muito curto.';
    else if (escola.length > 120) erros.escola = 'Nome da escola muito longo (máximo de 120 caracteres).';

    if (ehPeriodo(e.periodo)) periodo = e.periodo;
    else erros.periodo = 'Escolha o período.';

    // Tipo de transporte é opcional.
    if (ehTransporte(e.transporte)) transporte = e.transporte;
    else if (limparTexto(e.transporte)) erros.transporte = 'Opção inválida.';
  }

  if (e.consentimento !== true) erros.consentimento = 'Para continuar, é preciso marcar o consentimento.';

  if (Object.keys(erros).length > 0 || !whatsapp) return { ok: false, erros };

  const familia = tipo === 'familia';
  return {
    ok: true,
    payload: {
      lead_type: tipo,
      full_name: nome,
      whatsapp_e164: whatsapp,
      email: email || null,
      street_address: familia ? rua : null,
      address_number: familia ? numero : null,
      neighborhood: familia ? bairro : null,
      address_complement: familia ? complemento : null,
      city: familia ? CIDADE_LANCAMENTO.cidade : null,
      state: familia ? CIDADE_LANCAMENTO.uf : null,
      school_name: familia ? escola : null,
      school_shift: familia ? periodo : null,
      transport_direction: familia ? transporte : null,
      consent_accepted: true,
      privacy_policy_version: POLITICA_PRIVACIDADE_VERSAO,
      source: 'site',
    },
  };
}

/** Ordem dos campos na tela (para focar o primeiro com erro). */
export const ORDEM_CAMPOS: CampoInteresse[] = [
  'nome', 'whatsapp', 'email', 'rua', 'numero', 'bairro', 'complemento',
  'escola', 'periodo', 'transporte', 'consentimento',
];
