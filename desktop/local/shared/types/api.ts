/** Shared IPC API contract between main and renderer. */

import type {
  BusinessNature,
  ProductKind,
  ServiceMode,
} from "../businessNature";
import type { AppLanguage } from "../languages";
import type { LicenseFeature } from "../licensing/features";

export type { BusinessNature, ProductKind, ServiceMode };
export type { AppLanguage };
export type { LicenseFeature };

export type AppInfo = {
  name: string;
  version: string;
  platform: NodeJS.Platform;
  userDataPath: string;
};

export type LicenseStatusSummary = {
  state: "valid" | "expired" | "lifetime" | "missing";
  expiresAt: string | null;
  issuedTo: string | null;
  /** Plan name from the license server; null for legacy licenses. */
  plan: string | null;
  /** Feature entitlements; null = unrestricted (legacy license). */
  features: LicenseFeature[] | null;
  /** Raw seat/layout limits from the server; null = use the plan preset. */
  maxUsers: number | null;
  maxTemplates: number | null;
};

export type RestockAlert = {
  productId: string;
  productName: string;
  stockQty: number;
  avgDailyQty: number;
  daysLeft: number;
  recommendedQty: number;
};

export type DailyReminderLicense = {
  kind: "expired" | "expiring" | "missing";
  expiresAt: string | null;
  issuedTo: string | null;
  daysLeft: number | null;
};

export type DailyReminderEvent = {
  date: string;
  at: string;
  restock: RestockAlert[];
  license: DailyReminderLicense | null;
};

export type BootState =
  | { status: "needs_setup" }
  | { status: "needs_license" }
  | {
      status: "license_expired";
      expiresAt: string | null;
      issuedTo: string | null;
    }
  | { status: "needs_login"; language: AppLanguage }
  | { status: "error"; message: string };

export type LicenseActivateResult =
  | {
      ok: true;
      issuedTo: string;
      expiresAt: string | null;
      maxDevices: number;
      mode: "supabase" | "dev";
      plan: string | null;
      features: LicenseFeature[] | null;
    }
  | {
      ok: false;
      error:
        | "invalid_key"
        | "revoked"
        | "expired"
        | "device_limit_reached"
        | "downgrade_blocked"
        | "network_error"
        | "offline"
        | "unknown";
      message: string;
    };

export type CompleteSetupPayload = {
  licenseKey: string;
  owner: {
    name: string;
    email: string;
    password: string;
  };
  business: {
    name: string;
    currency: string;
    brandColor: string;
    businessNature: BusinessNature;
  };
  branch: {
    name: string;
    address: string;
    phone: string;
  };
  language: AppLanguage;
};

export type CompleteSetupResult =
  | { ok: true }
  | { ok: false; error: string; message: string };

export type UserRole = "owner" | "admin" | "manager" | "cashier";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  businessId: string | null;
  branchId: string | null;
  imagePath: string | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false;
      error: "invalid_credentials" | "inactive" | "unknown";
      message: string;
    };

export type ResetOwnerPasswordOfflineResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_configured"
        | "invalid_credentials"
        | "invalid_license"
        | "license_expired"
        | "validation_failed"
        | "unknown";
      message: string;
    };

export type Business = {
  id: string;
  name: string;
  currency: string;
  brandColor: string;
  businessNature: BusinessNature;
  logoPath: string | null;
  socialWhatsapp: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTiktok: string | null;
  socialWebsite: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  isActive: boolean;
};

export type Branch = {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  phone: string | null;
  isMainBranch: boolean;
  isActive: boolean;
};

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  businessId: string | null;
  branchId: string | null;
  isActive: boolean;
};

export type KitchenStatus = "held" | "fired" | "ready" | "bumped";
export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type Product = {
  id: string;
  businessId: string;
  branchId: string | null;
  name: string;
  barcode: string | null;
  price: number;
  costPrice: number | null;
  stockQty: number;
  kind: ProductKind;
  tracksStock: boolean;
  kitchenStation: string;
  imagePath: string | null;
  isActive: boolean;
  /** Resolved unit price at “now” when list includes happy-hour (optional). */
  resolvedPrice?: number;
  activePriceRuleId?: string | null;
  activePriceRuleName?: string | null;
};

