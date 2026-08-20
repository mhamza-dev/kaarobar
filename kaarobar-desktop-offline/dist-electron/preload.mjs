"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
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
  PO_LIST: "po:list",
  PO_GET_DETAIL: "po:getDetail",
  PO_CREATE: "po:create",
  PO_PRINT: "po:print",
  CUSTOMER_LIST: "customer:list",
  CUSTOMER_GET_DETAIL: "customer:getDetail",
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_RECORD_PAYMENT: "customer:recordPayment",
  CUSTOMER_PRINT_LEDGER: "customer:printLedger",
  SALES_LIST: "sales:list",
  SALES_GET_DETAIL: "sales:getDetail",
  SALES_FIND_BY_INVOICE: "sales:findByInvoice",
  SALES_CREATE: "sales:create",
  SALES_REFUND_REQUEST: "sales:refundRequest",
  SALES_REFUND_REVIEW: "sales:refundReview",
  SALES_PRINT: "sales:print",
  PRINTER_LIST: "printer:list",
  PRINTER_GET_SETTINGS: "printer:getSettings",
  PRINTER_SET_SETTINGS: "printer:setSettings",
  PRINTER_TEST: "printer:test",
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
  BACKUP_SET_AUTO_SETTINGS: "backup:setAutoSettings"
};
const api = {
  app: {
    getInfo: () => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO),
    ping: () => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_PING),
    getBootState: () => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_GET_BOOT_STATE),
    getBrandColor: () => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_GET_BRAND_COLOR),
    getLanguage: () => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_GET_LANGUAGE),
    setLanguage: (language) => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_SET_LANGUAGE, language),
    getLicenseStatus: () => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_GET_LICENSE_STATUS),
    getRestockAlerts: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_GET_RESTOCK_ALERTS, businessId),
    maybeRunDailyReminders: () => electron.ipcRenderer.invoke(IPC_CHANNELS.REMINDERS_MAYBE_RUN),
    onDailyReminder: (callback) => {
      const listener = (_event, payload) => {
        callback(payload);
      };
      electron.ipcRenderer.on(IPC_CHANNELS.REMINDERS_DAILY, listener);
      return () => {
        electron.ipcRenderer.removeListener(IPC_CHANNELS.REMINDERS_DAILY, listener);
      };
    }
  },
  license: {
    activate: (licenseKey) => electron.ipcRenderer.invoke(IPC_CHANNELS.LICENSE_ACTIVATE, licenseKey)
  },
  setup: {
    complete: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SETUP_COMPLETE, payload),
    restoreFromBackup: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SETUP_RESTORE_FROM_BACKUP, payload)
  },
  auth: {
    login: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, payload),
    resetOwnerPasswordOffline: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH_RESET_OWNER_PASSWORD_OFFLINE, payload),
    logout: () => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    session: () => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH_SESSION)
  },
  business: {
    list: () => electron.ipcRenderer.invoke(IPC_CHANNELS.BUSINESS_LIST),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.BUSINESS_CREATE, payload),
    update: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.BUSINESS_UPDATE, payload),
    setActive: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.BUSINESS_SET_ACTIVE, businessId),
    branches: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.BRANCH_LIST, businessId),
    createBranch: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.BRANCH_CREATE, payload),
    updateBranch: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.BRANCH_UPDATE, payload)
  },
  users: {
    list: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.USER_LIST, businessId),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.USER_CREATE, payload),
    updateSelf: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.USER_UPDATE_SELF, payload),
    setActive: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.USER_SET_ACTIVE, payload)
  },
  products: {
    list: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST, businessId),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_CREATE, payload),
    update: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_UPDATE, payload),
    setActive: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_SET_ACTIVE, payload),
    delete: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_DELETE, id),
    generateBarcode: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_GENERATE_BARCODE, businessId),
    getActivity: (productId) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_ACTIVITY, productId),
    listSuppliers: (productId) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRODUCT_LIST_SUPPLIERS, productId)
  },
  suppliers: {
    list: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_LIST, businessId),
    getDetail: (supplierId) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_GET_DETAIL, supplierId),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_CREATE, payload),
    update: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UPDATE, payload),
    listProducts: (supplierId) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_LIST_PRODUCTS, supplierId),
    linkProduct: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_LINK_PRODUCT, payload),
    unlinkProduct: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UNLINK_PRODUCT, payload),
    updateLinkedProduct: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUPPLIER_UPDATE_LINKED_PRODUCT, payload)
  },
  purchaseOrders: {
    list: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.PO_LIST, businessId),
    getDetail: (poId) => electron.ipcRenderer.invoke(IPC_CHANNELS.PO_GET_DETAIL, poId),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.PO_CREATE, payload),
    print: (poId) => electron.ipcRenderer.invoke(IPC_CHANNELS.PO_PRINT, poId)
  },
  customers: {
    list: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_LIST, businessId),
    getDetail: (customerId) => electron.ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_GET_DETAIL, customerId),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_CREATE, payload),
    update: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_UPDATE, payload),
    recordPayment: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_RECORD_PAYMENT, payload),
    printLedger: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.CUSTOMER_PRINT_LEDGER, payload)
  },
  printer: {
    list: () => electron.ipcRenderer.invoke(IPC_CHANNELS.PRINTER_LIST),
    getSettings: () => electron.ipcRenderer.invoke(IPC_CHANNELS.PRINTER_GET_SETTINGS),
    setSettings: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRINTER_SET_SETTINGS, payload),
    test: (kind) => electron.ipcRenderer.invoke(IPC_CHANNELS.PRINTER_TEST, kind)
  },
  sales: {
    list: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.SALES_LIST, businessId),
    getDetail: (saleId) => electron.ipcRenderer.invoke(IPC_CHANNELS.SALES_GET_DETAIL, saleId),
    findByInvoice: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SALES_FIND_BY_INVOICE, payload),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SALES_CREATE, payload),
    createRefundRequest: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SALES_REFUND_REQUEST, payload),
    reviewRefundRequest: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SALES_REFUND_REVIEW, payload),
    printReceipt: (saleId) => electron.ipcRenderer.invoke(IPC_CHANNELS.SALES_PRINT, saleId),
    updateDelivery: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SALES_UPDATE_DELIVERY, payload)
  },
  tables: {
    list: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.TABLE_LIST, businessId),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.TABLE_CREATE, payload),
    update: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.TABLE_UPDATE, payload)
  },
  tickets: {
    listOpen: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.TICKET_LIST_OPEN, businessId),
    get: (ticketId) => electron.ipcRenderer.invoke(IPC_CHANNELS.TICKET_GET, ticketId),
    open: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.TICKET_OPEN, payload),
    setItems: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.TICKET_SET_ITEMS, payload),
    cancel: (ticketId) => electron.ipcRenderer.invoke(IPC_CHANNELS.TICKET_CANCEL, ticketId),
    fireItems: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.TICKET_FIRE_ITEMS, payload),
    assignRider: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.TICKET_ASSIGN_RIDER, payload)
  },
  kitchen: {
    listActive: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.KITCHEN_LIST_ACTIVE, businessId),
    bump: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.KITCHEN_BUMP, payload),
    recall: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.KITCHEN_RECALL, payload)
  },
  happyHour: {
    list: (businessId) => electron.ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_LIST, businessId),
    create: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_CREATE, payload),
    update: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_UPDATE, payload),
    setActive: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_SET_ACTIVE, payload),
    resolvePrice: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.HAPPY_HOUR_RESOLVE_PRICE, payload)
  },
  activity: {
    list: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_LIST, payload)
  },
  analytics: {
    summary: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_SUMMARY, payload)
  },
  assets: {
    pickAndSave: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.ASSETS_PICK_AND_SAVE, payload)
  },
  backup: {
    create: () => electron.ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CREATE),
    restore: (filePath) => electron.ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE, filePath),
    pickFile: () => electron.ipcRenderer.invoke(IPC_CHANNELS.BACKUP_PICK_FILE),
    getAutoSettings: () => electron.ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_AUTO_SETTINGS),
    setAutoSettings: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.BACKUP_SET_AUTO_SETTINGS, payload),
    onProgress: (callback) => {
      const listener = (_event, progress) => {
        callback(progress);
      };
      electron.ipcRenderer.on(IPC_CHANNELS.BACKUP_PROGRESS, listener);
      return () => {
        electron.ipcRenderer.removeListener(IPC_CHANNELS.BACKUP_PROGRESS, listener);
      };
    }
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
