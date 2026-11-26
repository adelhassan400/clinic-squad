import { Link } from "wouter";
import { Shield } from "lucide-react";
import { useLang } from "@/lib/lang";

type Section = { h: string; p: string[] };
type Doc = { title: string; updated: string; intro: string; sections: Section[] };

const CONTACT_URL = "https://wa.me/201009360198";

const docs: Record<"terms" | "privacy", Record<"en" | "ar", Doc>> = {
  terms: {
    en: {
      title: "Terms of Service",
      updated: "Last updated: 26 November 2026",
      intro:
        "These terms explain how you may use ClinicSquad, a web app that helps clinics manage patients, appointments, prescriptions and finances. By requesting a trial or using the service you agree to them. If you do not agree, please do not use ClinicSquad.",
      sections: [
        {
          h: "1. The service",
          p: [
            "ClinicSquad is a clinic management tool. It is not medical advice, it does not make clinical decisions, and it does not replace your own records or your professional judgment.",
            "The service is new and still being improved. Features can change, and we do not promise that it will always be available or free of errors.",
          ],
        },
        {
          h: "2. Accounts and activation",
          p: [
            "A new clinic account is reviewed and activated by our team, usually through WhatsApp. We may refuse, pause or close an account, for example for misuse or unpaid subscriptions.",
            "You are responsible for keeping your password private and for what staff accounts in your clinic do. Tell us quickly if you think an account was used by someone else.",
          ],
        },
        {
          h: "3. Free trial and payment",
          p: [
            "New clinics get a free trial. After the trial, paid plans are paid manually, for example by mobile wallet transfer, and you upload the transfer receipt in the app. A subscription starts only after we confirm the payment.",
            "Prices are shown in the app and can change for future periods. If we change a price we will tell you before it applies to you.",
          ],
        },
        {
          h: "4. Your data and your patients",
          p: [
            "The clinic owns the data it enters. The clinic is responsible for entering it lawfully, including getting any consent it needs from its patients and keeping to the rules that apply to its profession.",
            "We use your data only to run the service for you, as described in the Privacy Policy.",
          ],
        },
        {
          h: "5. What you must not do",
          p: [
            "Do not use ClinicSquad for anything unlawful, do not try to access another clinic's data, do not try to break or overload the service, and do not share your login with people outside your clinic.",
          ],
        },
        {
          h: "6. Backups and data loss",
          p: [
            "We make encrypted copies of the database regularly, but we cannot promise that no data will ever be lost. Please keep any records you cannot afford to lose somewhere else as well.",
          ],
        },
        {
          h: "7. Liability",
          p: [
            "The service is provided as it is. To the extent the law allows, we are not responsible for losses caused by downtime, errors, or data loss, or for medical or business decisions made using the app.",
          ],
        },
        {
          h: "8. Ending your account",
          p: [
            "You can stop using ClinicSquad at any time and ask us to close your account and delete your clinic's data (see the Privacy Policy). We may end the service or an account, and we will try to give notice when we can.",
          ],
        },
        {
          h: "9. Changes to these terms",
          p: ["We may update these terms. The date at the top shows the latest version. If you keep using the service after a change, you accept the new version."],
        },
        {
          h: "10. Contact",
          p: ["Questions about these terms: message us on WhatsApp using the link at the bottom of this page."],
        },
      ],
    },
    ar: {
      title: "شروط الخدمة",
      updated: "آخر تحديث: 26 نوفمبر 2026",
      intro:
        "الشروط دي بتوضح إزاي تقدر تستخدم ClinicSquad، وهو تطبيق ويب بيساعد العيادات في إدارة المرضى والمواعيد والروشتات والمالية. بطلبك للتجربة أو باستخدامك للخدمة، أنت موافق على الشروط دي. لو مش موافق، من فضلك متستخدمش الخدمة.",
      sections: [
        {
          h: "1. الخدمة",
          p: [
            "ClinicSquad أداة لإدارة العيادة. هي مش نصيحة طبية، ومبتاخدش قرارات علاجية، ومش بديل عن سجلاتك أو حكمك المهني.",
            "الخدمة جديدة ولسه بنطورها. ممكن المميزات تتغير، ومش بنضمن إنها تفضل شغالة دايمًا أو من غير أخطاء.",
          ],
        },
        {
          h: "2. الحسابات والتفعيل",
          p: [
            "حساب العيادة الجديد بيتراجع وبيتفعل من فريقنا، غالبًا عن طريق واتساب. ممكن نرفض الحساب أو نوقفه أو نقفله، مثلًا لو في إساءة استخدام أو اشتراك مش مدفوع.",
            "أنت مسؤول عن سرية كلمة المرور وعن اللي حسابات الموظفين في عيادتك بتعمله. قولنا بسرعة لو شكيت إن حد تاني استخدم حساب.",
          ],
        },
        {
          h: "3. التجربة المجانية والدفع",
          p: [
            "العيادات الجديدة بتاخد تجربة مجانية. بعد التجربة، الباقات المدفوعة بتتدفع يدويًا، مثلًا بتحويل على محفظة موبايل، وبترفع إيصال التحويل في التطبيق. الاشتراك بيبدأ بعد ما نتأكد من الدفع.",
            "الأسعار بتظهر في التطبيق وممكن تتغير في الفترات الجاية. لو غيرنا سعر هنقولك قبل ما يسري عليك.",
          ],
        },
        {
          h: "4. بياناتك وبيانات مرضاك",
          p: [
            "البيانات اللي العيادة بتدخلها ملك العيادة. والعيادة مسؤولة إنها تدخلها بشكل قانوني، ومنها الحصول على موافقة مرضاها لو لازم، والالتزام بالقواعد المنظمة لمهنتها.",
            "إحنا بنستخدم بياناتك بس لتشغيل الخدمة ليك، زي ما هو موضح في سياسة الخصوصية.",
          ],
        },
        {
          h: "5. ممنوع",
          p: [
            "متستخدمش ClinicSquad في أي حاجة مخالفة للقانون، ومتحاولش توصل لبيانات عيادة تانية، ومتحاولش تعطل الخدمة أو تحمّل عليها، ومتشاركش بيانات دخولك مع ناس برة عيادتك.",
          ],
        },
        {
          h: "6. النسخ الاحتياطي وضياع البيانات",
          p: [
            "بنعمل نسخ مشفرة من قاعدة البيانات بشكل منتظم، لكن مش قادرين نضمن إن مفيش بيانات هتضيع أبدًا. احتفظ بنسخة من أي سجلات مهمة ليك في مكان تاني كمان.",
          ],
        },
        {
          h: "7. المسؤولية",
          p: [
            "الخدمة بتتقدم زي ما هي. في الحدود اللي القانون بيسمح بيها، إحنا مش مسؤولين عن خسائر بسبب توقف الخدمة أو الأخطاء أو ضياع البيانات، ولا عن قرارات طبية أو تجارية اتاخدت بالاعتماد على التطبيق.",
          ],
        },
        {
          h: "8. إنهاء الحساب",
          p: [
            "تقدر توقف استخدام ClinicSquad في أي وقت وتطلب مننا نقفل حسابك ونمسح بيانات عيادتك (شوف سياسة الخصوصية). ممكن إحنا كمان ننهي الخدمة أو حساب، وهنحاول نبلغك قبلها لو قدرنا.",
          ],
        },
        {
          h: "9. تغيير الشروط",
          p: ["ممكن نحدّث الشروط دي. التاريخ في أول الصفحة بيوضح آخر نسخة. لو كملت استخدام الخدمة بعد التغيير، يبقى وافقت على النسخة الجديدة."],
        },
        {
          h: "10. التواصل",
          p: ["لأي سؤال عن الشروط: ابعتلنا على واتساب من الرابط اللي في آخر الصفحة دي."],
        },
      ],
    },
  },
  privacy: {
    en: {
      title: "Privacy Policy",
      updated: "Last updated: 26 November 2026",
      intro:
        "This page explains what information ClinicSquad stores, why, and who can see it. ClinicSquad handles health-related information for clinics, so we try to keep this simple and honest.",
      sections: [
        {
          h: "1. What we store",
          p: [
            "Clinic and account details: clinic name, owner and staff names, email, phone or WhatsApp number, specialty, and a hashed (not readable) password.",
            "Clinic records the clinic enters: patients, appointments, visits, prescriptions, lab results and attachments, and finance records.",
            "Payment proof: when a clinic pays for a plan, the transfer receipt image and reference number it uploads.",
            "Security and activity logs: sign-in events with IP address and browser details, and a log of admin actions.",
            "The app keeps your sign-in session in your browser's local storage. We do not use advertising trackers.",
          ],
        },
        {
          h: "2. Why we use it",
          p: [
            "To run the service for your clinic, to activate accounts and confirm payments, to keep accounts secure, and to fix problems. We do not sell your data and we do not use it for advertising.",
          ],
        },
        {
          h: "3. Who can see it",
          p: [
            "Your clinic's own users can see the clinic's data, based on their role (for example doctor, nurse, reception).",
            "The ClinicSquad team can see account details, subscription and payment information, and logs, to run the service. Because we operate the database, we could technically reach clinic records. We only do so to fix a problem or when you ask us to, and we do not browse patient records.",
            "We do not share clinic data with other clinics.",
          ],
        },
        {
          h: "4. Where it is stored",
          p: [
            "Data is stored with cloud providers: the database with Neon, and the website and server with Vercel. Their servers can be outside Egypt. Nightly backups are encrypted before they are stored.",
          ],
        },
        {
          h: "5. How long we keep it",
          p: [
            "We keep clinic data while the account is active. Encrypted backups are kept for about 30 days, so deleted data can remain in a backup for up to that long.",
          ],
        },
        {
          h: "6. Your choices",
          p: [
            "You can ask us to correct your data, give you a copy, or close your account and delete your clinic's data. Message us on WhatsApp using the link below. We will answer as soon as we can.",
          ],
        },
        {
          h: "7. Patients' information",
          p: [
            "The clinic decides what patient information it enters and is responsible for having the patient's permission where required. Patients who want to see or correct their information should ask their clinic first.",
          ],
        },
        {
          h: "8. Security",
          p: [
            "Passwords are stored hashed, access is controlled by role, and backups are encrypted. No system is perfectly secure. If we learn that your data was exposed, we will tell the affected clinic.",
          ],
        },
        {
          h: "9. Changes",
          p: ["We may update this policy. The date at the top shows the latest version."],
        },
      ],
    },
    ar: {
      title: "سياسة الخصوصية",
      updated: "آخر تحديث: 26 نوفمبر 2026",
      intro:
        "الصفحة دي بتوضح إيه المعلومات اللي ClinicSquad بيخزنها، ليه، ومين يقدر يشوفها. التطبيق بيتعامل مع معلومات صحية للعيادات، فحاولنا نكتب كل حاجة ببساطة ومن غير لف.",
      sections: [
        {
          h: "1. إيه اللي بنخزنه",
          p: [
            "بيانات العيادة والحساب: اسم العيادة، أسماء المالك والموظفين، الإيميل، رقم الموبايل أو الواتساب، التخصص، وكلمة مرور مشفرة (مش مقروءة).",
            "بيانات العيادة اللي العيادة بتدخلها: المرضى، المواعيد، الزيارات، الروشتات، نتايج التحاليل والمرفقات، والسجلات المالية.",
            "إثبات الدفع: لما العيادة تدفع اشتراك، بنخزن صورة إيصال التحويل ورقم المرجع اللي رفعتهم.",
            "سجلات الأمان والنشاط: أحداث تسجيل الدخول مع عنوان IP وبيانات المتصفح، وسجل بإجراءات الإدارة.",
            "التطبيق بيحفظ جلسة الدخول في التخزين المحلي للمتصفح. مبنستخدمش أدوات تتبع إعلانية.",
          ],
        },
        {
          h: "2. بنستخدمها ليه",
          p: [
            "عشان نشغّل الخدمة لعيادتك، ونفعّل الحسابات ونأكد الدفع، ونحافظ على أمان الحسابات، ونصلّح المشاكل. مبنبيعش بياناتك ومبنستخدمهاش في إعلانات.",
          ],
        },
        {
          h: "3. مين يقدر يشوفها",
          p: [
            "مستخدمو عيادتك بس يقدروا يشوفوا بيانات العيادة، حسب دور كل واحد (دكتور، تمريض، استقبال).",
            "فريق ClinicSquad يقدر يشوف بيانات الحساب ومعلومات الاشتراك والدفع والسجلات عشان نشغل الخدمة. وبما إننا اللي بنشغل قاعدة البيانات، فتقنيًا ممكن نوصل لسجلات العيادة. بنعمل كده بس لإصلاح مشكلة أو لو انت طلبت، ومبنتصفحش سجلات المرضى.",
            "مبنشاركش بيانات عيادة مع عيادة تانية.",
          ],
        },
        {
          h: "4. بتتخزن فين",
          p: [
            "البيانات بتتخزن عند مزودي خدمة سحابية: قاعدة البيانات عند Neon، والموقع والسيرفر عند Vercel. سيرفراتهم ممكن تكون خارج مصر. النسخ الاحتياطية الليلية بتتشفر قبل ما تتخزن.",
          ],
        },
        {
          h: "5. بنحتفظ بيها قد إيه",
          p: [
            "بنحتفظ ببيانات العيادة طول ما الحساب شغال. النسخ الاحتياطية المشفرة بتفضل حوالي 30 يوم، فالبيانات المحذوفة ممكن تفضل في نسخة احتياطية لحد المدة دي.",
          ],
        },
        {
          h: "6. اختياراتك",
          p: [
            "تقدر تطلب مننا نصحح بياناتك، أو نديك نسخة منها، أو نقفل حسابك ونمسح بيانات عيادتك. ابعتلنا على واتساب من الرابط اللي تحت وهنرد في أقرب وقت.",
          ],
        },
        {
          h: "7. معلومات المرضى",
          p: [
            "العيادة هي اللي بتقرر إيه معلومات المريض اللي تدخلها، وهي المسؤولة عن الحصول على إذن المريض لما يكون مطلوب. المريض اللي عايز يشوف معلوماته أو يصححها يطلب ده من عيادته الأول.",
          ],
        },
        {
          h: "8. الأمان",
          p: [
            "كلمات المرور بتتخزن مشفرة، والدخول بيتحكم فيه حسب الدور، والنسخ الاحتياطية مشفرة. مفيش نظام آمن 100%. لو عرفنا إن بيانات اتسربت هنبلغ العيادة المتأثرة.",
          ],
        },
        {
          h: "9. التغييرات",
          p: ["ممكن نحدّث السياسة دي. التاريخ في أول الصفحة بيوضح آخر نسخة."],
        },
      ],
    },
  },
};

