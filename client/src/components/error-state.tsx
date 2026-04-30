import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ErrorState({
  code,
  title,
  description,
  actionLabel = "Try Again",
  onAction,
  backHref,
  backLabel = "Back Home",
}: {
  code?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="container mx-auto flex min-h-[55vh] items-center px-4 py-16 md:px-6">
      <div
        className="w-full max-w-2xl rounded-sm border p-6"
        style={{
          backgroundColor: "var(--color-card)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <AlertTriangle className="h-5 w-5" />
          </div>
          {code ? (
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
              {code}
            </span>
          ) : null}
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold uppercase md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed opacity-70 md:text-base">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {onAction ? (
            <Button type="button" onClick={onAction}>
              <RefreshCw className="h-4 w-4" />
              {actionLabel}
            </Button>
          ) : null}
          {backHref ? (
            <Button asChild variant={onAction ? "outline" : "default"}>
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

