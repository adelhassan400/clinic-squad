import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { useLang } from "@/lib/lang";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Shield, Users, Calendar, TrendingUp, CheckCircle,
  ArrowRight, Sun, Moon, Zap, Lock, Globe, PhoneCall,
  UserPlus, Settings as SettingsIcon, ClipboardList, BarChart3
} from "lucide-react";

const screens = [
  { id: "dashboard", en: "Dashboard", ar: "لوحة التحكم" },
  { id: "queue", en: "Waiting list", ar: "قائمة الانتظار" },
  { id: "patient", en: "Patient file", ar: "ملف المريض" },
  { id: "demo", en: "Short demo", ar: "عرض سريع" },
] as const;

const faqs = [
  {
    q: { en: "How does the free trial work?", ar: "إزاي بتشتغل التجربة المجانية؟" },
    a: { en: "You get 15 days free and no credit card is needed. After you register, our team reviews your request and activates your account.", ar: "بتاخد 15 يوم مجاناً من غير كارت بنكي. بعد التسجيل فريقنا بيراجع طلبك وبيفعّل حسابك." },
  },
  {
    q: { en: "Is my patients' data safe?", ar: "بيانات مرضاي في أمان؟" },
    a: { en: "Passwords are stored hashed, access is controlled by role, and the nightly backups are encrypted. No system is perfectly secure, so please read our Privacy Policy for the details.", ar: "كلمات المرور بتتخزن مشفّرة، والصلاحيات حسب الدور، والنسخ الاحتياطية الليلية مشفّرة. مفيش نظام آمن 100%، فاقرأ سياسة الخصوصية للتفاصيل." },
  },
  {
    q: { en: "How much does it cost?", ar: "السعر كام؟" },
    a: { en: "There are two plans, Basic and Premium, priced per month in EGP. See the pricing section above. The 15-day trial comes first.", ar: "فيه باقتين، الأساسية والمميزة، بسعر شهري بالجنيه. شوف قسم الأسعار فوق. وأول 15 يوم تجربة مجانية." },
  },
  {
    q: { en: "Is it OK for a small clinic?", ar: "مناسب لعيادة صغيرة؟" },
    a: { en: "Yes. The Basic plan covers up to 500 patients and 2 staff accounts, with patient records, ePrescription, a waiting list, appointments and basic finances.", ar: "أيوه. الباقة الأساسية بتشمل لحد 500 مريض وحسابين للموظفين، مع سجلات المرضى والوصفة الإلكترونية وقائمة الانتظار والمواعيد والمالية الأساسية." },
  },
  {
    q: { en: "Does it work in Arabic?", ar: "بيشتغل بالعربي؟" },
    a: { en: "Yes. The whole app works in Arabic (right to left) and English, and you can switch at any time.", ar: "أيوه. التطبيق كله بيشتغل بالعربي (من اليمين لليسار) والإنجليزي، وتقدر تبدّل في أي وقت." },
  },
  {
    q: { en: "Can I leave and delete my data?", ar: "أقدر أوقف وأمسح بياناتي؟" },
    a: { en: "Yes. You can stop at any time and ask us to close your account and delete your clinic's data. Message us on WhatsApp.", ar: "أيوه. تقدر توقف في أي وقت وتطلب قفل حسابك ومسح بيانات عيادتك. كلمنا على واتساب." },
  },
] as const;

const planFeatures = {
  basic: {
    en: ["Up to 500 patients", "Patient records & ePrescription", "Waiting list, check-in & checkout", "Standard appointment scheduling", "Basic financial tracking", "Staff accounts (2)", "Standard support"],
    ar: ["حتى 500 مريض", "سجلات المرضى والوصفات الإلكترونية", "قائمة الانتظار وتسجيل الدخول والخروج", "جدولة المواعيد الأساسية", "تتبع مالي أساسي", "حسابات الموظفين (2)", "دعم قياسي"],
  },
  premium: {
    en: ["Everything in Basic", "Insights & analytics", "Advanced reports", "Up to 10 staff accounts", "Priority support", "AI-ready modules (soon)"],
    ar: ["كل مزايا الباقة الأساسية", "الرؤى والتحليلات", "تقارير متقدمة", "حتى 10 حسابات للموظفين", "دعم ذو أولوية", "وحدات الذكاء الاصطناعي (قريباً)"],
  },
};