export default function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const { lang, setLang } = useLang();
  const ar = lang === "ar";
  const doc = docs[kind][ar ? "ar" : "en"];
  const other = kind === "terms" ? "privacy" : "terms";
  const otherTitle = docs[other][ar ? "ar" : "en"].title;

  return (
    <div className="min-h-screen bg-background text-foreground" dir={ar ? "rtl" : "ltr"}>
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </span>
            ClinicSquad
          </Link>
          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            className="text-sm text-primary hover:underline"
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{doc.updated}</p>
        <p className="leading-relaxed mb-8">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h} className="mb-6">
            <h2 className="text-lg font-semibold mb-2">{s.h}</h2>
            {s.p.map((para) => (
              <p key={para} className="leading-relaxed text-muted-foreground mb-2">
                {para}
              </p>
            ))}
          </section>
        ))}
        <div className="mt-10 pt-6 border-t border-border text-sm flex flex-wrap gap-x-6 gap-y-2">
          <Link href={`/${other}`} className="text-primary hover:underline">
            {otherTitle}
          </Link>
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {ar ? "تواصل معنا على واتساب" : "Contact us on WhatsApp"}
          </a>
          <Link href="/register" className="text-primary hover:underline">
            {ar ? "طلب تجربة مجانية" : "Request a free trial"}
          </Link>
        </div>
      </main>
    </div>
  );
}
