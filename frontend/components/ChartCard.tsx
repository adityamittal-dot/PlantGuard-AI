import type { ReactNode } from "react";

export const CHART_COLORS = {
  emerald: "#1f6f54",
  leaf: "#3d8b6e",
  sage: "#8fad9c",
  moss: "#2a4a3a",
  warning: "#b8860b",
  danger: "#b54a3c",
  grid: "rgba(28, 36, 32, 0.1)",
  axis: "rgba(28, 36, 32, 0.55)",
};

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-charcoal/10 bg-white p-5">
      <h2 className="font-display text-xl text-charcoal">{title}</h2>
      {description && <p className="mt-1 text-xs text-charcoal/50">{description}</p>}
      <div className="mt-4 h-64 w-full">{children}</div>
    </section>
  );
}
