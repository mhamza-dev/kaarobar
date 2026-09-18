"use client";

import { useField } from "formik";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchSelectOption = { value: string; label: string; description?: string };

type FormSearchSelectFieldProps = {
  name: string;
  label?: string;
  hint?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  options: SearchSelectOption[];
  /**
   * Push the typed query to the backend instead of filtering `options`
   * locally. Pass this whenever the full set is too large to ship to the
   * client (products, customers) — the same call the screen's list hook
   * makes, debounced by the caller.
   */
  onSearchChange?: (query: string) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Typeahead single-select — the `command` + `popover` combo.
 *
 * Two modes, and the caller picks: with `onSearchChange` the query is the
 * caller's problem (server-side search, `options` are whatever came back)
 * and local filtering is switched off so the backend's matches are never
 * filtered a second time; without it, `Command` filters `options` itself.
 */
export function FormSearchSelectField({
  name,
  label,
  hint,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results.",
  options,
  onSearchChange,
  loading,
  disabled,
  className,
}: FormSearchSelectFieldProps) {
  const [field, meta, helpers] = useField(name);
  const [open, setOpen] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;
  const showError = meta.touched && !!meta.error;
  const selected = options.find((option) => option.value === field.value);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={showError}
              aria-describedby={showError ? errorId : undefined}
              className="h-9 w-full justify-between font-normal"
            >
              <span className={cn("truncate", !selected && "text-muted-foreground")}>
                {selected?.label ?? placeholder}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent className="w-(--anchor-width) p-0" align="start">
          <Command shouldFilter={!onSearchChange}>
            <CommandInput placeholder={searchPlaceholder} onValueChange={onSearchChange} />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching…
                </div>
              ) : (
                <CommandEmpty>{emptyMessage}</CommandEmpty>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={onSearchChange ? option.value : option.label}
                  onSelect={() => {
                    helpers.setValue(option.value);
                    helpers.setTouched(true);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      option.value === field.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showError ? (
        <p id={errorId} className="text-xs text-destructive">
          {meta.error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
