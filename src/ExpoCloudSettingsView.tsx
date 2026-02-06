import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoCloudSettingsViewProps } from './ExpoCloudSettings.types';

const NativeView: React.ComponentType<ExpoCloudSettingsViewProps> =
  requireNativeView('ExpoCloudSettings');

export default function ExpoCloudSettingsView(props: ExpoCloudSettingsViewProps) {
  return <NativeView {...props} />;
}
