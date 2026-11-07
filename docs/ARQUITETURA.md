# Arquitetura do VanBora

## 1. Como organizamos o sistema

O VanBora foi dividido em duas partes: uma para famílias que procuram transporte e outra para motoristas que precisam organizar seu trabalho.

**VanBora Famílias**

A família informa seu endereço, a escola ou faculdade, o horário e o tipo de viagem que precisa.

Para demonstrar a pesquisa, usamos motoristas fictícios e serviços de mapas. O sistema utiliza essas informações para apresentar possíveis trajetos e opções de transporte.

Os resultados são demonstrativos e não representam vagas reais.

**VanBora Motoristas**

É a parte destinada aos profissionais. Nela, o motorista pode cadastrar veículos, organizar rotas, paradas e passageiros e utilizar ferramentas para planejar seu trabalho.

Algumas funcionalidades já estão desenvolvidas e outras ainda precisam de ajustes e testes.

## 2. Como as informações funcionam

Na pesquisa das famílias, o sistema recebe os dados informados e utiliza regras de programação para comparar as opções demonstrativas.

Os serviços de mapas ajudam a encontrar os endereços e calcular os caminhos pelas ruas.

No ambiente dos motoristas, utilizamos o Supabase, um serviço que permite guardar e consultar informações em um banco de dados.

Mantemos os dados fictícios da pesquisa separados dos cadastros operacionais para que uma demonstração não altere informações dos motoristas.

## 3. Ferramentas que utilizamos

- **React e TypeScript:** para criar as telas e programar as funcionalidades.
- **Vite:** para desenvolver e preparar o aplicativo.
- **Tailwind CSS:** para organizar a aparência das páginas.
- **Supabase:** para armazenar dados e gerenciar contas.
- **Serviços de mapas:** para localizar endereços e calcular trajetos.
- **GitHub:** para guardar o código e registrar as alterações.
- **Vercel:** para publicar o aplicativo na internet.

Também utilizamos **ferramentas de inteligência artificial** para ajudar na programação, na criação das telas, na correção de erros e na utilização dessas tecnologias.

Como estamos no primeiro semestre de ADS, a IA foi um apoio importante para desenvolver funcionalidades que ainda não conseguiríamos construir sozinhos com os conhecimentos adquiridos até agora.

## 4. Aplicativo para celular

O VanBora foi criado como um PWA, que é um tipo de aplicativo que funciona pelo navegador e também pode ser instalado na tela inicial do celular, quando o aparelho permite.

Assim, conseguimos oferecer uma experiência parecida com a de um aplicativo sem precisar publicá-lo inicialmente nas lojas.

## 5. Cuidados durante o desenvolvimento

Procuramos organizar o código para facilitar futuras melhorias e correções.

Também tomamos cuidado para separar informações fictícias dos dados operacionais, não utilizar dados reais de crianças na demonstração e identificar o que ainda está em desenvolvimento.

## 6. O que ainda precisamos melhorar

Precisamos concluir e testar a nova pesquisa das famílias, verificar os cálculos de trajeto e revisar o funcionamento das telas em computadores e celulares.

Nosso objetivo é apresentar um protótipo que mostre como o VanBora poderia funcionar, sem dar a entender que já existe um serviço comercial de transporte disponível.
