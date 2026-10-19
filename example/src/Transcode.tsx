import { useRef, useState } from 'react';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import {
  Image as RNImage,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Image,
  transcode,
  type TranscodedImage,
} from '@obitrain/react-native-image';
import { Button } from './App';
import { ASSET } from './Demo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { screenStyle } from './screen';

type Sample = { id: string; label: string; uri: () => string; bytes: number };

const asset = (module: number) => () =>
  RNImage.resolveAssetSource(module)?.uri ?? '';

// `bytes`: input size, for the before/after comparison.
const SAMPLES: Sample[] = [
  {
    id: 'heic',
    label: 'HEIC 1280×720',
    uri: asset(require('./assets/photo-heic.bin')),
    bytes: 93_548,
  },
  {
    id: 'webp',
    label: 'WebP 1280×720',
    uri: asset(require('./assets/photo.webp')),
    bytes: 59_516,
  },
  {
    id: 'png',
    label: 'PNG with alpha',
    uri: asset(require('./assets/icon.png')),
    bytes: 0,
  },
  { id: 'jpeg', label: 'JPEG over https', uri: () => ASSET, bytes: 105_199 },
];

/** Newest library photo: a `ph://` (iOS) or `content://` (Android) URI, as an app's picker returns. */
async function latestPhoto(): Promise<Sample> {
  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(
      Number(Platform.Version) >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    );
  }
  const { edges } = await CameraRoll.getPhotos({
    first: 1,
    assetType: 'Photos',
    include: ['fileSize', 'fileExtension', 'imageSize'],
  });
  const photo = edges[0]?.node;
  if (!photo) throw new Error('The photo library is empty');
  const { uri, extension, width, height, fileSize } = photo.image;
  return {
    id: 'library',
    label: `Library ${extension ?? ''} ${width}×${height}`.trim(),
    uri: () => uri,
    bytes: fileSize ?? 0,
  };
}

const MAX_SIZES = [256, 512, 1024];

type Run = {
  /** Stable per-run id for testIDs: rows are listed newest first. */
  n: number;
  sample: Sample;
  result?: TranscodedImage;
  ms: number;
  error?: string;
};

export function Transcode({ onBack }: { onBack: () => void }) {
  const [maxSize, setMaxSize] = useState(512);
  const [runs, setRuns] = useState<Run[]>([]);
  const seq = useRef(0);

  const run = async (pick: Sample | (() => Promise<Sample>)) => {
    let sample: Sample = {
      id: 'library',
      label: 'Library',
      uri: () => '',
      bytes: 0,
    };
    let start = Date.now();
    try {
      sample = typeof pick === 'function' ? await pick() : pick;
      start = Date.now();
      const result = await transcode(sample.uri(), { maxSize, quality: 0.85 });
      setRuns((previous) => [
        { n: seq.current++, sample, result, ms: Date.now() - start },
        ...previous,
      ]);
    } catch (e) {
      setRuns((previous) => [
        { n: seq.current++, sample, ms: Date.now() - start, error: String(e) },
        ...previous,
      ]);
    }
  };

  return (
    <SafeAreaView style={screenStyle}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button testID="back" label="Back" onPress={onBack} />
        <Text style={styles.h}>Max size (longest side)</Text>
        <View style={styles.row}>
          {MAX_SIZES.map((size) => (
            <Button
              key={size}
              testID={`maxSize-${size}`}
              label={`${size}px`}
              active={maxSize === size}
              onPress={() => setMaxSize(size)}
            />
          ))}
        </View>
        <Text style={styles.h}>Transcode to JPEG (quality 0.85)</Text>
        {SAMPLES.map((sample) => (
          <Button
            key={sample.id}
            testID={`transcode-${sample.id}`}
            label={sample.label}
            onPress={() => run(sample)}
          />
        ))}
        <Button
          testID="transcode-library"
          label="Latest library photo"
          onPress={() => run(latestPhoto)}
        />
        {runs.map((entry) => (
          <View
            key={entry.n}
            style={styles.result}
            testID={`result-${entry.n}`}
          >
            {entry.result && (
              <Image
                source={{ uri: entry.result.uri }}
                style={styles.preview}
                resizeMode="contain"
              />
            )}
            <View style={styles.meta}>
              <Text testID={`resultLabel-${entry.n}`} style={styles.label}>
                {entry.sample.label}
              </Text>
              {entry.result ? (
                <>
                  <Text testID={`resultSize-${entry.n}`}>
                    {`${entry.result.width}×${entry.result.height}`}
                  </Text>
                  <Text>
                    {formatBytes(entry.result.size)}
                    {entry.sample.bytes > 0 &&
                      ` (was ${formatBytes(entry.sample.bytes)})`}{' '}
                    · {entry.ms.toFixed(0)} ms
                  </Text>
                </>
              ) : (
                <Text testID={`resultError-${entry.n}`} style={styles.error}>
                  {entry.error}
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  h: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  row: { flexDirection: 'row', gap: 8 },
  result: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  preview: { width: 96, height: 96, backgroundColor: '#eee' },
  meta: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontWeight: '600' },
  error: { color: '#b00020' },
});
