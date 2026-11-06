import { Navigate, Route } from 'react-router-dom';

/**
 * FASE 2 — Navegação unificada "Vambora Motoristas" (fonte única de verdade).
 *
 * Princípios:
 *  - UMA experiência do motorista. O app OPERACIONAL REAL é `/painel/*`
 *    (cadastro de veículos, rotas, construtor, simulador). Essa é a fonte de
 *    verdade — nunca substituída pela demonstração.
 *  - `/pro` continua sendo apenas a PRÉVIA demonstrativa (Vambora Pro), acessível
 *    e claramente rotulada; não é a porta de entrada.
 *  - Fluxo: Marketplace → "Sou motorista" (`/motorista`) → entrada → autenticação
 *    existente (`/motorista/conta`) → app real (`/painel`).
 *  - Aliases canônicos são ADITIVOS: preservam todos os links antigos.
 */

/** Alvos de link da entrada (testáveis sem DOM; usados pela tela de entrada). */
export const LINKS_ENTRADA_MOTORISTA = {
  voltar: '/',
  /** Autenticação existente (login Google/e-mail); após logar vai para `/painel`. */
  entrar: '/motorista/conta',
  /** App Vambora Motoristas (experiência visual + dados reais/demo). */
  app: '/app',
  /** Painel operacional clássico (cadastro/construtor reais). */
  painel: '/painel',
  /** Demonstração com dados de exemplo (abre o app em modo demo). */
  demonstracao: '/app',
} as const;

/**
 * Redirecionamentos canônicos (aditivos). `de` → `para`.
 * Dão à identidade "Vambora Motoristas" URLs próprias sem quebrar os links atuais.
 */
export const REDIRECIONAMENTOS_MOTORISTA: ReadonlyArray<{ de: string; para: string }> = [
  { de: '/motoristas', para: '/motorista' },
  { de: '/vambora-motoristas', para: '/motorista' },
];

/** Rotas de redirecionamento, para espalhar dentro de <Routes> no App. */
export function rotasRedirecionamentoMotorista() {
  return REDIRECIONAMENTOS_MOTORISTA.map((r) => (
    <Route key={r.de} path={r.de} element={<Navigate to={r.para} replace />} />
  ));
}
