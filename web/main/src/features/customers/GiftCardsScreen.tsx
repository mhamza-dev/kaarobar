"use client";

import { Form, Formik } from "formik";
import { Copy, Gift, Loader2, Search } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadError } from "@/components/shared/LoadError";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivateGiftCard,
  useGiftCard,
  useIssueGiftCard,
  useRedeemGiftCard,
  useTopUpGiftCard,
} from "@/hooks/queries/usePrepaid";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { isNotFound } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatSigned,
  humanize,
  todayIso,
} from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { GiftCardTransaction, IssuedGiftCard } from "@/types/api/crm";

/**
 * Gift cards. There's no list of them to browse: a card is found by its
 * code, the way it arrives at the counter, because the code is what spends
 * it — the backend keeps only a hash, and shows the code in full exactly
 * once, when the card is issued.
 */
export function GiftCardsScreen() {
  const { can } = usePermission();
  const [input, setInput] = useState("");
  const [code, setCode] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          className="flex max-w-md flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim()) setCode(input.trim());
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="gift-card-code">Card code</Label>
            <Input
              id="gift-card-code"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Scan or type the code on the card"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="outline">
            <Search className="size-4" />
            Look up
          </Button>
        </form>
        {can("gift_card:issue") && <IssueGiftCardDialog onIssued={(card) => setCode(card.code)} />}
      </div>

      {code ? (
        <GiftCardPanel code={code} />
      ) : (
        <EmptyState
          icon={Gift}
          title="Look up a gift card"
          description="Enter the code printed on the card to see its balance and history."
        />
      )}
    </div>
  );
}

