import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { appStore } from '../config/store'
import { getDb, openDatabase } from '../db/connection'
import { runMigrations } from '../db/migrations'
import {
  assertBranchAccess,
  assertBusinessAccess,
  requirePermission,
  requireSession,
  requireValidLicense,
} from '../auth/guards'
import type {
  ActivityEntry,
  AnalyticsSummary,
  Branch,
  Business,
  BusinessNature,
  Customer,
  CustomerDetail,
  DiningTable,
  LedgerEntry,
  PosTicket,
  PosTicketItem,
  Product,
  ProductKind,
  ProductSupplierLink,
  PurchaseOrder,
  PurchaseOrderDetail,
  RefundRequest,
  Sale,
  SaleDetail,
  SaleItem,
  ServiceMode,
  SessionUser,
  StaffUser,
  Supplier,
  SupplierDetail,
  SupplierProduct,
} from '../../shared/types/api'
import {
  defaultTracksStock,
  isValidProductKind,
  normalizeBusinessNature,
  showsServedBy,
  showsServiceMode,
  showsTables,
} from '../../shared/businessNature'
import {
  formatInvoiceNumber,
  invoicePrefix,
  parseInvoiceSequence,
} from '../../shared/invoice'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { buildSaleReceiptHtml } from '../receipt/buildSaleReceiptHtml'
import { buildPurchaseOrderHtml } from '../receipt/buildPurchaseOrderHtml'
import { buildCustomerLedgerHtml } from '../receipt/buildCustomerLedgerHtml'
import { openPrintPreview } from '../receipt/openPrintPreview'

const require = createRequire(import.meta.url)

function db() {
  openDatabase()
  runMigrations(getDb())
  return getDb()
}

function nowIso() {
  return new Date().toISOString()
}

function writeActivity(input: {
  businessId: string | null
  actorUserId: string
  entityType: string
  entityId: string
  action: string
  summary: string
  payload?: unknown
}) {
  db()
    .prepare(
      `INSERT INTO activity_log (id, business_id, actor_user_id, entity_type, entity_id, action, summary, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      uuidv4(),
      input.businessId,
      input.actorUserId,
      input.entityType,
      input.entityId,
      input.action,
      input.summary,
      input.payload ? JSON.stringify(input.payload) : null,
      nowIso(),
    )
}

function assertProductPrices(price: number, costPrice: number | null | undefined): void {
  if (!Number.isFinite(price) || price < 0) throw new Error('Sale price must be >= 0')
  if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0)) {
    throw new Error('Cost price must be >= 0')
  }
  if (costPrice != null && price < costPrice) {
    throw new Error('Sale price must be greater than or equal to cost price')
  }
}

function mapProductRow(row: {
  id: string
  business_id: string
  branch_id: string | null
  name: string
  barcode: string | null
  price: number
  cost_price: number | null
  stock_qty: number
  kind?: string | null
  tracks_stock?: number | null
  image_path: string | null
  is_active: number
}): Product {
  const kind = (row.kind as ProductKind) || 'item'
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    name: row.name,
    barcode: row.barcode,
    price: row.price,
    costPrice: row.cost_price,
    stockQty: row.stock_qty,
    kind,
    tracksStock: row.tracks_stock == null ? defaultTracksStock(kind) : Boolean(row.tracks_stock),
    imagePath: row.image_path,
    isActive: Boolean(row.is_active),
  }
}

function getBusinessNature(businessId: string): BusinessNature {
  const row = db()
    .prepare('SELECT business_nature FROM businesses WHERE id = ?')
    .get(businessId) as { business_nature: string } | undefined
  return normalizeBusinessNature(row?.business_nature)
}

function mapSupplierProductRow(row: {
  link_id: string
  supplier_id: string
  product_id: string
  unit_cost: number
  id: string
  business_id: string
  branch_id: string | null
  name: string
  barcode: string | null
  price: number
  cost_price: number | null
  stock_qty: number
  kind?: string | null
  tracks_stock?: number | null
  image_path: string | null
  is_active: number
}): SupplierProduct {
  return {
    linkId: row.link_id,
    supplierId: row.supplier_id,
    productId: row.product_id,
    unitCost: row.unit_cost,
    product: mapProductRow(row),
  }
}

function mapActivity(row: {
  id: string
  business_id: string | null
  actor_user_id: string
  actor_name: string
  entity_type: string
  entity_id: string
  action: string
  summary: string
  payload_json: string | null
  created_at: string
}): ActivityEntry {
  return {
    id: row.id,
    businessId: row.business_id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    summary: row.summary,
    payloadJson: row.payload_json,
    createdAt: row.created_at,
  }
}

export function listActivity(entityType: string, entityId: string): ActivityEntry[] {
  requireSession()
  const rows = db()
    .prepare(
      `SELECT a.id, a.business_id, a.actor_user_id, u.name as actor_name, a.entity_type, a.entity_id,
              a.action, a.summary, a.payload_json, a.created_at
       FROM activity_log a
       JOIN users u ON u.id = a.actor_user_id
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
    )
    .all(entityType, entityId) as Array<Parameters<typeof mapActivity>[0]>
  return rows.map(mapActivity)
}

export function listBusinesses(): Business[] {
  const session = requireSession()
  const rows = (session.role === 'owner'
    ? db()
      .prepare(
        `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
                  social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
                  receipt_header, receipt_footer
           FROM businesses ORDER BY created_at DESC`,
      )
      .all()
    : db()
      .prepare(
        `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
                  social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
                  receipt_header, receipt_footer
           FROM businesses WHERE id = ?`,
      )
      .all(session.businessId)) as Array<{
        id: string
        name: string
        currency: string
        brand_color: string
        business_nature: string
        logo_path: string | null
        is_active: number
        social_whatsapp: string | null
        social_instagram: string | null
        social_facebook: string | null
        social_tiktok: string | null
        social_website: string | null
        receipt_header: string | null
        receipt_footer: string | null
      }>

  return rows.map(mapBusinessRow)
}

function mapBusinessRow(row: {
  id: string
  name: string
  currency: string
  brand_color: string
  business_nature?: string | null
  logo_path: string | null
  is_active: number
  social_whatsapp: string | null
  social_instagram: string | null
  social_facebook: string | null
  social_tiktok: string | null
  social_website: string | null
  receipt_header?: string | null
  receipt_footer?: string | null
}): Business {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    brandColor: row.brand_color,
    businessNature: normalizeBusinessNature(row.business_nature),
    logoPath: row.logo_path,
    socialWhatsapp: row.social_whatsapp,
    socialInstagram: row.social_instagram,
    socialFacebook: row.social_facebook,
    socialTiktok: row.social_tiktok,
    socialWebsite: row.social_website,
    receiptHeader: row.receipt_header ?? null,
    receiptFooter: row.receipt_footer ?? null,
    isActive: Boolean(row.is_active),
  }
}

function normalizeSocial(value?: string | null): string | null {
  const trimmed = value?.trim() || ''
  return trimmed || null
}

export function createBusiness(payload: {
  name: string
  currency: string
  brandColor: string
  businessNature?: BusinessNature
  logoPath?: string | null
  socialWhatsapp?: string | null
  socialInstagram?: string | null
  socialFacebook?: string | null
  socialTiktok?: string | null
  socialWebsite?: string | null
  receiptHeader?: string | null
  receiptFooter?: string | null
}): Business {
  const session = requirePermission('business:edit')
  const existing = db().prepare('SELECT id FROM businesses LIMIT 1').get() as { id: string } | undefined
  if (existing) {
    throw new Error('This installation already has a business. Only one business is supported.')
  }
  const id = uuidv4()
  const at = nowIso()
  const logoPath = payload.logoPath?.trim() || null
  const businessNature = normalizeBusinessNature(payload.businessNature)
  const socials = {
    socialWhatsapp: normalizeSocial(payload.socialWhatsapp),
    socialInstagram: normalizeSocial(payload.socialInstagram),
    socialFacebook: normalizeSocial(payload.socialFacebook),
    socialTiktok: normalizeSocial(payload.socialTiktok),
    socialWebsite: normalizeSocial(payload.socialWebsite),
  }
  const receiptHeader = normalizeSocial(payload.receiptHeader)
  const receiptFooter =
    normalizeSocial(payload.receiptFooter) ?? 'Thank you for shopping with us'
  db()
    .prepare(
      `INSERT INTO businesses (
         id, owner_id, name, currency, brand_color, business_nature, logo_path,
         social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
         receipt_header, receipt_footer,
         is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      id,
      session.id,
      payload.name.trim(),
      payload.currency.trim() || 'PKR',
      payload.brandColor,
      businessNature,
      logoPath,
      socials.socialWhatsapp,
      socials.socialInstagram,
      socials.socialFacebook,
      socials.socialTiktok,
      socials.socialWebsite,
      receiptHeader,
      receiptFooter,
      at,
      at,
    )
  writeActivity({
    businessId: id,
    actorUserId: session.id,
    entityType: 'business',
    entityId: id,
    action: 'created',
    summary: `Created business ${payload.name.trim()}`,
  })
  return {
    id,
    name: payload.name.trim(),
    currency: payload.currency.trim() || 'PKR',
    brandColor: payload.brandColor,
    businessNature,
    logoPath,
    ...socials,
    receiptHeader,
    receiptFooter,
    isActive: true,
  }
}

export function updateBusiness(payload: {
  id: string
  name: string
  currency: string
  brandColor: string
  businessNature?: BusinessNature
  logoPath?: string | null
  socialWhatsapp?: string | null
  socialInstagram?: string | null
  socialFacebook?: string | null
  socialTiktok?: string | null
  socialWebsite?: string | null
  receiptHeader?: string | null
  receiptFooter?: string | null
}): Business {
  const session = requirePermission('business:edit')
  assertBusinessAccess(payload.id)
  const logoPath = payload.logoPath === undefined ? undefined : payload.logoPath?.trim() || null
  const businessNature =
    payload.businessNature === undefined
      ? undefined
      : normalizeBusinessNature(payload.businessNature)
  const socials = {
    socialWhatsapp: normalizeSocial(payload.socialWhatsapp),
    socialInstagram: normalizeSocial(payload.socialInstagram),
    socialFacebook: normalizeSocial(payload.socialFacebook),
    socialTiktok: normalizeSocial(payload.socialTiktok),
    socialWebsite: normalizeSocial(payload.socialWebsite),
  }
  if (logoPath === undefined) {
    if (businessNature === undefined) {
      db()
        .prepare(
          `UPDATE businesses SET name = ?, currency = ?, brand_color = ?,
           social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
           WHERE id = ?`,
        )
        .run(
          payload.name.trim(),
          payload.currency.trim() || 'PKR',
          payload.brandColor,
          socials.socialWhatsapp,
          socials.socialInstagram,
          socials.socialFacebook,
          socials.socialTiktok,
          socials.socialWebsite,
          payload.id,
        )
    } else {
      db()
        .prepare(
          `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, business_nature = ?,
           social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
           WHERE id = ?`,
        )
        .run(
          payload.name.trim(),
          payload.currency.trim() || 'PKR',
          payload.brandColor,
          businessNature,
          socials.socialWhatsapp,
          socials.socialInstagram,
          socials.socialFacebook,
          socials.socialTiktok,
          socials.socialWebsite,
          payload.id,
        )
    }
  } else if (businessNature === undefined) {
    db()
      .prepare(
        `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, logo_path = ?,
         social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
         WHERE id = ?`,
      )
      .run(
        payload.name.trim(),
        payload.currency.trim() || 'PKR',
        payload.brandColor,
        logoPath,
        socials.socialWhatsapp,
        socials.socialInstagram,
        socials.socialFacebook,
        socials.socialTiktok,
        socials.socialWebsite,
        payload.id,
      )
  } else {
    db()
      .prepare(
        `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, business_nature = ?, logo_path = ?,
         social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
         WHERE id = ?`,
      )
      .run(
        payload.name.trim(),
        payload.currency.trim() || 'PKR',
        payload.brandColor,
        businessNature,
        logoPath,
        socials.socialWhatsapp,
        socials.socialInstagram,
        socials.socialFacebook,
        socials.socialTiktok,
        socials.socialWebsite,
        payload.id,
      )
  }

  if (payload.receiptHeader !== undefined || payload.receiptFooter !== undefined) {
    const current = db()
      .prepare(`SELECT receipt_header, receipt_footer FROM businesses WHERE id = ?`)
      .get(payload.id) as { receipt_header: string | null; receipt_footer: string | null }
    db()
      .prepare(`UPDATE businesses SET receipt_header = ?, receipt_footer = ? WHERE id = ?`)
      .run(
        payload.receiptHeader !== undefined
          ? normalizeSocial(payload.receiptHeader)
          : current.receipt_header,
        payload.receiptFooter !== undefined
          ? normalizeSocial(payload.receiptFooter)
          : current.receipt_footer,
        payload.id,
      )
  }

  const row = db()
    .prepare(
      `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
              social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
              receipt_header, receipt_footer
       FROM businesses WHERE id = ?`,
    )
    .get(payload.id) as Parameters<typeof mapBusinessRow>[0]
  writeActivity({
    businessId: payload.id,
    actorUserId: session.id,
    entityType: 'business',
    entityId: payload.id,
    action: 'updated',
    summary: `Updated business ${payload.name.trim()}`,
  })
  return mapBusinessRow(row)
}

export function setActiveBusiness(businessId: string): { ok: true } {
  assertBusinessAccess(businessId)
  appStore.set('lastBusinessId', businessId)
  return { ok: true }
}

export function listBranches(businessId: string): Branch[] {
  assertBusinessAccess(businessId)
  const rows = db()
    .prepare(
      'SELECT id, business_id, name, address, phone, is_main_branch, is_active FROM branches WHERE business_id = ? ORDER BY created_at DESC',
    )
    .all(businessId) as Array<{
      id: string
      business_id: string
      name: string
      address: string | null
      phone: string | null
      is_main_branch: number
      is_active: number
    }>
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    isMainBranch: Boolean(row.is_main_branch),
    isActive: Boolean(row.is_active),
  }))
}

export function createBranch(payload: {
  businessId: string
  name: string
  address?: string
  phone?: string
}): Branch {
  requirePermission('branch:edit')
  assertBusinessAccess(payload.businessId)
  const existing = db()
    .prepare('SELECT id FROM branches WHERE business_id = ? LIMIT 1')
    .get(payload.businessId) as { id: string } | undefined
  if (existing) {
    throw new Error('This business already has a branch. Only one branch is supported.')
  }
  const session = requireSession()
  const id = uuidv4()
  db()
    .prepare(
      `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
    )
    .run(id, payload.businessId, payload.name.trim(), payload.address?.trim() || null, payload.phone?.trim() || null, nowIso())
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: 'branch',
    entityId: id,
    action: 'created',
    summary: `Created branch ${payload.name.trim()}`,
  })
  return {
    id,
    businessId: payload.businessId,
    name: payload.name.trim(),
    address: payload.address?.trim() || null,
    phone: payload.phone?.trim() || null,
    isMainBranch: true,
    isActive: true,
  }
}

