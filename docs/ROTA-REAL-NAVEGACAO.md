# Navegação real da rota

A navegação operacional foi adicionada como uma experiência separada em `/painel/rota-real/:id`. Ela não substitui o construtor nem o mapa atual de detalhes.

## Fonte dos dados

A página usa `obterRota(id)`, que lê as rotas, paradas e passageiros persistidos no Supabase pelo cliente já existente e sob as políticas RLS da sessão do motorista. Cada parada utiliza `lat`, `lng`, `ordem`, `type`, `label` e `destination_id`; cada aluno utiliza suas paradas de embarque e desembarque já cadastradas.

## Mapa e movimento

A cartografia vem do OpenStreetMap por Leaflet. A geometria viária é calculada por OSRM através de `trajetoOSRM`, mantendo a linha azul sobre as ruas reais. A van é um marcador visual próprio, permanece sobre a geometria e se move por interpolação dos pontos do trajeto.

O mapa é somente a camada visual. O fluxo operacional continua sendo controlado pela rota cadastrada:

- o motorista inicia o trecho até a próxima parada;
- ao chegar, confirma embarque ou desembarque;
- desembarques são processados antes de novos embarques na mesma parada;
- um aluno só pode desembarcar se estiver a bordo;
- a capacidade é derivada do veículo, monitor e lugares reservados;
- a próxima etapa só é liberada após a confirmação da parada;
- a tela mantém alunos a bordo, alunos entregues, vagas restantes e histórico da viagem.

## Como abrir

1. Entrar como motorista.
2. Abrir **Vambora Motoristas → Minhas rotas → uma rota → Iniciar rota**.
3. Ou acessar diretamente `/painel/rota-real/<id-da-rota>`.

A tela foi organizada para celular primeiro, com mapa compacto e cartões operacionais empilhados. Em tablet e computador, o mapa ocupa a área principal e o painel de operação fica ao lado.

## Segurança e publicação

A tela é protegida por `ExigirMotorista`; nenhuma chave de provedor ou `service_role` é enviada ao frontend. A implementação foi feita em branch separada e deve ser publicada somente após revisão do commit final.
