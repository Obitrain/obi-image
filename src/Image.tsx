import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Image as RNImage,
  PixelRatio,
  StyleSheet,
  View,
  processColor,
  type ColorValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { callback } from 'react-native-nitro-modules';
import { NativeImageView } from './NativeImageView';
import type { NativeResizeMode } from './ImageView.nitro';

export type ImageSource = { uri?: string } | number;
export type ResizeMode = NativeResizeMode;

export interface ImageProps extends Omit<ViewProps, 'style'> {
  source: ImageSource;
  resizeMode?: ResizeMode;
  style?: StyleProp<ViewStyle>;
  tintColor?: ColorValue;
  onError?: () => void;
  /** Set in lists so a recycled cell never shows the previous row's image. */
  recyclingKey?: string;
  children?: ReactNode;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Numeric width/height from the style, if both are literal numbers (lets us skip the onLayout round-trip). */
function sizeFromStyle(style: StyleProp<ViewStyle>): { w: number; h: number } | null {
  const flat = StyleSheet.flatten(style) as { width?: unknown; height?: unknown } | undefined;
  const w = flat?.width, h = flat?.height;
  return typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0 ? { w, h } : null;
}

function resolveSource(source: ImageSource): { uri?: string; resource?: string } {
  if (typeof source === 'number') {
    const uri = RNImage.resolveAssetSource(source)?.uri;
    if (!uri) return {};
    return SCHEME.test(uri) ? { uri } : { resource: uri };
  }
  return { uri: source?.uri };
}

function ImageImpl({
  source,
  resizeMode = 'cover',
  style,
  tintColor,
  onError,
  recyclingKey,
  children,
  onLayout: onLayoutProp,
  ...rest
}: ImageProps) {
  const styleSize = useMemo(() => sizeFromStyle(style), [style]);
  const [layoutSize, setLayoutSize] = useState({ w: 0, h: 0 });
  const size = styleSize ?? layoutSize;
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayoutProp?.(e);
      if (styleSize) return; // size already known from style: no state round-trip, no second render
      const { width, height } = e.nativeEvent.layout;
      setLayoutSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
    },
    [onLayoutProp, styleSize]
  );
  const { uri, resource } = useMemo(() => resolveSource(source), [source]);
  const tint = useMemo(
    () => (tintColor == null ? undefined : (processColor(tintColor) as number)),
    [tintColor]
  );
  const onErrorCb = useMemo(
    () => (onError ? callback((_message: string) => onError()) : undefined),
    [onError]
  );
  const scale = PixelRatio.get();

  return (
    <View {...rest} style={[styles.container, style]} onLayout={onLayout}>
      <NativeImageView
        style={StyleSheet.absoluteFill}
        uri={uri}
        resource={resource}
        resizeMode={resizeMode}
        tintColor={tint}
        decodeWidth={Math.ceil(size.w * scale)}
        decodeHeight={Math.ceil(size.h * scale)}
        recyclingKey={recyclingKey}
        onError={onErrorCb}
      />
      {children}
    </View>
  );
}

export const Image = memo(ImageImpl);

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
