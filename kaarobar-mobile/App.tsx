import React, { useState } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./src/components/Toast";
import { BrandThemeProvider } from "./src/lib/BrandThemeContext";
import { SessionProvider } from "./src/lib/SessionContext";
import { makeQueryClient } from "./src/lib/queryClient";
import RootNavigator from "./src/navigation/RootNavigator";

function App(): React.JSX.Element {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <BrandThemeProvider>
              <StatusBar barStyle="dark-content" />
              <RootNavigator />
            </BrandThemeProvider>
          </ToastProvider>
        </QueryClientProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

export default App;