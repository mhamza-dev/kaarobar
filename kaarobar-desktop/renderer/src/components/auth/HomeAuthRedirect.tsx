import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";

/** Send authenticated users into the app from landing/auth entry. */
export default function HomeAuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    if (getSession()) {
      navigate(routes.app, { replace: true });
    } else {
      navigate(routes.login, { replace: true });
    }
  }, [navigate]);

  return null;
}
