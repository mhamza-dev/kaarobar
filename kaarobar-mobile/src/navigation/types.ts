export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  Signup: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: { tab?: string } | undefined;
  Attendance: { tab?: string } | undefined;
  Workspace: undefined;
  Leave: undefined;
  Notifications: undefined;
  Businesses: undefined;
  BusinessDetail: { id: string };
  Marketing: { tab?: string } | undefined;
  TemplateDetail: { id: string };
  Returns: undefined;
  Profile: undefined;
};

export type MainTabParamList = {
  Pos: undefined;
  Sales: undefined;
  Products: { tab?: string } | undefined;
  Customers: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Landing: undefined;
  Login: undefined;
  Signup: undefined;
};
