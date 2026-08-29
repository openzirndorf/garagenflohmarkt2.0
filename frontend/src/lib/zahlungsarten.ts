// Eigenes, UI-unabhängiges Modul statt Teil von stand-form.tsx - so kann
// auch stand-popup.ts (bewusst ohne React-/Komponenten-Importe, siehe dort)
// dieselbe Liste/Icons nutzen, ohne die ganze Formular-Komponente
// mitzuziehen.
export const ZAHLUNGSARTEN = ["PayPal", "Wero", "Barzahlung"] as const;

// Barzahlung braucht ein eigenes Icon statt der Kreditkarte, die für ein
// bargeldloses Zahlungsmittel steht - sonst suggeriert es das Gegenteil.
export const ZAHLUNGSART_ICON: Record<string, string> = {
  PayPal: "💳",
  Wero: "💳",
  Barzahlung: "💵",
};
