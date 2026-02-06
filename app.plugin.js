const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withCloudSettings(config, options = {}) {
  if (
    options.containerIdentifier !== undefined &&
    (typeof options.containerIdentifier !== 'string' ||
      options.containerIdentifier.trim().length === 0)
  ) {
    throw new Error(
      'expo-cloud-settings: containerIdentifier must be a non-empty string'
    );
  }

  return withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.ubiquity-kvstore-identifier'] =
      options.containerIdentifier ??
      '$(TeamIdentifierPrefix)$(CFBundleIdentifier)';
    return mod;
  });
};
