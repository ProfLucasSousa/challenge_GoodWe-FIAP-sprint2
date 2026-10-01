import { DeterministicAssistant } from './deterministic-assistant';
import type { AssistantIntelligenceContext } from './intelligence-context.service';

const context: AssistantIntelligenceContext = {
  scope: { type: 'ALL_UNITS', unitCode: null },
  currentMonth: { reference: '2026-10', energyKwh: 120, sessions: 12 },
  previousComparablePeriod: { reference: '2026-09', energyKwh: 100, sessions: 10 },
  monthComparison: { direction: 'INCREASE', percentage: 20 },
  peakHour: { hour: '18:00', sessions: 5, percentage: 41.7, sampleSize: 12 },
  anomalySummary: {
    count: 2,
    energyOutliers: 1,
    durationOutliers: 1,
    method: 'IQR',
    quality: 'MEDIUM',
    sampleSize: 20,
  },
  mostIdleCharger: {
    name: 'Vaga 03',
    utilizationPercent: 5,
    idlePercent: 95,
    observedSessions: 2,
  },
  topUnit: { code: 'A-101', energyKwh: 70, sessions: 7 },
};

describe('DeterministicAssistant', () => {
  const assistant = new DeterministicAssistant();

  it.each([
    ['Qual horário tem maior demanda?', '18:00', 'peak_hour'],
    ['Quanto o condomínio consumiu este mês?', '120 kWh', 'current_month_energy_kwh'],
    ['Tem alguma sessão fora do padrão?', '2 ocorrências', 'anomaly_count'],
    ['Qual carregador fica mais ocioso?', 'Vaga 03', 'charger_idle'],
    ['Qual unidade consumiu mais?', 'A-101', 'top_unit'],
    ['Estamos consumindo mais do que no mês passado?', '20% maior', 'energy_change'],
  ])('answers "%s" only with traceable metrics', (question, answerPart, sourceMetric) => {
    const result = assistant.answer(question, context);
    expect(result.answer).toContain(answerPart);
    expect(result.sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ metric: sourceMetric })]),
    );
  });

  it('reports insufficient anomaly data instead of claiming there are no anomalies', () => {
    const result = assistant.answer('Há anomalias?', {
      ...context,
      anomalySummary: {
        count: 0,
        energyOutliers: 0,
        durationOutliers: 0,
        method: 'IQR',
        quality: 'INSUFFICIENT',
        sampleSize: 3,
      },
    });
    expect(result.answer).toContain('não há dados suficientes');
    expect(result.sources).toContainEqual({ metric: 'anomaly_quality', value: 'INSUFFICIENT' });
  });

  it('does not compare units when the authorized scope is a single unit', () => {
    const result = assistant.answer('Qual unidade consumiu mais?', {
      ...context,
      scope: { type: 'UNIT', unitCode: 'A-101' },
      topUnit: null,
    });
    expect(result.answer).toContain('limitado à própria unidade');
    expect(result.sources).toEqual([{ metric: 'authorized_scope', value: 'A-101' }]);
  });

  it('does not manufacture a percentage without a previous baseline', () => {
    const result = assistant.answer('Estamos consumindo mais que no mês passado?', {
      ...context,
      previousComparablePeriod: { reference: '2026-09', energyKwh: 0, sessions: 0 },
      monthComparison: { direction: 'NO_BASELINE', percentage: null },
    });
    expect(result.answer).toContain('não é possível calcular uma variação percentual');
    expect(result.answer).not.toContain('Infinity');
  });
});
