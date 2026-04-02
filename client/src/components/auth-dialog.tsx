import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, GraduationCap, LoaderCircle, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function getInitials(value: string | null | undefined) {
  if (!value) {
    return "U";
  }

  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

function prettifyRole(role: string | undefined) {
  if (role === "owner") {
    return "Apartment Owner";
  }

  if (role === "student") {
    return "Student";
  }

  if (role === "admin") {
    return "Admin";
  }

  return "Account";
}

export function AuthDialog() {
  const { toast } = useToast();
  const {
    isConfigured,
    isLoading,
    user,
    profile,
    signIn,
    signUp,
    signOut,
  } = useAuth();
  const [open, setOpen] = useState(false);
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
    universityEmail: "",
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
      setOpen(false);
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

    if (signUpData.role === "student" && !signUpData.universityEmail?.trim()) {
      toast({
        title: "University email required",
        description: "Student accounts should include a university email.",
        variant: "destructive",
      });
      return;
    }

    if (signUpData.role === "owner" && !signUpData.businessName?.trim()) {
      toast({
        title: "Business name required",
        description: "Owner accounts should include the property business name.",
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
        universityEmail: "",
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
        setOpen(false);
      }
    } catch (error) {
      toast({
        title: "Sign-up failed",
        description: error instanceof Error ? error.message : "Unable to create the account.",
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
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="h-10 min-w-10 sm:min-w-[10rem] rounded-full bg-secondary/50 border px-3 flex items-center justify-center sm:justify-start gap-2 hover:bg-secondary transition-colors"
          style={{ borderColor: "var(--color-border)" }}
          type="button"
        >
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary">
            {isLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : user ? (
              <span className="text-[11px] font-mono font-bold">
                {getInitials(displayName)}
              </span>
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>
          <span className="hidden sm:block text-[11px] font-mono uppercase tracking-wider opacity-70">
            {user ? prettifyRole(profile?.appUser.role) : "Sign In"}
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        className="border max-w-lg"
        style={{
          backgroundColor: "var(--color-card)",
          borderColor: "var(--color-border)",
        }}
      >
        {isLoading && !user && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl uppercase">
                Loading Account
              </DialogTitle>
              <DialogDescription className="opacity-60">
                Checking your Supabase session and profile records.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 py-4">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm opacity-70">Preparing auth state...</span>
            </div>
          </>
        )}

        {!isLoading && !isConfigured && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl uppercase">
                Auth Not Configured
              </DialogTitle>
              <DialogDescription className="opacity-60">
                Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, or expose
                the `EXPO_PUBLIC` equivalents through Vite.
              </DialogDescription>
            </DialogHeader>
            <div
              className="border rounded-sm px-4 py-3 text-sm opacity-70"
              style={{
                backgroundColor: "var(--color-secondary)",
                borderColor: "var(--color-border)",
              }}
            >
              Browser auth uses the public anon key. Keep the service role key on
              the server only.
            </div>
          </>
        )}

        {!isLoading && isConfigured && user && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl uppercase">
                Your Account
              </DialogTitle>
              <DialogDescription className="opacity-60">
                Supabase auth is active for this session.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div
                className="border rounded-sm p-5 space-y-4"
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
                    <p className="text-sm opacity-60 mt-1">{user.email}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-[0.2em]">
                    {prettifyRole(profile?.appUser.role)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                      Phone
                    </p>
                    <p className="mt-1 opacity-80">
                      {profile?.appUser.phone || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                      Verification
                    </p>
                    <p className="mt-1 opacity-80">{verificationLabel || "N/A"}</p>
                  </div>
                  {profile?.studentProfile && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                        University Email
                      </p>
                      <p className="mt-1 opacity-80">
                        {profile.studentProfile.universityEmail || "Not set"}
                      </p>
                    </div>
                  )}
                  {profile?.ownerProfile && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                        Business Name
                      </p>
                      <p className="mt-1 opacity-80">
                        {profile.ownerProfile.businessName || "Not set"}
                      </p>
                    </div>
                  )}
                </div>

                {!profile && (
                  <p className="text-xs font-mono text-primary uppercase tracking-wider">
                    Signed in, but the app profile record is missing.
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleSignOut}
                disabled={isSubmitting}
                className="w-full h-12 font-display font-bold uppercase tracking-widest rounded-sm"
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
          </>
        )}

        {!isLoading && isConfigured && !user && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl uppercase">
                Student And Owner Access
              </DialogTitle>
              <DialogDescription className="opacity-60">
                Use Supabase Auth for email/password sign-in and automatic
                profile creation.
              </DialogDescription>
            </DialogHeader>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "sign-in" | "sign-up")}
              className="mt-2"
            >
              <TabsList
                className="grid grid-cols-2 w-full"
                style={{ backgroundColor: "var(--color-secondary)" }}
              >
                <TabsTrigger value="sign-in">Sign In</TabsTrigger>
                <TabsTrigger value="sign-up">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="sign-in" className="mt-5">
                <form className="space-y-4" onSubmit={handleSignInSubmit}>
                  <div>
                    <Label htmlFor="sign-in-email" className="opacity-80 text-sm">
                      Email
                    </Label>
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
                      className="border mt-1.5 h-11"
                      style={{
                        backgroundColor: "var(--color-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                    />
                  </div>

                  <div>
                    <Label htmlFor="sign-in-password" className="opacity-80 text-sm">
                      Password
                    </Label>
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
                      className="border mt-1.5 h-11"
                      style={{
                        backgroundColor: "var(--color-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="w-full h-12 font-display font-bold uppercase tracking-widest rounded-sm"
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
              </TabsContent>

              <TabsContent value="sign-up" className="mt-5">
                <form className="space-y-4" onSubmit={handleSignUpSubmit}>
                  <div className="space-y-2">
                    <Label className="opacity-80 text-sm">Account Type</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                              "border rounded-sm px-4 py-3 text-left transition-colors",
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
                            <p className="text-xs opacity-60 mt-2 leading-relaxed">
                              {roleCopy[role].subtitle}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sign-up-name" className="opacity-80 text-sm">
                        Full Name
                      </Label>
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
                        className="border mt-1.5 h-11"
                        style={{
                          backgroundColor: "var(--color-secondary)",
                          borderColor: "var(--color-border)",
                        }}
                      />
                    </div>

                    <div>
                      <Label htmlFor="sign-up-phone" className="opacity-80 text-sm">
                        Phone
                      </Label>
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
                        className="border mt-1.5 h-11"
                        style={{
                          backgroundColor: "var(--color-secondary)",
                          borderColor: "var(--color-border)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sign-up-email" className="opacity-80 text-sm">
                        Email
                      </Label>
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
                        className="border mt-1.5 h-11"
                        style={{
                          backgroundColor: "var(--color-secondary)",
                          borderColor: "var(--color-border)",
                        }}
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="sign-up-password"
                        className="opacity-80 text-sm"
                      >
                        Password
                      </Label>
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
                        className="border mt-1.5 h-11"
                        style={{
                          backgroundColor: "var(--color-secondary)",
                          borderColor: "var(--color-border)",
                        }}
                      />
                    </div>
                  </div>

                  {signUpData.role === "student" && (
                    <div
                      className="border rounded-sm p-4 space-y-4"
                      style={{
                        backgroundColor: "var(--color-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Label
                            htmlFor="sign-up-university-email"
                            className="opacity-80 text-sm"
                          >
                            University Email
                          </Label>
                          <Input
                            id="sign-up-university-email"
                            type="email"
                            value={signUpData.universityEmail}
                            onChange={(event) =>
                              setSignUpData((current) => ({
                                ...current,
                                universityEmail: event.target.value,
                              }))
                            }
                            className="border mt-1.5 h-11"
                            style={{
                              backgroundColor: "var(--color-card)",
                              borderColor: "var(--color-border)",
                            }}
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor="sign-up-student-number"
                            className="opacity-80 text-sm"
                          >
                            Student Number
                          </Label>
                          <Input
                            id="sign-up-student-number"
                            value={signUpData.studentNumber}
                            onChange={(event) =>
                              setSignUpData((current) => ({
                                ...current,
                                studentNumber: event.target.value,
                              }))
                            }
                            className="border mt-1.5 h-11"
                            style={{
                              backgroundColor: "var(--color-card)",
                              borderColor: "var(--color-border)",
                            }}
                          />
                        </div>

                        <div>
                          <Label className="opacity-80 text-sm">University</Label>
                          <Select
                            value={signUpData.universityId || "none"}
                            onValueChange={(value) =>
                              setSignUpData((current) => ({
                                ...current,
                                universityId: value === "none" ? "" : value,
                              }))
                            }
                          >
                            <SelectTrigger
                              className="mt-1.5 h-11"
                              style={{
                                backgroundColor: "var(--color-card)",
                                borderColor: "var(--color-border)",
                              }}
                            >
                              <SelectValue
                                placeholder={
                                  isLoadingUniversities
                                    ? "Loading universities..."
                                    : "Select a university"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not listed yet</SelectItem>
                              {universities.map((university) => (
                                <SelectItem
                                  key={university.id}
                                  value={university.id}
                                >
                                  {university.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="sign-up-roommate"
                          checked={Boolean(signUpData.roommateOptIn)}
                          onCheckedChange={(checked) =>
                            setSignUpData((current) => ({
                              ...current,
                              roommateOptIn: checked === true,
                            }))
                          }
                          className="mt-1"
                        />
                        <div>
                          <Label
                            htmlFor="sign-up-roommate"
                            className="text-sm opacity-80"
                          >
                            Enable roommate profile
                          </Label>
                          <p className="text-xs opacity-55 mt-1 leading-relaxed">
                            This creates the roommate-matching profile row at signup
                            time so you can add study and sleep preferences later.
                          </p>
                        </div>
                      </div>

                      {universities.length === 0 && !isLoadingUniversities && (
                        <p className="text-xs font-mono opacity-55 uppercase tracking-wider">
                          University verification stays pending until the
                          `universities` table has matching domains.
                        </p>
                      )}
                    </div>
                  )}

                  {signUpData.role === "owner" && (
                    <div
                      className="border rounded-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
                      style={{
                        backgroundColor: "var(--color-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div>
                        <Label
                          htmlFor="sign-up-business-name"
                          className="opacity-80 text-sm"
                        >
                          Business Name
                        </Label>
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
                          className="border mt-1.5 h-11"
                          style={{
                            backgroundColor: "var(--color-card)",
                            borderColor: "var(--color-border)",
                          }}
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor="sign-up-business-registration"
                          className="opacity-80 text-sm"
                        >
                          Registration Number
                        </Label>
                        <Input
                          id="sign-up-business-registration"
                          value={signUpData.businessRegistrationNumber}
                          onChange={(event) =>
                            setSignUpData((current) => ({
                              ...current,
                              businessRegistrationNumber: event.target.value,
                            }))
                          }
                          className="border mt-1.5 h-11"
                          style={{
                            backgroundColor: "var(--color-card)",
                            borderColor: "var(--color-border)",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="w-full h-12 font-display font-bold uppercase tracking-widest rounded-sm"
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
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
