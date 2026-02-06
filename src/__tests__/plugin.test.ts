import { ExpoConfig } from 'expo/config';
import { withEntitlementsPlist } from 'expo/config-plugins';

const withCloudSettings = require('../../app.plugin.js');

jest.mock('expo/config-plugins', () => ({
  withEntitlementsPlist: jest.fn((config, callback) => {
    const mod = {
      ...config,
      modResults: {},
    };
    callback(mod);
    return mod;
  }),
}));

const baseConfig: ExpoConfig = {
  name: 'TestApp',
  slug: 'test-app',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('config plugin', () => {
  test('adds iCloud KVS entitlement with default identifier', () => {
    const result = withCloudSettings(baseConfig) as any;
    expect(result.modResults['com.apple.developer.ubiquity-kvstore-identifier']).toBe(
      '$(TeamIdentifierPrefix)$(CFBundleIdentifier)'
    );
  });

  test('uses custom containerIdentifier when provided', () => {
    const result = withCloudSettings(baseConfig, {
      containerIdentifier: 'com.example.custom',
    }) as any;
    expect(result.modResults['com.apple.developer.ubiquity-kvstore-identifier']).toBe(
      'com.example.custom'
    );
  });

  test('calls withEntitlementsPlist', () => {
    withCloudSettings(baseConfig);
    expect(withEntitlementsPlist).toHaveBeenCalledWith(
      baseConfig,
      expect.any(Function)
    );
  });

  test('throws on empty containerIdentifier', () => {
    expect(() =>
      withCloudSettings(baseConfig, { containerIdentifier: '' })
    ).toThrow('containerIdentifier must be a non-empty string');
  });

  test('throws on non-string containerIdentifier', () => {
    expect(() =>
      withCloudSettings(baseConfig, { containerIdentifier: 123 as any })
    ).toThrow('containerIdentifier must be a non-empty string');
  });
});
