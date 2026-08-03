import React, { useState } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./src/components/Toast";
import { BrandThemeProvider } from "./src/lib/BrandThemeContext";
import { CartProvider } from "./src/lib/cart";
import { makeQueryClient } from "./src/lib/queryClient";
import RootNavigator from "./src/navigation/RootNavigator";

function App(): React.JSX.Element {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrandThemeProvider>
            <CartProvider>
              <StatusBar barStyle="dark-content" />
              <RootNavigator />
            </CartProvider>
          </BrandThemeProvider>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default App;
