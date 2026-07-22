export type HelpTopic = {
  title: string;
  summary: string;
  what: string;
  how: string[];
  when: string;
  tips?: string[];
};

export type HelpCatalog = Record<string, HelpTopic>;
