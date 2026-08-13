import type { PropsWithChildren, ReactNode } from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

type ScreenCardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  headerRight?: ReactNode;
}>;

export default function ScreenCard({
  title,
  subtitle,
  style,
  titleStyle,
  subtitleStyle,
  headerRight,
  children,
}: ScreenCardProps) {
  return (
    <View style={style}>
      {title || subtitle || headerRight ? (
        <View style={{ marginBottom: 8 }}>
          {title || headerRight ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              {title ? <Text style={titleStyle}>{title}</Text> : <View />}
              {headerRight}
            </View>
          ) : null}
          {subtitle ? <Text style={subtitleStyle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
