import { cn } from "@/lib/utils";

export type VisitType =
  | "New Consultation"
  | "Follow-up"
  | "Emergency"
  | "Procedure"
  | "Session";

export const VISIT_TYPES: VisitType[] = [
  "New Consultation",
  "Follow-up",
  "Emergency",
  "Procedure",
  "Session",
];

interface VisitTypeStyle {
  badge: string;
  dot: string;
  bar: string;
}

const VISIT_TYPE_STYLES: Record<VisitType, VisitTypeStyle> = {
  "New Consultation": {
    badge:
      "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
  },
  "Follow-up": {
    badge:
      "bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400",
    dot: "bg-green-500",
    bar: "bg-green-500",
  },
  Emergency: {
    badge:
      "bg-red-500/10 text-red-600 border-red-500/40 dark:text-red-400",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
  Procedure: {
    badge:
      "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400",
    dot: "bg-purple-500",
    bar: "bg-purple-500",
  },
  Session: {
    badge:
      "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
};

const FALLBACK_STYLE: VisitTypeStyle = {
  badge:
    "bg-muted text-muted-foreground border-border/60",
  dot: "bg-muted-foreground/50",
  bar: "bg-muted-foreground/40",
};

export function isKnownVisitType(value: string | null | undefined): value is VisitType {
  return !!value && (VISIT_TYPES as string[]).includes(value);
}

export function getVisitTypeStyle(type: string | null | undefined): VisitTypeStyle {
  if (isKnownVisitType(type)) return VISIT_TYPE_STYLES[type];
  return FALLBACK_STYLE;
}

interface VisitTypeBadgeProps {
  type: string | null | undefined;
  className?: string;
  withDot?: boolean;
}

export function VisitTypeBadge({ type, className, withDot = true }: VisitTypeBadgeProps) {
  const style = getVisitTypeStyle(type);
  const label = type && type.trim() ? type : "Unspecified";
  return (
    <span
      data-testid={`visit-type-badge-${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        style.badge,
        className,
      )}
    >
      {withDot && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
      )}
      {label}
    </span>
  );
}
