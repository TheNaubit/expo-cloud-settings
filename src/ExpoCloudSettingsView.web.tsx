import * as React from 'react';

import { ExpoCloudSettingsViewProps } from './ExpoCloudSettings.types';

export default function ExpoCloudSettingsView(props: ExpoCloudSettingsViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
