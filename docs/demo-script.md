# Roteiro de demonstração — EV ChargeOps

Tempo aproximado: 5 minutos. Antes da apresentação, execute `pnpm demo:seed` com `DEMO_MODE=true` e inicie o projeto. O roteiro usa dados fictícios identificados como `MOCK`.

## 0:00–0:30 — Problema

Abra a tela de login.

> “Em uma infraestrutura compartilhada, não basta saber que houve consumo. Precisamos identificar sessão, usuário, unidade, qualidade do dado e valor atribuível.”

> “O EV ChargeOps reúne operação, rateio e inteligência sem apresentar simulação como dado real.”

## 0:30–1:00 — Login e dashboard

Entre com o administrador criado pelo seed ou use o modo visual de demonstração.

> “O dashboard resume energia válida, sessões, estado dos carregadores, valor rateado e pendências.”

> “Os indicadores agregados aparecem como CALCULATED e informam se a entrada foi MOCK ou REAL.”

## 1:00–1:30 — HCA G2 e carregadores

Abra **Carregadores** e selecione um HCA G2 simulado.

> “Representamos os modelos de 7, 11 e 22 kW.”

> “Cada métrica informa origem. Quando um campo não existe, a interface mostra indisponibilidade em vez de preencher com zero.”

## 1:30–2:00 — Sessão

Abra uma sessão concluída e compare com uma `PENDING_REVIEW`.

> “A sessão separa energia observada de energia calculada e conserva a qualidade do dado.”

> “Uma sessão importada sem identificação suficiente permanece pendente e não entra automaticamente no faturamento.”

Observação: a tela de sessões ainda usa dados locais de apresentação; as regras persistentes podem ser demonstradas também pelo Swagger.

## 2:00–2:40 — Consumo e rateio

Volte ao dashboard e mostre consumo diário, horários e unidades.

> “O rateio considera apenas sessões concluídas ou interrompidas, finalizadas, válidas e associadas a uma unidade.”

> “A energia é multiplicada pela tarifa vigente da sessão e depois recebe a taxa operacional.”

## 2:40–3:20 — Fatura

Abra **Faturas** e explique os itens.

> “Cada item conserva um snapshot da tarifa e uma sessão só pode aparecer em um item de fatura.”

> “Dois usuários da mesma unidade são consolidados na mesma referência mensal.”

Observação: a tela de faturas é um protótipo visual; geração, consulta e fechamento persistentes estão disponíveis na API.

## 3:20–4:10 — Inteligência

Abra **Inteligência**.

> “A primeira versão usa técnicas explicáveis: frequência histórica, intervalos de ociosidade, IQR para anomalias e média móvel para previsão.”

> “Quando a amostra é pequena, o sistema informa qualidade insuficiente em vez de inventar uma conclusão.”

Pergunte ao Síndico Virtual: “Qual horário tem maior demanda?”

> “A resposta usa somente contexto agregado e apresenta as métricas utilizadas como fontes.”

## 4:10–4:40 — Integração GoodWe

Abra **Integrações → GoodWe**.

> “A arquitetura GoodWe está preparada, mas a conexão real depende do contrato oficial da OpenAPI e das permissões da conta.”

> “O provider é fail-closed: capabilities não comprovadas ficam desabilitadas e nenhuma credencial SEMS+ é reutilizada em endpoints inferidos.”

> “O modo atual é READ-ONLY e não envia comandos ao carregador.”

## 4:40–5:00 — Conclusão

> “A entrega demonstra o ciclo completo com dados MOCK: operação, validação, rateio, faturamento e inteligência.”

> “A mesma fronteira arquitetural está pronta para receber dados REAL quando a GoodWe fornecer autorização e contrato técnico verificável.”
