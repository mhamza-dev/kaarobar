import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/Toast";
import AppLayout from "@/components/app/AppLayout";
import HomeAuthRedirect from "@/components/auth/HomeAuthRedirect";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import DashboardPage from "@/pages/DashboardPage";
import PosPage from "@/pages/PosPage";
import ReturnsPage from "@/pages/ReturnsPage";
import InventoryPage from "@/pages/InventoryPage";
import AccountingPage from "@/pages/AccountingPage";
import CustomersPage from "@/pages/CustomersPage";
import MarketingPage from "@/pages/MarketingPage";
import HrPage from "@/pages/HrPage";
import ReportsPage from "@/pages/ReportsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SettingsPage from "@/pages/SettingsPage";
import ProfilePage from "@/pages/ProfilePage";
import EssPage from "@/pages/EssPage";

export default function App() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <HashRouter>
          <div className="flex h-screen min-h-0 flex-col overflow-hidden">
            <Routes>
              <Route path="/" element={<HomeAuthRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="pos" element={<PosPage />} />
                <Route path="returns" element={<ReturnsPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="accounting" element={<AccountingPage />} />
                <Route path="marketing" element={<MarketingPage />} />
                <Route path="hr" element={<HrPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="ess" element={<EssPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </HashRouter>
      </ToastProvider>
    </LocaleProvider>
  );
}
