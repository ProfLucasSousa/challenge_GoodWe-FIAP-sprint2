export interface IntelligenceSession {
  id: string;
  chargerId: string;
  chargerName: string;
  startedAt: Date;
  endedAt: Date;
  energyKwh: number;
}

export interface AnalysisWindow {
  from: Date;
  to: Date;
  timezone: string;
}

type Quality = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function analyzeOperationalData(sessions: IntelligenceSession[], window: AnalysisWindow) {
  const validSessions = sessions.filter(
    (session) =>
      session.endedAt > session.startedAt &&
      session.startedAt >= window.from &&
      session.startedAt < window.to &&
      Number.isFinite(session.energyKwh) &&
      session.energyKwh >= 0,
  );
  const sampleSize = validSessions.length;
  const hourCounts = Array.from({ length: 24 }, () => 0);
  const weekday = DAY_NAMES.map((day) => ({ day, sessions: 0, energyKwh: 0 }));
  const hourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: window.timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: window.timezone,
    weekday: 'short',
  });
  const dayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  for (const session of validSessions) {
    const hour = Number(hourFormatter.format(session.startedAt));
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
    const index = dayIndex[dayFormatter.format(session.startedAt)] ?? 0;
    weekday[index]!.sessions += 1;
    weekday[index]!.energyKwh += session.energyKwh;
  }

  const rankedHours = hourCounts.map((count, hour) => ({ hour, count }));
  const hourResult = (entry: { hour: number; count: number }, type: 'peak' | 'low') => ({
    hour: `${String(entry.hour).padStart(2, '0')}:00`,
    sessions: entry.count,
    percentage: sampleSize ? round((entry.count / sampleSize) * 100, 1) : 0,
    method: 'historical_frequency',
    sampleSize,
    humanReadableExplanation:
      type === 'peak'
        ? `${round(sampleSize ? (entry.count / sampleSize) * 100 : 0, 1)}% das sessões começaram entre ${String(entry.hour).padStart(2, '0')}h e ${String((entry.hour + 1) % 24).padStart(2, '0')}h.`
        : `${entry.count} sessão(ões) começou(aram) entre ${String(entry.hour).padStart(2, '0')}h e ${String((entry.hour + 1) % 24).padStart(2, '0')}h.`,
  });
  const peakHours = sampleSize
    ? [...rankedHours]
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count || a.hour - b.hour)
        .slice(0, 3)
        .map((entry) => hourResult(entry, 'peak'))
    : [];
  const lowestUsageHours = sampleSize
    ? [...rankedHours]
        .sort((a, b) => a.count - b.count || a.hour - b.hour)
        .slice(0, 3)
        .map((entry) => hourResult(entry, 'low'))
    : [];

  const durations = validSessions.map(
    (session) => (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000,
  );
  const energies = validSessions.map((session) => session.energyKwh);
  const anomalyResult = detectAnomalies(validSessions, durations, energies);
  const monthly = new Map<string, { energyKwh: number; sessions: number }>();
  for (const session of validSessions) {
    const month = monthKey(session.startedAt, window.timezone);
    const aggregate = monthly.get(month) ?? { energyKwh: 0, sessions: 0 };
    aggregate.energyKwh += session.energyKwh;
    aggregate.sessions += 1;
    monthly.set(month, aggregate);
  }

  return {
    period: { from: window.from, to: window.to, timezone: window.timezone },
    sampleSize,
    peakHours,
    lowestUsageHours,
    weeklyPattern: weekday.map((entry) => ({
      ...entry,
      energyKwh: round(entry.energyKwh, 3),
      percentage: sampleSize ? round((entry.sessions / sampleSize) * 100, 1) : 0,
    })),
    averageSessionEnergy: sampleSize ? round(mean(energies), 3) : null,
    averageSessionDuration: sampleSize ? round(mean(durations), 1) : null,
    monthlyEvolution: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, aggregate]) => ({
        month,
        energyKwh: round(aggregate.energyKwh, 3),
        sessions: aggregate.sessions,
        method: 'validated_monthly_aggregation',
      })),
    chargerUtilization: utilization(validSessions, window),
    idlePeriods: idlePeriods(validSessions, window),
    anomalies: anomalyResult.anomalies,
    demandForecast: forecast(validSessions, window),
    analysisQuality: {
      usagePattern: qualityForSample(sampleSize),
      anomalyDetection: {
        method: 'IQR',
        quality: anomalyResult.quality,
        sampleSize,
        humanReadableExplanation: anomalyResult.explanation,
      },
    },
  };
}

