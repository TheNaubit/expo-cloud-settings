export type CloudSettingsChangeReason =
  'serverChange' | 'initialSync' | 'quotaViolation' | 'accountChange';

export type CloudSettingsChangeEvent = {
  readonly changedKeys: readonly string[];
  readonly reason: CloudSettingsChangeReason;
};

export type CloudSettingsSubscription = {
  remove(): void;
};

export type CloudSettingsModuleEvents = {
  onStoreChanged: (event: CloudSettingsChangeEvent) => void;
};
