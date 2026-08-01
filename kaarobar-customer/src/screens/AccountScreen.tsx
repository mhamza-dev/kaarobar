import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath } from "../lib/nav";
import {
  clearSession,
  colors,
  getSession,
  isConsumerSession,
  type Session,
} from "../lib/api";
import { loadLocale, t } from "../lib/i18n";
import KaarobarLogo from "../components/KaarobarLogo";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function AccountScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [session, setLocal] = useState<Session | null>(null);
  const [localeTick, setLocaleTick] = useState(0);

  useEffect(() => {
    (async () => {
      await loadLocale();
      const s = await getSession();
      if (!s || !isConsumerSession(s)) {
        replacePath(navigation, "/landing");
        return;
      }
      setLocal(s);
    })();
  }, [navigation]);

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.root} key={localeTick}>
      <View style={styles.brand}>
        <KaarobarLogo size={44} />
        <View>
          <Text style={styles.name}>
            {session.account?.name || session.user.name}
          </Text>
          <Text style={styles.email}>
            {session.account?.email || session.user.email}
          </Text>
        </View>
      </View>

      <LanguageSwitcher onChange={() => setLocaleTick((n) => n + 1)} />

      <Pressable
        style={styles.logout}
        onPress={async () => {
          await clearSession();
          replacePath(navigation, "/landing");
        }}
      >
        <Text style={styles.logoutText}>{t("common.signOut")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary, padding: 20 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  name: { fontSize: 18, fontWeight: "800", color: colors.heading },
  email: { color: colors.muted, marginTop: 2 },
  logout: {
    backgroundColor: colors.danger,
    borderRadius: colors.radiusLg,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: colors.white, fontWeight: "700" },
});
