# Decisões arquiteturais do EV ChargeOps

Este documento registra decisões vigentes no código. Ele não descreve integrações futuras como se estivessem disponíveis.

## ADR-001 — ChargerProvider

**Status:** aceito.

**Problema:** o domínio não pode depender diretamente do formato ou da disponibilidade de um fornecedor externo.

**Decisão:** toda comunicação com carregadores passa pelo contrato `ChargerProvider`, com capabilities explícitas para listagem, status, telemetria, sessões, eventos, RFID, alarmes, início de sessão e controle remoto.

**Consequência:** `MockChargerProvider`, `GoodWeSemsProvider` e `DemoHybridChargerProvider` podem coexistir. DTOs externos são convertidos antes da persistência e o domínio não precisa conhecer payloads GoodWe.

## ADR-002 — Não inventar API GoodWe

**Status:** aceito.

**Problema:** o material oficial disponível não contém contrato técnico suficiente para autenticação, endpoints e schemas OpenAPI do HCA G2.

**Decisão:** `GoodWeSemsProvider` opera em modo fail-closed. Capabilities não comprovadas retornam `false` e chamadas correspondentes lançam `ProviderCapabilityNotSupportedError`.

**Consequência:** não há integração GoodWe real no estado atual, mas também não há dependência de endpoints inferidos, credenciais do portal ou payloads inventados.

## ADR-003 — Integração inicialmente READ-ONLY

**Status:** aceito.

**Problema:** comandos podem alterar o estado de equipamento físico, iniciar recargas ou modificar configurações.

**Decisão:** não implementar controle remoto GoodWe sem documentação oficial, autorização explícita e testes controlados. A capability `remoteControl` permanece `false`.

**Consequência:** redução do risco operacional. O início de sessão existente é restrito ao fluxo interno MOCK e não envia comando a equipamento GoodWe.

## ADR-004 — MOCK como ambiente demonstrativo

**Status:** aceito.

**Problema:** a apresentação acadêmica não pode depender de internet, disponibilidade do SEMS+ ou licença OpenAPI.

**Decisão:** manter um simulador determinístico e seeds fictícios com três meses de histórico. `demo:seed` e `demo:reset` exigem `DEMO_MODE=true` e são bloqueados em `NODE_ENV=production`.

**Consequência:** a demonstração é reproduzível offline. Os dados não devem ser apresentados como medições reais.

## ADR-005 — Dados REAL, MOCK e CALCULATED

**Status:** aceito.

**Problema:** dados simulados ou derivados podem ser confundidos com observações externas.

**Decisão:** propagar origem explícita nos DTOs, persistência e respostas operacionais. Métricas ausentes usam `UNAVAILABLE` na apresentação e não recebem zero artificial.

**Consequência:** carregadores e leituras simulados aparecem como `MOCK`; integrações externas validadas poderão produzir `REAL`; agregações, rateios e analytics aparecem como `CALCULATED`.
