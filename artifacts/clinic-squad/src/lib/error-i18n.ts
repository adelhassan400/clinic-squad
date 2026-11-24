import { zodResolver } from "@hookform/resolvers/zod";

/**
 * Client-side Arabic mapping for API error messages and form validation messages.
 * Server messages and error codes are unchanged; this only changes what the user reads.
 * Unknown messages fall back to a generic Arabic message (Arabic) or the original text (English).
 */
const AR: Record<string, string> = {
  // API messages
  "Invalid input": "البيانات المدخلة غير صالحة",
  "Clinic not found": "العيادة غير موجودة",
  "Forbidden": "ليس لديك صلاحية لهذا الإجراء",
  "Unauthorized": "يرجى تسجيل الدخول أولاً",
  "Invalid token": "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى",
  "Patient not found": "المريض غير موجود",
  "Clinic is awaiting activation": "العيادة في انتظار التفعيل",
  "Clinic access is deactivated": "تم إيقاف الوصول إلى العيادة",
  "You can update up to 100 clinics at a time": "يمكنك تحديث 100 عيادة كحد أقصى في المرة الواحدة",
  "User not found": "المستخدم غير موجود",
  "Title and message are required": "العنوان والرسالة مطلوبان",
  "The clinic owner account is blocked or deactivated": "حساب مالك العيادة محظور أو غير مفعّل",
  "Subscription not found": "الاشتراك غير موجود",
  "Status must be paid, free, or unpaid": "يجب أن تكون الحالة مدفوع أو مجاني أو غير مدفوع",
  "Staff invitation acceptance is temporarily paused until email verification is available. No account has been created.": "قبول دعوات الموظفين متوقف مؤقتاً حتى يتوفر التحقق من البريد الإلكتروني. لم يتم إنشاء أي حساب.",
  "Select at least one clinic": "اختر عيادة واحدة على الأقل",
  "Receipt must be a JPG, PNG, or WebP image": "يجب أن يكون الإيصال صورة بصيغة JPG أو PNG أو WebP",
  "Receipt image is too large (max 5 MB)": "صورة الإيصال كبيرة جداً (الحد الأقصى 5 ميجابايت)",
  "Promo code not found": "كود الخصم غير موجود",
  "Promo code already exists": "كود الخصم موجود بالفعل",
  "Plan member limit reached": "تم الوصول إلى الحد الأقصى لعدد الأعضاء في الباقة",
  "Payment receipt image is required": "صورة إيصال الدفع مطلوبة",
  "Payment method is required before marking a patient paid": "يجب تحديد طريقة الدفع قبل تسجيل المريض كمدفوع",
  "No valid fields to update": "لا توجد بيانات صالحة للتحديث",
  "No subscription found": "لا يوجد اشتراك",
  "No matching clinics found": "لم يتم العثور على عيادات مطابقة",
  "No account found for that email": "لا يوجد حساب بهذا البريد الإلكتروني",
  "New password must be different from current password": "يجب أن تختلف كلمة المرور الجديدة عن الحالية",
  "Name, phone, and age are required for a new patient": "الاسم والهاتف والعمر مطلوبة للمريض الجديد",
  "Missing clinicId": "معرّف العيادة مفقود",
  "Message not found": "الرسالة غير موجودة",
  "Invalid queue registration": "تسجيل الطابور غير صالح",
  "Invalid or expired reset token": "رابط إعادة التعيين غير صالح أو منتهي",
  "Invalid expiry date": "تاريخ الانتهاء غير صالح",
  "Invalid credentials": "بيانات الدخول غير صحيحة",
  "Invalid bulk check-in request": "طلب تسجيل الحضور الجماعي غير صالح",
  "Email verification is temporarily unavailable. This unverified account cannot sign in. No email has been sent.": "التحقق من البريد الإلكتروني غير متاح مؤقتاً. لا يمكن لهذا الحساب غير المؤكد تسجيل الدخول. لم يتم إرسال أي بريد.",
  "Email verification is temporarily unavailable. This unverified account cannot sign in.": "التحقق من البريد الإلكتروني غير متاح مؤقتاً. لا يمكن لهذا الحساب غير المؤكد تسجيل الدخول.",
  "Email verification is temporarily unavailable. No email or verification link has been sent.": "التحقق من البريد الإلكتروني غير متاح مؤقتاً. لم يتم إرسال أي بريد أو رابط تحقق.",
  "Email is required": "البريد الإلكتروني مطلوب",
  "Email already has an account": "يوجد حساب بهذا البريد الإلكتروني بالفعل",
  "Email already exists": "البريد الإلكتروني مستخدم بالفعل",
  "Duration must be between 1 and 120 months": "يجب أن تكون المدة بين 1 و120 شهراً",
  "Days must be between 1 and 90": "يجب أن يكون عدد الأيام بين 1 و90",
  "Current password is incorrect": "كلمة المرور الحالية غير صحيحة",
  "Clinical updates require a Doctor": "التحديثات الطبية تتطلب طبيباً",
  "Clinic owner account is unavailable": "حساب مالك العيادة غير متاح",
  "Cash transaction not found": "المعاملة النقدية غير موجودة",
  "Cannot remove the clinic owner": "لا يمكن إزالة مالك العيادة",
  "Bulk action must be activate or deactivate": "يجب أن يكون الإجراء الجماعي تفعيل أو إيقاف",
  "Attachment too large (max 5 MB)": "المرفق كبير جداً (الحد الأقصى 5 ميجابايت)",
  "Already invited": "تمت دعوة هذا الشخص بالفعل",
  "Account is blocked": "الحساب محظور",
  "Account deactivated": "الحساب غير مفعّل",
  "A valid subscription plan is required": "يجب اختيار باقة اشتراك صالحة",
  "A code and a discount from 1 to 100 are required": "الكود ونسبة خصم من 1 إلى 100 مطلوبان",
  "Failed to read file": "تعذر قراءة الملف",
  // Form validation messages
  "Enter a valid email": "أدخل بريداً إلكترونياً صحيحاً",
  "Invalid email": "أدخل بريداً إلكترونياً صحيحاً",
  "Required": "هذا الحقل مطلوب",
  "Name is required": "الاسم مطلوب",
  "Select a patient": "اختر مريضاً",
  "Date required": "التاريخ مطلوب",
  "Time required": "الوقت مطلوب",
  "Type required": "النوع مطلوب",
  "Clinic name must be at least 2 characters": "يجب أن يتكون اسم العيادة من حرفين على الأقل",
  "Name must be at least 2 characters": "يجب أن يتكون الاسم من حرفين على الأقل",
  "Please enter your medical specialty": "يرجى إدخال تخصصك الطبي",
  "Enter a valid WhatsApp number": "أدخل رقم واتساب صحيحاً",
  "Only digits, spaces and + - ( ) are allowed": "يسمح فقط بالأرقام والمسافات و + - ( )",
  "Password must be at least 6 characters": "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل",
  "Password is required": "كلمة المرور مطلوبة",
  "Name required": "الاسم مطلوب",
  "Phone required": "رقم الهاتف مطلوب",
  "Age must be a whole number": "يجب أن يكون العمر رقماً صحيحاً",
  "Age is required and must be 0 or greater": "العمر مطلوب ويجب ألا يقل عن 0",
  "Age looks too high": "العمر يبدو مرتفعاً جداً",
  "Category required": "التصنيف مطلوب",
  "Amount must be positive": "يجب أن يكون المبلغ أكبر من صفر",
  "Description required": "الوصف مطلوب",
};

