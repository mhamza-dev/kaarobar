import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * Serious and critical WCAG 2.1 A/AA violations on the page as it stands —
 * so a spec can check a screen in a state a URL alone can't reach (a
 * detail page for a record it just made, a sheet it just opened). The
 * Next.js dev overlay is excluded; it isn't part of the app.
 */
export async function seriousA11yViolations(page: Page, label: string): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .analyze();

  return result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) =>
        `${label}: ${violation.id} (${violation.nodes.length}) — ${violation.nodes[0]?.target.join(" ")} — ${violation.nodes[0]?.failureSummary?.replace(/\s+/g, " ").slice(0, 200)}`,
    );
}

/** How far the page scrolls sideways; anything over a pixel is a layout bug. */
export async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
