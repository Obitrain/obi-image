import { getHostComponent } from 'react-native-nitro-modules';
import type { ImageViewMethods, ImageViewProps } from './ImageView.nitro';
const ImageViewConfig = require('../nitrogen/generated/shared/json/ObitrainImageViewConfig.json');

export const NativeImageView = getHostComponent<ImageViewProps, ImageViewMethods>(
  'ObitrainImageView',
  () => ImageViewConfig
);
