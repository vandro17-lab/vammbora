# Acessibilidade — roteiro de avaliação

O VanBora é uma aplicação web responsiva. Este documento define **critérios a verificar**, sem declarar conformidade já testada.

| Critério | Como verificar | Situação |
|---|---|---|
| Contraste e legibilidade | Examinar textos e botões sobre amarelo, preto, branco e cinza, inclusive em estados de erro | Não auditado integralmente |
| Ampliação de texto | Testar zoom do navegador e tamanho de fonte sem perda de conteúdo | Pendente |
| Navegação por teclado | Percorrer campos, botões, modais e menus sem mouse | Pendente |
| Rótulos de formulário | Confirmar identificação compreensível de endereço, destino, turno e demais campos | Pendente |
| Informação além da cor | Associar status como “Válido”, “Pendente” ou “Vencido” a texto, não apenas cor | Pendente |
| Alvos de toque | Verificar dimensões e espaçamento de controles em celulares | Pendente |
| Erros e estados vazios | Verificar mensagens claras para campos inválidos, ausência de resultados e falhas de serviço | Pendente |
| Animações | Verificar respeito à preferência de redução de movimento, quando aplicável | Pendente |
| Leitores de tela | Avaliar nomes acessíveis, ordem de leitura e anúncio de mensagens importantes | Pendente |

## Método sugerido

Realizar uma rodada manual em celular e computador, com zoom, teclado e, quando possível, leitor de tela. Registrar tela testada, dispositivo/navegador, problema observado e resultado. Corrigir eventuais falhas em trabalho de desenvolvimento autorizado, **não nesta branch documental**.

A existência de componentes responsivos no código não equivale a uma auditoria de acessibilidade concluída.
