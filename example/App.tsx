import {
  CloudSettingsProvider,
  isAvailable,
  useCloudSetting,
  useCloudSettingBool,
  addChangeListener,
  CloudSettingsChangeEvent,
} from 'expo-cloud-settings';
import { useEffect, useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text, View, StyleSheet } from 'react-native';

function Settings() {
  const available = isAvailable();
  const [username, setUsername] = useCloudSetting('username', 'Guest');
  const [darkMode, setDarkMode] = useCloudSettingBool('darkMode', false);
  const [lastEvent, setLastEvent] = useState<CloudSettingsChangeEvent | null>(null);

  useEffect(() => {
    const subscription = addChangeListener((event) => {
      setLastEvent(event);
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.dark]}>
      <ScrollView style={styles.container}>
        <Text style={[styles.header, darkMode && styles.lightText]}>
          Cloud Settings Demo
        </Text>

        <Group name="Platform" darkMode={darkMode}>
          <Text style={darkMode && styles.lightText}>
            iCloud available: {String(available)}
          </Text>
        </Group>

        <Group name="String Setting" darkMode={darkMode}>
          <Text style={darkMode && styles.lightText}>Username: {username}</Text>
          <Button title="Set to Alice" onPress={() => setUsername('Alice')} />
          <Button title="Set to Bob" onPress={() => setUsername('Bob')} />
          <Button title="Clear" onPress={() => setUsername(null)} />
        </Group>

        <Group name="Bool Setting" darkMode={darkMode}>
          <Text style={darkMode && styles.lightText}>
            Dark mode: {String(darkMode)}
          </Text>
          <Button
            title="Toggle Dark Mode"
            onPress={() => setDarkMode(!darkMode)}
          />
        </Group>

        <Group name="Change Events" darkMode={darkMode}>
          {lastEvent ? (
            <>
              <Text style={darkMode && styles.lightText}>
                Reason: {lastEvent.reason}
              </Text>
              <Text style={darkMode && styles.lightText}>
                Changed keys: {lastEvent.changedKeys.join(', ')}
              </Text>
            </>
          ) : (
            <Text style={darkMode && styles.lightText}>
              No sync events yet. Change a value on another device.
            </Text>
          )}
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <CloudSettingsProvider>
      <Settings />
    </CloudSettingsProvider>
  );
}

function Group(props: { name: string; darkMode: boolean | null; children: React.ReactNode }) {
  return (
    <View style={[styles.group, props.darkMode && styles.groupDark]}>
      <Text style={[styles.groupHeader, props.darkMode && styles.lightText]}>
        {props.name}
      </Text>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 30,
    margin: 20,
    fontWeight: 'bold',
  },
  groupHeader: {
    fontSize: 20,
    marginBottom: 12,
    fontWeight: '600',
  },
  group: {
    margin: 20,
    marginTop: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  groupDark: {
    backgroundColor: '#333',
  },
  container: {
    flex: 1,
  },
  dark: {
    backgroundColor: '#111',
  },
  lightText: {
    color: '#eee',
  },
});
