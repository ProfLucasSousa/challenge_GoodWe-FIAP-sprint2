import { describe, expect, it } from 'vitest';
import { calculateCharge } from './index';

describe('calculateCharge', () => {
  it('applies energy tariff and optional operational fee', () => {
    expect(calculateCharge({ energyKwh: 18.75, tariffKwh: 1.03, operationalFee: 2 })).toEqual({
      energyAmount: 19.31,
      operationalFee: 2,
      totalAmount: 21.31,
      billable: true,
    });
  });

  it('does not bill inconsistent consumption', () => {
    expect(calculateCharge({ energyKwh: 20, tariffKwh: 1.1, validated: false })).toEqual({
      energyAmount: 0,
      operationalFee: 0,
      totalAmount: 0,
      billable: false,
    });
  });

  it('does not create variable charge for zero consumption', () => {
    expect(calculateCharge({ energyKwh: 0, tariffKwh: 1.1 })).toMatchObject({
      totalAmount: 0,
      billable: false,
    });
  });
});
