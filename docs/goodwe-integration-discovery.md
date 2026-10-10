# Descoberta de integração GoodWe SEMS+

> Investigação técnica READ-ONLY realizada em 12 de outubro de 2026. Este documento não é um contrato de integração. Ele distingue evidência pública oficial, capacidade visível na interface SEMS+ e acesso efetivamente comprovado para a conta do projeto.

## Objetivo

Determinar, sem alterar configurações nem enviar comandos ao equipamento, quais mecanismos oficiais podem fornecer ao EV ChargeOps dados do carregador GoodWe HCA G2.

Escopo da investigação:

- OpenAPI;
- Real-time Data Monitoring API;
- Batch Remote Control Interface;
- SEMS+ Web/App como fonte de observação;
- dados de estação, dispositivo, telemetria, sessões e alarmes.

Nenhuma chamada autenticada foi feita. Nenhuma senha, token, cookie, e-mail, serial ou identificador privado é reproduzido neste documento.

## Fontes oficiais consultadas

1. [GoodWe OpenAPI Developer Platform](https://openapi.goodwe.com/). Página institucional da plataforma de APIs. Apresenta consultas de informações básicas, telemetria em tempo real, gerenciamento remoto e alarmes, mas não publica na página aberta o contrato técnico completo.
2. [GoodWe API — documento técnico público SA-B-20240814-001](https://community.goodwe.com/static/images/2024-08-20597794.pdf). Define as três ofertas, requisitos de acesso e categorias de interface. Informa limite padrão de 3.600 chamadas por hora para OpenAPI.
3. [Introdução à API — edição oficial em português de 2024](https://community.goodwe.com/static/images/2024-09-23664319.pdf). Confirma elegibilidade, protocolos e necessidade de contratação/autorização.
4. [Página oficial do HCA G2](https://en.goodwe.com/hca-g2). Confirma integração do HCA G2 ao SEMS+, modelos e capacidades de monitoramento do produto.
5. [Manual oficial do HCA G2 V1.5](https://en.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_HCA-G2_User%20Manual-EN.pdf). Mostra os campos da tela de monitoramento, menu de relatório de recarga e gestão de cartões RFID.
6. [Manual oficial do SEMS Portal App V1.1](https://en.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_SEMS%20Portal%20APP_User%20Manual-EN.pdf). Documenta a tela do carregador e os registros recentes. É uma referência da geração anterior do SEMS; os nomes devem ser revalidados no SEMS+ atual.
7. [Manual oficial do SEMS+ Web](https://en.goodwe.com/Skippower/downloadFileF?id=3907&mid=60). Documenta login, tipos de conta, listas de estações/dispositivos e o tipo de dispositivo `EV Charger`.
8. [Página oficial do SEMS+](https://en.goodwe.com/semsplus-series-smart-energy-management-system). Confirma suporte a EV chargers, visualização por dispositivo, alertas e atualização de dados da interface.
9. [Login oficial SEMS+](https://semsplus.goodwe.com/). Confirma autenticação Web por e-mail e senha.

Não foram usadas implementações comunitárias como evidência de contrato. Endpoints encontrados em fóruns, repositórios ou ferramentas de terceiros foram deliberadamente excluídos.

## Tipo de conta/acesso observado

### Evidência local

- `GOODWE_SEMS_USERNAME` está preenchida no `.env` local.
- `GOODWE_SEMS_PASSWORD` está preenchida no `.env` local.
- Os valores não foram copiados, exibidos ou gravados no relatório.

### O que não foi possível confirmar

Não foi possível autenticar na interface SEMS+ porque o ambiente de execução não disponibilizou navegador controlável: Chrome, Edge e navegador embutido estavam indisponíveis, assim como o canal nativo de automação. Nenhuma tentativa alternativa por HTTP foi realizada, pois isso exigiria deduzir o fluxo interno do portal.

Consequentemente, permanecem **não verificados para a conta do projeto**:

- identidade `Owner` ou `Dealer/Installer`;
- vínculo com uma organização SEMS;
- habilitação de OpenAPI;
- região/servidor da conta;
- estações e dispositivos acessíveis.

O manual do SEMS+ mostra contas `Owner` e `Dealer/Installer`. O documento da OpenAPI usa um requisito diferente: a OpenAPI é destinada a contas de organização SEMS. Portanto, conseguir entrar no SEMS+ Web/App **não prova** acesso à OpenAPI.

## Fluxo de autenticação

### SEMS+ Web/App

O fluxo publicamente documentado usa:

1. seleção do servidor/região na interface;
2. e-mail;
3. senha;
4. aceite dos termos do serviço;
5. login na interface Web/App.

Esse é um fluxo de usuário final/instalador. Cookies ou tokens gerados pelo portal não foram observados nem capturados.

### OpenAPI

A documentação pública confirma:

- acesso exclusivo a usuários com conta de organização SEMS;
- licenciamento/onboarding administrado pela equipe SEMS/GoodWe;
- transporte HTTPS;
- acesso aos dispositivos da organização local;
- limite padrão informado de 3.600 chamadas por hora.

A documentação pública consultada **não informa**:

- mecanismo concreto de autenticação;
- formato da credencial de API;
- base URL de produção para a conta/região;
- cabeçalhos obrigatórios;
- procedimento de renovação;
- endpoints e schemas completos.

Não é seguro assumir que e-mail e senha do SEMS+ sejam credenciais da OpenAPI.

### Real-time Data Monitoring API

Destinada a fornecedores terceiros. Segundo a GoodWe, requer:

1. solicitação de credenciais de acesso à API;
2. contrato de licença;
3. inclusão de dispositivos em allowlist;
4. autorização do usuário final.

Usa HTTPS, fornece dados de dispositivos autorizados e não oferece controle remoto. O documento público descreve dados de inversores; não confirma cobertura do HCA G2.

### Batch Remote Control Interface

Tem os mesmos requisitos de contrato, allowlist e autorização da Real-time Data Monitoring API, mas utiliza Kafka e destina-se a controle remoto em lote.

Ela está **fora do escopo do EV ChargeOps nesta fase READ-ONLY**. Nenhum tópico, comando ou consulta Kafka foi utilizado.

## Recursos acessíveis

### Confirmados pela documentação oficial da plataforma

- lista e detalhes de estações;
- lista e detalhes de dispositivos;
- dados operacionais/telemetria, conforme o tipo de dispositivo;
- centro e histórico de alarmes;
- relatórios;
- tipo de dispositivo `EV Charger` no SEMS+ Web;
- OpenAPI organizada em interfaces de planta, dispositivo, controle remoto e datalogger.

### Confirmados para a conta do projeto

Nenhum. A conta não chegou a ser autenticada durante esta execução.

## Dispositivos encontrados

Nenhum dispositivo da conta foi observado.

A documentação oficial do SEMS+ Web apresenta `EV Charger` como uma categoria própria na lista de dispositivos. Isso confirma que um carregador pode aparecer como dispositivo próprio na plataforma, mas não confirma que o HCA G2 do ambiente FIAP/GoodWe esteja vinculado ou visível para as credenciais fornecidas.

Os modelos oficialmente documentados para o HCA G2 são:

- `GW7K-HCA-20`;
- `GW11K-HCA-20`;
- `GW22K-HCA-20`.

## Campos disponíveis

Os nomes abaixo são rótulos reais observados nos manuais oficiais da interface. Eles **não são nomes de propriedades JSON**.

### HCA G2 no SEMS+

O manual do HCA G2 mostra:

- `Status`;
- `Firmware`;
- `Last update`;
- `Power` em kW;
- `Current` em A;
- `Time`;
- `Energy` em kWh;
- menu `Charging Report`;
- `Card Management`, `RFID Card Name` e `Card No.`.

O manual do SEMS Portal App documenta, para a tela de carregador:

- `Charger ID`;
- `Status`;
- `Model`;
- `Firmware`;
- `Last update`;
- potência, corrente, duração e energia de carregamento;
- até 15 registros recentes dentro dos últimos 30 dias.

Como esse segundo manual é da geração anterior do portal, quantidade, retenção e nomes precisam ser confirmados no SEMS+ atual.

### Lista de dispositivos SEMS+ Web

O manual atual do SEMS+ Web mostra:

- `Device Name`;
- `Device SN`;
- `Device Status`;
- `Device Type`;
- estação associada;
- `Active Power (kW)`;
- `Daily Charged (kWh)`;
- `Daily Discharged (kWh)`.

Essas colunas são genéricas e podem variar por tipo de dispositivo. Não há evidência pública suficiente para afirmar que `Daily Charged` e `Daily Discharged` sejam usados pelo HCA G2.

### Identificadores mínimos candidatos

Na interface oficial aparecem os seguintes identificadores não secretos ou passíveis de sanitização:

- nome da estação;
- nome do dispositivo;
- `Device SN`/`Charger ID`;
- tipo e modelo do dispositivo;
- associação dispositivo-estação.

A OpenAPI pode exigir IDs internos de estação/dispositivo, mas os nomes e formatos desses campos não foram publicados nas fontes consultadas. Até obter o contrato oficial, não devem ser modelados como parâmetros obrigatórios.

## Endpoints oficialmente documentados

Nenhum caminho de endpoint de dados ou autenticação foi encontrado na documentação pública oficial consultada.

Os seguintes URLs são entradas oficiais de produto, não endpoints de integração:

- `https://openapi.goodwe.com/` — portal institucional/desenvolvedor;
- `https://semsplus.goodwe.com/` — login da aplicação Web SEMS+.

O documento técnico informa a existência de 31 interfaces OpenAPI e as agrupa por planta, dispositivo, controle e datalogger, porém não fornece paths, métodos, parâmetros ou schemas. Portanto, o EV ChargeOps não possui neste momento um endpoint oficial que possa ser implementado com segurança.

## Chamadas observadas, se autorizadas

Nenhuma chamada autenticada foi realizada.

Foram feitas apenas leituras públicas das páginas e documentos oficiais listados neste relatório. Não houve:

- submissão de credenciais;
- captura de cookie ou token;
- inspeção de tráfego autenticado;
- chamada a endpoint inferido;
- enumeração de IDs;
- comando de controle;
- alteração de configuração.

## Limitações

- A documentação pública da API é introdutória e não equivale a uma especificação OpenAPI/Swagger.
- A cobertura oficial da OpenAPI publicada é centrada em plantas, inversores e dataloggers; não há confirmação pública explícita de recursos HCA G2 na API.
- A documentação prova que o HCA G2 tem dados no SEMS+, mas não que os mesmos campos estejam expostos por uma API contratada.
- O tipo de conta e o servidor/região das credenciais locais não foram verificados.
- Não foi possível listar estações ou dispositivos da conta.
- Não foi possível validar nomes de campos JSON, unidades, enums, paginação, retenção ou timezone.
- O manual antigo registra 15 eventos em 30 dias; essa retenção não deve ser assumida para o SEMS+ atual.
- `Voltage` aparece nas especificações nominais do produto, mas não foi encontrado como telemetria na tela de monitoramento documentada.
- Alarmes existem no SEMS+/OpenAPI em nível de plataforma, mas não foram encontrados campos/códigos específicos do HCA G2.

## Dados ainda indisponíveis

- estações visíveis para a conta;
- dispositivos visíveis para a conta;
- presença efetiva do HCA G2 do projeto;
- tipo e permissões reais da conta;
- status de habilitação da OpenAPI;
- base URL e autenticação oficial da API;
- nomes reais dos campos retornados em JSON;
- IDs internos de estação e dispositivo;
- telemetria de tensão;
- estrutura do histórico de sessões;
- associação de sessão com RFID;
- alarmes e códigos específicos do carregador;
- retenção, frequência e granularidade histórica;
- timezone dos timestamps.

## Matriz de disponibilidade

| Dado      | Disponível?                                       | Fonte                                          | Campo real                                 | Observação                                                                                                  |
| --------- | ------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Status    | Sim na UI oficial; não comprovado via API/conta   | Manual HCA G2 e manual SEMS+ Web               | `Status`, `Device Status`                  | Enums e payload JSON não publicados.                                                                        |
| Potência  | Sim na UI oficial; não comprovado via API/conta   | Manual HCA G2                                  | `Power (kW)`                               | Telemetria de recarga mostrada na interface.                                                                |
| Energia   | Sim na UI oficial; não comprovado via API/conta   | Manual HCA G2                                  | `Energy (kWh)`                             | O manual também mostra colunas genéricas de energia diária na lista de dispositivos.                        |
| Corrente  | Sim na UI oficial; não comprovado via API/conta   | Manual HCA G2                                  | `Current (A)`                              | Telemetria de recarga mostrada na interface.                                                                |
| Tensão    | Não confirmada como telemetria                    | Página/datasheet HCA G2                        | Nenhum campo real de telemetria encontrado | Há tensão nominal do modelo, que não deve ser confundida com leitura instantânea.                           |
| Timestamp | Parcial                                           | Manual HCA G2                                  | `Last update`                              | Confirma atualização do dispositivo; timestamps de início/fim de sessão não foram documentados com clareza. |
| Sessões   | Parcial na UI; não comprovado via API/conta       | Manual HCA G2 e manual SEMS Portal App         | `Charging Report`, registros de carga      | Manual anterior cita 15 registros/30 dias; precisa de revalidação.                                          |
| RFID      | Parcial, apenas gestão do cartão                  | Manual HCA G2                                  | `RFID Card Name`, `Card No.`               | Não há prova pública de que o identificador RFID seja retornado no histórico/API.                           |
| Alarmes   | Sim em nível de plataforma; HCA G2 não comprovado | OpenAPI Developer Platform e manual SEMS+ Web  | `Alarm Center`                             | Nenhum código/campo específico do carregador foi publicado.                                                 |
| Histórico | Parcial na UI; não comprovado via API/conta       | Manual SEMS Portal App e OpenAPI institucional | registros recentes / histórico de alarmes  | Granularidade, retenção e schema permanecem desconhecidos.                                                  |

## Próximos passos

1. Abrir `https://semsplus.goodwe.com/` em um navegador autorizado, selecionar a região correta e autenticar com as credenciais locais sem salvar senha no navegador.
2. Registrar, de forma sanitizada, apenas:
   - tipo de identidade/organização;
   - quantidade de estações;
   - tipos e modelos de dispositivos;
   - presença do HCA G2;
   - rótulos de dados e intervalos de atualização.
3. Confirmar com a equipe GoodWe/SEMS se a conta é uma conta de organização e se possui licença OpenAPI. Solicitar a documentação técnica vigente e específica da região.
4. Perguntar explicitamente se a OpenAPI oferece recursos para `EV Charger`/HCA G2, e não apenas para inversores e dataloggers.
5. Se houver acesso aprovado, obter da GoodWe:
   - base URL;
   - mecanismo de autenticação;
   - escopos/permissões;
   - endpoints READ-ONLY de estação, dispositivo, telemetria, sessões e alarmes;
   - schemas e limites de uso;
   - política de retenção e timezone.
6. Executar uma única rodada mínima de chamadas GET/consulta oficialmente documentadas. Sanitizar e documentar somente nomes de campos, tipos, unidades e exemplos redigidos.
7. Só então implementar `GoodWeSemsProvider`. Até esse ponto, manter `CHARGER_PROVIDER=mock` como único modo operacional validado.

### Decisão atual

**Não implementar chamadas GoodWe ainda.** Há evidência de que os dados necessários existem na experiência SEMS+, mas não há evidência suficiente de que a conta fornecida possua OpenAPI nem de que o HCA G2 seja exposto por um contrato oficial acessível. O provider real deve continuar bloqueado de forma segura.