export function updateBranch(payload: {
  id: string
  name: string
  address?: string
  phone?: string
  isActive?: boolean
}): Branch {
  const session = requirePermission('branch:edit')
  const existing = db()
    .prepare('SELECT business_id, is_main_branch, is_active FROM branches WHERE id = ?')
    .get(payload.id) as { business_id: string; is_main_branch: number; is_active: number } | undefined
  if (!existing) throw new Error('Branch not found')
  assertBusinessAccess(existing.business_id)
  const isActive = payload.isActive === undefined ? existing.is_active : payload.isActive ? 1 : 0
  db()
    .prepare('UPDATE branches SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?')
    .run(
      payload.name.trim(),
      payload.address?.trim() || null,
      payload.phone?.trim() || null,
      isActive,
      payload.id,
    )
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: 'branch',
    entityId: payload.id,
    action: 'updated',
    summary: `Updated branch ${payload.name.trim()}`,
  })
  return {
    id: payload.id,
    businessId: existing.business_id,
    name: payload.name.trim(),
    address: payload.address?.trim() || null,
    phone: payload.phone?.trim() || null,
    isMainBranch: Boolean(existing.is_main_branch),
    isActive: Boolean(isActive),
  }
}

export function listUsers(businessId: string): StaffUser[] {
  requireSession()
  assertBusinessAccess(businessId)
  const rows = db()
    .prepare(
      `SELECT id, name, email, role, business_id, branch_id, is_active FROM users
       WHERE business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?)
       ORDER BY created_at DESC`,
    )
    .all(businessId, businessId) as Array<{
      id: string
      name: string
      email: string
      role: StaffUser['role']
      business_id: string | null
      branch_id: string | null
      is_active: number
    }>
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    businessId: row.business_id,
    branchId: row.branch_id,
    isActive: Boolean(row.is_active),
  }))
}

