# Como organizamos os dados — VanBora

## Para que servem os dados

O VanBora precisa organizar informações para mostrar as pesquisas das famílias e ajudar os motoristas a planejar seu trabalho.

Usamos o **Supabase**, um serviço de banco de dados, para guardar informações do ambiente dos motoristas.

## Informações dos motoristas

O sistema trabalha com dados como:

- Cadastro do motorista e do veículo.
- Escolas e destinos atendidos.
- Rotas, horários e paradas.
- Passageiros e informações necessárias à organização do serviço.

Nem todas essas informações devem aparecer para o público.

## Informações da pesquisa das famílias

Na demonstração, usamos motoristas e veículos fictícios para mostrar como a busca poderia funcionar.

O endereço, o destino e o horário informados ajudam a pesquisar caminhos e comparar opções.

Os dados fictícios da busca devem ficar separados dos cadastros operacionais dos motoristas.

## Cuidados com a privacidade

Precisamos proteger informações pessoais e evitar a exposição de endereços, documentos e dados de crianças.

Também não devemos apresentar avaliações, documentos verificados ou vagas fictícias como se fossem informações reais.

## O que ainda precisa ser testado

Continuamos verificando se os cadastros, as consultas e as rotas funcionam corretamente e se cada usuário acessa apenas as informações permitidas.

Os detalhes das tabelas e das alterações do banco estão nos arquivos da pasta `supabase/`. Não devemos aplicar mudanças no banco sem revisar antes.
