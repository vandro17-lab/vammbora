# 01 — Auditoria da Arquitetura

Verificado em `main` (`011fb14`). Caminhos reais do repositório.

## Stack
- **React 18 + Vite** (SPA), **React Router** (`BrowserRouter`), **TypeScript** estrito.
- **Tailwind 3.4** (tema custom: cores `navy`, `mint`, `amber` em `tailwind.config`).
- **PWA** via `vite-plugin-pwa` (`src/pwa/*`, `generateSW`, precache ~20 entradas).
- **Supabase JS** (`src/lib/supabase.ts`) — ativado por `VITE_USE_SUPABASE`/`VITE_SUPABASE_URL`.
- **Leaflet** (mapas, sem chave) + proxy serverless **Geoapify** (`api/mapas.ts`).
- **Vitest** (209 testes na linha do PR #14; 156–199 conforme a branch).

## Rotas (`src/App.tsx`) — fonte única de navegação
Providers na raiz: `AuthProvider` → `VitrineProvider` → `StartupExperience`.
Público (dentro de `Layout`):
- `/` `HomePage` · `/resultados` `SearchResultsPage` · `/van/:slug` `DriverProfilePage` · `/motorista` `DriverLandingPage` (landing "sou motorista") · `*` `NotFoundPage`
Admin (fora do layout): `/admin/login`, `/admin`.
**Motorista real (`/painel`, chrome próprio `MotoristaShell`):**
- `/motorista/conta` `ContaMotoristaPage` (login/cadastro do motorista)
- `/painel` `PainelMotoristaPage` (dashboard)
- `/painel/veiculos` `VeiculosPage` · `/painel/perfil` `PerfilMotoristaPage`
- `/painel/documentos` `DocumentosMotoristaPage` · `/painel/procura` `ProcuraMotoristaPage`
- `/painel/rotas` `RotasListPage` · `/painel/rota/:id` `RotaBuilderPage` · `/painel/simulador` `SimuladorEncaixePage`
**Vambora Pro (demonstrativo):** `/pro` `VamboraProPage`, `/pro/encaixe` `LaboratorioEncaixePage`.

> Observação de produto: existem **duas** experiências de motorista (real em `/painel/*`, visual em `/pro`). A unificação "Vambora Motoristas" precisa fundir as duas sem perder a lógica do `/painel`.

## Diretórios principais
- `src/pages/` — páginas por área (`motorista/`, `vambora-pro/`, `admin/`, raiz pública).
- `src/components/` — `brand/` (StartupExperience), `layout/` (Layout), `search/` (SearchForm, AutocompleteEndereco), `home/` (FeaturedDrivers), `motorista/` (MapaInterativoRota, PlanoMotor, …), `motion/`, `ScrollManager`.
- `src/data/` — camada de dados: `source.ts` (marketplace + admin), `motorista-store.ts` (veículos/rotas do motorista), `VitrineProvider.tsx` (estado do marketplace), `destinos.ts`/`motoristas.ts`/`motorista-demo.ts` (demo local), `cidades.ts`.
- `src/lib/` — `auth.tsx`, `supabase.ts`, `matching.ts` (filtro da busca), `geocode.ts`, engines-adapters (`encaixe.ts`, `rota-para-encaixe.ts`, `rota-para-motor.ts`, `busca-encaixe.ts`, `matriz-viaria.ts`, `ocupacao-rota.ts`), `utils.ts`, `whatsapp.ts`, `searchParams.ts`.
- `src/engine/` — núcleo de cálculo (ver `03`): `engine.ts` (legado), `encaixe-geografico.ts` (motor geográfico + progressivo), `planejamento.ts`, `matching.ts` (legado) + testes de referência.
- `src/types/` — `index.ts` (domínio marketplace: `Motorista`, `Destino`, `CriteriosBusca`…), `motorista.ts` (`Veiculo`, `Rota`, `ParadaRota`, `PassageiroRota`).
- `api/mapas.ts` — função serverless (Vercel) para geocodificação/roteamento Geoapify.

## Estado e provedores
- **`AuthProvider`** (`src/lib/auth.tsx`): sessão Supabase, `isAdmin` (via `has_role`), `entrar`, `cadastrar`, `entrarComProvedor('google'|'apple')`, `sair`. Apple preparado/desligado. Modo sem Supabase = auth indisponível.
- **`VitrineProvider`** (`src/data/VitrineProvider.tsx`): carrega motoristas/destinos do marketplace (estados carregando/pronto/erro + "tentar de novo"); marca modo demo.

## Modo demo × Supabase (chave de leitura de todo o sistema)
`src/lib/supabase.ts` expõe `USE_SUPABASE`. Quando **false** (sem env), telas usam dados locais (`src/data/*.ts`, localStorage). Quando **true**, leem/escrevem no Supabase real. `src/data/source.ts` documenta: com Supabase ativo, falha de consulta **lança erro** (não cai para demo silenciosamente).

## Camadas de dados do motorista (`src/data/motorista-store.ts`)
- **Veículos**: `listarVeiculos`/`salvarVeiculo` → tabela **`vehicles`** (upsert) ou localStorage (demo).
- **Rotas**: `listarRotas`/`obterRota`/`salvarRota`/`excluirRota` → tabela **`routes`** (+`route_stops`+`route_passengers`) via RPC `salvar_rota_completa`, ou localStorage (demo).
- Mapeadores `rotaParaBanco`/`mapRotaDoBanco` já incluem os 5 campos de compromisso da Fase 2 (dependem da migração 0010 para existirem no banco).

## PWA
Configurado para o domínio único. Uma eventual "identidade PWA própria" do Vambora Motoristas precisa ser avaliada sem quebrar o manifest do marketplace (ver fase de unificação em `05`).
