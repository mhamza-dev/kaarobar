import SegmentedTabs from "../SegmentedTabs";

type TabOption<T extends string> = {
  id: T;
  label: string;
};

type ScreenTabsProps<T extends string> = {
  tabs: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export default function ScreenTabs<T extends string>({
  tabs,
  value,
  onChange,
}: ScreenTabsProps<T>) {
  return <SegmentedTabs tabs={[...tabs]} value={value} onChange={(id) => onChange(id as T)} />;
}
