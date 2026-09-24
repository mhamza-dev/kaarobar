"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Paper = "58mm" | "76mm" | "80mm" | "A4" | "Letter";

/**
 * A backend-rendered document (receipt, statement) previewed and printed.
 *
 * The HTML is the backend's own (`Kaarobar.Documents.Html`) — the same page
 * a reprint or an emailed copy would be — fetched with the bearer token and
 * shown through `srcDoc`, because a plain iframe `src` could not send the
 * token. The frame is sandboxed with scripts off: it only needs to render,
 * and be printed from here (`allow-modals` for the print dialog,
 * `allow-same-origin` so this page may call `print()` on it).
 */
export function DocumentPreview({
  open,
  onOpenChange,
  title,
  description,
  queryKey,
  fetchHtml,
  papers,
  defaultPaper,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  queryKey: readonly unknown[];
  fetchHtml: (paper: Paper) => Promise<string>;
  papers: Paper[];
  defaultPaper: Paper;
}) {
  const [paper, setPaper] = useState<Paper>(defaultPaper);
  const frame = useRef<HTMLIFrameElement>(null);
  const {
    data: html,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [...queryKey, paper],
    queryFn: () => fetchHtml(paper),
    enabled: open,
    staleTime: 60_000,
  });

  const isRoll = paper.endsWith("mm");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {papers.length > 1 && (
            <select
              value={paper}
              onChange={(event) => setPaper(event.target.value as Paper)}
              aria-label="Paper"
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
            >
              {papers.map((option) => (
                <option key={option} value={option}>
                  {option.endsWith("mm") ? `${option} roll` : option}
                </option>
              ))}
            </select>
          )}
          <Button
            disabled={!html}
            onClick={() => frame.current?.contentWindow?.print()}
            className="ml-auto"
          >
            <Printer className="size-4" />
            Print
          </Button>
        </div>

        <div className="flex max-h-[60vh] justify-center overflow-auto rounded-lg border border-border bg-muted p-3">
          {isLoading ? (
            <Loader2 className="my-12 size-6 animate-spin text-muted-foreground" />
          ) : isError || !html ? (
            <p className="my-12 text-sm text-muted-foreground">Couldn&apos;t load the document.</p>
          ) : (
            <iframe
              ref={frame}
              title={title}
              srcDoc={html}
              sandbox="allow-same-origin allow-modals"
              className="bg-white"
              style={{ width: isRoll ? "340px" : "100%", height: "60vh", border: 0 }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
