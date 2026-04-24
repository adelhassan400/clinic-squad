import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";

export interface CurrencyOption {
  code: string;
  country: string;
  countryAr: string;
  flag: string;
  locale: string;
}

export const CURRENCIES: CurrencyOption[] = [
  // Arab League
  { code: "EGP", country: "Egypt",        countryAr: "مصر",          flag: "🇪🇬", locale: "en-EG" },
  { code: "SAR", country: "Saudi Arabia", countryAr: "السعودية",      flag: "🇸🇦", locale: "en-SA" },
  { code: "AED", country: "UAE",          countryAr: "الإمارات",       flag: "🇦🇪", locale: "en-AE" },
  { code: "QAR", country: "Qatar",        countryAr: "قطر",           flag: "🇶🇦", locale: "en-QA" },
  { code: "KWD", country: "Kuwait",       countryAr: "الكويت",        flag: "🇰🇼", locale: "en-KW" },
  { code: "BHD", country: "Bahrain",      countryAr: "البحرين",       flag: "🇧🇭", locale: "en-BH" },
  { code: "OMR", country: "Oman",         countryAr: "عُمان",          flag: "🇴🇲", locale: "en-OM" },
  { code: "JOD", country: "Jordan",       countryAr: "الأردن",         flag: "🇯🇴", locale: "en-JO" },
  { code: "LBP", country: "Lebanon",      countryAr: "لبنان",         flag: "🇱🇧", locale: "en-LB" },
  { code: "SYP", country: "Syria",        countryAr: "سوريا",         flag: "🇸🇾", locale: "en-SY" },
  { code: "IQD", country: "Iraq",         countryAr: "العراق",         flag: "🇮🇶", locale: "en-IQ" },
  { code: "YER", country: "Yemen",        countryAr: "اليمن",         flag: "🇾🇪", locale: "en-YE" },
  { code: "LYD", country: "Libya",        countryAr: "ليبيا",         flag: "🇱🇾", locale: "en-LY" },
  { code: "TND", country: "Tunisia",      countryAr: "تونس",          flag: "🇹🇳", locale: "en-TN" },
  { code: "DZD", country: "Algeria",      countryAr: "الجزائر",        flag: "🇩🇿", locale: "en-DZ" },
  { code: "MAD", country: "Morocco",      countryAr: "المغرب",        flag: "🇲🇦", locale: "en-MA" },
  { code: "MRU", country: "Mauritania",   countryAr: "موريتانيا",     flag: "🇲🇷", locale: "en-MR" },
  { code: "SDG", country: "Sudan",        countryAr: "السودان",       flag: "🇸🇩", locale: "en-SD" },
  { code: "SOS", country: "Somalia",      countryAr: "الصومال",       flag: "🇸🇴", locale: "en-SO" },
  { code: "DJF", country: "Djibouti",     countryAr: "جيبوتي",        flag: "🇩🇯", locale: "en-DJ" },
  { code: "KMF", country: "Comoros",      countryAr: "جزر القمر",     flag: "🇰🇲", locale: "en-KM" },
  { code: "ILS", country: "Palestine",    countryAr: "فلسطين",        flag: "🇵🇸", locale: "en-PS" },
  // Requested non-Arab
  { code: "USD", country: "United States", countryAr: "الولايات المتحدة", flag: "🇺🇸", locale: "en-US" },
  { code: "CAD", country: "Canada",        countryAr: "كندا",            flag: "🇨🇦", locale: "en-CA" },
  { code: "GBP", country: "United Kingdom", countryAr: "المملكة المتحدة",  flag: "🇬🇧", locale: "en-GB" },
];

const DEFAULT_CODE = "EGP";
const STORAGE_KEY = "clinicsquad_currency";

function isValidCode(code: string | null): code is string {
  return !!code && CURRENCIES.some((c) => c.code === code);
}

function symbolFor(code: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === "currency")?.value;
    return sym ?? code;
  } catch {
    return code;
  }
}

export function formatCurrencyWith(amount: number, code: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${code}`;
  }
}

interface CurrencyContextType {
  currency: CurrencyOption;
  setCurrencyCode: (code: string) => void;
  format: (amount: number) => string;
  symbol: string;
  options: CurrencyOption[];
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return isValidCode(stored) ? stored : DEFAULT_CODE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, [code]);

  const value = useMemo<CurrencyContextType>(() => {
    const currency = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
    return {
      currency,
      setCurrencyCode: (c: string) => {
        if (isValidCode(c)) setCode(c);
      },
      format: (amount: number) => formatCurrencyWith(amount, currency.code, currency.locale),
      symbol: symbolFor(currency.code, currency.locale),
      options: CURRENCIES,
    };
  }, [code]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
