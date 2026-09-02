import { getHostComponent } from 'react-native-nitro-modules';
import type { ImageViewMethods, ImageViewProps } from './ImageView.nitro';
import ImageViewConfig from './generated/ObitrainImageViewConfig';

export const NativeImageView = getHostComponent<ImageViewProps, ImageViewMethods>(
  'ObitrainImageView',
  () => ImageViewConfig
);
