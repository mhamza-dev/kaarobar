import Button from "@/components/ui/Button";

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

export default function SaleReceiptModal({
  sale,
  businessName = "Kaarobar",
  branchName,
  onClose,
}: Props) {
  if (!sale) return null;

  function print() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:bg-transparent print:p-0">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-lg bg-white p-6 shadow-xl print:max-h-none print:shadow-none">
        <div id="kaarobar-receipt" className="space-y-3 text-sm text-slate-900">
          <div className="text-center">
            <p className="text-lg font-bold">{businessName}</p>
            {branchName ? <p className="text-slate-600">{branchName}</p> : null}
            <p className="mt-2 font-semibold">Invoice {sale.invoice_number}</p>
            {sale.inserted_at ? (
              <p className="text-xs text-slate-500">
                {new Date(sale.inserted_at).toLocaleString()}
              </p>
            ) : null}
            {sale.customer_name ? (
              <p className="mt-1 text-slate-700">Customer: {sale.customer_name}</p>
            ) : null}
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1">Item</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, idx) => (
                <tr key={`${item.name}-${idx}`} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">{item.name}</td>
                  <td className="py-1.5 text-right">{item.quantity}</td>
                  <td className="py-1.5 text-right">{item.line_total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{sale.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{sale.tax_amount}</span>
            </div>
            {sale.discount_amount && Number(sale.discount_amount) > 0 ? (
              <div className="flex justify-between">
                <span>Discount</span>
                <span>{sale.discount_amount}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>Rs {sale.total_amount}</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2 text-xs">
            <p className="font-semibold">Payments</p>
            {sale.payments.map((p, i) => (
              <div key={`${p.method}-${i}`} className="flex justify-between capitalize">
                <span>{p.method}</span>
                <span>{p.amount}</span>
              </div>
            ))}
          </div>

          {sale.fbr_qr_payload ? (
            <p className="break-all text-center text-[10px] text-slate-500">
              FBR: {sale.fbr_qr_payload}
            </p>
          ) : null}

          <p className="pt-2 text-center text-xs text-slate-500">Thank you</p>
        </div>

        <div className="mt-5 flex gap-2 print:hidden">
          <Button className="flex-1" onClick={print}>
            Print invoice
          </Button>
          <Button className="flex-1" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
