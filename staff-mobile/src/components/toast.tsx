import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, Text, View } from "react-native";
import { makeStyles, type Theme, useTheme } from '@/theme';


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

type Tone = { bg: string; border: string; text: string };

/** Tones depend on the active scheme, so they are derived per render. */
function toneStylesFor(theme: Theme): Record<ToastType, Tone> {
  return {
    info: { bg: theme.brandLight, border: theme.brand, text: theme.brandOn },
    success: { bg: theme.successSoft, border: theme.success, text: theme.success },
    error: { bg: theme.dangerSoft, border: theme.danger, text: theme.danger },
    warning: { bg: theme.warningSoft, border: theme.warning, text: theme.warning },
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const theme = useTheme();
  const toneStyles = useMemo(() => toneStylesFor(theme), [theme]);
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

const useStyles = makeStyles((t) => ({
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
    shadowColor: "#000",
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
}));
