"use client";

import KaarobarLogo from "@/components/brand/KaarobarLogo";
import Button from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import { paymentMethodLabel } from "@/lib/paymentLabels";

export type ReceiptSale = {
  id: string;
  invoice_number: string;
  subtotal: string;
  tax_amount: string;
  discount_amount?: string;
  total_amount: string;
  customer_name?: string | null;
  fbr_qr_payload?: string | null;
  inserted_at?: string;
  items: {
    name: string;
    quantity: string;
    unit_price: string;
    line_total: string;
  }[];
  payments: { method: string; amount: string }[];
};

type Props = {
  sale: ReceiptSale | null;
  businessName?: string;
  branchName?: string;
  onClose: () => void;
};

function formatQty(q: string) {
  const n = Number(q);
  if (!Number.isFinite(n)) return q;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export default function SaleReceiptModal({
  sale,
  businessName = "Kaarobar",
  branchName,
  onClose,
}: Props) {
  const t = useT();
  if (!sale) return null;

  function print() {
    window.print();
  }

  return (
    <div className="kaarobar-receipt-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:bg-transparent print:p-0">
      <div className="kaarobar-receipt-sheet max-h-[90vh] w-full max-w-[20rem] overflow-auto rounded-md bg-white p-4 shadow-xl print:max-h-none print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div id="kaarobar-receipt" className="kaarobar-thermal-receipt mx-auto w-full max-w-[80mm]">
          <div className="thermal-center">
            <div className="mb-1 flex justify-center">
              <KaarobarLogo size={28} className="rounded-sm" />
            </div>
            <p className="thermal-shop">{businessName}</p>
            {branchName ? <p className="thermal-muted">{branchName}</p> : null}
            <p className="thermal-rule" aria-hidden>
              --------------------------------
            </p>
            <p className="thermal-strong">INV {sale.invoice_number}</p>
            {sale.inserted_at ? (
              <p className="thermal-muted">
                {new Date(sale.inserted_at).toLocaleString()}
              </p>
            ) : null}
            {sale.customer_name ? (
              <p className="thermal-line">Cust: {sale.customer_name}</p>
            ) : null}
            <p className="thermal-rule" aria-hidden>
              --------------------------------
            </p>
          </div>

          <table className="thermal-table">
            <thead>
              <tr>
                <th className="text-start">Item</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Amt</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, idx) => (
                <tr key={`${item.name}-${idx}`}>
                  <td className="text-start">{item.name}</td>
                  <td className="text-end">{formatQty(item.quantity)}</td>
                  <td className="text-end">{item.line_total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="thermal-rule" aria-hidden>
            --------------------------------
          </p>

          <div className="thermal-totals">
            <div className="thermal-row">
              <span>Subtotal</span>
              <span>{sale.subtotal}</span>
            </div>
            <div className="thermal-row">
              <span>Tax</span>
              <span>{sale.tax_amount}</span>
            </div>
            {sale.discount_amount && Number(sale.discount_amount) > 0 ? (
              <div className="thermal-row">
                <span>Discount</span>
                <span>{sale.discount_amount}</span>
              </div>
            ) : null}
            <div className="thermal-row thermal-total">
              <span>TOTAL</span>
              <span>Rs {sale.total_amount}</span>
            </div>
          </div>

          <p className="thermal-rule" aria-hidden>
            --------------------------------
          </p>

          <div className="thermal-totals">
            <p className="thermal-strong">Payments</p>
            {sale.payments.map((p, i) => (
              <div key={`${p.method}-${i}`} className="thermal-row">
                <span>{paymentMethodLabel(p.method, t)}</span>
                <span>{p.amount}</span>
              </div>
            ))}
          </div>

          {sale.fbr_qr_payload ? (
            <p className="thermal-fbr">FBR: {sale.fbr_qr_payload}</p>
          ) : null}

          <p className="thermal-rule" aria-hidden>
            --------------------------------
          </p>
          <div className="thermal-center">
            <p className="thermal-muted">Thank you</p>
            <p className="thermal-strong">Powered by Kaarobar</p>
            <p className="thermal-muted">2ndHub Solutions</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2 print:hidden">
          <Button className="flex-1" onClick={print}>
            Print receipt
          </Button>
          <Button className="flex-1" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
