import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useBrandPalette, useTheme } from "@/theme";

type BrandButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  variant?: "primary" | "soft" | "ghost";
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

/** Primary CTA that follows the active business brand palette. */
export function BrandButton({
  label,
  variant = "primary",
  disabled,
  style,
  labelStyle,
  ...rest
}: BrandButtonProps) {
  const theme = useTheme();
  const palette = useBrandPalette();

  const bg =
    variant === "primary"
      ? palette.brand
      : variant === "soft"
        ? palette.brandSoft
        : "transparent";
  const fg =
    variant === "primary"
      ? palette.brandForeground
      : variant === "soft"
        ? palette.brand
        : palette.brand;

  return (
    <Pressable
      disabled={disabled}
      style={[
        {
          backgroundColor: bg,
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          alignItems: "center",
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text style={[{ color: fg, fontWeight: "700", fontSize: 15 }, labelStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

type BrandTextInputProps = TextInputProps & {
  focusedBorder?: boolean;
};

/** Text input with brand selection/focus accent. */
export function BrandTextInput({
  style,
  focusedBorder = true,
  onFocus,
  onBlur,
  ...rest
}: BrandTextInputProps) {
  const theme = useTheme();
  const palette = useBrandPalette();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={theme.muted}
      selectionColor={palette.brand}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        {
          borderWidth: 1,
          borderColor: focused && focusedBorder ? palette.brand : theme.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: theme.heading,
          backgroundColor: theme.card,
        },
        style,
      ]}
      {...rest}
    />
  );
}
