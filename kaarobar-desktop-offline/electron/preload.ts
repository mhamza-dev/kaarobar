import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type BackupProgressEvent,
  type DailyReminderEvent,
  type KaarobarApi,
} from '../shared/types/api'

/**
 * Secure, typed bridge for the renderer.
 * Never expose raw ipcRenderer or Node APIs.
 */
const api: KaarobarApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO),
    ping: () => ipcRenderer.invoke(IPC_CHANNELS.APP_PING),
    getBootState: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_BOOT_STATE),
    getBrandColor: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_BRAND_COLOR),
    getLanguage: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_LANGUAGE),
    setLanguage: (language) => ipcRenderer.invoke(IPC_CHANNELS.APP_SET_LANGUAGE, language),
    getLicenseStatus: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_LICENSE_STATUS),
    getRestockAlerts: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_RESTOCK_ALERTS, businessId),
    maybeRunDailyReminders: () => ipcRenderer.invoke(IPC_CHANNELS.REMINDERS_MAYBE_RUN),
    onDailyReminder: (callback) => {
      const listener = (_event: unknown, payload: DailyReminderEvent) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.REMINDERS_DAILY, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.REMINDERS_DAILY, listener)
      }
    },
  },
  license: {
    activate: (licenseKey) => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_ACTIVATE, licenseKey),
  },
  setup: {
    complete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SETUP_COMPLETE, payload),
    restoreFromBackup: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETUP_RESTORE_FROM_BACKUP, payload),
  },
  auth: {
    login: (payload) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, payload),
    resetOwnerPasswordOffline: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_RESET_OWNER_PASSWORD_OFFLINE, payload),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    session: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_SESSION),
  },
  business: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.BUSINESS_LIST),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.BUSINESS_CREATE, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.BUSINESS_UPDATE, payload),
    setActive: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.BUSINESS_SET_ACTIVE, businessId),
    branches: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.BRANCH_LIST, businessId),
    createBranch: (payload) => ipcRenderer.invoke(IPC_CHANNELS.BRANCH_CREATE, payload),
    updateBranch: (payload) => ipcRenderer.invoke(IPC_CHANNELS.BRANCH_UPDATE, payload),
  },
  users: {
    list: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.USER_LIST, businessId),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.USER_CREATE, payload),
    updateSelf: (payload) => ipcRenderer.invoke(IPC_CHANNELS.USER_UPDATE_SELF, payload),
    setActive: (payload) => ipcRenderer.invoke(IPC_CHANNELS.USER_SET_ACTIVE, payload),
  },
  products: {
    list: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST, businessId),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_UPDATE, payload),
    setActive: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_SET_ACTIVE, payload),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_DELETE, id),
    generateBarcode: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GENERATE_BARCODE, businessId),
    getActivity: (productId) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_ACTIVITY, productId),
    listSuppliers: (productId) => ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST_SUPPLIERS, productId),
  },
  suppliers: {
    list: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_LIST, businessId),
    getDetail: (supplierId) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_GET_DETAIL, supplierId),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_CREATE, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UPDATE, payload),
    listProducts: (supplierId) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_LIST_PRODUCTS, supplierId),
    linkProduct: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_LINK_PRODUCT, payload),
    unlinkProduct: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UNLINK_PRODUCT, payload),
    updateLinkedProduct: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UPDATE_LINKED_PRODUCT, payload),
  },
  purchaseOrders: {
    list: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.PO_LIST, businessId),
    getDetail: (poId) => ipcRenderer.invoke(IPC_CHANNELS.PO_GET_DETAIL, poId),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PO_CREATE, payload),
    print: (poId) => ipcRenderer.invoke(IPC_CHANNELS.PO_PRINT, poId),
  },
  customers: {
    list: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_LIST, businessId),
    getDetail: (customerId) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_GET_DETAIL, customerId),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_CREATE, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_UPDATE, payload),
    recordPayment: (payload) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_RECORD_PAYMENT, payload),
    printLedger: (payload) => ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_PRINT_LEDGER, payload),
  },
  printer: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PRINTER_LIST),
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.PRINTER_GET_SETTINGS),
    setSettings: (payload: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.PRINTER_SET_SETTINGS, payload),
    test: (kind: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PRINTER_TEST, kind),
  },
  sales: {
    list: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.SALES_LIST, businessId),
    getDetail: (saleId) => ipcRenderer.invoke(IPC_CHANNELS.SALES_GET_DETAIL, saleId),
    findByInvoice: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SALES_FIND_BY_INVOICE, payload),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SALES_CREATE, payload),
    createRefundRequest: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SALES_REFUND_REQUEST, payload),
    reviewRefundRequest: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SALES_REFUND_REVIEW, payload),
    printReceipt: (saleId) => ipcRenderer.invoke(IPC_CHANNELS.SALES_PRINT, saleId),
    updateDelivery: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SALES_UPDATE_DELIVERY, payload),
  },
  tables: {
    list: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.TABLE_LIST, businessId),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.TABLE_CREATE, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.TABLE_UPDATE, payload),
  },
  tickets: {
    listOpen: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.TICKET_LIST_OPEN, businessId),
    get: (ticketId) => ipcRenderer.invoke(IPC_CHANNELS.TICKET_GET, ticketId),
    open: (payload) => ipcRenderer.invoke(IPC_CHANNELS.TICKET_OPEN, payload),
    setItems: (payload) => ipcRenderer.invoke(IPC_CHANNELS.TICKET_SET_ITEMS, payload),
    cancel: (ticketId) => ipcRenderer.invoke(IPC_CHANNELS.TICKET_CANCEL, ticketId),
    fireItems: (payload) => ipcRenderer.invoke(IPC_CHANNELS.TICKET_FIRE_ITEMS, payload),
    assignRider: (payload) => ipcRenderer.invoke(IPC_CHANNELS.TICKET_ASSIGN_RIDER, payload),
  },
  kitchen: {
    listActive: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.KITCHEN_LIST_ACTIVE, businessId),
    bump: (payload) => ipcRenderer.invoke(IPC_CHANNELS.KITCHEN_BUMP, payload),
    recall: (payload) => ipcRenderer.invoke(IPC_CHANNELS.KITCHEN_RECALL, payload),
  },
  happyHour: {
    list: (businessId) => ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_LIST, businessId),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_CREATE, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_UPDATE, payload),
    setActive: (payload) => ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_SET_ACTIVE, payload),
    resolvePrice: (payload) => ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_RESOLVE_PRICE, payload),
  },
  activity: {
    list: (payload) => ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_LIST, payload),
  },
  analytics: {
    summary: (payload) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_SUMMARY, payload),
  },
  assets: {
    pickAndSave: (payload) => ipcRenderer.invoke(IPC_CHANNELS.ASSETS_PICK_AND_SAVE, payload),
  },
  backup: {
    create: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CREATE),
    restore: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE, filePath),
    pickFile: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_PICK_FILE),
    getAutoSettings: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_AUTO_SETTINGS),
    setAutoSettings: (payload) => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_SET_AUTO_SETTINGS, payload),
    onProgress: (callback) => {
      const listener = (_event: unknown, progress: BackupProgressEvent) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.BACKUP_PROGRESS, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.BACKUP_PROGRESS, listener)
      }
    },
  },
}

contextBridge.exposeInMainWorld('api', api)
