import httpx

# Direkter Import statt über das Modulattribut aufzurufen: die autouse
# _no_real_geocoding-Fixture (conftest.py) monkeypatcht app.geocode.geocode
# für alle anderen Tests weg - dieser gebundene Verweis auf die echte
# Funktion bleibt davon unberührt, weil er schon beim Modul-Import
# entsteht, bevor die Fixture überhaupt läuft.
from app.geocode import (
    GeocodeResult,
    _format_adresse,
    _is_ambiguous_road,
    _nearest_ortsteil,
    _resolve_by_ortsteil_hint,
)
from app.geocode import geocode as real_geocode


# _format_adresse direkt statt nur über die HTTP-Route getestet, weil sie
# eine reine Funktion ohne I/O ist und hier live der eigentliche Fehler saß:
# 21 von 24 bestehenden Ständen fehlte die PLZ in der Listenanzeige, weil
# OpenCage/Nominatim für die meisten Treffer keine postcode-Komponente
# liefern (siehe Kommentar in app/geocode.py).
def test_format_adresse_works_without_postcode_or_city_component():
    assert (
        _format_adresse({"road": "Musterstraße", "house_number": "1"})
        == "Musterstraße 1, 90513 Zirndorf"
    )


def test_format_adresse_ignores_postcode_and_city_from_geocoder():
    # PLZ/Ort kommen bewusst nicht mehr vom Geocoder (siehe Kommentar in
    # app/geocode.py) - selbst ein widersprüchlicher Wert hätte keinen
    # Effekt, da diese App ohnehin nur Zirndorf-Adressen akzeptiert.
    result = _format_adresse(
        {"road": "Musterstraße", "house_number": "1", "postcode": "12345", "city": "Nirgendwo"}
    )
    assert result == "Musterstraße 1, 90513 Zirndorf"


def test_format_adresse_returns_none_without_house_number():
    assert _format_adresse({"road": "Musterstraße"}) is None


def test_format_adresse_returns_none_without_road():
    assert _format_adresse({"house_number": "1"}) is None


def test_nearest_ortsteil_recognizes_a_known_center_point():
    # Exakter Mittelpunkt von Weiherhof (siehe _ORTSTEILE) - muss sich
    # selbst erkennen.
    assert _nearest_ortsteil(49.4594327, 10.9283946) == "Weiherhof"


def test_nearest_ortsteil_returns_none_for_zirndorf_kernstadt():
    # Zirndorf-Zentrum (CENTER aus frontend/src/components/flohmarkt-
    # map.tsx) liegt mindestens 2,1 km von jedem Ortsteil entfernt - klar
    # außerhalb des 1-km-Radius.
    assert _nearest_ortsteil(49.4467, 10.9557) is None


def test_nearest_ortsteil_returns_none_far_outside_zirndorf():
    assert _nearest_ortsteil(52.5200, 13.4050) is None  # Berlin


