import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/api";
import { BuyerEmptyPanel } from "./BuyerLayout";
import { BuyerOrderDetailSkeleton } from "./BuyerSkeletons";

type BackLinkProps = {
  label: string;
  onPress: () => void;
  color: string;
  withArrow?: boolean;
};

function BuyerBackLink({ label, onPress, color, withArrow }: BackLinkProps) {
  return (
    <Pressable onPress={onPress}>
      <Text style={[styles.back, { color }]}>{withArrow ? `← ${label}` : label}</Text>
    </Pressable>
  );
}

export function BuyerScreenRoot({ children }: { children: ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

export function BuyerDetailLoadingState() {
  return (
    <View style={styles.container}>
      <BuyerOrderDetailSkeleton />
    </View>
  );
}

type BuyerDetailErrorStateProps = {
  backLabel: string;
  onBack: () => void;
  backColor: string;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
};

export function BuyerDetailErrorState({
  backLabel,
  onBack,
  backColor,
  title,
  body,
  actionLabel,
  onAction,
}: BuyerDetailErrorStateProps) {
  return (
    <View style={styles.container}>
      <BuyerBackLink label={backLabel} onPress={onBack} color={backColor} />
      <BuyerEmptyPanel
        title={title}
        body={body}
        actionLabel={actionLabel}
        onAction={onAction}
      />
    </View>
  );
}

type BuyerDetailScrollLayoutProps = {
  backLabel: string;
  onBack: () => void;
  backColor: string;
  children: ReactNode;
};

export function BuyerDetailScrollLayout({
  backLabel,
  onBack,
  backColor,
  children,
}: BuyerDetailScrollLayoutProps) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <BuyerBackLink label={backLabel} onPress={onBack} color={backColor} withArrow />
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { padding: 16, paddingBottom: 40 },
  back: { fontWeight: "700", marginBottom: 12 },
});
