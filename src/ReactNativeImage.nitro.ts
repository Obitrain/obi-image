import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules';

export interface ReactNativeImageProps extends HybridViewProps {
  color: string;
}
export interface ReactNativeImageMethods extends HybridViewMethods {}

export type ReactNativeImage = HybridView<
  ReactNativeImageProps,
  ReactNativeImageMethods
>;
