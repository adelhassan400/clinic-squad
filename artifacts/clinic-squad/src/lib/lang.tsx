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
  "nav.howItWorks": { en: "How It Works", ar: "كيف تعمل" },
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
  "how.title": { en: "How to Get Started with ClinicSquad?", ar: "كيف تبدأ مع كلينيك سكواد؟" },
  "how.subtitle": { en: "Four simple steps from sign-up to a fully running, data-driven clinic.", ar: "أربع خطوات بسيطة من التسجيل إلى عيادة متكاملة تعمل بالبيانات." },
  "how.step1.title": { en: "Create Your Account", ar: "أنشئ حسابك" },
  "how.step1.desc": { en: "Register in seconds — no credit card required. Set up your clinic profile with your name, specialty, and consultation fees.", ar: "سجّل في ثوانٍ — بدون بطاقة ائتمانية. أنشئ ملف عيادتك مع اسمك وتخصصك ورسوم الكشف." },
  "how.step2.title": { en: "Customize Your Settings", ar: "خصّص إعداداتك" },
  "how.step2.desc": { en: "Configure consultation fees, add doctors and secretary accounts, and personalize the system to match your daily workflow.", ar: "حدّد رسوم الكشف، أضف حسابات الأطباء والسكرتيرة، وخصّص النظام ليناسب سير عملك اليومي." },
  "how.step3.title": { en: "Add Patients & Book Appointments", ar: "أضف المرضى واحجز المواعيد" },
  "how.step3.desc": { en: "Start adding patient records and booking appointments. The system handles the waitlist, visit history, and billing automatically.", ar: "ابدأ بإضافة سجلات المرضى وحجز المواعيد. النظام يتولى قائمة الانتظار وسجل الزيارات والفواتير تلقائياً." },
  "how.step4.title": { en: "Track & Grow", ar: "تابع وانمُ" },
  "how.step4.desc": { en: "Monitor clinic performance, revenue trends, and patient statistics from a beautiful analytics dashboard.", ar: "تابع أداء عيادتك واتجاهات الإيرادات وإحصائيات المرضى من لوحة تحليلات أنيقة." },

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
  "sidebar.team": { en: "Team", ar: "الفريق" },
  "sidebar.prescriptions": { en: "ePrescription", ar: "الوصفة الإلكترونية" },
  // Team management
  "team.title": { en: "Team Management", ar: "إدارة الفريق" },
  "team.subtitle": { en: "Invite secretaries and nurses to help run your clinic.", ar: "ادعُ السكرتارية والممرضين للمساعدة في تشغيل عيادتك." },
  "team.plan.trial": { en: "Trial", ar: "تجريبي" },
  "team.plan.basic": { en: "Basic", ar: "أساسي" },
  "team.plan.premium": { en: "Premium", ar: "مميز" },
  "team.plan.expired": { en: "Expired", ar: "منتهي" },
  "team.capacity.title": { en: "Member capacity", ar: "سعة الأعضاء" },
  "team.capacity.note.prefix": { en: "Your", ar: "خطتك" },
  "team.capacity.note.suffix": { en: "plan allows up to", ar: "تسمح بحد أقصى" },
  "team.capacity.members": { en: "team members", ar: "أعضاء فريق" },
  "team.capacity.upgrade": { en: "Upgrade to Premium for 10 members.", ar: "قم بالترقية إلى المميز لـ 10 أعضاء." },
  "team.invite.title": { en: "Invite a team member", ar: "دعوة عضو فريق" },
  "team.invite.name": { en: "Full name", ar: "الاسم الكامل" },
  "team.invite.namePh": { en: "e.g. Mona Hassan", ar: "مثال: منى حسن" },
  "team.invite.email": { en: "Email", ar: "البريد الإلكتروني" },
  "team.invite.role": { en: "Role", ar: "الدور" },
  "team.invite.send": { en: "Send Invite", ar: "إرسال الدعوة" },
  "team.invite.limitMsg": { en: "You've reached your plan's member limit. Upgrade or remove a member to add more.", ar: "لقد وصلت إلى الحد الأقصى لخطتك. قم بالترقية أو إزالة عضو لإضافة المزيد." },
  "team.role.admin": { en: "Admin", ar: "مدير" },
  "team.role.secretary": { en: "Secretary", ar: "سكرتير" },
  "team.role.nurse": { en: "Nurse", ar: "ممرض" },
  "team.pending.title": { en: "Pending invitations", ar: "الدعوات المعلقة" },
  "team.pending.empty": { en: "No pending invitations.", ar: "لا توجد دعوات معلقة." },
  "team.members.title": { en: "Active members", ar: "الأعضاء النشطون" },
  "team.owner": { en: "Owner", ar: "المالك" },
  "team.copyLink": { en: "Copy link", ar: "نسخ الرابط" },
  "team.copied": { en: "Copied!", ar: "تم النسخ!" },
  "team.confirm.remove": { en: "Remove this member from the clinic?", ar: "هل تريد إزالة هذا العضو من العيادة؟" },
  "team.toast.inviteCreated": { en: "Invitation created. Share the link with your team member.", ar: "تم إنشاء الدعوة. شارك الرابط مع عضو الفريق." },
  "team.toast.copied": { en: "Invite link copied to clipboard.", ar: "تم نسخ رابط الدعوة." },
  "team.toast.copyFailed": { en: "Could not copy. Use the link below.", ar: "تعذر النسخ. استخدم الرابط أدناه." },
  "team.toast.revoked": { en: "Invitation revoked.", ar: "تم إلغاء الدعوة." },
  "team.toast.removed": { en: "Member removed.", ar: "تمت إزالة العضو." },
  "team.toast.failedTitle": { en: "Could not invite", ar: "تعذر الدعوة" },
  "team.toast.failed": { en: "Please try again.", ar: "يرجى المحاولة مرة أخرى." },
  "team.toast.limitReached": { en: "Plan member limit reached.", ar: "تم الوصول إلى الحد الأقصى للأعضاء." },
  "team.toast.duplicate": { en: "Email already on team or already invited.", ar: "البريد موجود بالفعل في الفريق أو تمت دعوته." },
  // Accept invite page
  "invite.title": { en: "Join the team", ar: "انضم إلى الفريق" },
  "invite.subtitle.prefix": { en: "You've been invited to join", ar: "لقد تمت دعوتك للانضمام إلى" },
  "invite.subtitle.as": { en: "as a", ar: "كـ" },
  "invite.email": { en: "Email", ar: "البريد" },
  "invite.fullName": { en: "Full name", ar: "الاسم الكامل" },
  "invite.password": { en: "Choose a password", ar: "اختر كلمة المرور" },
  "invite.accept": { en: "Accept & Sign In", ar: "قبول وتسجيل الدخول" },
  "invite.invalid.title": { en: "Invitation not valid", ar: "الدعوة غير صالحة" },
  "invite.invalid.body": { en: "This invitation may have expired or been revoked. Please ask your clinic admin for a new one.", ar: "قد تكون هذه الدعوة منتهية أو ملغاة. يرجى طلب دعوة جديدة من مدير العيادة." },
  "invite.toast.welcome": { en: "Welcome to the team!", ar: "مرحباً بك في الفريق!" },
  "invite.toast.failed": { en: "Could not accept invitation", ar: "تعذر قبول الدعوة" },
  "invite.toast.failedDesc": { en: "The invitation may have expired or the email is already in use.", ar: "قد تكون الدعوة منتهية أو البريد مستخدم بالفعل." },
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
