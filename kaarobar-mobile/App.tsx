import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "./src/components/Toast";
import { BrandThemeProvider } from "./src/lib/BrandThemeContext";
import RootNavigator from "./src/navigation/RootNavigator";

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <BrandThemeProvider>
          <StatusBar barStyle="dark-content" />
          <RootNavigator />
        </BrandThemeProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

export default App;
