import { memo, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image as RNImage,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { Image } from '@obitrain/react-native-image';
import { Button } from './App';
import { ASSET } from './Demo';

export type BenchVariant = 'rn' | 'fast' | 'obi';
export type BenchMode = 'thumb' | 'card' | 'classic';
export type BenchResult = {
  variant: BenchVariant;
  mode: BenchMode;
  cached: boolean;
  loaded: number;
  failed: number;
  pending: number;
  median: number | null;
  p95: number | null;
};
declare const performance: { now(): number };
const COUNT = 60;

type Row = { key: string; uri: string };
const BenchImage = memo(function MeasuredImage({
  item,
  variant,
  imageStyle,
  report,
}: {
  item: Row;
  variant: BenchVariant;
  imageStyle: StyleProp<ImageStyle>;
  report: (id: string, time: number | null) => void;
}) {
  const started = useRef(performance.now());
  const onLoad = () => report(item.key, performance.now() - started.current);
  const onError = () => report(item.key, null);
  if (variant === 'rn')
    return (
      <RNImage
        source={{ uri: item.uri }}
        resizeMode="cover"
        style={imageStyle}
        onLoad={onLoad}
        onError={onError}
      />
    );
  if (variant === 'fast')
    return (
      <FastImage
        source={{ uri: item.uri }}
        resizeMode={FastImage.resizeMode.cover}
        style={imageStyle as any}
        onLoad={onLoad}
        onError={onError}
      />
    );
  return (
    <Image
      source={{ uri: item.uri }}
      resizeMode="cover"
      style={imageStyle}
      onLoad={onLoad}
      onError={onError}
    />
  );
});

export function Bench({
  variant,
  mode,
  run,
  cached,
  onBack,
  onComplete,
  progressLabel,
}: {
  variant: BenchVariant;
  mode: BenchMode;
  run: string;
  cached: boolean;
  onBack: () => void;
  progressLabel?: string;
  onComplete: (result: BenchResult) => void;
}) {
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Row>>(null);
  const [data] = useState(() =>
    Array.from({ length: COUNT }, (_, i) => ({
      key: String(i),
      uri: `${ASSET}?bench=${run}-${i}`,
    }))
  );
  const records = useRef(new Map<string, number | null>());
  const finished = useRef(false);
  const [result, setResult] = useState<BenchResult | null>(null);
  const [progress, setProgress] = useState('Auto-scroll · 10 seconds');
  const report = useRef((id: string, time: number | null) => {
    if (!finished.current && !records.current.has(id))
      records.current.set(id, time);
  }).current;
  const rowHeight = mode === 'thumb' ? 70 : mode === 'card' ? 270 : 220;
  const imageStyle =
    mode === 'thumb'
      ? styles.thumb
      : mode === 'card'
        ? { width: width - 80, height: 250 }
        : styles.classic;
  useEffect(() => {
    finished.current = false;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step <= 10)
        list.current?.scrollToOffset({
          offset: Math.min(step * 6, COUNT - 1) * rowHeight,
          animated: false,
        });
      if (step === 10) setProgress('Waiting for remaining images…');
      if (step >= 10 && (records.current.size === COUNT || step >= 20)) {
        finished.current = true;
        clearInterval(timer);
        const times = [...records.current.values()]
          .filter((value): value is number => value !== null)
          .sort((a, b) => a - b);
        const summary: BenchResult = {
          variant,
          mode,
          cached,
          loaded: times.length,
          failed: records.current.size - times.length,
          pending: COUNT - records.current.size,
          median: times.length
            ? (times[Math.floor((times.length - 1) / 2)]! +
                times[Math.floor(times.length / 2)]!) /
              2
            : null,
          p95: times[Math.ceil(times.length * 0.95) - 1] ?? null,
        };
        setResult(summary);
        onComplete(summary);
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      finished.current = true;
    };
  }, [cached, mode, onComplete, rowHeight, variant]);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {progressLabel && <Text>{progressLabel}</Text>}
        <Button testID="back" label="Back" onPress={onBack} />
        <Text style={styles.title}>
          {variant} / {mode} · {cached ? 'cached repeat' : 'cold URLs'}
        </Text>
        <Text>
          {result
            ? `${result.loaded}/60 loaded · ${result.failed} failed · ${result.pending} incomplete`
            : progress}
        </Text>
        {result && (
          <Text>
            Median {result.median?.toFixed(0) ?? '—'} ms · p95{' '}
            {result.p95?.toFixed(0) ?? '—'} ms
          </Text>
        )}
        <Text style={styles.note}>
          Mount → load callback, including network/decode. Same scroll cadence;
          cached repeats reuse URLs, cache hits are not guaranteed.
        </Text>
      </View>
      <FlatList
        ref={list}
        testID="benchList"
        data={data}
        scrollEnabled={!!result}
        keyExtractor={(item) => item.key}
        windowSize={3}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        getItemLayout={(_, i) => ({
          length: rowHeight,
          offset: rowHeight * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <View style={[styles.row, { height: rowHeight }]}>
            <BenchImage
              item={item}
              variant={variant}
              imageStyle={imageStyle}
              report={report}
            />
            <Text>{item.key}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { gap: 8, padding: 12 },
  title: { fontSize: 14, fontWeight: '600' },
  note: { fontSize: 12, color: '#666' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  thumb: { width: 70, height: 50, borderRadius: 10 },
  classic: { width: 300, height: 200 },
});