export function createUser(payload: {
  businessId: string
  branchId: string | null
  name: string
  email: string
  password: string
  role: StaffUser['role']
}): StaffUser {
  const session = requirePermission('users:manage')
  assertBusinessAccess(payload.businessId)
  if (session.role !== 'owner' && payload.role === 'admin') throw new Error('Only owner can create admins')
  if (payload.branchId) assertBranchAccess(payload.branchId)

  const id = uuidv4()
  const hash = bcrypt.hashSync(payload.password, 12)
  db()
    .prepare(
      `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(id, payload.businessId, payload.branchId, payload.name.trim(), payload.email.trim().toLowerCase(), hash, payload.role, nowIso())
  return {
    id,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    role: payload.role,
    businessId: payload.businessId,
    branchId: payload.branchId,
    isActive: true,
  }
}

export function setUserActive(payload: { userId: string; isActive: boolean }): { ok: true } {
  requirePermission('users:manage')
  const row = db().prepare('SELECT business_id FROM users WHERE id = ?').get(payload.userId) as { business_id: string } | undefined
  if (!row) throw new Error('User not found')
  assertBusinessAccess(row.business_id)
  db().prepare('UPDATE users SET is_active = ? WHERE id = ?').run(payload.isActive ? 1 : 0, payload.userId)
  return { ok: true }
}

export function updateSelfUserProfile(payload: {
  name?: string
  imagePath?: string | null
  currentPassword?: string
  newPassword?: string
}): SessionUser {
  const session = requireSession()
  const existing = db()
    .prepare('SELECT id, name, email, role, business_id, branch_id, password_hash, image_path FROM users WHERE id = ?')
    .get(session.id) as
    | {
      id: string
      name: string
      email: string
      role: SessionUser['role']
      business_id: string | null
      branch_id: string | null
      password_hash: string
      image_path: string | null
    }
    | undefined
  if (!existing) throw new Error('User not found')

  const nextName = payload.name?.trim() || existing.name
  if (!nextName) throw new Error('Name is required')
  const nextImagePath =
    payload.imagePath === undefined ? existing.image_path : payload.imagePath?.trim() || null

  let nextPasswordHash = existing.password_hash
  const newPassword = payload.newPassword?.trim() || ''
  const wantsPasswordChange = Boolean(newPassword)
  if (wantsPasswordChange) {
    if (session.role !== 'owner') throw new Error('Only owner can change password from settings')
    if (!payload.currentPassword?.trim()) throw new Error('Current password is required')
    if (!bcrypt.compareSync(payload.currentPassword, existing.password_hash)) {
      throw new Error('Current password is incorrect')
    }
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }
    nextPasswordHash = bcrypt.hashSync(newPassword, 12)
  }

  db()
    .prepare('UPDATE users SET name = ?, image_path = ?, password_hash = ? WHERE id = ?')
    .run(nextName, nextImagePath, nextPasswordHash, session.id)

  session.name = nextName
  session.imagePath = nextImagePath

  return {
    id: existing.id,
    name: nextName,
    email: existing.email,
    role: existing.role,
    businessId: existing.business_id,
    branchId: existing.branch_id,
    imagePath: nextImagePath,
  }
}

export function listProducts(businessId: string): Product[] {
  requireValidLicense()
  assertBusinessAccess(businessId)
  const rows = db()
    .prepare(
      `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock, image_path, is_active
       FROM products WHERE business_id = ? ORDER BY created_at DESC`,
    )
    .all(businessId) as Array<Parameters<typeof mapProductRow>[0]>
  return rows.map(mapProductRow)
}

export function createProduct(payload: {
  businessId: string
  branchId: string | null
  name: string
  barcode?: string
  price: number
  costPrice?: number
  stockQty?: number
  kind?: ProductKind
  tracksStock?: boolean
  imagePath?: string | null
  isActive?: boolean
}): Product {
  requireValidLicense()
  requirePermission('products:edit')
  assertBusinessAccess(payload.businessId)
  if (payload.branchId) assertBranchAccess(payload.branchId)
  assertProductPrices(payload.price, payload.costPrice ?? null)
  const nature = getBusinessNature(payload.businessId)
  const kind: ProductKind = payload.kind ?? 'item'
  if (!isValidProductKind(nature, kind)) {
    throw new Error(`Product kind "${kind}" is not allowed for this business type`)
  }
  const tracksStock =
    payload.tracksStock === undefined ? defaultTracksStock(kind) : Boolean(payload.tracksStock)
  if (tracksStock && kind !== 'item') {
    throw new Error('Only item products can track stock')
  }
  const session = requireSession()
  const id = uuidv4()
  const at = nowIso()
  const imagePath = payload.imagePath?.trim() || null
  const stockQty = tracksStock ? (payload.stockQty ?? 0) : 0
  db()
    .prepare(
      `INSERT INTO products (id, business_id, branch_id, category_id, name, sku, barcode, price, cost_price, stock_qty, kind, tracks_stock, unit, image_path, is_active, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, 'pcs', ?, ?, ?, ?)`,
    )
    .run(
      id,
      payload.businessId,
      payload.branchId,
      payload.name.trim(),
      payload.barcode?.trim() || null,
      payload.price,
      payload.costPrice ?? null,
      stockQty,
      kind,
      tracksStock ? 1 : 0,
      imagePath,
      payload.isActive === false ? 0 : 1,
      at,
      at,
    )
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: 'product',
    entityId: id,
    action: 'created',
    summary: `Created product ${payload.name.trim()}`,
  })
  return {
    id,
    businessId: payload.businessId,
    branchId: payload.branchId,
    name: payload.name.trim(),
    barcode: payload.barcode?.trim() || null,
    price: payload.price,
    costPrice: payload.costPrice ?? null,
    stockQty,
    kind,
    tracksStock,
    imagePath,
    isActive: payload.isActive !== false,
  }
}

export function updateProduct(payload: {
  id: string
  name: string
  barcode?: string | null
  price: number
  costPrice?: number | null
  stockQty?: number
  kind?: ProductKind
  tracksStock?: boolean
  imagePath?: string | null
  isActive?: boolean
}): Product {
  requireValidLicense()
  const session = requirePermission('products:edit')
  const existing = db()
    .prepare(
      'SELECT business_id, branch_id, stock_qty, kind, tracks_stock, image_path FROM products WHERE id = ?',
    )
    .get(payload.id) as {
      business_id: string
      branch_id: string | null
      stock_qty: number
      kind: string
      tracks_stock: number
      image_path: string | null
    } | undefined
  if (!existing) throw new Error('Product not found')
  assertBusinessAccess(existing.business_id)
  assertProductPrices(payload.price, payload.costPrice ?? null)
  const nature = getBusinessNature(existing.business_id)
  const kind: ProductKind = payload.kind ?? ((existing.kind as ProductKind) || 'item')
  if (!isValidProductKind(nature, kind)) {
    throw new Error(`Product kind "${kind}" is not allowed for this business type`)
  }
  const tracksStock =
    payload.tracksStock === undefined
      ? Boolean(existing.tracks_stock)
      : Boolean(payload.tracksStock)
  if (tracksStock && kind !== 'item') {
    throw new Error('Only item products can track stock')
  }
  const isActive = payload.isActive === false ? 0 : 1
  const imagePath = payload.imagePath === undefined ? existing.image_path : payload.imagePath?.trim() || null
  const stockQty = tracksStock ? (payload.stockQty ?? existing.stock_qty) : 0
  db()
    .prepare(
      `UPDATE products SET name = ?, barcode = ?, price = ?, cost_price = ?, stock_qty = ?, kind = ?, tracks_stock = ?, image_path = ?, is_active = ?
       WHERE id = ?`,
    )
    .run(
      payload.name.trim(),
      payload.barcode?.trim() || null,
      payload.price,
      payload.costPrice ?? null,
      stockQty,
      kind,
      tracksStock ? 1 : 0,
      imagePath,
      isActive,
      payload.id,
    )
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: 'product',
    entityId: payload.id,
    action: 'updated',
    summary: `Updated product ${payload.name.trim()}`,
  })
  return {
    id: payload.id,
    businessId: existing.business_id,
    branchId: existing.branch_id,
    name: payload.name.trim(),
    barcode: payload.barcode?.trim() || null,
    price: payload.price,
    costPrice: payload.costPrice ?? null,
    stockQty,
    kind,
    tracksStock,
    imagePath,
    isActive: Boolean(isActive),
  }
}

export function setProductActive(payload: { id: string; isActive: boolean }): { ok: true } {
  requireValidLicense()
  const session = requirePermission('products:edit')
  const existing = db()
    .prepare('SELECT business_id, name FROM products WHERE id = ?')
    .get(payload.id) as { business_id: string; name: string } | undefined
  if (!existing) throw new Error('Product not found')
  assertBusinessAccess(existing.business_id)
  db().prepare('UPDATE products SET is_active = ? WHERE id = ?').run(payload.isActive ? 1 : 0, payload.id)
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: 'product',
    entityId: payload.id,
    action: payload.isActive ? 'activated' : 'deactivated',
    summary: `${payload.isActive ? 'Activated' : 'Deactivated'} product ${existing.name}`,
  })
  return { ok: true }
}

export function deleteProduct(id: string): { ok: true; mode: 'deleted' | 'deactivated' } {
  requireValidLicense()
  const session = requirePermission('products:edit')
  const existing = db()
    .prepare('SELECT business_id, name, is_active FROM products WHERE id = ?')
    .get(id) as { business_id: string; name: string; is_active: number } | undefined
  if (!existing) throw new Error('Product not found')
  assertBusinessAccess(existing.business_id)

  // Soft-delete when history exists — sales/PO rows must keep product FK references.
  const inSales = db().prepare('SELECT id FROM sale_items WHERE product_id = ? LIMIT 1').get(id)
  const inPo = db().prepare('SELECT id FROM purchase_order_items WHERE product_id = ? LIMIT 1').get(id)
  if (inSales || inPo) {
    if (existing.is_active) {
      db().prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id)
      writeActivity({
        businessId: existing.business_id,
        actorUserId: session.id,
        entityType: 'product',
        entityId: id,
        action: 'deactivated',
        summary: `Deactivated product ${existing.name} (used in history)`,
      })
    }
    return { ok: true, mode: 'deactivated' }
  }

  const run = db().transaction(() => {
    db().prepare('DELETE FROM supplier_products WHERE product_id = ?').run(id)
    db().prepare('DELETE FROM products WHERE id = ?').run(id)
  })
  run()

  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: 'product',
    entityId: id,
    action: 'deleted',
    summary: `Deleted product ${existing.name}`,
  })
  return { ok: true, mode: 'deleted' }
}

export function listProductSuppliers(productId: string): ProductSupplierLink[] {
  const product = db()
    .prepare('SELECT business_id FROM products WHERE id = ?')
    .get(productId) as { business_id: string } | undefined
  if (!product) throw new Error('Product not found')
  assertBusinessAccess(product.business_id)

  const rows = db()
    .prepare(
      `SELECT sp.id as link_id, sp.supplier_id, sp.unit_cost, s.name as supplier_name
       FROM supplier_products sp
       JOIN suppliers s ON s.id = sp.supplier_id
       WHERE sp.product_id = ?
       ORDER BY s.name ASC`,
    )
    .all(productId) as Array<{
      link_id: string
      supplier_id: string
      unit_cost: number
      supplier_name: string
    }>

  return rows.map((row) => ({
    linkId: row.link_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    unitCost: row.unit_cost,
  }))
}

export function generateProductBarcode(businessId: string): { barcode: string } {
  requireValidLicense()
  requirePermission('products:edit')
  assertBusinessAccess(businessId)
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const barcode = `KB${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`
    const exists = db()
      .prepare('SELECT id FROM products WHERE business_id = ? AND barcode = ?')
      .get(businessId, barcode)
    if (!exists) return { barcode }
  }
  throw new Error('Could not generate unique barcode')
}

export function listSuppliers(businessId: string): Supplier[] {
  assertBusinessAccess(businessId)
  const rows = db()
    .prepare('SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE business_id = ? ORDER BY created_at DESC')
    .all(businessId) as Array<{
      id: string
      business_id: string
      name: string
      phone: string | null
      address: string | null
      notes: string | null
      is_active: number
    }>
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    isActive: Boolean(row.is_active),
  }))
}

export function createSupplier(payload: {
  businessId: string
  name: string
  phone?: string
  address?: string
  notes?: string
}): Supplier {
  requirePermission('suppliers:edit')
  assertBusinessAccess(payload.businessId)
  const session = requireSession()
  const id = uuidv4()
  db()
    .prepare(
      `INSERT INTO suppliers (id, business_id, name, phone, address, notes, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(id, payload.businessId, payload.name.trim(), payload.phone?.trim() || null, payload.address?.trim() || null, payload.notes?.trim() || null, nowIso())
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: 'supplier',
    entityId: id,
    action: 'created',
    summary: `Created supplier ${payload.name.trim()}`,
  })
  return {
    id,
    businessId: payload.businessId,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || null,
    address: payload.address?.trim() || null,
    notes: payload.notes?.trim() || null,
    isActive: true,
  }
}

export function updateSupplier(payload: {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  notes?: string | null
  isActive?: boolean
}): Supplier {
  const session = requirePermission('suppliers:edit')
  const existing = db()
    .prepare('SELECT business_id FROM suppliers WHERE id = ?')
    .get(payload.id) as { business_id: string } | undefined
  if (!existing) throw new Error('Supplier not found')
  assertBusinessAccess(existing.business_id)
  const isActive = payload.isActive === false ? 0 : 1
  db()
    .prepare('UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ?, is_active = ? WHERE id = ?')
    .run(
      payload.name.trim(),
      payload.phone?.trim() || null,
      payload.address?.trim() || null,
      payload.notes?.trim() || null,
      isActive,
      payload.id,
    )
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: 'supplier',
    entityId: payload.id,
    action: 'updated',
    summary: `Updated supplier ${payload.name.trim()}`,
  })
  return {
    id: payload.id,
    businessId: existing.business_id,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || null,
    address: payload.address?.trim() || null,
    notes: payload.notes?.trim() || null,
    isActive: Boolean(isActive),
  }
}

function requireSupplier(supplierId: string): { id: string; business_id: string; name: string; phone: string | null; address: string | null; notes: string | null; is_active: number } {
  const row = db()
    .prepare('SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE id = ?')
    .get(supplierId) as
    | {
      id: string
      business_id: string
      name: string
      phone: string | null
      address: string | null
      notes: string | null
      is_active: number
    }
    | undefined
  if (!row) throw new Error('Supplier not found')
  assertBusinessAccess(row.business_id)
  return row
}

export function listSupplierProducts(supplierId: string): SupplierProduct[] {
  requireSupplier(supplierId)
  const rows = db()
    .prepare(
      `SELECT sp.id as link_id, sp.supplier_id, sp.product_id, sp.unit_cost,
              p.id, p.business_id, p.branch_id, p.name, p.barcode, p.price, p.cost_price,
              p.stock_qty, p.kind, p.tracks_stock, p.image_path, p.is_active
       FROM supplier_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.supplier_id = ?
       ORDER BY p.name ASC`,
    )
    .all(supplierId) as Array<{
      link_id: string
      supplier_id: string
      product_id: string
      unit_cost: number
      id: string
      business_id: string
      branch_id: string | null
      name: string
      barcode: string | null
      price: number
      cost_price: number | null
      stock_qty: number
      kind: string
      tracks_stock: number
      image_path: string | null
      is_active: number
    }>
  return rows.map(mapSupplierProductRow)
}

export function getSupplierDetail(supplierId: string): SupplierDetail {
  const row = requireSupplier(supplierId)
  return {
    supplier: {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      isActive: Boolean(row.is_active),
    },
    products: listSupplierProducts(supplierId),
  }
}

