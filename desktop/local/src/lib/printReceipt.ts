import type { SalePrintResult } from '../../shared/types/api'

type ToastApi = {
  success: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

/**
 * One toast per print outcome, shared by every place a receipt can be printed
 * from. `cancelled` stays silent on purpose — the user closed the print dialog
 * themselves and does not need to be told about it.
 */
export function toastSalePrintResult(
  result: SalePrintResult,
  toast: ToastApi,
  t: (key: string) => string,
): void {
  if (result.method === 'printed') {
    toast.success(t('toast.receiptPrinted'))
  } else if (result.method === 'preview') {
    if (result.error) {
      toast.warning(t('toast.receiptPreviewFallback'), result.error)
    } else {
      toast.success(t('toast.receiptPreviewOpened'))
    }
  }
}
