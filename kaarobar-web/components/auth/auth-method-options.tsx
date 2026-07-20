import { Mail, Phone } from "lucide-react";

import type { OptionSelectorItem } from "@/components/ui/OptionSelector";
import type { AuthMethod } from "@/lib/validations/auth";

export const authMethodOptions: OptionSelectorItem<AuthMethod>[] = [
  {
    value: "email",
    label: "Email",
    description: "Use your email address",
    icon: <Mail size={20} />,
  },
  {
    value: "phone",
    label: "Phone",
    description: "Use your phone number",
    icon: <Phone size={20} />,
  },
];
