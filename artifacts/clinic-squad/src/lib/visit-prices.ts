import { useCallback, useEffect, useState } from "react";
import { DEFAULT_VISIT_TYPE_PRICES, VISIT_TYPES, type VisitType } from "./visit-types";

const STORAGE_PREFIX = "clinicsquad:visit-prices:";

type PriceMap = Record<VisitType, number>;

function storageKey(clinicId: string | undefined): string {
  return `${STORAGE_PREFIX}${clinicId ?? "default"}`;
}

function readPrices(clinicId: string | undefined): PriceMap {
  if (typeof window === "undefined") return { ...DEFAULT_VISIT_TYPE_PRICES };
  try {
    const raw = window.localStorage.getItem(storageKey(clinicId));
    if (!raw) return { ...DEFAULT_VISIT_TYPE_PRICES };
    const parsed = JSON.parse(raw) as Partial<Record<string, number>>;
    const merged = { ...DEFAULT_VISIT_TYPE_PRICES };
    for (const vt of VISIT_TYPES) {
      const v = parsed?.[vt];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        merged[vt] = v;
      }
    }
    return merged;
  } catch {
    return { ...DEFAULT_VISIT_TYPE_PRICES };
  }
}

export function getVisitTypePrice(
  clinicId: string | undefined,
  type: string | null | undefined,
): number | undefined {
  if (!type) return undefined;
  if (!(VISIT_TYPES as string[]).includes(type)) return undefined;
  const prices = readPrices(clinicId);
  return prices[type as VisitType];
}

export function useVisitTypePrices(clinicId: string | undefined) {
  const [prices, setPrices] = useState<PriceMap>(() => readPrices(clinicId));

  useEffect(() => {
    setPrices(readPrices(clinicId));
  }, [clinicId]);

  const updatePrice = useCallback(
    (type: VisitType, value: number) => {
      setPrices((prev) => {
        const next = { ...prev, [type]: value };
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(storageKey(clinicId), JSON.stringify(next));
          } catch {
            /* ignore quota errors */
          }
        }
        return next;
      });
    },
    [clinicId],
  );

  const resetPrices = useCallback(() => {
    setPrices({ ...DEFAULT_VISIT_TYPE_PRICES });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(storageKey(clinicId));
      } catch {
        /* ignore */
      }
    }
  }, [clinicId]);

  return { prices, updatePrice, resetPrices };
}
