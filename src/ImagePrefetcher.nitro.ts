import type { HybridObject } from 'react-native-nitro-modules';

/** Warms the disk cache (and, on iOS, the memory cache of originals) for URLs about to be shown. */
export interface ImagePrefetcher extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /** Resolves when every URL has been fetched (failures are ignored, they just stay uncached). */
  prefetch(urls: string[]): Promise<void>;
}
