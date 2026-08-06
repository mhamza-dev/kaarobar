import { useTranslation } from 'react-i18next'
import { assetSrc } from '../../../lib/assets'
import { currencyPrefix } from '../../../../shared/currencies'
import { cn } from '../../../lib/cn'

export type InvoiceReceiptPreviewProps = {
  businessName: string
  currency: string
  brandColor: string
  logoPath: string | null
  branchAddress: string
  branchPhone: string
  receiptHeader: string
  receiptFooter: string
  className?: string
}

/** Live thermal-style receipt mock for Business Settings. */
export function InvoiceReceiptPreview({
  businessName,
  currency,
  brandColor,
  logoPath,
  branchAddress,
  branchPhone,
  receiptHeader,
  receiptFooter,
  className,
}: InvoiceReceiptPreviewProps) {
  const { t } = useTranslation()
  const prefix = currencyPrefix(currency)
  const logoUrl = logoPath ? assetSrc(logoPath) : null
  const header = receiptHeader.trim()
  const footer = receiptFooter.trim() || t('forms.receiptFooterDefault')
  const sampleInvoice = 'KB-PREV-MB-1'

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[300px] rounded-lg border border-line/80 bg-white p-3 font-mono text-[#111] shadow-soft',
        className,
      )}
      aria-label={t('forms.receiptPreview')}
    >
      <div className="text-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="mx-auto mb-1.5 max-h-14 max-w-[140px] object-contain"
          />
        ) : null}
        <p className="text-[15px] font-bold tracking-wide">
          {businessName.trim() || t('forms.receiptPreviewShop')}
        </p>
        {branchAddress.trim() ? (
          <p className="mt-0.5 text-[11px] leading-snug text-[#444]">{branchAddress.trim()}</p>
        ) : null}
        {branchPhone.trim() ? (
          <p className="text-[11px] text-[#444]">
            {t('forms.tel')}: {branchPhone.trim()}
          </p>
        ) : null}
        {header ? (
          <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-snug text-[#333]">{header}</p>
        ) : null}
      </div>

      <div className="my-2 overflow-hidden whitespace-nowrap text-center text-[11px] tracking-widest">
        ********************************
      </div>
      <p className="text-center text-[12px] font-bold tracking-wide">{t('forms.receiptPreviewTitle')}</p>
      <div className="my-2 overflow-hidden whitespace-nowrap text-center text-[11px] tracking-widest">
        ********************************
      </div>

      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <span>{t('forms.invoice')}</span>
          <span>{sampleInvoice}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{t('forms.date')}</span>
          <span>{t('forms.receiptPreviewDate')}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{t('forms.cashier')}</span>
          <span>{t('forms.receiptPreviewCashier')}</span>
        </div>
      </div>

      <div className="my-2 overflow-hidden whitespace-nowrap text-center text-[11px] tracking-widest">
        ********************************
      </div>

      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between gap-2 font-semibold">
          <span>{t('forms.description')}</span>
          <span>{t('forms.price')}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{t('forms.receiptPreviewItem')}</span>
          <span>
            {prefix} 250.00
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{t('forms.receiptPreviewItem2')}</span>
          <span>
            {prefix} 80.00
          </span>
        </div>
      </div>

      <div className="my-2 overflow-hidden whitespace-nowrap text-center text-[11px] tracking-widest">
        ********************************
      </div>

      <div className="flex justify-between gap-2 text-[13px] font-bold">
        <span>{t('forms.total')}</span>
        <span>
          {prefix} 330.00
        </span>
      </div>
      <div className="mt-0.5 flex justify-between gap-2 text-[11px]">
        <span>{t('forms.cash')}</span>
        <span>
          {prefix} 330.00
        </span>
      </div>

      <div className="my-2 overflow-hidden whitespace-nowrap text-center text-[11px] tracking-widest">
        ********************************
      </div>

      <p className="whitespace-pre-wrap text-center text-[12px] font-bold tracking-wide">{footer}</p>

      <div className="mt-2 flex flex-col items-center gap-1">
        <div className="h-10 w-[90%] rounded-sm bg-[repeating-linear-gradient(90deg,#111_0_2px,transparent_2px_4px)] opacity-80" />
        <p className="text-[10px] tracking-wide text-[#333]">{sampleInvoice}</p>
      </div>

      <div className="mt-3 border-t border-dashed border-[#ddd] pt-2 text-center">
        <div
          className="mx-auto mb-1 size-7 rounded-full"
          style={{ backgroundColor: brandColor || '#2d6df6' }}
        />
        <p className="text-[11px] font-bold" style={{ color: brandColor || '#2d6df6' }}>
          Kaarobar
        </p>
        <p className="text-[9px] text-[#555]">{t('forms.receiptPreviewPowered')}</p>
      </div>
    </div>
  )
}
