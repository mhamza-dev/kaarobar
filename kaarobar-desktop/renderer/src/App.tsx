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
import SalesPage from "@/pages/SalesPage";
import CustomerDetailPage from "@/pages/CustomerDetailPage";
import EmployeeDetailPage from "@/pages/EmployeeDetailPage";
import SaleDetailPage from "@/pages/SaleDetailPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import SupplierDetailPage from "@/pages/SupplierDetailPage";
import CampaignDetailPage from "@/pages/CampaignDetailPage";
import ArInvoiceDetailPage from "@/pages/ArInvoiceDetailPage";
import ReturnDetailPage from "@/pages/ReturnDetailPage";
import JournalDetailPage from "@/pages/JournalDetailPage";
import ApBillDetailPage from "@/pages/ApBillDetailPage";
import PayrollDetailPage from "@/pages/PayrollDetailPage";
import PurchaseOrderDetailPage from "@/pages/PurchaseOrderDetailPage";

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
                <Route path="sales" element={<SalesPage />} />
                <Route path="sales/:id" element={<SaleDetailPage />} />
                <Route path="returns" element={<ReturnsPage />} />
                <Route path="returns/:id" element={<ReturnDetailPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/:id" element={<CustomerDetailPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="inventory/products/:id" element={<ProductDetailPage />} />
                <Route path="inventory/suppliers/:id" element={<SupplierDetailPage />} />
                <Route path="inventory/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
                <Route path="accounting" element={<AccountingPage />} />
                <Route path="accounting/ar/:id" element={<ArInvoiceDetailPage />} />
                <Route path="accounting/ap/:id" element={<ApBillDetailPage />} />
                <Route path="accounting/journals/:id" element={<JournalDetailPage />} />
                <Route path="marketing" element={<MarketingPage />} />
                <Route path="marketing/campaigns/:id" element={<CampaignDetailPage />} />
                <Route path="hr" element={<HrPage />} />
                <Route path="hr/employees/:id" element={<EmployeeDetailPage />} />
                <Route path="hr/payroll/:id" element={<PayrollDetailPage />} />
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
