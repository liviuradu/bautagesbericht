import React, { useState, useEffect, useMemo, Fragment } from "react";
import {
  Plus, Trash2, Save, FileText, ChevronLeft, ChevronRight, ChevronDown,
  Printer, Sun, Cloud, CloudRain, Snowflake, CloudSun, Users, Truck, Search,
  ClipboardList, Gauge, CheckCircle2, X, Layers, Copy, Archive, FolderOpen, Pencil,
  Info, Wand2, FileSpreadsheet, FileCode2, Share2, Settings, ListChecks, RotateCcw,
  LogIn, LogOut, Lock, ShieldCheck, Cloud as CloudIcon, Clock, Camera, Upload, Download,
} from "lucide-react";
import * as XLSX from "xlsx";

/* ===================== SUPABASE (REST + Auth via fetch, ohne Bibliothek) =====================
   Hier die beiden Werte aus deinem Supabase-Projekt eintragen, dann auf GitHub veröffentlichen.
   Leer lassen = lokaler Modus (nur dieses Gerät). In der Chat-Vorschau bleibt es lokal. */
const SUPABASE_URL = "https://lyxhvtyomanwakchggfg.supabase.co"; // Project URL
const SUPABASE_KEY = "sb_publishable_HqzCpxedBj73Gl-nU-2aPA_r2gQF5Sz"; // Publishable key (öffentlich, durch RLS geschützt)
const SB_ON = !!(SUPABASE_URL && SUPABASE_KEY);
const sbHeaders = (token) => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${token || SUPABASE_KEY}`, "Content-Type": "application/json" });
async function sbLoadLists() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_lists?id=eq.default&select=data`, { headers: sbHeaders() });
  if (!r.ok) throw new Error("Laden " + r.status);
  const rows = await r.json();
  return rows[0]?.data || null;
}
async function sbSaveLists(lists, token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_lists?on_conflict=id`, {
    method: "POST",
    headers: { ...sbHeaders(token), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: "default", data: lists, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("Speichern " + r.status + ": " + (await r.text()));
}
async function sbLogin(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.msg || d.error || "Anmeldung fehlgeschlagen");
  return { token: d.access_token, email: d.user?.email || email };
}
let _listsSaveTimer = null; // entprellt das Speichern in Supabase


/* ===================== STANDARD-LISTEN (Seed, danach editierbar) ===================== */
const DEF_SEKTIONEN = Array.from({ length: 22 }, (_, i) => `Sektion ${i + 1}`);
const DEF_TAETIGKEITEN = [
  "Ausbläser bekämpfen", "Ausführung E-Power Pipe (TEW)", "Baustelleneinrichtung Allgemein",
  "Baustelleneinrichtung HDD", "Baustelleneinrichtung Schweißstation", "Begehung Zustandsfeststellung",
  "Entsorgung allgemein", "Entsorgung Bentonit", "Erstellung HDD", "Führung von Besuchern/Behörden",
  "Grundbruch bekämpfen", "HSE-Übung", "HSE-Unterweisung", "Kabelzug", "Kabelzug Mithilfe Vorbereitung",
  "Microtunneling", "Muffengrube ausbilden", "Oberboden abziehen", "Oberboden einbringen/glattziehen",
  "Pilotbohrung", "Räumen der Baustelle", "Rekultivierung", "Rohrpressung", "Sandbettung einbringen",
  "Schallschutzmaßnahmen installieren", "Schutzrohr Druckprobe/Kalibrierung", "Schutzrohr einmessen",
  "Schutzrohr Kabel einziehen", "Schutzrohr LWL einbringen", "Schutzrohr schweißen", "Sonstiges",
  "Straßen reinigen", "Toolboxtalk", "Transporte", "Unterboden ausheben", "Unterboden einbringen",
  "Verbau", "Vergrämung installieren", "Wartezeiten", "Wartungsarbeiten", "Wasserhaltung installieren",
  "Wasserhaltung kontrollieren", "Wegebau",
];
const DEF_ROLLEN = ["Polier", "Vorarbeiter", "Facharbeiter", "Werker / Helfer", "Maschinist",
  "Baggerfahrer", "Schweißer", "HDD-Operator", "Kranführer", "Sicherungsposten"];

// Gerätetypen mit konkreten Geräten (units) – Beispiele vorbefüllt, in den Listen erweiterbar.
const DEF_GERAETE = [
  { typ: "Kettenbagger", units: ["CAT 320", "Liebherr R 926", "Komatsu PC210"] },
  { typ: "Mobilbagger / Radbagger", units: ["CAT M315", "Liebherr A 918"] },
  { typ: "Radlader", units: ["CAT 950", "Volvo L90"] },
  { typ: "Planierraupe", units: ["CAT D6"] },
  { typ: "HDD-Bohranlage", units: ["Herrenknecht HK250", "Prime Drilling PD 250/130"] },
  { typ: "Microtunneling-Anlage", units: [] },
  { typ: "LKW / Kipper", units: ["MAN TGS", "Mercedes Arocs", "Volvo FMX"] },
  { typ: "Tieflader", units: [] },
  { typ: "Mobilkran", units: ["Liebherr LTM 1050", "Grove GMK"] },
  { typ: "Autokran", units: [] },
  { typ: "Schweißgerät", units: ["Stumpfschweißmaschine DA 280", "E-Hand-Schweißgerät"] },
  { typ: "Bentonit-/Recyclinganlage", units: [] },
  { typ: "Rollenlaufbahn", units: [] },
  { typ: "Rüttelplatte", units: ["Wacker DPU 6555"] },
  { typ: "Walze", units: ["Bomag BW 213", "Hamm 3411"] },
  { typ: "Pumpe / Wasserhaltung", units: [] },
  { typ: "Stromaggregat", units: [] },
];

const BAS_GROUPS = [
  ["Baustelleneinrichtung", [["031", "Haupt BE – erstellen"], ["032", "Haupt BE – vorhalten"], ["033", "Haupt BE – räumen"],
    ["034", "BE Querung – erstellen"], ["035", "BE Querung – vorhalten"], ["036", "BE Querung – räumen"], ["037", "BE Archäologie"]]],
  ["Baustraßen", [["051", "Äußere Baustraßen"], ["052", "Innere Baustraßen"]]],
  ["Oberboden", [["101", "Oberboden-Abtrag"], ["102", "Oberboden-Zwischenbegrünung"], ["103", "Oberboden-Andecken"]]],
  ["Unterboden", [["201", "Unterboden-Abtrag"], ["202", "Unterboden-Zwischenbegrünung"], ["203", "Unterboden-Andecken"],
    ["251", "Unterboden-Abtrag"], ["252", "Unterboden-Verfüllung"]]],
  ["Bettung", [["261", "Bettung aus Sand/Kies/Splitt"], ["262", "Bettung aus Flüssigboden"], ["263", "Boden fördern"],
    ["264", "Boden aufbereiten"], ["265", "Bettung einbauen"]]],
  ["Grabenverbau", [["301", "Grabenverbau – Einbau"], ["302", "Grabenverbau – Vorhalten"], ["303", "Grabenverbau – Ausbau"]]],
  ["Entsorgung", [["35", "Entsorgung"]]],
  ["Geotextil", [["401", "Geotextil – liefern und verlegen"], ["402", "Geotextil – zurückbauen"]]],
  ["Querung", [["501A", "Molchen und Kalibrieren (Querung)"], ["501B", "Qualitätsprüfung (Querung)"],
    ["5011A", "Trassieren (Querung)"], ["5011B", "Abladen (Querung)"], ["5012", "Auf- & Abbau Schweißplatz (Querung)"],
    ["5013", "Auf- & Abbau Rollenlaufbahn (Querung)"], ["5014", "Schweißarbeiten / Verbinden (Querung)"],
    ["5015", "Lief. & Einbau Einziehhilfe (Querung)"], ["5016", "Einziehen / Absenken (Querung)"], ["5017", "Erdseil (Querung)"],
    ["5018", "Befestigung LWL-KSR (Querung)"], ["5019", "Mont. & Demont. Verschlussteller (Querung)"], ["50121", "E-Hand schweißen (Querung)"]]],
  ["Offene Grube (OG)", [["5021A", "Abladen (OG)"], ["5021B", "Trassieren (OG)"], ["5022", "Auf- & Abbau Schweißplatz (OG)"],
    ["5023", "Auf- & Abbau Rollenlaufbahn (OG)"], ["5024", "Schweißarbeiten / Verbinden (OG)"], ["5025", "Lieferung und Einbau Einziehhilfe (OG)"],
    ["5026", "Einziehen / Absenken (OG)"], ["5027", "Erdseil (OG)"], ["5028", "Molchen und Kalibrieren (OG)"]]],
  ["Muffengrube", [["5031", "Schweißarbeiten / Verbinden (Muffengr.)"], ["5032", "Erdseil (Muffengr.)"]]],
  ["Kombiniert", [["5041", "Kom.-Abladen und Trassieren"], ["5044", "Kom.-Schweißarbeiten / Verbinden"]]],
  ["Rückverfüllung", [["601", "Oberboden Rückverfüllung Kabelgräben"], ["602", "Unterboden Rückverfüllung Kabelgräben"]]],
  ["Casingrohre", [["70", "Casingrohre liefern, einbringen und Rückbau"]]],
];
// Referenz: BAS -> verknüpfte LV-Leistung (Kurztext/ME, aus LV-Datei) + Standard-Inhaltstext (editierbar).
const BAS_EXTRA = {
  "031": { desc: "Hauptbaustelleneinrichtung herstellen – Flächen, Container, Zäune, Versorgung." },
  "032": { desc: "Hauptbaustelleneinrichtung vorhalten und betreiben." },
  "033": { desc: "Hauptbaustelleneinrichtung räumen und zurückbauen." },
  "034": { desc: "Baustelleneinrichtung an einer Querung herstellen." },
  "035": { desc: "Baustelleneinrichtung Querung vorhalten." },
  "036": { desc: "Baustelleneinrichtung Querung räumen." },
  "037": { desc: "Baustelleneinrichtung für die archäologische Begleitung." },
  "051": { desc: "Äußere Baustraßen herstellen und unterhalten (Zufahrten)." },
  "052": { desc: "Innere Baustraßen entlang der Trasse." },
  "101": { lv: "Oberboden (A-Horizont) abtragen und lagern", me: "m²", desc: "Oberboden abtragen und in Mieten lagern." },
  "102": { desc: "Zwischenbegrünung der Oberbodenmieten." },
  "103": { lv: "Oberboden (A-Horizont) des AG andecken", me: "m²", desc: "Oberboden wieder andecken." },
  "201": { lv: "Unterboden (B-Horizont) ausheben und lagern", me: "m³", desc: "Unterboden ausheben und lagern." },
  "202": { desc: "Zwischenbegrünung der Unterbodenmieten." },
  "203": { lv: "Unterboden (B-Horizont) des AG andecken", me: "m³", desc: "Unterboden wieder andecken." },
  "251": { lv: "Unterboden (B-Horizont) ausheben und lagern", me: "m³", desc: "Unterboden ausheben und lagern." },
  "252": { desc: "Unterboden / Aushub im Graben verfüllen." },
  "261": { desc: "Bettung aus Sand / Kies / Splitt in der Leitungszone." },
  "262": { desc: "Bettung aus Flüssigboden herstellen." },
  "263": { desc: "Boden für die Bettung fördern." },
  "264": { desc: "Boden für die Bettung aufbereiten." },
  "265": { desc: "Bettung in der Leitungszone einbauen." },
  "301": { desc: "Grabenverbau einbauen (GU herstellen)." },
  "302": { desc: "Grabenverbau vorhalten." },
  "303": { desc: "Grabenverbau ausbauen / rückbauen." },
  "35": { desc: "Entsorgung von Aushub / Bauschutt nach Deklaration (EBV / LAGA)." },
  "401": { lv: "Geotextil (Kombigitter) Zugfestigkeit 120 KN/m", me: "m²", desc: "Geotextil / Kombigitter liefern und verlegen." },
  "402": { desc: "Geotextil zurückbauen." },
  "501A": { lv: "Molchen und Kalibrieren Kabelschutzrohr, HGÜ", me: "Stk", desc: "Kabelschutzrohr molchen und kalibrieren (Querung)." },
  "501B": { lv: "Qualitätsprüfung KSR DA 280, SDR 17", me: "psch", desc: "Qualitätsprüfung der Kabelschutzrohre (Querung)." },
  "5011A": { desc: "Rohre abladen und trassieren (Querung)." },
  "5011B": { desc: "Rohre abladen (Querung)." },
  "5012": { desc: "Schweißplatz auf- und abbauen (Querung)." },
  "5013": { desc: "Rollenlaufbahn auf- und abbauen (Querung)." },
  "5014": { desc: "Schweißarbeiten / Verbinden – Stumpfschweißung (Querung)." },
  "5015": { desc: "Einziehhilfe liefern und einbauen (Querung)." },
  "5016": { desc: "Rohrstrang einziehen / absenken (Querung)." },
  "5017": { lv: "Erdseil liefern und verlegen, Graben", me: "m", desc: "Erdseil liefern und verlegen (Querung)." },
  "5018": { desc: "LWL-Kabelschutzrohre befestigen (Querung)." },
  "5019": { desc: "Verschlussteller montieren / demontieren (Querung)." },
  "50121": { desc: "E-Hand-Schweißen (Querung)." },
  "5021A": { desc: "Rohre abladen (offene Grube)." },
  "5021B": { desc: "Rohre trassieren (offene Grube)." },
  "5022": { desc: "Schweißplatz auf- und abbauen (offene Grube)." },
  "5023": { desc: "Rollenlaufbahn auf- und abbauen (offene Grube)." },
  "5024": { desc: "Schweißarbeiten / Verbinden (offene Grube)." },
  "5025": { desc: "Einziehhilfe liefern und einbauen (offene Grube)." },
  "5026": { desc: "Rohrstrang einziehen / absenken (offene Grube)." },
  "5027": { desc: "Erdseil verlegen (offene Grube)." },
  "5028": { desc: "Molchen und Kalibrieren (offene Grube)." },
  "5031": { desc: "Schweißarbeiten / Verbinden (Muffengrube)." },
  "5032": { desc: "Erdseil verlegen (Muffengrube)." },
  "5041": { desc: "Abladen und Trassieren (kombiniert)." },
  "5044": { desc: "Schweißarbeiten / Verbinden (kombiniert)." },
  "601": { lv: "Kulturfähiges Bodenmaterial (Oberboden) liefern und einbauen", me: "m³", desc: "Oberboden-Rückverfüllung der Kabelgräben." },
  "602": { lv: "Kulturfähiges Bodenmaterial (Unterboden) liefern und einbauen", me: "m³", desc: "Unterboden-Rückverfüllung der Kabelgräben." },
  "70": { desc: "Casingrohre liefern, einbringen und rückbauen." },
};
// Ergänzung aus "BAS-Verteilung": Klartext ("Was steckt drin") + "Wann wählen" je BAS (per Python injiziert).
const BAS_INFO_EXT = {"031": {"drin": "Zentrale (Haupt-)Baustelleneinrichtung herstellen: Haupt-/Lagerplätze und die AG-Container (Baubüro, Besuchercontainer) auf- und abbauen, Oberboden auf den BE-Flächen abtragen und lagern, Schottertragschicht und Tiefenlockerung, Baustelle einrichten.","wann": "Einmalig für das EINRICHTEN der zentralen Baustelle (nicht je Abschnitt). Für Auf-/Abbau der Haupt-BE und der AG-Container."},"032": {"drin": "Vorhalten (Miete/Betrieb/Unterhalt) der zentralen Baustelleneinrichtung und der AG-Container über die Bauzeit.","wann": "Für die laufende (monatliche) VORHALTUNG der Haupt-BE – nicht für Auf-/Abbau."},"033": {"drin": "Zentrale Baustelle am Bauende räumen, Flächen zurückbauen und wiederherstellen.","wann": "Nur für die End-RÄUMUNG der zentralen Baustelle."},"034": {"drin": "Baustelleneinrichtung für die Querungen/HDD-Bohrplätze auf- und abbauen (je Querungsbauwerk, geschlossene Bauweise/Bohrung).","wann": "Für das EINRICHTEN eines HDD-/Querungs-Bohrplatzes, pro Querung."},"035": {"drin": "Entsorgung von Aushub-/Kabelgraben-Material (horizontunabhängig) nach EBV-Zuordnung (z. B. BM-0/BG-0): belastetes/überschüssiges Material abfahren und entsorgen.","wann": "Für die ENTSORGUNG von nicht wiederverwendbarem Aushub (Deponie/EBV-Klasse). ACHTUNG: Code 35 doppelt – hier ENTSORGUNG, nicht BE Querung."},"036": {"drin": "Querungs-/HDD-Bohrplatz am Ende räumen (je Querung).","wann": "Für die RÄUMUNG eines HDD-/Querungsplatzes."},"037": {"drin": "Komplette Baustelleneinrichtung für die archäologische Begleitung/Grabungen: Bauzaun, Schutzzaun, Beleuchtung, Witterungsschutz-Einhausung (Zelt) mit Heizung, mobile Wärme-/Stromerzeuger, Grabungsschutz (Sandabdeckung) – auf-/abbauen, umsetzen, vorhalten, räumen.","wann": "Für ALLE BE-Leistungen rund um archäologische Untersuchungsflächen (Zelt/Heizung/Zaun/Strom)."},"051": {"drin": "Äußere (Haupt-)Baustraßen bauen: Ober-/Unterboden abtragen, Planum, Geotextil/Kombigitter, Schottertragschicht 40–70 cm, Lastverteilungsplatten, Dammschüttung, Bankett, Asphalttragdeckschicht; später trennen/rückbauen.","wann": "Für die GROSSEN Zufahrts-/Hauptbaustraßen außerhalb der Trasse."},"052": {"drin": "Innere Baustraßen (auf/entlang der Trasse): Planum, Geotextil, Schottertragschicht 30–40 cm, Lastverteilungsplatten.","wann": "Für die LEICHTEREN inneren Fahrwege im Trassenbereich."},"101": {"drin": "Oberboden (A-Horizont/Mutterboden) auf den Trassenabschnitten abtragen und getrennt lagern (auch im Leitungsbereich).","wann": "Für den getrennten MUTTERBODEN-ABTRAG vor dem Aushub, je Abschnitt."},"102": {"drin": "Oberboden-Mieten für längere Zwischenlagerung mit Zwischenbegrünung (Abtrag/Lagerung).","wann": "Wenn der gelagerte Oberboden zwischenbegrünt / länger gemietet wird."},"103": {"drin": "Oberboden des AG wieder andecken/auftragen (Flächen, Einzel- und Kleinflächen) – Rekultivierung.","wann": "Für das WIEDERAUFTRAGEN des Mutterbodens nach der Verfüllung."},"201": {"drin": "Unterboden (B-Horizont) ausheben und getrennt lagern; Planum zur archäologischen Bewertung; Bodenabtrag B+C.","wann": "Für den getrennten B-HORIZONT-AUSHUB."},"202": {"drin": "Unterboden-Miete (B-Horizont) mit Zwischenbegrünung / Planum.","wann": "Bei Zwischenlagerung/Begrünung des Unterbodens."},"203": {"drin": "Unterboden (B-Horizont) des AG wieder andecken – Rekultivierung.","wann": "Für das WIEDERAUFTRAGEN des B-Horizonts."},"251": {"drin": "Eigentlicher Grabenaushub: Aushub C-Horizont (Grabensohle, auch oberhalb der Bettungszone) ausheben und lagern; Zulage Fels.","wann": "Für den GRABENAUSHUB der Kabeltrasse (C-Horizont/Fels)."},"252": {"drin": "Rückverfüllung des Grabens im C-Horizont-Bereich (mit Aushub-/geeignetem Material).","wann": "Für die RÜCKVERFÜLLUNG der Grabensohle (über der Bettung)."},"261": {"drin": "Bettung aus Sand/Kies/Splitt liefern und in die Leitungszone einbauen.","wann": "Wenn die Bettung aus SAND/KIES/SPLITT besteht."},"262": {"drin": "Bettung aus Flüssigboden (verflüssigtes/aufbereitetes Material).","wann": "Bei FLÜSSIGBODEN-Bettung."},"263": {"drin": "Boden für die Bettungsaufbereitung fördern (Teilleistung).","wann": "Teilleistung BODEN FÖRDERN für die Bettung."},"264": {"drin": "Aushubboden für die Wiederverwendung als Bettung aufbereiten (Teilleistung).","wann": "Teilleistung BODEN AUFBEREITEN für die Bettung."},"265": {"drin": "Aufbereitetes/geliefertes Bettungsmaterial in die Leitungszone einbauen (Haupt-Bettungsposition über die Abschnitte).","wann": "Für den EINBAU der Bettung rund um die Rohre (Standardfall)."},"301": {"drin": "Grabenverbau (Verbaukästen/Spundbohlen) je nach Grabentiefe/-breite herstellen und einbauen (H 1,75–4 m).","wann": "Für das EINBAUEN des Grabenverbaus."},"302": {"drin": "Vorhalten des Grabenverbaus über die Standzeit.","wann": "Für die laufende VORHALTUNG des Verbaus."},"303": {"drin": "Grabenverbau ziehen/ausbauen/rückbauen.","wann": "Für den AUSBAU des Verbaus."},"35": {"drin": "Entsorgung von Aushub-/Kabelgraben-Material (horizontunabhängig) nach EBV-Zuordnung (z. B. BM-0/BG-0): belastetes/überschüssiges Material abfahren und entsorgen.","wann": "Für die ENTSORGUNG von nicht wiederverwendbarem Aushub (Deponie/EBV-Klasse). ACHTUNG: Code 35 doppelt – hier ENTSORGUNG, nicht BE Querung."},"401": {"drin": "Geotextil/Kombigitter (Zugfestigkeit 120 kN/m) liefern und verlegen (Trennschicht/Grabenschutz).","wann": "Für den EINBAU von Geotextil/Kombigitter."},"402": {"drin": "Geotextil/Kombigitter wieder aufnehmen/zurückbauen.","wann": "Für den RÜCKBAU des Geotextils."},"501A": {"drin": "Rohrleitung der Querung molchen und kalibrieren + Qualitätsprüfung der Kabelschutzrohre (HGÜ, LWL, diverse DA): Reinigungs-/Kalibriermolch durchziehen, Maßhaltigkeit prüfen.","wann": "Für MOLCHEN/KALIBRIEREN + Qualitätsprüfung der fertigen Querungsrohre (Bohrung)."},"501B": {"drin": "Qualitätsprüfung der Kabelschutzrohre der Querung (HGÜ+LWL, DA 315/280): Dichtheits-/Maßprüfung.","wann": "Speziell für die QUALITÄTSPRÜFUNG (ohne Molchen) der Querungsrohre."},"5011A": {"drin": "Trassieren/Auslegen und Vorbereiten der Rohrstränge der Querung; Kabelschutzrohre (HGÜ/LWL) abrufen und verschweißen.","wann": "Für das TRASSIEREN/Auslegen des Rohrstrangs vor dem Einzug (Bohrung)."},"5011B": {"drin": "Kabelschutzrohre an der Querung anliefern/abladen und bereitstellen (HGÜ/LWL, Nachrichten-/Monitoringkabel-Rohre) abrufen.","wann": "Für das ABLADEN/Bereitstellen der Rohre an der Bohrung."},"5012": {"drin": "Schweißplatz für den Rohrstrang der Querung auf- und abbauen (Stumpfschweißen KSR, Stahlschutzrohr DA 219/323).","wann": "Für AUF-/ABBAU des SCHWEISSPLATZES an der Bohrung."},"5013": {"drin": "Rollenlaufbahn/Ablaufbahn (Arbeitsbereich zum Auslegen des Strangs) herrichten, auf- und abbauen.","wann": "Für AUF-/ABBAU der ROLLEN-/ABLAUFBAHN an der Bohrung."},"5014": {"drin": "Eigentliche Schweiß-/Verbindungsarbeiten der Kabelschutzrohre (HGÜ/LWL) der Querung – Stränge verschweißen.","wann": "Für die SCHWEISSLEISTUNG selbst (Stumpfschweißen) an der Bohrung."},"5015": {"drin": "Einziehhilfe (Einziehseil/-strumpf) je Querungsbauwerk liefern und einbauen.","wann": "Für die EINZIEHHILFE je Querung (Nr. xx)."},"5016": {"drin": "Rohrstrang/Schutzrohr in die Bohrung einziehen bzw. absenken (DA 250/315/355, auch Bündel).","wann": "Für das EINZIEHEN/ABSENKEN des fertigen Strangs in die Bohrung."},"5017": {"drin": "Erdseil (Erdungsseil) liefern und mit einziehen.","wann": "Für das ERDSEIL der Querung."},"5018": {"drin": "LWL-Kabelschutzrohre (Monitoring) abrufen, einbauen und befestigen.","wann": "Für die BEFESTIGUNG/den Einbau der LWL-Rohre an der Querung."},"5019": {"drin": "Verschlussteller (Endkappen) der Kabelschutzrohre (HGÜ/LWL) montieren/demontieren; KSR ggf. ausbauen.","wann": "Für MONTAGE/DEMONTAGE der Rohr-Verschlussteller."},"50121": {"drin": "E-Hand-Schweißung der Stahlschutzrohre (DA 219 / 323,9 × 5,6 mm) der Querung.","wann": "Für E-HAND-Schweißnähte an Stahlschutzrohren (Sonderfall zum Stumpfschweißen)."},"5021A": {"drin": "Kabelschutzrohre im Offene Graben-Bereich (offene Bauweise) abrufen, einbauen und verschweißen (HGÜ/LWL, Nachrichten-/Monitoring).","wann": "Für ABLADEN/Einbau der Rohre in OFFENER Grabenbauweise."},"5021B": {"drin": "Trassieren/Auslegen der LWL-/Nachrichten-/Monitoring-Rohre im Offene Graben-Bereich.","wann": "Für das TRASSIEREN in offener Bauweise."},"5022": {"drin": "Schweißplatz für die Offene Graben-Rohrverlegung auf-/abbauen.","wann": "Wie 5012, aber OFFENE Bauweise (Offene Graben)."},"5023": {"drin": "Rollenlaufbahn für die Offene Graben-Rohrverlegung auf-/abbauen.","wann": "Wie 5013, aber Offene Graben."},"5024": {"drin": "Schweiß-/Verbindungsarbeiten der Rohre in offener Bauweise.","wann": "Wie 5014, aber Offene Graben."},"5025": {"drin": "Einziehhilfe für die Offene Graben-Verlegung liefern und einbauen.","wann": "Wie 5015, aber Offene Graben."},"5026": {"drin": "Einziehen/Absenken der Rohre/Stränge in offener Bauweise.","wann": "Wie 5016, aber Offene Graben."},"5027": {"drin": "Erdseil im Graben liefern und verlegen (offene Bauweise).","wann": "ERDSEIL, offene Bauweise."},"5028": {"drin": "Molchen/Kalibrieren + Qualitätsprüfung der Kabelschutzrohre (DA 50/32) in offener Bauweise.","wann": "Wie 501A, aber Offene Graben."},"5031": {"drin": "Schweiß-/Verbindungsarbeiten der LWL-/Nachrichten-/Monitoring-Rohre in der Muffengrube (Kabelverbindungsgrube).","wann": "Für Rohr-/SCHWEISSARBEITEN in der MUFFENGRUBE."},"5032": {"drin": "Erdseil in der Muffengrube (mit Link-Box) liefern und verlegen.","wann": "Für das ERDSEIL in der Muffengrube."},"5041": {"drin": "Abladen und Trassieren der LWL-Kabelschutzrohre im kommerziellen Abschnitt (innerhalb/außerhalb Kabelgraben einbauen).","wann": "Für ABLADEN/TRASSIEREN im „Kom.\"-Abschnitt."},"5044": {"drin": "Schweiß-/Verbindungsarbeiten der LWL-Kabelschutzrohre im kommerziellen Abschnitt.","wann": "Für SCHWEISSEN/VERBINDEN im „Kom.\"-Abschnitt."},"601": {"drin": "Kabelgräben mit Oberboden (A-Horizont) rückverfüllen – kulturfähiges Bodenmaterial (Oberboden) liefern/einbauen, je Abschnitt.","wann": "Für die OBERBODEN-Lage der Grabenverfüllung."},"602": {"drin": "Kabelgräben mit Unterboden (B-Horizont) rückverfüllen – kulturfähiges Bodenmaterial (Unterboden) liefern/einbauen.","wann": "Für die UNTERBODEN-Lage der Grabenverfüllung."},"70": {"drin": "Casing-/Stahlschutzrohre liefern, einbringen und zurückbauen; LWL-KSR außerhalb des Kabelgrabens einbauen.","wann": "Für CASING-/SCHUTZROHR-Arbeiten (Schutzverrohrung)."}};
const DEF_BAS = BAS_GROUPS.flatMap(([group, items]) =>
  items.map(([code, name]) => ({ code, name, group, desc: BAS_INFO_EXT[code]?.drin || BAS_EXTRA[code]?.desc || "", wann: BAS_INFO_EXT[code]?.wann || "" })));
const BAS_LV = Object.fromEntries(Object.entries(BAS_EXTRA).filter(([, v]) => v.lv).map(([k, v]) => [k, { lv: v.lv, me: v.me }]));

/* Pflichtangaben je Leistung (einstellbar unter Einstellungen → Pflichtfelder) */
const DEF_PFLICHT = { sektion: true, vorhaben: true, taetigkeit: true, bas: true, beschreibung: true, menge: true, personal: true, geraete: false };

const defaultLists = () => ({
  sektionen: [...DEF_SEKTIONEN], taetigkeiten: [...DEF_TAETIGKEITEN], rollen: [...DEF_ROLLEN],
  nachunternehmer: [],
  bas: DEF_BAS.map((b) => ({ ...b })), geraete: DEF_GERAETE.map((g) => ({ typ: g.typ, units: [...g.units] })),
  pflicht: { ...DEF_PFLICHT },
  profil: { ...DEF_PROFIL, ort2Optionen: [...DEF_PROFIL.ort2Optionen] },
});

// Sektion-Stammdaten (km, Bauwerke, Segment, Bauabschnitt) – als Info beim Auswählen.
const SEKTION_INFO = {
  "Sektion 1": { kmVon: "0", kmBis: "1.015", bauwerke: ["VAM 1", "VAM 2"], segment: "29", ba: "BA1" },
  "Sektion 2": { kmVon: "1.015", kmBis: "2.830", bauwerke: ["Q5 (HDD)", "VAM 4"], segment: "29", ba: "BA1" },
  "Sektion 3": { kmVon: "2.830", kmBis: "4.337", bauwerke: ["Q12 (HDD)"], segment: "29", ba: "BA1" },
  "Sektion 4": { kmVon: "4.337", kmBis: "5.925", bauwerke: ["EPP 400"], segment: "29", ba: "BA1" },
  "Sektion 5": { kmVon: "5.925", kmBis: "7.635", bauwerke: ["Q18 (HDD)", "Q268 (Pressung)"], segment: "29", ba: "BA1" },
  "Sektion 6": { kmVon: "7.635", kmBis: "9.468", bauwerke: ["VAM 6", "Q23 (Microtunnel)", "VAM 7"], segment: "30", ba: "BA2" },
  "Sektion 7": { kmVon: "9.468", kmBis: "11.052", bauwerke: ["Q29 (HDD)", "Q23 (Microtunnel)", "Q35 (HDD)", "Q37 (HDD)"], segment: "30", ba: "BA2" },
  "Sektion 8": { kmVon: "11.052", kmBis: "12.876", bauwerke: [], segment: "30", ba: "BA2" },
  "Sektion 9": { kmVon: "12.876", kmBis: "14.238", bauwerke: ["Q48 (HDD)"], segment: "30", ba: "BA2" },
  "Sektion 10": { kmVon: "14.238", kmBis: "15.625", bauwerke: ["Q52 (HDD)"], segment: "30", ba: "BA2" },
  "Sektion 11": { kmVon: "15.625", kmBis: "17.461", bauwerke: ["Q57 (HDD)", "Q58 (HDD)", "VAM 8"], segment: "30", ba: "BA3" },
  "Sektion 12": { kmVon: "17.461", kmBis: "18.846", bauwerke: ["Q62 (HDD)", "Q63 (HDD)"], segment: "30", ba: "BA3" },
  "Sektion 13": { kmVon: "18.846", kmBis: "20.485", bauwerke: ["Q279 (HDD)"], segment: "30", ba: "BA3" },
  "Sektion 14": { kmVon: "20.485", kmBis: "21.549", bauwerke: ["Q67 (HDD)"], segment: "30", ba: "BA3" },
  "Sektion 15": { kmVon: "21.549", kmBis: "22.936", bauwerke: ["Q68 (HDD)"], segment: "31", ba: "BA3" },
  "Sektion 16": { kmVon: "22.936", kmBis: "24.780", bauwerke: ["Q283 (HDD)", "Q284 (HDD)"], segment: "31", ba: "BA4" },
  "Sektion 17": { kmVon: "24.780", kmBis: "25.956", bauwerke: ["Q288 (HDD)"], segment: "31", ba: "BA4" },
  "Sektion 18": { kmVon: "25.956", kmBis: "27.528", bauwerke: ["Q 82 (HDD)", "Q84 (HDD)"], segment: "31", ba: "BA4" },
  "Sektion 19": { kmVon: "27.528", kmBis: "28.855", bauwerke: ["VAM 9"], segment: "31", ba: "BA4" },
  "Sektion 20": { kmVon: "28.855", kmBis: "30.711", bauwerke: ["Q92+94 (HDD)", "VAM 10"], segment: "31", ba: "BA4" },
  "Sektion 21": { kmVon: "30.711", kmBis: "32.509", bauwerke: [], segment: "31", ba: "BA4" },
  "Sektion 22": { kmVon: "32.509", kmBis: "34.184", bauwerke: ["Q105 (Pressung)", "VAM 11"], segment: "31", ba: "BA4" },
};
const sektInfo = (name) => SEKTION_INFO[name] || null;
/* ===================== Projektprofil: was je Projekt verschieden ist ===================== */
const DEF_PROFIL = {
  typ: "suedlink", projekt: "SuedLink Los 3",
  ort1: "Sektion",                                   // Bezeichnung der Ortsangabe (Liste "sektionen")
  ort2Aktiv: true, ort2: "Vorhaben", ort2Optionen: ["West", "Ost"],
  ort2Ueb: true, ort2UebLabel: "Vorhabenübergreifend", // zusätzliche Auswahl "gilt für alle"
  stationAktiv: false, station: "Station (km von – bis)",
  schluessel: "BAS",                                 // Bezeichnung des Leistungs-/Kostenschlüssels
};
const PROFIL_TYPEN = [
  { key: "linie", name: "Linienbaustelle", was: "Straße, Autobahn, Gleis, Leitung, Kanal", ort1: "Abschnitt", ort2Aktiv: true, ort2: "Fahrtrichtung / Seite", ort2Optionen: ["Richtung 1", "Richtung 2"], ort2Ueb: true, ort2UebLabel: "Beide Richtungen", stationAktiv: true, station: "Station (km von – bis)", beispiel: ["Abschnitt 1", "Abschnitt 2", "Abschnitt 3"] },
  { key: "suedlink", name: "Kabeltrasse (SuedLink)", was: "Sektionen, Vorhaben West / Ost", ort1: "Sektion", ort2Aktiv: true, ort2: "Vorhaben", ort2Optionen: ["West", "Ost"], ort2Ueb: true, ort2UebLabel: "Vorhabenübergreifend", stationAktiv: false, station: "Station (km von – bis)", beispiel: DEF_SEKTIONEN },
  { key: "bruecke", name: "Brücke / Ingenieurbau", was: "Widerlager, Pfeiler, Überbau, Teilbauwerke", ort1: "Bauteil", ort2Aktiv: true, ort2: "Teilbauwerk", ort2Optionen: ["Teilbauwerk 1", "Teilbauwerk 2"], ort2Ueb: true, ort2UebLabel: "Beide Teilbauwerke", stationAktiv: true, station: "Achse", beispiel: ["Widerlager", "Pfeiler", "Überbau", "Kappen", "Baugrube"] },
  { key: "hochbau", name: "Hochbau", was: "Gebäude, Bauteile, Geschosse", ort1: "Gebäude / Bauteil", ort2Aktiv: true, ort2: "Geschoss", ort2Optionen: ["UG", "EG", "1. OG", "2. OG", "Dach"], ort2Ueb: true, ort2UebLabel: "Mehrere Geschosse", stationAktiv: true, station: "Achse / Raum", beispiel: ["Haus A", "Haus B", "Tiefgarage", "Außenanlagen"] },
  { key: "flaeche", name: "Flächenbaustelle", was: "Erdbau, Baufeld, Deponie, Außenanlagen", ort1: "Baufeld", ort2Aktiv: false, ort2: "Teilfläche", ort2Optionen: [], ort2Ueb: false, ort2UebLabel: "Gesamte Fläche", stationAktiv: false, station: "Lage", beispiel: ["Baufeld 1", "Baufeld 2", "Baufeld 3"] },
];
let _prof = DEF_PROFIL; // aktives Profil für die Export-Funktionen (wird von App gesetzt)
const ort2Text = (p) => (p.vorhabenUeb === "Ja" ? _prof.ort2UebLabel : (p.vorhaben || ""));

const EINHEITEN = ["m", "lfm", "m²", "m³", "t", "kg", "Stk", "h", "psch"];
const WETTER = [
  { key: "sonnig", label: "Sonnig", Icon: Sun }, { key: "heiter", label: "Heiter", Icon: CloudSun },
  { key: "bewoelkt", label: "Bewölkt", Icon: Cloud }, { key: "regen", label: "Regen", Icon: CloudRain },
  { key: "schnee", label: "Schnee", Icon: Snowflake },
];
const STEPS = ["Leistung", "Ausführung", "Personal", "Geräte", "Prüfen"];

/* ===================== HELFER ===================== */
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
const fmt = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const dateDE = (iso) => iso ? new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const phOf = (p) => p.personal.reduce((a, x) => a + num(x.anzahl) * num(x.stunden), 0);
const ghOf = (p) => p.geraete.reduce((a, x) => a + (num(x.anzahl) || 1) * num(x.stunden), 0);
const geraetLabel = (g) => `${g.typ}${g.geraet ? ` – ${g.geraet}` : ""}`;

/* ===================== Stillstand-/Foto-Helfer ===================== */
const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
const spanH = (a, b) => { const x = toMin(a), y = toMin(b); return x !== null && y !== null && y > x ? (y - x) / 60 : 0; };
const stillPers = (s) => (s.personal || []).filter((r) => r.rolle).map((r) => `${num(r.anzahl) || 1}× ${r.rolle}`).join(", ");
const stillGer = (s) => (s.geraete || []).filter((r) => r.typ).map((r) => `${num(r.anzahl) || 1}× ${geraetLabel(r)}`).join(", ");
function fileToJpeg(file, max = 1600, q = 0.75) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Bild nicht lesbar")); };
    img.src = url;
  });
}

/* ===================== Listen <-> Excel ===================== */
const LIST_SHEETS = [["sektionen", "Sektionen", "Sektion"], ["taetigkeiten", "Tätigkeiten", "Tätigkeit"], ["rollen", "Rollen", "Rolle"], ["nachunternehmer", "Nachunternehmer", "Nachunternehmer"]];
function listsToWorkbook(l) {
  const wb = XLSX.utils.book_new();
  LIST_SHEETS.forEach(([key, sheet, head]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[head], ...(l[key] || []).filter(Boolean).map((x) => [x])]), sheet));
  const g = [["Gerätetyp", "Gerät (genau)"]];
  (l.geraete || []).filter((x) => x.typ).forEach((x) => { const u = (x.units || []).filter(Boolean); if (u.length === 0) g.push([x.typ, ""]); else u.forEach((n) => g.push([x.typ, n])); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(g), "Geräte");
  const b = [["Code", "Bezeichnung", "Gruppe", "Was steckt drin", "Wann wählen"], ...(l.bas || []).filter((x) => x.code).map((x) => [String(x.code), x.name || "", x.group || "", x.desc || "", x.wann || ""])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), "BAS");
  const pr = { ...DEF_PROFIL, ...(l.profil || {}) }; const pfl = { ...DEF_PFLICHT, ...(l.pflicht || {}) };
  const jn = (v) => (v ? "ja" : "nein");
  const pRows = [["Einstellung", "Wert"], ["typ", pr.typ], ["projekt", pr.projekt], ["ort1", pr.ort1], ["ort2Aktiv", jn(pr.ort2Aktiv)], ["ort2", pr.ort2], ["ort2Optionen", (pr.ort2Optionen || []).filter(Boolean).join("; ")],
    ["ort2Ueb", jn(pr.ort2Ueb)], ["ort2UebLabel", pr.ort2UebLabel], ["stationAktiv", jn(pr.stationAktiv)], ["station", pr.station], ["schluessel", pr.schluessel],
    ...Object.keys(DEF_PFLICHT).map((k) => ["pflicht." + k, jn(pfl[k])])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pRows), "Projekt");
  return wb;
}
function workbookToLists(wb, cur) {
  const out = { ...cur }; const found = [];
  const rows = (name) => { const ws = wb.Sheets[name]; return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }).slice(1) : null; };
  const str = (v) => String(v ?? "").trim();
  LIST_SHEETS.forEach(([key, sheet]) => { const r = rows(sheet); if (r) { out[key] = r.map((x) => str(x[0])).filter(Boolean); found.push(sheet); } });
  const g = rows("Geräte");
  if (g) { const m = new Map(); g.forEach((x) => { const t = str(x[0]); if (!t) return; if (!m.has(t)) m.set(t, []); const u = str(x[1]); if (u) m.get(t).push(u); }); out.geraete = [...m.entries()].map(([typ, units]) => ({ typ, units })); found.push("Geräte"); }
  const b = rows("BAS");
  if (b) { out.bas = b.map((x) => ({ code: str(x[0]), name: str(x[1]), group: str(x[2]), desc: str(x[3]), wann: str(x[4]) })).filter((x) => x.code); found.push("BAS"); }
  const pj = rows("Projekt");
  if (pj) {
    const pr = { ...DEF_PROFIL, ...(cur.profil || {}) }; const pfl = { ...DEF_PFLICHT, ...(cur.pflicht || {}) };
    const yes = (v) => /^(ja|true|1|x)$/i.test(str(v));
    pj.forEach((x) => {
      const k = str(x[0]); const v = x[1];
      if (k.startsWith("pflicht.") && k.slice(8) in DEF_PFLICHT) pfl[k.slice(8)] = yes(v);
      else if (["ort2Aktiv", "ort2Ueb", "stationAktiv"].includes(k)) pr[k] = yes(v);
      else if (k === "ort2Optionen") pr.ort2Optionen = str(v).split(";").map((t) => t.trim()).filter(Boolean);
      else if (["typ", "projekt", "ort1", "ort2", "ort2UebLabel", "station", "schluessel"].includes(k) && str(v)) pr[k] = str(v);
    });
    out.profil = pr; out.pflicht = pfl; found.push("Projekt");
  }
  return { lists: out, found };
}


/* ===================== EXPORT (XML / Excel / PDF / Senden) ===================== */
const xmlEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fileBase = (day) => `Bautagesbericht_${(day.projekt || "Projekt").replace(/[^\wÄÖÜäöüß-]+/g, "_")}_${day.datum}`;

function buildXML(day, positions, kurz) {
  const L = ['<?xml version="1.0" encoding="UTF-8"?>', "<bautagesbericht>", "  <kopf>",
    `    <datum>${xmlEsc(day.datum)}</datum>`, `    <projekt>${xmlEsc(day.projekt)}</projekt>`,
    `    <bauleiter>${xmlEsc(day.bauleiter)}</bauleiter>`, `    <gewerk>${xmlEsc(day.gewerk)}</gewerk>`,
    `    <arbeitszeit von="${xmlEsc(day.arbeitStart)}" bis="${xmlEsc(day.arbeitEnde)}"/>`,
    `    <wetter>${xmlEsc(day.wetter)}</wetter>`,
    `    <temperatur min="${xmlEsc(day.tempMin)}" max="${xmlEsc(day.tempMax)}"/>`, "  </kopf>", "  <positionen>"];
  positions.forEach((p, i) => {
    L.push(`    <position nr="${i + 1}">`, `      <sektion>${xmlEsc(p.sektion)}</sektion>`,
      `      <vorhaben>${xmlEsc(p.vorhaben)}</vorhaben>`,
      `      <vorhabenuebergreifend>${xmlEsc(p.vorhabenUeb)}</vorhabenuebergreifend>`,
      `      <station>${xmlEsc(p.station)}</station>`,
      `      <taetigkeit>${xmlEsc(p.taetigkeit)}</taetigkeit>`,
      `      <nachunternehmer>${xmlEsc(p.nachunternehmer)}</nachunternehmer>`,
      `      <bas code="${xmlEsc(p.bas || "")}" kurztext="${xmlEsc(kurz(p.bas))}"/>`,
      `      <beschreibung>${xmlEsc(p.beschreibung)}</beschreibung>`,
      `      <menge einheit="${xmlEsc(p.einheit || "")}">${num(p.menge)}</menge>`,
      `      <personenstunden>${phOf(p)}</personenstunden>`, `      <geraetestunden>${ghOf(p)}</geraetestunden>`, "      <personal>");
    p.personal.filter((x) => x.rolle).forEach((x) =>
      L.push(`        <person rolle="${xmlEsc(x.rolle)}" name="${xmlEsc(x.name)}" anzahl="${num(x.anzahl)}" stunden="${num(x.stunden)}"/>`));
    L.push("      </personal>", "      <geraete>");
    p.geraete.filter((x) => x.typ).forEach((x) =>
      L.push(`        <geraet typ="${xmlEsc(x.typ)}" bezeichnung="${xmlEsc(x.geraet)}" anzahl="${num(x.anzahl)}" stunden="${num(x.stunden)}"/>`));
    L.push("      </geraete>", "    </position>");
  });
  L.push("  </positionen>");
  const still = (day.stillstand || []).filter((s) => s.start || s.ende || s.grund || s.sektion);
  L.push("  <stillstandszeiten>");
  still.forEach((s) => L.push(`    <stillstand sektion="${xmlEsc(s.sektion)}" vorhaben="${xmlEsc(s.vorhaben)}" start="${xmlEsc(s.start)}" ende="${xmlEsc(s.ende)}" stunden="${spanH(s.start, s.ende)}" personal="${xmlEsc(stillPers(s))}" geraete="${xmlEsc(stillGer(s))}">${xmlEsc(s.grund)}</stillstand>`));
  L.push("  </stillstandszeiten>");
  const vork = (day.vorkommnisse || []).filter((v) => (v.text || "").trim());
  L.push("  <vorkommnisse>");
  vork.forEach((v) => L.push(`    <eintrag>${xmlEsc(v.text)}</eintrag>`));
  L.push("  </vorkommnisse>");
  L.push("  <fotos>");
  (day.fotos || []).forEach((f) => L.push(`    <foto datei="${xmlEsc(f.name)}" bereich="${f.stillId ? "Stillstand" : "Allgemein"}">${xmlEsc(f.text)}</foto>`));
  L.push("  </fotos>");
  L.push("</bautagesbericht>");
  return L.join("\n");
}

function buildWorkbook(day, positions, kurz) {
  const posRows = positions.map((p, i) => ({
    Nr: i + 1, Datum: day.datum, Projekt: day.projekt, Bauleiter: day.bauleiter, Gewerk: day.gewerk,
    "Arbeit von": day.arbeitStart, "Arbeit bis": day.arbeitEnde, [_prof.ort1]: p.sektion || "",
    ...(_prof.ort2Aktiv ? { [_prof.ort2]: ort2Text(p) } : {}), ...(_prof.stationAktiv ? { [_prof.station]: p.station || "" } : {}),
    Tätigkeit: p.taetigkeit || "", Nachunternehmer: p.nachunternehmer || "", BAS: p.bas || "", Kurztext: kurz(p.bas), Beschreibung: p.beschreibung || "",
    Menge: num(p.menge), Einheit: p.einheit || "", Personenstunden: phOf(p), Gerätestunden: ghOf(p),
  }));
  const persRows = [];
  positions.forEach((p, i) => p.personal.filter((x) => x.rolle).forEach((x) => persRows.push({
    Pos: i + 1, BAS: p.bas || "", Rolle: x.rolle, Name: x.name || "", Anzahl: num(x.anzahl), "Stunden/Person": num(x.stunden), Personenstunden: num(x.anzahl) * num(x.stunden),
  })));
  const gerRows = [];
  positions.forEach((p, i) => p.geraete.filter((x) => x.typ).forEach((x) => gerRows.push({
    Pos: i + 1, BAS: p.bas || "", Gerätetyp: x.typ, "Gerät (genau)": x.geraet, Anzahl: num(x.anzahl), Betriebsstunden: num(x.stunden), Gerätestunden: (num(x.anzahl) || 1) * num(x.stunden),
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(posRows.length ? posRows : [{ Nr: "" }]), "Positionen");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(persRows.length ? persRows : [{ Pos: "" }]), "Personal");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gerRows.length ? gerRows : [{ Pos: "" }]), "Geräte");
  const stillRows = (day.stillstand || []).filter((s) => s.start || s.ende || s.grund || s.sektion).map((s, i) => ({
    Nr: i + 1, [_prof.ort1]: s.sektion, ...(_prof.ort2Aktiv ? { [_prof.ort2]: s.vorhaben } : {}), Startzeit: s.start, Endzeit: s.ende, Stunden: spanH(s.start, s.ende), Begründung: s.grund, Personal: stillPers(s), Geräte: stillGer(s),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stillRows.length ? stillRows : [{ Nr: "" }]), "Stillstand");
  const vorkRows = (day.vorkommnisse || []).filter((v) => (v.text || "").trim()).map((v, i) => ({ Nr: i + 1, Vorkommnis: v.text }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vorkRows.length ? vorkRows : [{ Nr: "" }]), "Vorkommnisse");
  const fotoRows = (day.fotos || []).map((f, i) => ({ Nr: i + 1, Bereich: f.stillId ? "Stillstand" : "Allgemein", Datei: f.name, Beschreibung: f.text }));
  if (fotoRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fotoRows), "Fotos");
  return wb;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
const exportXML = (day, positions, kurz) =>
  downloadBlob(new Blob([buildXML(day, positions, kurz)], { type: "application/xml;charset=utf-8" }), fileBase(day) + ".xml");
const exportExcel = (day, positions, kurz) => {
  try { XLSX.writeFile(buildWorkbook(day, positions, kurz), fileBase(day) + ".xlsx"); }
  catch (e) {
    const out = XLSX.write(buildWorkbook(day, positions, kurz), { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([out], { type: "application/octet-stream" }), fileBase(day) + ".xlsx");
  }
};
async function buildPdfBlob(day, positions, kurz, fotos) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setTextColor(15, 30, 70);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = 46;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("HABAU INFRA", M, y); y += 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("BAUTAGESBERICHT", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(String(day.projekt || ""), M, y + 15);
  doc.setFont("helvetica", "bold"); doc.text(dateDE(day.datum), W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  const Wt = WETTER.find((w) => w.key === day.wetter);
  const hdr = [
    `${Wt ? Wt.label : day.wetter} · ${day.tempMin || "–"}/${day.tempMax || "–"} °C`,
    (day.arbeitStart || day.arbeitEnde) ? `Arbeitszeit: ${day.arbeitStart || "–"}–${day.arbeitEnde || "–"}` : null,
    day.gewerk ? `Gewerk: ${day.gewerk}` : null,
    day.bauleiter ? `Bauleiter: ${day.bauleiter}` : null,
  ].filter(Boolean);
  hdr.forEach((t, i) => doc.text(t, W - M, y + 15 + i * 13, { align: "right" }));
  y = y + 15 + Math.max(hdr.length * 13, 13) + 8;
  doc.setDrawColor(250, 210, 0); doc.setLineWidth(2); doc.line(M, y, W - M, y); y += 14;

  autoTable(doc, {
    startY: y,
    head: [["Nr", _prof.schluessel, _prof.ort1 + (_prof.ort2Aktiv ? " · " + _prof.ort2 : ""), "Tätigkeit", "Beschreibung", "Menge", "P-Std", "G-Std"]],
    body: positions.map((p, i) => [
      i + 1, p.bas || "—", [p.sektion, ort2Text(p), p.station].filter(Boolean).join(" · "),
      (p.taetigkeit || "") + (p.nachunternehmer ? "\nNU: " + p.nachunternehmer : ""), p.beschreibung || "", num(p.menge) ? `${fmt(num(p.menge))} ${p.einheit || ""}` : "", fmt(phOf(p)), fmt(ghOf(p)),
    ]),
    styles: { fontSize: 8, cellPadding: 3, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [15, 30, 70], textColor: 255, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 42 }, 5: { halign: "right", cellWidth: 50 }, 6: { halign: "right", cellWidth: 32 }, 7: { halign: "right", cellWidth: 32 } },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 10;

  positions.forEach((p, i) => {
    const persRows = p.personal.filter((x) => x.rolle).map((x) => [x.rolle + (x.name ? " – " + x.name : ""), String(x.anzahl || ""), String(x.stunden || "")]);
    const gerRows = p.geraete.filter((x) => x.typ).map((x) => [geraetLabel(x), String(x.anzahl || ""), String(x.stunden || "")]);
    if (!persRows.length && !gerRows.length) return;
    if (y > H - 90) { doc.addPage(); y = 46; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(`Pos. ${i + 1} · ${p.bas ? p.bas + " " + kurz(p.bas) : "ohne BAS"}`, M, y); y += 4;
    autoTable(doc, {
      startY: y, theme: "grid",
      head: [["Personal", "Anz.", "Std.", "Gerät", "Anz.", "Std."]],
      body: Array.from({ length: Math.max(persRows.length, gerRows.length) }).map((_, r) => [
        persRows[r]?.[0] || "", persRows[r]?.[1] || "", persRows[r]?.[2] || "", gerRows[r]?.[0] || "", gerRows[r]?.[1] || "", gerRows[r]?.[2] || "",
      ]),
      styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [218, 225, 240], textColor: [15, 30, 70], fontSize: 8 }, margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 10;
  });

  const still = (day.stillstand || []).filter((s) => s.start || s.ende || s.grund || s.sektion);
  if (still.length) {
    if (y > H - 90) { doc.addPage(); y = 46; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Stillstandszeiten", M, y); y += 4;
    autoTable(doc, {
      startY: y, head: [["Nr", _prof.ort1, _prof.ort2Aktiv ? _prof.ort2 : "", "Start", "Ende", "Begründung", "Personal / Geräte"]],
      body: still.map((s, i) => [i + 1, s.sektion, s.vorhaben, s.start, s.ende, s.grund, [stillPers(s), stillGer(s)].filter(Boolean).join("\n")]),
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" }, headStyles: { fillColor: [15, 30, 70], textColor: 255 }, margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + 10;
  }
  const vork = (day.vorkommnisse || []).filter((v) => (v.text || "").trim());
  if (vork.length) {
    if (y > H - 70) { doc.addPage(); y = 46; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Besondere Vorkommnisse / Besucher", M, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    vork.forEach((v, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${v.text}`, W - 2 * M);
      if (y + lines.length * 12 > H - 30) { doc.addPage(); y = 46; }
      doc.text(lines, M, y); y += lines.length * 12 + 3;
    });
  }
  const drawFotos = (title, list) => {
    if (!list.length) return;
    doc.addPage(); y = 46;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(title, M, y); y += 14;
    const cw = (W - 2 * M - 12) / 2; let col = 0; let rowH = 0;
    list.forEach((f, i) => {
      let ih = 150;
      try { const pr = doc.getImageProperties(f.data); ih = Math.min(220, cw * pr.height / pr.width); } catch (e) {}
      if (col === 0 && y + ih + 24 > H - 30) { doc.addPage(); y = 46; }
      const x = M + col * (cw + 12);
      try { doc.addImage(f.data, "JPEG", x, y, cw, ih); } catch (e) {}
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(doc.splitTextToSize(`${f.still ? "Stillstand " + f.still + ": " : (i + 1) + ". "}${f.text || f.name || ""}`, cw), x, y + ih + 10);
      rowH = Math.max(rowH, ih + 26);
      if (col === 1) { y += rowH; rowH = 0; col = 0; } else col = 1;
    });
  };
  drawFotos("Fotos zu Stillstandszeiten", (fotos || []).filter((f) => f.still));
  drawFotos("Fotos", (fotos || []).filter((f) => !f.still));
  return doc.output("blob");
}

