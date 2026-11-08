# Plano — navegação real da rota VanBora

## Objetivo
Criar uma experiência separada de navegação do motorista que consuma as paradas reais do Supabase, exiba um mapa cartográfico verdadeiro e mova a van ao longo da geometria real da rua, mantendo a identidade visual existente do VanBora. A implementação não substituirá a navegação atual até estar validada.

## Abordagem
- Reutilizar React, TypeScript, Leaflet e o cliente Supabase já presentes.
- Ler uma rota operacional e suas `route_stops` com `lat`, `lng`, `ordem`, `type`, `label` e `destination_id` pelo store/contrato existente, respeitando RLS e a sessão autenticada.
- Usar o endpoint de mapas já existente (`/api/mapas`) para obter a geometria viária entre as paradas; não expor chave de provedor no frontend.
- Renderizar o mapa real com tiles/cartografia compatíveis com o fluxo já usado no projeto, mantendo cores VanBora nos painéis, marcadores, linha de rota, estados e controles.
- Animar a van sobre os pontos retornados pela rota real, sem efeito de câmera vindo de cima: a tela inicia diretamente na rota, com enquadramento estável e progressão suave.
- Criar a experiência sob uma nova rota/tela separada, preservando a navegação atual como fallback.

## Estrutura prevista
- `src/pages/...`: nova página isolada de demonstração/navegação real.
- `src/components/motorista/...`: mapa real, marcador de van e painel de progresso.
- `src/lib/...`: adaptador somente leitura para carregar rota/paradas e normalizar geometria.
- `src/App.tsx`: registro de uma rota separada, sem trocar a rota existente.
- `api/mapas.ts`: reutilização do proxy atual, somente ajustes se o contrato de geometria exigir.

## Direção visual
Usar a linguagem visual existente: navy profundo, amarelo VanBora, branco, azul de navegação, cartões arredondados e tipografia já instalada. O mapa deve ser verdadeiro e funcional, mas a interface ao redor deve parecer uma parte nativa do site, não um protótipo externo.

## Dados e segurança
Não expor `service_role`, senha ou chave de provedor. Consultas devem retornar apenas campos necessários à tela. Dados privados de alunos serão tratados apenas no contexto autenticado do motorista; a versão separada não será pública por padrão.

## Entrega e versionamento
Testar build, lint, testes e fluxo visual localmente. Só depois criar o commit final na branch separada. Não fazer push nem publicar durante a implementação intermediária.
