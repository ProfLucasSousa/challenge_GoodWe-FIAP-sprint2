import { analyzeOperationalData, type IntelligenceSession } from './intelligence.analytics';

const DAY = 24 * 60 * 60 * 1000;
const window = {
  from: new Date('2026-01-01T00:00:00.000Z'),
  to: new Date('2026-03-01T00:00:00.000Z'),
  timezone: 'UTC',
};

function session(
  id: string,
  startedAt: Date,
  durationMinutes = 60,
  energyKwh = 10,
  chargerId = 'charger-a',
): IntelligenceSession {
  return {
    id,
    chargerId,
    chargerName: chargerId,
    startedAt,
    endedAt: new Date(startedAt.getTime() + durationMinutes * 60_000),
    energyKwh,
  };
}

describe('Intelligence analytics', () => {
  it('returns explicit insufficient indicators instead of inventing results', () => {
    const result = analyzeOperationalData([], window);

    expect(result.peakHours).toEqual([]);
    expect(result.lowestUsageHours).toEqual([]);
    expect(result.averageSessionEnergy).toBeNull();
    expect(result.averageSessionDuration).toBeNull();
    expect(result.anomalies).toEqual([]);
    expect(result.analysisQuality.anomalyDetection.quality).toBe('INSUFFICIENT');
    expect(result.demandForecast).toMatchObject({
      method: 'weekly_moving_average',
      quality: 'INSUFFICIENT',
      confidence: 0,
      predictions: [],
    });
  });

  it('finds peak/low hours, weekly pattern and averages from observed sessions', () => {
    const sessions = [
      session('a', new Date('2026-02-02T18:10:00.000Z'), 60, 10),
      session('b', new Date('2026-02-09T18:20:00.000Z'), 120, 20),
      session('c', new Date('2026-02-10T07:00:00.000Z'), 30, 6),
    ];
    const result = analyzeOperationalData(sessions, window);

    expect(result.peakHours[0]).toMatchObject({
      hour: '18:00',
      sessions: 2,
      percentage: 66.7,
      method: 'historical_frequency',
      sampleSize: 3,
    });
    expect(result.lowestUsageHours[0]).toMatchObject({ hour: '00:00', sessions: 0 });
    expect(result.weeklyPattern.find((item) => item.day === 'MONDAY')).toMatchObject({
      sessions: 2,
      energyKwh: 30,
    });
    expect(result.averageSessionEnergy).toBe(12);
    expect(result.averageSessionDuration).toBe(70);
    expect(result.monthlyEvolution).toEqual([
      {
        month: '2026-02',
        energyKwh: 36,
        sessions: 3,
        method: 'validated_monthly_aggregation',
      },
    ]);
  });

  it('merges overlapping intervals for utilization and exposes observed idle gaps', () => {
    const localWindow = {
      from: new Date('2026-02-01T00:00:00.000Z'),
      to: new Date('2026-02-01T04:00:00.000Z'),
      timezone: 'UTC',
    };
    const sessions = [
      session('a', new Date('2026-02-01T01:00:00.000Z'), 120, 5),
      session('b', new Date('2026-02-01T02:00:00.000Z'), 60, 5),
    ];
    const result = analyzeOperationalData(sessions, localWindow);

    expect(result.chargerUtilization[0]).toMatchObject({
      occupiedMinutes: 120,
      utilizationPercent: 50,
      sessionCount: 2,
    });
    expect(result.idlePeriods).toEqual(
      expect.arrayContaining([expect.objectContaining({ durationMinutes: 60 })]),
    );
  });

  it('detects energy outliers with IQR only when the sample is sufficient', () => {
    const sessions = Array.from({ length: 9 }, (_, index) =>
      session(
        `session-${index}`,
        new Date(window.from.getTime() + (index + 1) * DAY),
        60,
        index === 8 ? 100 : 10,
      ),
    );
    const result = analyzeOperationalData(sessions, window);

    expect(result.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'ENERGY_OUTLIER',
          sessionId: 'session-8',
          method: 'IQR',
          sampleSize: 9,
        }),
      ]),
    );
    expect(result.analysisQuality.anomalyDetection.humanReadableExplanation).toContain('1,5×IQR');
  });

  it('produces a reproducible four-week moving-average forecast', () => {
    const sessions: IntelligenceSession[] = [];
    for (let week = 0; week < 4; week += 1) {
      const bucketMiddle = new Date(window.to.getTime() - (week + 0.5) * 7 * DAY);
      sessions.push(session(`a-${week}`, bucketMiddle, 60, 4));
      sessions.push(session(`b-${week}`, new Date(bucketMiddle.getTime() + DAY), 60, 6));
    }
    const result = analyzeOperationalData(sessions, window);

    expect(result.demandForecast).toMatchObject({
      method: 'weekly_moving_average',
      quality: 'LOW',
      sampleSize: 8,
    });
    expect(result.demandForecast.predictions).toHaveLength(4);
    expect(result.demandForecast.predictions[0]).toMatchObject({
      predictedEnergyKwh: 10,
      predictedSessions: 2,
    });
    expect(result.demandForecast.humanReadableExplanation).toContain('média móvel');
  });
});
