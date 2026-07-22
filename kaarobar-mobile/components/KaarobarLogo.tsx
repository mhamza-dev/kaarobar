import { Image, type ImageStyle, type StyleProp } from "react-native";

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Kaarobar app icon (raster) for React Native chrome. */
export default function KaarobarLogo({ size = 40, style }: Props) {
  return (
    <Image
      source={require("../assets/brand/kaarobar-icon.png")}
      style={[{ width: size, height: size, borderRadius: size * 0.22 }, style]}
      accessibilityLabel="Kaarobar"
    />
  );
}
