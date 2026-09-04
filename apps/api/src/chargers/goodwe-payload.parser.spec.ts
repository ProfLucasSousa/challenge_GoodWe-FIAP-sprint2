import {
  changedFormatFixture,
  missingFieldFixture,
  partialObjectFixture,
  sensitiveFieldFixture,
  unknownFieldFixture,
  validObjectFixture,
} from './__fixtures__/goodwe-sanitized.fixtures';
import { GoodWeMapper } from './goodwe-mapper';
import { GoodWePayloadParser } from './goodwe-payload.parser';
import { ProviderCapabilityNotSupportedError } from './provider-errors';

describe('GoodWe payload boundary', () => {
  const parser = new GoodWePayloadParser();
  const mapper = new GoodWeMapper();

  it('accepts a valid 200 object shape without claiming domain compatibility', () => {
    expect(parser.inspect(validObjectFixture)).toEqual({
      acceptedTransportShape: true,
      topLevelFields: ['fixtureKind', 'payload'],
      redactedFieldCount: 0,
      issues: [],
    });
  });

  it.each([
    ['partial payload', partialObjectFixture],
    ['missing field payload', missingFieldFixture],
    ['unknown field payload', unknownFieldFixture],
  ])('handles %s without throwing', (_name, fixture) => {
    expect(() => parser.inspect(fixture)).not.toThrow();
    expect(parser.inspect(fixture).acceptedTransportShape).toBe(true);
  });

  it('detects a root format change without crashing the process', () => {
    expect(parser.inspect(changedFormatFixture)).toMatchObject({
      acceptedTransportShape: false,
      issues: ['UNEXPECTED_ROOT_FORMAT'],
    });
  });

  it('counts and omits sensitive field names from inspection output', () => {
    const result = parser.inspect(sensitiveFieldFixture);
    expect(result.redactedFieldCount).toBe(4);
    expect(result.topLevelFields).not.toContain('token');
    expect(JSON.stringify(result)).not.toContain('fixture-secret');
    expect(JSON.stringify(result)).not.toContain('fixture@example.invalid');
    expect(result.issues).toContain('SENSITIVE_FIELDS_REDACTED');
  });

  it('keeps mapping fail-closed until an official schema is confirmed', () => {
    expect(() => mapper.mapCharger(parser.inspect(validObjectFixture))).toThrow(
      ProviderCapabilityNotSupportedError,
    );
  });
});
