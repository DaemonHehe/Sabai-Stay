import { lazy, Suspense, useState } from "react";
import { User } from "lucide-react";

const AuthDialog = lazy(() =>
  import("@/components/auth-dialog").then((module) => ({
    default: module.AuthDialog,
  })),
);

export function AuthControl() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 min-w-10 sm:min-w-[10rem] rounded-full bg-secondary/50 border px-3 flex items-center justify-center sm:justify-start gap-2 hover:bg-secondary transition-colors"
        style={{ borderColor: "var(--color-border)" }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary">
          <User className="h-4 w-4" />
        </div>
        <span className="hidden sm:block text-[11px] font-mono uppercase tracking-wider opacity-70">
          Account
        </span>
      </button>

      <Suspense fallback={null}>
        {open ? <AuthDialog open={open} onOpenChange={setOpen} /> : null}
      </Suspense>
    </>
  );
}
