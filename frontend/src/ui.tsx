/**
 * Minimale UI-Komponenten als Ersatz für @openzirndorf/ui.
 * Keine externe Abhängigkeit – nur Tailwind-Klassen.
 */
import type { ComponentProps } from "react";

export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      style={{ borderRadius: "var(--oz-radius-lg)", boxShadow: "var(--oz-shadow-sm)" }}
      className={cn("border border-gray-200 bg-white p-6", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      style={{ fontFamily: "var(--oz-font-heading)" }}
      className={cn("text-lg font-bold leading-none", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(className)} {...props} />;
}

export function Button({ className, disabled, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-6 py-2.5",
        "bg-[--oz-green] text-sm font-semibold text-white",
        "transition-colors hover:bg-[--oz-green-hover]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--oz-green] focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