export function linkSupplierProduct(payload: {
  supplierId: string
  productId: string
  unitCost: number
}): SupplierProduct {
  requirePermission('suppliers:edit')
  const supplier = requireSupplier(payload.supplierId)
  if (!Number.isFinite(payload.unitCost) || payload.unitCost < 0) {
    throw new Error('Unit cost must be >= 0')
  }
  const product = db()
    .prepare(
      `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock, image_path, is_active
       FROM products WHERE id = ?`,
    )
    .get(payload.productId) as
    | {
      id: string
      business_id: string
      branch_id: string | null
      name: string
      barcode: string | null
      price: number
      cost_price: number | null
      stock_qty: number
      kind: string
      tracks_stock: number
      image_path: string | null
      is_active: number
    }
    | undefined
  if (!product) throw new Error('Product not found')
  if (product.business_id !== supplier.business_id) {
    throw new Error('Product and supplier must belong to the same business')
  }
  assertBusinessAccess(product.business_id)

  const existing = db()
    .prepare('SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?')
    .get(payload.supplierId, payload.productId)
  if (existing) throw new Error('Product is already attached to this supplier')

  const linkId = uuidv4()
  db()
    .prepare(
      `INSERT INTO supplier_products (id, supplier_id, product_id, unit_cost, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(linkId, payload.supplierId, payload.productId, payload.unitCost, nowIso())

  return {
    linkId,
    supplierId: payload.supplierId,
    productId: payload.productId,
    unitCost: payload.unitCost,
    product: mapProductRow(product),
  }
}

export function unlinkSupplierProduct(payload: { supplierId: string; productId: string }): { ok: true } {
  requirePermission('suppliers:edit')
  requireSupplier(payload.supplierId)
  const result = db()
    .prepare('DELETE FROM supplier_products WHERE supplier_id = ? AND product_id = ?')
    .run(payload.supplierId, payload.productId)
  if (result.changes === 0) throw new Error('Product is not attached to this supplier')
  return { ok: true }
}

export function updateLinkedSupplierProduct(payload: {
  supplierId: string
  productId: string
  unitCost: number
}): SupplierProduct {
  requirePermission('suppliers:edit')
  requireSupplier(payload.supplierId)
  if (!Number.isFinite(payload.unitCost) || payload.unitCost < 0) {
    throw new Error('Unit cost must be >= 0')
  }
  const result = db()
    .prepare('UPDATE supplier_products SET unit_cost = ? WHERE supplier_id = ? AND product_id = ?')
    .run(payload.unitCost, payload.supplierId, payload.productId)
  if (result.changes === 0) throw new Error('Product is not attached to this supplier')

  const linked = listSupplierProducts(payload.supplierId).find((p) => p.productId === payload.productId)
  if (!linked) throw new Error('Product is not attached to this supplier')
  return linked
}

export function listPurchaseOrders(businessId: string): PurchaseOrder[] {
  assertBusinessAccess(businessId)
  const rows = db()
    .prepare(
      'SELECT id, business_id, branch_id, supplier_id, po_number, status, order_date FROM purchase_orders WHERE business_id = ? ORDER BY created_at DESC',
    )
    .all(businessId) as Array<{
      id: string
      business_id: string
      branch_id: string
      supplier_id: string
      po_number: string
      status: PurchaseOrder['status']
      order_date: string
    }>
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    supplierId: row.supplier_id,
    poNumber: row.po_number,
    status: row.status,
    orderDate: row.order_date,
  }))
}

export function createPurchaseOrder(payload: {
  businessId: string
  branchId: string
  supplierId: string
  poNumber: string
  orderDate: string
  items: Array<{ productId: string; orderedQty: number; unitCost: number }>
}): PurchaseOrder {
  requirePermission('purchaseOrders:edit')
  assertBusinessAccess(payload.businessId)
  assertBranchAccess(payload.branchId)
  const supplier = requireSupplier(payload.supplierId)
  if (supplier.business_id !== payload.businessId) {
    throw new Error('Supplier does not belong to this business')
  }
  if (!payload.items?.length) throw new Error('Add at least one product line')

  const id = uuidv4()
  const session = requireSession()
  const insertItem = db().prepare(
    `INSERT INTO purchase_order_items (id, po_id, product_id, ordered_qty, received_qty, unit_cost, line_total)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  )

  const run = db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO purchase_orders (id, business_id, branch_id, supplier_id, po_number, status, order_date, expected_date, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, ?, ?)`,
      )
      .run(
        id,
        payload.businessId,
        payload.branchId,
        payload.supplierId,
        payload.poNumber.trim(),
        payload.orderDate,
        session.id,
        nowIso(),
      )

    for (const item of payload.items) {
      if (!Number.isFinite(item.orderedQty) || item.orderedQty <= 0) {
        throw new Error('Ordered quantity must be greater than 0')
      }
      if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
        throw new Error('Unit cost must be >= 0')
      }
      const linked = db()
        .prepare('SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?')
        .get(payload.supplierId, item.productId)
      if (!linked) throw new Error('All products must be attached to the selected supplier')
      const lineTotal = item.orderedQty * item.unitCost
      insertItem.run(uuidv4(), id, item.productId, item.orderedQty, item.unitCost, lineTotal)
    }
  })
  run()

  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: 'purchase_order',
    entityId: id,
    action: 'created',
    summary: `Created PO ${payload.poNumber.trim()}`,
  })

  return {
    id,
    businessId: payload.businessId,
    branchId: payload.branchId,
    supplierId: payload.supplierId,
    poNumber: payload.poNumber.trim(),
    status: 'draft',
    orderDate: payload.orderDate,
  }
}

export function getPurchaseOrderDetail(poId: string): PurchaseOrderDetail {
  const row = db()
    .prepare(
      `SELECT po.id, po.business_id, po.branch_id, po.supplier_id, po.po_number, po.status, po.order_date,
              s.name as supplier_name, br.name as branch_name, b.name as business_name
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN branches br ON br.id = po.branch_id
       JOIN businesses b ON b.id = po.business_id
       WHERE po.id = ?`,
    )
    .get(poId) as
    | {
      id: string
      business_id: string
      branch_id: string
      supplier_id: string
      po_number: string
      status: PurchaseOrder['status']
      order_date: string
      supplier_name: string
      branch_name: string
      business_name: string
    }
    | undefined
  if (!row) throw new Error('Purchase order not found')
  assertBusinessAccess(row.business_id)

  const items = db()
    .prepare(
      `SELECT poi.id, poi.product_id, p.name as product_name, poi.ordered_qty, poi.received_qty, poi.unit_cost, poi.line_total
       FROM purchase_order_items poi
       JOIN products p ON p.id = poi.product_id
       WHERE poi.po_id = ?
       ORDER BY p.name ASC`,
    )
    .all(poId) as Array<{
      id: string
      product_id: string
      product_name: string
      ordered_qty: number
      received_qty: number
      unit_cost: number
      line_total: number
    }>

  const mappedItems = items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.product_name,
    orderedQty: item.ordered_qty,
    receivedQty: item.received_qty,
    unitCost: item.unit_cost,
    lineTotal: item.line_total,
  }))

  return {
    po: {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      supplierId: row.supplier_id,
      poNumber: row.po_number,
      status: row.status,
      orderDate: row.order_date,
    },
    supplierName: row.supplier_name,
    branchName: row.branch_name,
    businessName: row.business_name,
    items: mappedItems,
    total: mappedItems.reduce((sum, item) => sum + item.lineTotal, 0),
  }
}

export async function printPurchaseOrder(poId: string): Promise<{ ok: true }> {
  requirePermission('purchaseOrders:edit')
  const detail = getPurchaseOrderDetail(poId)
  const business = db()
    .prepare('SELECT currency, logo_path, brand_color FROM businesses WHERE id = ?')
    .get(detail.po.businessId) as {
    currency: string
    logo_path: string | null
    brand_color: string
  } | undefined

  const supplier = db()
    .prepare('SELECT phone, address FROM suppliers WHERE id = ?')
    .get(detail.po.supplierId) as { phone: string | null; address: string | null } | undefined

  const html = buildPurchaseOrderHtml({
    businessName: detail.businessName,
    currency: business?.currency || 'Rs',
    brandColor: business?.brand_color ?? null,
    logoPath: business?.logo_path ?? null,
    supplierName: detail.supplierName,
    supplierPhone: supplier?.phone ?? null,
    supplierAddress: supplier?.address ?? null,
    branchName: detail.branchName,
    poNumber: detail.po.poNumber,
    orderDate: detail.po.orderDate,
    status: detail.po.status,
    items: detail.items.map((item) => ({
      productName: item.productName,
      orderedQty: item.orderedQty,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
    })),
    total: detail.total,
  })

  return openPrintPreview({
    html,
    filePrefix: 'purchase-order',
    title: detail.po.poNumber,
    width: 780,
    height: 920,
  })
}

export function listCustomers(businessId: string): Customer[] {
  assertBusinessAccess(businessId)
  const rows = db()
    .prepare('SELECT id, business_id, name, phone, current_balance, is_active FROM customers WHERE business_id = ? ORDER BY created_at DESC')
    .all(businessId) as Array<{
      id: string
      business_id: string
      name: string
      phone: string | null
      current_balance: number
      is_active: number
    }>
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    currentBalance: row.current_balance,
    isActive: Boolean(row.is_active),
  }))
}

export function createCustomer(payload: { businessId: string; name: string; phone?: string }): Customer {
  const session = requirePermission('customers:edit')
  assertBusinessAccess(payload.businessId)
  const id = uuidv4()
  const at = nowIso()
  db()
    .prepare(
      `INSERT INTO customers (id, business_id, name, phone, address, opening_balance, current_balance, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 0, 0, 1, ?, ?)`,
    )
    .run(id, payload.businessId, payload.name.trim(), payload.phone?.trim() || null, at, at)
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: 'customer',
    entityId: id,
    action: 'created',
    summary: `Created customer ${payload.name.trim()}`,
  })
  return {
    id,
    businessId: payload.businessId,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || null,
    currentBalance: 0,
    isActive: true,
  }
}

export function updateCustomer(payload: {
  id: string
  name: string
  phone?: string | null
  isActive?: boolean
}): Customer {
  const session = requirePermission('customers:edit')
  const existing = db()
    .prepare('SELECT business_id, current_balance FROM customers WHERE id = ?')
    .get(payload.id) as { business_id: string; current_balance: number } | undefined
  if (!existing) throw new Error('Customer not found')
  assertBusinessAccess(existing.business_id)
  const isActive = payload.isActive === false ? 0 : 1
  db()
    .prepare('UPDATE customers SET name = ?, phone = ?, is_active = ? WHERE id = ?')
    .run(payload.name.trim(), payload.phone?.trim() || null, isActive, payload.id)
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: 'customer',
    entityId: payload.id,
    action: 'updated',
    summary: `Updated customer ${payload.name.trim()}`,
  })
  return {
    id: payload.id,
    businessId: existing.business_id,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || null,
    currentBalance: existing.current_balance,
    isActive: Boolean(isActive),
  }
}

export function getCustomerDetail(customerId: string): CustomerDetail {
  requireSession()
  const row = db()
    .prepare('SELECT id, business_id, name, phone, current_balance, is_active FROM customers WHERE id = ?')
    .get(customerId) as
    | {
      id: string
      business_id: string
      name: string
      phone: string | null
      current_balance: number
      is_active: number
    }
    | undefined
  if (!row) throw new Error('Customer not found')
  assertBusinessAccess(row.business_id)

  const sales = db()
    .prepare(
      `SELECT id, invoice_no, total, status, created_at
       FROM sales WHERE customer_id = ? ORDER BY created_at DESC`,
    )
    .all(customerId) as Array<{
      id: string
      invoice_no: string
      total: number
      status: 'completed' | 'void' | 'refunded' | 'partially_refunded'
      created_at: string
    }>

  const paymentStmt = db().prepare('SELECT method FROM payments WHERE sale_id = ?')

  const ledgerRows = db()
    .prepare(
      `SELECT l.id, l.customer_id, l.business_id, l.branch_id, l.type, l.amount, l.balance_after,
              l.reference_sale_id, l.note, l.created_by, l.created_at, u.name as created_by_name
       FROM ledger_entries l
       LEFT JOIN users u ON u.id = l.created_by
       WHERE l.customer_id = ?
       ORDER BY l.created_at DESC, l.id DESC`,
    )
    .all(customerId) as Array<{
    id: string
    customer_id: string
    business_id: string
    branch_id: string | null
    type: 'sale' | 'payment' | 'adjustment' | 'opening'
    amount: number
    balance_after: number
    reference_sale_id: string | null
    note: string | null
    created_by: string
    created_at: string
    created_by_name: string | null
  }>

  return {
    customer: {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      phone: row.phone,
      currentBalance: row.current_balance,
      isActive: Boolean(row.is_active),
    },
    remainingBalance: row.current_balance,
    sales: sales.map((sale) => {
      const methods = paymentStmt.all(sale.id) as Array<{ method: 'cash' | 'card' | 'credit' }>
      return {
        id: sale.id,
        invoiceNo: sale.invoice_no,
        total: sale.total,
        status: sale.status,
        createdAt: sale.created_at,
        paymentMethods: [...new Set(methods.map((m) => m.method))],
      }
    }),
    ledger: ledgerRows.map((entry) => {
      let method: 'cash' | 'card' | null = null
      if (entry.type === 'payment' && entry.note) {
        const match = entry.note.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i)
        if (match) method = match[1].toLowerCase() as 'cash' | 'card'
      }
      return {
        id: entry.id,
        customerId: entry.customer_id,
        businessId: entry.business_id,
        branchId: entry.branch_id,
        type: entry.type,
        amount: entry.amount,
        balanceAfter: entry.balance_after,
        referenceSaleId: entry.reference_sale_id,
        note: entry.note,
        createdBy: entry.created_by,
        createdByName: entry.created_by_name,
        createdAt: entry.created_at,
        method,
      }
    }),
  }
}

function entryDateYmd(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function printCustomerLedger(payload: {
  customerId: string
  from?: string | null
  to?: string | null
}): Promise<{ ok: true }> {
  requireValidLicense()
  requirePermission('sales:print')
  const detail = getCustomerDetail(payload.customerId)
  const business = db()
    .prepare('SELECT name, currency, logo_path, brand_color FROM businesses WHERE id = ?')
    .get(detail.customer.businessId) as
    | { name: string; currency: string; logo_path: string | null; brand_color: string }
    | undefined
  if (!business) throw new Error('Business not found')

  const from = payload.from?.trim() || null
  const to = payload.to?.trim() || null
  if (from && to && from > to) throw new Error('Invalid date range')

  const asc = [...detail.ledger].sort((a, b) => {
    const byDate = a.createdAt.localeCompare(b.createdAt)
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
  })

  const filtered = asc.filter((entry) => {
    const ymd = entryDateYmd(entry.createdAt)
    if (from && ymd < from) return false
    if (to && ymd > to) return false
    return true
  })

  let openingBalance = 0
  if (from) {
    const before = asc.filter((entry) => entryDateYmd(entry.createdAt) < from)
    if (before.length > 0) openingBalance = before[before.length - 1].balanceAfter
  }

  const invoiceBySaleId = new Map(
    detail.sales.map((sale) => [sale.id, sale.invoiceNo] as const),
  )

  const html = buildCustomerLedgerHtml({
    businessName: business.name,
    currency: business.currency || 'Rs',
    brandColor: business.brand_color,
    logoPath: business.logo_path,
    customerName: detail.customer.name,
    customerPhone: detail.customer.phone,
    from,
    to,
    openingBalance,
    entries: filtered.map((entry) => ({
      createdAt: entry.createdAt,
      type: entry.type,
      amount: entry.amount,
      balanceAfter: entry.balanceAfter,
      note: entry.note,
      method: entry.method,
      invoiceNo: entry.referenceSaleId
        ? invoiceBySaleId.get(entry.referenceSaleId) ?? null
        : null,
    })),
  })

  return openPrintPreview({
    html,
    filePrefix: 'customer-ledger',
    title: detail.customer.name,
    width: 900,
    height: 960,
  })
}

export function recordCustomerPayment(payload: {
  customerId: string
  amount: number
  method: 'cash' | 'card'
  note?: string | null
  branchId?: string | null
}): LedgerEntry {
  const session = requirePermission('customers:edit')
  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than 0')
  if (payload.method !== 'cash' && payload.method !== 'card') {
    throw new Error('Payment method must be cash or card')
  }

  const customer = db()
    .prepare('SELECT id, business_id, name, current_balance FROM customers WHERE id = ?')
    .get(payload.customerId) as
    | { id: string; business_id: string; name: string; current_balance: number }
    | undefined
  if (!customer) throw new Error('Customer not found')
  assertBusinessAccess(customer.business_id)

  if (amount > customer.current_balance) {
    throw new Error('Payment cannot exceed remaining credit balance')
  }

  let branchId = payload.branchId?.trim() || null
  if (branchId) {
    assertBranchAccess(branchId)
  } else if (session.branchId) {
    branchId = session.branchId
  }

  const id = uuidv4()
  const at = nowIso()
  const newBalance = customer.current_balance - amount
  const userNote = payload.note?.trim() || ''
  const note = userNote ? `method:${payload.method} | ${userNote}` : `method:${payload.method}`

  db().transaction(() => {
    db().prepare('UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?').run(
      newBalance,
      at,
      customer.id,
    )
    db()
      .prepare(
        `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
         VALUES (?, ?, ?, ?, 'payment', ?, ?, NULL, ?, ?, ?)`,
      )
      .run(id, customer.id, customer.business_id, branchId, -amount, newBalance, note, session.id, at)
  })()

  writeActivity({
    businessId: customer.business_id,
    actorUserId: session.id,
    entityType: 'customer',
    entityId: customer.id,
    action: 'payment_recorded',
    summary: `Recorded ${payload.method} payment of ${amount} for ${customer.name}`,
  })

  return {
    id,
    customerId: customer.id,
    businessId: customer.business_id,
    branchId,
    type: 'payment',
    amount: -amount,
    balanceAfter: newBalance,
    referenceSaleId: null,
    note,
    createdBy: session.id,
    createdByName: session.name,
    createdAt: at,
    method: payload.method,
  }
}

function nextInvoiceNumber(businessId: string, branchId: string): string {
  const business = db()
    .prepare('SELECT name FROM businesses WHERE id = ?')
    .get(businessId) as { name: string } | undefined
  const branch = db()
    .prepare('SELECT name FROM branches WHERE id = ?')
    .get(branchId) as { name: string } | undefined
  if (!business || !branch) throw new Error('Business or branch not found')

  const prefix = invoicePrefix(business.name, branch.name)
  const rows = db()
    .prepare('SELECT invoice_no FROM sales WHERE business_id = ? AND invoice_no LIKE ?')
    .all(businessId, `${prefix}%`) as Array<{ invoice_no: string }>

  let max = 0
  for (const row of rows) {
    const seq = parseInvoiceSequence(row.invoice_no, prefix)
    if (seq != null && seq > max) max = seq
  }
  return formatInvoiceNumber(business.name, branch.name, max + 1)
}

export function createSale(payload: {
  businessId: string
  branchId: string
  customerId: string | null
  items: Array<{ productId: string; qty: number; unitPrice: number }>
  discount?: number
  payments: Array<{ method: 'cash' | 'card' | 'credit'; amount: number }>
  servedByUserId?: string | null
  serviceMode?: ServiceMode | null
  tableId?: string | null
  ticketId?: string | null
}): Sale {
  requireValidLicense()
  requirePermission('sales:checkout')
  assertBusinessAccess(payload.businessId)
  assertBranchAccess(payload.branchId)
  const session = requireSession()
  if (!payload.items.length) throw new Error('Add at least one item to the sale')

  const nature = getBusinessNature(payload.businessId)
  let servedByUserId: string | null = payload.servedByUserId?.trim() || null
  let serviceMode: ServiceMode | null = payload.serviceMode ?? null
  let tableId: string | null = payload.tableId?.trim() || null
  const ticketId = payload.ticketId?.trim() || null

  if (showsServedBy(nature)) {
    if (!servedByUserId) throw new Error('Served by staff is required')
    const staff = db()
      .prepare(
        `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`,
      )
      .get(servedByUserId, payload.businessId, payload.businessId) as { id: string } | undefined
    if (!staff) throw new Error('Selected staff member was not found')
  } else if (servedByUserId) {
    throw new Error('Served by is not used for this business type')
  }

  if (showsServiceMode(nature)) {
    if (!serviceMode || !['dine_in', 'takeaway', 'delivery'].includes(serviceMode)) {
      throw new Error('Service mode is required')
    }
    if (serviceMode === 'dine_in') {
      if (!tableId) throw new Error('Table is required for dine-in')
      const table = db()
        .prepare('SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1')
        .get(tableId, payload.businessId) as { id: string } | undefined
      if (!table) throw new Error('Table not found')
    } else {
      tableId = null
    }
  } else {
    if (serviceMode || tableId) {
      throw new Error('Tables and service modes are not used for this business type')
    }
    serviceMode = null
    tableId = null
  }

  if (ticketId) {
    if (!showsTables(nature)) throw new Error('Tickets are only available for food businesses')
    const ticket = db()
      .prepare(
        `SELECT id, status, table_id, service_mode FROM pos_tickets
         WHERE id = ? AND business_id = ?`,
      )
      .get(ticketId, payload.businessId) as
      | { id: string; status: string; table_id: string | null; service_mode: ServiceMode }
      | undefined
    if (!ticket) throw new Error('Ticket not found')
    if (ticket.status !== 'open') throw new Error('Ticket is no longer open')
    serviceMode = ticket.service_mode
    tableId = ticket.table_id
  }

  const id = uuidv4()
  const at = nowIso()
  const invoiceNo = nextInvoiceNumber(payload.businessId, payload.branchId)
  const subtotal = payload.items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0)
  const discount = Math.max(0, Number(payload.discount ?? 0))
  if (!Number.isFinite(discount)) throw new Error('Discount must be a valid number')
  if (discount > subtotal) throw new Error('Discount cannot exceed subtotal')
  const total = subtotal - discount
  const amountPaid = payload.payments.reduce((acc, p) => acc + p.amount, 0)

  db().transaction(() => {
    for (const item of payload.items) {
      if (!Number.isFinite(item.qty) || item.qty <= 0) throw new Error('Item quantity must be greater than 0')
      const product = db()
        .prepare(
          `SELECT id, name, stock_qty, tracks_stock, is_active FROM products WHERE id = ? AND business_id = ?`,
        )
        .get(item.productId, payload.businessId) as
        | { id: string; name: string; stock_qty: number; tracks_stock: number; is_active: number }
        | undefined
      if (!product || !product.is_active) throw new Error('Product not found or inactive')
      if (product.tracks_stock && item.qty > product.stock_qty) {
        throw new Error(`Insufficient stock for ${product.name}`)
      }
    }

    db()
      .prepare(
        `INSERT INTO sales (
           id, business_id, branch_id, invoice_no, customer_id, cashier_id,
           subtotal, discount, tax, total, amount_paid, change_due, status,
           served_by_user_id, service_mode, table_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'completed', ?, ?, ?, ?)`,
      )
      .run(
        id,
        payload.businessId,
        payload.branchId,
        invoiceNo,
        payload.customerId,
        session.id,
        subtotal,
        discount,
        total,
        amountPaid,
        servedByUserId,
        serviceMode,
        tableId,
        at,
      )

    const insertSaleItem = db().prepare(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, qty, unit_price, discount, line_total, refunded_qty)
       SELECT ?, ?, p.id, p.name, ?, ?, 0, ?, 0
       FROM products p WHERE p.id = ?`,
    )
    const updateStock = db().prepare(
      'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND tracks_stock = 1',
    )
    for (const item of payload.items) {
      insertSaleItem.run(uuidv4(), id, item.qty, item.unitPrice, item.qty * item.unitPrice, item.productId)
      updateStock.run(item.qty, item.productId)
    }

    const insertPayment = db().prepare('INSERT INTO payments (id, sale_id, method, amount, created_at) VALUES (?, ?, ?, ?, ?)')
    for (const payment of payload.payments) {
      insertPayment.run(uuidv4(), id, payment.method, payment.amount, at)
    }

    const creditAmount = payload.payments.filter((p) => p.method === 'credit').reduce((acc, p) => acc + p.amount, 0)
    if (payload.customerId && creditAmount > 0) {
      const customer = db().prepare('SELECT current_balance FROM customers WHERE id = ?').get(payload.customerId) as { current_balance: number }
      const newBalance = customer.current_balance + creditAmount
      db().prepare('UPDATE customers SET current_balance = ? WHERE id = ?').run(newBalance, payload.customerId)
      db()
        .prepare(
          `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
           VALUES (?, ?, ?, ?, 'sale', ?, ?, ?, 'Sale on credit', ?, ?)`,
        )
        .run(uuidv4(), payload.customerId, payload.businessId, payload.branchId, creditAmount, newBalance, id, session.id, at)
    }

    if (ticketId) {
      db()
        .prepare(`UPDATE pos_tickets SET status = 'billed', updated_at = ? WHERE id = ? AND status = 'open'`)
        .run(at, ticketId)
    }
  })()

  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: 'sale',
    entityId: id,
    action: 'created',
    summary: `Sale ${invoiceNo} completed`,
    payload: { total, itemCount: payload.items.length },
  })

  return {
    id,
    businessId: payload.businessId,
    branchId: payload.branchId,
    invoiceNo,
    customerId: payload.customerId,
    cashierId: session.id,
    subtotal,
    discount,
    total,
    amountPaid,
    status: 'completed',
    createdAt: at,
    servedByUserId,
    servedByName: null,
    serviceMode,
    tableId,
    tableName: null,
  }
}

