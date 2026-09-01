defmodule Kaarobar.Documents.Labels do
  @moduledoc """
  What a printed document says, in each language the platform ships.

  Not `gettext`. These strings are chosen per *document*, from the business's
  own setting, not from the caller's `Accept-Language`: a shop in Karachi
  prints Urdu receipts whether the till was opened by the owner's phone or by
  a browser in another timezone. Tying them to request negotiation would give a
  customer a receipt in the language of whoever happened to press print.

  Ported deliberately from `desktop/local`'s `printLocale.ts` so the two
  products print the same words. A customer holding a receipt from the desktop
  app and one from the cloud should not be able to tell which produced which.
  """

  @languages ~w(en ur ar de es fr pt)a

  @typedoc "A language the platform prints in."
  @type language :: :en | :ur | :ar | :de | :es | :fr | :pt

  # Right-to-left scripts. Not a property of the language in general — a
  # document's direction is what decides layout, and getting it wrong turns a
  # receipt into something nobody can read.
  @rtl ~w(ur ar)a

  @sale %{
    en: %{
      cash_receipt: "CASH RECEIPT",
      credit_receipt: "CREDIT RECEIPT",
      card_receipt: "CARD / ONLINE RECEIPT",
      invoice: "Invoice",
      date: "Date",
      customer: "Customer",
      cashier: "Cashier",
      description: "Description",
      price: "Price",
      qty: "Qty",
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      paid: "Paid",
      change: "Change",
      tel: "Tel",
      thank_you: "THANK YOU!",
      cash: "Cash",
      card: "Card / Online",
      credit: "Credit",
      wallet: "Wallet",
      bank: "Bank transfer",
      powered_by: "Powered by Kaarobar"
    },
    ur: %{
      cash_receipt: "نقد رسید",
      credit_receipt: "کریڈٹ رسید",
      card_receipt: "کارڈ / آن لائن رسید",
      invoice: "انوائس",
      date: "تاریخ",
      customer: "کسٹمر",
      cashier: "کیشیئر",
      description: "تفصیل",
      price: "قیمت",
      qty: "تعداد",
      subtotal: "ذیلی کل",
      discount: "رعایت",
      tax: "ٹیکس",
      total: "کل",
      paid: "ادا شدہ",
      change: "بقایا واپسی",
      tel: "فون",
      thank_you: "شکریہ!",
      cash: "نقد",
      card: "کارڈ / آن لائن",
      credit: "کریڈٹ",
      wallet: "والٹ",
      bank: "بینک ٹرانسفر",
      powered_by: "کاروبار سے تقویت یافتہ"
    },
    ar: %{
      cash_receipt: "إيصال نقدي",
      credit_receipt: "إيصال ائتمان",
      card_receipt: "إيصال بطاقة / أونلاين",
      invoice: "فاتورة",
      date: "التاريخ",
      customer: "العميل",
      cashier: "أمين الصندوق",
      description: "الوصف",
      price: "السعر",
      qty: "الكمية",
      subtotal: "المجموع الفرعي",
      discount: "الخصم",
      tax: "الضريبة",
      total: "الإجمالي",
      paid: "المدفوع",
      change: "الباقي",
      tel: "هاتف",
      thank_you: "شكراً لك!",
      cash: "نقد",
      card: "بطاقة / أونلاين",
      credit: "ائتمان",
      wallet: "محفظة",
      bank: "تحويل بنكي",
      powered_by: "مدعوم من Kaarobar"
    },
    de: %{
      cash_receipt: "BARQUITTUNG",
      credit_receipt: "KREDITBELEG",
      card_receipt: "KARTEN- / ONLINE-BELEG",
      invoice: "Rechnung",
      date: "Datum",
      customer: "Kunde",
      cashier: "Kassierer",
      description: "Beschreibung",
      price: "Preis",
      qty: "Menge",
      subtotal: "Zwischensumme",
      discount: "Rabatt",
      tax: "Steuer",
      total: "Gesamt",
      paid: "Bezahlt",
      change: "Rückgeld",
      tel: "Tel",
      thank_you: "VIELEN DANK!",
      cash: "Bar",
      card: "Karte / Online",
      credit: "Kredit",
      wallet: "Wallet",
      bank: "Überweisung",
      powered_by: "Bereitgestellt von Kaarobar"
    },
    es: %{
      cash_receipt: "RECIBO EN EFECTIVO",
      credit_receipt: "RECIBO CRÉDITO",
      card_receipt: "RECIBO TARJETA / EN LÍNEA",
      invoice: "Factura",
      date: "Fecha",
      customer: "Cliente",
      cashier: "Cajero",
      description: "Descripción",
      price: "Precio",
      qty: "Cant.",
      subtotal: "Subtotal",
      discount: "Descuento",
      tax: "Impuesto",
      total: "Total",
      paid: "Pagado",
      change: "Cambio",
      tel: "Tel",
      thank_you: "¡GRACIAS!",
      cash: "Efectivo",
      card: "Tarjeta / En línea",
      credit: "Crédito",
      wallet: "Monedero",
      bank: "Transferencia",
      powered_by: "Desarrollado por Kaarobar"
    },
    fr: %{
      cash_receipt: "REÇU ESPÈCES",
      credit_receipt: "REÇU CRÉDIT",
      card_receipt: "REÇU CARTE / EN LIGNE",
      invoice: "Facture",
      date: "Date",
      customer: "Client",
      cashier: "Caissier",
      description: "Description",
      price: "Prix",
      qty: "Qté",
      subtotal: "Sous-total",
      discount: "Remise",
      tax: "TVA",
      total: "Total",
      paid: "Payé",
      change: "Monnaie",
      tel: "Tél",
      thank_you: "MERCI !",
      cash: "Espèces",
      card: "Carte / En ligne",
      credit: "Crédit",
      wallet: "Portefeuille",
      bank: "Virement",
      powered_by: "Propulsé par Kaarobar"
    },
    pt: %{
      cash_receipt: "RECIBO EM DINHEIRO",
      credit_receipt: "RECIBO CRÉDITO",
      card_receipt: "RECIBO CARTÃO / ONLINE",
      invoice: "Fatura",
      date: "Data",
      customer: "Cliente",
      cashier: "Caixa",
      description: "Descrição",
      price: "Preço",
      qty: "Qtd",
      subtotal: "Subtotal",
      discount: "Desconto",
      tax: "Imposto",
      total: "Total",
      paid: "Pago",
      change: "Troco",
      tel: "Tel",
      thank_you: "OBRIGADO!",
      cash: "Dinheiro",
      card: "Cartão / Online",
      credit: "Crédito",
      wallet: "Carteira",
      bank: "Transferência",
      powered_by: "Desenvolvido por Kaarobar"
    }
  }

  @doc "Every language a document can be printed in."
  @spec languages() :: [language()]
  def languages, do: @languages

  @doc """
  Normalises whatever the business has stored into a language we print.

  Falls back to English rather than failing: a receipt in the wrong language
  can still be read, and one that did not print cannot.
  """
  @spec normalize(term()) :: language()
  def normalize(value) when value in @languages, do: value

  def normalize(value) when is_binary(value) do
    # "ur-PK" and "UR" both mean Urdu.
    normalized = value |> String.downcase() |> String.split(["-", "_"]) |> List.first()

    Enum.find(@languages, :en, &(Atom.to_string(&1) == normalized))
  end

  def normalize(_value), do: :en

  @doc "The labels for a sale receipt."
  @spec sale(language()) :: map()
  def sale(language), do: Map.fetch!(@sale, normalize(language))

  @doc "True when the document reads right to left."
  @spec rtl?(language()) :: boolean()
  def rtl?(language), do: normalize(language) in @rtl

  @doc "The `dir` attribute for a document in this language."
  @spec direction(language()) :: String.t()
  def direction(language), do: if(rtl?(language), do: "rtl", else: "ltr")

  @doc """
  A font stack that can actually render the script.

  Names faces from all three desktop platforms, because the document is
  rendered wherever the client prints it. Chromium would fall back on its own,
  but implicit fallback is what produces text on one machine and empty boxes on
  the next.
  """
  @spec font_stack(language()) :: String.t()
  def font_stack(language) do
    if rtl?(language) do
      "'Noto Nastaliq Urdu', 'SF Arabic', 'Geeza Pro', 'Noto Sans Arabic', " <>
        "'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif"
    else
      "'Inter', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', sans-serif"
    end
  end
end
