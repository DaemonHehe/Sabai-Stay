import { lazy, Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { RouteSkeleton } from "@/components/page-skeletons";

const Home = lazy(() => import("@/pages/home"));
const ListView = lazy(() => import("@/pages/list-view"));
const ListingDetails = lazy(() => import("@/pages/listing-details"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const InfoPage = lazy(() => import("@/pages/info-page"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const ServerError = lazy(() => import("@/pages/server-error"));
const NotFound = lazy(() => import("@/pages/not-found"));

function RouteFallback() {
  return <RouteSkeleton />;
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/list" component={ListView} />
        <Route path="/listing/:id" component={ListingDetails} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/help" component={InfoPage} />
        <Route path="/contact" component={InfoPage} />
        <Route path="/faq" component={InfoPage} />
        <Route path="/privacy" component={InfoPage} />
        <Route path="/terms" component={InfoPage} />
        <Route path="/500" component={ServerError} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function SessionExpiryNotifier() {
  useEffect(() => {
    const handler = () => {
      toast({
        title: "Session expired",
        description: "Please sign in again to continue.",
        variant: "destructive",
      });
    };

    window.addEventListener("sabai:session-expired", handler);
    return () => {
      window.removeEventListener("sabai:session-expired", handler);
    };
  }, []);

  return null;
}

function AuthRedirectNotifier() {
  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";

    if (!hash) {
      return;
    }

    const params = new URLSearchParams(hash);
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");
    const isRecoveryLink = params.get("type") === "recovery";

    if (isRecoveryLink && window.location.pathname !== "/reset-password") {
      window.location.replace(`/reset-password#${hash}`);
      return;
    }

    if (errorCode) {
      window.sessionStorage.setItem("sabai:open-auth-dialog", "true");
      window.setTimeout(() => {
        toast({
          title:
            errorCode === "otp_expired"
              ? "Reset link expired"
              : "Reset link failed",
          description:
            errorDescription?.replace(/\+/g, " ") ??
            "Please request a fresh password reset link.",
          variant: "destructive",
        });
        window.dispatchEvent(new Event("sabai:open-auth-dialog"));
      }, 100);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <SessionExpiryNotifier />
        <Toaster />
        <AuthRedirectNotifier />
        <Router />
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
