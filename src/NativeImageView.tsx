import type { ReactNativeView } from 'react-native-nitro-modules';
import type { ImageViewMethods, ImageViewProps } from './ImageView.nitro';

// Non-native platforms: the native view does not exist.
export const NativeImageView = (() => {
  throw new Error(
    "'@obitrain/react-native-image' is only supported on native platforms."
  );
}) as unknown as ReactNativeView<ImageViewProps, ImageViewMethods>;