function detectAnomalies(sessions: IntelligenceSession[], durations: number[], energies: number[]) {
  if (sessions.length < 8) {
    return {
      anomalies: [],
      quality: 'INSUFFICIENT' as Quality,
      explanation: 'São necessárias pelo menos 8 sessões válidas para aplicar IQR.',
    };
  }
  const energyBounds = iqrBounds(energies);
  const durationBounds = iqrBounds(durations);
  const anomalies = sessions.flatMap((session, index) => {
    const results = [];
    const energy = energies[index]!;
    const duration = durations[index]!;
    if (energy < energyBounds.lower || energy > energyBounds.upper) {
      results.push({
        type: 'ENERGY_OUTLIER',
        sessionId: session.id,
        observedValue: round(energy, 3),
        expectedRange: { min: round(energyBounds.lower, 3), max: round(energyBounds.upper, 3) },
        message: `Energia de ${round(energy, 3)} kWh está fora da faixa histórica por IQR.`,
        method: 'IQR',
        sampleSize: sessions.length,
      });
    }
    if (duration < durationBounds.lower || duration > durationBounds.upper) {
      results.push({
        type: 'DURATION_OUTLIER',
        sessionId: session.id,
        observedValue: round(duration, 1),
        expectedRange: { min: round(durationBounds.lower, 1), max: round(durationBounds.upper, 1) },
        message: `Duração de ${round(duration, 1)} minutos está fora da faixa histórica por IQR.`,
        method: 'IQR',
        sampleSize: sessions.length,
      });
    }
    return results;
  });
  return {
    anomalies,
    quality: qualityForSample(sessions.length),
    explanation: `IQR aplicado a ${sessions.length} sessões; valores abaixo de Q1−1,5×IQR ou acima de Q3+1,5×IQR são sinalizados.`,
  };
}

function utilization(sessions: IntelligenceSession[], window: AnalysisWindow) {
  const byCharger = groupBy(sessions, (session) => session.chargerId);
  const windowMinutes = (window.to.getTime() - window.from.getTime()) / 60_000;
  return [...byCharger.entries()]
    .map(([chargerId, items]) => {
      const occupiedMinutes = mergedMinutes(
        items.map((item) => [item.startedAt, item.endedAt] as const),
        window,
      );
      return {
        chargerId,
        chargerName: items[0]!.chargerName,
        sessionCount: items.length,
        occupiedMinutes: round(occupiedMinutes, 1),
        utilizationPercent: round((occupiedMinutes / windowMinutes) * 100, 2),
        method: 'occupied_time_over_observation_window',
      };
    })
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent);
}

function idlePeriods(sessions: IntelligenceSession[], window: AnalysisWindow) {
  const byCharger = groupBy(sessions, (session) => session.chargerId);
  return [...byCharger.entries()]
    .flatMap(([chargerId, items]) => {
      const sorted = [...items].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      const gaps = [];
      let previousEnd = window.from;
      for (const item of sorted) {
        if (item.startedAt > previousEnd) {
          gaps.push({
            chargerId,
            chargerName: item.chargerName,
            startedAt: previousEnd,
            endedAt: item.startedAt,
            durationMinutes: round((item.startedAt.getTime() - previousEnd.getTime()) / 60_000, 1),
          });
        }
        if (item.endedAt > previousEnd) previousEnd = item.endedAt;
      }
      if (previousEnd < window.to && sorted[0]) {
        gaps.push({
          chargerId,
          chargerName: sorted[0].chargerName,
          startedAt: previousEnd,
          endedAt: window.to,
          durationMinutes: round((window.to.getTime() - previousEnd.getTime()) / 60_000, 1),
        });
      }
      return gaps;
    })
    .sort((a, b) => b.durationMinutes - a.durationMinutes)
    .slice(0, 10);
}

