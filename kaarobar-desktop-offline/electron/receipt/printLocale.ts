import { appStore } from '../config/store'
import {
  isRtlLanguage,
  normalizeAppLanguage,
  toBcp47,
  type AppLanguage,
} from '../../shared/languages'

export type PrintLanguage = AppLanguage

export function getPrintLanguage(): PrintLanguage {
  return normalizeAppLanguage(appStore.get('language'))
}

export type SalePrintLabels = {
  cashReceipt: string
  creditReceipt: string
  cardReceipt: string
  invoice: string
  date: string
  customer: string
  cashier: string
  printedBy: string
  description: string
  price: string
  subtotal: string
  discount: string
  total: string
  change: string
  tel: string
  followUs: string
  thankYou: string
  poweredBy: string
  cash: string
  card: string
  credit: string
}

export type PoPrintLabels = {
  purchaseOrder: string
  poNumber: string
  date: string
  status: string
  supplier: string
  phone: string
  address: string
  product: string
  qty: string
  unitCost: string
  total: string
  poweredBy: string
}

export type LedgerPrintLabels = {
  title: string
  customer: string
  phone: string
  period: string
  allEntries: string
  printedAt: string
  date: string
  particulars: string
  debit: string
  credit: string
  balance: string
  balanceBroughtForward: string
  totals: string
  closingBalance: string
  poweredBy: string
  sale: string
  payment: string
  adjustment: string
  opening: string
  cash: string
  card: string
}

export type PrintPreviewLabels = {
  print: string
  close: string
  previewHint: string
}


const POWERED_BY = {
  en: 'Powered by Kaarobar POS · 2ndHub Solutions',
  ur: 'کاروبار POS · 2ndHub Solutions سے تقویت یافتہ',
  de: 'Bereitgestellt von Kaarobar POS · 2ndHub Solutions',
  pt: 'Desenvolvido por Kaarobar POS · 2ndHub Solutions',
  es: 'Desarrollado por Kaarobar POS · 2ndHub Solutions',
  fr: 'Propulsé par Kaarobar POS · 2ndHub Solutions',
  ar: 'مدعوم من Kaarobar POS · 2ndHub Solutions',
} as const satisfies Record<AppLanguage, string>