const AR_CODE: Record<string, string> = {
  CLINIC_PENDING: AR["Clinic is awaiting activation"],
  CLINIC_DEACTIVATED: AR["Clinic access is deactivated"],
};

const GENERIC_AR = "حدث خطأ. حاول مرة أخرى.";

function isArabic(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("clinic_lang") === "ar";
  } catch {
    return false;
  }
}

/** Translate a known validation or API message; unknown messages are returned unchanged. */
export function trErr(message: string): string {
  return isArabic() ? AR[message] ?? message : message;
}

/**
 * Text for an API error in the current language. English keeps the server text.
 * Arabic maps by error code, then exact message, then known message inside the text,
 * then falls back to the supplied (already translated) fallback.
 */
export function apiErrorText(err: any, fallback?: string): string {
  const code = err?.data?.code;
  const raw = err?.data?.error ?? err?.message;
  if (!isArabic()) {
    return typeof raw === "string" && raw ? raw : fallback ?? "";
  }
  if (typeof code === "string" && AR_CODE[code]) return AR_CODE[code];
  if (typeof raw === "string" && raw) {
    if (AR[raw]) return AR[raw];
    for (const k of Object.keys(AR)) {
      if (raw.includes(k)) return AR[k];
    }
  }
  return fallback || GENERIC_AR;
}

function translateErrors(o: any): void {
  if (!o || typeof o !== "object") return;
  if (typeof o.message === "string") o.message = trErr(o.message);
  for (const key of Object.keys(o)) {
    if (key === "ref") continue;
    const v = o[key];
    if (v && typeof v === "object") translateErrors(v);
  }
}

/** zodResolver that shows validation messages in the current language. */
export function lzResolver(schema: any): any {
  const base: any = zodResolver(schema);
  return async (values: any, context: any, options: any) => {
    const result = await base(values, context, options);
    if (result && result.errors) translateErrors(result.errors);
    return result;
  };
}
