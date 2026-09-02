import {
  FlatList,
  Image as RNImage,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { Image } from '@obitrain/react-native-image';
import { Button } from './App';
import { ASSET } from './Demo';

export type BenchVariant = 'rn' | 'fast' | 'obi';
export type BenchMode = 'thumb' | 'card' | 'classic';
const COUNT = 60;

export function Bench({
  variant,
  mode,
  run,
  onBack,
}: {
  variant: BenchVariant;
  mode: BenchMode;
  run: number;
  onBack: () => void;
}) {
  const { width } = useWindowDimensions();
  // Distinct URL per variant×mode×row: every row is its own cache entry and each run starts cold.
  const data = Array.from({ length: COUNT }, (_, i) => ({
    key: String(i),
    uri: `${ASSET}?v=${variant}-${mode}-r${run}-${i}`,
  }));
  const imageStyle =
    mode === 'thumb'
      ? styles.thumb
      : mode === 'card'
        ? { width: width - 32, height: 250 }
        : styles.classic;
  const rowHeight = mode === 'thumb' ? 70 : mode === 'card' ? 270 : 220;

  const renderImage = (uri: string) => {
    if (variant === 'rn')
      return <RNImage source={{ uri }} resizeMode="cover" style={imageStyle} />;
    if (variant === 'fast')
      // FastImage 8.13 types reference RN style types removed in 0.87 (types-only).
      return (
        <FastImage
          source={{ uri }}
          resizeMode={FastImage.resizeMode.cover}
          style={imageStyle as any}
        />
      );
    return <Image source={{ uri }} resizeMode="cover" style={imageStyle} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button testID="back" label="Back" onPress={onBack} />
        <Text
          testID="benchTitle"
          style={styles.title}
        >{`${variant} / ${mode} × ${COUNT} (run ${run})`}</Text>
      </View>
      <FlatList
        testID="benchList"
        data={data}
        keyExtractor={(item) => item.key}
        // Small render window so rows (and their image loads) are driven by the scroll, not mounted all at once.
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
            {renderImage(item.uri)}
            <Text style={styles.label}>{item.key}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  title: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  thumb: { width: 70, height: 50, borderRadius: 10 },
  classic: { width: 300, height: 200 },
  label: { fontSize: 14 },
});
