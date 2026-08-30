import { GoodWeAuthClient } from './goodwe-auth.client';
import { ProviderCapabilityNotSupportedError } from './provider-errors';

describe('GoodWeAuthClient', () => {
  it('does not reinterpret SEMS+ portal credentials as OpenAPI credentials', () => {
    const previousUser = process.env.GOODWE_SEMS_USERNAME;
    const previousPassword = process.env.GOODWE_SEMS_PASSWORD;
    process.env.GOODWE_SEMS_USERNAME = 'fixture-user@example.invalid';
    process.env.GOODWE_SEMS_PASSWORD = 'fixture-password-never-use';
    try {
      expect(() => new GoodWeAuthClient().createAuthorizationHeaders()).toThrow(
        ProviderCapabilityNotSupportedError,
      );
      try {
        new GoodWeAuthClient().createAuthorizationHeaders();
      } catch (error) {
        const serialized = JSON.stringify(error);
        expect(serialized).not.toContain(process.env.GOODWE_SEMS_USERNAME);
        expect(serialized).not.toContain(process.env.GOODWE_SEMS_PASSWORD);
      }
    } finally {
      if (previousUser === undefined) delete process.env.GOODWE_SEMS_USERNAME;
      else process.env.GOODWE_SEMS_USERNAME = previousUser;
      if (previousPassword === undefined) delete process.env.GOODWE_SEMS_PASSWORD;
      else process.env.GOODWE_SEMS_PASSWORD = previousPassword;
    }
  });
});
