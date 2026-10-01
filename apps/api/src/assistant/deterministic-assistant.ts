import { Injectable } from '@nestjs/common';
import type { AssistantIntelligenceContext } from './intelligence-context.service';

export interface AssistantAnswer {
  answer: string;
  sources: Array<{ metric: string; value: string }>;
}

@Injectable()
export class DeterministicAssistant {
  answer(question: string, context: AssistantIntelligenceContext): AssistantAnswer {
    const normalized = this.normalize(question);
    if (this.includesAny(normalized, ['mes passado', 'mês passado', 'comparacao', 'comparação', 'consumindo mais'])) {
      return this.monthComparison(context);
    }
    if (this.includesAny(normalized, ['horario', 'horário', 'maior demanda', 'pico'])) {
      return this.peak(context);
    }
    if (this.includesAny(normalized, ['fora do padrao', 'fora do padrão', 'anomalia', 'atipica', 'atípica'])) {
      return this.anomalies(context);
    }
    if (this.includesAny(normalized, ['carregador', 'ocioso', 'ociosidade'])) {
      return this.idleCharger(context);
    }
    if (this.includesAny(normalized, ['qual unidade', 'unidade consumiu mais', 'maior consumo por unidade'])) {
      return this.topUnit(context);
    }
    if (this.includesAny(normalized, ['quanto', 'consumo', 'consumiu', 'energia'])) {
      return this.currentConsumption(context);
    }
    return {
      answer:
        'Não identifiquei uma métrica específica. Posso explicar demanda por horário, consumo mensal, anomalias, ociosidade, unidade com maior consumo ou comparação com o mês anterior.',
      sources: [],
    };
  }

  private peak(context: AssistantIntelligenceContext): AssistantAnswer {
    const peak = context.peakHour;
    if (!peak) return this.insufficient('Não há sessões válidas suficientes para identificar um horário de maior demanda.');
    return {
      answer: `O maior pico observado começa às ${peak.hour}. Esse horário concentra ${peak.percentage}% das ${peak.sampleSize} sessões analisadas.`,
      sources: [
        { metric: 'peak_hour', value: peak.hour },
        { metric: 'peak_hour_percentage', value: `${peak.percentage}%` },
        { metric: 'analysis_sample_size', value: String(peak.sampleSize) },
      ],
    };
  }

  private currentConsumption(context: AssistantIntelligenceContext): AssistantAnswer {
    const month = context.currentMonth;
    if (month.sessions === 0) {
      return {
        answer: `Não há sessões válidas faturáveis registradas em ${month.reference}.`,
        sources: [
          { metric: 'current_month_energy_kwh', value: '0 kWh' },
          { metric: 'current_month_sessions', value: '0' },
        ],
      };
    }
    return {
      answer: `Em ${month.reference}, o escopo autorizado consumiu ${month.energyKwh} kWh em ${month.sessions} sessões válidas.`,
      sources: [
        { metric: 'current_month_energy_kwh', value: `${month.energyKwh} kWh` },
        { metric: 'current_month_sessions', value: String(month.sessions) },
      ],
    };
  }

  private anomalies(context: AssistantIntelligenceContext): AssistantAnswer {
    const anomaly = context.anomalySummary;
    if (anomaly.quality === 'INSUFFICIENT') {
      return {
        answer: `Ainda não há dados suficientes para detectar sessões fora do padrão com segurança. O método IQR recebeu ${anomaly.sampleSize} sessões válidas e exige pelo menos 8.`,
        sources: [
          { metric: 'anomaly_method', value: anomaly.method },
          { metric: 'anomaly_quality', value: anomaly.quality },
          { metric: 'analysis_sample_size', value: String(anomaly.sampleSize) },
        ],
      };
    }
    return {
      answer:
        anomaly.count === 0
          ? `Nenhuma sessão fora do padrão foi sinalizada pelo método IQR nas ${anomaly.sampleSize} sessões analisadas.`
          : `Foram sinalizadas ${anomaly.count} ocorrências fora do padrão: ${anomaly.energyOutliers} por energia e ${anomaly.durationOutliers} por duração. Elas devem ser revisadas; anomalia estatística não prova falha ou fraude.`,
      sources: [
        { metric: 'anomaly_method', value: anomaly.method },
        { metric: 'anomaly_count', value: String(anomaly.count) },
        { metric: 'energy_outliers', value: String(anomaly.energyOutliers) },
        { metric: 'duration_outliers', value: String(anomaly.durationOutliers) },
        { metric: 'analysis_sample_size', value: String(anomaly.sampleSize) },
      ],
    };
  }

