"use client";

import { Loader2, UserRound, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCustomerSearch } from "@/hooks/queries/useCustomers";
import { useDebounce } from "@/hooks/useDebounce";
import { availableCreditLabel } from "@/lib/credit";
import { formatMoney } from "@/lib/format";
import type { Customer } from "@/types/api/crm";

/**
 * Attaching a customer to the sale at the till.
 *
 * Search is server-side on name, phone or code — a phone number is how a
 * shop recognises a regular. The picked customer goes into the quote as
 * well as the sale, because group discounts and prices are the backend's to
 * apply; the till only shows what came back.
 */
export function CustomerPicker({
  value,
  onChange,
  currency,
}: {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const { data: customers, isFetching } = useCustomerSearch(debouncedQuery, open);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {value.phone ?? "No phone"} · {availableCreditLabel(value, currency)}
            {value.owing && ` · owes ${formatMoney(value.balance, currency)}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove customer"
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-10 w-full justify-start font-normal">
            <UserRound className="size-4" />
            <span className="text-muted-foreground">Add customer (optional)</span>
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Name, phone or code…" onValueChange={setQuery} />
          <CommandList>
            {isFetching && !customers ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </div>
            ) : (
              <CommandEmpty>No customer matches.</CommandEmpty>
            )}
            {(customers ?? [])
              .filter((customer) => customer.is_active)
              .map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => {
                    onChange(customer);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <div className="flex flex-col">
                    <span>{customer.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {customer.phone ?? customer.code ?? "—"}
                    </span>
                  </div>
                </CommandItem>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
