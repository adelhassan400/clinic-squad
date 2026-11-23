import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { useLang } from "@/lib/lang";

export function VerificationUnavailable({ invitation = false }: { invitation?: boolean }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6" dir={ar ? "rtl" : "ltr"}>
      <section className="w-full max-w-md rounded-xl border bg-card p-8 space-y-5" aria-labelledby="unavailable-title">
        <div className="flex items-center gap-2 text-primary"><ShieldAlert aria-hidden="true" className="w-7 h-7" /><span className="font-bold">ClinicSquad</span></div>
        <h1 id="unavailable-title" className="text-2xl font-bold">{invitation ? (ar ? "قبول دعوات الموظفين متوقف مؤقتًا" : "Staff invitations are temporarily paused") : (ar ? "التحقق من الإيميل غير متاح مؤقتًا" : "Email verification is temporarily unavailable")}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{ar ? "خدمة التحقق بالإيميل غير جاهزة. لم يتم إرسال أي إيميل أو رابط تفعيل، ولم يتم تسجيل طلب للدعم." : "Email verification is not ready. No email or verification link has been sent, and no support request has been recorded."}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{invitation ? (ar ? "لم يتم إنشاء حساب أو قبول الدعوة. الحسابات المفعّلة الحالية يمكنها تسجيل الدخول كالمعتاد." : "No account has been created and the invitation has not been accepted. Existing verified accounts can sign in as usual.") : (ar ? "روابط التفعيل القديمة متوقفة. الحسابات غير المفعّلة لا يمكنها الدخول حاليًا. الحسابات المفعّلة الحالية يمكنها تسجيل الدخول كالمعتاد." : "Previous verification links are disabled. Unverified accounts cannot sign in for now. Existing verified accounts can sign in as usual.")}</p>
        <Link href="/login" className="inline-block text-primary underline font-medium">{ar ? "العودة لتسجيل الدخول" : "Back to sign in"}</Link>
      </section>
    </main>
  );
}
