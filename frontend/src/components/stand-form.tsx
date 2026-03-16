import { useRef, useState } from "react";
import { createStand } from "../api";
import type { StandFormData } from "../types";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../ui";

const EDIT_TOKEN_KEY = "flohmarkt_edit_token";
const MIN_SUBMIT_MS = 3000; // Einreichung muss mindestens 3 Sekunden nach Laden kommen

interface Props {
  onSuccess: () => void;
}

const EMPTY: StandFormData = {
  name: "",
  adresse: "",
  beschreibung: "",
  email: "",
  website: "", // Honeypot
};

export function StandForm({ onSuccess }: Props) {
  const [form, setForm] = useState<StandFormData>(EMPTY);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [editToken, setEditToken] = useState<string | null>(null);
  const mountedAt = useRef(Date.now());

  const handleSubmit = async () => {
    if (!form.name || !form.adresse || !form.email) {
      setErrorMsg("Name, Adresse und E-Mail sind Pflichtfelder.");
      setStatus("error");
      return;
    }

    // Zeitprüfung: zu schnell = vermutlich Bot
    if (Date.now() - mountedAt.current < MIN_SUBMIT_MS) {
      setErrorMsg("Bitte fülle das Formular etwas langsamer aus.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const created = await createStand(form);
      // Token im Browser speichern → ermöglicht späteren Zugriff
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
        <CardContent className="pt-6 flex flex-col gap-3">
          <p role="alert" className="text-green-700 font-medium">
            Dein Stand wurde eingereicht!
          </p>
          <p className="text-sm text-gray-700">
            Wir haben dir eine Bestätigungsmail geschickt. Bitte klicke auf den Link in der
            Mail, damit dein Stand auf der Karte erscheint.
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Speichere außerdem diesen Link, um deinen Stand später zu verwalten:
          </p>
          <code className="text-xs bg-gray-100 rounded px-2 py-1 break-all select-all">
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
            <p role="alert" className="text-red-600 text-sm">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Name *
            </label>
            <input
              id="name"
              className="border border-input rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
              className="border border-input rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="z.B. Musterstraße 1, Zirndorf"
              value={form.adresse}
              onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
              disabled={status === "loading"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="beschreibung" className="text-sm font-medium">
              Was gibt es zu kaufen?
            </label>
            <textarea
              id="beschreibung"
              className="border border-input rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 min-h-[80px] resize-y"
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
              className="border border-input rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="deine@email.de"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={status === "loading"}
            />
            <p className="text-xs text-gray-500">
              Du erhältst einen Bestätigungslink per Mail – erst danach wird dein Stand sichtbar.
            </p>
          </div>

          {/* Honeypot – für Menschen unsichtbar, für Bots verlockend */}
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

          <Button onClick={handleSubmit} disabled={status === "loading"}>
            {status === "loading" ? "Wird eingereicht…" : "Stand anmelden"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
