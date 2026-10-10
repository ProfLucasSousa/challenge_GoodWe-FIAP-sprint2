# Matriz de aderência — Enterprise Challenge 2026

Status utilizados:

- `IMPLEMENTED`: fluxo funcional no código e coberto por testes proporcionais;
- `PARTIAL`: parte funcional, mas há integração de interface ou operação incompleta;
- `PREPARED`: fronteira implementada, aguardando implementação concreta;
- `EXTERNAL_DEPENDENCY`: depende de contrato, autorização ou serviço externo não disponível.

| Requisito              | Implementação                                                                                                   | Status                | Evidência                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| Gestão compartilhada   | Unidades, usuários, veículos, RFIDs, sessões e faturas no domínio Prisma.                                       | `IMPLEMENTED`         | `apps/api/prisma/schema.prisma`                                                      |
| Usuários               | JWT, perfis, CRUD com desativação, escopo por usuário/unidade e ausência de `passwordHash` nas respostas.       | `IMPLEMENTED`         | `apps/api/src/auth`, `apps/api/src/users`, `apps/api/test/authorization.e2e-spec.ts` |
| Carregadores           | Cadastro, status, visão operacional, leituras e provider MOCK.                                                  | `IMPLEMENTED`         | `apps/api/src/chargers`, `apps/web/src/pages/charger-pages.tsx`                      |
| Sessões                | Sessões internas/importadas, qualidade, revisão e associações manuais auditadas.                                | `IMPLEMENTED`         | `apps/api/src/sessions`                                                              |
| Consumo                | Energia observada/calculada, leituras e agregações por período.                                                 | `IMPLEMENTED`         | `ChargingSession`, `ChargingReading`, `DashboardService`                             |
| Rateio                 | Sessões elegíveis, Decimal, tarifa por vigência, taxa operacional e prevenção de duplicidade.                   | `IMPLEMENTED`         | `apps/api/src/invoices/invoices.service.ts`                                          |
| Faturamento            | Geração, listagem, detalhe, fechamento e consolidação por unidade. Pagamento/cancelamento não possuem endpoint. | `PARTIAL`             | `apps/api/src/invoices`                                                              |
| Dashboards             | Dashboard principal conectado à API; várias páginas secundárias ainda usam dados locais de apresentação.        | `PARTIAL`             | `apps/web/src/pages/dashboard-page.tsx`, `apps/web/src/lib/portal-data.ts`           |
| Inteligência           | Picos, menores horários, padrões, médias, utilização, ociosidade, evolução mensal, IQR e média móvel.           | `IMPLEMENTED`         | `apps/api/src/intelligence`, `docs/intelligence-methodology.md`                      |
| Síndico Virtual        | Contexto agregado autorizado, respostas determinísticas e fontes rastreáveis.                                   | `IMPLEMENTED`         | `apps/api/src/assistant`                                                             |
| Integração GoodWe      | Contrato, clientes, parser, mapper, erros e provider fail-closed.                                               | `PREPARED`            | `apps/api/src/chargers/goodwe-*`                                                     |
| Integração GoodWe real | Sem endpoints, autenticação OpenAPI ou cobertura HCA G2 comprovados.                                            | `EXTERNAL_DEPENDENCY` | `docs/goodwe-integration-discovery.md`                                               |
| Arquitetura            | Monorepo, provider, camada de integração, API, PostgreSQL, analytics e Web.                                     | `IMPLEMENTED`         | `pnpm-workspace.yaml`, `docs/architecture-decisions.md`                              |
| Segurança              | JWT, RBAC, isolamento de unidade/usuário, validação, Helmet e logs sanitizados.                                 | `IMPLEMENTED`         | `apps/api/src/auth`, `apps/api/src/main.ts`                                          |
| LGPD                   | Minimização e isolamento básicos; ciclo completo de direitos e retenção não implementado.                       | `PARTIAL`             | README, services de autorização e seeds fictícios                                    |
| Demonstração           | Provider MOCK, três meses de histórico, reset protegido e operação offline.                                     | `IMPLEMENTED`         | `apps/api/prisma/demo-history.ts`, `apps/api/prisma/demo-reset.ts`                   |