const SALE_LABELS = {
  en: {
    cashReceipt: 'CASH RECEIPT',
    creditReceipt: 'CREDIT RECEIPT',
    cardReceipt: 'CARD / ONLINE RECEIPT',
    invoice: 'Invoice',
    date: 'Date',
    customer: 'Customer',
    cashier: 'Cashier',
    printedBy: 'Printed by',
    description: 'Description',
    price: 'Price',
    subtotal: 'Subtotal',
    discount: 'Discount',
    total: 'Total',
    change: 'Change',
    tel: 'Tel',
    followUs: 'Follow us',
    thankYou: 'THANK YOU!',
    poweredBy: POWERED_BY.en,
    cash: 'Cash',
    card: 'Card / Online',
    credit: 'Credit',
  },
  ur: {
    cashReceipt: 'نقد رسید',
    creditReceipt: 'کریڈٹ رسید',
    cardReceipt: 'کارڈ / آن لائن رسید',
    invoice: 'انوائس',
    date: 'تاریخ',
    customer: 'کسٹمر',
    cashier: 'کیشیئر',
    printedBy: 'پرنٹ کرنے والا',
    description: 'تفصیل',
    price: 'قیمت',
    subtotal: 'ذیلی کل',
    discount: 'رعایت',
    total: 'کل',
    change: 'بقایا واپسی',
    tel: 'فون',
    followUs: 'ہمیں فالو کریں',
    thankYou: 'شکریہ!',
    poweredBy: POWERED_BY.ur,
    cash: 'نقد',
    card: 'کارڈ / آن لائن',
    credit: 'کریڈٹ',
  },
  de: {
    cashReceipt: 'BARKWITTTUNG',
    creditReceipt: 'KREDITBELEG',
    cardReceipt: 'KARTEN- / ONLINE-BELEG',
    invoice: 'Rechnung',
    date: 'Datum',
    customer: 'Kunde',
    cashier: 'Kassierer',
    printedBy: 'Gedruckt von',
    description: 'Beschreibung',
    price: 'Preis',
    subtotal: 'Zwischensumme',
    discount: 'Rabatt',
    total: 'Gesamt',
    change: 'Rückgeld',
    tel: 'Tel',
    followUs: 'Folgen Sie uns',
    thankYou: 'VIELEN DANK!',
    poweredBy: POWERED_BY.de,
    cash: 'Bar',
    card: 'Karte / Online',
    credit: 'Kredit',
  },
  pt: {
    cashReceipt: 'RECIBO EM DINHEIRO',
    creditReceipt: 'RECIBO CRÉDITO',
    cardReceipt: 'RECIBO CARTÃO / ONLINE',
    invoice: 'Fatura',
    date: 'Data',
    customer: 'Cliente',
    cashier: 'Caixa',
    printedBy: 'Impresso por',
    description: 'Descrição',
    price: 'Preço',
    subtotal: 'Subtotal',
    discount: 'Desconto',
    total: 'Total',
    change: 'Troco',
    tel: 'Tel',
    followUs: 'Siga-nos',
    thankYou: 'OBRIGADO!',
    poweredBy: POWERED_BY.pt,
    cash: 'Dinheiro',
    card: 'Cartão / Online',
    credit: 'Crédito',
  },
  es: {
    cashReceipt: 'RECIBO EN EFECTIVO',
    creditReceipt: 'RECIBO CRÉDITO',
    cardReceipt: 'RECIBO TARJETA / EN LÍNEA',
    invoice: 'Factura',
    date: 'Fecha',
    customer: 'Cliente',
    cashier: 'Cajero',
    printedBy: 'Impreso por',
    description: 'Descripción',
    price: 'Precio',
    subtotal: 'Subtotal',
    discount: 'Descuento',
    total: 'Total',
    change: 'Cambio',
    tel: 'Tel',
    followUs: 'Síguenos',
    thankYou: '¡GRACIAS!',
    poweredBy: POWERED_BY.es,
    cash: 'Efectivo',
    card: 'Tarjeta / En línea',
    credit: 'Crédito',
  },
  fr: {
    cashReceipt: 'REÇU ESPÈCES',
    creditReceipt: 'REÇU CRÉDIT',
    cardReceipt: 'REÇU CARTE / EN LIGNE',
    invoice: 'Facture',
    date: 'Date',
    customer: 'Client',
    cashier: 'Caissier',
    printedBy: 'Imprimé par',
    description: 'Description',
    price: 'Prix',
    subtotal: 'Sous-total',
    discount: 'Remise',
    total: 'Total',
    change: 'Monnaie',
    tel: 'Tél',
    followUs: 'Suivez-nous',
    thankYou: 'MERCI !',
    poweredBy: POWERED_BY.fr,
    cash: 'Espèces',
    card: 'Carte / En ligne',
    credit: 'Crédit',
  },
  ar: {
    cashReceipt: 'إيصال نقدي',
    creditReceipt: 'إيصال ائتمان',
    cardReceipt: 'إيصال بطاقة / أونلاين',
    invoice: 'فاتورة',
    date: 'التاريخ',
    customer: 'العميل',
    cashier: 'أمين الصندوق',
    printedBy: 'طُبع بواسطة',
    description: 'الوصف',
    price: 'السعر',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم',
    total: 'الإجمالي',
    change: 'الباقي',
    tel: 'هاتف',
    followUs: 'تابعنا',
    thankYou: 'شكراً لك!',
    poweredBy: POWERED_BY.ar,
    cash: 'نقد',
    card: 'بطاقة / أونلاين',
    credit: 'ائتمان',
  },
} as const satisfies Record<AppLanguage, SalePrintLabels>

const PO_LABELS = {
  en: {
    purchaseOrder: 'PURCHASE ORDER',
    poNumber: 'PO #',
    date: 'Date',
    status: 'Status',
    supplier: 'Supplier',
    phone: 'Phone',
    address: 'Address',
    product: 'Product',
    qty: 'Qty',
    unitCost: 'Unit cost',
    total: 'Total',
    poweredBy: POWERED_BY.en,
  },
  ur: {
    purchaseOrder: 'خریداری آرڈر',
    poNumber: 'پی او #',
    date: 'تاریخ',
    status: 'حالت',
    supplier: 'سپلائر',
    phone: 'فون',
    address: 'پتہ',
    product: 'پروڈکٹ',
    qty: 'مقدار',
    unitCost: 'یونٹ لاگت',
    total: 'کل',
    poweredBy: POWERED_BY.ur,
  },
  de: {
    purchaseOrder: 'BESTELLUNG',
    poNumber: 'PO #',
    date: 'Datum',
    status: 'Status',
    supplier: 'Lieferant',
    phone: 'Telefon',
    address: 'Adresse',
    product: 'Produkt',
    qty: 'Menge',
    unitCost: 'Stückkosten',
    total: 'Gesamt',
    poweredBy: POWERED_BY.de,
  },
  pt: {
    purchaseOrder: 'PEDIDO DE COMPRA',
    poNumber: 'PC #',
    date: 'Data',
    status: 'Status',
    supplier: 'Fornecedor',
    phone: 'Telefone',
    address: 'Endereço',
    product: 'Produto',
    qty: 'Qtd',
    unitCost: 'Custo unitário',
    total: 'Total',
    poweredBy: POWERED_BY.pt,
  },
  es: {
    purchaseOrder: 'ORDEN DE COMPRA',
    poNumber: 'OC #',
    date: 'Fecha',
    status: 'Estado',
    supplier: 'Proveedor',
    phone: 'Teléfono',
    address: 'Dirección',
    product: 'Producto',
    qty: 'Cant',
    unitCost: 'Costo unitario',
    total: 'Total',
    poweredBy: POWERED_BY.es,
  },
  fr: {
    purchaseOrder: 'BON DE COMMANDE',
    poNumber: 'BC #',
    date: 'Date',
    status: 'Statut',
    supplier: 'Fournisseur',
    phone: 'Téléphone',
    address: 'Adresse',
    product: 'Produit',
    qty: 'Qté',
    unitCost: 'Coût unitaire',
    total: 'Total',
    poweredBy: POWERED_BY.fr,
  },
  ar: {
    purchaseOrder: 'أمر شراء',
    poNumber: 'أمر شراء #',
    date: 'التاريخ',
    status: 'الحالة',
    supplier: 'المورد',
    phone: 'الهاتف',
    address: 'العنوان',
    product: 'المنتج',
    qty: 'الكمية',
    unitCost: 'تكلفة الوحدة',
    total: 'الإجمالي',
    poweredBy: POWERED_BY.ar,
  },
} as const satisfies Record<AppLanguage, PoPrintLabels>

