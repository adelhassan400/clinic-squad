import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { LangProvider } from "@/lib/lang";
import { CurrencyProvider } from "@/lib/currency";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import ResendVerificationPage from "@/pages/resend-verification";
import DashboardPage from "@/pages/dashboard";
import PatientsPage from "@/pages/patients";
import PatientDetailPage from "@/pages/patient-detail";
import AppointmentsPage from "@/pages/appointments";
import FinancesPage from "@/pages/finances";
import SubscriptionPage from "@/pages/subscription";
import SubscriptionExpiredPage from "@/pages/subscription-expired";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import InsightsPage from "@/pages/insights";
import TeamPage from "@/pages/team";
import PrescriptionsPage from "@/pages/prescriptions";
import AcceptInvitePage from "@/pages/accept-invite";
import NotFound from "@/pages/not-found";

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
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/resend-verification" component={ResendVerificationPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/patients" component={PatientsPage} />
      <Route path="/patients/:id" component={PatientDetailPage} />
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
      <Route component={NotFound} />
    </Switch>
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
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
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
