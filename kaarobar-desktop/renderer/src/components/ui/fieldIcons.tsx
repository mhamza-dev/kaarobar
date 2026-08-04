import type { ReactNode } from "react";
import {
  Banknote,
  Building2,
  Hash,
  IdCard,
  Link2,
  Lock,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  User,
} from "lucide-react";

const iconProps = { size: 16, strokeWidth: 2, "aria-hidden": true as const };

/** Infer a start icon from input type / field name when none is provided. */
export function inferFieldStartIcon(
  type: string,
  name: string
): ReactNode | null {
  const key = `${type}:${name}`.toLowerCase();

  if (type === "email" || /email/.test(name)) {
    return <Mail {...iconProps} />;
  }
  if (type === "tel" || /phone|mobile|whatsapp/.test(name)) {
    return <Phone {...iconProps} />;
  }
  if (type === "password" || /password|secret|pin/.test(name)) {
    return <Lock {...iconProps} />;
  }
  if (type === "url" || /website|url|link/.test(name)) {
    return <Link2 {...iconProps} />;
  }
  if (
    type === "number" ||
    /amount|price|qty|quantity|limit|credit|balance|rate|total|delta/.test(name)
  ) {
    return /credit|amount|price|balance|limit|total|rate/.test(name) ? (
      <Banknote {...iconProps} />
    ) : (
      <Hash {...iconProps} />
    );
  }
  if (/company|business|org|supplier/.test(name)) {
    return <Building2 {...iconProps} />;
  }
  if (/address|city|street|location/.test(name)) {
    return <MapPin {...iconProps} />;
  }
  if (/cnic|ntn|tax|national_id|nic/.test(name)) {
    return <IdCard {...iconProps} />;
  }
  if (/user_id|linked_user|staff_id/.test(name)) {
    return <Link2 {...iconProps} />;
  }
  if (/note|memo|description|reason|comment/.test(name)) {
    return <StickyNote {...iconProps} />;
  }
  if (/^name$|full_name|display_name|customer_name|contact_name/.test(name) || key.endsWith(":name")) {
    return <User {...iconProps} />;
  }
  if (name === "name" || name.endsWith("_name") || name.startsWith("name_")) {
    return <User {...iconProps} />;
  }

  return null;
}
