import { useEffect, useRef, useState } from "react";
import { createStand, fetchSettings } from "../api";
import { ZAHLUNGSARTEN, ZAHLUNGSART_ICON } from "../lib/zahlungsarten";
import type { StandFormData } from "../types";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../ui";
import { PORTAL_URL } from "./footer";

export { ZAHLUNGSART_ICON, ZAHLUNGSARTEN } from "../lib/zahlungsarten";

const MIN_SUBMIT_MS = 3000;

interface Props {
  onSuccess: () => void;
}

export const KATEGORIEN = [
  "Babyausstattung",
  "Kinderbekleidung",
  "Damenbekleidung",
  "Herrenbekleidung",
  "Spielzeug",
  "Bücher",
  "Schallplatten",
  "Videospiele",
  "Möbel",
  "Haushaltswaren",
  "Deko",
  "Elektronik",
  "Fahrräder",
  "Werkzeug",
  "Schmuck",
  "Kunst",
  "Handgemachtes",
  "Sonstiges",
] as const;

// Muss mit _MAX_KATEGORIEN in app/routes/stands.py übereinstimmen.
export const MAX_KATEGORIEN = 5;

const EMPTY: StandFormData = {
  adresse: "",
  beschreibung: "",
  email: "",
  kategorien: [],
  zahlungsarten: [],
  datenschutz_zustimmung: false,
  mindestalter_bestaetigt: false,
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
  // Ein Haken für alle vier Regeln statt vier einzelner - das sind
  // Verhaltensregeln, keine getrennt einwilligungspflichtigen Zwecke, ein
  // gemeinsamer Haken ("ich halte mich an das alles") ist hier ausreichend
  // und weniger umständlich als vier Klicks für denselben Absatz.
  const [rulesConfirmed, setRulesConfirmed] = useState(false);
  // Auch Datenschutz-Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) und
  // Altersbestätigung (Art. 8 DSGVO) in einem Haken zusammengefasst: beide
  // sind ohnehin zwingende Voraussetzungen für die Teilnahme (kein Fall, in
  // dem jemand sinnvoll das eine ohne das andere angeben würde), anders als
  // z.B. Werbe-Einwilligung vs. Adressveröffentlichung, die man getrennt
  // ablehnen können müsste. Serverseitig weiterhin zwei getrennte Felder
  // (siehe app/routes/stands.py create_stand) - nur die Checkbox ist eine.
  const [consentOk, setConsentOk] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [nickname, setNickname] = useState<string | null>(null);
  const mountedAt = useRef(Date.now());

  // Default true (Feld sichtbar), damit bei fehlendem Netz oder während
  // die Anfrage noch läuft nichts blockiert wird - fällt nur zu, wenn
  // ein Admin es aktiv über die Einstellungen ausgeschaltet hat.
  const [beschreibungEnabled, setBeschreibungEnabled] = useState(true);
  useEffect(() => {
    fetchSettings()
      .then((s) => setBeschreibungEnabled(s.beschreibung_enabled))
      .catch(() => {});
  }, []);

  const allConfirmed = rulesConfirmed && consentOk;

  const toggleKategorie = (k: string) => {
    setForm((f) => {
      if (!f.kategorien.includes(k) && f.kategorien.length >= MAX_KATEGORIEN) return f;
      return {
        ...f,
        kategorien: f.kategorien.includes(k)
          ? f.kategorien.filter((c) => c !== k)
          : [...f.kategorien, k],
      };
    });
  };

  const toggleZahlungsart = (z: string) => {
    setForm((f) => ({
      ...f,
      zahlungsarten: f.zahlungsarten.includes(z)
        ? f.zahlungsarten.filter((c) => c !== z)
        : [...f.zahlungsarten, z],
    }));
  };

  const handleSubmit = async () => {
    if (!form.adresse || !form.email) {
      setErrorMsg("Adresse und E-Mail sind Pflichtfelder.");
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
      const created = await createStand({
        ...form,
        datenschutz_zustimmung: consentOk,
        mindestalter_bestaetigt: consentOk,
      });
      setNickname(created.nickname);
      setStatus("success");
      setForm(EMPTY);
      setRulesConfirmed(false);
      setConsentOk(false);
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <p role="alert" className="font-medium text-green-700">
            Dein Stand wurde eingereicht!
          </p>
          <p className="text-sm text-gray-700">
            Wir haben dir eine E-Mail mit einem Bestätigungscode geschickt. Gib ihn unter "Mein
            Stand" ein - erst danach erscheint dein Stand auf der Karte.
          </p>
          <p className="text-sm text-gray-700">
            Auf der Karte und in der Liste erscheinst du unter deiner Adresse - nie mit deinem
            echten Namen.
            {nickname && (
              <>
                {" "}
                Unter „Mein Stand" findest du deinen Stand außerdem unter der internen Kennung{" "}
                <strong>„{nickname}“</strong> wieder.
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Mit demselben Code kannst du deinen Stand danach auch jederzeit bearbeiten oder
            vollständig löschen. Solltest du die Mail verlieren, kannst du dir über "Mein Stand"
            jederzeit einen neuen Code schicken lassen.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Schön, dass du dabei bist! Der Garagenflohmarkt ist ein ehrenamtliches Projekt von{" "}
            <a
              href={PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              OpenZirndorf
            </a>{" "}
            - wer mag, kann uns auch über eine Fördermitgliedschaft unterstützen.
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
            <p className="text-xs text-gray-500">
              Straße und Hausnummer werden nach der Bestätigung <strong>öffentlich</strong> auf der
              Karte und in der Liste angezeigt. Bist du nicht Eigentümer*in des Grundstücks? Frag
              vorher Vermieter*in oder Hausverwaltung.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Kategorien (optional, max. {MAX_KATEGORIEN})
            </span>
            <div className="flex flex-wrap gap-2">
              {KATEGORIEN.map((k) => {
                const active = form.kategorien.includes(k);
                const disabled =
                  status === "loading" || (!active && form.kategorien.length >= MAX_KATEGORIEN);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKategorie(k)}
                    disabled={disabled}
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
            <span className="text-sm font-medium">
              Welche Zahlungsarten bietest du an? (optional)
            </span>
            <div className="flex flex-wrap gap-2">
              {ZAHLUNGSARTEN.map((z) => {
                const active = form.zahlungsarten.includes(z);
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => toggleZahlungsart(z)}
                    disabled={status === "loading"}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-blue-600 hover:text-blue-600"
                    }`}
                  >
                    {ZAHLUNGSART_ICON[z] ?? "💳"} {z}
                  </button>
                );
              })}
            </div>
          </div>

          {beschreibungEnabled && (
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
          )}

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
              Du erhältst einen Bestätigungscode per Mail – erst danach wird dein Stand sichtbar.
              Auf der Karte und in der Liste erscheinst du unter deiner Adresse, nie mit deinem
              echten Namen.
            </p>
          </div>

          {/* Teilnahmebedingungen - ein gemeinsamer Haken statt vier
              einzelner (siehe Kommentar bei rulesConfirmed oben). */}
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">Teilnahmebedingungen:</p>
            <ul className="flex flex-col gap-0.5 pl-4 text-sm text-amber-900 [&>li]:list-disc">
              {RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <label className="mt-1 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#009a00]"
                checked={rulesConfirmed}
                onChange={(e) => setRulesConfirmed(e.target.checked)}
                disabled={status === "loading"}
              />
              <span className="text-sm font-medium text-amber-900">
                Ich bestätige, dass das alles auf meinen Stand zutrifft.
              </span>
            </label>
            <p className="mt-1 text-xs text-amber-700">
              Weitere Infos auf der{" "}
              <a href="#faq" className="underline hover:text-amber-900">
                Regeln & FAQ-Seite
              </a>
              .
            </p>
          </div>

          {/* Datenschutz-Einwilligung - bewusst als eigene Box getrennt von
              den Teilnahmebedingungen oben: keine Verhaltensregel, sondern
              die Rechtsgrundlage (Art. 6 Abs. 1 lit. a DSGVO) für die
              Adressveröffentlichung. Alter und Adress-Einwilligung dagegen
              in einem gemeinsamen Haken (siehe Kommentar bei consentOk
              oben) - anders als bei den Teilnahmeregeln oben oder einer
              echten Zweitwahl (z.B. Werbe-Einwilligung) gibt es hier keinen
              Fall, in dem jemand sinnvoll nur eines von beiden angeben
              wollte. */}
          <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">Datenschutz:</p>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#009a00]"
                checked={consentOk}
                onChange={(e) => setConsentOk(e.target.checked)}
                disabled={status === "loading"}
              />
              <span className="text-sm text-blue-900">
                Ich bin mindestens 16 Jahre alt und willige ein, dass meine Adresse (Straße und
                Hausnummer) öffentlich auf der Karte und in der Liste angezeigt wird. Ich kann diese
                Einwilligung jederzeit widerrufen, indem ich meinen Stand unter „Mein Stand"
                vollständig lösche. Mehr dazu in der{" "}
                <a href="#datenschutz" className="underline hover:text-blue-900">
                  Datenschutzerklärung
                </a>
                .
              </span>
            </label>
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