async function saveWithPicker(file) {
  const ext = file.name.split(".").pop();
  const handle = await window.showSaveFilePicker({ suggestedName: file.name, types: [{ description: ext.toUpperCase(), accept: { [file.type]: ["." + ext] } }] });
  const ws = await handle.createWritable(); await ws.write(file); await ws.close();
}

/* E-Mail-Entwurf (.eml) mit Anhängen: Outlook öffnet ihn als neue, noch nicht gesendete Nachricht */
async function buildEml(subject, text, files) {
  const b64 = (bytes) => { let bin = ""; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin).replace(/(.{76})/g, "$1\r\n"); };
  const utf8 = (t) => new TextEncoder().encode(t);
  const enc = (t) => "=?UTF-8?B?" + btoa(String.fromCharCode.apply(null, utf8(t))) + "?=";
  const bd = "----=_Bautagesbericht_" + Date.now();
  const parts = ["X-Unsent: 1", "Subject: " + enc(subject), "MIME-Version: 1.0", 'Content-Type: multipart/mixed; boundary="' + bd + '"', "",
    "--" + bd, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(utf8(text)), ""];
  for (const f of files) {
    parts.push("--" + bd, 'Content-Type: ' + (f.type || "application/octet-stream") + '; name="' + f.name + '"', "Content-Transfer-Encoding: base64",
      'Content-Disposition: attachment; filename="' + f.name + '"', "", b64(await f.arrayBuffer()), "");
  }
  parts.push("--" + bd + "--", "");
  return new Blob([parts.join("\r\n")], { type: "message/rfc822" });
}

