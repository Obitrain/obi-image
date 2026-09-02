import { useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image, prefetch } from '@obitrain/react-native-image';
import { Button } from './App';

export const ASSET =
  'https://s3.fr-par.scw.cloud/obitrain.shared/e2e-tests/image.jpeg';
const RECYCLE_ROWS = Array.from({ length: 200 }, (_, i) => ({
  id: String(i),
  uri: `${ASSET}?r=${i}`,
}));

export function Demo({ onBack }: { onBack: () => void }) {
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [showList, setShowList] = useState(false);
  const [prefetched, setPrefetched] = useState('');

  if (showList) {
    return (
      <SafeAreaView style={styles.container}>
        <Button testID="back" label="Back" onPress={() => setShowList(false)} />
        <FlatList
          testID="recycleList"
          data={RECYCLE_ROWS}
          keyExtractor={(r) => r.id}
          getItemLayout={(_, i) => ({ length: 72, offset: 72 * i, index: i })}
          renderItem={({ item }) => (
            <View style={styles.recycleRow}>
              <Image
                source={{ uri: item.uri }}
                recyclingKey={item.id}
                style={styles.thumb}
                resizeMode="cover"
              >
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.id}</Text>
                </View>
              </Image>
              <Text style={styles.label}>row {item.id}</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button testID="back" label="Back" onPress={onBack} />

        <Text style={styles.h}>1. Network 70×50 cover (decode-to-size)</Text>
        <Image
          testID="netImage"
          source={{ uri: `${ASSET}?demo=1` }}
          resizeMode="cover"
          style={styles.thumb}
        />

        <Text style={styles.h}>2. require() + tintColor</Text>
        <View style={styles.row}>
          <Image
            testID="tintImage"
            source={require('./assets/icon.png')}
            tintColor="red"
            resizeMode="contain"
            style={styles.icon}
          />
          <Image
            testID="plainImage"
            source={require('./assets/icon.png')}
            resizeMode="contain"
            style={[styles.icon, styles.dark]}
          />
        </View>

        <Text style={styles.h}>3. Children overlay (tappable)</Text>
        <Image
          source={{ uri: `${ASSET}?demo=3` }}
          resizeMode="cover"
          style={styles.card}
        >
          <Pressable
            testID="tap"
            onPress={() => setCount((c) => c + 1)}
            style={StyleSheet.absoluteFill}
          />
        </Image>
        <Text testID="count">taps: {count}</Text>

        <Text style={styles.h}>4. onError (404)</Text>
        <Image
          testID="errImage"
          source={{ uri: ASSET.replace('image.jpeg', 'missing.jpeg') }}
          onError={() => setError('error')}
          style={styles.thumb}
        />
        <Text testID="err">{error || 'no error yet'}</Text>

        <Text style={styles.h}>5. Recycling list</Text>
        <Button
          testID="prefetch"
          label="Prefetch first 20 rows"
          onPress={() => {
            const t = Date.now();
            prefetch(RECYCLE_ROWS.slice(0, 20).map((r) => r.uri)).then(() =>
              setPrefetched(`prefetched 20 in ${Date.now() - t} ms`)
            );
          }}
        />
        <Text testID="prefetched">{prefetched || 'not prefetched'}</Text>
        <Button
          testID="goList"
          label="Open 200-row list"
          onPress={() => setShowList(true)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 8 },
  h: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  row: { flexDirection: 'row', gap: 12 },
  thumb: { width: 70, height: 50, borderRadius: 10 },
  icon: { width: 30, height: 30 },
  dark: { backgroundColor: '#333' },
  card: { width: 300, height: 120, borderRadius: 12 },
  recycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    paddingHorizontal: 12,
    gap: 12,
  },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10 },
  label: { fontSize: 14 },
});