const LEDGER_LABELS = {
  en: {
    title: 'CUSTOMER LEDGER',
    customer: 'Customer',
    phone: 'Phone',
    period: 'Period',
    allEntries: 'All entries',
    printedAt: 'Printed',
    date: 'Date',
    particulars: 'Particulars',
    debit: 'Debit',
    credit: 'Credit',
    balance: 'Balance',
    balanceBroughtForward: 'Balance brought forward',
    totals: 'Totals',
    closingBalance: 'Closing balance',
    poweredBy: POWERED_BY.en,
    sale: 'Sale',
    payment: 'Payment',
    adjustment: 'Adjustment',
    opening: 'Opening',
    cash: 'Cash',
    card: 'Card / Online',
  },
  ur: {
    title: 'کسٹمر کریڈٹ',
    customer: 'کسٹمر',
    phone: 'فون',
    period: 'مدت',
    allEntries: 'تمام اندراجات',
    printedAt: 'پرنٹ',
    date: 'تاریخ',
    particulars: 'تفصیل',
    debit: 'ڈیبٹ',
    credit: 'کریڈٹ',
    balance: 'بیلنس',
    balanceBroughtForward: 'پچھلا بیلنس',
    totals: 'کل',
    closingBalance: 'اختتامی بیلنس',
    poweredBy: POWERED_BY.ur,
    sale: 'فروخت',
    payment: 'ادائیگی',
    adjustment: 'ایڈجسٹمنٹ',
    opening: 'ابتدائی',
    cash: 'نقد',
    card: 'کارڈ / آن لائن',
  },
  de: {
    title: 'KUNDENKONTO',
    customer: 'Kunde',
    phone: 'Telefon',
    period: 'Zeitraum',
    allEntries: 'Alle Einträge',
    printedAt: 'Gedruckt',
    date: 'Datum',
    particulars: 'Details',
    debit: 'Soll',
    credit: 'Haben',
    balance: 'Saldo',
    balanceBroughtForward: 'Saldo vorgetragen',
    totals: 'Summen',
    closingBalance: 'Abschlusssaldo',
    poweredBy: POWERED_BY.de,
    sale: 'Verkauf',
    payment: 'Zahlung',
    adjustment: 'Anpassung',
    opening: 'Eröffnung',
    cash: 'Bar',
    card: 'Karte / Online',
  },
  pt: {
    title: 'RAZÃO DO CLIENTE',
    customer: 'Cliente',
    phone: 'Telefone',
    period: 'Período',
    allEntries: 'Todos os lançamentos',
    printedAt: 'Impresso',
    date: 'Data',
    particulars: 'Detalhes',
    debit: 'Débito',
    credit: 'Crédito',
    balance: 'Saldo',
    balanceBroughtForward: 'Saldo anterior',
    totals: 'Totais',
    closingBalance: 'Saldo final',
    poweredBy: POWERED_BY.pt,
    sale: 'Venda',
    payment: 'Pagamento',
    adjustment: 'Ajuste',
    opening: 'Abertura',
    cash: 'Dinheiro',
    card: 'Cartão / Online',
  },
  es: {
    title: 'LIBRO DEL CLIENTE',
    customer: 'Cliente',
    phone: 'Teléfono',
    period: 'Período',
    allEntries: 'Todos los asientos',
    printedAt: 'Impreso',
    date: 'Fecha',
    particulars: 'Concepto',
    debit: 'Débito',
    credit: 'Crédito',
    balance: 'Saldo',
    balanceBroughtForward: 'Saldo anterior',
    totals: 'Totales',
    closingBalance: 'Saldo de cierre',
    poweredBy: POWERED_BY.es,
    sale: 'Venta',
    payment: 'Pago',
    adjustment: 'Ajuste',
    opening: 'Apertura',
    cash: 'Efectivo',
    card: 'Tarjeta / En línea',
  },
  fr: {
    title: 'GRAND LIVRE CLIENT',
    customer: 'Client',
    phone: 'Téléphone',
    period: 'Période',
    allEntries: 'Toutes les écritures',
    printedAt: 'Imprimé',
    date: 'Date',
    particulars: 'Libellé',
    debit: 'Débit',
    credit: 'Crédit',
    balance: 'Solde',
    balanceBroughtForward: 'Solde reporté',
    totals: 'Totaux',
    closingBalance: 'Solde de clôture',
    poweredBy: POWERED_BY.fr,
    sale: 'Vente',
    payment: 'Paiement',
    adjustment: 'Ajustement',
    opening: 'Ouverture',
    cash: 'Espèces',
    card: 'Carte / En ligne',
  },
  ar: {
    title: 'دفتر العميل',
    customer: 'العميل',
    phone: 'الهاتف',
    period: 'الفترة',
    allEntries: 'كل القيود',
    printedAt: 'طُبع',
    date: 'التاريخ',
    particulars: 'التفاصيل',
    debit: 'مدين',
    credit: 'دائن',
    balance: 'الرصيد',
    balanceBroughtForward: 'الرصيد المُرحَّل',
    totals: 'الإجماليات',
    closingBalance: 'الرصيد الختامي',
    poweredBy: POWERED_BY.ar,
    sale: 'بيع',
    payment: 'دفعة',
    adjustment: 'تعديل',
    opening: 'افتتاحي',
    cash: 'نقد',
    card: 'بطاقة / أونلاين',
  },
} as const satisfies Record<AppLanguage, LedgerPrintLabels>




