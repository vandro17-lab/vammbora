# Guia rápido para começar — VanBora

Este guia ajuda quem está começando a trabalhar com o projeto.

## 1. O que instalar

- **Node.js:** permite executar o projeto no computador. Site: https://nodejs.org
- **Git:** ajuda a baixar e enviar alterações. Site: https://git-scm.com
- **VS Code:** programa para abrir e editar os arquivos. Site: https://code.visualstudio.com

## 2. Como baixar e abrir

Abra o terminal e digite:

```bash
git clone https://github.com/vandro17-lab/vammbora.git
cd vammbora
npm install
npm run dev
```

O terminal mostrará um endereço para abrir o aplicativo no navegador.

## 3. Como testar

```bash
npm run build
npm run test
```

O primeiro comando verifica se o projeto pode ser preparado para publicação. O segundo executa os testes automáticos disponíveis.

## 4. Como guardar alterações

O **GitHub** guarda os arquivos e o histórico do projeto.

Um **commit** é como um registro de uma alteração. Uma **branch** é uma área separada para trabalhar antes de juntar as mudanças à versão principal.

Cada integrante deve usar sua própria conta para registrar suas contribuições.

## 5. Se aparecer um erro

Leia a mensagem do terminal e tente identificar em qual etapa ocorreu o problema.

Podemos pedir ajuda a colegas ou a ferramentas de inteligência artificial para entender o erro, mas precisamos conferir o resultado antes de enviar alterações.

**Importante:** nunca publique senhas, chaves secretas ou dados pessoais no repositório.

Para configurar o banco, consulte o [guia do Supabase](GUIA-SUPABASE.md).
