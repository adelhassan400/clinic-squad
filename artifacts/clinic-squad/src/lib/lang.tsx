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
  
  // Auth Pages
  "auth.login.title": { en: "Welcome back", ar: "مرحباً بعودتك" },
  "auth.login.subtitle": { en: "Sign in to your clinic account", ar: "سجّل الدخول إلى حساب عيادتك" },
  "auth.login.email": { en: "Email", ar: "البريد الإلكتروني" },
  "auth.login.password": { en: "Password", ar: "كلمة المرور" },
  "auth.login.forgot": { en: "Forgot password?", ar: "نسيت كلمة المرور؟" },
  "auth.login.submit": { en: "Sign In", ar: "تسجيل الدخول" },
  "auth.login.noAccount": { en: "Don't have an account?", ar: "ليس لديك حساب؟" },
  "auth.login.register": { en: "Register your clinic", ar: "سجّل عيادتك" },
  "auth.login.hero.title": { en: "The command center for your clinic", ar: "مركز القيادة لعيادتك" },
  "auth.login.hero.subtitle": { en: "Manage patients, appointments, and finances — all in one place, built for Egyptian clinics.", ar: "أدِر المرضى والمواعيد والمالية — كل ذلك في مكان واحد، مصمم للعيادات المصرية." },
  "auth.login.hero.feat1": { en: "Patient management", ar: "إدارة المرضى" },
  "auth.login.hero.feat2": { en: "Appointment scheduling", ar: "جدولة المواعيد" },
  "auth.login.hero.feat3": { en: "Financial tracking", ar: "تتبع المالية" },

  "auth.register.title": { en: "Start your free trial", ar: "ابدأ تجربتك المجانية" },
  "auth.register.subtitle": { en: "Join 500+ clinics using ClinicSquad to grow.", ar: "انضم لأكثر من 500 عيادة تستخدم كلينيك سكواد للنمو." },
  "auth.register.name": { en: "Clinic Name", ar: "اسم العيادة" },
  "auth.register.owner": { en: "Doctor Name", ar: "اسم الطبيب" },
  "auth.register.email": { en: "Work Email", ar: "بريد العمل" },
  "auth.register.password": { en: "Password", ar: "كلمة المرور" },
  "auth.register.submit": { en: "Create Clinic Account", ar: "إنشاء حساب العيادة" },
  "auth.register.haveAccount": { en: "Already have an account?", ar: "لديك حساب بالفعل؟" },
  "auth.register.login": { en: "Sign in instead", ar: "سجّل الدخول بدلاً من ذلك" },
  "auth.register.hero.title": { en: "Request your free 15-day trial", ar: "اطلب تجربتك المجانية لمدة 15 يوماً" },
  "auth.register.hero.subtitle": { en: "Tell us about your clinic and our team will activate your trial within minutes.", ar: "أخبرنا عن عيادتك وسيقوم فريقنا بتفعيل تجربتك في غضون دقائق." },
  "auth.register.hero.feat1": { en: "Full access during trial", ar: "وصول كامل خلال فترة التجربة" },
  "auth.register.hero.feat2": { en: "Both Basic and Premium features", ar: "كل المميزات الأساسية والمتقدمة" },
  "auth.register.hero.feat3": { en: "Cancel anytime — no credit card", ar: "إلغاء في أي وقت — بدون بطاقة ائتمانية" },
  "auth.register.hero.trusted": { en: "Trusted by 500+ Egyptian clinics", ar: "موثوق به من أكثر من 500 عيادة مصرية" },
  "auth.register.specialty": { en: "Medical Specialty", ar: "التخصص الطبي" },
  "auth.register.whatsapp": { en: "WhatsApp Number", ar: "رقم الواتساب" },
  "auth.register.terms": { en: "By requesting a trial, you agree to our Terms of Service and Privacy Policy.", ar: "بطلبك للتجربة، فإنك توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا." },

  // Dashboard sidebar
  "sidebar.clinic": { en: "Clinic", ar: "العيادة" },
  "sidebar.dashboard": { en: "Dashboard", ar: "لوحة التحكم" },
  "sidebar.patients": { en: "Patients", ar: "المرضى" },
  "sidebar.appointments": { en: "Appointments", ar: "المواعيد" },
  "sidebar.waitingList": { en: "Waiting List", ar: "قائمة الانتظار" },
  "sidebar.checkout": { en: "Checkout", ar: "الحساب" },
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
  // Dashboard
  "dash.title": { en: "Dashboard", ar: "لوحة التحكم" },
  "dash.trial.days": { en: "Free trial: d days remaining", ar: "تجربة مجانية: متبقي d يوم" },
  "dash.trial.note": { en: "Choose a plan to continue using ClinicSquad after your trial ends.", ar: "اختر خطة لمواصلة استخدام كلينيك سكواد بعد انتهاء تجربتك." },
  "dash.stats.patients": { en: "Total Patients", ar: "إجمالي المرضى" },
  "dash.stats.todayAppts": { en: "Today's Appointments", ar: "مواعيد اليوم" },
  "dash.stats.revenue": { en: "Monthly Revenue", ar: "الإيرادات الشهرية" },
  "dash.stats.completed": { en: "Completed", ar: "المكتملة" },
  "dash.stats.newThisMonth": { en: "this month", ar: "هذا الشهر" },
  "dash.stats.upcoming": { en: "upcoming", ar: "قادمة" },
  "dash.stats.expenses": { en: "Expenses", ar: "المصروفات" },
  "dash.stats.total": { en: "appointments total", ar: "إجمالي المواعيد" },
  "dash.today.title": { en: "Today's Appointments", ar: "مواعيد اليوم" },
  "dash.today.viewAll": { en: "View all", ar: "عرض الكل" },
  "dash.today.empty": { en: "No appointments today", ar: "لا توجد مواعيد اليوم" },
  "dash.today.schedule": { en: "Schedule appointment", ar: "جدولة موعد" },
  "dash.today.checkin": { en: "Check-in", ar: "تسجيل دخول" },
  "dash.today.checkedIn": { en: "checked in", ar: "تم تسجيل الدخول" },
  "dash.tomorrow.title": { en: "Tomorrow's Reminders", ar: "تذكيرات الغد" },
  "dash.tomorrow.subtitle": { en: "One-click WhatsApp reminders to reduce no-shows", ar: "تذكيرات واتساب بنقرة واحدة لتقليل عدم الحضور" },
  "dash.tomorrow.empty": { en: "No appointments tomorrow", ar: "لا توجد مواعيد غداً" },
  "dash.tomorrow.send": { en: "Send reminder", ar: "إرسال تذكير" },
  "dash.tomorrow.noPhone": { en: "No phone", ar: "لا يوجد رقم" },
  "dash.tomorrow.scheduled": { en: "scheduled", ar: "مجدولة" },
  // Pending Activation
  "pending.status": { en: "Pending Activation", ar: "في انتظار التفعيل" },
  "pending.title": { en: "Your request has been received!", ar: "تم استلام طلبك بنجاح!" },
  "pending.body": { en: "To activate your 15-day free trial, please contact our technical support. We'll verify your details and unlock your dashboard within minutes.", ar: "لتفعيل تجربتك المجانية لمدة 15 يوماً، يرجى التواصل مع الدعم الفني. سنقوم بالتحقق من بياناتك وفتح لوحة التحكم الخاصة بك في غضون دقائق." },
  "pending.clinic": { en: "Clinic", ar: "العيادة" },
  "pending.account": { en: "Account", ar: "الحساب" },
  "pending.reqNum": { en: "Request Number", ar: "رقم الطلب" },
  "pending.reqNumNote": { en: "Include this number when contacting support.", ar: "يرجى إدراج هذا الرقم عند التواصل مع الدعم." },
  "pending.whatsapp": { en: "Activate via WhatsApp", ar: "تفعيل عبر واتساب" },
  "pending.step1": { en: "Tap the button above to message our support team on WhatsApp.", ar: "اضغط على الزر أعلاه لمراسلة فريق الدعم عبر واتساب." },
  "pending.step2": { en: "Once approved, refresh this page to enter your dashboard.", ar: "بمجرد الموافقة، قم بتحديث هذه الصفحة للدخول إلى لوحة التحكم." },
  "pending.step3": { en: "No credit card required during your 15-day trial.", ar: "لا حاجة لبطاقة ائتمانية خلال فترة التجربة." },
  "pending.footer": { en: "Activation is usually completed within a few minutes during business hours.", ar: "يتم التفعيل عادةً خلال بضع دقائق خلال ساعات العمل." },
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