export type HappyHourPriceRule = {
  id: string;
  businessId: string;
  name: string;
  productId: string | null;
  categoryId: string | null;
  overridePrice: number | null;
  percentOff: number | null;
  weekdaysMask: number;
  startTime: string;
  endTime: string;
  priority: number;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedUnitPrice = {
  unitPrice: number;
  listPrice: number;
  priceRuleId: string | null;
  priceRuleName: string | null;
};

export type KitchenTicketLine = {
  itemId: string;
  ticketId: string;
  tableName: string | null;
  serviceMode: ServiceMode;
  productName: string;
  qty: number;
  seatNo: number | null;
  kitchenStatus: KitchenStatus;
  kitchenStation: string;
  firedAt: string | null;
  bumpedAt: string | null;
  createdAt: string;
};

export type DiningTable = {
  id: string;
  businessId: string;
  name: string;
  seats: number | null;
  sortOrder: number;
  isActive: boolean;
  occupied: boolean;
  openTicketId: string | null;
  openTicketTotal: number;
};

export type PosTicketItem = {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  seatNo: number | null;
  kitchenStatus: KitchenStatus;
  firedAt: string | null;
  bumpedAt: string | null;
  billedQty: number;
  priceRuleId: string | null;
};

export type PosTicket = {
  id: string;
  businessId: string;
  branchId: string;
  tableId: string | null;
  serviceMode: ServiceMode;
  status: "open" | "billed" | "cancelled";
  openedBy: string;
  notes: string | null;
  riderUserId: string | null;
  riderName: string | null;
  deliveryStatus: DeliveryStatus | null;
  deliveryNotes: string | null;
  items: PosTicketItem[];
  total: number;
  unbilledTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
};

export type PurchaseOrder = {
  id: string;
  businessId: string;
  branchId: string;
  supplierId: string;
  poNumber: string;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  orderDate: string;
};

export type SupplierProduct = {
  linkId: string;
  supplierId: string;
  productId: string;
  unitCost: number;
  product: Product;
};

export type ProductSupplierLink = {
  linkId: string;
  supplierId: string;
  supplierName: string;
  unitCost: number;
};

export type SupplierDetail = {
  supplier: Supplier;
  products: SupplierProduct[];
};

export type PurchaseOrderItem = {
  id: string;
  productId: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  lineTotal: number;
};

export type PurchaseOrderDetail = {
  po: PurchaseOrder;
  supplierName: string;
  branchName: string;
  businessName: string;
  items: PurchaseOrderItem[];
  total: number;
};

export type Customer = {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  address: string | null;
  currentBalance: number;
  isActive: boolean;
};

export type SaleStatus =
  | "completed"
  | "void"
  | "refunded"
  | "partially_refunded";

export type CustomerSaleSummary = {
  id: string;
  invoiceNo: string;
  total: number;
  status: SaleStatus;
  createdAt: string;
  paymentMethods: Array<"cash" | "card" | "credit">;
};

export type LedgerEntryType = "sale" | "payment" | "adjustment" | "opening";

export type LedgerEntry = {
  id: string;
  customerId: string;
  businessId: string;
  branchId: string | null;
  type: LedgerEntryType;
  /** Positive = customer owes more; negative = payment / credit out */
  amount: number;
  balanceAfter: number;
  referenceSaleId: string | null;
  note: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  method: "cash" | "card" | null;
};

export type CustomerDetail = {
  customer: Customer;
  remainingBalance: number;
  sales: CustomerSaleSummary[];
  ledger: LedgerEntry[];
};

export type Sale = {
  id: string;
  businessId: string;
  branchId: string;
  invoiceNo: string;
  customerId: string | null;
  /** A walk-in's name, written on the sale with no customer record behind it. */
  customerName: string | null;
  cashierId: string;
  subtotal: number;
  /** Everything taken off: the per-line discounts plus any whole-sale one. */
  discount: number;
  total: number;
  amountPaid: number;
  status: SaleStatus;
  createdAt: string;
  servedByUserId: string | null;
  servedByName: string | null;
  serviceMode: ServiceMode | null;
  tableId: string | null;
  tableName: string | null;
  riderUserId: string | null;
  riderName: string | null;
  deliveryStatus: DeliveryStatus | null;
  deliveryNotes: string | null;
};

export type SaleItem = {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  /** Money off this line in total — the per-unit discount times the quantity. */
  discount: number;
  /** What was charged for the line: `qty * unitPrice - discount`. */
  lineTotal: number;
  refundedQty: number;
  refundableQty: number;
  priceRuleId: string | null;
  priceRuleName: string | null;
};

export type SalePayment = {
  id: string;
  method: "cash" | "card" | "credit";
  amount: number;
  createdAt: string;
};

export type RefundRequestStatus = "pending" | "approved" | "rejected";

export type RefundRequestItem = {
  id: string;
  saleItemId: string;
  productId: string;
  productName: string;
  qty: number;
};

export type RefundRequest = {
  id: string;
  saleId: string;
  businessId: string;
  requestedBy: string;
  requestedByName: string;
  reason: string;
  status: RefundRequestStatus;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  items: RefundRequestItem[];
};

export type ActivityEntry = {
  id: string;
  businessId: string | null;
  actorUserId: string;
  actorName: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  payloadJson: string | null;
  createdAt: string;
};

export type AnalyticsRangeDays = 7 | 30 | 90;

export type AnalyticsSummaryRequest = {
  businessId: string;
  /** Preset window ending today (ignored when from/to are set). */
  days?: AnalyticsRangeDays;
  /** Inclusive local/UTC calendar start YYYY-MM-DD */
  from?: string;
  /** Inclusive local/UTC calendar end YYYY-MM-DD */
  to?: string;
};

export type AnalyticsSummary = {
  /** Inclusive day count in the selected window */
  days: number;
  from: string;
  to: string;
  salesByDay: Array<{ date: string; total: number; count: number }>;
  paymentsByMethod: Array<{
    method: "cash" | "card" | "credit";
    total: number;
  }>;
  topProducts: Array<{ productName: string; qty: number; revenue: number }>;
  creditOutstanding: number;
  customersWithBalance: number;
  lowStockCount: number;
  salesTotal: number;
  salesCount: number;
  /**
   * Estimated gross profit for the window: item revenue (net of line/bill
   * discounts and refunded quantities) minus product cost prices. Products
   * without a cost price contribute their full revenue.
   */
  profitTotal: number;
};

export type SaleDetail = {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
  refundRequests: RefundRequest[];
  activity: ActivityEntry[];
};

/**
 * Paper the receipt is laid out for. The three roll widths cover thermal
 * receipt printers; A4/Letter cover ordinary ink/laser office printers, which
 * get a full-page invoice layout instead of a narrow strip.
 */
export type PosPaperWidth = "58mm" | "76mm" | "80mm" | "A4" | "Letter";

export type PosTransport = "raw" | "rendered";

/**
 * Visual style of the printed receipt. Purely presentational — every template
 * prints the same sections in the same order.
 */
export type PosReceiptTemplate =
  | "classic"
  | "minimal"
  | "dotted"
  | "mono"
  | "bold"
  | "elegant"
  | "boxed"
  | "stripe"
  | "soft"
  | "script"
  | "accent"
  | "framed"
  | "duo"
  | "vintage"
  | "ticket"
  | "ledger"
  | "deluxe"
  | "wave"
  | "market"
  | "regal";

export type PosPrinterSettings = {
  posPrintEnabled: boolean;
  posPrinterName: string;
  posPaperWidth: PosPaperWidth;
  posSilent: boolean;
  posCopies: number;
  posTransport: PosTransport;
  posTemplate: PosReceiptTemplate;
};

export type PrinterTestKind = "rendered" | "raw";

export type PrinterTestResult = {
  kind: PrinterTestKind;
  ok: boolean;
  printerName: string;
  error?: string;
};

/**
 * How a sale receipt actually left the app:
 * - `printed`  — sent to the printer (raw ESC/POS or silent rendered job).
 * - `preview`  — a preview window was opened instead (POS printing disabled,
 *   or the print job failed and the receipt must not be lost).
 * - `cancelled` — the user dismissed the OS print dialog (non-silent mode).
 */
export type SalePrintResult = {
  ok: true;
  method: "printed" | "preview" | "cancelled";
  /** Present when `preview` was a fallback after a print failure. */
  error?: string;
};

export type PrinterDevice = {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
};

/**
 * Sample sale used to render a settings-page receipt preview. The renderer
 * supplies everything it already knows (business, branch, fabricated items);
 * the main process only adds what it alone has: the barcode script, logo file
 * resolution, and the configured print language.
 */
export type ReceiptPreviewSample = {
  invoiceNo: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  createdAt: string;
  businessName: string;
  currency: string;
  brandColor?: string | null;
  logoPath: string | null;
  customerName: string | null;
  cashierName: string | null;
  printedByName: string | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  branchAddress: string | null;
  branchPhone: string | null;
  socialWhatsapp: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTiktok: string | null;
  socialWebsite: string | null;
  items: Array<{
    productName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{ method: string; amount: number }>;
};

export type ReceiptPreviewPayload = {
  template: PosReceiptTemplate;
  paper: PosPaperWidth;
  sample: ReceiptPreviewSample;
};

export type ReceiptPreviewResult = { html: string };

export type KaarobarApi = {
  app: {
    getInfo: () => Promise<AppInfo>;
    ping: () => Promise<{ ok: true; at: string }>;
    getBootState: () => Promise<BootState>;
    /** Active/last business brand color for pre-login chrome. */
    getBrandColor: () => Promise<string>;
    getLanguage: () => Promise<AppLanguage>;
    setLanguage: (language: AppLanguage) => Promise<{ ok: true }>;
    getLicenseStatus: () => Promise<LicenseStatusSummary>;
    getRestockAlerts: (businessId: string) => Promise<RestockAlert[]>;
    /** Refresh reminders for the Reminders panel (runs on each login). */
    maybeRunDailyReminders: () => Promise<{ ran: boolean }>;
    onDailyReminder: (
      callback: (event: DailyReminderEvent) => void,
    ) => () => void;
  };
  license: {
    activate: (licenseKey: string) => Promise<LicenseActivateResult>;
  };
  setup: {
    complete: (payload: CompleteSetupPayload) => Promise<CompleteSetupResult>;
    restoreFromBackup: (payload: {
      filePath: string;
      licenseKey: string;
    }) => Promise<CompleteSetupResult>;
  };
  auth: {
    login: (payload: LoginPayload) => Promise<LoginResult>;
    resetOwnerPasswordOffline: (payload: {
      email: string;
      licenseKey: string;
      newPassword: string;
    }) => Promise<ResetOwnerPasswordOfflineResult>;
    logout: () => Promise<{ ok: true }>;
    session: () => Promise<SessionUser | null>;
    /** Re-checks the signed-in user's password (screen-lock unlock). */
    verifyPassword: (password: string) => Promise<{ ok: boolean }>;
  };
  business: {
    list: () => Promise<Business[]>;
    create: (payload: {
      name: string;
      currency: string;
      brandColor: string;
      businessNature?: BusinessNature;
      logoPath?: string | null;
      socialWhatsapp?: string | null;
      socialInstagram?: string | null;
      socialFacebook?: string | null;
      socialTiktok?: string | null;
      socialWebsite?: string | null;
      receiptHeader?: string | null;
      receiptFooter?: string | null;
    }) => Promise<Business>;
    update: (payload: {
      id: string;
      name: string;
      currency: string;
      brandColor: string;
      businessNature?: BusinessNature;
      logoPath?: string | null;
      socialWhatsapp?: string | null;
      socialInstagram?: string | null;
      socialFacebook?: string | null;
      socialTiktok?: string | null;
      socialWebsite?: string | null;
      receiptHeader?: string | null;
      receiptFooter?: string | null;
    }) => Promise<Business>;
    setActive: (businessId: string) => Promise<{ ok: true }>;
    branches: (businessId: string) => Promise<Branch[]>;
    createBranch: (payload: {
      businessId: string;
      name: string;
      address?: string;
      phone?: string;
    }) => Promise<Branch>;
    updateBranch: (payload: {
      id: string;
      name: string;
      address?: string;
      phone?: string;
      isActive?: boolean;
    }) => Promise<Branch>;
  };
  users: {
    list: (businessId: string) => Promise<StaffUser[]>;
    create: (payload: {
      businessId: string;
      branchId: string | null;
      name: string;
      email: string;
      password: string;
      role: UserRole;
    }) => Promise<StaffUser>;
    updateSelf: (payload: {
      name?: string;
      imagePath?: string | null;
      currentPassword?: string;
      newPassword?: string;
    }) => Promise<SessionUser>;
    setActive: (payload: {
      userId: string;
      isActive: boolean;
    }) => Promise<{ ok: true }>;
  };
  products: {
    list: (businessId: string) => Promise<Product[]>;
    create: (payload: {
      businessId: string;
      branchId: string | null;
      name: string;
      barcode?: string;
      price: number;
      costPrice?: number;
      stockQty?: number;
      kind?: ProductKind;
      tracksStock?: boolean;
      imagePath?: string | null;
      isActive?: boolean;
    }) => Promise<Product>;
    update: (payload: {
      id: string;
      name: string;
      barcode?: string | null;
      price: number;
      costPrice?: number | null;
      stockQty?: number;
      kind?: ProductKind;
      tracksStock?: boolean;
      imagePath?: string | null;
      isActive?: boolean;
    }) => Promise<Product>;
    setActive: (payload: {
      id: string;
      isActive: boolean;
    }) => Promise<{ ok: true }>;
    delete: (
      id: string,
    ) => Promise<{ ok: true; mode: "deleted" | "deactivated" }>;
    generateBarcode: (businessId: string) => Promise<{ barcode: string }>;
    getActivity: (productId: string) => Promise<ActivityEntry[]>;
    listSuppliers: (productId: string) => Promise<ProductSupplierLink[]>;
  };
  suppliers: {
    list: (businessId: string) => Promise<Supplier[]>;
    getDetail: (supplierId: string) => Promise<SupplierDetail>;
    create: (payload: {
      businessId: string;
      name: string;
      phone?: string;
      address?: string;
      notes?: string;
    }) => Promise<Supplier>;
    update: (payload: {
      id: string;
      name: string;
      phone?: string | null;
      address?: string | null;
      notes?: string | null;
      isActive?: boolean;
    }) => Promise<Supplier>;
    listProducts: (supplierId: string) => Promise<SupplierProduct[]>;
    linkProduct: (payload: {
      supplierId: string;
      productId: string;
      unitCost: number;
    }) => Promise<SupplierProduct>;
    unlinkProduct: (payload: {
      supplierId: string;
      productId: string;
    }) => Promise<{ ok: true }>;
    updateLinkedProduct: (payload: {
      supplierId: string;
      productId: string;
      unitCost: number;
    }) => Promise<SupplierProduct>;
    /** Owner only. Deletes their purchase orders, price list and ledger too. */
    remove: (payload: {
      supplierId: string;
      reason?: string;
    }) => Promise<{ ok: true; name: string; purchaseOrdersDeleted: number }>;
  };
  purchaseOrders: {
    list: (businessId: string) => Promise<PurchaseOrder[]>;
    getDetail: (poId: string) => Promise<PurchaseOrderDetail>;
    create: (payload: {
      businessId: string;
      branchId: string;
      supplierId: string;
      poNumber: string;
      orderDate: string;
      items: Array<{ productId: string; orderedQty: number; unitCost: number }>;
    }) => Promise<PurchaseOrder>;
    print: (poId: string) => Promise<{ ok: true }>;
    /** Owner only. Refused once stock has been received against the order. */
    remove: (payload: {
      poId: string;
      reason?: string;
    }) => Promise<{ ok: true; poNumber: string }>;
  };
  customers: {
    list: (businessId: string) => Promise<Customer[]>;
    getDetail: (customerId: string) => Promise<CustomerDetail>;
    create: (payload: {
      businessId: string;
      name: string;
      phone?: string;
      address?: string;
      amount?: number;
    }) => Promise<Customer>;
    update: (payload: {
      id: string;
      name: string;
      phone?: string | null;
      address?: string | null;
      isActive?: boolean;
    }) => Promise<Customer>;
    recordPayment: (payload: {
      customerId: string;
      amount: number;
      method: "cash" | "card";
      note?: string | null;
      branchId?: string | null;
    }) => Promise<LedgerEntry>;
    printLedger: (payload: {
      customerId: string;
      from?: string | null;
      to?: string | null;
    }) => Promise<{ ok: true }>;
    /** Owner only. Deletes their sales (restocking) and their ledger too. */
    remove: (payload: {
      customerId: string;
      reason?: string;
    }) => Promise<{ ok: true; name: string; salesDeleted: number }>;
  };
  printer: {
    list: () => Promise<PrinterDevice[]>;
    getSettings: () => Promise<PosPrinterSettings>;
    setSettings: (
      payload: Partial<PosPrinterSettings>,
    ) => Promise<PosPrinterSettings>;
    test: (kind: PrinterTestKind) => Promise<PrinterTestResult>;
    preview: (payload: ReceiptPreviewPayload) => Promise<ReceiptPreviewResult>;
  };
  sales: {
    list: (businessId: string) => Promise<Sale[]>;
    getDetail: (saleId: string) => Promise<SaleDetail>;
    findByInvoice: (payload: {
      businessId: string;
      invoiceNo: string;
    }) => Promise<Sale | null>;
    create: (payload: {
      businessId: string;
      branchId: string;
      customerId: string | null;
      /** A name for a walk-in. Ignored when `customerId` is set. */
      customerName?: string | null;
      items: Array<{
        productId: string;
        qty: number;
        unitPrice: number;
        /** Amount off this line, before any whole-sale discount. */
        discount?: number;
        ticketItemId?: string;
        priceRuleId?: string | null;
      }>;
      /** Amount off the whole sale, on top of whatever the lines took off. */
      discount?: number;
      payments: Array<{ method: "cash" | "card" | "credit"; amount: number }>;
      servedByUserId?: string | null;
      serviceMode?: ServiceMode | null;
      tableId?: string | null;
      ticketId?: string | null;
      riderUserId?: string | null;
      deliveryStatus?: DeliveryStatus | null;
      deliveryNotes?: string | null;
      /** When true with ticketId, only bill listed ticket item qtys; leave ticket open if unbilled remain. */
      partialTicketBill?: boolean;
    }) => Promise<Sale>;
    createRefundRequest: (payload: {
      saleId: string;
      reason: string;
      items: Array<{ saleItemId: string; qty: number }>;
    }) => Promise<RefundRequest>;
    reviewRefundRequest: (payload: {
      id: string;
      decision: "approve" | "reject";
      note?: string;
    }) => Promise<RefundRequest>;
    /** Owner only. Reverses stock and customer credit, then removes the sale. */
    remove: (payload: {
      saleId: string;
      reason?: string;
    }) => Promise<{ ok: true; invoiceNo: string }>;
    printReceipt: (saleId: string) => Promise<SalePrintResult>;
    updateDelivery: (payload: {
      saleId: string;
      riderUserId?: string | null;
      deliveryStatus?: DeliveryStatus | null;
      deliveryNotes?: string | null;
    }) => Promise<Sale>;
  };
  tables: {
    list: (businessId: string) => Promise<DiningTable[]>;
    create: (payload: {
      businessId: string;
      name: string;
      seats?: number | null;
      sortOrder?: number;
    }) => Promise<DiningTable>;
    update: (payload: {
      id: string;
      name: string;
      seats?: number | null;
      sortOrder?: number;
      isActive?: boolean;
    }) => Promise<DiningTable>;
  };
  tickets: {
    listOpen: (businessId: string) => Promise<PosTicket[]>;
    get: (ticketId: string) => Promise<PosTicket>;
    open: (payload: {
      businessId: string;
      branchId: string;
      serviceMode: ServiceMode;
      tableId?: string | null;
      notes?: string | null;
    }) => Promise<PosTicket>;
    setItems: (payload: {
      ticketId: string;
      items: Array<{
        id?: string;
        productId: string;
        qty: number;
        unitPrice: number;
        seatNo?: number | null;
        priceRuleId?: string | null;
      }>;
    }) => Promise<PosTicket>;
    cancel: (ticketId: string) => Promise<{ ok: true }>;
    fireItems: (payload: {
      ticketId: string;
      itemIds: string[];
    }) => Promise<PosTicket>;
    assignRider: (payload: {
      ticketId: string;
      riderUserId: string | null;
      deliveryStatus?: DeliveryStatus | null;
      deliveryNotes?: string | null;
    }) => Promise<PosTicket>;
  };
  kitchen: {
    listActive: (businessId: string) => Promise<KitchenTicketLine[]>;
    bump: (payload: { itemIds: string[] }) => Promise<{ ok: true }>;
    recall: (payload: { itemIds: string[] }) => Promise<{ ok: true }>;
  };
  happyHour: {
    list: (businessId: string) => Promise<HappyHourPriceRule[]>;
    create: (payload: {
      businessId: string;
      name: string;
      productId?: string | null;
      categoryId?: string | null;
      overridePrice?: number | null;
      percentOff?: number | null;
      weekdaysMask: number;
      startTime: string;
      endTime: string;
      priority?: number;
      isActive?: boolean;
      validFrom?: string | null;
      validTo?: string | null;
    }) => Promise<HappyHourPriceRule>;
    update: (payload: {
      id: string;
      name: string;
      productId?: string | null;
      categoryId?: string | null;
      overridePrice?: number | null;
      percentOff?: number | null;
      weekdaysMask: number;
      startTime: string;
      endTime: string;
      priority?: number;
      isActive?: boolean;
      validFrom?: string | null;
      validTo?: string | null;
    }) => Promise<HappyHourPriceRule>;
    setActive: (payload: {
      id: string;
      isActive: boolean;
    }) => Promise<HappyHourPriceRule>;
    resolvePrice: (payload: {
      businessId: string;
      productId: string;
      at?: string;
    }) => Promise<ResolvedUnitPrice>;
  };
  activity: {
    list: (payload: {
      entityType: string;
      entityId: string;
    }) => Promise<ActivityEntry[]>;
  };
  analytics: {
    summary: (payload: AnalyticsSummaryRequest) => Promise<AnalyticsSummary>;
  };
  assets: {
    pickAndSave: (payload: { kind: "logo" | "product" }) => Promise<{
      relativePath: string;
      url: string;
    } | null>;
  };
  backup: {
    create: () => Promise<{ ok: true; filePath: string }>;
    restore: (
      filePath: string,
    ) => Promise<{ ok: true; businessId: string | null }>;
    pickFile: () => Promise<string | null>;
    onProgress: (callback: (event: BackupProgressEvent) => void) => () => void;
    getAutoSettings: () => Promise<AutoBackupSettings>;
    setAutoSettings: (payload: {
      autoBackupEnabled?: boolean;
      autoBackupTime?: string;
    }) => Promise<AutoBackupSettings>;
  };
};

export type AutoBackupSettings = {
  autoBackupEnabled: boolean;
  autoBackupTime: string;
  lastAutoBackupAt: string | null;
};

export type BackupProgressPhase =
  | "prepare_db"
  | "packing_files"
  | "compressing"
  | "encrypting"
  | "writing"
  | "reading"
  | "decrypting"
  | "extracting"
  | "installing_db"
  | "restoring_files"
  | "finalizing";

export type BackupProgressEvent = {
  operation: "create" | "restore";
  phase: BackupProgressPhase;
  /** 0–100 determinate progress */
  percent: number;
};

export const IPC_CHANNELS = {
  APP_GET_INFO: "app:getInfo",
  APP_PING: "app:ping",
  APP_GET_BOOT_STATE: "app:getBootState",
  APP_GET_BRAND_COLOR: "app:getBrandColor",
  APP_GET_LANGUAGE: "app:getLanguage",
  APP_SET_LANGUAGE: "app:setLanguage",
  APP_GET_LICENSE_STATUS: "app:getLicenseStatus",
  APP_GET_RESTOCK_ALERTS: "app:getRestockAlerts",
  REMINDERS_DAILY: "reminders:daily",
  REMINDERS_MAYBE_RUN: "reminders:maybeRunDaily",
  LICENSE_ACTIVATE: "license:activate",
  SETUP_COMPLETE: "setup:complete",
  SETUP_RESTORE_FROM_BACKUP: "setup:restoreFromBackup",
  AUTH_LOGIN: "auth:login",
  AUTH_RESET_OWNER_PASSWORD_OFFLINE: "auth:resetOwnerPasswordOffline",
  AUTH_LOGOUT: "auth:logout",
  AUTH_SESSION: "auth:session",
  AUTH_VERIFY_PASSWORD: "auth:verifyPassword",
  BUSINESS_LIST: "business:list",
  BUSINESS_CREATE: "business:create",
  BUSINESS_UPDATE: "business:update",
  BUSINESS_SET_ACTIVE: "business:setActive",
  BRANCH_LIST: "branch:list",
  BRANCH_CREATE: "branch:create",
  BRANCH_UPDATE: "branch:update",
  USER_LIST: "user:list",
  USER_CREATE: "user:create",
  USER_UPDATE_SELF: "user:updateSelf",
  USER_SET_ACTIVE: "user:setActive",
  PRODUCT_LIST: "product:list",
  PRODUCT_CREATE: "product:create",
  PRODUCT_UPDATE: "product:update",
  PRODUCT_SET_ACTIVE: "product:setActive",
  PRODUCT_DELETE: "product:delete",
  PRODUCT_GENERATE_BARCODE: "product:generateBarcode",
  PRODUCT_ACTIVITY: "product:activity",
  PRODUCT_LIST_SUPPLIERS: "product:listSuppliers",
  SUPPLIER_LIST: "supplier:list",
  SUPPLIER_GET_DETAIL: "supplier:getDetail",
  SUPPLIER_CREATE: "supplier:create",
  SUPPLIER_UPDATE: "supplier:update",
  SUPPLIER_LIST_PRODUCTS: "supplier:listProducts",
  SUPPLIER_LINK_PRODUCT: "supplier:linkProduct",
  SUPPLIER_UNLINK_PRODUCT: "supplier:unlinkProduct",
  SUPPLIER_UPDATE_LINKED_PRODUCT: "supplier:updateLinkedProduct",
  SUPPLIER_DELETE: "supplier:delete",
  PO_LIST: "po:list",
  PO_GET_DETAIL: "po:getDetail",
  PO_CREATE: "po:create",
  PO_PRINT: "po:print",
  PO_DELETE: "po:delete",
  CUSTOMER_LIST: "customer:list",
  CUSTOMER_GET_DETAIL: "customer:getDetail",
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_RECORD_PAYMENT: "customer:recordPayment",
  CUSTOMER_PRINT_LEDGER: "customer:printLedger",
  CUSTOMER_DELETE: "customer:delete",
  SALES_LIST: "sales:list",
  SALES_GET_DETAIL: "sales:getDetail",
  SALES_FIND_BY_INVOICE: "sales:findByInvoice",
  SALES_CREATE: "sales:create",
  SALES_REFUND_REQUEST: "sales:refundRequest",
  SALES_REFUND_REVIEW: "sales:refundReview",
  SALES_DELETE: "sales:delete",
  SALES_PRINT: "sales:print",
  PRINTER_LIST: "printer:list",
  PRINTER_GET_SETTINGS: "printer:getSettings",
  PRINTER_SET_SETTINGS: "printer:setSettings",
  PRINTER_TEST: "printer:test",
  PRINTER_PREVIEW: "printer:preview",
  TABLE_LIST: "table:list",
  TABLE_CREATE: "table:create",
  TABLE_UPDATE: "table:update",
  TICKET_LIST_OPEN: "ticket:listOpen",
  TICKET_GET: "ticket:get",
  TICKET_OPEN: "ticket:open",
  TICKET_SET_ITEMS: "ticket:setItems",
  TICKET_CANCEL: "ticket:cancel",
  TICKET_FIRE_ITEMS: "ticket:fireItems",
  TICKET_ASSIGN_RIDER: "ticket:assignRider",
  KITCHEN_LIST_ACTIVE: "kitchen:listActive",
  KITCHEN_BUMP: "kitchen:bump",
  KITCHEN_RECALL: "kitchen:recall",
  HAPPY_HOUR_LIST: "happyHour:list",
  HAPPY_HOUR_CREATE: "happyHour:create",
  HAPPY_HOUR_UPDATE: "happyHour:update",
  HAPPY_HOUR_SET_ACTIVE: "happyHour:setActive",
  HAPPY_HOUR_RESOLVE_PRICE: "happyHour:resolvePrice",
  SALES_UPDATE_DELIVERY: "sales:updateDelivery",
  ACTIVITY_LIST: "activity:list",
  ANALYTICS_SUMMARY: "analytics:summary",
  ASSETS_PICK_AND_SAVE: "assets:pickAndSave",
  BACKUP_CREATE: "backup:create",
  BACKUP_RESTORE: "backup:restore",
  BACKUP_PICK_FILE: "backup:pickFile",
  BACKUP_PROGRESS: "backup:progress",
  BACKUP_GET_AUTO_SETTINGS: "backup:getAutoSettings",
  BACKUP_SET_AUTO_SETTINGS: "backup:setAutoSettings",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
