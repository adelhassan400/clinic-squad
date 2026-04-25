import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLang } from "@/lib/lang";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getTrialDaysLeft, getTrialUrgency } from "@/lib/utils";
import {
  LayoutDashboard, Users, Calendar, TrendingUp,
  Settings, LogOut, Menu, X, Sun, Moon,
  AlertTriangle, Crown, ChevronRight, Shield, BarChart2, UserPlus, Pill
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
}

export function DashboardLayout({ children }: Props) {
  const { user, clinic, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLang();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const navItems = [
    { href: "/dashboard", labelKey: "sidebar.dashboard", icon: LayoutDashboard },
    { href: "/patients", labelKey: "sidebar.patients", icon: Users },
    { href: "/appointments", labelKey: "sidebar.appointments", icon: Calendar },
    ...(isAdmin
      ? [
          { href: "/prescriptions", labelKey: "sidebar.prescriptions", icon: Pill },
          { href: "/insights", labelKey: "sidebar.insights", icon: BarChart2 },
          { href: "/finances", labelKey: "sidebar.finances", icon: TrendingUp },
        ]
      : []),
    { href: "/settings", labelKey: "sidebar.settings", icon: Settings },
  ];

  const trialDaysLeft = clinic?.subscriptionStatus === "trial"
    ? getTrialDaysLeft(clinic.trialEndDate)
    : null;
  const urgency = trialDaysLeft !== null ? getTrialUrgency(trialDaysLeft) : null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 start-0 z-30 w-64 flex flex-col bg-sidebar border-e border-sidebar-border transition-transform duration-300 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-serif font-bold text-sidebar-foreground text-lg">ClinicSquad</span>
          <Button
            variant="ghost"
            size="icon"
            className="ms-auto text-sidebar-foreground lg:hidden hover:bg-sidebar-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Clinic info */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wider mb-1">{t("sidebar.clinic")}</p>
          <p className="text-sm font-semibold text-sidebar-foreground truncate">{clinic?.name}</p>
          <div className="mt-2 flex items-center gap-2">
            {clinic?.subscriptionStatus === "trial" && (
              <Badge className={cn(
                "text-xs",
                urgency === "danger" ? "bg-destructive text-destructive-foreground" :
                urgency === "warning" ? "bg-accent text-accent-foreground" :
                "bg-primary text-primary-foreground"
              )}>
                {trialDaysLeft}{t("common.trialLeft")}
              </Badge>
            )}
            {clinic?.subscriptionStatus === "basic" && (
              <Badge className="bg-secondary text-secondary-foreground text-xs">Basic</Badge>
            )}
            {clinic?.subscriptionStatus === "premium" && (
              <Badge className="bg-accent text-accent-foreground text-xs">
                <Crown className="w-3 h-3 me-1" />Premium
              </Badge>
            )}
            {clinic?.subscriptionStatus === "expired" && (
              <Badge className="bg-destructive text-destructive-foreground text-xs">{t("common.subExpired")}</Badge>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, labelKey, icon: Icon }) => {
            const isPremiumOnly = href === "/insights" || href === "/prescriptions";
            const isLocked = isPremiumOnly && clinic?.subscriptionStatus !== "premium";
            const isActive = location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${labelKey.split(".")[1]}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{t(labelKey)}</span>
                {isLocked && <Crown className="w-3 h-3 text-accent" />}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/team"
              data-testid="nav-team"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                location.startsWith("/team")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <UserPlus className="w-4 h-4" />
              <span className="flex-1">{t("sidebar.team")}</span>
            </Link>
          )}

          {user?.role === "superadmin" && (
            <Link
              href="/admin"
              data-testid="nav-admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                location.startsWith("/admin")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Shield className="w-4 h-4" />
              <span className="flex-1">{t("sidebar.admin")}</span>
            </Link>
          )}
        </nav>

        {/* Trial warning banner */}
        {clinic?.subscriptionStatus === "trial" && urgency !== "safe" && (
          <div className={cn(
            "mx-3 mb-2 p-3 rounded-lg text-xs",
            urgency === "danger" ? "bg-destructive/20 text-destructive border border-destructive/30" :
            "bg-accent/20 text-accent-foreground border border-accent/30"
          )}>
            <div className="flex items-center gap-2 font-semibold mb-1">
              <AlertTriangle className="w-3 h-3" />
              {t("common.trialExpires")} {trialDaysLeft} {trialDaysLeft === 1 ? t("common.day") : t("common.days")}
            </div>
            <Link href="/subscription" className="flex items-center gap-1 hover:underline font-medium">
              {t("common.upgradeNow")} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* User */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{user?.role}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-2 px-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={toggleTheme}
              data-testid="toggle-theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground text-xs"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="w-3 h-3 me-2" />
              {t("sidebar.signOut")}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />

          {/* Language switcher always visible in top bar */}
          <LanguageSwitcher />

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hidden lg:flex"
            data-testid="toggle-theme-topbar"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {clinic?.subscriptionStatus === "trial" && (
            <Link href="/subscription">
              <Button size="sm" variant="outline" className="text-xs border-primary/30 text-primary hover:bg-primary/10">
                <Crown className="w-3 h-3 me-1.5" />
                {t("common.upgradePlan")}
              </Button>
            </Link>
          )}
          {clinic?.subscriptionStatus === "expired" && (
            <Link href="/subscription/expired">
              <Button size="sm" variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 me-1.5" />
                {t("common.subExpired")}
              </Button>
            </Link>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