  private idleCharger(context: AssistantIntelligenceContext): AssistantAnswer {
    const charger = context.mostIdleCharger;
    if (!charger) return this.insufficient('Não há sessões válidas suficientes para comparar a ociosidade dos carregadores.');
    return {
      answer: `${charger.name} apresenta a menor utilização entre os carregadores com sessões observadas: ${charger.utilizationPercent}% de uso e ${charger.idlePercent}% de ociosidade na janela analisada.`,
      sources: [
        { metric: 'charger_name', value: charger.name },
        { metric: 'charger_utilization', value: `${charger.utilizationPercent}%` },
        { metric: 'charger_idle', value: `${charger.idlePercent}%` },
        { metric: 'charger_observed_sessions', value: String(charger.observedSessions) },
      ],
    };
  }

  private topUnit(context: AssistantIntelligenceContext): AssistantAnswer {
    if (context.scope.type !== 'ALL_UNITS') {
      return {
        answer: 'Seu perfil está limitado à própria unidade; não posso comparar o consumo com outras unidades.',
        sources: [{ metric: 'authorized_scope', value: context.scope.unitCode ?? 'UNIT' }],
      };
    }
    const unit = context.topUnit;
    if (!unit) return this.insufficient('Não há consumo válido no mês atual para comparar unidades.');
    return {
      answer: `A unidade ${unit.code} possui o maior consumo válido no mês: ${unit.energyKwh} kWh em ${unit.sessions} sessões.`,
      sources: [
        { metric: 'top_unit', value: unit.code },
        { metric: 'top_unit_energy_kwh', value: `${unit.energyKwh} kWh` },
        { metric: 'top_unit_sessions', value: String(unit.sessions) },
      ],
    };
  }

  private monthComparison(context: AssistantIntelligenceContext): AssistantAnswer {
    const current = context.currentMonth;
    const previous = context.previousComparablePeriod;
    const comparison = context.monthComparison;
    const sources = [
      { metric: 'current_month_energy_kwh', value: `${current.energyKwh} kWh` },
      { metric: 'previous_comparable_energy_kwh', value: `${previous.energyKwh} kWh` },
      { metric: 'comparison_method', value: 'month_to_date_vs_equivalent_previous_period' },
    ];
    if (comparison.direction === 'NO_BASELINE') {
      return {
        answer: `O período equivalente do mês anterior não possui consumo válido, então não é possível calcular uma variação percentual. O mês atual registra ${current.energyKwh} kWh.`,
        sources,
      };
    }
    if (comparison.direction === 'STABLE') {
      return {
        answer: `O consumo está estável em relação ao período equivalente do mês anterior: ${current.energyKwh} kWh agora e ${previous.energyKwh} kWh antes.`,
        sources: [...sources, { metric: 'energy_change', value: '0%' }],
      };
    }
    const direction = comparison.direction === 'INCREASE' ? 'maior' : 'menor';
    return {
      answer: `O consumo atual está ${comparison.percentage}% ${direction} que no período equivalente do mês anterior.`,
      sources: [
        ...sources,
        {
          metric: 'energy_change',
          value: `${comparison.direction === 'INCREASE' ? '+' : '-'}${comparison.percentage}%`,
        },
      ],
    };
  }

  private insufficient(answer: string): AssistantAnswer {
    return { answer, sources: [{ metric: 'data_quality', value: 'INSUFFICIENT' }] };
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private includesAny(value: string, candidates: string[]) {
    return candidates.some((candidate) => value.includes(this.normalize(candidate)));
  }
}