export function listSales(businessId: string): Sale[] {
  requireValidLicense()
  assertBusinessAccess(businessId)
  const rows = db()
    .prepare(
      `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.business_id = ?
       ORDER BY s.created_at DESC`,
    )
    .all(businessId) as Array<{
      id: string
      business_id: string
      branch_id: string
      invoice_no: string
      customer_id: string | null
      cashier_id: string
      subtotal: number
      discount: number
      total: number
      amount_paid: number
      status: Sale['status']
      created_at: string
      served_by_user_id: string | null
      served_by_name: string | null
      service_mode: ServiceMode | null
      table_id: string | null
      table_name: string | null
    }>
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    invoiceNo: row.invoice_no,
    customerId: row.customer_id,
    cashierId: row.cashier_id,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    amountPaid: row.amount_paid,
    status: row.status,
    createdAt: row.created_at,
    servedByUserId: row.served_by_user_id,
    servedByName: row.served_by_name,
    serviceMode: row.service_mode,
    tableId: row.table_id,
    tableName: row.table_name,
  }))
}

export function voidRefundSale(payload: { saleId: string; reason: string }): { ok: true } {
  // Legacy entry: create + auto-approve a full-sale refund request for approvers.
  requireValidLicense()
  requirePermission('sales:refund_approve')
  const items = db()
    .prepare('SELECT id, qty, refunded_qty FROM sale_items WHERE sale_id = ?')
    .all(payload.saleId) as Array<{ id: string; qty: number; refunded_qty: number }>
  const request = createRefundRequest({
    saleId: payload.saleId,
    reason: payload.reason,
    items: items
      .map((item) => ({ saleItemId: item.id, qty: item.qty - (item.refunded_qty || 0) }))
      .filter((item) => item.qty > 0),
  })
  reviewRefundRequest({ id: request.id, decision: 'approve', note: payload.reason })
  return { ok: true }
}

