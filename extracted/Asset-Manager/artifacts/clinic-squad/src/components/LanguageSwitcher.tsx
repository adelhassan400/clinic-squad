import { useLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  variant?: "ghost" | "outline";
  size?: "sm" | "default" | "icon";
  sidebar?: boolean;
}

export function LanguageSwitcher({ className, variant = "ghost", sidebar = false }: Props) {
  const { lang, setLang } = useLang();

  return (
    <button
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      data-testid="toggle-lang"
      aria-label={lang === "en" ? "Switch to Arabic" : "Switch to English"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors select-none",
        sidebar
          ? "border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          : "border-border text-foreground/70 hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <span className={cn("opacity-100 transition-opacity", lang === "en" ? "font-bold text-foreground" : "opacity-50")}>EN</span>
      <span className="opacity-30">/</span>
      <span className={cn("transition-opacity", lang === "ar" ? "font-bold text-foreground" : "opacity-50")}>عر</span>
    </button>
  );
}
