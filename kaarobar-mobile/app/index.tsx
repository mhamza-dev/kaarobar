import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors, getSession } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";

export default function Index() {
  const palette = useBrandPalette();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    getSession().then((s) => {
      setAuthed(!!s);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary }}>
        <ActivityIndicator color={palette.brand} />
      </View>
    );
  }

  return <Redirect href={authed ? "/app/dashboard" : "/landing"} />;
}
