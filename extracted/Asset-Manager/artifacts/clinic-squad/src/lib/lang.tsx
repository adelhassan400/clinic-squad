import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "ar";

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const translations: Record<string, Record<Lang, string>> = {
  // Nav
  "nav.features": { en: "Features", ar: "المميزات" },
  "nav.pricing": { en: "Pricing", ar: "الأسعار" },
  "nav.testimonials": { en: "Testimonials", ar: "آراء العملاء" },
  "nav.signIn": { en: "Sign In", ar: "تسجيل الدخول" },
  "nav.startTrial": { en: "Start Free Trial", ar: "ابدأ التجربة المجانية" },
  // Hero
  "hero.badge": { en: "15-Day Free Trial — No Credit Card Required", ar: "تجربة مجانية 15 يوماً — بدون بطاقة ائتمانية" },
  "hero.title1": { en: "The Clinic OS for", ar: "نظام إدارة العيادة لـ" },
  "hero.title2": { en: "Modern Medicine", ar: "الطب الحديث" },
  "hero.subtitle": { en: "ClinicSquad gives Egyptian doctors and clinic owners a complete management platform — patients, appointments, finances, and staff — in one powerful workspace.", ar: "كلينيك سكواد يمنح الأطباء المصريين وأصحاب العيادات منصة إدارة متكاملة — المرضى والمواعيد والمالية والموظفين — في مكان عمل واحد قوي." },
  "hero.cta1": { en: "Start Your Free Trial", ar: "ابدأ تجربتك المجانية" },
  "hero.cta2": { en: "Sign In to Dashboard", ar: "تسجيل الدخول للوحة التحكم" },
  "hero.stat.clinics": { en: "Clinics", ar: "عيادة" },
  "hero.stat.patients": { en: "Patients", ar: "مريض" },
  "hero.stat.trial": { en: "Free Trial", ar: "تجربة مجانية" },
  // Features
  "feat.title": { en: "Everything Your Clinic Needs", ar: "كل ما تحتاجه عيادتك" },
  "feat.subtitle": { en: "A complete clinical management system built specifically for Egyptian healthcare practices.", ar: "نظام إدارة عيادات متكامل مصمم خصيصاً للرعاية الصحية المصرية." },
  "feat.patients.title": { en: "Patient Management", ar: "إدارة المرضى" },
  "feat.patients.desc": { en: "Comprehensive patient records with medical history, allergies, and contact details.", ar: "سجلات مرضى شاملة مع التاريخ الطبي والحساسيات وبيانات التواصل." },
  "feat.scheduling.title": { en: "Smart Scheduling", ar: "جدولة ذكية" },
  "feat.scheduling.desc": { en: "Effortless appointment booking with status tracking and daily views.", ar: "حجز مواعيد بسهولة مع تتبع الحالة وعرض يومي." },
  "feat.finance.title": { en: "Financial Dashboard", ar: "لوحة المالية" },
  "feat.finance.desc": { en: "Track income, expenses, and generate monthly financial reports.", ar: "تتبع الإيرادات والمصروفات وإنشاء تقارير مالية شهرية." },
  "feat.realtime.title": { en: "Real-time Updates", ar: "تحديثات فورية" },
  "feat.realtime.desc": { en: "Instant updates across all devices — always see the latest clinic data.", ar: "تحديثات فورية على جميع الأجهزة — شاهد دائماً أحدث بيانات العيادة." },
  "feat.secure.title": { en: "Secure & Compliant", ar: "آمن ومتوافق" },
  "feat.secure.desc": { en: "Role-based access control for admins, secretaries and clinic staff.", ar: "تحكم في الوصول بحسب الدور للمدراء والسكرتيرة وموظفي العيادة." },
  "feat.bilingual.title": { en: "Arabic & English", ar: "عربي وإنجليزي" },
  "feat.bilingual.desc": { en: "Full support for both Arabic (RTL) and English language interfaces.", ar: "دعم كامل للغة العربية (RTL) وواجهات اللغة الإنجليزية." },
  // Pricing
  "pricing.title": { en: "Simple, Transparent Pricing", ar: "أسعار بسيطة وشفافة" },
  "pricing.subtitle": { en: "Start with a 15-day free trial. No credit card required.", ar: "ابدأ بتجربة مجانية 15 يوماً. لا حاجة لبطاقة ائتمانية." },
  "pricing.popular": { en: "Most Popular", ar: "الأكثر شيوعاً" },
  "pricing.basic.name": { en: "Basic Plan", ar: "الخطة الأساسية" },
  "pricing.basic.desc": { en: "Perfect for small clinics", ar: "مثالية للعيادات الصغيرة" },
  "pricing.premium.name": { en: "Premium Plan", ar: "الخطة المميزة" },
  "pricing.premium.desc": { en: "Full-featured for growing clinics", ar: "متكاملة للعيادات النامية" },
  "pricing.cta": { en: "Start Free Trial", ar: "ابدأ التجربة المجانية" },
  // Testimonials
  "test.title": { en: "Trusted by Egyptian Doctors", ar: "موثوق به من الأطباء المصريين" },
  // CTA Section
  "cta.title": { en: "Ready to Transform Your Clinic?", ar: "مستعد لتحويل عيادتك؟" },
  "cta.subtitle": { en: "Join hundreds of Egyptian clinics already using ClinicSquad to streamline their operations.", ar: "انضم لمئات العيادات المصرية التي تستخدم كلينيك سكواد لتبسيط عملياتها." },
  "cta.btn1": { en: "Start Free Trial — 15 Days", ar: "ابدأ التجربة المجانية — 15 يوماً" },
  "cta.btn2": { en: "Contact via WhatsApp", ar: "تواصل عبر واتساب" },
  // Dashboard sidebar
  "sidebar.clinic": { en: "Clinic", ar: "العيادة" },
  "sidebar.dashboard": { en: "Dashboard", ar: "لوحة التحكم" },
  "sidebar.patients": { en: "Patients", ar: "المرضى" },
  "sidebar.appointments": { en: "Appointments", ar: "المواعيد" },
  "sidebar.insights": { en: "Insights", ar: "التحليلات" },
  "sidebar.finances": { en: "Finances", ar: "المالية" },
  "sidebar.settings": { en: "Settings", ar: "الإعدادات" },
  "sidebar.admin": { en: "Admin Panel", ar: "لوحة الإدارة" },
  "sidebar.signOut": { en: "Sign out", ar: "تسجيل الخروج" },
  // Common
  "common.upgrade": { en: "Upgrade", ar: "ترقية" },
  "common.upgradeNow": { en: "Upgrade now", ar: "قم بالترقية الآن" },
  "common.upgradePlan": { en: "Upgrade Plan", ar: "ترقية الخطة" },
  "common.trialLeft": { en: "d trial left", ar: "يوم متبقي في التجربة" },
  "common.trialExpires": { en: "Trial expires in", ar: "تنتهي التجربة خلال" },
  "common.day": { en: "day", ar: "يوم" },
  "common.days": { en: "days", ar: "أيام" },
  "common.subExpired": { en: "Subscription Expired", ar: "انتهى الاشتراك" },
};

export function t(lang: Lang, key: string): string {
  return translations[key]?.[lang] ?? key;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem("clinicsquad_lang");
    return (stored === "ar" ? "ar" : "en") as Lang;
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("clinicsquad_lang", l);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    root.setAttribute("lang", lang);
    if (lang === "ar") {
      root.style.setProperty("--app-font-sans", "'Cairo', 'Inter', sans-serif");
    } else {
      root.style.setProperty("--app-font-sans", "'Inter', sans-serif");
    }
  }, [lang]);

  const translate = (key: string) => t(lang, key);

  return (
    <LangContext.Provider value={{ lang, setLang, t: translate, dir: lang === "ar" ? "rtl" : "ltr" }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
