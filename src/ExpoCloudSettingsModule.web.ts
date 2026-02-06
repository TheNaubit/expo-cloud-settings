import { registerWebModule, NativeModule } from 'expo';

import { ExpoCloudSettingsModuleEvents } from './ExpoCloudSettings.types';

class ExpoCloudSettingsModule extends NativeModule<ExpoCloudSettingsModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoCloudSettingsModule, 'ExpoCloudSettingsModule');