# Live gemeldet: eine vertippte Straße (z.B. "Banterbach" statt der echten
# Zirndorfer Straße "Banderbach") bekam trotzdem einen Kartenpunkt, meist
# irgendwo in der Zirndorfer Ortsmitte - OpenCage/Nominatim fallen bei
# einer unbekannten Straße oft auf einen groben Orts-/Stadt-Treffer
# zurück (hier simuliert: components ohne road/house_number), die
# geo["lat"]/["lng"] daraus zeigen dann auf diesen groben, falschen
# Punkt statt gar keinen zu setzen. geocode() lehnt einen solchen zu
# ungenauen Treffer jetzt komplett ab (None), statt seine Koordinaten zu
# übernehmen - siehe Kommentar bei GeocodeResult.formatted_adresse.
async def test_geocode_rejects_coarse_opencage_match_without_house_number(monkeypatch):
    monkeypatch.setenv("GEOCODE_API_KEY", "test-key")

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "results": [
                    {
                        "geometry": {"lat": 49.4467, "lng": 10.9557},
                        "components": {"city": "Zirndorf", "postcode": "90513"},
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    assert await real_geocode("Banterbach 5") is None


async def test_geocode_accepts_precise_opencage_match(monkeypatch):
    # Positiv-Gegenprobe zum Test oben: bestätigt, dass der Mock-Aufbau
    # selbst funktioniert und ein echter, präziser Treffer weiterhin
    # akzeptiert wird (sonst könnte der Test oben nur "zufällig" durch
    # einen kaputten Mock statt durch die eigentliche Präzisionsprüfung
    # bestehen - geocode() fängt jede Exception ab und gibt dann
    # ebenfalls None zurück).
    monkeypatch.setenv("GEOCODE_API_KEY", "test-key")

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "results": [
                    {
                        "geometry": {"lat": 49.4467, "lng": 10.9557},
                        "components": {
                            "road": "Banderbach", "house_number": "5", "postcode": "90513",
                        },
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    result = await real_geocode("Banderbach 5")
    assert result is not None
    assert result.formatted_adresse == "Banderbach 5, 90513 Zirndorf"


# Live beobachtet (Kleiberstraße 3, echte bestehende Anmeldung): OpenCage
# kennt die Straße korrekt (road gesetzt, confidence 9/10), aber keine
# exakte Hausnummer-Position (Adresse noch nicht bis auf Gebäudeebene in
# OpenStreetMap erfasst) - lat/lng liegen dann trotzdem sinnvoll auf der
# richtigen Straße und werden übernommen (anders als beim "Banterbach"-
# Fall ohne jede Straßenerkennung), nur der Anzeigetext fällt mangels
# bestätigter Hausnummer auf die Roheingabe zurück (macht der Aufrufer in
# app/routes/stands.py, hier nur geprüft, dass formatted_adresse None ist).
async def test_geocode_keeps_coordinates_when_street_known_but_no_house_number(monkeypatch):
    monkeypatch.setenv("GEOCODE_API_KEY", "test-key")

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "results": [
                    {
                        "geometry": {"lat": 49.4083302, "lng": 10.9319452},
                        "components": {"road": "Kleiberstraße", "postcode": "90513"},
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    result = await real_geocode("Kleiberstr. 3")
    assert result is not None
    assert result.lat == 49.4083302
    assert result.lng == 10.9319452
    assert result.formatted_adresse is None


async def test_geocode_appends_ortsteil_for_a_match_near_a_known_center(monkeypatch):
    # OpenCage/Nominatim liefern selbst keinen Ortsteil-Namen für eine
    # echte Adresse (nur components.city="Zirndorf", siehe Kommentar bei
    # _ORTSTEILE) - geocode() ergänzt ihn deshalb selbst per Entfernung
    # aus dem lat/lng des Treffers.
    monkeypatch.setenv("GEOCODE_API_KEY", "test-key")

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "results": [
                    {
                        # Exakter Mittelpunkt von Weiherhof, siehe _ORTSTEILE.
                        "geometry": {"lat": 49.4594327, "lng": 10.9283946},
                        "components": {
                            "road": "Märzenweg", "house_number": "14", "postcode": "90513",
                        },
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    result = await real_geocode("Märzenweg 14")
    assert result is not None
    assert result.formatted_adresse == "Märzenweg 14, 90513 Zirndorf (Weiherhof)"


# Live gemeldet: "Weiherhofer Hauptstraße 65, 90513 Zirndorf" landete auf
# der Karte weit entfernt vom tatsächlichen Weiherhof. Ursache: OpenCage
# liefert für diesen Straßennamen zwei ca. 0,8 km auseinanderliegende,
# eigene OSM-Wege zurück (einer bei Banderbach, einer tatsächlich bei
# Weiherhof) - ohne Hausnummer-Treffer übernahm geocode() bisher blind
# den ersten davon.
def test_is_ambiguous_road_true_for_same_name_far_apart():
    candidates = [
        (49.4543617, 10.9200312, {"road": "Weiherhofer Hauptstraße"}),
        (49.4576463, 10.9232230, {"road": "Weiherhofer Hauptstraße"}),
    ]
    assert _is_ambiguous_road(candidates) is True


def test_is_ambiguous_road_false_for_same_name_close_together():
    # Zwei Treffer für dieselbe Straße nur wenige Meter auseinander sind
    # normale Geocoding-Ungenauigkeit, keine echte Mehrdeutigkeit.
    candidates = [
        (49.4543617, 10.9200312, {"road": "Musterstraße"}),
        (49.4543700, 10.9200400, {"road": "Musterstraße"}),
    ]
    assert _is_ambiguous_road(candidates) is False


def test_is_ambiguous_road_false_for_different_street_names():
    candidates = [
        (49.4543617, 10.9200312, {"road": "Musterstraße"}),
        (49.4594327, 10.9283946, {"road": "Andere Straße"}),
    ]
    assert _is_ambiguous_road(candidates) is False


# Live gemeldet, zweite Runde: derselbe "Weiherhofer Hauptstraße 65"-Fall
# zeigte den falschen Kartenpunkt sogar NACH dem obigen Fix, sobald über
# das Straße/Hausnummer-Formular gespeichert wurde. Ursache: composeAdresse()
# (frontend/src/lib/adresse.ts) übergibt bereits "Straße Hausnummer, 90513
# Zirndorf" - geocode() hängte darunter selbst noch mal ", Zirndorf,
# Bayern, Deutschland" an, die doppelte Ortsangabe veränderte OpenCages
# Trefferliste so, dass der zur Mehrdeutigkeits-Erkennung nötige zweite
# Treffer nicht mehr auftauchte.
async def test_geocode_does_not_duplicate_zirndorf_in_query(monkeypatch):
    monkeypatch.setenv("GEOCODE_API_KEY", "test-key")
    captured_queries = []

    async def fake_get(self, url, **kwargs):
        captured_queries.append(kwargs["params"]["q"])
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={"results": []},
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    await real_geocode("Weiherhofer Hauptstraße 65, 90513 Zirndorf")
    assert captured_queries[0].lower().count("zirndorf") == 1


# Live gemeldet, dritte Runde: nach dem obigen Fix verschwand der
# Kartenpunkt für "Weiherhofer Hauptstraße 65" komplett - korrekt im
# Sinne von "lieber keine als eine falsche Koordinate", aber der Stand
# sollte tatsächlich in Weiherhof landen, nicht gar nicht angezeigt
# werden. Da der Straßenname selbst "Weiherhof" referenziert und nur
# EINER der beiden mehrdeutigen Treffer tatsächlich im Weiherhof-Radius
# liegt, lässt sich das eindeutig auflösen statt ganz aufzugeben.
def test_is_ambiguous_road_resolved_via_ortsteil_hint_in_street_name():
    candidates = [
        (49.4543617, 10.9200312, {"road": "Weiherhofer Hauptstraße"}),
        (49.4576463, 10.9232230, {"road": "Weiherhofer Hauptstraße", "village": "Weiherhof"}),
    ]
    assert _resolve_by_ortsteil_hint("Weiherhofer Hauptstraße", candidates) == (
        49.4576463,
        10.9232230,
    )


def test_resolve_by_ortsteil_hint_returns_none_without_hint_in_name():
    candidates = [
        (49.4543617, 10.9200312, {"road": "Bahnhofstraße"}),
        (49.4594327, 10.9283946, {"road": "Bahnhofstraße"}),
    ]
    assert _resolve_by_ortsteil_hint("Bahnhofstraße", candidates) is None


def test_resolve_by_ortsteil_hint_returns_none_if_still_ambiguous():
    # Zwei Treffer, beide zufällig innerhalb desselben Ortsteil-Radius -
    # der Namenshinweis allein hilft dann nicht weiter.
    candidates = [
        (49.4594327, 10.9283946, {"road": "Weiherhofer Hauptstraße"}),
        (49.4598000, 10.9280000, {"road": "Weiherhofer Hauptstraße"}),
    ]
    assert _resolve_by_ortsteil_hint("Weiherhofer Hauptstraße", candidates) is None


async def test_geocode_resolves_ambiguous_match_via_ortsteil_hint_in_street_name(monkeypatch):
    monkeypatch.setenv("GEOCODE_API_KEY", "test-key")

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "results": [
                    {
                        "geometry": {"lat": 49.4543617, "lng": 10.9200312},
                        "components": {"road": "Weiherhofer Hauptstraße", "postcode": "90513"},
                    },
                    {
                        "geometry": {"lat": 49.4576463, "lng": 10.9232230},
                        "components": {
                            "road": "Weiherhofer Hauptstraße",
                            "postcode": "90513",
                            "village": "Weiherhof",
                        },
                    },
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    result = await real_geocode("Weiherhofer Hauptstraße 65")
    assert result is not None
    assert (result.lat, result.lng) == (49.4576463, 10.9232230)


async def test_geocode_rejects_ambiguous_opencage_match_without_ortsteil_hint(monkeypatch):
    # Ohne Ortsteil-Bezug im Straßennamen selbst bleibt es beim "lieber
    # keine Koordinaten als geratene falsche" - z.B. eine Straße, die
    # zufällig zweimal im Gemeindegebiet existiert, ohne dass ihr Name
    # verrät, welcher Abschnitt gemeint ist.
    monkeypatch.setenv("GEOCODE_API_KEY", "test-key")

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "results": [
                    {
                        "geometry": {"lat": 49.4543617, "lng": 10.9200312},
                        "components": {"road": "Bahnhofstraße", "postcode": "90513"},
                    },
                    {
                        "geometry": {"lat": 49.4594327, "lng": 10.9283946},
                        "components": {"road": "Bahnhofstraße", "postcode": "90513"},
                    },
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    assert await real_geocode("Bahnhofstraße 65") is None


async def test_geocode_accepts_confirmed_house_number_despite_same_named_road_elsewhere(
    monkeypatch,
):
    # Ist die Hausnummer beim ERSTEN (besten) Treffer bestätigt, wird ihm
    # trotzdem vertraut, auch wenn irgendwo ein weiterer, weit entfernter
    # Treffer mit demselben Straßennamen existiert - die Mehrdeutigkeits-
    # Prüfung greift nur, wenn die Hausnummer selbst unbestätigt ist.
    monkeypatch.setenv("GEOCODE_API_KEY", "test-key")

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "results": [
                    {
                        "geometry": {"lat": 49.4576463, "lng": 10.9232230},
                        "components": {
                            "road": "Weiherhofer Hauptstraße",
                            "house_number": "65",
                            "postcode": "90513",
                        },
                    },
                    {
                        "geometry": {"lat": 49.4543617, "lng": 10.9200312},
                        "components": {"road": "Weiherhofer Hauptstraße", "postcode": "90513"},
                    },
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    result = await real_geocode("Weiherhofer Hauptstraße 65")
    assert result is not None
    # Liegt tatsächlich innerhalb des Weiherhof-Radius (siehe _ORTSTEILE) -
    # bestätigt nebenbei, dass der bestätigte erste Treffer unverändert
    # durchläuft, inklusive Ortsteil-Ergänzung.
    assert result.formatted_adresse == "Weiherhofer Hauptstraße 65, 90513 Zirndorf (Weiherhof)"


async def test_geocode_rejects_coarse_nominatim_match_without_house_number(monkeypatch):
    monkeypatch.delenv("GEOCODE_API_KEY", raising=False)

    async def fake_get(self, url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json=[
                {
                    "lat": "49.4467",
                    "lon": "10.9557",
                    "address": {"city": "Zirndorf", "postcode": "90513"},
                }
            ],
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    assert await real_geocode("Banterbach 5") is None


async def _register(client, api_auth, email="geo@example.com", **overrides):
    body = {
        "adresse": "Musterstraße 1",
        "email": email,
        "datenschutz_zustimmung": True,
        "mindestalter_bestaetigt": True,
        "kategorien": [],
    }
    body.update(overrides)
    return await client.post("/stands/", json=body, auth=api_auth)


async def _login(client, login_code) -> str:
    resp = await client.post("/stands/redeem-code", json={"code": login_code})
    assert resp.status_code == 200
    return resp.json()["session_token"]


def _patch_geocode(monkeypatch, result):
    async def _fake(adresse: str):
        return result

    monkeypatch.setattr("app.routes.stands.geocode", _fake)


async def test_registration_uses_formatted_address_from_geocoding(client, api_auth):
    # Der Standard-Fake in conftest.py (_no_real_geocoding) liefert bereits
    # eine formatted_adresse - die Roheingabe wird dadurch ersetzt.
    resp = await _register(client, api_auth, adresse="musterstr 1 zirndorf")
    assert resp.status_code == 201
    assert resp.json()["adresse"] == "Musterstraße 1, 90513 Zirndorf"


async def test_registration_keeps_raw_address_when_geocoding_result_is_incomplete(
    client, api_auth, monkeypatch
):
    _patch_geocode(
        monkeypatch,
        GeocodeResult(lat=49.44, lng=10.95, postcode="90513", formatted_adresse=None),
    )
    resp = await _register(client, api_auth, adresse="Musterstraße 1, Hinterhof")
    assert resp.status_code == 201
    assert resp.json()["adresse"] == "Musterstraße 1, Hinterhof"


async def test_registration_rejects_address_outside_zirndorf(client, api_auth, monkeypatch):
    _patch_geocode(
        monkeypatch,
        GeocodeResult(
            lat=49.45, lng=11.07, postcode="90402",
            formatted_adresse="Hauptmarkt 1, 90402 Nürnberg",
        ),
    )
    resp = await _register(client, api_auth, adresse="Hauptmarkt 1, Nürnberg")
    assert resp.status_code == 400
    assert "Zirndorf" in resp.json()["detail"]


async def test_registration_allows_failed_geocoding_without_coordinates(
    client, api_auth, monkeypatch
):
    # Kein Ergebnis (z.B. API-Ausfall oder unbekannte Adresse) darf die
    # Anmeldung nicht blockieren - anders als eine erfolgreich außerhalb
    # Zirndorfs aufgelöste Adresse.
    async def _fake_none(adresse: str):
        return None

    monkeypatch.setattr("app.routes.stands.geocode", _fake_none)
    resp = await _register(client, api_auth, adresse="Irgendeine Adresse")
    assert resp.status_code == 201
    body = resp.json()
    assert body["lat"] is None
    assert body["lng"] is None
    assert body["adresse"] == "Irgendeine Adresse"


async def test_owner_edit_rejects_address_outside_zirndorf(
    client, api_auth, captured_emails, monkeypatch
):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    _patch_geocode(
        monkeypatch,
        GeocodeResult(
            lat=49.45, lng=11.07, postcode="90402",
            formatted_adresse="Hauptmarkt 1, 90402 Nürnberg",
        ),
    )
    resp = await client.patch(
        "/stands/by-session", headers={"Authorization": f"Bearer {session_token}"}, json={"adresse": "Hauptmarkt 1, Nürnberg"}
    )
    assert resp.status_code == 400
    assert "Zirndorf" in resp.json()["detail"]


async def test_admin_edit_rejects_address_outside_zirndorf(
    client, api_auth, admin_headers, monkeypatch
):
    stand = (await _register(client, api_auth)).json()

    _patch_geocode(
        monkeypatch,
        GeocodeResult(
            lat=49.45, lng=11.07, postcode="90402",
            formatted_adresse="Hauptmarkt 1, 90402 Nürnberg",
        ),
    )
    resp = await client.patch(
        f"/stands/{stand['id']}", json={"adresse": "Hauptmarkt 1, Nürnberg"}, headers=admin_headers
    )
    assert resp.status_code == 400
    assert "Zirndorf" in resp.json()["detail"]


# Manuelle Koordinaten (siehe migrations/0018) - live nötig geworden, weil
# OpenStreetMap für "Weiherhofer Hauptstraße 65" keine hausnummer-genauen
# Daten hat und selbst die beste automatische Auflösung noch ca. 280m von
# der per Google Maps bestätigten Position entfernt lag.
async def test_admin_can_set_manual_coordinates(client, api_auth, admin_headers):
    stand = (await _register(client, api_auth)).json()

    resp = await client.patch(
        f"/stands/{stand['id']}",
        json={"lat": 49.45786580703368, "lng": 10.931671038123381, "coords_manually_set": True},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["lat"] == 49.45786580703368
    assert body["lng"] == 10.931671038123381
    assert body["coords_manually_set"] is True


async def test_admin_setting_manual_coords_requires_both_lat_and_lng(
    client, api_auth, admin_headers
):
    stand = (await _register(client, api_auth)).json()

    resp = await client.patch(
        f"/stands/{stand['id']}",
        json={"lat": 49.45, "coords_manually_set": True},
        headers=admin_headers,
    )
    assert resp.status_code == 400


async def test_manual_coordinates_survive_a_later_address_edit_by_admin(
    client, api_auth, admin_headers, monkeypatch
):
    stand = (await _register(client, api_auth)).json()
    await client.patch(
        f"/stands/{stand['id']}",
        json={"lat": 49.4578, "lng": 10.9316, "coords_manually_set": True},
        headers=admin_headers,
    )

    # Der Standard-Fake in conftest.py (_no_real_geocoding) würde bei einer
    # normalen Adressbearbeitung eigene Koordinaten liefern - die dürfen
    # den manuell gesetzten Punkt nicht verdrängen, weil coords_manually_set
    # in diesem Update gar nicht enthalten ist (bleibt also True).
    resp = await client.patch(
        f"/stands/{stand['id']}",
        json={"adresse": "Andere Straße 9"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["lat"] == 49.4578
    assert body["lng"] == 10.9316
    assert body["coords_manually_set"] is True


async def test_manual_coordinates_survive_a_later_owner_address_edit(
    client, api_auth, admin_headers, captured_emails
):
    stand = (await _register(client, api_auth)).json()
    await client.patch(
        f"/stands/{stand['id']}",
        json={"lat": 49.4578, "lng": 10.9316, "coords_manually_set": True},
        headers=admin_headers,
    )
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.patch(
        "/stands/by-session",
        headers={"Authorization": f"Bearer {session_token}"},
        json={"adresse": "Andere Straße 9"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["lat"] == 49.4578
    assert body["lng"] == 10.9316


async def test_admin_can_revert_to_automatic_coordinates(client, api_auth, admin_headers):
    stand = (await _register(client, api_auth)).json()
    await client.patch(
        f"/stands/{stand['id']}",
        json={"lat": 49.4578, "lng": 10.9316, "coords_manually_set": True},
        headers=admin_headers,
    )

    # Ohne coords_manually_set: false zu setzen, würde der geocode()-Fake
    # aus conftest.py wieder greifen - hier reicht die Prüfung, dass das
    # Abschalten selbst den erwarteten Wert zurückgibt und lat/lng nicht
    # mehr künstlich festgehalten werden.
    resp = await client.patch(
        f"/stands/{stand['id']}",
        json={"adresse": "Musterstraße 1", "coords_manually_set": False},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["coords_manually_set"] is False
