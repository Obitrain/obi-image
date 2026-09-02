import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { Demo } from './Demo';
import { Bench, type BenchMode, type BenchVariant } from './Bench';

type Screen = 'home' | 'demo' | 'bench';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [variant, setVariant] = useState<BenchVariant>('obi');
  const [mode, setMode] = useState<BenchMode>('thumb');
  const [run, setRun] = useState(0); // bumps per run so every run starts with cold caches

  if (screen === 'demo') return <Demo onBack={() => setScreen('home')} />;
  if (screen === 'bench')
    return (
      <Bench
        variant={variant}
        mode={mode}
        run={run}
        onBack={() => setScreen('home')}
      />
    );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>@obitrain/react-native-image</Text>
        <Button
          testID="goDemo"
          label="Demo (vertical slice)"
          onPress={() => setScreen('demo')}
        />
        <Text style={styles.section}>Bench variant</Text>
        <View style={styles.row}>
          {(['rn', 'fast', 'obi'] as BenchVariant[]).map((v) => (
            <Button
              key={v}
              testID={`variant-${v}`}
              label={v}
              active={variant === v}
              onPress={() => setVariant(v)}
            />
          ))}
        </View>
        <Text style={styles.section}>Bench mode</Text>
        <View style={styles.row}>
          {(['thumb', 'card', 'classic'] as BenchMode[]).map((m) => (
            <Button
              key={m}
              testID={`mode-${m}`}
              label={m}
              active={mode === m}
              onPress={() => setMode(m)}
            />
          ))}
        </View>
        <Button
          testID="goBench"
          label={`Run bench: ${variant} / ${mode}`}
          onPress={() => {
            setRun((r) => r + 1);
            setScreen('bench');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  testID,
  active,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  active?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.button, active && styles.buttonActive]}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, active && styles.buttonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  section: { fontSize: 13, color: '#666', marginTop: 8 },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  buttonActive: { backgroundColor: '#0E6E6B' },
  buttonText: { fontSize: 15, color: '#222' },
  buttonTextActive: { color: '#fff', fontWeight: '600' },
});
