import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  GraduationCap,
  LoaderCircle,
  LogOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, type SignUpInput } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { listUniversities } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type RegistrationRole = SignUpInput["role"];

const roleCopy: Record<
  RegistrationRole,
  {
    label: string;
    subtitle: string;
    icon: typeof GraduationCap;
  }
> = {
  student: {
    label: "Student",
    subtitle: "Book rooms and build your campus housing profile.",
    icon: GraduationCap,
  },
  owner: {
    label: "Apartment Owner",
    subtitle: "List properties and manage student-ready inventory.",
    icon: Building2,
  },
};

function prettifyRole(role: string | undefined) {
  if (role === "owner") {
    return "Apartment Owner";
  }

  if (role === "student") {
    return "Student";
  }

  return "Account";
}

function getEmailDomain(value: string) {
  return value.trim().toLowerCase().split("@")[1] ?? "";
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm opacity-80">
      {children}
    </label>
  );
}

function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg border p-6 shadow-lg outline-none"
        style={{
          backgroundColor: "var(--color-card)",
          borderColor: "var(--color-border)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border opacity-70 transition-opacity hover:opacity-100"
          style={{ borderColor: "var(--color-border)" }}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-10">
          <h2 className="font-display text-2xl uppercase">{title}</h2>
          {description ? <p className="mt-2 text-sm opacity-60">{description}</p> : null}
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { isConfigured, isLoading, user, profile, signIn, signUp, signOut } =
    useAuth();
  const [activeTab, setActiveTab] = useState<"sign-in" | "sign-up">("sign-in");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });
  const [signUpData, setSignUpData] = useState<SignUpInput>({
    role: "student",
    fullName: "",
    phone: "",
    email: "",
    password: "",
    universityId: "",
    studentNumber: "",
    roommateOptIn: false,
    businessName: "",
    businessRegistrationNumber: "",
  });

  const { data: universities = [], isLoading: isLoadingUniversities } = useQuery({
    queryKey: ["universities"],
    queryFn: listUniversities,
    enabled: open && isConfigured,
    staleTime: 1000 * 60 * 60,
  });
  const selectedUniversity =
    universities.find((university) => university.id === signUpData.universityId) ??
    null;

  const displayName =
    profile?.appUser.fullName || user?.user_metadata?.full_name || user?.email;
  const verificationStatus = useMemo(() => {
    if (profile?.studentProfile) {
      return profile.studentProfile.verificationStatus;
    }

    if (profile?.ownerProfile) {
      return profile.ownerProfile.verificationStatus;
    }

    return null;
  }, [profile]);

  const verificationLabel = verificationStatus
    ? verificationStatus.charAt(0).toUpperCase() + verificationStatus.slice(1)
    : null;

  async function handleSignInSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await signIn(signInData);
      toast({
        title: "Signed in",
        description: "Your Supabase session is active on this device.",
      });
      onOpenChange(false);
      setSignInData({ email: "", password: "" });
    } catch (error) {
      toast({
        title: "Sign-in failed",
        description: error instanceof Error ? error.message : "Unable to sign in.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (signUpData.role === "owner" && !signUpData.businessName?.trim()) {
      toast({
        title: "Business name required",
        description: "Owner accounts should include the property business name.",
        variant: "destructive",
      });
      return;
    }

    if (
      signUpData.role === "student" &&
      selectedUniversity &&
      getEmailDomain(signUpData.email) !==
        selectedUniversity.emailDomain.trim().toLowerCase()
    ) {
      toast({
        title: "Use your university email",
        description: `Student verification for ${selectedUniversity.name} requires an @${selectedUniversity.emailDomain} account email.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signUp(signUpData);

      setSignUpData({
        role: "student",
        fullName: "",
        phone: "",
        email: "",
        password: "",
        universityId: "",
        studentNumber: "",
        roommateOptIn: false,
        businessName: "",
        businessRegistrationNumber: "",
      });

      if (result.needsEmailConfirmation) {
        setActiveTab("sign-in");
        toast({
          title: "Check your inbox",
          description:
            "Supabase created the account. Confirm your email, then sign in.",
        });
      } else {
        toast({
          title: "Account created",
          description: "Your profile was created automatically in Supabase.",
        });
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: "Sign-up failed",
        description:
          error instanceof Error ? error.message : "Unable to create the account.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);

    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "Your session was removed from this device.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Sign-out failed",
        description: error instanceof Error ? error.message : "Unable to sign out.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={() => onOpenChange(false)}
      title={
        isLoading && !user
          ? "Loading Account"
          : !isConfigured
            ? "Auth Not Configured"
            : user
              ? "Your Account"
              : "Student And Owner Access"
      }
      description={
        isLoading && !user
          ? "Checking your Supabase session and profile records."
          : !isConfigured
            ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or expose the EXPO_PUBLIC equivalents through Vite."
            : user
              ? "Supabase auth is active for this session."
              : "Use Supabase Auth for email/password sign-in and automatic profile creation. Student verification is based on the account email domain after that email is confirmed."
      }
    >
      {isLoading && !user ? (
        <div className="flex items-center gap-3 py-4">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm opacity-70">Preparing auth state...</span>
        </div>
      ) : null}

      {!isLoading && !isConfigured ? (
        <div
          className="rounded-sm border px-4 py-3 text-sm opacity-70"
          style={{
            backgroundColor: "var(--color-secondary)",
            borderColor: "var(--color-border)",
          }}
        >
          Browser auth uses the public anon key. Keep the service role key on the
          server only.
        </div>
      ) : null}

      {!isLoading && isConfigured && user ? (
        <div className="space-y-4">
          <div
            className="space-y-4 rounded-sm border p-5"
            style={{
              backgroundColor: "var(--color-secondary)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-2xl font-bold leading-tight">
                  {displayName}
                </p>
                <p className="mt-1 text-sm opacity-60">{user.email}</p>
              </div>
              <div className="rounded-full bg-primary px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-primary-foreground">
                {prettifyRole(profile?.appUser.role)}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                  Phone
                </p>
                <p className="mt-1 opacity-80">{profile?.appUser.phone || "Not set"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                  Verification
                </p>
                <p className="mt-1 opacity-80">{verificationLabel || "N/A"}</p>
              </div>
              {profile?.studentProfile ? (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                    University Email
                  </p>
                  <p className="mt-1 opacity-80">
                    {profile.studentProfile.universityEmail || "Not set"}
                  </p>
                </div>
              ) : null}
              {profile?.ownerProfile ? (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                    Business Name
                  </p>
                  <p className="mt-1 opacity-80">
                    {profile.ownerProfile.businessName || "Not set"}
                  </p>
                </div>
              ) : null}
            </div>

            {!profile ? (
              <p className="text-xs font-mono uppercase tracking-wider text-primary">
                Signed in, but the app profile record is missing.
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={handleSignOut}
            disabled={isSubmitting}
            className="h-12 w-full rounded-sm font-display font-bold uppercase tracking-widest"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Working...
              </span>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Sign Out
              </>
            )}
          </Button>
        </div>
      ) : null}

      {!isLoading && isConfigured && !user ? (
        <>
          <div
            className="grid w-full grid-cols-2 rounded-sm p-1"
            style={{ backgroundColor: "var(--color-secondary)" }}
          >
            <button
              type="button"
              className={cn(
                "h-10 rounded-sm text-sm font-medium transition-colors",
                activeTab === "sign-in" && "shadow-sm",
              )}
              style={
                activeTab === "sign-in"
                  ? { backgroundColor: "var(--color-card)" }
                  : undefined
              }
              onClick={() => setActiveTab("sign-in")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={cn(
                "h-10 rounded-sm text-sm font-medium transition-colors",
                activeTab === "sign-up" && "shadow-sm",
              )}
              style={
                activeTab === "sign-up"
                  ? { backgroundColor: "var(--color-card)" }
                  : undefined
              }
              onClick={() => setActiveTab("sign-up")}
            >
              Create Account
            </button>
          </div>

          {activeTab === "sign-in" ? (
            <form className="mt-5 space-y-4" onSubmit={handleSignInSubmit}>
              <div>
                <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
                <Input
                  id="sign-in-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={signInData.email}
                  onChange={(event) =>
                    setSignInData((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-11 border"
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    borderColor: "var(--color-border)",
                  }}
                />
              </div>

              <div>
                <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
                <Input
                  id="sign-in-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={signInData.password}
                  onChange={(event) =>
                    setSignInData((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-11 border"
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    borderColor: "var(--color-border)",
                  }}
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="h-12 w-full rounded-sm font-display font-bold uppercase tracking-widest"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Signing In...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={handleSignUpSubmit}>
              <div className="space-y-2">
                <FieldLabel>Account Type</FieldLabel>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(Object.keys(roleCopy) as RegistrationRole[]).map((role) => {
                    const Icon = roleCopy[role].icon;

                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() =>
                          setSignUpData((current) => ({ ...current, role }))
                        }
                        className={cn(
                          "rounded-sm border px-4 py-3 text-left transition-colors",
                          signUpData.role === role
                            ? "border-primary bg-primary/10"
                            : "hover:bg-secondary/80",
                        )}
                        style={{
                          borderColor:
                            signUpData.role === role
                              ? "var(--color-primary)"
                              : "var(--color-border)",
                          backgroundColor:
                            signUpData.role === role
                              ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                              : "var(--color-secondary)",
                        }}
                      >
                        <div className="flex items-center gap-2 text-sm font-display font-bold uppercase">
                          <Icon className="h-4 w-4 text-primary" />
                          {roleCopy[role].label}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed opacity-60">
                          {roleCopy[role].subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="sign-up-name">Full Name</FieldLabel>
                  <Input
                    id="sign-up-name"
                    autoComplete="name"
                    required
                    value={signUpData.fullName}
                    onChange={(event) =>
                      setSignUpData((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 border"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="sign-up-phone">Phone</FieldLabel>
                  <Input
                    id="sign-up-phone"
                    autoComplete="tel"
                    value={signUpData.phone}
                    onChange={(event) =>
                      setSignUpData((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 border"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="sign-up-email">
                    {signUpData.role === "student" ? "University Email" : "Email"}
                  </FieldLabel>
                  <Input
                    id="sign-up-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={signUpData.email}
                    onChange={(event) =>
                      setSignUpData((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 border"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
                  <Input
                    id="sign-up-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={signUpData.password}
                    onChange={(event) =>
                      setSignUpData((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-11 border"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  />
                </div>
              </div>

              {signUpData.role === "student" ? (
                <div
                  className="space-y-4 rounded-sm border p-4"
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="sign-up-student-number">
                        Student Number
                      </FieldLabel>
                      <Input
                        id="sign-up-student-number"
                        value={signUpData.studentNumber}
                        onChange={(event) =>
                          setSignUpData((current) => ({
                            ...current,
                            studentNumber: event.target.value,
                          }))
                        }
                        className="mt-1.5 h-11 border"
                        style={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                        }}
                      />
                    </div>

                    <div>
                      <FieldLabel htmlFor="sign-up-university">University</FieldLabel>
                      <select
                        id="sign-up-university"
                        value={signUpData.universityId || ""}
                        onChange={(event) =>
                          setSignUpData((current) => ({
                            ...current,
                            universityId: event.target.value,
                          }))
                        }
                        className="mt-1.5 h-11 w-full rounded-md border px-3 text-sm"
                        style={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        <option value="">
                          {isLoadingUniversities
                            ? "Loading universities..."
                            : "Not listed yet"}
                        </option>
                        {universities.map((university) => (
                          <option key={university.id} value={university.id}>
                            {university.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed opacity-60">
                    Use your actual university account email above. The app marks
                    student accounts as verified only after the email domain matches
                    the selected university and the address has been confirmed
                    through Supabase.
                  </p>

                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      id="sign-up-roommate"
                      type="checkbox"
                      checked={Boolean(signUpData.roommateOptIn)}
                      onChange={(event) =>
                        setSignUpData((current) => ({
                          ...current,
                          roommateOptIn: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <div>
                      <span className="text-sm opacity-80">
                        Enable roommate profile
                      </span>
                      <p className="mt-1 text-xs leading-relaxed opacity-55">
                        This creates your roommate-matching profile row at signup
                        time so you can add study and sleep preferences later.
                      </p>
                    </div>
                  </label>

                  {universities.length === 0 && !isLoadingUniversities ? (
                    <p className="text-xs font-mono uppercase tracking-wider opacity-55">
                      University verification stays pending until the
                      `universities` table has matching domains.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {signUpData.role === "owner" ? (
                <div
                  className="grid grid-cols-1 gap-4 rounded-sm border p-4 sm:grid-cols-2"
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div>
                    <FieldLabel htmlFor="sign-up-business-name">
                      Business Name
                    </FieldLabel>
                    <Input
                      id="sign-up-business-name"
                      required
                      value={signUpData.businessName}
                      onChange={(event) =>
                        setSignUpData((current) => ({
                          ...current,
                          businessName: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-11 border"
                      style={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                      }}
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="sign-up-business-registration">
                      Registration Number
                    </FieldLabel>
                    <Input
                      id="sign-up-business-registration"
                      value={signUpData.businessRegistrationNumber}
                      onChange={(event) =>
                        setSignUpData((current) => ({
                          ...current,
                          businessRegistrationNumber: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-11 border"
                      style={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                      }}
                    />
                  </div>
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="h-12 w-full rounded-sm font-display font-bold uppercase tracking-widest"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Creating Account...
                  </span>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          )}
        </>
      ) : null}
    </ModalShell>
  );
}