function GiftCardPanel({ code }: { code: string }) {
  const { can } = usePermission();
  const { data, isLoading, error, refetch } = useGiftCard(code);
  const activate = useActivateGiftCard();
  const [moving, setMoving] = useState<"top_up" | "redeem" | null>(null);

  if (isLoading) return <Skeleton className="h-48 w-full max-w-2xl" />;
  if (isNotFound(error)) {
    return (
      <EmptyState
        icon={Gift}
        title="No card with that code"
        description="Check the code and try again. Codes are case-sensitive."
      />
    );
  }
  if (error || !data) return <LoadError what="this gift card" onRetry={() => refetch()} />;

  const { card, transactions } = data;
  const money = (value: string | null | undefined) => formatMoney(value, card.currency);

  const columns: DataTableColumn<GiftCardTransaction>[] = [
    {
      key: "kind",
      header: "Entry",
      render: (entry) => (
        <div>
          <p>{humanize(entry.kind)}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(entry.occurred_at)}</p>
        </div>
      ),
    },
    { key: "note", header: "Note", render: (entry) => entry.note ?? "—" },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (entry) => formatSigned(entry.amount),
    },
    {
      key: "after",
      header: "Balance",
      align: "end",
      render: (entry) => money(entry.balance_after),
    },
  ];

  return (
    <section className="flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{card.masked_code}</p>
          <p className="text-3xl font-semibold tabular-nums">{money(card.balance)}</p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={card.status} />
            {!card.spendable && card.status === "active" && (
              <span className="text-xs text-muted-foreground">Not spendable today</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {card.status === "inactive" && can("gift_card:issue") && (
            <Button
              disabled={activate.isPending}
              onClick={async () => {
                try {
                  await activate.mutateAsync([code]);
                  toast.success("Card activated");
                } catch {
                  // Toasted by the hook.
                }
              }}
            >
              Activate
            </Button>
          )}
          {card.status === "active" && can("gift_card:issue") && (
            <Button variant="outline" onClick={() => setMoving("top_up")}>
              Top up
            </Button>
          )}
          {card.spendable && can("gift_card:redeem") && (
            <Button variant="outline" onClick={() => setMoving("redeem")}>
              Spend
            </Button>
          )}
        </div>
      </div>

      <DescriptionList
        items={[
          { label: "Loaded with", value: money(card.issued_amount) },
          { label: "For", value: card.recipient_name, hidden: !card.recipient_name },
          { label: "Message", value: card.message, hidden: !card.message },
          { label: "Issued", value: formatDateTime(card.issued_at) },
          { label: "Expires", value: card.expires_on ? formatDate(card.expires_on) : "Never" },
        ]}
      />

      <DataTable
        embedded
        columns={columns}
        rows={[...transactions].reverse()}
        rowKey={(entry) => entry.id}
        empty={<p className="p-6 text-center text-sm text-muted-foreground">No activity yet.</p>}
        mobileCardTitle={(entry) => humanize(entry.kind)}
        mobileCardFields={[
          { key: "amount", label: "Amount", render: (entry) => formatSigned(entry.amount) },
        ]}
      />

      <MoveDialog
        code={code}
        kind={moving}
        currency={card.currency}
        onClose={() => setMoving(null)}
      />
    </section>
  );
}

function MoveDialog({
  code,
  kind,
  currency,
  onClose,
}: {
  code: string;
  kind: "top_up" | "redeem" | null;
  currency: string;
  onClose: () => void;
}) {
  const topUp = useTopUpGiftCard();
  const redeem = useRedeemGiftCard();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const pending = topUp.isPending || redeem.isPending;
  // Keep the last kind while the dialog animates closed; switching on the
  // way out would flash "Spend" over a top-up that just went through.
  const [shown, setShown] = useState(kind);
  if (kind && kind !== shown) setShown(kind);
  const isTopUp = (kind ?? shown) === "top_up";

  const close = () => {
    setAmount("");
    setNote("");
    onClose();
  };

  return (
    <Dialog open={!!kind} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isTopUp ? "Top up the card" : "Spend from the card"}</DialogTitle>
          <DialogDescription>
            {isTopUp
              ? "Money added to the card's balance."
              : "For spending outside the till — at the till, the card is a tender."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-amount">Amount ({currency})</Label>
            <Input
              id="card-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-note">Note</Label>
            <Input id="card-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={pending || !(Number(amount) > 0)}
            onClick={async () => {
              try {
                await (isTopUp ? topUp : redeem).mutateAsync([code, amount, note || undefined]);
                toast.success(isTopUp ? "Card topped up" : "Spent from the card");
                close();
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isTopUp ? "Top up" : "Spend"} {Number(amount) > 0 && formatMoney(amount, currency)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const issueSchema = Yup.object({
  amount: Yup.number().typeError("Enter an amount").positive("Enter more than zero").required(),
});

function IssueGiftCardDialog({ onIssued }: { onIssued: (card: IssuedGiftCard) => void }) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedGiftCard | null>(null);
  const issue = useIssueGiftCard();

  const close = () => {
    setOpen(false);
    setIssued(null);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Gift className="size-4" />
        Issue a gift card
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Once the code is on screen it can't be fetched again; closing is
          // only by the explicit button, after it's been written down.
          if (!next && !issued) close();
        }}
      >
        <DialogContent showCloseButton={!issued}>
          {issued ? (
            <>
              <DialogHeader>
                <DialogTitle>Gift card issued</DialogTitle>
                <DialogDescription>
                  Write this code on the card or hand it over now. It won&apos;t be shown again —
                  only its last digits.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <code
                  className="flex-1 font-mono text-lg tracking-wider break-all"
                  aria-label="Gift card code"
                >
                  {issued.code}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(issued.code);
                      toast.success("Code copied");
                    } catch {
                      toast.error("Couldn't copy — write it down instead");
                    }
                  }}
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>
              <p className="text-sm">
                Loaded with {formatMoney(issued.issued_amount, issued.currency)}
                {issued.status === "inactive" && " — activate it once it's paid for"}.
              </p>
              <DialogFooter>
                <Button onClick={close}>I&apos;ve recorded the code</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Issue a gift card</DialogTitle>
                <DialogDescription>
                  The code is shown once, when the card is created.
                </DialogDescription>
              </DialogHeader>
              <Formik
                initialValues={{ amount: "", recipient_name: "", message: "", expires_on: "" }}
                validationSchema={issueSchema}
                onSubmit={async (values, helpers) => {
                  try {
                    const card = (await issue.mutateAsync([
                      {
                        amount: String(values.amount),
                        recipient_name: values.recipient_name || null,
                        message: values.message || null,
                        expires_on: values.expires_on || null,
                      },
                    ])) as IssuedGiftCard;
                    setIssued(card);
                    onIssued(card);
                    helpers.resetForm();
                  } catch (error) {
                    const { unmapped } = applyApiFieldErrors({
                      error,
                      values,
                      setErrors: helpers.setErrors,
                    });
                    for (const message of unmapped) toast.error(message);
                  }
                }}
              >
                {({ isSubmitting }) => (
                  <Form className="flex flex-col gap-4">
                    <FormNumberField name="amount" label="Amount" min={0} suffix={currency} />
                    <FormTextField name="recipient_name" label="For" placeholder="Who it's for" />
                    <FormTextareaField name="message" label="Message" rows={2} />
                    <FormDatePicker
                      name="expires_on"
                      label="Expires"
                      min={todayIso()}
                      hint="Leave blank for never."
                    />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={close}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                        Issue card
                      </Button>
                    </DialogFooter>
                  </Form>
                )}
              </Formik>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
