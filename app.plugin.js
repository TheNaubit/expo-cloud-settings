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
    // iCloud Key-Value Storage identifier
    mod.modResults['com.apple.developer.ubiquity-kvstore-identifier'] =
      options.containerIdentifier ??
      '$(TeamIdentifierPrefix)$(CFBundleIdentifier)';

    // Enable iCloud capability so EAS Build / Xcode can create a
    // provisioning profile that includes iCloud.
    // See: https://docs.expo.dev/build-reference/ios-capabilities/
    if (!mod.modResults['com.apple.developer.icloud-container-identifiers']) {
      mod.modResults['com.apple.developer.icloud-container-identifiers'] = [];
    }
    if (!mod.modResults['com.apple.developer.icloud-services']) {
      mod.modResults['com.apple.developer.icloud-services'] = ['CloudKit'];
    }

    return mod;
  });
};