interface PublicPricing {
  basicMonthlyPrice: string;
  premiumMonthlyPrice: string;
  updatedAt: string | null;
}

// Prices always come from Platform Settings (/api/platform/public-pricing). There is no
// hard-coded number here, so a stale price can never show: while loading we show "...",
// and if the request fails we show "Contact us" instead of guessing.
function formatPlanPrice(value: string | undefined, state: "loading" | "error" | "ok", lang: string) {
  if (state === "loading") return "...";
  const price = value?.trim();
  if (state === "error" || !price) return lang === "ar" ? "تواصل معنا" : "Contact us";
  return /(?:EGP|جنيه|£|\$|€)/i.test(price) ? price : `${price} EGP`;
}

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { t, lang } = useLang();
  const [screen, setScreen] = useState<(typeof screens)[number]["id"]>("dashboard");
  const pricingQ = useQuery<PublicPricing>({
    queryKey: ["/api/platform/public-pricing"],
    queryFn: () => customFetch<PublicPricing>("/api/platform/public-pricing"),
    staleTime: 60_000,
  });

  const priceState: "loading" | "error" | "ok" = pricingQ.isError ? "error" : pricingQ.data ? "ok" : "loading";

  const features = [
    { icon: Users, titleKey: "feat.patients.title", descKey: "feat.patients.desc" },
    { icon: Calendar, titleKey: "feat.scheduling.title", descKey: "feat.scheduling.desc" },
    { icon: TrendingUp, titleKey: "feat.finance.title", descKey: "feat.finance.desc" },
    { icon: Zap, titleKey: "feat.realtime.title", descKey: "feat.realtime.desc" },
    { icon: Lock, titleKey: "feat.secure.title", descKey: "feat.secure.desc" },
    { icon: Globe, titleKey: "feat.bilingual.title", descKey: "feat.bilingual.desc" },
  ];

  const plans = [
    {
      nameKey: "pricing.basic.name",
      price: formatPlanPrice(pricingQ.data?.basicMonthlyPrice, priceState, lang),
      period: lang === "ar" ? "/شهر" : "/month",
      descKey: "pricing.basic.desc",
      features: planFeatures.basic[lang],
      highlighted: false,
    },
    {
      nameKey: "pricing.premium.name",
      price: formatPlanPrice(pricingQ.data?.premiumMonthlyPrice, priceState, lang),
      period: lang === "ar" ? "/شهر" : "/month",
      descKey: "pricing.premium.desc",
      features: planFeatures.premium[lang],
      highlighted: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center gap-2 sm:gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-lg">ClinicSquad</span>
          </div>
          <div className="hidden md:flex items-center gap-6 ms-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">{t("nav.howItWorks")}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t("nav.pricing")}</a>
          </div>
          <div className="ms-auto flex items-center gap-1 sm:gap-2 min-w-0">
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="toggle-theme-nav">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" data-testid="link-login">{t("nav.signIn")}</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" data-testid="link-register" className="hidden sm:flex">
                {t("nav.startTrial")}
                <ArrowRight className="w-3 h-3 ms-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 text-sm px-4 py-1.5">
          {t("hero.badge")}
        </Badge>
        <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 leading-tight">
          {t("hero.title1")}
          <span className="text-primary"> {t("hero.title2")}</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          {t("hero.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="text-base px-8" data-testid="hero-cta-primary">
              {t("hero.cta1")}
              <ArrowRight className="w-4 h-4 ms-2" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-base px-8" data-testid="hero-cta-secondary">
              {t("hero.cta2")}
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          {[
            { value: "15 " + (lang === "ar" ? "يوم" : "Days"), key: "hero.stat.trial" },
            { value: "500", key: "hero.stat.patients" },
            { value: "AR/عربي", key: "hero.stat.langs" },
          ].map(({ value, key }) => (
            <div key={key} className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">{value}</div>
              <div className="text-sm text-muted-foreground">{t(key)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Product screens */}
      <section id="screens" className="bg-primary/5 border-t border-border py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-3">{lang === "ar" ? "شوف النظام من جوّه" : "See it in action"}</h2>
          <p className="text-muted-foreground">
            {lang === "ar" ? "صور حقيقية من النظام ببيانات تجريبية." : "Real screens from the app, with sample data."}
          </p>
        </div>
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {screens.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={screen === s.id ? "default" : "outline"}
              onClick={() => setScreen(s.id)}
              data-testid={`screen-tab-${s.id}`}
            >
              {s[lang]}
            </Button>
          ))}
        </div>
        <div className="rounded-xl border border-border overflow-hidden shadow-lg bg-card">
          {screen === "demo" ? (
            <video
              key={lang}
              src={`/screens/demo-${lang}.mp4`}
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="metadata"
              className="w-full h-auto block"
              data-testid="screen-video"
            />
          ) : (
            <img
              src={`/screens/${screen}-${lang}.webp`}
              alt={screens.find((s) => s.id === screen)![lang]}
              width={1360}
              height={820}
              loading="lazy"
              className="w-full h-auto block"
              data-testid="screen-image"
            />
          )}
        </div>
      </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-card border-y border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("feat.title")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("feat.subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="p-6 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{t(titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("how.title")}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("how.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { num: "01", icon: UserPlus, titleKey: "how.step1.title", descKey: "how.step1.desc" },
            { num: "02", icon: SettingsIcon, titleKey: "how.step2.title", descKey: "how.step2.desc" },
            { num: "03", icon: ClipboardList, titleKey: "how.step3.title", descKey: "how.step3.desc" },
            { num: "04", icon: BarChart3, titleKey: "how.step4.title", descKey: "how.step4.desc" },
          ].map(({ num, icon: Icon, titleKey, descKey }, idx) => (
            <div
              key={num}
              className="relative p-6 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
              data-testid={`how-step-${idx + 1}`}
            >
              <span className="absolute top-4 end-4 text-4xl font-serif font-bold text-primary/20 leading-none select-none">
                {num}
              </span>
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{t(titleKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-card border-y border-border py-20"><div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("pricing.title")}</h2>
          <p className="text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.nameKey}
              className={`p-8 rounded-2xl border-2 flex flex-col ${
                plan.highlighted ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              {plan.highlighted && (
                <Badge className="self-start mb-4 bg-primary text-primary-foreground">{t("pricing.popular")}</Badge>
              )}
              <h3 className="text-xl font-bold mb-1">{t(plan.nameKey)}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t(plan.descKey)}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                  {t("pricing.cta")}
                </Button>
              </Link>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 max-w-3xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-serif font-bold mb-8 text-center">{lang === "ar" ? "أسئلة شائعة" : "Frequently asked questions"}</h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details key={i} className="group rounded-xl border border-border bg-card px-5 py-4" data-testid={`faq-${i}`}>
              <summary className="cursor-pointer list-none font-semibold flex items-center justify-between gap-4">
                {f.q[lang]}
                <span className="text-primary text-xl leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-muted-foreground leading-relaxed">{f.a[lang]}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/10 border-t border-primary/20">
      <div className="py-24 max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
          {t("cta.title")}
        </h2>
        <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
          {t("cta.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="text-base px-10">
              {t("cta.btn1")}
              <ArrowRight className="w-4 h-4 ms-2" />
            </Button>
          </Link>
          <a href="https://wa.me/201009360198" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline" className="text-base px-10">
              <PhoneCall className="w-4 h-4 me-2" />
              {t("cta.btn2")}
            </Button>
          </a>
        </div>
      </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Shield className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">ClinicSquad</span>
          </div>
          <p>2026 ClinicSquad. {lang === "ar" ? "مصمم للرعاية الصحية المصرية." : "Built for Egyptian healthcare."}</p>
          <div className="flex items-center gap-4">
            <a href="https://wa.me/201009360198" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline" data-testid="footer-whatsapp">{lang === "ar" ? "واتساب" : "WhatsApp"}</a>
            <Link href="/terms" className="hover:text-foreground hover:underline">{lang === "ar" ? "شروط الخدمة" : "Terms"}</Link>
            <Link href="/privacy" className="hover:text-foreground hover:underline">{lang === "ar" ? "الخصوصية" : "Privacy"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
