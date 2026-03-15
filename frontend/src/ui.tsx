/**
 * Minimale UI-Komponenten als Ersatz für @openzirndorf/ui.
 * Keine externe Abhängigkeit – nur Tailwind-Klassen.
 */
import type { ComponentProps } from "react";

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("font-bold leading-none tracking-tight", className)} {...props} />;
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
        "inline-flex items-center justify-center rounded-full px-5 py-2.5",
        "bg-[--oz-green] text-white font-semibold text-sm",
        "hover:bg-[--oz-green-hover] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--oz-green] focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}
