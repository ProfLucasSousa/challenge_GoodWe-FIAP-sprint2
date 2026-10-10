# Metodologia do módulo Intelligence

## Objetivo

O módulo transforma dados operacionais já persistidos pelo EV ChargeOps em indicadores explicáveis para gestores. Ele não utiliza chatbot, modelo generativo ou serviço externo de IA. Todos os resultados podem ser reproduzidos a partir das sessões consultadas.

## Entrada

Fonte principal: `ChargingSession`, com identificação do `Charger` e associação indireta à `Unit` pelo usuário da sessão.

Entram na análise somente sessões que:

- possuem usuário associado a uma unidade;
- estão `COMPLETED` ou `INTERRUPTED`;
- possuem `dataQuality=VALID`;
- possuem início e término válidos;
- começaram dentro da janela solicitada, de 7 a 365 dias.

Para sessões interrompidas, a energia observada é preferida e energia calculada não substitui uma medição observada ausente. Para sessões concluídas, a ordem é energia observada, energia calculada validada e energia canônica da sessão.

O gestor é limitado à própria unidade. Um administrador pode informar `unitId`; sem esse filtro, analisa todas as unidades identificadas. Horas e dias da semana usam `INTELLIGENCE_TIMEZONE`, com padrão `America/Sao_Paulo` e fallback seguro para UTC.

## Transformação

1. As sessões são ordenadas cronologicamente.
2. A energia é convertida para kWh e a duração para minutos.
3. O início é agrupado por hora local e dia da semana.
4. Intervalos sobrepostos do mesmo carregador são unidos antes do cálculo de utilização.
5. Lacunas entre intervalos ocupados formam os períodos de ociosidade.
6. Energia e duração são analisadas separadamente para anomalias.
7. A demanda é agregada em janelas móveis completas de sete dias.
8. Energia e quantidade de sessões são agregadas por mês para formar a evolução mensal.

Nenhum dado ausente é preenchido por estimativa silenciosa.

## Técnicas

### Padrão de uso e picos

Técnica: frequência histórica. Cada sessão é atribuída à hora e ao dia em que começou. `peakHours` apresenta as três horas não vazias mais frequentes; `lowestUsageHours` apresenta as três horas menos utilizadas, incluindo horas com zero ocorrências.

O percentual é `sessões na hora / total de sessões válidas × 100`.

### Ociosidade e utilização

Técnica: análise de intervalos. A utilização de cada carregador é:

```text
utilizationPercent = minutos ocupados sem sobreposição / minutos da janela × 100
```

`idlePeriods` contém as dez maiores lacunas observadas. Para gestores de unidade, a utilização representa o uso atribuível àquela unidade, porque o modelo atual não vincula um carregador exclusivamente a uma unidade.

### Anomalias

Técnica: intervalo interquartil, ou IQR.

```text
IQR = Q3 - Q1
limite inferior = max(0, Q1 - 1,5 × IQR)
limite superior = Q3 + 1,5 × IQR
```

Energia e duração são avaliadas independentemente. O percentil usa interpolação linear. O método só é executado com pelo menos oito sessões válidas; abaixo disso, `anomalies` fica vazio e a qualidade é `INSUFFICIENT`.

Uma anomalia indica afastamento estatístico, não necessariamente defeito, fraude ou erro de medição.

### Previsão de demanda

Técnica: média móvel semanal. São consideradas até oito janelas históricas de sete dias, e a previsão usa as quatro mais recentes disponíveis.

```text
energia semanal prevista = média da energia das últimas até 4 semanas
sessões semanais previstas = média da quantidade de sessões das mesmas semanas
```

O baseline repete essa média para as quatro semanas futuras. Não há previsão quando existem menos de três semanas completas ou menos de cinco sessões. A qualidade combina tamanho da amostra e coeficiente de variação semanal:

- `HIGH`: pelo menos 30 sessões e variação baixa;
- `MEDIUM`: pelo menos 12 sessões e variação moderada;
- `LOW`: amostra suficiente, mas pequena ou instável;
- `INSUFFICIENT`: requisitos mínimos não atendidos.

`confidence` é um indicador heurístico entre 0 e 0,9; não é uma probabilidade estatística calibrada.

### Evolução mensal

Técnica: agregação mensal das mesmas sessões válidas usadas na análise. O resultado informa mês, energia total, quantidade de sessões e o método `validated_monthly_aggregation`. Meses sem sessão não são preenchidos artificialmente com zero.

## Resultado

`GET /api/intelligence/manager` retorna:

- `peakHours` e `lowestUsageHours`;
- `weeklyPattern`;
- `averageSessionEnergy` em kWh;
- `averageSessionDuration` em minutos;
- `monthlyEvolution` com energia e sessões por mês;
- `chargerUtilization`;
- `idlePeriods`;
- `anomalies`, com método, amostra, valor e faixa esperada;
- `demandForecast`, com método, qualidade, confiança e explicação legível;
- `analysisQuality`, que torna explícita a suficiência da amostra.

## Limitações

- Correlação não implica causalidade; os resultados não explicam por que um pico ocorreu.
- O baseline não considera clima, feriados, ocupação, preço da energia ou crescimento da frota.
- Uma janela curta ou pouco utilizada produz baixa qualidade ou nenhum resultado inferencial.
- Sessões inválidas ou sem unidade são excluídas, podendo reduzir a cobertura.
- A utilização por unidade não equivale à utilização física total quando outras unidades usam o mesmo carregador.
- Leituras instantâneas de potência não entram na primeira versão; poderão complementar a detecção após validação de cobertura e frequência de `ChargingReading`.
- O módulo não toma decisões automáticas nem altera carregadores, sessões ou faturas.