function loadRefundRequest(id: string): RefundRequest {
  const row = db()
    .prepare(
      `SELECT r.id, r.sale_id, r.business_id, r.requested_by, ru.name as requested_by_name, r.reason, r.status,
              r.reviewed_by, rv.name as reviewed_by_name, r.reviewed_at, r.review_note, r.created_at
       FROM refund_requests r
       JOIN users ru ON ru.id = r.requested_by
       LEFT JOIN users rv ON rv.id = r.reviewed_by
       WHERE r.id = ?`,
    )
    .get(id) as
    | {
      id: string
      sale_id: string
      business_id: string
      requested_by: string
      requested_by_name: string
      reason: string
      status: RefundRequest['status']
      reviewed_by: string | null
      reviewed_by_name: string | null
      reviewed_at: string | null
      review_note: string | null
      created_at: string
    }
    | undefined
  if (!row) throw new Error('Refund request not found')
  const items = db()
    .prepare(
      `SELECT i.id, i.sale_item_id, i.product_id, COALESCE(si.product_name_snapshot, p.name) as product_name, i.qty
       FROM refund_request_items i
       LEFT JOIN sale_items si ON si.id = i.sale_item_id
       LEFT JOIN products p ON p.id = i.product_id
       WHERE i.refund_request_id = ?`,
    )
    .all(id) as Array<{
      id: string
      sale_item_id: string
      product_id: string
      product_name: string
      qty: number
    }>
  return {
    id: row.id,
    saleId: row.sale_id,
    businessId: row.business_id,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    items: items.map((item) => ({
      id: item.id,
      saleItemId: item.sale_item_id,
      productId: item.product_id,
      productName: item.product_name,
      qty: item.qty,
    })),
  }
}

export function createRefundRequest(payload: {
  saleId: string
  reason: string
  items: Array<{ saleItemId: string; qty: number }>
}): RefundRequest {
  requireValidLicense()
  const session = requirePermission('sales:refund_request')
  if (!payload.reason.trim()) throw new Error('Refund reason is required')
  if (!payload.items.length) throw new Error('Select at least one item to refund')

  const sale = db()
    .prepare('SELECT id, business_id, status FROM sales WHERE id = ?')
    .get(payload.saleId) as { id: string; business_id: string; status: Sale['status'] } | undefined
  if (!sale) throw new Error('Sale not found')
  assertBusinessAccess(sale.business_id)
  if (sale.status === 'void' || sale.status === 'refunded') {
    throw new Error('Sale cannot be refunded')
  }

  const pending = db()
    .prepare("SELECT id FROM refund_requests WHERE sale_id = ? AND status = 'pending'")
    .get(payload.saleId)
  if (pending) throw new Error('A pending refund request already exists for this sale')

  const requestId = uuidv4()
  const at = nowIso()

  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO refund_requests (id, sale_id, business_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)`,
      )
      .run(requestId, payload.saleId, sale.business_id, session.id, payload.reason.trim(), at)

    const insertItem = db().prepare(
      `INSERT INTO refund_request_items (id, refund_request_id, sale_item_id, product_id, qty)
       VALUES (?, ?, ?, ?, ?)`,
    )

    for (const item of payload.items) {
      if (item.qty <= 0) throw new Error('Refund qty must be positive')
      const saleItem = db()
        .prepare('SELECT id, product_id, qty, refunded_qty FROM sale_items WHERE id = ? AND sale_id = ?')
        .get(item.saleItemId, payload.saleId) as
        | { id: string; product_id: string; qty: number; refunded_qty: number }
        | undefined
      if (!saleItem) throw new Error('Sale item not found')
      const remaining = saleItem.qty - (saleItem.refunded_qty || 0)
      if (item.qty > remaining) throw new Error('Refund qty exceeds remaining quantity')
      insertItem.run(uuidv4(), requestId, saleItem.id, saleItem.product_id, item.qty)
    }

    writeActivity({
      businessId: sale.business_id,
      actorUserId: session.id,
      entityType: 'sale',
      entityId: payload.saleId,
      action: 'refund_requested',
      summary: `Refund requested: ${payload.reason.trim()}`,
      payload: { requestId, items: payload.items },
    })
  })()

  return loadRefundRequest(requestId)
}

export function reviewRefundRequest(payload: {
  id: string
  decision: 'approve' | 'reject'
  note?: string
}): RefundRequest {
  requireValidLicense()
  const session = requirePermission('sales:refund_approve')
  const request = db()
    .prepare('SELECT id, sale_id, business_id, status, reason FROM refund_requests WHERE id = ?')
    .get(payload.id) as
    | { id: string; sale_id: string; business_id: string; status: string; reason: string }
    | undefined
  if (!request) throw new Error('Refund request not found')
  assertBusinessAccess(request.business_id)
  if (request.status !== 'pending') throw new Error('Refund request already reviewed')

  const at = nowIso()

  if (payload.decision === 'reject') {
    db()
      .prepare(
        `UPDATE refund_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?`,
      )
      .run(session.id, at, payload.note?.trim() || null, payload.id)
    writeActivity({
      businessId: request.business_id,
      actorUserId: session.id,
      entityType: 'sale',
      entityId: request.sale_id,
      action: 'refund_rejected',
      summary: `Refund rejected${payload.note ? `: ${payload.note}` : ''}`,
      payload: { requestId: payload.id },
    })
    return loadRefundRequest(payload.id)
  }

  const sale = db()
    .prepare('SELECT id, customer_id, status, total FROM sales WHERE id = ?')
    .get(request.sale_id) as
    | { id: string; customer_id: string | null; status: Sale['status']; total: number }
    | undefined
  if (!sale) throw new Error('Sale not found')

  const items = db()
    .prepare('SELECT sale_item_id, product_id, qty FROM refund_request_items WHERE refund_request_id = ?')
    .all(payload.id) as Array<{ sale_item_id: string; product_id: string; qty: number }>

  db().transaction(() => {
    const restock = db().prepare(
      'UPDATE products SET stock_qty = stock_qty + ? WHERE id = ? AND tracks_stock = 1',
    )
    const bumpRefunded = db().prepare(
      'UPDATE sale_items SET refunded_qty = refunded_qty + ? WHERE id = ?',
    )
    let refundAmount = 0

    for (const item of items) {
      const saleItem = db()
        .prepare('SELECT qty, refunded_qty, unit_price FROM sale_items WHERE id = ?')
        .get(item.sale_item_id) as { qty: number; refunded_qty: number; unit_price: number }
      const remaining = saleItem.qty - (saleItem.refunded_qty || 0)
      if (item.qty > remaining) throw new Error('Refund qty no longer available')
      bumpRefunded.run(item.qty, item.sale_item_id)
      restock.run(item.qty, item.product_id)
      refundAmount += item.qty * saleItem.unit_price
    }

    const allItems = db()
      .prepare('SELECT qty, refunded_qty FROM sale_items WHERE sale_id = ?')
      .all(request.sale_id) as Array<{ qty: number; refunded_qty: number }>
    const fullyRefunded = allItems.every((row) => row.refunded_qty >= row.qty)
    const newStatus = fullyRefunded ? 'refunded' : 'partially_refunded'
    db().prepare('UPDATE sales SET status = ? WHERE id = ?').run(newStatus, request.sale_id)

    if (sale.customer_id && refundAmount > 0) {
      const creditPaid = db()
        .prepare("SELECT SUM(amount) as total FROM payments WHERE sale_id = ? AND method = 'credit'")
        .get(request.sale_id) as { total: number | null }
      const creditTotal = creditPaid.total ?? 0
      if (creditTotal > 0) {
        const reverseAmount = Math.min(refundAmount, creditTotal)
        const customer = db()
          .prepare('SELECT current_balance FROM customers WHERE id = ?')
          .get(sale.customer_id) as { current_balance: number }
        const newBalance = customer.current_balance - reverseAmount
        db().prepare('UPDATE customers SET current_balance = ? WHERE id = ?').run(newBalance, sale.customer_id)
        db()
          .prepare(
            `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
             VALUES (?, ?, ?, NULL, 'adjustment', ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            uuidv4(),
            sale.customer_id,
            request.business_id,
            -reverseAmount,
            newBalance,
            request.sale_id,
            `Refund approved: ${request.reason}`,
            session.id,
            at,
          )
      }
    }

    db()
      .prepare(
        `UPDATE refund_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?`,
      )
      .run(session.id, at, payload.note?.trim() || null, payload.id)

    writeActivity({
      businessId: request.business_id,
      actorUserId: session.id,
      entityType: 'sale',
      entityId: request.sale_id,
      action: 'refund_approved',
      summary: `Refund approved (${newStatus})`,
      payload: { requestId: payload.id, refundAmount, items },
    })
  })()

  return loadRefundRequest(payload.id)
}

