import { useRef, useState } from "react";
import { createStand } from "../api";
import type { StandFormData } from "../types";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../ui";

const EDIT_TOKEN_KEY = "flohmarkt_edit_token";
const MIN_SUBMIT_MS = 3000;

interface Props {
  onSuccess: () => void;
}

export const KATEGORIEN = [
  "Kleidung",
  "Spielzeug",
  "Möbel",
  "Bücher",
  "Elektro",
  "Sonstiges",
] as const;

const EMPTY: StandFormData = {
  name: "",
  adresse: "",
  beschreibung: "",
  email: "",
  kategorien: [],
  uhrzeit: "",
  website: "", // Honeypot
};

const RULES = [
  "Ich biete ausschließlich gebrauchte Waren an (keine neuen Produkte).",
  "Mein Stand befindet sich auf meinem Privatgrundstück innerhalb Zirndorfs.",
  "Ich bin kein gewerblicher Anbieter.",
  "Ich markiere meinen Stand mit mindestens 3 bunten Luftballons.",
] as const;

export function StandForm({ onSuccess }: Props) {
  const [form, setForm] = useState<StandFormData>(EMPTY);
  const [confirmed, setConfirmed] = useState<boolean[]>(RULES.map(() => false));
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [editToken, setEditToken] = useState<string | null>(null);
  const mountedAt = useRef(Date.now());

  const allConfirmed = confirmed.every(Boolean);

  const toggleKategorie = (k: string) => {
    setForm((f) => ({
      ...f,
      kategorien: f.kategorien.includes(k)
        ? f.kategorien.filter((c) => c !== k)
        : [...f.kategorien, k],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.adresse || !form.email) {
      setErrorMsg("Name, Adresse und E-Mail sind Pflichtfelder.");
      setStatus("error");
      return;
    }
    if (!allConfirmed) {
      setErrorMsg("Bitte bestätige alle Hinweise.");
      setStatus("error");
      return;
    }
    if (Date.now() - mountedAt.current < MIN_SUBMIT_MS) {
      setErrorMsg("Bitte fülle das Formular etwas langsamer aus.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const created = await createStand(form);
      localStorage.setItem(EDIT_TOKEN_KEY, created.edit_token);
      setEditToken(created.edit_token);
      setStatus("success");
      setForm(EMPTY);
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("error");
    }
  };

  if (status === "success" && editToken) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <p role="alert" className="font-medium text-green-700">
            Dein Stand wurde eingereicht!
          </p>
          <p className="text-sm text-gray-700">
            Wir haben dir eine Bestätigungsmail geschickt. Bitte klicke auf den Link in der Mail,
            damit dein Stand auf der Karte erscheint.
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Speichere außerdem diesen Link, um deinen Stand später zu verwalten:
          </p>
          <code className="select-all break-all rounded bg-gray-100 px-2 py-1 text-xs">
            {window.location.origin}
            {window.location.pathname}#mein-stand/{editToken}
          </code>
          <p className="text-xs text-gray-400">
            Der Link ist auch in deinem Browser gespeichert und erscheint oben auf der Seite.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stand anmelden</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {status === "error" && (
            <p role="alert" className="text-sm text-red-600">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Name *
            </label>
            <input
              id="name"
              className="rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={status === "loading"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="adresse" className="text-sm font-medium">
              Adresse *
            </label>
            <input
              id="adresse"
              className="rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="z.B. Musterstraße 1, Zirndorf"
              value={form.adresse}
              onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
              disabled={status === "loading"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="uhrzeit" className="text-sm font-medium">
              Uhrzeit (optional)
            </label>
            <input
              id="uhrzeit"
              className="rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="z.B. 9:00 – 14:00 Uhr"
              value={form.uhrzeit}
              onChange={(e) => setForm((f) => ({ ...f, uhrzeit: e.target.value }))}
              disabled={status === "loading"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Kategorien (optional)</span>
            <div className="flex flex-wrap gap-2">
              {KATEGORIEN.map((k) => {
                const active = form.kategorien.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKategorie(k)}
                    disabled={status === "loading"}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      active
                        ? "border-[#009a00] bg-[#009a00] text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-[#009a00] hover:text-[#009a00]"
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="beschreibung" className="text-sm font-medium">
              Was gibt es zu kaufen?
            </label>
            <textarea
              id="beschreibung"
              className="min-h-[80px] resize-y rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              value={form.beschreibung}
              onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
              disabled={status === "loading"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              E-Mail *
            </label>
            <input
              id="email"
              type="email"
              className="rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="deine@email.de"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={status === "loading"}
            />
            <p className="text-xs text-gray-500">
              Du erhältst einen Bestätigungslink per Mail – erst danach wird dein Stand sichtbar.
            </p>
          </div>

          {/* Teilnahmebedingungen */}
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              Bitte bestätige die Teilnahmebedingungen:
            </p>
            {RULES.map((rule, i) => (
              <label key={rule} className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#009a00]"
                  checked={confirmed[i]}
                  onChange={(e) =>
                    setConfirmed((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                  }
                  disabled={status === "loading"}
                />
                <span className="text-sm text-amber-900">{rule}</span>
              </label>
            ))}
            <p className="mt-1 text-xs text-amber-700">
              Weitere Infos auf der{" "}
              <a href="#faq" className="underline hover:text-amber-900">
                Regeln & FAQ-Seite
              </a>
              .
            </p>
          </div>

          {/* Honeypot */}
          <div aria-hidden="true" className="hidden">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={status === "loading" || !allConfirmed}
            style={{ backgroundColor: allConfirmed ? "#009a00" : undefined }}
          >
            {status === "loading" ? "Wird eingereicht…" : "Stand anmelden"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
