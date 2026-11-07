# Navegação real da rota

A navegação operacional foi adicionada como uma experiência separada em `/painel/rota-real/:id`. Ela não substitui o construtor nem o mapa atual de detalhes.

## Fonte dos dados

A página usa `obterRota(id)`, que lê as rotas e `route_stops` do Supabase pelo cliente já existente e sob as políticas RLS da sessão do motorista. Cada parada utiliza `lat`, `lng`, `ordem`, `type`, `label` e `destination_id` já persistidos.

## Mapa e movimento

A cartografia vem do OpenStreetMap por Leaflet. A geometria viária é calculada por OSRM através de `trajetoOSRM`, mantendo a linha azul sobre as ruas reais. A van é um marcador visual próprio, permanece sobre a geometria e se move por interpolação dos pontos do trajeto quando o motorista inicia a rota.

## Como abrir

1. Entrar como motorista.
2. Abrir **Vambora Motoristas → Minhas rotas → uma rota → Abrir navegação real**.
3. Ou acessar diretamente `/painel/rota-real/<id-da-rota>`.

A rota operacional real validada durante esta implementação foi `311a41ca-7696-4a82-8dc8-96a925499f32`, com saída, uma casa e uma escola em Araçatuba.

## Segurança e publicação

A tela é protegida por `ExigirMotorista`; nenhuma chave de provedor ou `service_role` é enviada ao frontend. A implementação foi feita em branch separada e deve ser publicada somente após revisão do commit final.
