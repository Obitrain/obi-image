import { NitroModules } from 'react-native-nitro-modules';
import type { ImagePrefetcher } from './ImagePrefetcher.nitro';

let prefetcher: ImagePrefetcher | undefined;

/** Fetch `urls` into the cache ahead of time (e.g. the next screen's thumbnails). Errors are swallowed per URL. */
export function prefetch(urls: string[]): Promise<void> {
  if (urls.length === 0) return Promise.resolve();
  prefetcher ??=
    NitroModules.createHybridObject<ImagePrefetcher>('ImagePrefetcher');
  return prefetcher.prefetch(urls);
}
