export function SectionTitle({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">
        {kicker}
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold uppercase">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm opacity-60">{description}</p>
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-sm border p-5"
      style={{
        backgroundColor: "var(--color-card)",
        borderColor: "var(--color-border)",
      }}
    >
      {children}
    </div>
  );
}
import type { ReactNode } from "react";