export function getSalePrintLabels(lang: PrintLanguage = getPrintLanguage()): SalePrintLabels {
  return SALE_LABELS[lang]
}

export function getPoPrintLabels(lang: PrintLanguage = getPrintLanguage()): PoPrintLabels {
  return PO_LABELS[lang]
}

export function getLedgerPrintLabels(lang: PrintLanguage = getPrintLanguage()): LedgerPrintLabels {
  return LEDGER_LABELS[lang]
}

const PREVIEW_LABELS = {
  en: {
    print: 'Print',
    close: 'Close',
    previewHint: 'Preview — print when ready',
  },
  ur: {
    print: 'پرنٹ',
    close: 'بند کریں',
    previewHint: 'پیش منظر — تیار ہونے پر پرنٹ کریں',
  },
  de: {
    print: 'Drucken',
    close: 'Schließen',
    previewHint: 'Vorschau — bei Bedarf drucken',
  },
  pt: {
    print: 'Imprimir',
    close: 'Fechar',
    previewHint: 'Prévia — imprima quando estiver pronto',
  },
  es: {
    print: 'Imprimir',
    close: 'Cerrar',
    previewHint: 'Vista previa — imprima cuando esté listo',
  },
  fr: {
    print: 'Imprimer',
    close: 'Fermer',
    previewHint: 'Aperçu — imprimez quand vous êtes prêt',
  },
  ar: {
    print: 'طباعة',
    close: 'إغلاق',
    previewHint: 'معاينة — اطبع عند الجاهزية',
  },
} as const satisfies Record<AppLanguage, PrintPreviewLabels>


export function getPrintPreviewLabels(lang: PrintLanguage = getPrintLanguage()): PrintPreviewLabels {
  return PREVIEW_LABELS[lang]
}

/** Shared head bits: lang/dir + Google Fonts matching app LTR/RTL faces. */
export function printDocumentChrome(lang: PrintLanguage = getPrintLanguage()): {
  lang: PrintLanguage
  dir: 'ltr' | 'rtl'
  fontFamily: string
  fontLink: string
} {
  const rtl = isRtlLanguage(lang)
  return {
    lang,
    dir: rtl ? 'rtl' : 'ltr',
    fontFamily: rtl
      ? `'Noto Sans Arabic', 'Noto Naskh Arabic', ui-sans-serif, sans-serif`
      : `'Poppins', ui-sans-serif, sans-serif`,
    fontLink: rtl
      ? 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap'
      : 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  }
}

export function formatPrintDate(iso: string, lang: PrintLanguage = getPrintLanguage()): string {
  try {
    return new Date(iso).toLocaleString(toBcp47(lang))
  } catch {
    return iso
  }
}
