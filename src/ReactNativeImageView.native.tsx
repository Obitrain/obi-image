import { getHostComponent } from 'react-native-nitro-modules';
const ReactNativeImageConfig = require('../nitrogen/generated/shared/json/ReactNativeImageConfig.json');
import type {
  ReactNativeImageMethods,
  ReactNativeImageProps,
} from './ReactNativeImage.nitro';

export const ReactNativeImageView = getHostComponent<
  ReactNativeImageProps,
  ReactNativeImageMethods
>('ReactNativeImage', () => ReactNativeImageConfig);
