/**
 * Minimale UI-Komponenten als Ersatz für @openzirndorf/ui.
 * Keine externe Abhängigkeit – nur Tailwind-Klassen.
 */
import type { ComponentProps, ReactNode } from "react";

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

// Generischer Popup-Dialog für Inhalte, die man ansehen will, ohne die
// aktuelle Seite zu verlassen - z.B. FAQ/Datenschutz vom Anmeldeformular
// aus, ohne die schon eingetippten Formulardaten zu verlieren (siehe
// stand-form.tsx). Gleiche Optik/Bedienung wie der bestehende ReportDialog
// in stand-liste.tsx: Klick auf den abgedunkelten Hintergrund oder Escape
// schließt, ohne etwas zu übernehmen.
export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        // biome-ignore lint/a11y/noAutofocus: Fokus soll direkt in den Dialog wandern, damit Escape sofort funktioniert.
        autoFocus
        tabIndex={-1}
        style={{ borderRadius: "var(--oz-radius-lg)" }}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto bg-white p-6 shadow-lg outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
