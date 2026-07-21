import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";

/** Prevent authenticated users from staying on login/signup. */
export default function GuestOnly({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (getSession()) {
      navigate(routes.app, { replace: true });
    }
  }, [navigate]);

  return <>{children}</>;
}
