import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/api";

export type ToastType = "info" | "success" | "error" | "warning";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 7000;

const toneStyles: Record<
  ToastType,
  { bg: string; border: string; text: string }
> = {
  info: { bg: "#e8f0ff", border: "#3b82f6", text: "#1e3a8a" },
  success: { bg: "#e8f8ef", border: "#16a34a", text: "#14532d" },
  error: { bg: "#fdecec", border: "#dc2626", text: "#7f1d1d" },
  warning: { bg: "#fff7e6", border: "#d97706", text: "#78350f" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `toast-${Date.now()}-${seq.current++}`;
      setItems((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), DEFAULT_DURATION);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info"),
      warning: (message) => push(message, "warning"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.host}>
        {items.map((item) => {
          const tone = toneStyles[item.type];
          return (
            <View
              key={item.id}
              style={[
                styles.card,
                { backgroundColor: tone.bg, borderColor: tone.border },
              ]}
            >
              <Text style={[styles.text, { color: tone.text }]}>{item.message}</Text>
              <Pressable
                accessibilityLabel="Dismiss"
                onPress={() => dismiss(item.id)}
                hitSlop={8}
                style={styles.close}
              >
                <Text style={[styles.closeText, { color: tone.text }]}>×</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 999,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  close: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  closeText: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: "700",
  },
});
