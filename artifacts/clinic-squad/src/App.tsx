import { useGuardedLocation } from "@/lib/guarded-location";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { LangProvider } from "@/lib/lang";
import { CurrencyProvider } from "@/lib/currency";

import { lazy, Suspense } from "react";
import LandingPage from "@/pages/landing";

const LoginPage = lazy(() => import("@/pages/login"));
const RegisterPage = lazy(() => import("@/pages/register"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const ResendVerificationPage = lazy(() => import("@/pages/resend-verification"));
const PendingActivationPage = lazy(() => import("@/pages/pending-activation"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const PatientsPage = lazy(() => import("@/pages/patients"));
const PatientDetailPage = lazy(() => import("@/pages/patient-detail"));
const WaitingListPage = lazy(() => import("@/pages/waiting-list"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const AppointmentsPage = lazy(() => import("@/pages/appointments"));
const FinancesPage = lazy(() => import("@/pages/finances"));
const SubscriptionPage = lazy(() => import("@/pages/subscription"));
const SubscriptionExpiredPage = lazy(() => import("@/pages/subscription-expired"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const AdminPage = lazy(() => import("@/pages/admin"));
const PlatformFinancesPage = lazy(() => import("@/pages/platform-finances"));
const PlatformClinicsPage = lazy(() => import("@/pages/platform-clinics"));
const PlatformClinicDetailPage = lazy(() => import("@/pages/platform-clinic-detail"));
const PlatformPaymentsPage = lazy(() => import("@/pages/platform-payments"));
const PlatformSettingsPage = lazy(() => import("@/pages/platform-settings"));
const PlatformGrowthPage = lazy(() => import("@/pages/platform-growth"));
const PlatformLogsPage = lazy(() => import("@/pages/platform-logs"));
const InsightsPage = lazy(() => import("@/pages/insights"));
const TeamPage = lazy(() => import("@/pages/team"));
const PrescriptionsPage = lazy(() => import("@/pages/prescriptions"));
const AcceptInvitePage = lazy(() => import("@/pages/accept-invite"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/resend-verification" component={ResendVerificationPage} />
      <Route path="/pending-activation" component={PendingActivationPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/patients" component={PatientsPage} />
      <Route path="/patients/:id" component={PatientDetailPage} />
      <Route path="/waiting-list" component={WaitingListPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/appointments" component={AppointmentsPage} />
      <Route path="/finances" component={FinancesPage} />
      <Route path="/subscription/expired" component={SubscriptionExpiredPage} />
      <Route path="/subscription" component={SubscriptionPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/insights" component={InsightsPage} />
      <Route path="/team" component={TeamPage} />
      <Route path="/prescriptions" component={PrescriptionsPage} />
      <Route path="/invite/:token" component={AcceptInvitePage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/platform-finances" component={PlatformFinancesPage} />
      <Route path="/platform-clinics" component={PlatformClinicsPage} />
      <Route
        path="/platform-clinics/:clinicId"
        component={PlatformClinicDetailPage}
      />
      <Route path="/platform-payments" component={PlatformPaymentsPage} />
      <Route path="/platform-settings" component={PlatformSettingsPage} />
      <Route path="/platform-growth" component={PlatformGrowthPage} />
      <Route path="/platform-logs" component={PlatformLogsPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LangProvider>
          <CurrencyProvider>
            <AuthProvider>
              <TooltipProvider>
                <WouterRouter
                  hook={useGuardedLocation}
                  base={import.meta.env.BASE_URL.replace(/\/$/, "")}
                >
                  <Router />
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </AuthProvider>
          </CurrencyProvider>
        </LangProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
