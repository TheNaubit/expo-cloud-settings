import { NativeModule, requireNativeModule } from 'expo';

import { CloudSettingsModuleEvents } from './CloudSettings.types';

declare class ExpoCloudSettingsModule extends NativeModule<CloudSettingsModuleEvents> {
  setString(key: string, value: string): void;
  getString(key: string): string | null;
  remove(key: string): void;
  getAllKeys(): string[];
  clear(): void;
  isAvailable(): boolean;
}

export default requireNativeModule<ExpoCloudSettingsModule>('ExpoCloudSettings');