/* Senden: PDF + XML. Handy -> Teilen-Menü (Outlook wählen). PC -> E-Mail-Entwurf für Outlook. Rückgabe: was passiert ist. */
async function shareReport(day, positions, kurz, fotos) {
  const base = fileBase(day);
  const xmlFile = new File([buildXML(day, positions, kurz)], base + ".xml", { type: "application/xml" });
  let pdfFile = null;
  try { const pdf = await buildPdfBlob(day, positions, kurz, fotos); pdfFile = new File([pdf], base + ".pdf", { type: "application/pdf" }); } catch (e) { /* PDF nicht möglich -> nur XML */ }
  const files = pdfFile ? [pdfFile, xmlFile] : [xmlFile];
  const subject = `Bautagesbericht ${day.projekt || ""} ${dateDE(day.datum)}`.replace(/\s+/g, " ").trim();
  const text = `Guten Tag,\n\nanbei der Bautagesbericht vom ${dateDE(day.datum)} (${positions.length} Leistungen) als PDF und als XML.\n\nViele Grüße${day.bauleiter ? "\n" + day.bauleiter : ""}`;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  // 1) Handy: natives Teilen-Menü – Outlook wählen, beide Dateien sind angehängt
  if (mobile && navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, title: subject, text }); return "share"; }
    catch (e) { if (e && e.name === "AbortError") return "abort"; }
  }
  // 2) PC: Entwurf als .eml – beim Öffnen zeigt Outlook eine neue E-Mail mit beiden Anhängen
  if (!mobile) {
    try { downloadBlob(await buildEml(subject, text, files), base + ".eml"); return "eml"; } catch (e) { /* weiter zum Download */ }
  }
  // 3) Fallback: beide Dateien herunterladen
  files.forEach((f) => downloadBlob(f, f.name));
  return "download";
}

const emptyDay = (projekt = DEF_PROFIL.projekt) => ({ datum: today(), projekt, bauleiter: "", gewerk: "", arbeitStart: "", arbeitEnde: "", wetter: "heiter", tempMin: "", tempMax: "", stillstand: [], vorkommnisse: [], fotos: [] });
const emptyDraft = () => ({
  id: uid(), sektion: "", vorhabenUeb: "Nein", vorhaben: "", station: "", taetigkeit: "", nachunternehmer: "", bas: "", beschreibung: "", menge: "", einheit: "",
  personal: [{ id: uid(), rolle: "", anzahl: "", stunden: "" }],
  geraete: [{ id: uid(), typ: "", geraet: "", anzahl: "1", stunden: "" }],
});

/* ===================== KLEINE UI-BAUSTEINE ===================== */
const Label = ({ children, hint }) => (
  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#0F1E46]/70">
    {children}{hint && <span className="ml-1 normal-case tracking-normal text-[#677BA4]">{hint}</span>}
  </label>
);
const inputCls = "w-full min-h-[46px] rounded-sm border border-[#C8D2E6] bg-white px-3 text-[15px] text-[#0F1E46] placeholder-[#96A8C7] outline-none transition focus:border-[#0F1E46] focus:ring-1 focus:ring-[#0F1E46]";

