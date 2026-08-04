import { View } from "react-native";
import { t } from "../lib/i18n";
import BuyerNav from "../components/BuyerNav";
import { BuyerHero } from "../components/BuyerLayout";
import BuyerProductFeed from "../components/BuyerProductFeed";
import { BuyerScreenRoot } from "../components/BuyerScreenScaffold";

/** `/app/products` equivalent — same feed as Discover products mode. */
export default function ProductsScreen() {
  return (
    <BuyerScreenRoot>
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
    </BuyerScreenRoot>
  );
}
