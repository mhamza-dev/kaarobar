import { View, StyleSheet } from "react-native";
import { colors } from "../lib/api";
import { t } from "../lib/i18n";
import BuyerNav from "../components/BuyerNav";
import { BuyerHero } from "../components/BuyerLayout";
import BuyerProductFeed from "../components/BuyerProductFeed";

/** `/app/products` equivalent — same feed as Discover products mode. */
export default function ProductsScreen() {
  return (
    <View style={styles.root}>
      <BuyerProductFeed
        ListHeaderComponent={
          <View>
            <BuyerHero
              eyebrow={t("marketplace.eyebrow")}
              title={t("pages.productsTitle")}
              description={t("marketplace.productsHero")}
            />
            <BuyerNav />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
});
