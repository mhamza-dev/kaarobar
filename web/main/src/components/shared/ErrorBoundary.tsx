"use client";

import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Replaces the default panel; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type ErrorBoundaryState = { error: Error | null };

/**
 * Catches render-time crashes so one broken widget cannot blank the whole
 * app shell.
 *
 * Still a class component — `componentDidCatch` has no hook equivalent.
 * This is for *render* errors only: a failed request never reaches here,
 * because React Query resolves it into an error state the screen renders
 * itself. Wrap route content and any self-contained panel (a chart, a
 * board) whose failure should stay local.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-danger-soft text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            This part of the page failed to load. Try again, and if it keeps happening, reload.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
