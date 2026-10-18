import { NitroModules } from 'react-native-nitro-modules';
import type {
  ImageTranscoder,
  TranscodedImage,
  TranscodeOptions,
} from './ImageTranscoder.nitro';

let transcoder: ImageTranscoder | undefined;

/** Re-encode `uri` as a JPEG whose longest side is at most `maxSize` (default 2048 px, quality 0.85). */
export function transcode(
  uri: string,
  { maxSize = 2048, quality = 0.85 }: Partial<TranscodeOptions> = {}
): Promise<TranscodedImage> {
  transcoder ??=
    NitroModules.createHybridObject<ImageTranscoder>('ImageTranscoder');
  return transcoder.transcode(uri, { maxSize, quality });
}