function forecast(sessions: IntelligenceSession[], window: AnalysisWindow) {
  const availableWeeks = Math.min(
    8,
    Math.floor((window.to.getTime() - window.from.getTime()) / WEEK_MS),
  );
  const weeks = Array.from({ length: availableWeeks }, (_, index) => {
    const end = new Date(window.to.getTime() - (availableWeeks - index - 1) * WEEK_MS);
    const start = new Date(end.getTime() - WEEK_MS);
    const items = sessions.filter(
      (session) => session.startedAt >= start && session.startedAt < end,
    );
    return {
      start,
      end,
      energyKwh: items.reduce((sum, item) => sum + item.energyKwh, 0),
      sessions: items.length,
    };
  });
  const trailing = weeks.slice(-4);
  const historicalSessions = trailing.reduce((sum, week) => sum + week.sessions, 0);
  if (trailing.length < 3 || historicalSessions < 5) {
    return {
      method: 'weekly_moving_average',
      quality: 'INSUFFICIENT' as Quality,
      confidence: 0,
      sampleSize: sessions.length,
      predictions: [],
      humanReadableExplanation:
        'Dados insuficientes: são necessárias ao menos 3 semanas completas e 5 sessões válidas.',
    };
  }
  const predictedEnergyKwh = round(mean(trailing.map((week) => week.energyKwh)), 3);
  const predictedSessions = round(mean(trailing.map((week) => week.sessions)), 1);
  const variation = coefficientOfVariation(trailing.map((week) => week.energyKwh));
  const quality: Quality =
    historicalSessions >= 30 && trailing.length === 4 && variation <= 0.5
      ? 'HIGH'
      : historicalSessions >= 12 && variation <= 1
        ? 'MEDIUM'
        : 'LOW';
  const confidence = round(
    Math.max(0.15, Math.min(0.9, (historicalSessions / 30) * (1 / (1 + variation)))),
    2,
  );
  return {
    method: 'weekly_moving_average',
    quality,
    confidence,
    sampleSize: sessions.length,
    predictions: Array.from({ length: 4 }, (_, index) => ({
      periodStart: new Date(window.to.getTime() + index * WEEK_MS),
      periodEnd: new Date(window.to.getTime() + (index + 1) * WEEK_MS),
      predictedEnergyKwh,
      predictedSessions,
    })),
    humanReadableExplanation: `A previsão repete a média móvel das últimas ${trailing.length} semanas: ${predictedEnergyKwh} kWh e ${predictedSessions} sessões por semana.`,
  };
}

function iqrBounds(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  return { lower: Math.max(0, q1 - 1.5 * iqr), upper: q3 + 1.5 * iqr };
}

function percentile(sorted: number[], percentileValue: number) {
  const position = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return (
    sorted[lower]! + (sorted[Math.min(lower + 1, sorted.length - 1)]! - sorted[lower]!) * fraction
  );
}

function mergedMinutes(intervals: ReadonlyArray<readonly [Date, Date]>, window: AnalysisWindow) {
  const sorted = intervals
    .map(
      ([start, end]) =>
        [
          Math.max(start.getTime(), window.from.getTime()),
          Math.min(end.getTime(), window.to.getTime()),
        ] as const,
    )
    .filter(([start, end]) => end > start)
    .sort(([a], [b]) => a - b);
  let total = 0;
  let currentStart = 0;
  let currentEnd = 0;
  for (const [start, end] of sorted) {
    if (!currentEnd || start > currentEnd) {
      total += currentEnd ? currentEnd - currentStart : 0;
      currentStart = start;
      currentEnd = end;
    } else {
      currentEnd = Math.max(currentEnd, end);
    }
  }
  total += currentEnd ? currentEnd - currentStart : 0;
  return total / 60_000;
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) grouped.set(key(item), [...(grouped.get(key(item)) ?? []), item]);
  return grouped;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function coefficientOfVariation(values: number[]) {
  const average = mean(values);
  if (average === 0) return values.every((value) => value === 0) ? 0 : Number.POSITIVE_INFINITY;
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance) / average;
}

function qualityForSample(sampleSize: number): Quality {
  if (sampleSize >= 30) return 'HIGH';
  if (sampleSize >= 15) return 'MEDIUM';
  if (sampleSize >= 5) return 'LOW';
  return 'INSUFFICIENT';
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function monthKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  return `${year}-${month}`;
}
