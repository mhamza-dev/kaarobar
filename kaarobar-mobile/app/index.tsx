import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors, getSession } from "../lib/api";

export default function Index() {
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
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return <Redirect href={authed ? "/app/dashboard" : "/landing"} />;
}