export function getSaleDetail(saleId: string): SaleDetail {
  requireValidLicense()
  requireSession()
  const saleRow = db()
    .prepare(
      `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.id = ?`,
    )
    .get(saleId) as
    | {
      id: string
      business_id: string
      branch_id: string
      invoice_no: string
      customer_id: string | null
      cashier_id: string
      subtotal: number
      discount: number
      total: number
      amount_paid: number
      status: Sale['status']
      created_at: string
      served_by_user_id: string | null
      served_by_name: string | null
      service_mode: ServiceMode | null
      table_id: string | null
      table_name: string | null
    }
    | undefined
  if (!saleRow) throw new Error('Sale not found')
  assertBusinessAccess(saleRow.business_id)

  const itemRows = db()
    .prepare(
      `SELECT id, sale_id, product_id, product_name_snapshot, qty, unit_price, line_total, refunded_qty
       FROM sale_items WHERE sale_id = ?`,
    )
    .all(saleId) as Array<{
      id: string
      sale_id: string
      product_id: string
      product_name_snapshot: string
      qty: number
      unit_price: number
      line_total: number
      refunded_qty: number
    }>

  const paymentRows = db()
    .prepare('SELECT id, method, amount, created_at FROM payments WHERE sale_id = ?')
    .all(saleId) as Array<{ id: string; method: 'cash' | 'card' | 'credit'; amount: number; created_at: string }>

  const requestIds = db()
    .prepare('SELECT id FROM refund_requests WHERE sale_id = ? ORDER BY created_at DESC')
    .all(saleId) as Array<{ id: string }>

  return {
    sale: {
      id: saleRow.id,
      businessId: saleRow.business_id,
      branchId: saleRow.branch_id,
      invoiceNo: saleRow.invoice_no,
      customerId: saleRow.customer_id,
      cashierId: saleRow.cashier_id,
      subtotal: saleRow.subtotal,
      discount: saleRow.discount,
      total: saleRow.total,
      amountPaid: saleRow.amount_paid,
      status: saleRow.status,
      createdAt: saleRow.created_at,
      servedByUserId: saleRow.served_by_user_id,
      servedByName: saleRow.served_by_name,
      serviceMode: saleRow.service_mode,
      tableId: saleRow.table_id,
      tableName: saleRow.table_name,
    },
    items: itemRows.map(
      (row): SaleItem => ({
        id: row.id,
        saleId: row.sale_id,
        productId: row.product_id,
        productName: row.product_name_snapshot,
        qty: row.qty,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
        refundedQty: row.refunded_qty || 0,
        refundableQty: row.qty - (row.refunded_qty || 0),
      }),
    ),
    payments: paymentRows.map((row) => ({
      id: row.id,
      method: row.method,
      amount: row.amount,
      createdAt: row.created_at,
    })),
    refundRequests: requestIds.map((row) => loadRefundRequest(row.id)),
    activity: listActivity('sale', saleId),
  }
}

export function findSaleByInvoice(businessId: string, invoiceNo: string): Sale | null {
  requireValidLicense()
  assertBusinessAccess(businessId)
  const code = invoiceNo.trim()
  if (!code) return null
  const row = db()
    .prepare(
      `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.business_id = ? AND s.invoice_no = ?
       LIMIT 1`,
    )
    .get(businessId, code) as
    | {
        id: string
        business_id: string
        branch_id: string
        invoice_no: string
        customer_id: string | null
        cashier_id: string
        subtotal: number
        discount: number
        total: number
        amount_paid: number
        status: Sale['status']
        created_at: string
        served_by_user_id: string | null
        served_by_name: string | null
        service_mode: ServiceMode | null
        table_id: string | null
        table_name: string | null
      }
    | undefined
  if (!row) return null
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    invoiceNo: row.invoice_no,
    customerId: row.customer_id,
    cashierId: row.cashier_id,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    amountPaid: row.amount_paid,
    status: row.status,
    createdAt: row.created_at,
    servedByUserId: row.served_by_user_id,
    servedByName: row.served_by_name,
    serviceMode: row.service_mode,
    tableId: row.table_id,
    tableName: row.table_name,
  }
}

export async function printSaleReceipt(saleId: string): Promise<{ ok: true }> {
  requireValidLicense()
  requirePermission('sales:print')
  const session = requireSession()
  const sale = db()
    .prepare(
      `SELECT s.invoice_no, s.subtotal, s.discount, s.total, s.amount_paid, s.created_at, s.business_id, s.customer_id,
              b.name as business_name, b.currency, b.logo_path, b.brand_color,
              b.social_whatsapp, b.social_instagram, b.social_facebook, b.social_tiktok, b.social_website,
              b.receipt_header, b.receipt_footer,
              c.name as customer_name,
              cashier.name as cashier_name
       FROM sales s
       JOIN businesses b ON b.id = s.business_id
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users cashier ON cashier.id = s.cashier_id
       WHERE s.id = ?`,
    )
    .get(saleId) as
    | {
      invoice_no: string
      subtotal: number
      discount: number
      total: number
      amount_paid: number
      created_at: string
      business_id: string
      customer_id: string | null
      business_name: string
      currency: string
      logo_path: string | null
      brand_color: string
      social_whatsapp: string | null
      social_instagram: string | null
      social_facebook: string | null
      social_tiktok: string | null
      social_website: string | null
      receipt_header: string | null
      receipt_footer: string | null
      customer_name: string | null
      cashier_name: string | null
    }
    | undefined
  if (!sale) throw new Error('Sale not found')
  assertBusinessAccess(sale.business_id)

  const mainBranch = db()
    .prepare(
      `SELECT address, phone FROM branches
       WHERE business_id = ? AND is_main_branch = 1
       ORDER BY created_at ASC LIMIT 1`,
    )
    .get(sale.business_id) as { address: string | null; phone: string | null } | undefined

  const branchFallback = db()
    .prepare(
      `SELECT address, phone FROM branches WHERE business_id = ? ORDER BY created_at ASC LIMIT 1`,
    )
    .get(sale.business_id) as { address: string | null; phone: string | null } | undefined

  const branch = mainBranch ?? branchFallback

  const items = db()
    .prepare(
      `SELECT product_name_snapshot as product_name, qty, unit_price, line_total FROM sale_items WHERE sale_id = ? ORDER BY id`,
    )
    .all(saleId) as Array<{
      product_name: string
      qty: number
      unit_price: number
      line_total: number
    }>

  const payments = db()
    .prepare(`SELECT method, amount FROM payments WHERE sale_id = ?`)
    .all(saleId) as Array<{ method: string; amount: number }>

  let jsBarcodeScript = ''
  try {
    const barcodePath = require.resolve('jsbarcode/dist/JsBarcode.all.min.js')
    jsBarcodeScript = fs.readFileSync(barcodePath, 'utf8')
  } catch {
    jsBarcodeScript = ''
  }

  const html = await buildSaleReceiptHtml({
    invoiceNo: sale.invoice_no,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    amountPaid: sale.amount_paid,
    createdAt: sale.created_at,
    businessName: sale.business_name,
    currency: sale.currency,
    brandColor: sale.brand_color,
    logoPath: sale.logo_path,
    customerName: sale.customer_name,
    cashierName: sale.cashier_name,
    printedByName: session.name,
    receiptHeader: sale.receipt_header,
    receiptFooter: sale.receipt_footer,
    branchAddress: branch?.address ?? null,
    branchPhone: branch?.phone ?? null,
    socialWhatsapp: sale.social_whatsapp,
    socialInstagram: sale.social_instagram,
    socialFacebook: sale.social_facebook,
    socialTiktok: sale.social_tiktok,
    socialWebsite: sale.social_website,
    items: items.map((item) => ({
      productName: item.product_name,
      qty: item.qty,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
    payments,
    jsBarcodeScript,
  })

  return openPrintPreview({
    html,
    filePrefix: 'sale-receipt',
    title: sale.invoice_no,
    width: 420,
    height: 760,
  })
}

function normalizeAnalyticsDays(days: unknown): 7 | 30 | 90 {
  const n = typeof days === 'string' ? Number(days) : days
  if (n === 7 || n === 30 || n === 90) return n
  return 30
}

/** UTC calendar YMD — matches SQLite `date(created_at)` for ISO timestamps. */
function utcYmd(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MAX_ANALYTICS_DAYS = 366

function parseUtcYmd(value: string | undefined | null): Date | null {
  if (!value || !YMD_RE.test(value)) return null
  const [, ys, ms, ds] = value.match(YMD_RE)!
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (utcYmd(date) !== value) return null
  return date
}

function resolveAnalyticsWindow(payload: {
  days?: unknown
  from?: unknown
  to?: unknown
}): { from: string; to: string; days: number; sinceIso: string } {
  const fromRaw = typeof payload.from === 'string' ? payload.from.trim() : ''
  const toRaw = typeof payload.to === 'string' ? payload.to.trim() : ''
  const hasCustom = Boolean(fromRaw || toRaw)

  if (hasCustom) {
    let fromDate = parseUtcYmd(fromRaw)
    let toDate = parseUtcYmd(toRaw)
    if (!fromDate && !toDate) {
      throw new Error('Invalid analytics date range')
    }
    if (!toDate) toDate = startOfUtcDay()
    if (!fromDate) fromDate = new Date(toDate.getTime())
    if (fromDate.getTime() > toDate.getTime()) {
      const swap = fromDate
      fromDate = toDate
      toDate = swap
    }
    const dayMs = 24 * 60 * 60 * 1000
    let days = Math.floor((toDate.getTime() - fromDate.getTime()) / dayMs) + 1
    if (days > MAX_ANALYTICS_DAYS) {
      fromDate = new Date(toDate.getTime())
      fromDate.setUTCDate(fromDate.getUTCDate() - (MAX_ANALYTICS_DAYS - 1))
      days = MAX_ANALYTICS_DAYS
    }
    return {
      from: utcYmd(fromDate),
      to: utcYmd(toDate),
      days,
      sinceIso: fromDate.toISOString(),
    }
  }

  const days = normalizeAnalyticsDays(payload.days)
  const toDate = startOfUtcDay()
  const fromDate = new Date(toDate.getTime())
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1))
  return {
    from: utcYmd(fromDate),
    to: utcYmd(toDate),
    days,
    sinceIso: fromDate.toISOString(),
  }
}

export function getAnalyticsSummary(payload: {
  businessId: string
  days?: 7 | 30 | 90 | number | string
  from?: string
  to?: string
}): AnalyticsSummary {
  const businessId =
    typeof payload === 'object' && payload && 'businessId' in payload
      ? String((payload as { businessId: string }).businessId)
      : ''
  const window = resolveAnalyticsWindow(
    typeof payload === 'object' && payload
      ? {
          days: (payload as { days?: unknown }).days,
          from: (payload as { from?: unknown }).from,
          to: (payload as { to?: unknown }).to,
        }
      : {},
  )

  requirePermission('business:view')
  assertBusinessAccess(businessId)

  const { from, to, days, sinceIso } = window
  // Inclusive end-of-day bound for custom `to` (presets already end at "today")
  const untilExclusive = parseUtcYmd(to)!
  untilExclusive.setUTCDate(untilExclusive.getUTCDate() + 1)
  const untilIso = untilExclusive.toISOString()

  const salesRows = db()
    .prepare(
      `SELECT date(created_at) as day, SUM(total) as total, COUNT(*) as count
       FROM sales
       WHERE business_id = ? AND created_at >= ? AND created_at < ? AND status != 'void'
       GROUP BY date(created_at)
       ORDER BY day ASC`,
    )
    .all(businessId, sinceIso, untilIso) as Array<{ day: string; total: number; count: number }>

  const dayMap = new Map(salesRows.map((row) => [row.day, row]))
  const salesByDay: AnalyticsSummary['salesByDay'] = []
  let salesTotal = 0
  let salesCount = 0
  const cursor = parseUtcYmd(from)!
  for (let i = 0; i < days; i += 1) {
    const key = utcYmd(cursor)
    const row = dayMap.get(key)
    const total = row?.total ?? 0
    const count = row?.count ?? 0
    salesTotal += total
    salesCount += count
    salesByDay.push({ date: key, total, count })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const paymentRows = db()
    .prepare(
      `SELECT p.method, SUM(p.amount) as total
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND s.status != 'void'
       GROUP BY p.method`,
    )
    .all(businessId, sinceIso, untilIso) as Array<{ method: 'cash' | 'card' | 'credit'; total: number }>

  const paymentMap = new Map(paymentRows.map((row) => [row.method, row.total]))
  const paymentsByMethod: AnalyticsSummary['paymentsByMethod'] = (
    ['cash', 'card', 'credit'] as const
  ).map((method) => ({ method, total: paymentMap.get(method) ?? 0 }))

  const topProducts = db()
    .prepare(
      `SELECT si.product_name_snapshot as product_name,
              SUM(si.qty - COALESCE(si.refunded_qty, 0)) as qty,
              SUM((si.qty - COALESCE(si.refunded_qty, 0)) * si.unit_price) as revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND s.status != 'void'
       GROUP BY si.product_name_snapshot
       HAVING SUM(si.qty - COALESCE(si.refunded_qty, 0)) > 0
       ORDER BY revenue DESC
       LIMIT 8`,
    )
    .all(businessId, sinceIso, untilIso) as Array<{ product_name: string; qty: number; revenue: number }>

  const creditBalances = db()
    .prepare(
      `SELECT COALESCE(SUM(current_balance), 0) as total,
              COUNT(*) as customers
       FROM customers
       WHERE business_id = ? AND current_balance > 0 AND is_active = 1`,
    )
    .get(businessId) as { total: number; customers: number }

  const lowStock = db()
    .prepare(
      `SELECT COUNT(*) as c FROM products
       WHERE business_id = ? AND is_active = 1 AND tracks_stock = 1 AND stock_qty <= 5`,
    )
    .get(businessId) as { c: number }

  return {
    days,
    from,
    to,
    salesByDay,
    paymentsByMethod,
    topProducts: topProducts.map((row) => ({
      productName: row.product_name,
      qty: row.qty,
      revenue: row.revenue,
    })),
    creditOutstanding: creditBalances.total,
    customersWithBalance: creditBalances.customers,
    lowStockCount: lowStock.c,
    salesTotal,
    salesCount,
  }
}

function mapPosTicketItem(row: {
  id: string
  product_id: string
  product_name_snapshot: string
  qty: number
  unit_price: number
  line_total: number
}): PosTicketItem {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    qty: row.qty,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
  }
}

function loadPosTicket(ticketId: string): PosTicket {
  const row = db()
    .prepare(
      `SELECT id, business_id, branch_id, table_id, service_mode, status, opened_by, notes, created_at, updated_at
       FROM pos_tickets WHERE id = ?`,
    )
    .get(ticketId) as
    | {
      id: string
      business_id: string
      branch_id: string
      table_id: string | null
      service_mode: ServiceMode
      status: PosTicket['status']
      opened_by: string
      notes: string | null
      created_at: string
      updated_at: string
    }
    | undefined
  if (!row) throw new Error('Ticket not found')
  const items = db()
    .prepare(
      `SELECT id, product_id, product_name_snapshot, qty, unit_price, line_total
       FROM pos_ticket_items WHERE ticket_id = ? ORDER BY rowid ASC`,
    )
    .all(ticketId) as Array<Parameters<typeof mapPosTicketItem>[0]>
  const mappedItems = items.map(mapPosTicketItem)
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    tableId: row.table_id,
    serviceMode: row.service_mode,
    status: row.status,
    openedBy: row.opened_by,
    notes: row.notes,
    items: mappedItems,
    total: mappedItems.reduce((acc, item) => acc + item.lineTotal, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listDiningTables(businessId: string): DiningTable[] {
  requireValidLicense()
  assertBusinessAccess(businessId)
  if (!showsTables(getBusinessNature(businessId))) {
    throw new Error('Tables are only available for food businesses')
  }
  const rows = db()
    .prepare(
      `SELECT t.id, t.business_id, t.name, t.seats, t.sort_order, t.is_active,
              ot.id as open_ticket_id,
              COALESCE((
                SELECT SUM(ti.line_total) FROM pos_ticket_items ti WHERE ti.ticket_id = ot.id
              ), 0) as open_ticket_total
       FROM dining_tables t
       LEFT JOIN pos_tickets ot ON ot.table_id = t.id AND ot.status = 'open'
       WHERE t.business_id = ?
       ORDER BY t.sort_order ASC, t.name ASC`,
    )
    .all(businessId) as Array<{
      id: string
      business_id: string
      name: string
      seats: number | null
      sort_order: number
      is_active: number
      open_ticket_id: string | null
      open_ticket_total: number
    }>
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    seats: row.seats,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    occupied: Boolean(row.open_ticket_id),
    openTicketId: row.open_ticket_id,
    openTicketTotal: row.open_ticket_total || 0,
  }))
}

export function createDiningTable(payload: {
  businessId: string
  name: string
  seats?: number | null
  sortOrder?: number
}): DiningTable {
  requireValidLicense()
  requirePermission('tables:edit')
  assertBusinessAccess(payload.businessId)
  if (!showsTables(getBusinessNature(payload.businessId))) {
    throw new Error('Tables are only available for food businesses')
  }
  const session = requireSession()
  const id = uuidv4()
  const name = payload.name.trim()
  if (!name) throw new Error('Table name is required')
  db()
    .prepare(
      `INSERT INTO dining_tables (id, business_id, name, seats, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      id,
      payload.businessId,
      name,
      payload.seats ?? null,
      payload.sortOrder ?? 0,
      nowIso(),
    )
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: 'dining_table',
    entityId: id,
    action: 'created',
    summary: `Created table ${name}`,
  })
  return listDiningTables(payload.businessId).find((t) => t.id === id)!
}

export function updateDiningTable(payload: {
  id: string
  name: string
  seats?: number | null
  sortOrder?: number
  isActive?: boolean
}): DiningTable {
  requireValidLicense()
  const session = requirePermission('tables:edit')
  const existing = db()
    .prepare('SELECT business_id FROM dining_tables WHERE id = ?')
    .get(payload.id) as { business_id: string } | undefined
  if (!existing) throw new Error('Table not found')
  assertBusinessAccess(existing.business_id)
  if (!showsTables(getBusinessNature(existing.business_id))) {
    throw new Error('Tables are only available for food businesses')
  }
  const name = payload.name.trim()
  if (!name) throw new Error('Table name is required')
  db()
    .prepare(
      `UPDATE dining_tables SET name = ?, seats = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
    )
    .run(
      name,
      payload.seats ?? null,
      payload.sortOrder ?? 0,
      payload.isActive === false ? 0 : 1,
      payload.id,
    )
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: 'dining_table',
    entityId: payload.id,
    action: 'updated',
    summary: `Updated table ${name}`,
  })
  return listDiningTables(existing.business_id).find((t) => t.id === payload.id)!
}

