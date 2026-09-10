# Briefing Cavalcanti — alinhamento para entrega 16/09

> Mensagem original do usuario na sessao de 2026-09-09 (recuperada do transcript).

opa blz quero que voce faca uma organizacao geral disso tudo abaixo completo e correto sobre isso aqui foi o que o dono da empresa me deu falando com o cavalcanti sobre tudo isso completo e correto sobre sem erros e tudo masi abaixo , analise junto com o que ja esta no  projeto e verifique as coisas que tem que fazer baseado ai completo e correto sobre sem erros e manda bala sobre isso : ## Projeto Cavalcante — alinhamento completo

### Prazo e cronograma

-   *Entrega final:* quarta-feira, *16/09*, até meio-dia.
-   Cronograma:
    -   *11 a 13/09:* reestruturação.
    -   *Fim de semana:* testes.
    -   *14/09:* revisão geral.
    -   *15/09:* ajustes finais e call de validação com o cliente.
    -   *16/09:* entrega.

### Contato e validação com o cliente

-   Adicionar *Tarcísio* ao grupo do Cavalcante; ele deve se apresentar como desenvolvedor responsável e solicitar os documentos necessários.
-   A comunicação no grupo deve ser formal, objetiva e sem gírias.
-   Fazer uma call com o cliente na terça-feira para testar o fluxo junto, validar o resultado e ajustar antes da implantação.
-   Antes de integrar em produção, confirmar com o cliente como ele enviará documentos e informações reais.

### Fluxo principal via WhatsApp

-   O cliente envia áudio, texto ou documento pelo WhatsApp.
-   O agente identifica e estrutura as informações.
-   Antes de gravar no sistema, o bot retorna uma confirmação, por exemplo: *“Cliente Tarsis, digite OK para inserir no sistema.”*
-   Após o “OK”, a informação é inserida automaticamente. Não haverá aprovação manual pelo sistema.

### Dados e organização

-   Estruturar informações por obra, fornecedor, documentos, comprovantes, notas fiscais, pagamentos e categorias.
-   Validar com o cliente as categorias que fazem sentido, como mão de obra, limpeza, frete, hidráulica e entulho.
-   O sistema deve permitir visualizar histórico e relatórios de obra e fornecedor, incluindo total pago, documentos recebidos, vínculo com obras, contato, categoria e CNPJ.
-   Itens sem nota fiscal ou comprovante devem aparecer como pendências, incluindo há quantos dias estão pendentes.

### Interface e ajustes

-   Renomear *“Histórico do Fornecedor”* para *“Relatório do Fornecedor”*.
-   Remover a métrica de *confiança da IA* da interface final; ela era apenas teste.
-   Em *Atividade recente*, mostrar ações realizadas pelo agente — não mensagens brutas do WhatsApp.
-   Remover automações de e-mail para clientes; não fazem parte do escopo contratado.
-   Solicitar a logo do cliente em *PNG transparente* para substituir a logo da Nogma.
-   A logo deve funcionar como atalho para voltar ao painel.
-   No modo branco, substituir o verde atual por um azul mais forte.

### Pendências

-   Manter filtros de status: *pendente* (amarelo), *recusado* (vermelho) e *aprovado* (verde).
-   Revisar a lógica de “recusado/aprovado” para manter coerência com a aprovação pelo WhatsApp.

### Infraestrutura

-   Hospedar Cavalcante na VPS da Ciane, pois ambos são projetos pequenos, mantendo separação por subdomínio.
-   Migrar os projetos para uma organização separada no Supabase.
-   Criar uma conta OpenAI própria do projeto, com e-mail da Nogma, sem depender de contas pessoais ou da conta principal.
-   Adicionar crédito inicial de *US$ 5*, se necessário.
-   Para teste do WhatsApp, usar chip virtual/número temporário; em produção, migrar para número do cliente. Não deixar o projeto em números pessoais da equipe.

### Diretriz de entrega

-   Prioridade é deixar o sistema funcional e bem lapidado antes da entrega, evitando liberar uma versão incompleta e corrigir no meio do uso.
-   Assim que a parte funcional estiver pronta, avisar para realizar uma rodada de testes conjunta.    outro ponto , coloquei duas pastas extrass ai : _MACOSX  e  ARTEFATOS_INICIAIS. o que sao eles: basicamente, eles são um pré-projeto que o cara mostrou para o Cavalcanti para ele olhar tudo, com as informações que já tinha lá deles e tudo mais, para mostrar com os dados reais e as informações. Eu queria que você vasculhasse todas essas pastas, pegasse as coisas mais importantes que tem lá e tudo que você puder, e implantasse e colocasse no projeto, ok? Usar tudo lá, porque ele usou esse pré-projeto para mostrar para ele, para provar, para ver o que ele gosta ou o que ele achava, então.

Seria bom você olhar essas duas pastas e tudo que está lá incluído para mexer, para colocar no nosso projeto, para deixar esse sistema desse projeto nosso aí completo, o melhor possível. Fechou? Queria que você fizesse isso de forma consciente, completa, sem erros, fazendo passo a passo, usando agentes de IA e usando os skills que você tem disponíveis. Usando todas as skills que vocês têm disponíveis, toda essa capacidade do Opus 5, mandando bala completa, correto? Moda para a cara, que eu sei e quero que você veja isso, e vamos lá, vai, contura agora.