function Combo({ value, onChange, options, placeholder = "– wählen –" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const sel = options.find((o) => o.value === value);
  const ql = q.trim().toLowerCase();
  const filtered = ql ? options.filter((o) => `${o.value} ${o.label}`.toLowerCase().includes(ql)) : options;
  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen((v) => !v); setQ(""); }}
        className={`${inputCls} flex items-center justify-between gap-2 text-left`}>
        <span className={`truncate ${sel ? "text-[#0F1E46]" : "text-[#677BA4]"}`}>{sel ? sel.label : placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-[#677BA4]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-sm border border-[#C8D2E6] bg-white">
            <div className="flex items-center gap-2 border-b border-[#C8D2E6] px-3 py-2">
              <Search size={15} className="text-[#677BA4]" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen…" className="w-full bg-transparent text-sm outline-none" />
            </div>
            <div className="max-h-60 overflow-auto py-1">
              {filtered.length === 0 && <div className="px-3 py-3 text-sm text-[#677BA4]">Keine Treffer</div>}
              {filtered.map((o, i) => {
                const showGroup = o.group && (i === 0 || filtered[i - 1].group !== o.group);
                return (
                  <Fragment key={o.value + i}>
                    {showGroup && <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[#677BA4]">{o.group}</div>}
                    <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-[#DAE1F0] ${o.value === value ? "bg-[#DAE1F0] font-semibold text-[#0F1E46]" : "text-[#0F1E46]"}`}>
                      {o.code !== undefined && <span className="w-12 shrink-0 pt-0.5 tabular-nums text-xs text-[#0F1E46]/70">{o.code}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.labelShort ?? o.label}</span>
                        {o.sub && <span className="mt-0.5 block text-xs font-normal leading-snug text-[#677BA4] line-clamp-2">{o.sub}…</span>}
                      </span>
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
const Field = ({ label, hint, children }) => (<div><Label hint={hint}>{label}</Label>{children}</div>);

function TopBar({ title, subtitle, left, right }) {
  return (
    <header className="sticky top-0 z-10 border-b-4 border-[#FAD200] bg-[#0F1E46] text-white print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        {left}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold leading-none tracking-wide text-white">HABAU INFRA</p>
          <h1 className="mt-1 truncate text-base font-bold leading-none tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-1 truncate text-[11px] text-white/70">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}
const Shell = ({ children }) => (
  <div className="min-h-screen bg-white text-[#0F1E46]" style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}>{children}</div>
);
const RowShell = ({ index, onRemove, children }) => (
  <div className="rounded-sm border border-[#C8D2E6] bg-[#DAE1F0]/40 p-3">
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#677BA4]">Zeile {index + 1}</span>
      <button onClick={onRemove} className="rounded-sm p-1 text-[#677BA4] transition hover:bg-[#DAE1F0] hover:text-[#C62828]" aria-label="Entfernen"><Trash2 size={16} /></button>
    </div>
    {children}
  </div>
);
const AddBtn = ({ onClick, children }) => (
  <button onClick={onClick} className="mt-3 inline-flex items-center gap-2 rounded-sm bg-[#FAD200] px-3 py-2 text-sm font-bold text-[#0F1E46] transition hover:bg-[#FCE466]"><Plus size={16} /> {children}</button>
);


/* ===================== APP ===================== */

/* Auswahl "Ausführung durch": Eigenleistung oder Nachunternehmer (bestehend oder neu) */
function NuSelect({ value, names, onChange, compact }) {
  const [open, setOpen] = useState(false);
  const [neu, setNeu] = useState("");
  const pick = (v) => { onChange(v); setOpen(false); setNeu(""); };
  const item = "flex w-full items-center px-3 py-2 text-left text-sm hover:bg-[#DAE1F0]";
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={`flex w-full items-center justify-between gap-1 rounded-sm border border-[#C8D2E6] bg-white text-left text-[#0F1E46] ${compact ? "min-h-[38px] px-2 text-sm" : "min-h-[46px] px-3 text-[15px]"}`}>
        <span className="min-w-0">
          <span className="block truncate">{value || "Eigenleistung"}</span>
          {value && compact && <span className="block text-[10px] uppercase tracking-wider text-[#677BA4]">Nachunternehmer</span>}
        </span>
        <ChevronDown size={15} className="shrink-0 text-[#677BA4]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-64 max-w-[85vw] rounded-sm border border-[#C8D2E6] bg-white">
            <button type="button" onClick={() => pick("")} className={`${item} ${!value ? "bg-[#DAE1F0] font-semibold" : ""} text-[#0F1E46]`}>Eigenleistung</button>
            <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[#677BA4]">Nachunternehmer</div>
            <div className="max-h-48 overflow-auto">
              {names.length === 0 && <p className="px-3 pb-2 text-xs text-[#677BA4]">Noch keiner hinterlegt.</p>}
              {names.map((n) => (<button type="button" key={n} onClick={() => pick(n)} className={`${item} ${value === n ? "bg-[#DAE1F0] font-semibold" : ""} text-[#0F1E46]`}>{n}</button>))}
            </div>
            <div className="flex gap-1 border-t border-[#C8D2E6] p-2">
              <input value={neu} onChange={(e) => setNeu(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && neu.trim()) pick(neu.trim()); }} placeholder="Neuer Nachunternehmer …" className="min-h-[38px] w-full rounded-sm border border-[#C8D2E6] px-2 text-sm text-[#0F1E46] outline-none focus:border-[#0F1E46]" />
              <button type="button" onClick={() => neu.trim() && pick(neu.trim())} className="shrink-0 rounded-sm bg-[#0F1E46] px-3 text-sm font-bold text-white">OK</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* Tabelle: Stunden je Kategorie (Gerätetyp/Rolle), aufklappbar auf einzelne Geräte bzw. Namen */
function HoursTable({ title, icon: Icon, first, rows, unit, dayH }) {
  const [open, setOpen] = useState({});
  const sum = rows.reduce((t, r) => t + r.hours, 0);
  return (
    <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#0F1E46]"><Icon size={16} /> {title} <span className="text-[#677BA4]">({rows.length})</span></h2>
      {rows.length === 0 ? <p className="text-sm text-[#0F1E46]/70">Noch nichts erfasst.</p> : (
        <table className="w-full table-fixed border-collapse text-sm">
          <thead><tr className="bg-[#0F1E46] text-left text-[11px] font-bold uppercase tracking-wider text-white">
            <th className="px-2 py-1">{first}</th><th className="w-12 px-2 py-1 text-right">Anz.</th><th className="w-14 px-2 py-1 text-right">Std.</th><th className="w-[34%] px-2 py-1">Vom Arbeitstag</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => { const avail = r.count * dayH; const pct = avail > 0 ? r.hours / avail : 0; const isOpen = !!open[r.label]; return (
              <Fragment key={r.label}>
                <tr onClick={() => setOpen((o) => ({ ...o, [r.label]: !o[r.label] }))} className="cursor-pointer border-b border-[#C8D2E6] align-top text-[#0F1E46] hover:bg-[#DAE1F0]/40" aria-expanded={isOpen}>
                  <td className="break-words px-2 py-1.5 font-semibold">{isOpen ? <ChevronDown size={14} className="mr-1 inline" /> : <ChevronRight size={14} className="mr-1 inline" />}{r.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.count)}</td>
                  <td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmt(r.hours)}</td>
                  <td className="px-2 py-1.5">
                    {avail > 0 ? (<>
                      <div className="h-2 w-full bg-[#C8D2E6]"><div className={`h-2 ${pct > 1 ? "bg-[#C62828]" : "bg-[#0F1E46]"}`} style={{ width: `${Math.min(pct, 1) * 100}%` }} /></div>
                      <p className={`mt-0.5 text-[11px] tabular-nums ${pct > 1 ? "font-bold text-[#C62828]" : "text-[#0F1E46]/70"}`}>{fmt(r.hours)} von {fmt(avail)} Std. · {Math.round(pct * 100)} %</p>
                    </>) : <span className="text-[11px] text-[#677BA4]">—</span>}
                  </td>
                </tr>
                {isOpen && r.details.map((d) => (
                  <tr key={d.label} className="border-b border-[#C8D2E6] bg-[#DAE1F0]/40 align-top text-[#0F1E46]">
                    <td className="break-words py-1 pl-7 pr-2 text-[13px]">{d.label}</td>
                    <td className="px-2 py-1 text-right text-[13px] tabular-nums">{fmt(d.count)}</td>
                    <td className="px-2 py-1 text-right text-[13px] tabular-nums">{fmt(d.hours)}</td>
                    <td className="px-2 py-1 text-[11px] text-[#0F1E46]/70">{d.wo}</td>
                  </tr>
                ))}
              </Fragment>
            ); })}
            <tr className="font-bold text-[#0F1E46]"><td className="border-t-2 border-[#0F1E46] px-2 py-1.5">Summe</td><td className="border-t-2 border-[#0F1E46]" /><td className="border-t-2 border-[#0F1E46] px-2 py-1.5 text-right tabular-nums">{fmt(sum)}</td><td className="border-t-2 border-[#0F1E46] px-2 py-1.5 text-[11px] font-normal">{unit}</td></tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ===================== Einstellungen: Tabellen-Editoren ===================== */
const TH_CLS = "px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider";
const CELL_INPUT = "w-full min-h-[40px] rounded-sm border border-[#C8D2E6] bg-white px-2 text-sm text-[#0F1E46] placeholder-[#96A8C7] outline-none transition focus:border-[#0F1E46] focus:ring-1 focus:ring-[#0F1E46]";
const DEL_BTN = "shrink-0 rounded-sm p-2 text-[#677BA4] hover:bg-[#DAE1F0] hover:text-[#C62828]";

/* Pflicht / Freiwillig als zwei Schaltflächen */
function PflichtToggle({ value, onChange }) {
  const cls = (on) => `min-h-[40px] flex-1 rounded-sm border px-3 text-sm font-semibold transition ${on ? "border-[#0F1E46] bg-[#0F1E46] text-white" : "border-[#C8D2E6] bg-white text-[#0F1E46] hover:bg-[#DAE1F0]"}`;
  return (
    <div className="flex w-full max-w-[260px] gap-2">
      <button type="button" aria-pressed={!!value} onClick={() => onChange(true)} className={cls(!!value)}>Pflicht</button>
      <button type="button" aria-pressed={!value} onClick={() => onChange(false)} className={cls(!value)}>Freiwillig</button>
    </div>
  );
}
/* Hinweisleiste oberhalb jeder Liste */
function PflichtBar({ frage, value, onChange }) {
  return (
    <div className="mb-4 border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3">
      <p className="mb-2 text-sm font-semibold text-[#0F1E46]">{frage}</p>
      <PflichtToggle value={value} onChange={onChange} />
      <p className="mt-2 text-xs text-[#0F1E46]/70">{value ? "Ohne diese Angabe kann die Leistung nicht gespeichert werden." : "Die Leistung kann auch ohne diese Angabe gespeichert werden."}</p>
    </div>
  );
}
function TableSearch({ value, onChange, placeholder }) {
  return (
    <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-sm border border-[#C8D2E6] bg-white px-3">
      <Search size={15} className="text-[#677BA4]" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[44px] w-full bg-transparent text-sm text-[#0F1E46] outline-none" />
    </div>
  );
}

/* Einfache Liste als Tabelle: Nr. | Bezeichnung | Löschen */
function ListTable({ items, onChange, placeholder }) {
  const [q, setQ] = useState("");
  const wrap = React.useRef(null);
  const focusRow = React.useRef(-1);
  const ql = q.trim().toLowerCase();
  const rows = items.map((v, i) => ({ v, i })).filter(({ v }) => !ql || (v || "").toLowerCase().includes(ql));
  useEffect(() => {
    if (focusRow.current < 0) return;
    const el = wrap.current && wrap.current.querySelector(`[data-row="${focusRow.current}"]`);
    focusRow.current = -1;
    if (el) el.focus();
  }, [items.length]);
  const add = () => { setQ(""); focusRow.current = items.length; onChange([...items, ""]); };
  return (
    <div ref={wrap}>
      {items.length > 15 && <div className="mb-3 flex"><TableSearch value={q} onChange={setQ} placeholder="Suchen…" /></div>}
      <div className="relative overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead><tr className="bg-[#0F1E46] text-white">
            <th className={`${TH_CLS} w-14`}>Nr.</th><th className={TH_CLS}>Bezeichnung</th><th className="w-12 px-1 py-2"><span className="sr-only">Löschen</span></th>
          </tr></thead>
          <tbody>
            {rows.map(({ v, i }) => (
              <tr key={i} className="border-b border-[#C8D2E6]">
                <td className="px-2 py-1.5 tabular-nums text-[#677BA4]">{i + 1}</td>
                <td className="px-2 py-1.5"><input data-row={i} className={CELL_INPUT} value={v} placeholder={placeholder} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} /></td>
                <td className="px-1 py-1.5 text-center"><button onClick={() => onChange(items.filter((_, k) => k !== i))} className={DEL_BTN} aria-label="Zeile löschen"><Trash2 size={16} /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="px-2 py-3 text-sm text-[#677BA4]">{items.length === 0 ? "Noch keine Einträge." : "Keine Treffer."}</td></tr>}
          </tbody>
        </table>
      </div>
      <AddBtn onClick={add}>Zeile hinzufügen</AddBtn>
    </div>
  );
}

/* Geräte als Tabelle: Gerätetyp | Genaue Geräte (mit ; getrennt) | Anz. | Löschen */
function GeraeteTable({ geraete, onChange }) {
  const toRaw = (g) => (g.units || []).join("; ");
  const [raw, setRaw] = useState(() => geraete.map(toRaw));
  const lastEmitted = React.useRef(geraete);
  const wrap = React.useRef(null);
  const focusRow = React.useRef(-1);
  const parse = (t) => t.split(";").map((u) => u.trim()).filter(Boolean);
  useEffect(() => { // von außen geändert (Excel-Import, Standard) → Rohtext neu aufbauen
    if (geraete !== lastEmitted.current) { lastEmitted.current = geraete; setRaw(geraete.map(toRaw)); }
  }, [geraete]);
  useEffect(() => {
    if (focusRow.current < 0) return;
    const el = wrap.current && wrap.current.querySelector(`[data-row="${focusRow.current}"]`);
    focusRow.current = -1;
    if (el) el.focus();
  }, [geraete.length]);
  const emit = (next, nextRaw) => { lastEmitted.current = next; setRaw(nextRaw); onChange(next); };
  const setTyp = (i, typ) => emit(geraete.map((g, k) => (k === i ? { ...g, typ } : g)), raw);
  const setUnits = (i, t) => emit(geraete.map((g, k) => (k === i ? { ...g, units: parse(t) } : g)), raw.map((r, k) => (k === i ? t : r)));
  const del = (i) => emit(geraete.filter((_, k) => k !== i), raw.filter((_, k) => k !== i));
  const add = () => { focusRow.current = geraete.length; emit([...geraete, { typ: "", units: [] }], [...raw, ""]); };
  return (
    <div ref={wrap}>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed border-collapse text-sm">
          <thead><tr className="bg-[#0F1E46] text-white">
            <th className={`${TH_CLS} w-[32%]`}>Gerätetyp</th><th className={TH_CLS}>Genaue Geräte <span className="font-normal normal-case tracking-normal text-white/70">(mit ; trennen)</span></th>
            <th className={`${TH_CLS} w-14 text-right`}>Anz.</th><th className="w-12 px-1 py-2"><span className="sr-only">Löschen</span></th>
          </tr></thead>
          <tbody>
            {geraete.map((g, i) => (
              <tr key={i} className="border-b border-[#C8D2E6] align-top">
                <td className="px-2 py-1.5"><input data-row={i} className={CELL_INPUT} value={g.typ} placeholder="z. B. Kettenbagger" onChange={(e) => setTyp(i, e.target.value)} /></td>
                <td className="px-2 py-1.5"><input className={CELL_INPUT} value={raw[i] ?? ""} placeholder="CAT 320; Liebherr R 926" spellCheck={false} onChange={(e) => setUnits(i, e.target.value)} /></td>
                <td className="px-2 py-1.5 pt-3 text-right tabular-nums text-[#0F1E46]">{(g.units || []).length}</td>
                <td className="px-1 py-1.5 text-center"><button onClick={() => del(i)} className={DEL_BTN} aria-label="Zeile löschen"><Trash2 size={16} /></button></td>
              </tr>
            ))}
            {geraete.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-sm text-[#677BA4]">Noch keine Gerätetypen.</td></tr>}
          </tbody>
        </table>
      </div>
      <AddBtn onClick={add}>Zeile hinzufügen</AddBtn>
    </div>
  );
}

/* BAS als breite Tabelle */
function BasTable({ bas, onChange }) {
  const [q, setQ] = useState("");
  const wrap = React.useRef(null);
  const focusTop = React.useRef(false);
  const ql = q.trim().toLowerCase();
  const rows = bas.map((b, i) => ({ b, i })).filter(({ b }) => !ql || `${b.code} ${b.name} ${b.group} ${b.desc} ${b.wann || ""}`.toLowerCase().includes(ql));
  useEffect(() => {
    if (!focusTop.current) return;
    focusTop.current = false;
    const el = wrap.current && wrap.current.querySelector('[data-row="0"]');
    if (el) el.focus();
  }, [bas.length]);
  const setRow = (i, patch) => onChange(bas.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  const add = () => { setQ(""); focusTop.current = true; onChange([{ code: "", name: "", group: "", desc: "", wann: "" }, ...bas]); };
  return (
    <div ref={wrap}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableSearch value={q} onChange={setQ} placeholder="BAS suchen (Code, Bezeichnung, Gruppe, Inhalt) …" />
        <button onClick={add} className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-[#FAD200] px-3 py-2 text-sm font-bold text-[#0F1E46] transition hover:bg-[#FCE466]"><Plus size={16} /> BAS hinzufügen</button>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
          <thead><tr className="bg-[#0F1E46] text-white">
            <th className={`${TH_CLS} w-[88px]`}>Code</th><th className={`${TH_CLS} w-[20%]`}>Bezeichnung</th><th className={`${TH_CLS} w-[14%]`}>Gruppe</th>
            <th className={TH_CLS}>Was steckt drin</th><th className={TH_CLS}>Wann wählen</th><th className="w-12 px-1 py-2"><span className="sr-only">Löschen</span></th>
          </tr></thead>
          <tbody>
            {rows.map(({ b, i }) => (
              <tr key={i} className="border-b border-[#C8D2E6] align-top">
                <td className="px-2 py-1.5"><input data-row={i} className={`${CELL_INPUT} tabular-nums`} value={b.code} placeholder="Code" onChange={(e) => setRow(i, { code: e.target.value })} /></td>
                <td className="px-2 py-1.5"><input className={CELL_INPUT} value={b.name} placeholder="Bezeichnung" onChange={(e) => setRow(i, { name: e.target.value })} /></td>
                <td className="px-2 py-1.5"><input className={CELL_INPUT} value={b.group || ""} placeholder="Gruppe" onChange={(e) => setRow(i, { group: e.target.value })} /></td>
                <td className="px-2 py-1.5"><textarea rows={2} className={`${CELL_INPUT} py-1.5`} value={b.desc || ""} placeholder="Inhalt …" onChange={(e) => setRow(i, { desc: e.target.value })} /></td>
                <td className="px-2 py-1.5"><textarea rows={2} className={`${CELL_INPUT} py-1.5`} value={b.wann || ""} placeholder="Wann wählen …" onChange={(e) => setRow(i, { wann: e.target.value })} /></td>
                <td className="px-1 py-1.5 text-center"><button onClick={() => onChange(bas.filter((_, k) => k !== i))} className={DEL_BTN} aria-label="Zeile löschen"><Trash2 size={16} /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-2 py-3 text-sm text-[#677BA4]">Keine Treffer.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Ja / Nein als zwei Schaltflächen */
function JaNein({ value, onChange }) {
  const cls = (on) => `min-h-[40px] w-20 rounded-sm border px-3 text-sm font-semibold transition ${on ? "border-[#0F1E46] bg-[#0F1E46] text-white" : "border-[#C8D2E6] bg-white text-[#0F1E46] hover:bg-[#DAE1F0]"}`;
  return (<div className="flex gap-2"><button type="button" aria-pressed={!!value} onClick={() => onChange(true)} className={cls(!!value)}>Ja</button><button type="button" aria-pressed={!value} onClick={() => onChange(false)} className={cls(!value)}>Nein</button></div>);
}

/* Zeile im Reiter "Projekt" (außerhalb definiert, damit Eingabefelder den Fokus behalten) */
const ProfRow = ({ title, hint, children }) => (
  <div className="grid gap-2 border-b border-[#C8D2E6] py-3 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] sm:gap-4">
    <div><p className="text-sm font-semibold text-[#0F1E46]">{title}</p>{hint && <p className="text-xs text-[#0F1E46]/70">{hint}</p>}</div>
    <div className="min-w-0">{children}</div>
  </div>
);

/* Tab "Projekt": Projekttyp wählen und alles Projektspezifische einstellen */
function ProjektTab({ prof, onProfil, onTyp }) {
  const [mitBeispiel, setMitBeispiel] = useState(false);
  const opts = (prof.ort2Optionen || []).filter((x) => x.trim());
  return (
    <div className="space-y-4">
      <section className="min-w-0 rounded-sm border border-[#C8D2E6] border-l-4 border-l-[#FAD200] bg-white p-4">
        <h2 className="text-sm font-bold text-[#0F1E46]">1 · Projekttyp wählen</h2>
        <p className="mt-1 text-sm text-[#0F1E46]/70">Der Typ stellt die Bezeichnungen und Auswahlfelder passend ein. Danach kannst du unten alles anpassen.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROFIL_TYPEN.map((t) => (
            <div key={t.key} data-typ={t.key} className={`rounded-sm border p-3 ${prof.typ === t.key ? "border-[#0F1E46] bg-[#DAE1F0]" : "border-[#C8D2E6] bg-white"}`}>
              <p className="font-bold text-[#0F1E46]">{t.name}</p>
              <p className="text-xs text-[#0F1E46]/70">{t.was}</p>
              <p className="mt-2 text-xs text-[#0F1E46]">{t.ort1}{t.ort2Aktiv ? ` → ${t.ort2} (${t.ort2Optionen.join(", ")})` : ""}{t.stationAktiv ? ` · ${t.station}` : ""}</p>
              <button onClick={() => onTyp(t, mitBeispiel)} className="mt-3 inline-flex items-center gap-2 rounded-sm bg-[#FAD200] px-3 py-2 text-sm font-bold text-[#0F1E46] hover:bg-[#FCE466]">{prof.typ === t.key ? "Erneut übernehmen" : "Übernehmen"}</button>
            </div>
          ))}
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-[#0F1E46]"><input type="checkbox" className="mt-1" checked={mitBeispiel} onChange={(e) => setMitBeispiel(e.target.checked)} /><span>Beispiel-Einträge für die Ortsliste mit übernehmen <span className="text-[#C62828]">(ersetzt die jetzige Liste)</span></span></label>
      </section>

      <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4">
        <h2 className="text-sm font-bold text-[#0F1E46]">2 · Einstellungen für dieses Projekt</h2>
        <ProfRow title="Projektname" hint="Steht im Kopf jedes neuen Tagesberichts."><input className={CELL_INPUT} value={prof.projekt} onChange={(e) => onProfil({ projekt: e.target.value })} placeholder="Name des Projekts" /></ProfRow>
        <ProfRow title="Ort – erste Ebene" hint="Wie heißt die Ortsangabe? Zum Beispiel Sektion, Abschnitt, Bauteil, Gebäude, Baufeld. Die Einträge pflegst du im Reiter daneben."><input className={CELL_INPUT} value={prof.ort1} onChange={(e) => onProfil({ ort1: e.target.value })} placeholder="Sektion" /></ProfRow>
        <ProfRow title="Ort – zweite Ebene" hint="Zusätzliche Auswahl, zum Beispiel Fahrtrichtung, Seite, Vorhaben, Teilbauwerk, Geschoss."><JaNein value={prof.ort2Aktiv} onChange={(v) => onProfil({ ort2Aktiv: v })} /></ProfRow>
        {prof.ort2Aktiv && <>
          <ProfRow title="Bezeichnung der zweiten Ebene"><input className={CELL_INPUT} value={prof.ort2} onChange={(e) => onProfil({ ort2: e.target.value })} placeholder="Fahrtrichtung" /></ProfRow>
          <ProfRow title="Auswahlmöglichkeiten" hint="So viele, wie das Projekt braucht: zwei Richtungen, drei Teilbauwerke, fünf Geschosse …"><ListTable items={prof.ort2Optionen || []} onChange={(v) => onProfil({ ort2Optionen: v })} placeholder="z. B. Richtung Nord" /></ProfRow>
          <ProfRow title="Auswahl „gilt für alle“" hint="Zusätzliche Schaltfläche, wenn eine Leistung mehrere oder alle betrifft."><div className="space-y-2"><JaNein value={prof.ort2Ueb} onChange={(v) => onProfil({ ort2Ueb: v })} />{prof.ort2Ueb && <input className={CELL_INPUT} value={prof.ort2UebLabel} onChange={(e) => onProfil({ ort2UebLabel: e.target.value })} placeholder="Beide Richtungen" />}</div></ProfRow>
        </>}
        <ProfRow title="Freies Feld für die genaue Lage" hint="Zum Beispiel Station (km von – bis), Achse oder Raum. Freier Text, immer freiwillig."><div className="space-y-2"><JaNein value={prof.stationAktiv} onChange={(v) => onProfil({ stationAktiv: v })} />{prof.stationAktiv && <input className={CELL_INPUT} value={prof.station} onChange={(e) => onProfil({ station: e.target.value })} placeholder="Station (km von – bis)" />}</div></ProfRow>
        <ProfRow title="Bezeichnung des Leistungsschlüssels" hint="Zum Beispiel BAS, Kostenstelle, LV-Position."><input className={CELL_INPUT} value={prof.schluessel} onChange={(e) => onProfil({ schluessel: e.target.value })} placeholder="BAS" /></ProfRow>
      </section>

      <section className="min-w-0 border-l-4 border-[#FAD200] bg-[#DAE1F0] p-4">
        <h2 className="text-sm font-bold text-[#0F1E46]">So sieht es beim Erfassen einer Leistung aus</h2>
        <div className="mt-2 space-y-2 text-sm text-[#0F1E46]">
          <p><span className="font-bold">{prof.ort1 || "Ort"}:</span> Auswahl aus der Liste</p>
          {prof.ort2Aktiv && <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{prof.ort2}:</span>{opts.map((o) => <span key={o} className="rounded-sm border border-[#0F1E46] bg-white px-2 py-1 text-xs font-semibold">{o}</span>)}{prof.ort2Ueb && <span className="rounded-sm border border-[#0F1E46] bg-white px-2 py-1 text-xs font-semibold">{prof.ort2UebLabel}</span>}{opts.length === 0 && !prof.ort2Ueb && <span className="text-xs text-[#C62828]">Noch keine Auswahlmöglichkeit eingetragen.</span>}</div>}
          {prof.stationAktiv && <p><span className="font-bold">{prof.station}:</span> freier Text</p>}
          <p><span className="font-bold">{prof.schluessel || "Schlüssel"}:</span> Auswahl aus der Liste</p>
        </div>
      </section>
    </div>
  );
}

/* Tab "Pflichtfelder": alle Einstellungen in einer Tabelle */
const PFLICHT_ROWS = [
  ["sektion", "Sektion", "Ort der Leistung (erste Ebene)"],
  ["vorhaben", "Vorhaben", "Ort der Leistung (zweite Ebene)"],
  ["taetigkeit", "Tätigkeit", "Art der ausgeführten Arbeit"],
  ["bas", "BAS", "Leistungs-/Kostenschlüssel"],
  ["beschreibung", "Beschreibung", "Freitext: was wurde konkret ausgeführt"],
  ["menge", "Menge und Einheit", "Menge größer 0 mit Einheit"],
  ["personal", "Personal", "Mindestens eine Person mit Rolle, Anzahl und Stunden"],
  ["geraete", "Geräte", "Mindestens ein Gerät mit Anzahl und Betriebsstunden"],
];
function PflichtTable({ pf, onChange, prof }) {
  const lab = { sektion: prof.ort1, vorhaben: prof.ort2, bas: prof.schluessel };
  return (
    <div>
      <p className="mb-3 text-sm text-[#0F1E46]">Hier legst du fest, welche Angaben beim Erfassen einer Leistung Pflicht sind.</p>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead><tr className="bg-[#0F1E46] text-white">
          <th className={`${TH_CLS} w-[34%] sm:w-[22%]`}>Feld</th><th className={`${TH_CLS} hidden sm:table-cell`}>Bedeutung</th><th className={`${TH_CLS} w-[66%] sm:w-[280px]`}>Pflicht / Freiwillig</th>
        </tr></thead>
        <tbody>
          {PFLICHT_ROWS.filter(([k]) => k !== "vorhaben" || prof.ort2Aktiv).map(([k, l0, was]) => { const label = lab[k] || l0; return (
            <tr key={k} data-pflicht={k} className="border-b border-[#C8D2E6] align-middle">
              <td className="px-2 py-2 font-semibold text-[#0F1E46]">{label}<span className="mt-0.5 block text-xs font-normal text-[#0F1E46]/70 sm:hidden">{was}</span></td>
              <td className="hidden px-2 py-2 text-[#0F1E46]/70 sm:table-cell">{was}</td>
              <td className="px-2 py-2"><PflichtToggle value={pf[k]} onChange={(v) => onChange({ ...pf, [k]: v })} /></td>
            </tr>
          ); })}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [lists, setLists] = useState(defaultLists());
  const [day, setDay] = useState(emptyDay());
  const [positions, setPositions] = useState([]);
  const [archive, setArchive] = useState([]);
  const [view, setView] = useState("home"); // home | wizard (Leistung bearbeiten) | preview | archive | settings
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [basModal, setBasModal] = useState(null); // BAS-Code für Info-Fenster
  const [session, setSession] = useState(null); // {token, email} – nur Admins
  const [listsErr, setListsErr] = useState(""); // Hinweis bei Speicher-/Ladeproblemen
  const [fotoData, setFotoData] = useState({}); // id -> Bild (Data-URL), getrennt vom Bericht gespeichert
  const [localEdit, setLocalEdit] = useState(false); // Listen ohne Anmeldung, nur auf diesem Gerät
  const [listsTab, setListsTab] = useState("projekt");
  const [listsMsg, setListsMsg] = useState("");
  const [sendMsg, setSendMsg] = useState(""); // Hinweis nach „Senden“
  const [copyOpen, setCopyOpen] = useState(false); // Dialog: Leistungen aus früherem Tag übernehmen

  useEffect(() => {
    (async () => {
      let localOnly = false; // Listen nur auf diesem Gerät: gemeinsame Listen nicht darüberladen
      try {
        if (typeof window !== "undefined" && window.storage) {
          const r = await window.storage.get("btb_v2");
          if (r?.value) { const d = JSON.parse(r.value); setDay(d.day || emptyDay()); setPositions(d.positions || []); setArchive(d.archive || []); }
          const s = await window.storage.get("btb_session");
          if (s?.value) setSession(JSON.parse(s.value));
          const l = await window.storage.get("btb_lists_v2");
          if (l?.value) setLists({ ...defaultLists(), ...JSON.parse(l.value) }); // lokaler Cache zuerst
          const lf = await window.storage.get("btb_lists_local");
          if (lf?.value) { localOnly = true; setLocalEdit(true); }
        }
      } catch (e) {}
      if (SB_ON && !localOnly) {
        try { const d = await sbLoadLists(); if (d) setLists({ ...defaultLists(), ...d }); } // gemeinsame Listen
        catch (e) { /* offline/blockiert -> lokaler Cache bleibt */ }
      }
    })();
  }, []);
  const persist = async (next) => {
    try { if (typeof window !== "undefined" && window.storage) await window.storage.set("btb_v2", JSON.stringify({ day, positions, archive, ...next })); } catch (e) {}
  };
  const persistLists = async (l) => {
    try { if (typeof window !== "undefined" && window.storage) await window.storage.set("btb_lists_v2", JSON.stringify(l)); } catch (e) {}
  };
  const persistSession = async (s) => {
    try { if (typeof window !== "undefined" && window.storage) { if (s) await window.storage.set("btb_session", JSON.stringify(s)); else await window.storage.delete("btb_session"); } } catch (e) {}
  };
  const setListKey = (key, value) => setLists((l) => {
    const n = { ...l, [key]: value };
    persistLists(n); // lokaler Cache
    if (SB_ON && session) {
      setListsErr("");
      clearTimeout(_listsSaveTimer);
      _listsSaveTimer = setTimeout(() => {
        sbSaveLists(n, session.token).catch((e) => setListsErr("Speichern fehlgeschlagen – evtl. neu anmelden. (" + e.message + ")"));
      }, 800);
    }
    return n;
  });
  const resetLists = () => { const n = defaultLists(); setLists(n); persistLists(n); if (SB_ON && session) sbSaveLists(n, session.token).catch((e) => setListsErr(e.message)); };
  const doLogout = () => { setSession(null); persistSession(null); };

  /* --- Listen komplett setzen (Excel-Import, Zurücksetzen) --- */
  const applyLists = (n) => { setLists(n); persistLists(n); if (SB_ON && session) sbSaveLists(n, session.token).catch((e) => setListsErr(e.message)); };
  const enableLocalEdit = async () => { setLocalEdit(true); try { if (window.storage) await window.storage.set("btb_lists_local", "1"); } catch (e) {} };
  const disableLocalEdit = async () => {
    setLocalEdit(false); try { if (window.storage) await window.storage.delete("btb_lists_local"); } catch (e) {}
    if (SB_ON) { try { const d = await sbLoadLists(); const n = { ...defaultLists(), ...(d || {}) }; setLists(n); persistLists(n); } catch (e) { setListsErr("Gemeinsame Listen konnten nicht geladen werden."); } }
  };
  const exportLists = () => {
    const wb = listsToWorkbook(lists);
    try { XLSX.writeFile(wb, "Bautagesbericht_Projektprofil.xlsx"); }
    catch (e) { downloadBlob(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }), "Bautagesbericht_Projektprofil.xlsx"); }
  };
  const importLists = async (file) => {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const { lists: n, found } = workbookToLists(wb, lists);
      if (found.length === 0) { setListsMsg("In der Datei wurde kein passendes Tabellenblatt gefunden."); return; }
      applyLists(n); setListsMsg("Übernommen: " + found.join(", "));
    } catch (e) { setListsMsg("Datei konnte nicht gelesen werden."); }
  };

  /* --- Nachunternehmer --- */
  const nuNames = useMemo(() => [...new Set([...(lists.nachunternehmer || []), ...positions.map((p) => p.nachunternehmer)].map((x) => (x || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [lists.nachunternehmer, positions]);
  const rememberNu = (name) => { const n = (name || "").trim(); if (n && !(lists.nachunternehmer || []).some((x) => x.trim() === n)) setListKey("nachunternehmer", [...(lists.nachunternehmer || []).filter((x) => x.trim()), n]); };
  const setPositionNu = (id, name) => { const list = positions.map((p) => p.id === id ? { ...p, nachunternehmer: name } : p); setPositions(list); persist({ positions: list }); rememberNu(name); };

  /* --- Fotos --- */
  useEffect(() => {
    const want = [...(day.fotos || []), ...((previewData && previewData.day && previewData.day.fotos) || [])].filter((f) => !(f.id in fotoData));
    if (want.length === 0 || typeof window === "undefined" || !window.storage) return;
    (async () => {
      const add = {};
      for (const f of want) { try { const r = await window.storage.get("btb_foto_" + f.id); add[f.id] = (r && r.value) || ""; } catch (e) { add[f.id] = ""; } }
      setFotoData((d) => ({ ...d, ...add }));
    })();
  }, [day.fotos, previewData]);
  const addFotos = async (files, stillId) => {
    const neu = []; const data = {};
    for (const file of Array.from(files || [])) {
      try { const url = await fileToJpeg(file); const id = uid(); data[id] = url; neu.push({ id, name: file.name, text: "", ...(stillId ? { stillId } : {}) }); try { if (window.storage) await window.storage.set("btb_foto_" + id, url); } catch (e) {} } catch (e) {}
    }
    if (neu.length === 0) return;
    setFotoData((d) => ({ ...d, ...data }));
    const n = { ...day, fotos: [...(day.fotos || []), ...neu] }; setDay(n); persist({ day: n });
  };
  const delFoto = async (id) => { delDayRow("fotos", id); try { if (window.storage) await window.storage.delete("btb_foto_" + id); } catch (e) {} };
  const stillValid = (d) => (d.stillstand || []).filter((x) => x.start || x.ende || x.grund || x.sektion);
  const fotosOf = (d) => (d.fotos || []).map((f) => ({ ...f, data: fotoData[f.id], still: f.stillId ? stillValid(d).findIndex((x) => x.id === f.stillId) + 1 : 0 })).filter((f) => f.data);
  const delStill = (id) => {
    (day.fotos || []).filter((f) => f.stillId === id).forEach((f) => { try { if (window.storage) window.storage.delete("btb_foto_" + f.id); } catch (e) {} });
    const n = { ...day, stillstand: (day.stillstand || []).filter((x) => x.id !== id), fotos: (day.fotos || []).filter((f) => f.stillId !== id) }; setDay(n); persist({ day: n });
  };
  const copyFrom = (rec) => {
    const neu = rec.positions.map((p) => ({ ...emptyDraft(), ...structuredClone(p), id: uid(), pruefen: true, personal: p.personal.map((x) => ({ ...x, id: uid() })), geraete: p.geraete.map((x) => ({ ...x, id: uid() })) }));
    const list = [...positions, ...neu]; setPositions(list); persist({ positions: list }); setCopyOpen(false);
  };
  const confirmPosition = (id) => { const list = positions.map((p) => p.id === id ? { ...p, pruefen: false } : p); setPositions(list); persist({ positions: list }); };
  const updStillSub = (sid, key, rows) => updDayRow("stillstand", sid, { [key]: rows });


  // Abgeleitete Optionen / Lookups aus den (editierbaren) Listen
  const sektOpts = useMemo(() => lists.sektionen.filter(Boolean).map((s) => ({ value: s, label: s })), [lists.sektionen]);
  const taetOpts = useMemo(() => lists.taetigkeiten.filter(Boolean).map((s) => ({ value: s, label: s })), [lists.taetigkeiten]);
  const rollenOpts = useMemo(() => lists.rollen.filter(Boolean).map((s) => ({ value: s, label: s })), [lists.rollen]);
  const basOpts = useMemo(() => lists.bas.filter((b) => b.code).map((b) => ({ value: b.code, code: b.code, labelShort: b.name, label: `${b.code} – ${b.name}`, group: b.group, sub: (b.desc || "").slice(0, 95) })), [lists.bas]);
  const geraeteTypOpts = useMemo(() => lists.geraete.filter((g) => g.typ).map((g) => ({ value: g.typ, label: g.typ })), [lists.geraete]);
  const unitsOf = (typ) => lists.geraete.find((g) => g.typ === typ)?.units.filter(Boolean) || [];
  const basName = (code) => lists.bas.find((b) => b.code === code)?.name || code || "";
  const basMeta = (code) => { const b = lists.bas.find((x) => x.code === code); const lvm = BAS_LV[code]; return { name: b?.name || code, lv: lvm?.lv, me: lvm?.me, desc: b?.desc || "", wann: b?.wann || "" }; };

  /* --- Wizard --- */
  const startNew = () => { setDraft(emptyDraft()); setEditingId(null); setView("wizard"); };
  const startEdit = (p) => { setDraft({ ...emptyDraft(), ...structuredClone(p) }); setEditingId(p.id); setView("wizard"); };
  const setD = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const updRow = (key, id, patch) => setDraft((d) => ({ ...d, [key]: d[key].map((x) => x.id === id ? { ...x, ...patch } : x) }));
  const addRow = (key, blank) => setDraft((d) => ({ ...d, [key]: [...d[key], { id: uid(), ...blank }] }));
  const delRow = (key, id) => setDraft((d) => ({ ...d, [key]: d[key].length > 1 ? d[key].filter((x) => x.id !== id) : d[key] }));
  const copyLast = (key) => { const last = positions[0]; if (last && last[key]?.length) setDraft((d) => ({ ...d, [key]: last[key].map((x) => ({ ...x, id: uid() })) })); };
  const applyBasInfo = () => { const m = basMeta(draft.bas); setDraft((d) => ({ ...d, beschreibung: d.beschreibung || m.lv || m.desc || "", einheit: d.einheit || m.me || "" })); };
  // Pflichtfelder je Schritt (einstellbar)
  const pf = { ...DEF_PFLICHT, ...(lists.pflicht || {}) };
  const prof = { ...DEF_PROFIL, ...(lists.profil || {}) }; _prof = prof; // Projektprofil (Bezeichnungen, Auswahl)
  const ort2Opts = [...(prof.ort2Optionen || []).filter((x) => x && x.trim()), ...(prof.ort2Ueb ? [prof.ort2UebLabel] : [])];
  const setProfil = (patch) => {
    setListKey("profil", { ...prof, ...patch });
    if ("projekt" in patch) { const d = { ...day, projekt: patch.projekt }; setDay(d); persist({ day: d }); }
  };
  const applyTyp = (t, mitBeispiel) => {
    const { key, name, was, beispiel, ...rest } = t;
    const n = { ...lists, profil: { ...prof, ...rest, typ: key, ort2Optionen: [...rest.ort2Optionen] } };
    if (mitBeispiel) n.sektionen = [...beispiel];
    applyLists(n); setListsMsg(`Projekttyp „${name}“ übernommen.`);
  };
  const persComplete = draft.personal.filter((p) => p.rolle && num(p.anzahl) > 0 && num(p.stunden) > 0);
  const persIncomplete = draft.personal.some((p) => (p.rolle || p.anzahl || p.stunden) && !(p.rolle && num(p.anzahl) > 0 && num(p.stunden) > 0));
  const gerIncomplete = draft.geraete.some((g) => g.typ && !(num(g.anzahl) > 0 && num(g.stunden) > 0 && (unitsOf(g.typ).length === 0 || g.geraet)));
  const gerComplete = draft.geraete.filter((g) => g.typ && num(g.anzahl) > 0 && num(g.stunden) > 0 && (unitsOf(g.typ).length === 0 || g.geraet));
  const descOk = !!(draft.beschreibung && draft.beschreibung.trim());
  const mengeOk = num(draft.menge) > 0;
  const missA = [
    pf.sektion && !draft.sektion && prof.ort1,
    pf.vorhaben && prof.ort2Aktiv && !(draft.vorhaben || draft.vorhabenUeb === "Ja") && prof.ort2,
    pf.taetigkeit && !draft.taetigkeit && "Tätigkeit",
    pf.bas && !draft.bas && prof.schluessel,
  ].filter(Boolean);
  const missB = [
    pf.beschreibung && !descOk && "Beschreibung",
    pf.menge && !mengeOk && "Menge (> 0)",
    (pf.menge || mengeOk) && !draft.einheit && "Einheit",
  ].filter(Boolean);
  const stepValid = [
    !!((!pf.sektion || draft.sektion) && (!pf.taetigkeit || draft.taetigkeit) && (!pf.bas || draft.bas) && (!pf.vorhaben || !prof.ort2Aktiv || draft.vorhaben || draft.vorhabenUeb === "Ja")),
    !!((!pf.beschreibung || descOk) && (!pf.menge || (mengeOk && draft.einheit)) && (!mengeOk || draft.einheit)),
    !!((!pf.personal || persComplete.length >= 1) && !persIncomplete),
    !!((!pf.geraete || gerComplete.length >= 1) && !gerIncomplete),
  ];
  const allValid = stepValid.every(Boolean);

  const savePosition = () => {
    const exists = positions.some((p) => p.id === draft.id);
    const done = { ...draft, pruefen: false }; // gespeichert = geprüft
    const list = exists ? positions.map((p) => p.id === draft.id ? done : p) : [done, ...positions];
    setPositions(list); persist({ positions: list }); setView("home");
  };
  const deletePosition = (id) => { const list = positions.filter((p) => p.id !== id); setPositions(list); persist({ positions: list }); };
  // Tagesweite Listen (Stillstand, Vorkommnisse) – direkt im day-Objekt, sofort gespeichert
  const addDayRow = (key, blank) => { const n = { ...day, [key]: [...(day[key] || []), { id: uid(), ...blank }] }; setDay(n); persist({ day: n }); };
  const updDayRow = (key, id, patch) => { const n = { ...day, [key]: (day[key] || []).map((x) => x.id === id ? { ...x, ...patch } : x) }; setDay(n); persist({ day: n }); };
  const delDayRow = (key, id) => { const n = { ...day, [key]: (day[key] || []).filter((x) => x.id !== id) }; setDay(n); persist({ day: n }); };
  const hasContent = positions.length > 0 || (day.stillstand || []).length > 0 || (day.vorkommnisse || []).length > 0 || (day.fotos || []).length > 0;
  const closeDay = () => {
    if (!hasContent || positions.some((p) => p.pruefen)) return;
    const arch = [{ id: uid(), day: { ...day }, positions, savedAt: new Date().toISOString() }, ...archive];
    const nd = emptyDay(prof.projekt); setArchive(arch); setPositions([]); setDay(nd); persist({ archive: arch, positions: [], day: nd });
  };
  const loadArchived = (rec) => { setDay({ ...rec.day }); setPositions(rec.positions); setView("home"); };
  const deleteArchived = (id) => {
    const rec = archive.find((a) => a.id === id);
    ((rec && rec.day && rec.day.fotos) || []).forEach((f) => { try { if (window.storage) window.storage.delete("btb_foto_" + f.id); } catch (e) {} });
    const arch = archive.filter((a) => a.id !== id); setArchive(arch); persist({ archive: arch });
  };

  const totals = useMemo(() => {
    let ph = 0, gh = 0; const map = new Map();
    positions.forEach((p) => {
      ph += phOf(p); gh += ghOf(p);
      if (p.bas && num(p.menge)) {
        const k = `${p.bas}|${p.einheit || "-"}`;
        const prev = map.get(k) || { bas: p.bas, einheit: p.einheit || "-", menge: 0 };
        prev.menge += num(p.menge); map.set(k, prev);
      }
    });
    return { ph, gh, mengen: [...map.values()].sort((a, b) => String(a.bas).localeCompare(String(b.bas))) };
  }, [positions]);

  /* ============ EINSTELLUNGEN / LISTEN ============ */
  if (view === "settings") {
    const needLogin = SB_ON && !session && !localEdit;
    const TABS = [["projekt", "Projekt"], ["pflicht", "Pflichtfelder"], ["sektionen", prof.ort1 === "Sektion" ? "Sektionen" : (prof.ort1 || "Ort")], ["taetigkeiten", "Tätigkeiten"], ["rollen", "Rollen"], ["nachunternehmer", "Nachunternehmer"], ["geraete", "Geräte"], ["bas", prof.schluessel || "BAS"]];
    return (
      <Shell>
        <TopBar title="Einstellungen" subtitle={session ? `Admin: ${session.email}` : localEdit ? "Listen nur auf diesem Gerät" : SB_ON ? "Anmeldung für gemeinsame Listen" : "Lokaler Modus"}
          left={<button onClick={() => setView("home")} className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-white hover:bg-white/20" aria-label="Zurück"><ChevronLeft size={18} /></button>}
          right={session ? <button onClick={doLogout} className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"><LogOut size={15} /> <span className="hidden sm:inline">Abmelden</span></button> : null} />
        <main className={`mx-auto ${!needLogin && listsTab === "bas" ? "max-w-6xl" : "max-w-4xl"} space-y-4 px-3 py-4 sm:px-4 sm:py-6`}>
          {needLogin ? (
            <div className="min-w-0 space-y-4">
              <LoginCard onSubmit={async (email, pw) => { const s = await sbLogin(email, pw); setSession(s); persistSession(s); }} />
              <div className="mx-auto max-w-sm border-l-4 border-[#FAD200] bg-[#DAE1F0] p-4">
                <p className="text-sm text-[#0F1E46]">Ohne Anmeldung kannst du die Listen trotzdem ändern. Die Änderungen gelten dann <span className="font-bold">nur auf diesem Gerät</span> und werden nicht mit anderen geteilt.</p>
                <button onClick={enableLocalEdit} className="mt-3 inline-flex items-center gap-2 rounded-sm border border-[#0F1E46] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F1E46] hover:bg-[#DAE1F0]"><Pencil size={15} /> Ohne Anmeldung bearbeiten</button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3 text-sm text-[#0F1E46]">
                {session ? <span className="text-[#2E7D32]"><ShieldCheck size={14} className="mr-1 inline" />Als Admin angemeldet – Änderungen gelten für alle Nutzer.</span>
                  : SB_ON ? <span>Änderungen gelten <span className="font-bold">nur auf diesem Gerät</span>. <button onClick={disableLocalEdit} className="font-semibold underline">Gemeinsame Listen wieder laden</button></span>
                  : <span>Lokaler Modus: Änderungen gelten nur auf diesem Gerät.</span>}
              </div>
              {listsErr && <p className="rounded-sm border border-[#C62828] bg-white px-3 py-2 text-sm text-[#C62828]">{listsErr}</p>}

              <section className="rounded-sm border border-[#C8D2E6] border-l-4 border-l-[#FAD200] bg-white p-4">
                <h2 className="text-sm font-bold text-[#0F1E46]">Projektprofil als Excel-Datei</h2>
                <p className="mt-1 text-sm text-[#0F1E46]/70">Alle Listen und Einstellungen dieses Projekts in einer Datei: herunterladen, in Excel ändern, wieder hochladen – oder für ein anderes Projekt weitergeben.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={exportLists} className="inline-flex items-center gap-2 rounded-sm border border-[#0F1E46] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F1E46] hover:bg-[#DAE1F0]"><Download size={16} /> Excel herunterladen</button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-[#0F1E46] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0F1E46]/90"><Upload size={16} /> Excel hochladen
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { importLists(e.target.files && e.target.files[0]); e.target.value = ""; }} />
                  </label>
                  <button onClick={() => { applyLists(defaultLists()); setListsMsg("Auf Standard zurückgesetzt."); }} className="inline-flex items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-semibold text-[#677BA4] hover:bg-[#DAE1F0] hover:text-[#C62828]"><RotateCcw size={15} /> Standard</button>
                </div>
                {listsMsg && <p className="mt-2 text-sm font-semibold text-[#0F1E46]">{listsMsg}</p>}
              </section>

              <div className="flex flex-wrap gap-2">
                {TABS.map(([k, l]) => (
                  <button key={k} onClick={() => setListsTab(k)} className={`min-h-[40px] rounded-sm border px-3 text-sm font-semibold transition ${listsTab === k ? "border-[#0F1E46] bg-[#DAE1F0] text-[#0F1E46]" : "border-[#C8D2E6] bg-white text-[#0F1E46]/70 hover:bg-[#DAE1F0]"}`}>{l}{k !== "pflicht" && k !== "projekt" && <> <span className="text-[#677BA4]">{k === "bas" ? lists.bas.length : k === "geraete" ? lists.geraete.length : (lists[k] || []).filter((x) => x.trim()).length}</span></>}</button>
                ))}
              </div>

              {listsTab === "projekt" && <ProjektTab prof={prof} onProfil={setProfil} onTyp={applyTyp} />}
              {listsTab === "pflicht" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><PflichtTable pf={pf} prof={prof} onChange={(v) => setListKey("pflicht", v)} /></section>}
              {listsTab === "sektionen" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><PflichtBar frage={`Muss beim Erfassen einer Leistung „${prof.ort1}“ gewählt werden?`} value={pf.sektion} onChange={(v) => setListKey("pflicht", { ...pf, sektion: v })} /><ListTable items={lists.sektionen} onChange={(v) => setListKey("sektionen", v)} placeholder="Sektion 1" /></section>}
              {listsTab === "taetigkeiten" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><PflichtBar frage="Muss beim Erfassen einer Leistung eine Tätigkeit gewählt werden?" value={pf.taetigkeit} onChange={(v) => setListKey("pflicht", { ...pf, taetigkeit: v })} /><ListTable items={lists.taetigkeiten} onChange={(v) => setListKey("taetigkeiten", v)} placeholder="Unterboden ausheben" /></section>}
              {listsTab === "rollen" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><PflichtBar frage="Muss jede Leistung mindestens eine Person enthalten?" value={pf.personal} onChange={(v) => setListKey("pflicht", { ...pf, personal: v })} /><ListTable items={lists.rollen} onChange={(v) => setListKey("rollen", v)} placeholder="Polier" /></section>}
              {listsTab === "nachunternehmer" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><div className="mb-4 border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3 text-sm text-[#0F1E46]">Ohne Auswahl gilt die Leistung als Eigenleistung.</div><ListTable items={lists.nachunternehmer || []} onChange={(v) => setListKey("nachunternehmer", v)} placeholder="Name der Firma" /></section>}
              {listsTab === "geraete" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><PflichtBar frage="Muss jede Leistung mindestens ein Gerät enthalten?" value={pf.geraete} onChange={(v) => setListKey("pflicht", { ...pf, geraete: v })} /><GeraeteTable geraete={lists.geraete} onChange={(v) => setListKey("geraete", v)} /></section>}
              {listsTab === "bas" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><PflichtBar frage={`Muss beim Erfassen einer Leistung „${prof.schluessel}“ gewählt werden?`} value={pf.bas} onChange={(v) => setListKey("pflicht", { ...pf, bas: v })} /><BasTable bas={lists.bas} onChange={(v) => setListKey("bas", v)} /></section>}
            </>
          )}
        </main>
      </Shell>
    );
  }

  /* ============ LEISTUNG ERFASSEN / BEARBEITEN (eine breite Seite) ============ */
  if (view === "wizard") {
    const H = ({ children }) => (<h2 className="px-1 text-sm font-bold uppercase tracking-wider text-[#0F1E46]">{children}</h2>);
    return (
      <Shell>
        <TopBar title={editingId ? "Leistung bearbeiten" : "Neue Leistung"} subtitle={dateDE(day.datum)}
          left={<button onClick={() => setView("home")} className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-white hover:bg-white/20" aria-label="Abbrechen"><X size={18} /></button>} />
        <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <H>Leistung</H>
            <div className="space-y-4 rounded-sm border border-[#C8D2E6] bg-white p-4 sm:p-5">
              <Field label={(prof.ort1 || "Ort") + (pf.sektion ? " *" : "")}><Combo value={draft.sektion} onChange={(v) => setD("sektion", v)} options={sektOpts} /></Field>
              {(() => { const si = sektInfo(draft.sektion); return si ? (
                <div className="border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3 text-sm">
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span className="text-[#0F1E46]/70">km <b className="text-[#0F1E46]">{si.kmVon} – {si.kmBis}</b></span>
                    <span className="text-[#0F1E46]/70">Segment <b className="text-[#0F1E46]">{si.segment}</b></span>
                    <span className="text-[#0F1E46]/70">Bauabschnitt <b className="text-[#0F1E46]">{si.ba}</b></span>
                  </div>
                  {si.bauwerke.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#677BA4]">Bauwerke:</span>
                      {si.bauwerke.map((b, i) => <span key={i} className="rounded-sm border border-[#C8D2E6] bg-white px-1.5 py-0.5 text-xs text-[#0F1E46]">{b}</span>)}
                    </div>
                  )}
                </div>
              ) : null; })()}
              {prof.ort2Aktiv && (
                <div>
                  <Label>{prof.ort2 + (pf.vorhaben ? " *" : "")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {(prof.ort2Optionen || []).filter((x) => x && x.trim()).map((o) => (
                      <button key={o} onClick={() => setDraft((d) => ({ ...d, vorhaben: o, vorhabenUeb: "Nein" }))} className={`min-h-[46px] min-w-[96px] flex-1 rounded-sm border px-3 text-sm font-semibold transition ${draft.vorhabenUeb !== "Ja" && draft.vorhaben === o ? "border-[#0F1E46] bg-[#DAE1F0] text-[#0F1E46]" : "border-[#C8D2E6] bg-white text-[#0F1E46]/70 hover:bg-[#DAE1F0]"}`}>{o}</button>
                    ))}
                    {prof.ort2Ueb && <button onClick={() => setDraft((d) => ({ ...d, vorhaben: "", vorhabenUeb: "Ja" }))} className={`min-h-[46px] min-w-[96px] flex-1 rounded-sm border px-3 text-sm font-semibold transition ${draft.vorhabenUeb === "Ja" ? "border-[#0F1E46] bg-[#DAE1F0] text-[#0F1E46]" : "border-[#C8D2E6] bg-white text-[#0F1E46]/70 hover:bg-[#DAE1F0]"}`}>{prof.ort2UebLabel}</button>}
                  </div>
                  {draft.vorhaben && draft.vorhabenUeb !== "Ja" && !(prof.ort2Optionen || []).includes(draft.vorhaben) && <p className="mt-1 text-xs text-[#0F1E46]/70">Bisher gewählt: {draft.vorhaben}</p>}
                </div>
              )}
              {prof.stationAktiv && <Field label={prof.station} hint="(freiwillig)"><input className={inputCls} value={draft.station || ""} onChange={(e) => setD("station", e.target.value)} placeholder="z. B. 12+350 – 12+480" /></Field>}
              <Field label={"Tätigkeit" + (pf.taetigkeit ? " *" : "")}><Combo value={draft.taetigkeit} onChange={(v) => setD("taetigkeit", v)} options={taetOpts} /></Field>
              <Field label="Ausführung durch"><NuSelect value={draft.nachunternehmer || ""} names={nuNames} onChange={(v) => { setD("nachunternehmer", v); rememberNu(v); }} /></Field>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label hint="(Leistungs-/Kostenschlüssel)">{(prof.schluessel || "BAS") + (pf.bas ? " *" : "")}</Label>
                  {draft.bas && <button onClick={() => setBasModal(draft.bas)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F1E46] underline"><Info size={13} /> Was ist enthalten?</button>}
                </div>
                <Combo value={draft.bas} onChange={(v) => setD("bas", v)} options={basOpts} />
              </div>
              {draft.bas && (() => { const m = basMeta(draft.bas); return (m.lv || m.desc || m.wann) ? (
                <div className="border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3">
                  <div className="flex items-start gap-2">
                    <Info size={15} className="mt-0.5 shrink-0 text-[#0F1E46]" />
                    <div className="min-w-0 flex-1">
                      {m.lv && <p className="text-sm"><span className="font-semibold text-[#0F1E46]">LV-Leistung: </span><span className="text-[#0F1E46]">{m.lv}</span>{m.me && <span className="ml-1.5 rounded-sm border border-[#C8D2E6] bg-white px-1.5 py-0.5 text-xs tabular-nums text-[#0F1E46]">{m.me}</span>}</p>}
                      {m.desc && <p className="text-sm text-[#0F1E46]"><span className="font-semibold text-[#0F1E46]">Was steckt drin: </span>{m.desc}</p>}
                      {m.wann && <p className="mt-1 text-sm text-[#0F1E46]/70"><span className="font-semibold text-[#0F1E46]">Wann wählen: </span>{m.wann}</p>}
                      <button onClick={applyBasInfo} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#0F1E46] underline"><Wand2 size={12} /> Beschreibung & Einheit übernehmen</button>
                    </div>
                  </div>
                </div>
              ) : null; })()}
              {missA.length > 0 && <p className="text-xs text-[#C62828]">Bitte auswählen: {missA.join(", ")}.</p>}
            </div>
              <H>Ausführung</H>
            <div className="space-y-4 rounded-sm border border-[#C8D2E6] bg-white p-4 sm:p-5">
              <Field label={"Beschreibung (Detail)" + (pf.beschreibung ? " *" : "")}>
                <textarea rows={4} className={`${inputCls} min-h-[110px] py-2`} value={draft.beschreibung} onChange={(e) => setD("beschreibung", e.target.value)} placeholder="Was wurde konkret ausgeführt? Ort, Abschnitt, Besonderheiten, Behinderungen …" />
              </Field>
              <div className="grid max-w-sm grid-cols-2 gap-3">
                <Field label={"Menge" + (pf.menge ? " *" : "")}><input type="number" inputMode="decimal" className={inputCls} value={draft.menge} onChange={(e) => setD("menge", e.target.value)} placeholder="0" /></Field>
                <Field label={"Einheit" + (pf.menge || mengeOk ? " *" : "")}><Combo value={draft.einheit} onChange={(v) => setD("einheit", v)} options={EINHEITEN.map((u) => ({ value: u, label: u }))} placeholder="–" /></Field>
              </div>
              {missB.length > 0 && <p className="text-xs text-[#C62828]">Bitte ausfüllen: {missB.join(", ")}.</p>}
            </div>
            </div>
            <div className="space-y-3">
              <H>{"Personal" + (pf.personal ? " *" : "")}</H>
            <div className="rounded-sm border border-[#C8D2E6] bg-white p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-[#0F1E46]/70">Wer hat an dieser Leistung gearbeitet?</p>
                {positions[0]?.personal?.some((x) => x.rolle) && <button onClick={() => copyLast("personal")} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F1E46] underline"><Copy size={13} /> Letzte übernehmen</button>}
              </div>
              <div className="space-y-3">
                {draft.personal.map((p, i) => (
                  <RowShell key={p.id} index={i} onRemove={() => delRow("personal", p.id)}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Rolle / Fachkraft"><Combo value={p.rolle} onChange={(v) => updRow("personal", p.id, { rolle: v })} options={rollenOpts} /></Field>
                      <Field label="Anzahl Personen"><input type="number" inputMode="numeric" className={inputCls} value={p.anzahl} onChange={(e) => updRow("personal", p.id, { anzahl: e.target.value })} placeholder="1" /></Field>
                      <Field label="Stunden / Person"><input type="number" inputMode="decimal" className={inputCls} value={p.stunden} onChange={(e) => updRow("personal", p.id, { stunden: e.target.value })} placeholder="0" /></Field>
                    </div>
                    <div className="mt-3"><Field label="Namen" hint="(optional)"><input className={inputCls} value={p.name || ""} onChange={(e) => updRow("personal", p.id, { name: e.target.value })} placeholder="z. B. Müller, Popescu" /></Field></div>
                    {num(p.anzahl) > 0 && num(p.stunden) > 0 && <p className="mt-2 text-right text-xs text-[#0F1E46]/70">= <span className="tabular-nums font-semibold text-[#0F1E46]">{fmt(num(p.anzahl) * num(p.stunden))}</span> Pers.-Std.</p>}
                  </RowShell>
                ))}
              </div>
              <AddBtn onClick={() => addRow("personal", { rolle: "", anzahl: "", stunden: "" })}>Rolle hinzufügen</AddBtn>
              {(persIncomplete || (pf.personal && persComplete.length < 1)) && <p className="mt-2 text-xs text-[#C62828]">{persIncomplete ? "Angefangene Personal-Zeile: Rolle, Anzahl (> 0) und Stunden (> 0) ausfüllen oder Zeile entfernen." : "Mindestens eine Person mit Rolle, Anzahl (> 0) und Stunden (> 0) erfassen."}</p>}
            </div>
              <H>{"Geräte" + (pf.geraete ? " *" : "")}</H>
            <div className="rounded-sm border border-[#C8D2E6] bg-white p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-[#0F1E46]/70">Welche Geräte waren im Einsatz?</p>
                {positions[0]?.geraete?.some((x) => x.typ) && <button onClick={() => copyLast("geraete")} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F1E46] underline"><Copy size={13} /> Letzte übernehmen</button>}
              </div>
              <div className="space-y-3">
                {draft.geraete.map((g, i) => {
                  const units = unitsOf(g.typ);
                  return (
                    <RowShell key={g.id} index={i} onRemove={() => delRow("geraete", g.id)}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Gerätetyp"><Combo value={g.typ} onChange={(v) => updRow("geraete", g.id, { typ: v, geraet: "" })} options={geraeteTypOpts} /></Field>
                        <Field label="Gerät (genau)" hint={g.typ && units.length === 0 ? "(in Listen ergänzen)" : ""}>
                          <Combo value={g.geraet} onChange={(v) => updRow("geraete", g.id, { geraet: v })} options={units.map((u) => ({ value: u, label: u }))} placeholder={g.typ ? (units.length ? "– wählen –" : "keine hinterlegt") : "erst Typ wählen"} />
                        </Field>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xs">
                        <Field label="Anzahl"><input type="number" inputMode="numeric" className={inputCls} value={g.anzahl} onChange={(e) => updRow("geraete", g.id, { anzahl: e.target.value })} placeholder="1" /></Field>
                        <Field label="Betriebsstunden"><input type="number" inputMode="decimal" className={inputCls} value={g.stunden} onChange={(e) => updRow("geraete", g.id, { stunden: e.target.value })} placeholder="0" /></Field>
                      </div>
                    </RowShell>
                  );
                })}
              </div>
              <AddBtn onClick={() => addRow("geraete", { typ: "", geraet: "", anzahl: "1", stunden: "" })}>Gerät hinzufügen</AddBtn>
              {(gerIncomplete || (pf.geraete && gerComplete.length < 1)) && <p className="mt-2 text-xs text-[#C62828]">{gerIncomplete ? "Angefangene Geräte-Zeile: genaues Gerät (falls hinterlegt), Anzahl (> 0) und Betriebsstunden (> 0) ausfüllen oder Zeile entfernen." : "Mindestens ein Gerät mit Anzahl (> 0) und Betriebsstunden (> 0) erfassen."}</p>}
            </div>
            </div>
          </div>
        </main>
        <div className="sticky bottom-0 border-t border-[#C8D2E6] bg-white print:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:px-4">
            <button onClick={() => setView("home")} className="rounded-sm border border-[#0F1E46] bg-white px-4 py-3 text-sm font-semibold text-[#0F1E46] hover:bg-[#DAE1F0]">Abbrechen</button>
            <div className="flex-1" />
            {!allValid && <span className="hidden text-xs text-[#C62828] sm:inline">Bitte alle Pflichtfelder ausfüllen</span>}
            <button onClick={() => allValid && savePosition()} disabled={!allValid} className={`inline-flex items-center gap-2 rounded-sm px-5 py-3 text-sm font-bold transition ${allValid ? "bg-[#FAD200] text-[#0F1E46] hover:bg-[#FCE466]" : "cursor-not-allowed bg-[#B1BFD8] text-white"}`}><Save size={18} /> Position speichern</button>
          </div>
        </div>
        {basModal && <BasModal meta={basMeta(basModal)} code={basModal} onClose={() => setBasModal(null)} />}
      </Shell>
    );
  }

  /* ============ ARCHIV ============ */
  if (view === "archive") {
    return (
      <Shell>
        <TopBar title="Frühere Berichte" subtitle={`${archive.length} abgeschlossen`}
          left={<button onClick={() => setView("home")} className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={18} /></button>} />
        <main className="mx-auto max-w-3xl space-y-2 px-3 py-4 sm:px-4 sm:py-6">
          {archive.length === 0 ? (
            <div className="rounded-sm border border-[#C8D2E6] bg-white py-12 text-center text-[#0F1E46]/70"><Archive className="mx-auto mb-3 text-[#677BA4]" size={40} /><p>Noch keine abgeschlossenen Berichte.</p></div>
          ) : archive.map((rec) => (
            <div key={rec.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-[#C8D2E6] bg-white p-3">
              <DateBadge iso={rec.day.datum} />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{rec.day.projekt || "—"}</p><p className="text-xs text-[#0F1E46]/70">{dateDE(rec.day.datum)} · {rec.positions.length} Position(en)</p></div>
              <button onClick={() => { setPreviewData({ day: rec.day, positions: rec.positions }); setView("preview"); }} className="rounded-sm border border-[#0F1E46] p-2 text-[#0F1E46] hover:bg-[#DAE1F0] bg-white" aria-label="Vorschau"><FileText size={15} /></button>
              <button onClick={() => loadArchived(rec)} className="inline-flex items-center gap-1 rounded-sm border border-[#0F1E46] px-3 py-2 text-sm font-semibold text-[#0F1E46] hover:bg-[#DAE1F0] bg-white"><FolderOpen size={15} /> Öffnen</button>
              <button onClick={() => deleteArchived(rec.id)} className="rounded-sm p-2 text-[#677BA4] hover:bg-[#DAE1F0] hover:text-[#C62828]"><Trash2 size={16} /></button>
            </div>
          ))}
        </main>
      </Shell>
    );
  }

  /* ============ VORSCHAU / DRUCK / EXPORT ============ */
  if (view === "preview") {
    const { day: d, positions: ps } = previewData;
    const offenP = ps.filter((p) => p.pruefen).length;
    const W = WETTER.find((w) => w.key === d.wetter);
    const tot = ps.reduce((a, p) => ({ ph: a.ph + phOf(p), gh: a.gh + ghOf(p) }), { ph: 0, gh: 0 });
    return (
      <Shell>
        <div className="mx-auto max-w-3xl px-3 py-3 sm:px-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
            <button onClick={() => setView(previewData.back || "home")} className="inline-flex items-center gap-1 text-sm font-semibold text-[#0F1E46]/70 hover:text-[#0F1E46]"><ChevronLeft size={16} /> Zurück</button>
            <div className="flex-1" />
            <button onClick={() => exportExcel(d, ps, basName)} className="inline-flex items-center gap-2 rounded-sm border border-[#0F1E46] bg-white px-3 py-2 text-sm font-semibold text-[#0F1E46] hover:bg-[#DAE1F0]"><FileSpreadsheet size={16} /> Excel</button>
            <button onClick={() => exportXML(d, ps, basName)} className="inline-flex items-center gap-2 rounded-sm border border-[#0F1E46] bg-white px-3 py-2 text-sm font-semibold text-[#0F1E46] hover:bg-[#DAE1F0]"><FileCode2 size={16} /> XML</button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-sm border border-[#0F1E46] bg-white px-3 py-2 text-sm font-semibold text-[#0F1E46] hover:bg-[#DAE1F0]"><Printer size={16} /> PDF</button>
            <button onClick={async () => { if (offenP > 0) return; setSendMsg(""); const r = await shareReport(d, ps, basName, fotosOf(d)); setSendMsg(r === "eml" ? `E-Mail-Entwurf „${fileBase(d)}.eml“ wurde heruntergeladen. Datei öffnen – Outlook zeigt eine neue E-Mail mit PDF und XML im Anhang. Empfänger eintragen und senden.` : r === "download" ? "PDF und XML wurden heruntergeladen. Bitte an eine E-Mail anhängen." : ""); }} disabled={offenP > 0} className={`inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-bold ${offenP > 0 ? "cursor-not-allowed bg-[#B1BFD8] text-white" : "bg-[#FAD200] text-[#0F1E46] hover:bg-[#FCE466]"}`}><Share2 size={16} /> Senden</button>
          </div>
          {offenP > 0 && <p className="mb-3 border-l-4 border-[#C62828] bg-white py-2 pl-3 text-sm font-bold text-[#C62828] print:hidden">{offenP} übernommene Leistung(en) sind noch nicht geprüft. Senden ist erst danach möglich.</p>}
          {sendMsg && <p className="mb-3 border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3 text-sm text-[#0F1E46] print:hidden">{sendMsg}</p>}
          <div className="rounded-sm border border-[#C8D2E6] bg-white p-6 sm:p-8 print:border-0 print:p-0">
            <div className="mb-5 flex flex-col gap-2 border-b-4 border-[#FAD200] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-[11px] font-bold tracking-wide text-[#0F1E46]">HABAU INFRA</p><h1 className="text-2xl font-black tracking-tight">BAUTAGESBERICHT</h1><p className="text-sm text-[#0F1E46]/70">{d.projekt || "—"}</p></div>
              <div className="text-sm sm:text-right"><p className="font-bold">{dateDE(d.datum)}</p><p className="text-[#0F1E46]/70">{W?.label} · {d.tempMin || "–"}° / {d.tempMax || "–"}° C</p>{(d.arbeitStart || d.arbeitEnde) && <p className="text-[#0F1E46]/70">Arbeitszeit: {d.arbeitStart || "–"}–{d.arbeitEnde || "–"}</p>}{d.gewerk && <p className="text-[#0F1E46]/70">Gewerk: {d.gewerk}</p>}{d.bauleiter && <p className="text-[#0F1E46]/70">Bauleiter: {d.bauleiter}</p>}</div>
            </div>
            <div className="mb-5 flex flex-wrap gap-4 text-sm">
              <span className="text-[#0F1E46]/70">Positionen: <b className="text-[#0F1E46]">{ps.length}</b></span>
              <span className="text-[#0F1E46]/70">Personal gesamt: <b className="tabular-nums text-[#0F1E46]">{fmt(tot.ph)}</b> Std.</span>
              <span className="text-[#0F1E46]/70">Geräte gesamt: <b className="tabular-nums text-[#0F1E46]">{fmt(tot.gh)}</b> Std.</span>
            </div>
            {ps.map((p, i) => (
              <div key={p.id} className="mb-4 break-inside-avoid rounded-sm border border-[#C8D2E6] p-4">
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="rounded-sm bg-[#0F1E46] px-2 py-0.5 tabular-nums text-xs font-bold text-[#FAD200]">{p.bas || "—"}</span>
                  <b className="text-[#0F1E46]">{p.bas ? basName(p.bas) : "Ohne BAS"}</b>
                  <span className="text-sm text-[#0F1E46]/70">{[p.sektion || "—", ort2Text(p), p.station].filter(Boolean).join(" · ")} · {p.taetigkeit || "—"}{p.nachunternehmer ? ` · NU: ${p.nachunternehmer}` : ""}</span>
                  {num(p.menge) > 0 && <span className="ml-auto tabular-nums text-sm font-semibold text-[#0F1E46]">{fmt(num(p.menge))} {p.einheit || ""}</span>}
                </div>
                {p.beschreibung && <p className="mb-3 text-sm text-[#0F1E46]/70">{p.beschreibung}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <MiniTable head={["Rolle", "Anz.", "Std."]} rows={p.personal.filter((x) => x.rolle).map((x) => [x.rolle + (x.name ? ` – ${x.name}` : ""), x.anzahl, x.stunden])} foot={`${fmt(phOf(p))} Pers.-Std.`} />
                  <MiniTable head={["Gerät", "Anz.", "Std."]} rows={p.geraete.filter((x) => x.typ).map((x) => [geraetLabel(x), x.anzahl, x.stunden])} foot={`${fmt(ghOf(p))} Std.`} />
                </div>
              </div>
            ))}
            {ps.length === 0 && <p className="text-[#677BA4]">Keine Positionen erfasst.</p>}

            {(d.stillstand || []).filter((s) => s.start || s.ende || s.grund || s.sektion).length > 0 && (
              <div className="mt-6 break-inside-avoid">
                <h2 className="mb-2 border-b border-[#C8D2E6] pb-1 text-sm font-bold uppercase tracking-wider text-[#0F1E46]">Stillstandszeiten</h2>
                <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-[#0F1E46] text-left text-[11px] font-bold uppercase tracking-wider text-white">
                    <th className="px-2 py-1">Nr.</th><th className="px-2 py-1">{prof.ort1}</th><th className="px-2 py-1">{prof.ort2Aktiv ? prof.ort2 : ""}</th><th className="px-2 py-1">Start</th><th className="px-2 py-1">Ende</th>
                  </tr></thead>
                  <tbody>
                    {(d.stillstand || []).filter((s) => s.start || s.ende || s.grund || s.sektion).map((s, i) => (
                      <Fragment key={s.id}>
                        <tr className="align-top text-[#0F1E46]">
                          <td className="px-2 pt-1">{i + 1}</td><td className="whitespace-nowrap px-2 pt-1">{s.sektion || "—"}</td><td className="px-2 pt-1">{s.vorhaben || "—"}</td>
                          <td className="px-2 pt-1 tabular-nums">{s.start || "—"}</td><td className="px-2 pt-1 tabular-nums">{s.ende || "—"}</td>
                        </tr>
                        <tr className="border-b border-[#C8D2E6] text-[#0F1E46]">
                          <td></td><td colSpan={4} className="px-2 pb-1"><span className="font-bold">Begründung: </span>{s.grund || "—"}{stillPers(s) && <span className="block"><span className="font-bold">Personal: </span>{stillPers(s)}</span>}{stillGer(s) && <span className="block"><span className="font-bold">Geräte: </span>{stillGer(s)}</span>}</td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table></div>
                {(d.fotos || []).filter((f) => f.stillId).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {(d.fotos || []).filter((f) => f.stillId).map((f) => { const nr = (d.stillstand || []).filter((x) => x.start || x.ende || x.grund || x.sektion).findIndex((x) => x.id === f.stillId) + 1; return (
                      <figure key={f.id} className="break-inside-avoid">
                        {fotoData[f.id] ? <img src={fotoData[f.id]} alt={f.text || f.name} className="w-full rounded-sm border border-[#C8D2E6]" /> : <div className="flex h-28 items-center justify-center bg-[#DAE1F0] text-xs text-[#677BA4]">Foto nicht auf diesem Gerät</div>}
                        <figcaption className="mt-1 text-xs text-[#0F1E46]"><span className="font-bold">Stillstand {nr || ""}:</span> {f.text || f.name}</figcaption>
                      </figure>
                    ); })}
                  </div>
                )}
              </div>
            )}

            {(d.vorkommnisse || []).filter((v) => (v.text || "").trim()).length > 0 && (
              <div className="mt-6 break-inside-avoid">
                <h2 className="mb-2 border-b border-[#C8D2E6] pb-1 text-sm font-bold uppercase tracking-wider text-[#0F1E46]">Besondere Vorkommnisse / Besucher</h2>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-[#0F1E46]">
                  {(d.vorkommnisse || []).filter((v) => (v.text || "").trim()).map((v) => <li key={v.id}>{v.text}</li>)}
                </ol>
              </div>
            )}

            {(d.fotos || []).filter((f) => !f.stillId).length > 0 && (
              <div className="mt-6">
                <h2 className="mb-2 border-b border-[#C8D2E6] pb-1 text-sm font-bold uppercase tracking-wider text-[#0F1E46]">Fotos</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(d.fotos || []).filter((f) => !f.stillId).map((f, i) => (
                    <figure key={f.id} className="break-inside-avoid">
                      {fotoData[f.id] ? <img src={fotoData[f.id]} alt={f.text || f.name} className="w-full rounded-sm border border-[#C8D2E6]" /> : <div className="flex h-28 items-center justify-center bg-[#DAE1F0] text-xs text-[#677BA4]">Foto nicht auf diesem Gerät</div>}
                      <figcaption className="mt-1 text-xs text-[#0F1E46]">{i + 1}. {f.text || f.name}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 border-t border-[#C8D2E6] pt-3 text-center text-[10px] uppercase tracking-[0.3em] text-[#0F1E46]/70">HABAU INFRA | BAUTAGESBERICHT | © 2026</p>
          </div>
        </div>
      </Shell>
    );
  }

  /* ============ HAUPTSEITE (Übersicht, alles auf einer Seite) ============ */
  const dayH = spanH(day.arbeitStart, day.arbeitEnde);
  // Gruppieren nach Kategorie (Gerätetyp bzw. Rolle); Details = genaues Gerät bzw. Name
  const group = (rows) => {
    const g = new Map();
    rows.forEach(({ cat, det, anz, std, pid, bas }) => {
      const e = g.get(cat) || { label: cat, hours: 0, byPos: new Map(), det: new Map() };
      e.hours += anz * std; e.byPos.set(pid, (e.byPos.get(pid) || 0) + anz);
      const d = e.det.get(det) || { label: det, hours: 0, byPos: new Map(), bas: new Set() };
      d.hours += anz * std; d.byPos.set(pid, (d.byPos.get(pid) || 0) + anz); d.bas.add(bas); e.det.set(det, d);
      g.set(cat, e);
    });
    const cnt = (m) => Math.max(0, ...m.values());
    return [...g.values()].map((e) => ({ label: e.label, hours: e.hours, count: cnt(e.byPos), details: [...e.det.values()].map((d) => ({ label: d.label, hours: d.hours, count: cnt(d.byPos), wo: "BAS " + [...d.bas].join(", ") })).sort((x, y) => y.hours - x.hours) })).sort((x, y) => y.hours - x.hours);
  };
  const gerRows = group(positions.flatMap((p) => p.geraete.filter((g) => g.typ).map((g) => ({ cat: g.typ, det: g.geraet || "ohne genaue Angabe", anz: num(g.anzahl) || 1, std: num(g.stunden), pid: p.id, bas: p.bas }))));
  const persRows = group(positions.flatMap((p) => p.personal.filter((x) => x.rolle).map((x) => ({ cat: x.rolle, det: (x.name || "").trim() || "ohne Namen", anz: num(x.anzahl), std: num(x.stunden), pid: p.id, bas: p.bas }))));
  const offen = positions.filter((p) => p.pruefen).length;
  const iconBtn = "rounded-sm p-2 text-[#677BA4] hover:bg-[#DAE1F0] hover:text-[#C62828]";
  return (
    <Shell>
      <TopBar title="Bautagesbericht" subtitle={`${dateDE(day.datum)} · Übersicht`}
        right={
          <div className="flex gap-1">
            <button onClick={() => setView("settings")} className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"><Settings size={15} /> <span className="hidden sm:inline">Einstellungen</span></button>
            <button onClick={() => setView("archive")} className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"><Archive size={15} /> <span className="hidden sm:inline">Berichte</span></button>
          </div>
        } />
      <main className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
          <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Projekt"><input className={inputCls} value={day.projekt} onChange={(e) => { const v = e.target.value; setDay((s) => ({ ...s, projekt: v })); }} placeholder="Bauvorhaben" /></Field>
            <Field label="Datum"><input type="date" className={inputCls} value={day.datum} onChange={(e) => { const v = e.target.value; setDay((s) => ({ ...s, datum: v })); }} /></Field>
            <Field label="Bauleiter / Ersteller"><input className={inputCls} value={day.bauleiter} onChange={(e) => { const v = e.target.value; setDay((s) => ({ ...s, bauleiter: v })); }} placeholder="Name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Temp. min °C"><input type="number" className={inputCls} value={day.tempMin} onChange={(e) => { const v = e.target.value; setDay((s) => ({ ...s, tempMin: v })); }} /></Field>
              <Field label="Temp. max °C"><input type="number" className={inputCls} value={day.tempMax} onChange={(e) => { const v = e.target.value; setDay((s) => ({ ...s, tempMax: v })); }} /></Field>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Arbeit von"><input type="time" className={inputCls} value={day.arbeitStart} onChange={(e) => { const v = e.target.value; setDay((s) => ({ ...s, arbeitStart: v })); }} /></Field>
              <Field label="Arbeit bis"><input type="time" className={inputCls} value={day.arbeitEnde} onChange={(e) => { const v = e.target.value; setDay((s) => ({ ...s, arbeitEnde: v })); }} /></Field>
            </div>
            <Field label="Gewerk" hint="(frei)"><input className={inputCls} value={day.gewerk} onChange={(e) => { const v = e.target.value; setDay((s) => ({ ...s, gewerk: v })); }} placeholder="z. B. Tiefbau / HDD / Schweißkolonne" /></Field>
          </div>
          <div className="mt-4">
            <Label>Wetter</Label>
            <div className="flex flex-wrap gap-2">
              {WETTER.map(({ key, label, Icon }) => (
                <button key={key} onClick={() => setDay((s) => ({ ...s, wetter: key }))} className={`inline-flex min-h-[44px] items-center gap-2 rounded-sm border px-3 text-sm font-medium transition ${day.wetter === key ? "border-[#0F1E46] bg-[#DAE1F0] text-[#0F1E46]" : "border-[#C8D2E6] bg-white text-[#0F1E46]/70 hover:bg-[#DAE1F0]"}`}><Icon size={16} /> {label}</button>
              ))}
            </div>
          </div>
        </section>
          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-sm border border-[#C8D2E6] border-l-4 border-l-[#FAD200] bg-white">
          <div className="flex items-center gap-2 border-b border-[#C8D2E6] px-4 py-2.5"><Gauge size={16} className="text-[#0F1E46]" /><h2 className="text-sm font-bold">Tagesübersicht</h2><span className="hidden text-xs text-[#677BA4] sm:inline">— Summe aller Positionen, Basis für die Leistungsmeldung</span></div>
          <div className="grid grid-cols-3 divide-x divide-[#C8D2E6]">
            <Metric value={fmt(totals.ph)} unit="Std." label="Personal" />
            <Metric value={fmt(totals.gh)} unit="Std." label="Geräte" />
            <Metric value={String(positions.length)} unit="" label="Positionen" />
          </div>
          {totals.mengen.length > 0 && (
            <div className="border-t border-[#C8D2E6] px-4 py-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#677BA4]">Mengen nach BAS</p>
              <div className="flex flex-wrap gap-1.5">
                {totals.mengen.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-sm bg-[#DAE1F0] px-2 py-1 text-xs">
                    <span className="tabular-nums font-bold text-[#0F1E46]">{m.bas}</span>
                    <span className="hidden text-[#0F1E46]/70 sm:inline">{basName(m.bas)}</span>
                    <span className="tabular-nums font-semibold text-[#0F1E46]">{fmt(m.menge)} {m.einheit}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
            {!dayH && <p className="border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3 text-xs text-[#0F1E46]">Arbeitszeit Start und Ende eintragen – dann zeigt die Übersicht, wie viel vom Arbeitstag Geräte und Personal im Einsatz waren.</p>}
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
          <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#0F1E46]"><ClipboardList size={16} /> Erfasste Leistungen <span className="text-[#677BA4]">({positions.length})</span></h2>
            {offen > 0 && <p className="mb-2 border-l-4 border-[#C62828] bg-white py-1 pl-3 text-sm font-bold text-[#C62828]">{offen} übernommene Leistung(en) noch prüfen: öffnen und speichern oder mit dem Haken bestätigen.</p>}
            {positions.length === 0 ? <p className="rounded-sm border border-dashed border-[#96A8C7] p-4 text-sm text-[#0F1E46]/70">Noch keine Leistung erfasst.</p> : (
              <table className="w-full table-fixed border-collapse text-sm">
                <thead><tr className="bg-[#0F1E46] text-left text-[11px] font-bold uppercase tracking-wider text-white">
                  <th className="w-14 px-2 py-1">{(prof.schluessel || "BAS").slice(0, 6)}</th><th className="px-2 py-1">Leistung</th><th className="hidden w-24 px-2 py-1 text-right sm:table-cell">Menge</th><th className="w-[34%] px-2 py-1 sm:w-44">Ausführung durch</th><th className="w-[76px] px-1 py-1" />
                </tr></thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} onClick={() => startEdit(p)} className={`cursor-pointer border-b border-[#C8D2E6] align-top hover:bg-[#DAE1F0]/40 ${p.pruefen ? "text-[#C62828]" : "text-[#0F1E46]"}`}>
                      <td className={`px-2 py-2 ${p.pruefen ? "border-l-4 border-[#C62828]" : ""}`}><span className="rounded-sm bg-[#0F1E46] px-1.5 py-0.5 text-xs font-bold tabular-nums text-[#FAD200]">{p.bas || "—"}</span></td>
                      <td className="px-2 py-2">
                        <p className="break-words font-semibold">{p.bas ? basName(p.bas) : "Ohne BAS"}</p>
                        {p.pruefen && <p className="text-[11px] font-bold uppercase tracking-wider">Übernommen – bitte prüfen</p>}
                        <p className={`text-xs ${p.pruefen ? "" : "text-[#0F1E46]/70"}`}>{[p.sektion || "—", ort2Text(p), p.station].filter(Boolean).join(" · ")} · {p.taetigkeit || "—"}</p>
                        <p className="mt-0.5 text-xs text-[#0F1E46]/70"><span className="font-bold text-[#0F1E46] sm:hidden">{num(p.menge) ? `${fmt(num(p.menge))} ${p.einheit || ""} · ` : ""}</span>{fmt(phOf(p))} Pers.-Std. · {fmt(ghOf(p))} Geräte-Std.</p>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2 text-right font-bold tabular-nums sm:table-cell">{num(p.menge) ? `${fmt(num(p.menge))} ${p.einheit || ""}` : "—"}</td>
                      <td className="px-2 py-1.5"><NuSelect compact value={p.nachunternehmer || ""} names={nuNames} onChange={(v) => setPositionNu(p.id, v)} /></td>
                      <td className="whitespace-nowrap px-1 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {p.pruefen
                          ? <button onClick={() => confirmPosition(p.id)} className="rounded-sm p-2 text-[#C62828] hover:bg-[#DAE1F0]" aria-label="Als geprüft bestätigen"><CheckCircle2 size={16} /></button>
                          : <button onClick={() => startEdit(p)} className="rounded-sm p-2 text-[#0F1E46] hover:bg-[#DAE1F0]" aria-label="Bearbeiten"><Pencil size={15} /></button>}
                        <button onClick={() => deletePosition(p.id)} className={iconBtn} aria-label="Löschen"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex flex-wrap gap-2">
              <AddBtn onClick={() => startNew()}>Leistung hinzufügen</AddBtn>
              <button onClick={() => setCopyOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-sm bg-[#FAD200] px-3 py-2 text-sm font-bold text-[#0F1E46] transition hover:bg-[#FCE466]"><Copy size={16} /> Aus früherem Tag übernehmen</button>
            </div>
          </section>

          <div className="min-w-0 space-y-4">
            <HoursTable title="Geräte im Einsatz" icon={Truck} first="Gerätetyp" rows={gerRows} unit="Geräte-Std." dayH={dayH} />
            <HoursTable title="Personal im Einsatz" icon={Users} first="Rolle" rows={persRows} unit="Pers.-Std." dayH={dayH} />
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
          <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white">
            <div className="flex items-center gap-2 border-b border-[#C8D2E6] px-4 py-2.5"><Clock size={16} className="text-[#0F1E46]" /><h2 className="text-sm font-bold">Stillstandszeiten</h2><span className="text-xs text-[#677BA4]">({(day.stillstand || []).length})</span></div>
            <div className="space-y-3 p-4">
              {(day.stillstand || []).length === 0 && <p className="text-sm text-[#677BA4]">Keine Stillstandszeiten.</p>}
              {(day.stillstand || []).map((s, i) => { const d = spanH(s.start, s.ende); return (
                <div key={s.id} className="rounded-sm border border-[#C8D2E6] bg-[#DAE1F0]/40 p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-[#677BA4]">Stillstand {i + 1}{d ? ` · ${fmt(d)} Std.` : ""}</span><button onClick={() => delStill(s.id)} className={iconBtn} aria-label="Stillstand löschen"><Trash2 size={16} /></button></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={prof.ort1 || "Ort"}><Combo value={s.sektion} onChange={(v) => updDayRow("stillstand", s.id, { sektion: v })} options={sektOpts} /></Field>
                    {prof.ort2Aktiv && <Field label={prof.ort2}><Combo value={s.vorhaben} onChange={(v) => updDayRow("stillstand", s.id, { vorhaben: v })} options={ort2Opts.map((v) => ({ value: v, label: v }))} placeholder="– wählen –" /></Field>}
                    <Field label="Startzeit *"><input type="time" className={inputCls} value={s.start || ""} onChange={(e) => updDayRow("stillstand", s.id, { start: e.target.value })} /></Field>
                    <Field label="Endzeit *"><input type="time" className={inputCls} value={s.ende || ""} onChange={(e) => updDayRow("stillstand", s.id, { ende: e.target.value })} /></Field>
                  </div>
                  <div className="mt-3"><Field label="Begründung *"><input className={inputCls} value={s.grund || ""} onChange={(e) => updDayRow("stillstand", s.id, { grund: e.target.value })} placeholder="Grund des Stillstands" /></Field></div>
                  <div className="mt-3">
                    <Label>Betroffenes Personal</Label>
                    {(s.personal || []).map((r) => (
                      <div key={r.id} className="mb-2 flex items-center gap-2">
                        <div className="min-w-0 flex-1"><Combo value={r.rolle} onChange={(v) => updStillSub(s.id, "personal", (s.personal || []).map((x) => x.id === r.id ? { ...x, rolle: v } : x))} options={rollenOpts} placeholder="Rolle" /></div>
                        <div className="w-20 shrink-0"><input type="number" inputMode="numeric" className={inputCls} value={r.anzahl} onChange={(e) => updStillSub(s.id, "personal", (s.personal || []).map((x) => x.id === r.id ? { ...x, anzahl: e.target.value } : x))} placeholder="Anz." aria-label="Anzahl Personen" /></div>
                        <button onClick={() => updStillSub(s.id, "personal", (s.personal || []).filter((x) => x.id !== r.id))} className={iconBtn} aria-label="Personal entfernen"><Trash2 size={15} /></button>
                      </div>
                    ))}
                    <button onClick={() => updStillSub(s.id, "personal", [...(s.personal || []), { id: uid(), rolle: "", anzahl: "1" }])} className="inline-flex items-center gap-1.5 rounded-sm bg-[#FAD200] px-2.5 py-1.5 text-xs font-bold text-[#0F1E46] hover:bg-[#FCE466]"><Plus size={13} /> Personal hinzufügen</button>
                  </div>
                  <div className="mt-3">
                    <Label>Betroffene Geräte</Label>
                    {(s.geraete || []).map((r) => { const units = unitsOf(r.typ); return (
                      <div key={r.id} className="mb-2 flex flex-wrap items-center gap-2">
                        <div className="min-w-[140px] flex-1"><Combo value={r.typ} onChange={(v) => updStillSub(s.id, "geraete", (s.geraete || []).map((x) => x.id === r.id ? { ...x, typ: v, geraet: "" } : x))} options={geraeteTypOpts} placeholder="Gerätetyp" /></div>
                        {units.length > 0 && <div className="min-w-[140px] flex-1"><Combo value={r.geraet} onChange={(v) => updStillSub(s.id, "geraete", (s.geraete || []).map((x) => x.id === r.id ? { ...x, geraet: v } : x))} options={units.map((u) => ({ value: u, label: u }))} placeholder="Gerät (genau)" /></div>}
                        <div className="w-20 shrink-0"><input type="number" inputMode="numeric" className={inputCls} value={r.anzahl} onChange={(e) => updStillSub(s.id, "geraete", (s.geraete || []).map((x) => x.id === r.id ? { ...x, anzahl: e.target.value } : x))} placeholder="Anz." aria-label="Anzahl Geräte" /></div>
                        <button onClick={() => updStillSub(s.id, "geraete", (s.geraete || []).filter((x) => x.id !== r.id))} className={iconBtn} aria-label="Gerät entfernen"><Trash2 size={15} /></button>
                      </div>
                    ); })}
                    <button onClick={() => updStillSub(s.id, "geraete", [...(s.geraete || []), { id: uid(), typ: "", geraet: "", anzahl: "1" }])} className="inline-flex items-center gap-1.5 rounded-sm bg-[#FAD200] px-2.5 py-1.5 text-xs font-bold text-[#0F1E46] hover:bg-[#FCE466]"><Plus size={13} /> Gerät hinzufügen</button>
                  </div>
                  <div className="mt-3">
                    <Label>Fotos zum Stillstand</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(day.fotos || []).filter((f) => f.stillId === s.id).map((f) => (
                        <div key={f.id} className="rounded-sm border border-[#C8D2E6] bg-white p-1.5">
                          <div className="relative">
                            {fotoData[f.id] ? <img src={fotoData[f.id]} alt={f.text || f.name} className="h-24 w-full rounded-sm object-cover" /> : <div className="flex h-24 items-center justify-center bg-[#DAE1F0] text-xs text-[#677BA4]">lädt …</div>}
                            <button onClick={() => delFoto(f.id)} className="absolute right-1 top-1 rounded-sm bg-white p-1 text-[#C62828]" aria-label="Foto löschen"><Trash2 size={13} /></button>
                          </div>
                          <input className="mt-1.5 min-h-[34px] w-full rounded-sm border border-[#C8D2E6] px-2 text-xs text-[#0F1E46] outline-none focus:border-[#0F1E46]" value={f.text || ""} onChange={(e) => updDayRow("fotos", f.id, { text: e.target.value })} placeholder="Beschreibung" />
                        </div>
                      ))}
                    </div>
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-[#FAD200] px-2.5 py-1.5 text-xs font-bold text-[#0F1E46] hover:bg-[#FCE466]"><Camera size={13} /> Foto zum Stillstand
                      <input type="file" accept="image/*" multiple className="hidden" data-still={s.id} onChange={(e) => { addFotos(e.target.files, s.id); e.target.value = ""; }} />
                    </label>
                  </div>
                </div>
              ); })}
              <AddBtn onClick={() => addDayRow("stillstand", { sektion: "", vorhaben: "", start: "", ende: "", grund: "", personal: [], geraete: [] })}>Stillstandszeit hinzufügen</AddBtn>
            </div>
          </section>

          <div className="min-w-0 space-y-4">
            <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white">
          <div className="flex items-center gap-2 border-b border-[#C8D2E6] px-4 py-2.5"><Info size={16} className="text-[#0F1E46]" /><h2 className="text-sm font-bold">Besondere Vorkommnisse / Besucher</h2></div>
          <div className="space-y-3 p-4">
            {(day.vorkommnisse || []).length === 0 && <p className="text-sm text-[#677BA4]">Keine Einträge.</p>}
            {(day.vorkommnisse || []).map((v, i) => (
              <div key={v.id} className="flex items-start gap-2">
                <span className="mt-3 w-5 shrink-0 text-right text-xs font-semibold text-[#677BA4]">{i + 1}.</span>
                <textarea rows={2} className={`${inputCls} py-2`} value={v.text || ""} onChange={(e) => updDayRow("vorkommnisse", v.id, { text: e.target.value })} placeholder="Vorkommnis, Besuch von Behörde/Bauherr, Lieferung, Unfall …" />
                <button onClick={() => delDayRow("vorkommnisse", v.id)} className="mt-1.5 shrink-0 rounded-sm p-2 text-[#677BA4] hover:bg-[#DAE1F0] hover:text-[#C62828]"><Trash2 size={16} /></button>
              </div>
            ))}
            <AddBtn onClick={() => addDayRow("vorkommnisse", { text: "" })}>Eintrag hinzufügen</AddBtn>
          </div>
        </section>

            <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white">
              <div className="flex items-center gap-2 border-b border-[#C8D2E6] px-4 py-2.5"><Camera size={16} className="text-[#0F1E46]" /><h2 className="text-sm font-bold">Fotos</h2><span className="text-xs text-[#677BA4]">({(day.fotos || []).filter((f) => !f.stillId).length})</span></div>
              <div className="p-4">
                {(day.fotos || []).filter((f) => !f.stillId).length === 0 && <p className="mb-3 text-sm text-[#677BA4]">Noch keine Fotos.</p>}
                <div className="grid grid-cols-2 gap-3">
                  {(day.fotos || []).filter((f) => !f.stillId).map((f) => (
                    <div key={f.id} className="rounded-sm border border-[#C8D2E6] p-2">
                      <div className="relative">
                        {fotoData[f.id] ? <img src={fotoData[f.id]} alt={f.text || f.name} className="h-32 w-full rounded-sm object-cover" /> : <div className="flex h-32 items-center justify-center bg-[#DAE1F0] text-xs text-[#677BA4]">lädt …</div>}
                        <button onClick={() => delFoto(f.id)} className="absolute right-1 top-1 rounded-sm bg-white p-1.5 text-[#C62828]" aria-label="Foto löschen"><Trash2 size={14} /></button>
                      </div>
                      <input className="mt-2 min-h-[38px] w-full rounded-sm border border-[#C8D2E6] px-2 text-sm text-[#0F1E46] outline-none focus:border-[#0F1E46]" value={f.text || ""} onChange={(e) => updDayRow("fotos", f.id, { text: e.target.value })} placeholder="Beschreibung" />
                    </div>
                  ))}
                </div>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-sm bg-[#FAD200] px-3 py-2 text-sm font-bold text-[#0F1E46] hover:bg-[#FCE466]"><Camera size={16} /> Fotos hinzufügen
                  <input type="file" accept="image/*" multiple className="hidden" data-still="" onChange={(e) => { addFotos(e.target.files); e.target.value = ""; }} />
                </label>
              </div>
            </section>
          </div>
        </div>

        {hasContent && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setPreviewData({ day, positions, back: "home" }); setView("preview"); }} className="inline-flex items-center gap-2 rounded-sm bg-[#FAD200] px-4 py-2.5 text-sm font-bold text-[#0F1E46] hover:bg-[#FCE466]"><FileText size={16} /> Vorschau · PDF · Excel · XML</button>
            <button onClick={closeDay} disabled={offen > 0} className={`inline-flex items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-bold ${offen > 0 ? "cursor-not-allowed bg-[#B1BFD8] text-white" : "bg-[#FAD200] text-[#0F1E46] hover:bg-[#FCE466]"}`}><CheckCircle2 size={16} /> Tag abschließen</button>
            {offen > 0 && <span className="self-center text-xs font-bold text-[#C62828]">Erst {offen} übernommene Leistung(en) prüfen</span>}
          </div>
        )}
      </main>

      <p className="px-4 pb-6 text-center text-[10px] uppercase tracking-[0.3em] text-[#0F1E46]/70">HABAU INFRA | BAUTAGESBERICHT | © 2026</p>
      {copyOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F1E46]/50 sm:items-center sm:p-4" onClick={() => setCopyOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-sm bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3"><h3 className="text-base font-bold text-[#0F1E46]">Leistungen aus früherem Tag übernehmen</h3><button onClick={() => setCopyOpen(false)} className="rounded-sm p-1.5 text-[#677BA4] hover:bg-[#DAE1F0]" aria-label="Schließen"><X size={18} /></button></div>
            <p className="mb-3 text-sm text-[#0F1E46]/70">Die Leistungen werden mit Personal, Geräten und Mengen kopiert und rot markiert. Vor dem Senden jede prüfen.</p>
            {archive.filter((r) => r.positions.length > 0).length === 0 && <p className="border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3 text-sm text-[#0F1E46]">Noch kein abgeschlossener Tag vorhanden. Frühere Tage erscheinen hier, sobald ein Bericht mit „Tag abschließen“ abgelegt wurde.</p>}
            <div className="space-y-2">
              {archive.filter((r) => r.positions.length > 0).map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-sm border border-[#C8D2E6] p-3">
                  <div className="min-w-0 flex-1"><p className="font-semibold text-[#0F1E46]">{dateDE(r.day.datum)}</p><p className="text-xs text-[#0F1E46]/70">{r.positions.length} Leistung(en): {r.positions.map((p) => p.bas || "—").join(", ")}</p></div>
                  <button onClick={() => copyFrom(r)} className="shrink-0 rounded-sm bg-[#FAD200] px-3 py-2 text-sm font-bold text-[#0F1E46] hover:bg-[#FCE466]">Übernehmen</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ===================== KLEINTEILE ===================== */
function Metric({ value, unit, label }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="tabular-nums text-2xl font-bold leading-none text-[#0F1E46]">{value}<span className="ml-0.5 text-sm font-semibold text-[#677BA4]">{unit}</span></p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#0F1E46]/70">{label}</p>
    </div>
  );
}
const SumLine = ({ k, v }) => (<div className="flex gap-3"><span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[#677BA4]">{k}</span><span className="font-medium text-[#0F1E46]">{v}</span></div>);
function MiniSum({ title, icon: Icon, total, rows }) {
  return (
    <div className="rounded-sm border border-[#C8D2E6] bg-white p-4">
      <div className="mb-2 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0F1E46]"><Icon size={15} className="text-[#677BA4]" /> {title}</span><span className="tabular-nums text-xs font-semibold text-[#0F1E46]">{total}</span></div>
      {rows.length === 0 ? <p className="text-sm text-[#677BA4]">—</p> : <ul className="space-y-1 text-sm text-[#0F1E46]/70">{rows.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    </div>
  );
}
function MiniTable({ head, rows, foot }) {
  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="bg-[#0F1E46]">{head.map((h, i) => <th key={i} className={`px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={head.length} className="px-2 py-1 text-[#677BA4]">—</td></tr> :
            rows.map((r, i) => <tr key={i} className="border-b border-[#C8D2E6]">{r.map((c, j) => <td key={j} className={`px-2 py-1 text-[#0F1E46] ${j === 0 ? "text-left" : "text-right tabular-nums"}`}>{c || "—"}</td>)}</tr>)}
        </tbody>
      </table>
      <p className="mt-1 border-t-2 border-[#0F1E46] px-2 pt-1 text-right text-[11px] font-bold text-[#0F1E46]">∑ {foot}</p>
    </div>
  );
}
function DateBadge({ iso }) {
  const dt = new Date(iso);
  return (<div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-sm bg-[#0F1E46] text-white"><span className="text-[10px] leading-none text-[#FAD200]">{dt.toLocaleDateString("de-DE", { month: "short" })}</span><span className="text-base font-bold leading-tight">{dt.getDate()}</span></div>);
}
function BasModal({ meta, code, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F1E46]/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-sm bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-[#0F1E46] px-2 py-1 tabular-nums text-sm font-bold text-[#FAD200]">{code}</span>
            <h3 className="text-base font-bold text-[#0F1E46]">{meta.name}</h3>
          </div>
          <button onClick={onClose} className="rounded-sm p-1.5 text-[#677BA4] hover:bg-[#DAE1F0] hover:text-[#0F1E46]"><X size={18} /></button>
        </div>
        {meta.lv && <p className="mb-2 text-sm"><span className="font-semibold text-[#0F1E46]">Verknüpfte LV-Leistung: </span><span className="text-[#0F1E46]">{meta.lv}</span>{meta.me && <span className="ml-1.5 rounded-sm border border-[#C8D2E6] bg-white px-1.5 py-0.5 text-xs tabular-nums text-[#0F1E46]">{meta.me}</span>}</p>}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#677BA4]">Was steckt drin</p>
        <p className="text-sm leading-relaxed text-[#0F1E46]">{meta.desc || "Noch keine Beschreibung hinterlegt. Unter „Listen verwalten“ → BAS kannst du beschreiben, was in diesem BAS enthalten ist."}</p>
        {meta.wann && <><p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wider text-[#677BA4]">Wann dieses BAS wählen</p><p className="text-sm leading-relaxed text-[#0F1E46]">{meta.wann}</p></>}
      </div>
    </div>
  );
}

function LoginCard({ onSubmit }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!email || !pw) return;
    setBusy(true); setErr("");
    try { await onSubmit(email.trim(), pw); }
    catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-sm rounded-sm border border-[#C8D2E6] bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#0F1E46] text-[#FAD200]"><Lock size={20} /></div>
        <div><h2 className="font-bold text-[#0F1E46]">Admin-Anmeldung</h2><p className="text-xs text-[#0F1E46]/70">Nur zum Bearbeiten der Listen</p></div>
      </div>
      <div className="space-y-3">
        <Field label="E-Mail"><input type="email" autoComplete="username" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@firma.de" /></Field>
        <Field label="Passwort"><input type="password" autoComplete="current-password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" /></Field>
        {err && <p className="text-sm text-[#C62828]">{err}</p>}
        <button onClick={submit} disabled={busy || !email || !pw} className={`inline-flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 text-sm font-bold transition ${busy || !email || !pw ? "cursor-not-allowed bg-[#B1BFD8] text-white" : "bg-[#FAD200] text-[#0F1E46] hover:bg-[#FCE466]"}`}>
          <LogIn size={18} /> {busy ? "Anmelden…" : "Anmelden"}
        </button>
      </div>
      <p className="mt-4 text-xs text-[#677BA4]">Poliere müssen sich nicht anmelden – sie nutzen die App direkt. Admin-Konten werden in Supabase angelegt (Authentication → Users).</p>
    </div>
  );
}
