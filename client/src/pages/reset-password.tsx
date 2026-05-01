import { useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isConfigured, isLoading, user, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUpdated, setHasUpdated] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters for your new password.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Confirm the same password before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      setHasUpdated(true);
      setPassword("");
      setConfirmPassword("");
      toast({
        title: "Password updated",
        description: "You can now use your new password to sign in.",
      });
    } catch (error) {
      toast({
        title: "Password update failed",
        description:
          error instanceof Error ? error.message : "Unable to update password.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen px-4 py-16"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md items-center">
        <div
          className="w-full border p-6 shadow-lg"
          style={{
            backgroundColor: "var(--color-card)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {hasUpdated ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <KeyRound className="h-5 w-5" />
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase">
                Reset Password
              </h1>
              <p className="mt-1 text-sm opacity-60">
                Choose a new password for your Sabai Stay account.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 flex items-center gap-3 text-sm opacity-70">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
              Checking your reset link...
            </div>
          ) : null}

          {!isLoading && !isConfigured ? (
            <div
              className="mt-6 rounded-sm border px-4 py-3 text-sm opacity-70"
              style={{
                backgroundColor: "var(--color-secondary)",
                borderColor: "var(--color-border)",
              }}
            >
              Supabase auth is not configured for password resets.
            </div>
          ) : null}

          {!isLoading && isConfigured && !user && !hasUpdated ? (
            <div
              className="mt-6 rounded-sm border px-4 py-3 text-sm opacity-70"
              style={{
                backgroundColor: "var(--color-secondary)",
                borderColor: "var(--color-border)",
              }}
            >
              This reset link is missing, expired, or already used. Request a new
              password reset link from the sign-in dialog.
            </div>
          ) : null}

          {!isLoading && isConfigured && user && !hasUpdated ? (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="new-password" className="text-sm opacity-80">
                  New Password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 h-11 border"
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    borderColor: "var(--color-border)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="text-sm opacity-80">
                  Confirm Password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1.5 h-11 border"
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    borderColor: "var(--color-border)",
                  }}
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-sm font-display font-bold uppercase tracking-widest"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Save Password"
                )}
              </Button>
            </form>
          ) : null}

          {hasUpdated ? (
            <div className="mt-6 space-y-4">
              <div
                className="rounded-sm border px-4 py-3 text-sm opacity-80"
                style={{
                  backgroundColor: "var(--color-secondary)",
                  borderColor: "var(--color-border)",
                }}
              >
                Your password has been changed successfully.
              </div>
              <Button
                type="button"
                onClick={() => navigate("/")}
                className="h-12 w-full rounded-sm font-display font-bold uppercase tracking-widest"
              >
                Return Home
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
