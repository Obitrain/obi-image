import type { ColorValue, ViewProps } from 'react-native';

type Props = ViewProps & {
  color?: ColorValue;
};

export function ReactNativeImageView(_props: Props): never {
  throw new Error(
    "'@obitrain/react-native-image' is only supported on native platforms."
  );
}
