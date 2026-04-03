import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map(({ id, title, description, variant }) => {
        return (
          <div
            key={id}
            className={cn(
              "pointer-events-auto relative mb-2 flex w-full items-start justify-between gap-4 overflow-hidden rounded-md border p-4 pr-10 shadow-lg",
              variant === "destructive"
                ? "border-destructive bg-destructive text-destructive-foreground"
                : "bg-background text-foreground",
            )}
          >
            <div className="grid gap-1">
              {title && <div className="text-sm font-semibold">{title}</div>}
              {description && <div className="text-sm opacity-90">{description}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(id)}
              className="absolute right-2 top-2 rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
