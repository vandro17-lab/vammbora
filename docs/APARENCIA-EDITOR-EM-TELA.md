# Editar aparência — editor visual integrado (Vambora Motoristas)

Modo administrador que permite personalizar as imagens do app **direto nas telas
reais**, em vez de uma página separada com uma lista de uploads.

## Como funciona

1. Admin abre o app (aba **Mais**) e toca em **Editar aparência**.
2. O app entra em modo de edição: as áreas com arte personalizável ganham um
   **destaque discreto** (contorno tracejado + selo de lápis) e continuam
   navegáveis. O restante do app funciona exatamente como antes.
3. Tocar em uma área abre o **editor no próprio layout**: enviar imagem,
   ampliar/reduzir, reposicionar, ver a **prévia aplicada no próprio componente**
   (atrás da janela), **cancelar sem publicar**, **publicar** ou **restaurar o
   visual padrão**.
4. **Concluir** desliga o modo e o app volta ao normal.

A barra flutuante do modo fica no topo e **nunca cobre a navegação inferior**.
Testado em viewport 390×844 e menores.

## Permissão

- A *affordance* (botão/menu) só aparece para **admin** (`isAdmin`, validado por
  `public.is_admin()` no banco).
- A **segurança real** vem das **políticas RLS** do Supabase: publicar/remover em
  `app_assets` e no bucket `app-assets` exige `is_admin()`. Mesmo que a interface
  de edição fosse exibida para um não-admin, o banco recusaria a gravação.
- Em DEV há um atalho **somente para testes** (`?editar-aparencia=1`) que habilita
  a interface sem Supabase — ele **não concede** nenhum acesso de escrita (as
  operações continuam barradas pelo banco).

## Espaços editáveis (slots)

Registro único em `src/lib/vm/slots.ts`, consumido pelo editor em tela e pelo
índice completo (admin). Além dos 10 originais (van do cabeçalho, arte do Clube e
8 ícones da Mais), foram adicionados:

| Slot | Tela | Tipo |
|------|------|------|
| `dash.van` | Início — cartão de ocupação | ilustração |
| `dash.primeirosPassos` | Início — onboarding (estado vazio) | ilustração |
| `van.ilustracao` | Minha Van — cartão principal | ilustração |
| `van.vazio` | Minha Van — estado "cadastre sua van" | ilustração |
| `oportunidades.vazio` | Oportunidades — estado vazio | ilustração |
| `clube.hero` | Clube do Motorista — topo da tela | ilustração |
| `clube.card.postos/oficinas/pneus/seguro` | Clube — cartões de parceria | ícone/logo |

> Textos, formulários, gráficos e componentes interativos **não** viraram imagem.
> Quando um botão tem aparência personalizável (ex.: banner do Clube), a ação e a
> acessibilidade são preservadas: só a área da arte abre o editor.

## Backend (verificado no projeto ativo `vambora`)

Confirmado via Supabase MCP (não presumido pela existência do SQL no repo):

- Bucket `app-assets` existe e é público ✔
- Tabela `public.app_assets` existe com RLS habilitado ✔
- Função `public.is_admin()` existe ✔
- 2 políticas na tabela (leitura pública / escrita admin) ✔
- 4 políticas de storage para `app-assets` (leitura / insert/update/delete admin) ✔
- 1 usuário admin cadastrado ✔

**Nenhuma alteração de banco foi aplicada** para a funcionalidade base. Não foram
tocadas tabelas de veículos, rotas, passageiros, marketplace, motores nem RPCs.

## Rascunho / publicação / restauração

Com o schema atual já funcionam:

- **Prévia local não publicada** — aplicada ao vivo no componente, nunca gravada.
- **Arte publicada** — `app_assets` + bucket (upload → registro; a arte anterior
  só é apagada **após** a nova publicação ser confirmada).
- **Restaurar visual padrão** — remove a arte do slot (volta ao fallback).

### Pendente de autorização (evolução de banco — NÃO aplicada)

Dois itens do pedido exigem evoluir o banco e **aguardam aprovação** antes de
qualquer `apply_migration`:

1. **Rascunho salvo** (persistir um enquadramento não publicado, por slot).
2. **Restaurar a versão anterior** publicada (histórico de versões por slot).

Proposta (aditiva, sem tocar no operacional), a aplicar **somente após o "ok"**:

```sql
-- PROPOSTA — NÃO EXECUTAR sem autorização explícita.
-- Histórico/rascunho de artes por slot (aditivo; não altera app_assets atual).
create table if not exists public.app_asset_versions (
  id           bigint generated always as identity primary key,
  slot         text not null references public.app_assets(slot) on delete cascade,
  url          text not null,
  storage_path text not null,
  content_type text,
  width        integer,
  height       integer,
  estado       text not null default 'publicada'    -- 'rascunho' | 'publicada'
               check (estado in ('rascunho','publicada')),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
alter table public.app_asset_versions enable row level security;
create policy aav_public_read on public.app_asset_versions for select using (true);
create policy aav_admin_write on public.app_asset_versions for all
  using (public.is_admin()) with check (public.is_admin());
-- "Restaurar versão anterior" = repromover a versão 'publicada' anterior do slot.
-- "Rascunho" = linha 'rascunho' aplicada só na prévia do admin, nunca no fallback público.
```

## Validação executada

- `npm run lint` (tsc) ✔ · `npm test` (237 passam) ✔ · `npm run build` ✔
- Playwright (390×844): ativar modo, destaques nas áreas, abrir editor no banner
  do Clube, enviar imagem, **prévia aplicada no próprio banner**, cancelar,
  navegar para outra tela mantendo o modo, editar a van do Início, concluir.

### Não testado neste ambiente

A **publicação real no banco** não foi testada aqui porque o dev local roda sem
Supabase (modo demonstração) e a escrita é restrita a admin logado. Próximo passo
para validar ponta a ponta: configurar `.env` apontando para o projeto `vambora`,
**entrar como admin**, publicar uma arte e confirmar upload + leitura + atualização
da interface.
