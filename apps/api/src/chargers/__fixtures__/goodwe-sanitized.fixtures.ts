/**
 * Synthetic transport fixtures only. They are not claimed to reproduce a GoodWe
 * schema because no authorized OpenAPI response was available during discovery.
 * Values are deliberately fictional and contain no account or device identifiers.
 */
export const validObjectFixture = {
  fixtureKind: 'synthetic-contract-test',
  payload: { sampleValue: 12.3, observedAt: '2026-01-01T00:00:00.000Z' },
};

export const partialObjectFixture = {
  fixtureKind: 'synthetic-contract-test',
  payload: {},
};

export const unknownFieldFixture = {
  ...validObjectFixture,
  futureFieldNotInContract: { enabled: true },
};

export const missingFieldFixture = {};

export const changedFormatFixture = [validObjectFixture];

export const sensitiveFieldFixture = {
  fixtureKind: 'synthetic-contract-test',
  token: 'fixture-secret-that-must-never-be-returned',
  nested: {
    email: 'fixture@example.invalid',
    cookie: 'fixture-cookie-that-must-never-be-returned',
    serialNumber: 'fixture-private-device-id',
  },
};
