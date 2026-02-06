export type CloudSettingsChangeReason =
  | 'serverChange'
  | 'initialSync'
  | 'quotaViolation'
  | 'accountChange';

export type CloudSettingsChangeEvent = {
  readonly changedKeys: ReadonlyArray<string>;
  readonly reason: CloudSettingsChangeReason;
};

export type CloudSettingsModuleEvents = {
  onStoreChanged: (event: CloudSettingsChangeEvent) => void;
};
