import { app, ipcMain } from 'electron'
import { IPC_CHANNELS, type AppInfo } from '../../shared/types/api'
import { activateLicense, getLicenseStatus } from '../licensing/service'
import { completeSetup, getBootBrandColor, getBootState, restoreSetupFromBackup } from '../setup/service'
import { getSession, login, logout, resetOwnerPasswordOffline } from '../auth/service'
import { assertBusinessAccess, requirePermission, requireSession } from '../auth/guards'
import { appStore, getAutoBackupSettings, setAutoBackupSettings } from '../config/store'
import { normalizeAppLanguage, type AppLanguage } from '../../shared/languages'
import { createBackup, pickBackupFile, restoreBackup } from '../backup/service'
import { getRestockAlertsForBusiness } from '../inventory/restockAlerts'
import { maybeRunDailyReminders } from '../reminders/dailyReminders'
import {
  assignTicketRider,
  bumpKitchenItems,
  cancelPosTicket,
  createBranch,
  createBusiness,
  createCustomer,
  createDiningTable,
  createHappyHourRule,
  createProduct,
  createPurchaseOrder,
  createRefundRequest,
  createSale,
  createSupplier,
  createUser,
  deleteProduct,
  fireTicketItems,
  generateProductBarcode,
  findSaleByInvoice,
  getCustomerDetail,
  getPosTicket,
  getPurchaseOrderDetail,
  getSaleDetail,
  getSupplierDetail,
  linkSupplierProduct,
  getAnalyticsSummary,
  listActiveKitchen,
  listActivity,
  listBranches,
  listBusinesses,
  listCustomers,
  listDiningTables,
  listHappyHourRules,
  listOpenTickets,
  listProductSuppliers,
  listProducts,
  listPurchaseOrders,
  listSales,
  listSupplierProducts,
  listSuppliers,
  listUsers,
  openPosTicket,
  printPurchaseOrder,
  printSaleReceipt,
  printCustomerLedger,
  recallKitchenItems,
  recordCustomerPayment,
  resolveUnitPrice,
  reviewRefundRequest,
  setActiveBusiness,
  setHappyHourRuleActive,
  setPosTicketItems,
  setProductActive,
  setUserActive,
  unlinkSupplierProduct,
  updateBranch,
  updateBusiness,
  updateCustomer,
  updateDiningTable,
  updateHappyHourRule,
  updateSaleDelivery,
  updateSelfUserProfile,
  updateLinkedSupplierProduct,
  updateProduct,
  updateSupplier,
} from '../domain/service'
import { pickAndSaveAsset } from '../assets/service'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_PING, async () => ({
    ok: true as const,
    at: new Date().toISOString(),
  }))

  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, async (): Promise<AppInfo> => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath('userData'),
  }))

  ipcMain.handle(IPC_CHANNELS.APP_GET_BOOT_STATE, async () => getBootState())
  ipcMain.handle(IPC_CHANNELS.APP_GET_BRAND_COLOR, async () => getBootBrandColor())
  ipcMain.handle(IPC_CHANNELS.APP_GET_LANGUAGE, async () => normalizeAppLanguage(appStore.get('language')))
  ipcMain.handle(IPC_CHANNELS.APP_SET_LANGUAGE, async (_event, language: AppLanguage) => {
    const next = normalizeAppLanguage(language)
    appStore.set('language', next)
    return { ok: true as const }
  })
  ipcMain.handle(IPC_CHANNELS.APP_GET_LICENSE_STATUS, async () => {
    const status = getLicenseStatus()
    if (status.status === 'none') {
      return { state: 'missing' as const, expiresAt: null, issuedTo: null }
    }
    if (status.status === 'expired') {
      return {
        state: 'expired' as const,
        expiresAt: status.record.expiresAt,
        issuedTo: status.record.issuedTo,
      }
    }
    return {
      state: status.record.expiresAt ? ('valid' as const) : ('lifetime' as const),
      expiresAt: status.record.expiresAt,
      issuedTo: status.record.issuedTo,
    }
  })
  ipcMain.handle(IPC_CHANNELS.APP_GET_RESTOCK_ALERTS, async (_event, businessId: string) => {
    requirePermission('business:view')
    const scopedBusinessId = businessId?.trim()
    if (!scopedBusinessId) return []
    assertBusinessAccess(scopedBusinessId)
    return getRestockAlertsForBusiness(scopedBusinessId)
  })
  ipcMain.handle(IPC_CHANNELS.REMINDERS_MAYBE_RUN, async () => {
    requireSession()
    return maybeRunDailyReminders()
  })
  ipcMain.handle(IPC_CHANNELS.LICENSE_ACTIVATE, async (_event, licenseKey: string) => activateLicense(licenseKey))
  ipcMain.handle(IPC_CHANNELS.SETUP_COMPLETE, async (_event, payload) => completeSetup(payload))
  ipcMain.handle(IPC_CHANNELS.SETUP_RESTORE_FROM_BACKUP, async (event, payload) =>
    restoreSetupFromBackup(payload, (progress) => {
      event.sender.send(IPC_CHANNELS.BACKUP_PROGRESS, progress)
    }),
  )
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, payload) => login(payload))
  ipcMain.handle(IPC_CHANNELS.AUTH_RESET_OWNER_PASSWORD_OFFLINE, async (_event, payload) =>
    resetOwnerPasswordOffline(payload),
  )
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => logout())
  ipcMain.handle(IPC_CHANNELS.AUTH_SESSION, async () => getSession())

  ipcMain.handle(IPC_CHANNELS.BUSINESS_LIST, async () => listBusinesses())
  ipcMain.handle(IPC_CHANNELS.BUSINESS_CREATE, async (_event, payload) => createBusiness(payload))
  ipcMain.handle(IPC_CHANNELS.BUSINESS_UPDATE, async (_event, payload) => updateBusiness(payload))
  ipcMain.handle(IPC_CHANNELS.BUSINESS_SET_ACTIVE, async (_event, businessId: string) => setActiveBusiness(businessId))
  ipcMain.handle(IPC_CHANNELS.BRANCH_LIST, async (_event, businessId: string) => listBranches(businessId))
  ipcMain.handle(IPC_CHANNELS.BRANCH_CREATE, async (_event, payload) => createBranch(payload))
  ipcMain.handle(IPC_CHANNELS.BRANCH_UPDATE, async (_event, payload) => updateBranch(payload))

  ipcMain.handle(IPC_CHANNELS.USER_LIST, async (_event, businessId: string) => listUsers(businessId))
  ipcMain.handle(IPC_CHANNELS.USER_CREATE, async (_event, payload) => createUser(payload))
  ipcMain.handle(IPC_CHANNELS.USER_UPDATE_SELF, async (_event, payload) => updateSelfUserProfile(payload))
  ipcMain.handle(IPC_CHANNELS.USER_SET_ACTIVE, async (_event, payload) => setUserActive(payload))

  ipcMain.handle(IPC_CHANNELS.PRODUCT_LIST, async (_event, businessId: string) => listProducts(businessId))
  ipcMain.handle(IPC_CHANNELS.PRODUCT_CREATE, async (_event, payload) => createProduct(payload))
  ipcMain.handle(IPC_CHANNELS.PRODUCT_UPDATE, async (_event, payload) => updateProduct(payload))
  ipcMain.handle(IPC_CHANNELS.PRODUCT_SET_ACTIVE, async (_event, payload) => setProductActive(payload))
  ipcMain.handle(IPC_CHANNELS.PRODUCT_DELETE, async (_event, id: string) => deleteProduct(id))
  ipcMain.handle(IPC_CHANNELS.PRODUCT_GENERATE_BARCODE, async (_event, businessId: string) =>
    generateProductBarcode(businessId),
  )
  ipcMain.handle(IPC_CHANNELS.PRODUCT_ACTIVITY, async (_event, productId: string) =>
    listActivity('product', productId),
  )
  ipcMain.handle(IPC_CHANNELS.PRODUCT_LIST_SUPPLIERS, async (_event, productId: string) =>
    listProductSuppliers(productId),
  )

  ipcMain.handle(IPC_CHANNELS.SUPPLIER_LIST, async (_event, businessId: string) => listSuppliers(businessId))
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_GET_DETAIL, async (_event, supplierId: string) =>
    getSupplierDetail(supplierId),
  )
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_CREATE, async (_event, payload) => createSupplier(payload))
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_UPDATE, async (_event, payload) => updateSupplier(payload))
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_LIST_PRODUCTS, async (_event, supplierId: string) =>
    listSupplierProducts(supplierId),
  )
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_LINK_PRODUCT, async (_event, payload) => linkSupplierProduct(payload))
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_UNLINK_PRODUCT, async (_event, payload) =>
    unlinkSupplierProduct(payload),
  )
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_UPDATE_LINKED_PRODUCT, async (_event, payload) =>
    updateLinkedSupplierProduct(payload),
  )

  ipcMain.handle(IPC_CHANNELS.PO_LIST, async (_event, businessId: string) => listPurchaseOrders(businessId))
  ipcMain.handle(IPC_CHANNELS.PO_GET_DETAIL, async (_event, poId: string) => getPurchaseOrderDetail(poId))
  ipcMain.handle(IPC_CHANNELS.PO_CREATE, async (_event, payload) => createPurchaseOrder(payload))
  ipcMain.handle(IPC_CHANNELS.PO_PRINT, async (_event, poId: string) => printPurchaseOrder(poId))

  ipcMain.handle(IPC_CHANNELS.CUSTOMER_LIST, async (_event, businessId: string) => listCustomers(businessId))
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_GET_DETAIL, async (_event, customerId: string) => getCustomerDetail(customerId))
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_CREATE, async (_event, payload) => createCustomer(payload))
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_UPDATE, async (_event, payload) => updateCustomer(payload))
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_RECORD_PAYMENT, async (_event, payload) =>
    recordCustomerPayment(payload),
  )
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_PRINT_LEDGER, async (_event, payload) =>
    printCustomerLedger(payload),
  )

  ipcMain.handle(IPC_CHANNELS.SALES_LIST, async (_event, businessId: string) => listSales(businessId))
  ipcMain.handle(IPC_CHANNELS.SALES_GET_DETAIL, async (_event, saleId: string) => getSaleDetail(saleId))
  ipcMain.handle(
    IPC_CHANNELS.SALES_FIND_BY_INVOICE,
    async (_event, payload: { businessId: string; invoiceNo: string }) =>
      findSaleByInvoice(payload.businessId, payload.invoiceNo),
  )
  ipcMain.handle(IPC_CHANNELS.SALES_CREATE, async (_event, payload) => createSale(payload))
  ipcMain.handle(IPC_CHANNELS.SALES_REFUND_REQUEST, async (_event, payload) => createRefundRequest(payload))
  ipcMain.handle(IPC_CHANNELS.SALES_REFUND_REVIEW, async (_event, payload) => reviewRefundRequest(payload))
  ipcMain.handle(IPC_CHANNELS.SALES_PRINT, async (_event, saleId: string) => printSaleReceipt(saleId))

  ipcMain.handle(IPC_CHANNELS.TABLE_LIST, async (_event, businessId: string) => listDiningTables(businessId))
  ipcMain.handle(IPC_CHANNELS.TABLE_CREATE, async (_event, payload) => createDiningTable(payload))
  ipcMain.handle(IPC_CHANNELS.TABLE_UPDATE, async (_event, payload) => updateDiningTable(payload))

  ipcMain.handle(IPC_CHANNELS.TICKET_LIST_OPEN, async (_event, businessId: string) => listOpenTickets(businessId))
  ipcMain.handle(IPC_CHANNELS.TICKET_GET, async (_event, ticketId: string) => getPosTicket(ticketId))
  ipcMain.handle(IPC_CHANNELS.TICKET_OPEN, async (_event, payload) => openPosTicket(payload))
  ipcMain.handle(IPC_CHANNELS.TICKET_SET_ITEMS, async (_event, payload) => setPosTicketItems(payload))
  ipcMain.handle(IPC_CHANNELS.TICKET_CANCEL, async (_event, ticketId: string) => cancelPosTicket(ticketId))
  ipcMain.handle(IPC_CHANNELS.TICKET_FIRE_ITEMS, async (_event, payload) => fireTicketItems(payload))
  ipcMain.handle(IPC_CHANNELS.TICKET_ASSIGN_RIDER, async (_event, payload) => assignTicketRider(payload))
  ipcMain.handle(IPC_CHANNELS.KITCHEN_LIST_ACTIVE, async (_event, businessId: string) =>
    listActiveKitchen(businessId),
  )
  ipcMain.handle(IPC_CHANNELS.KITCHEN_BUMP, async (_event, payload) => bumpKitchenItems(payload))
  ipcMain.handle(IPC_CHANNELS.KITCHEN_RECALL, async (_event, payload) => recallKitchenItems(payload))
  ipcMain.handle(IPC_CHANNELS.HAPPY_HOUR_LIST, async (_event, businessId: string) =>
    listHappyHourRules(businessId),
  )
  ipcMain.handle(IPC_CHANNELS.HAPPY_HOUR_CREATE, async (_event, payload) => createHappyHourRule(payload))
  ipcMain.handle(IPC_CHANNELS.HAPPY_HOUR_UPDATE, async (_event, payload) => updateHappyHourRule(payload))
  ipcMain.handle(IPC_CHANNELS.HAPPY_HOUR_SET_ACTIVE, async (_event, payload) =>
    setHappyHourRuleActive(payload),
  )
  ipcMain.handle(IPC_CHANNELS.HAPPY_HOUR_RESOLVE_PRICE, async (_event, payload) => resolveUnitPrice(payload))
  ipcMain.handle(IPC_CHANNELS.SALES_UPDATE_DELIVERY, async (_event, payload) => updateSaleDelivery(payload))

  ipcMain.handle(IPC_CHANNELS.ACTIVITY_LIST, async (_event, payload: { entityType: string; entityId: string }) =>
    listActivity(payload.entityType, payload.entityId),
  )

  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_SUMMARY,
    async (
      _event,
      payload: { businessId: string; days?: 7 | 30 | 90; from?: string; to?: string } | string,
    ) => {
      // Support stale callers that still pass a bare businessId string.
      if (typeof payload === 'string') {
        return getAnalyticsSummary({ businessId: payload, days: 30 })
      }
      return getAnalyticsSummary({
        businessId: payload?.businessId ?? '',
        days: payload?.days,
        from: payload?.from,
        to: payload?.to,
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.ASSETS_PICK_AND_SAVE, async (_event, payload: { kind: 'logo' | 'product' }) =>
    pickAndSaveAsset(payload.kind),
  )

  ipcMain.handle(IPC_CHANNELS.BACKUP_CREATE, async (event) =>
    createBackup((progress) => {
      event.sender.send(IPC_CHANNELS.BACKUP_PROGRESS, progress)
    }),
  )
  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, async (event, filePath: string) =>
    restoreBackup(filePath, (progress) => {
      event.sender.send(IPC_CHANNELS.BACKUP_PROGRESS, progress)
    }),
  )
  ipcMain.handle(IPC_CHANNELS.BACKUP_PICK_FILE, async () => pickBackupFile())
  ipcMain.handle(IPC_CHANNELS.BACKUP_GET_AUTO_SETTINGS, async () => {
    requirePermission('business:view')
    return getAutoBackupSettings()
  })
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_SET_AUTO_SETTINGS,
    async (
      _event,
      payload: { autoBackupEnabled?: boolean; autoBackupTime?: string },
    ) => {
      requirePermission('business:view')
      return setAutoBackupSettings(payload)
    },
  )
}
