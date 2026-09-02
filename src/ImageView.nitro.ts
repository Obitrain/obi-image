import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules';

export type NativeResizeMode = 'cover' | 'contain' | 'center' | 'stretch';

export interface ImageViewProps extends HybridViewProps {
  /** http(s):// or file:// URL. */
  uri?: string;
  /** Bundled asset name (iOS `UIImage(named:)`, Android drawable). */
  resource?: string;
  resizeMode?: NativeResizeMode;
  /** ARGB int from `processColor()`; undefined = no tint. */
  tintColor?: number;
  /** Decode target in PIXELS; <= 0 means "not laid out yet", native waits. */
  decodeWidth?: number;
  decodeHeight?: number;
  /** Changing it clears the current image before the next load (list recycling). */
  recyclingKey?: string;
  onError?: (message: string) => void;
}
export interface ImageViewMethods extends HybridViewMethods {}

export type ObitrainImageView = HybridView<ImageViewProps, ImageViewMethods>;
