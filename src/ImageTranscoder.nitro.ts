import type { HybridObject } from 'react-native-nitro-modules';

export interface TranscodeOptions {
  /** Longest side of the output, in pixels. Smaller images are never upscaled. */
  maxSize: number;
  /** JPEG quality, 0–1. */
  quality: number;
}

export interface TranscodedImage {
  /** `file://` URI of the JPEG, in the app's temporary/cache directory. */
  uri: string;
  width: number;
  height: number;
  /** File size in bytes. */
  size: number;
}

/** Re-encodes any decodable image (HEIC, PNG, WebP, JPEG…) as a downscaled JPEG, dropping its metadata. */
export interface ImageTranscoder extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /** `uri`: `file://`, `http(s)://`, `ph://` (iOS Photos) or `content://` (Android). */
  transcode(uri: string, options: TranscodeOptions): Promise<TranscodedImage>;
}