export function listOpenTickets(businessId: string): PosTicket[] {
  requireValidLicense()
  assertBusinessAccess(businessId)
  if (!showsTables(getBusinessNature(businessId))) {
    throw new Error('Tickets are only available for food businesses')
  }
  const rows = db()
    .prepare(`SELECT id FROM pos_tickets WHERE business_id = ? AND status = 'open' ORDER BY updated_at DESC`)
    .all(businessId) as Array<{ id: string }>
  return rows.map((row) => loadPosTicket(row.id))
}

export function getPosTicket(ticketId: string): PosTicket {
  requireValidLicense()
  requireSession()
  const ticket = loadPosTicket(ticketId)
  assertBusinessAccess(ticket.businessId)
  return ticket
}

export function openPosTicket(payload: {
  businessId: string
  branchId: string
  serviceMode: ServiceMode
  tableId?: string | null
  notes?: string | null
}): PosTicket {
  requireValidLicense()
  requirePermission('sales:checkout')
  assertBusinessAccess(payload.businessId)
  assertBranchAccess(payload.branchId)
  if (!showsTables(getBusinessNature(payload.businessId))) {
    throw new Error('Tickets are only available for food businesses')
  }
  if (!['dine_in', 'takeaway', 'delivery'].includes(payload.serviceMode)) {
    throw new Error('Invalid service mode')
  }
  const session = requireSession()
  let tableId = payload.tableId?.trim() || null
  if (payload.serviceMode === 'dine_in') {
    if (!tableId) throw new Error('Table is required for dine-in')
    const table = db()
      .prepare('SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1')
      .get(tableId, payload.businessId) as { id: string } | undefined
    if (!table) throw new Error('Table not found')
    const open = db()
      .prepare(`SELECT id FROM pos_tickets WHERE table_id = ? AND status = 'open'`)
      .get(tableId) as { id: string } | undefined
    if (open) throw new Error('Table already has an open ticket')
  } else {
    tableId = null
  }

  const id = uuidv4()
  const at = nowIso()
  db()
    .prepare(
      `INSERT INTO pos_tickets (id, business_id, branch_id, table_id, service_mode, status, opened_by, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
    )
    .run(
      id,
      payload.businessId,
      payload.branchId,
      tableId,
      payload.serviceMode,
      session.id,
      payload.notes?.trim() || null,
      at,
      at,
    )
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: 'pos_ticket',
    entityId: id,
    action: 'opened',
    summary: `Opened ${payload.serviceMode} ticket`,
  })
  return loadPosTicket(id)
}

export function setPosTicketItems(payload: {
  ticketId: string
  items: Array<{ productId: string; qty: number; unitPrice: number }>
}): PosTicket {
  requireValidLicense()
  requirePermission('sales:checkout')
  const existing = db()
    .prepare('SELECT id, business_id, status FROM pos_tickets WHERE id = ?')
    .get(payload.ticketId) as { id: string; business_id: string; status: string } | undefined
  if (!existing) throw new Error('Ticket not found')
  assertBusinessAccess(existing.business_id)
  if (existing.status !== 'open') throw new Error('Ticket is no longer open')

  const at = nowIso()
  db().transaction(() => {
    db().prepare('DELETE FROM pos_ticket_items WHERE ticket_id = ?').run(payload.ticketId)
    const insert = db().prepare(
      `INSERT INTO pos_ticket_items (id, ticket_id, product_id, product_name_snapshot, qty, unit_price, line_total)
       SELECT ?, ?, p.id, p.name, ?, ?, ?
       FROM products p WHERE p.id = ? AND p.business_id = ? AND p.is_active = 1`,
    )
    for (const item of payload.items) {
      if (!Number.isFinite(item.qty) || item.qty <= 0) throw new Error('Item quantity must be greater than 0')
      const product = db()
        .prepare(
          `SELECT id, name, stock_qty, tracks_stock FROM products WHERE id = ? AND business_id = ? AND is_active = 1`,
        )
        .get(item.productId, existing.business_id) as
        | { id: string; name: string; stock_qty: number; tracks_stock: number }
        | undefined
      if (!product) throw new Error('Product not found or inactive')
      if (product.tracks_stock && item.qty > product.stock_qty) {
        throw new Error(`Insufficient stock for ${product.name}`)
      }
      const result = insert.run(
        uuidv4(),
        payload.ticketId,
        item.qty,
        item.unitPrice,
        item.qty * item.unitPrice,
        item.productId,
        existing.business_id,
      )
      if (result.changes !== 1) throw new Error('Failed to add ticket item')
    }
    db().prepare(`UPDATE pos_tickets SET updated_at = ? WHERE id = ?`).run(at, payload.ticketId)
  })()

  return loadPosTicket(payload.ticketId)
}

export function cancelPosTicket(ticketId: string): { ok: true } {
  requireValidLicense()
  requirePermission('sales:checkout')
  const session = requireSession()
  const existing = db()
    .prepare('SELECT id, business_id, status FROM pos_tickets WHERE id = ?')
    .get(ticketId) as { id: string; business_id: string; status: string } | undefined
  if (!existing) throw new Error('Ticket not found')
  assertBusinessAccess(existing.business_id)
  if (existing.status !== 'open') throw new Error('Ticket is no longer open')
  db()
    .prepare(`UPDATE pos_tickets SET status = 'cancelled', updated_at = ? WHERE id = ?`)
    .run(nowIso(), ticketId)
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: 'pos_ticket',
    entityId: ticketId,
    action: 'cancelled',
    summary: 'Cancelled open ticket',
  })
  return { ok: true }
}

