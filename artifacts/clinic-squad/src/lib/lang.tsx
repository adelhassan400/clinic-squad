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
  // How it works
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
  "sidebar.signOut": { en: "Sign Out", ar: "تسجيل الخروج" },

  // Common
  "common.trialLeft": { en: " days left in trial", ar: " أيام متبقية في التجربة" },
  "common.upgradePlan": { en: "Upgrade Plan", ar: "ترقية الخطة" },
  "common.upgrade": { en: "Upgrade Now", ar: "ترقية الآن" },
  "common.subExpired": { en: "Subscription Expired", ar: "انتهى الاشتراك" },
  "common.trialExpires": { en: "Trial expires in", ar: "تنتهي التجربة خلال" },
  "common.day": { en: "day", ar: "يوم" },
  "common.days": { en: "days", ar: "أيام" },
  "common.upgradeNow": { en: "Upgrade Now", ar: "ترقية الآن" },

  // Statuses
  "status.inProgress": { en: "In progress", ar: "قيد الكشف" },
  "status.waiting": { en: "Waiting", ar: "في الانتظار" },
  "status.completed": { en: "Completed", ar: "مكتمل" },
  "status.registered": { en: "Registered", ar: "مسجل" },
  "status.scheduled": { en: "Scheduled", ar: "مجدول" },
  "status.cancelled": { en: "Cancelled", ar: "ملغي" },
  "status.noShow": { en: "No Show", ar: "لم يحضر" },
  "status.checkedIn": { en: "Checked-in", ar: "تم الدخول" },

  // Prescriptions
  "presc.title": { en: "ePrescription", ar: "الوصفة الإلكترونية" },
  "presc.subtitle": { en: "Write, print, and send prescriptions to your patients.", ar: "اكتب واطبع وأرسل الوصفات الطبية لمرضاك." },
  "presc.new": { en: "New Prescription", ar: "وصفة جديدة" },
  "presc.cancel": { en: "Cancel", ar: "إلغاء" },
  "presc.selectPatient": { en: "Select a patient", ar: "اختر مريضاً" },
  "presc.addMedication": { en: "Add at least one medication", ar: "أضف دواءً واحداً على الأقل" },
  "presc.created": { en: "Prescription created", ar: "تم إنشاء الوصفة" },
  "presc.failed": { en: "Failed to create prescription", ar: "فشل إنشاء الوصفة" },
  "presc.confirmDelete": { en: "Delete this prescription?", ar: "حذف هذه الوصفة؟" },
  "presc.deleted": { en: "Deleted", ar: "تم الحذف" },
  "presc.failedDelete": { en: "Failed to delete", ar: "فشل الحذف" },
  "presc.patient": { en: "Patient", ar: "المريض" },
  "presc.selectPatientPh": { en: "Select patient", ar: "اختر المريض" },
  "presc.date": { en: "Date", ar: "التاريخ" },
  "presc.diagnosis": { en: "Diagnosis", ar: "التشخيص" },
  "presc.diagnosisPh": { en: "e.g. Acute pharyngitis", ar: "مثال: التهاب الحلق الحاد" },
  "presc.medications": { en: "Medications", ar: "الأدوية" },
  "presc.addMedBtn": { en: "Add medication", ar: "أضف دواء" },
  "presc.drugName": { en: "Drug name", ar: "اسم الدواء" },
  "presc.drugNamePh": { en: "e.g. Amoxicillin 500mg", ar: "مثال: أموكسيسيلين 500 مجم" },
  "presc.dosage": { en: "Dosage", ar: "الجرعة" },
  "presc.dosagePh": { en: "1 capsule", ar: "كبسولة واحدة" },
  "presc.frequency": { en: "Frequency", ar: "التكرار" },
  "presc.frequencyPh": { en: "3× daily", ar: "3 مرات يومياً" },
  "presc.duration": { en: "Duration", ar: "المدة" },
  "presc.durationPh": { en: "7 days", ar: "7 أيام" },
  "presc.clinicalNotes": { en: "Clinical Notes", ar: "ملاحظات سريرية" },
  "presc.clinicalNotesPh": { en: "e.g. Take after meals, complete the course", ar: "مثال: تؤخذ بعد الوجبات، أكمل الجرعة" },
  "presc.save": { en: "Save Prescription", ar: "حفظ الوصفة" },
  "presc.searchPh": { en: "Search by patient, diagnosis, or drug name", ar: "البحث بالمريض أو التشخيص أو اسم الدواء" },
  "presc.empty": { en: "No prescriptions found", ar: "لم يتم العثور على وصفات" },
  "presc.print": { en: "Print / PDF", ar: "طباعة / PDF" },
  "presc.whatsapp": { en: "Send via WhatsApp", ar: "إرسال عبر واتساب" },
  "presc.delete": { en: "Delete", ar: "حذف" },
  "presc.view": { en: "View", ar: "عرض" },
  "presc.preview": { en: "Live preview", ar: "معاينة مباشرة" },

  // Dashboard
  "dash.title": { en: "Dashboard", ar: "لوحة التحكم" },
  "dash.stats.totalPatients": { en: "Total Patients", ar: "إجمالي المرضى" },
  "dash.stats.newThisMonth": { en: "new this month", ar: "جديد هذا الشهر" },
  "dash.stats.todayAppts": { en: "Today's Appointments", ar: "مواعيد اليوم" },
  "dash.stats.upcoming": { en: "upcoming", ar: "قادم" },
  "dash.stats.completed": { en: "Completed Sessions", ar: "الجلسات المكتملة" },
  "dash.stats.total": { en: "total sessions", ar: "إجمالي الجلسات" },
  "dash.today.title": { en: "Today's Schedule", ar: "جدول اليوم" },
  "dash.today.viewAll": { en: "View all appointments", ar: "عرض كل المواعيد" },
  "dash.today.empty": { en: "No appointments for today", ar: "لا توجد مواعيد اليوم" },
  "dash.today.schedule": { en: "Schedule appointment", ar: "جدولة موعد" },
  "dash.tomorrow.title": { en: "Tomorrow", ar: "غداً" },
  "dash.tomorrow.subtitle": { en: "Upcoming schedule", ar: "الجدول القادم" },
  "dash.tomorrow.empty": { en: "No appointments for tomorrow", ar: "لا توجد مواعيد لغد" },
  "dash.stats.waiting": { en: "In Waiting List", ar: "في قائمة الانتظار" },
  "dash.stats.revenue": { en: "Total Revenue", ar: "إجمالي الإيرادات" },
  "dash.stats.activeTrial": { en: "Active Trial", ar: "تجربة نشطة" },
  "dash.stats.daysLeft": { en: "days left", ar: "أيام متبقية" },
  "dash.recentAppts": { en: "Recent Appointments", ar: "المواعيد الأخيرة" },
  "dash.viewAll": { en: "View All", ar: "عرض الكل" },
  "dash.noAppts": { en: "No appointments today", ar: "لا توجد مواعيد اليوم" },
  "dash.revenueOverview": { en: "Revenue Overview", ar: "نظرة عامة على الإيرادات" },

  // Patients
  "patients.title": { en: "Patients", ar: "المرضى" },
  "patients.subtitle": { en: "Manage your patient records and medical history.", ar: "أدِر سجلات مرضاك وتاريخهم الطبي." },
  "patients.new": { en: "New Patient", ar: "مريض جديد" },
  "patients.add": { en: "Add Patient", ar: "أضف مريضاً" },
  "patients.onFile": { en: "patients on file", ar: "مريض مسجل" },
  "patients.searchPh": { en: "Search patients (PT-0001, name, phone)...", ar: "البحث عن المرضى (PT-0001، الاسم، الهاتف)..." },
  "patients.id": { en: "ID", ar: "المعرف" },
  "patients.name": { en: "Name", ar: "الاسم" },
  "patients.age": { en: "Age", ar: "السن" },
  "patients.phone": { en: "Phone", ar: "الهاتف" },
  "patients.visitType": { en: "Visit Type", ar: "نوع الزيارة" },
  "patients.status": { en: "Status", ar: "الحالة" },
  "patients.dateAdded": { en: "Date Added", ar: "تاريخ الإضافة" },
  "patients.actions": { en: "Actions", ar: "الإجراءات" },
  "patients.notFound": { en: "No patients found", ar: "لم يتم العثور على مرضى" },
  "patients.empty": { en: "No patients yet", ar: "لا يوجد مرضى بعد" },
  "patients.addFirst": { en: "Add your first patient to get started", ar: "أضف أول مريض للبدء" },
  "patients.toast.created": { en: "Patient created successfully", ar: "تم إنشاء المريض بنجاح" },
  "patients.toast.failed": { en: "Failed to create patient", ar: "فشل إنشاء المريض" },
  "patients.toast.sentToQueue": { en: "sent to waiting list", ar: "تم إرساله لقائمة الانتظار" },
  "patients.toast.checkInFailed": { en: "Failed to check in", ar: "فشل الدخول" },
  "patients.checkIn": { en: "Check-in", ar: "دخول" },

  // Waiting List
  "waiting.title": { en: "Waiting List", ar: "قائمة الانتظار" },
  "waiting.subtitle": { en: "Manage patients currently waiting for their consultation.", ar: "أدِر المرضى الذين ينتظرون كشفهم حالياً." },
  "waiting.count": { en: "patient", ar: "مريض" },
  "waiting.countPlural": { en: "patients", ar: "مرضى" },
  "waiting.inQueue": { en: "in queue", ar: "في الانتظار" },
  "waiting.action": { en: "Action", ar: "الإجراء" },
  "waiting.callNext": { en: "Call Next Patient", ar: "استدعاء المريض التالي" },
  "waiting.startSession": { en: "Start Session", ar: "بدأ الكشف" },
  "waiting.empty": { en: "Waiting list is empty", ar: "قائمة الانتظار فارغة" },

  // Checkout
  "checkout.title": { en: "Reception · Checkout", ar: "السكرتارية · الحساب" },
  "checkout.subtitle": { en: "ready for billing.", ar: "جاهزون للحساب." },
  "checkout.totalDue": { en: "Total due now", ar: "إجمالي المستحق الآن" },
  "checkout.amountDue": { en: "Amount Due", ar: "المبلغ المستحق" },
  "checkout.markPaid": { en: "Mark Paid", ar: "تم الدفع" },
  "checkout.requeue": { en: "Re-queue", ar: "إعادة للانتظار" },
  "checkout.confirmRequeue": { en: "Send back to the waiting list?", ar: "إعادة إلى قائمة الانتظار؟" },
  "checkout.toast.paid": { en: "marked as paid", ar: "تم وضع علامة مدفوع" },
  "checkout.toast.requeued": { en: "sent back to waiting list", ar: "تمت إعادته لقائمة الانتظار" },
  "checkout.empty": { en: "Nothing to bill yet", ar: "لا يوجد شيء للحساب بعد" },
  "checkout.emptyDesc": { en: "Patients show up here once the doctor finishes their session.", ar: "يظهر المرضى هنا بمجرد انتهاء الطبيب من جلستهم." },
  "checkout.setInSettings": { en: "Set in Settings", ar: "حدد في الإعدادات" },

  // Finances
  "finances.title": { en: "Finances", ar: "المالية" },
  "finances.overview": { en: "Financial overview for", ar: "نظرة عامة مالية لعام" },
  "finances.add": { en: "Add Record", ar: "أضف سجلاً" },
  "finances.income": { en: "Total Income", ar: "إجمالي الدخل" },
  "finances.expenses": { en: "Total Expenses", ar: "إجمالي المصروفات" },
  "finances.profit": { en: "Net Profit", ar: "صافي الربح" },
  "finances.chartTitle": { en: "Monthly Overview", ar: "نظرة عامة شهرية" },
  "finances.type": { en: "Type", ar: "النوع" },
  "finances.description": { en: "Description", ar: "الوصف" },
  "finances.category": { en: "Category", ar: "الفئة" },
  "finances.date": { en: "Date", ar: "التاريخ" },
  "finances.amount": { en: "Amount", ar: "المبلغ" },
  "finances.empty": { en: "No financial records yet", ar: "لا توجد سجلات مالية بعد" },
  "finances.incomeLabel": { en: "Income", ar: "دخل" },
  "finances.expenseLabel": { en: "Expense", ar: "مصروف" },
  "finances.addDialog.title": { en: "Add Financial Record", ar: "إضافة سجل مالي" },
  "finances.save": { en: "Save Record", ar: "حفظ السجل" },
  "finances.toast.added": { en: "Record added", ar: "تم إضافة السجل" },
  "finances.toast.failed": { en: "Failed to add record", ar: "فشل إضافة السجل" },

  // Appointments
  "appt.title": { en: "Appointments", ar: "المواعيد" },
  "appt.today": { en: "today", ar: "اليوم" },
  "appt.viewList": { en: "List View", ar: "عرض القائمة" },
  "appt.viewDay": { en: "Day View", ar: "عرض اليوم" },
  "appt.new": { en: "New Appointment", ar: "موعد جديد" },
  "appt.searchPh": { en: "Search patient name or phone...", ar: "البحث عن اسم المريض أو الهاتف..." },
  "appt.noAppts": { en: "No appointments scheduled", ar: "لا توجد مواعيد مجدولة" },
  "appt.date": { en: "Date", ar: "التاريخ" },
  "appt.time": { en: "Time", ar: "الوقت" },
  "appt.whatsapp": { en: "Send Reminder", ar: "إرسال تذكير" },
  "appt.edit": { en: "Edit Appointment", ar: "تعديل الموعد" },
  "appt.typePh": { en: "Select patient", ar: "اختر المريض" },
  "appt.scheduleAt": { en: "Schedule at", ar: "جدولة في" },
  "appt.notes": { en: "Notes", ar: "ملاحظات" },
  "appt.save": { en: "Save Appointment", ar: "حفظ الموعد" },
  "appt.confirmDelete": { en: "Delete this appointment?", ar: "حذف هذا الموعد؟" },
  "appt.toast.created": { en: "Appointment created", ar: "تم إنشاء الموعد" },
  "appt.toast.updated": { en: "Appointment updated", ar: "تم تحديث الموعد" },
  "appt.toast.deleted": { en: "Appointment deleted", ar: "تم حذف الموعد" },
  "appt.toast.failed": { en: "Failed to save appointment", ar: "فشل حفظ الموعد" },

  // Pending Activation
  "pending.title": { en: "Activating Your Clinic...", ar: "جاري تفعيل عيادتك..." },
  "pending.subtitle": { en: "Welcome to ClinicSquad! Our team is currently reviewing your registration to set up your secure workspace.", ar: "مرحباً بك في كلينيك سكواد! يقوم فريقنا حالياً بمراجعة تسجيلك لإعداد مساحة عملك الآمنة." },
  "pending.step1": { en: "Verification in progress", ar: "التحقق قيد التنفيذ" },
  "pending.step2": { en: "Workspace provisioning", ar: "تجهيز مساحة العمل" },
  "pending.step3": { en: "Ready to launch", ar: "جاهز للانطلاق" },
  "pending.whatsapp": { en: "Speed up activation via WhatsApp", ar: "تسريع التفعيل عبر واتساب" },
  "pending.refresh": { en: "Check Activation Status", ar: "تحقق من حالة التفعيل" },
};

const LangContext = createContext<LangContextType | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("clinic-lang");
    return (saved as Lang) || "en";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("clinic-lang", l);
  };

  const t = (key: string) => {
    return translations[key]?.[lang] || key;
  };

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang must be used within LangProvider");
  return context;
}
