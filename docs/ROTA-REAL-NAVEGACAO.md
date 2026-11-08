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

## Modo navegação expandido

O botão **Expandir mapa** abre o modo de navegação. Nesse modo:

- o mapa ocupa todo o viewport disponível;
- não há barra de rolagem;
- a van fica visível sobre a rota;
- um cartão flutuante mantém a próxima parada e a confirmação de embarque/desembarque;
- **Centralizar** reposiciona o mapa na van;
- **Modo operação** retorna ao painel completo.

Ao entrar no modo expandido, a aplicação solicita a localização do dispositivo por `navigator.geolocation.watchPosition()`. Com permissão e HTTPS, a posição real acompanha a van, o mapa se centraliza e a chegada é detectada por proximidade da próxima parada. Se o motorista negar a permissão, o dispositivo não oferecer GPS ou ocorrer uma falha, a tela informa a situação e continua automaticamente com a simulação da rota, sem bloquear a operação.

## Responsividade

No celular, o modo operação é um viewport fixo: mapa superior, cartões compactos inferiores e botão de ação sempre visível. No modo navegação, o mapa ocupa a tela inteira e o cartão flutua na parte inferior. Em tablet e computador, o modo operação usa mapa principal e painel lateral.

## Como abrir

1. Entrar como motorista.
2. Abrir **Vambora Motoristas → Minhas rotas → uma rota → Iniciar rota**.
3. Usar **Expandir mapa** para entrar na navegação.
4. Ou acessar diretamente `/painel/rota-real/<id-da-rota>`.

## Segurança e publicação

A tela é protegida por `ExigirMotorista`; nenhuma chave de provedor ou `service_role` é enviada ao frontend. O GPS é solicitado somente pelo navegador e exige contexto seguro em produção (HTTPS). A implementação foi feita em branch separada.
