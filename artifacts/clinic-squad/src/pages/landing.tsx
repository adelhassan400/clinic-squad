import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { useLang } from "@/lib/lang";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Shield, Users, Calendar, TrendingUp, CheckCircle, Star,
  ArrowRight, Sun, Moon, Zap, Lock, Globe, PhoneCall,
  UserPlus, Settings as SettingsIcon, ClipboardList, BarChart3
} from "lucide-react";

const planFeatures = {
  basic: {
    en: ["Up to 500 patients", "Appointment scheduling", "Patient records", "Staff accounts (2)", "Email support"],
    ar: ["حتى 500 مريض", "جدولة المواعيد", "سجلات المرضى", "حسابات الموظفين (2)", "دعم بالبريد الإلكتروني"],
  },
  premium: {
    en: ["Unlimited patients", "Advanced scheduling", "Financial dashboard", "Analytics & reports", "Unlimited staff", "Priority support", "AI-ready modules (soon)"],
    ar: ["مرضى غير محدودين", "جدولة متقدمة", "لوحة المالية", "التحليلات والتقارير", "موظفون غير محدودون", "دعم ذو أولوية", "وحدات الذكاء الاصطناعي (قريباً)"],
  },
};

const testimonials = [
  { name: "د. هاني السيد", nameEn: "Dr. Hany El-Sayed", clinic: "عيادة السيد للأسرة، القاهرة", clinicEn: "El-Sayed Family Clinic, Cairo", text: { en: "ClinicSquad transformed how we manage our daily workflow. The appointment system alone saves us 2 hours a day.", ar: "كلينيك سكواد غيّر طريقة إدارتنا للعمل اليومي. نظام المواعيد وحده يوفر لنا ساعتين يومياً." } },
  { name: "د. منى إبراهيم", nameEn: "Dr. Mona Ibrahim", clinic: "عيادة إبراهيم لصحة المرأة، الإسكندرية", clinicEn: "Ibrahim Women's Health, Alexandria", text: { en: "The financial tracking is exactly what I needed. I finally have clear visibility into my clinic's performance.", ar: "تتبع المالية هو بالضبط ما كنت أحتاجه. أصبح لدي أخيراً رؤية واضحة لأداء عيادتي." } },
  { name: "د. طارق حسن", nameEn: "Dr. Tarek Hassan", clinic: "عيادة حسن لطب الأطفال، الجيزة", clinicEn: "Hassan Pediatric Clinic, Giza", text: { en: "Simple, fast, and reliable. My staff learned it in a day. Highly recommended for any Egyptian clinic.", ar: "بسيط وسريع وموثوق. تعلّم فريقي استخدامه في يوم واحد. أنصح به بشدة لأي عيادة مصرية." } },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { t, lang } = useLang();

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
      price: "200 EGP",
      period: lang === "ar" ? "/شهر" : "/month",
      descKey: "pricing.basic.desc",
      features: planFeatures.basic[lang],
      highlighted: false,
    },
    {
      nameKey: "pricing.premium.name",
      price: "400 EGP",
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
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-lg">ClinicSquad</span>
          </div>
          <div className="hidden md:flex items-center gap-6 ms-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">{t("nav.howItWorks")}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t("nav.pricing")}</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">{t("nav.testimonials")}</a>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="toggle-theme-nav">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="link-login">{t("nav.signIn")}</Button>
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
            { value: "500+", key: "hero.stat.clinics" },
            { value: "50K+", key: "hero.stat.patients" },
            { value: "15 " + (lang === "ar" ? "يوم" : "Days"), key: "hero.stat.trial" },
          ].map(({ value, key }) => (
            <div key={key} className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">{value}</div>
              <div className="text-sm text-muted-foreground">{t(key)}</div>
            </div>
          ))}
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

      {/* Testimonials */}
      <section id="testimonials" className="bg-card border-y border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("test.title")}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <div key={item.nameEn} className="p-6 rounded-xl border border-border bg-background">
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{item.text[lang]}"</p>
                <div>
                  <p className="font-semibold text-sm">{lang === "ar" ? item.name : item.nameEn}</p>
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? item.clinic : item.clinicEn}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 max-w-6xl mx-auto px-6 text-center">
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
          <a href="https://wa.me/201000000000" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline" className="text-base px-10">
              <PhoneCall className="w-4 h-4 me-2" />
              {t("cta.btn2")}
            </Button>
          </a>
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
        </div>
      </footer>
    </div>
  );
}
