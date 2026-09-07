import { useCallback, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { Demo } from './Demo';
import {
  Bench,
  type BenchMode,
  type BenchVariant,
  type BenchResult,
} from './Bench';

type Job = { variant: BenchVariant; run: string; cached: boolean };

type Screen = 'home' | 'demo' | 'bench';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [variant, setVariant] = useState<BenchVariant>('obi');
  const [mode, setMode] = useState<BenchMode>('thumb');
  const [run, setRun] = useState('');
  const [cached, setCached] = useState(false);
  const [history, setHistory] = useState<BenchResult[]>([]);
  const queue = useRef<Job[]>([]);
  const [suite, setSuite] = useState(false);
  const [comparison, setComparison] = useState<BenchResult[]>([]);
  const [cacheRuns, setCacheRuns] = useState<Record<string, string>>({});
  const onComplete = useCallback((result: BenchResult) => {
    setHistory((previous) => [result, ...previous].slice(0, 12));
    if (queue.current.length) {
      setComparison((previous) => [...previous, result]);
      queue.current.shift();
      const next = queue.current[0];
      if (next) {
        setVariant(next.variant);
        setRun(next.run);
        setCached(next.cached);
      } else {
        setSuite(false);
        setScreen('home');
      }
    }
  }, []);

  if (screen === 'demo') return <Demo onBack={() => setScreen('home')} />;
  if (screen === 'bench')
    return (
      <Bench
        key={`${run}/${cached}`}
        variant={variant}
        mode={mode}
        run={run}
        cached={cached}
        onComplete={onComplete}
        onBack={() => {
          queue.current = [];
          setSuite(false);
          setScreen('home');
        }}
        progressLabel={
          suite ? `Run ${7 - queue.current.length}/6 · ${mode}` : undefined
        }
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
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setRun(id);
            setCached(false);
            setCacheRuns((previous) => ({
              ...previous,
              [`${variant}/${mode}`]: id,
            }));
            setScreen('bench');
          }}
        />
        <Button
          testID="runAll"
          label={`Run all libraries · ${mode} (cold + cached)`}
          onPress={() => {
            const batch = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const jobs: Job[] = (
              ['rn', 'fast', 'obi'] as BenchVariant[]
            ).flatMap((value) => [
              { variant: value, run: `${batch}-${value}`, cached: false },
              { variant: value, run: `${batch}-${value}`, cached: true },
            ]);
            queue.current = jobs;
            setComparison([]);
            setSuite(true);
            setVariant(jobs[0]!.variant);
            setRun(jobs[0]!.run);
            setCached(false);
            setScreen('bench');
          }}
        />
        {comparison.length > 0 && <Comparison results={comparison} />}
        {cacheRuns[`${variant}/${mode}`] && (
          <Button
            label="Repeat with cached URLs"
            onPress={() => {
              setRun(cacheRuns[`${variant}/${mode}`]!);
              setCached(true);
              setScreen('bench');
            }}
          />
        )}
        {history.length > 0 && (
          <View style={styles.history}>
            <Text style={styles.section}>Comparisons · this session</Text>
            {history.map((entry, i) => (
              <Text key={i}>
                {entry.variant} / {entry.mode} ·{' '}
                {entry.cached ? 'cached' : 'cold'}
                {'\n'}
                {entry.loaded}/60 loaded · {entry.failed} failed ·{' '}
                {entry.pending} incomplete{'\n'}Median{' '}
                {entry.median?.toFixed(0) ?? '—'} ms · p95{' '}
                {entry.p95?.toFixed(0) ?? '—'} ms
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Comparison({ results }: { results: BenchResult[] }) {
  return (
    <View style={styles.history}>
      <Text style={styles.title}>Comparison · {results[0]?.mode}</Text>
      <Text style={styles.section}>
        {results.length}/6 runs · load times in ms · lower is better
      </Text>
      {[false, true].map((cachedRun) => {
        const entries = results.filter((entry) => entry.cached === cachedRun);
        const max = Math.max(1, ...entries.map((entry) => entry.p95 ?? 0));
        return (
          <View key={String(cachedRun)} style={styles.history}>
            <Text style={styles.tableHeading}>
              {cachedRun ? 'Cached repeat' : 'Cold URLs'}
            </Text>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Library</Text>
              <Text style={styles.cell}>Loaded</Text>
              <Text style={styles.cell}>Median (ms)</Text>
              <Text style={styles.cell}>p95 (ms)</Text>
            </View>
            {entries.map((entry) => (
              <View key={entry.variant} style={styles.history}>
                <View style={styles.tableRow}>
                  <Text style={styles.cell}>{entry.variant}</Text>
                  <Text style={styles.cell}>{entry.loaded}/60</Text>
                  <Text style={styles.cell}>
                    {entry.median === null
                      ? '—'
                      : `${entry.median.toFixed(0)} ms`}
                  </Text>
                  <Text style={styles.cell}>
                    {entry.p95 === null ? '—' : `${entry.p95.toFixed(0)} ms`}
                  </Text>
                </View>
                {(entry.failed > 0 || entry.pending > 0) && (
                  <Text>
                    {entry.failed} failed · {entry.pending} incomplete
                  </Text>
                )}
                <View
                  accessible
                  accessibilityLabel={`${entry.variant}: median ${entry.median?.toFixed(0) ?? 'unavailable'} ms, p95 ${entry.p95?.toFixed(0) ?? 'unavailable'} ms`}
                  style={styles.track}
                >
                  <View
                    style={[
                      styles.p95Bar,
                      { width: `${((entry.p95 ?? 0) / max) * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.medianBar,
                      { width: `${((entry.median ?? 0) / max) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        );
      })}
      <Text style={styles.section}>
        Dark bar: median (ms) · light bar: p95 (ms). Separate scales for
        cold/cached. Incomplete runs are not directly comparable.
      </Text>
    </View>
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
  tableHeading: { fontSize: 15, fontWeight: '600', marginTop: 12 },
  tableRow: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, fontSize: 13, fontVariant: ['tabular-nums'] },
  track: {
    height: 12,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  p95Bar: { position: 'absolute', height: 12, backgroundColor: '#9bc9c7' },
  medianBar: { position: 'absolute', height: 12, backgroundColor: '#0E6E6B' },
  history: { gap: 8 },
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
