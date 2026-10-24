import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/** ⌘ on Apple keyboards, Ctrl everywhere else. The server guesses Apple. */
export function useIsApple() {
  return useSyncExternalStore(
    noSubscription,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );
}
