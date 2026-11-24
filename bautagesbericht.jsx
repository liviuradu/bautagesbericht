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
  const { personen, nuAnsprech, ...shared } = lists; // Namen/Ansprechpartner nur lokal, nie auf den Server
  lists = shared;
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
const DEF_PFLICHT = { sektion: true, vorhaben: true, taetigkeit: true, bas: true, beschreibung: true, menge: true, personal: true, geraete: false, ebene5: false, ebene6: false };

const defaultLists = () => ({
  sektionen: [...DEF_SEKTIONEN], taetigkeiten: [...DEF_TAETIGKEITEN], rollen: [...DEF_ROLLEN],
  nachunternehmer: [],
  bas: DEF_BAS.map((b) => ({ ...b })), geraete: DEF_GERAETE.map((g) => ({ typ: g.typ, units: [...g.units] })),
  pflicht: { ...DEF_PFLICHT },
  profil: { ...DEF_PROFIL, ort2Optionen: [...DEF_PROFIL.ort2Optionen] },
  ebene5: [], ebene6: [],
  personen: [], personalSpalten: ["", ""], nuAnsprech: {},
  geraeteSpalten: ["", ""], geraeteInfo: {},
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
  ort1: "Sektion", ort1Aktiv: true,                  // Bezeichnung der Ortsangabe (Liste "sektionen")
  ort2Aktiv: true, ort2: "Vorhaben", ort2Optionen: ["West", "Ost"],
  ort2Ueb: true, ort2UebLabel: "Vorhabenübergreifend", // zusätzliche Auswahl "gilt für alle"
  stationAktiv: false, station: "Station (km von – bis)",
  schluessel: "BAS", basAktiv: true,                 // Bezeichnung des Leistungs-/Kostenschlüssels
  taetLabel: "Tätigkeit", taetAktiv: true,
  e5Label: "Ebene 5", e5Aktiv: false, e6Label: "Ebene 6", e6Aktiv: false,
};
/* Die 6 Ebenen einer Leistung: feste Schlüssel (= Feld in der Position), nur Bezeichnung/Aktiv/Pflicht/Liste sind einstellbar */
const LEVELS = [
  { key: "sektion", akt: "ort1Aktiv", lab: "ort1", def: "Sektion" },
  { key: "vorhaben", akt: "ort2Aktiv", lab: "ort2", def: "Vorhaben" },
  { key: "taetigkeit", akt: "taetAktiv", lab: "taetLabel", def: "Tätigkeit", list: "taetigkeiten", ph: "Unterboden ausheben" },
  { key: "bas", akt: "basAktiv", lab: "schluessel", def: "BAS" },
  { key: "ebene5", akt: "e5Aktiv", lab: "e5Label", def: "Ebene 5", list: "ebene5", ph: "Eintrag" },
  { key: "ebene6", akt: "e6Aktiv", lab: "e6Label", def: "Ebene 6", list: "ebene6", ph: "Eintrag" },
];
const PROFIL_TYPEN = [
  { key: "linie", name: "Linienbaustelle", was: "Straße, Autobahn, Gleis, Leitung, Kanal", ort1: "Abschnitt", ort2Aktiv: true, ort2: "Fahrtrichtung / Seite", ort2Optionen: ["Richtung 1", "Richtung 2"], ort2Ueb: true, ort2UebLabel: "Beide Richtungen", stationAktiv: true, station: "Station (km von – bis)", beispiel: ["Abschnitt 1", "Abschnitt 2", "Abschnitt 3"] },
  { key: "suedlink", name: "Kabeltrasse", was: "Sektionen, Vorhaben West / Ost", ort1: "Sektion", ort2Aktiv: true, ort2: "Vorhaben", ort2Optionen: ["West", "Ost"], ort2Ueb: true, ort2UebLabel: "Vorhabenübergreifend", stationAktiv: false, station: "Station (km von – bis)", beispiel: DEF_SEKTIONEN },
  { key: "bruecke", name: "Brücke / Ingenieurbau", was: "Widerlager, Pfeiler, Überbau, Teilbauwerke", ort1: "Bauteil", ort2Aktiv: true, ort2: "Teilbauwerk", ort2Optionen: ["Teilbauwerk 1", "Teilbauwerk 2"], ort2Ueb: true, ort2UebLabel: "Beide Teilbauwerke", stationAktiv: true, station: "Achse", beispiel: ["Widerlager", "Pfeiler", "Überbau", "Kappen", "Baugrube"] },
  { key: "hochbau", name: "Hochbau", was: "Gebäude, Bauteile, Geschosse", ort1: "Gebäude / Bauteil", ort2Aktiv: true, ort2: "Geschoss", ort2Optionen: ["UG", "EG", "1. OG", "2. OG", "Dach"], ort2Ueb: true, ort2UebLabel: "Mehrere Geschosse", stationAktiv: true, station: "Achse / Raum", beispiel: ["Haus A", "Haus B", "Tiefgarage", "Außenanlagen"] },
  { key: "flaeche", name: "Flächenbaustelle", was: "Erdbau, Baufeld, Deponie, Außenanlagen", ort1: "Baufeld", ort2Aktiv: false, ort2: "Teilfläche", ort2Optionen: [], ort2Ueb: false, ort2UebLabel: "Gesamte Fläche", stationAktiv: false, station: "Lage", beispiel: ["Baufeld 1", "Baufeld 2", "Baufeld 3"] },
];
let _prof = DEF_PROFIL; // aktives Profil für die Export-Funktionen (wird von App gesetzt)
const ort2Text = (p) => (p.vorhabenUeb === "Ja" ? _prof.ort2UebLabel : (p.vorhaben || ""));
/* Ortszeile einer Position (alle aktiven Ebenen außer dem Schlüssel) – einzige Stelle für diese Anzeige */
const posOrt = (p) => [p.sektion, ort2Text(p), p.station, p.ebene5, p.ebene6].filter(Boolean).join(" · ");
const posZeile = (p) => [posOrt(p), p.taetigkeit].filter(Boolean).join(" · ") || "—";

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
const LIST_SHEETS = [["sektionen", "Sektionen", "Sektion"], ["taetigkeiten", "Tätigkeiten", "Tätigkeit"], ["rollen", "Rollen", "Rolle"], ["ebene5", "Ebene 5", "Ebene 5"], ["ebene6", "Ebene 6", "Ebene 6"]];
const PROF_BOOL = ["ort1Aktiv", "ort2Aktiv", "ort2Ueb", "stationAktiv", "taetAktiv", "basAktiv", "e5Aktiv", "e6Aktiv"];
const PROF_STR = ["typ", "projekt", "ort1", "ort2", "ort2UebLabel", "station", "schluessel", "taetLabel", "e5Label", "e6Label"];
function listsToWorkbook(l) {
  const wb = XLSX.utils.book_new();
  const add = (name, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  LIST_SHEETS.forEach(([key, sheet, head]) => add(sheet, [[head], ...(l[key] || []).filter(Boolean).map((x) => [x])]));
  const nu = (l.nachunternehmer || []).filter(Boolean); const na = l.nuAnsprech || {};
  add("Nachunternehmer", [["Name", "Ansprechpartner"], ...nu.map((x) => [x, na[x] || ""])]);
  const ps = l.personalSpalten || ["", ""];
  add("Personen", [["Name", "Rolle", ps[0] || "", ps[1] || ""], ...(l.personen || []).filter((x) => x.name).map((x) => [x.name, x.rolle || "", x.c1 || "", x.c2 || ""])]);
  const gs = l.geraeteSpalten || ["", ""]; const gi = l.geraeteInfo || {};
  const g = [["Typ", "Bezeichnung", "Inventarnummer", gs[0] || "", gs[1] || ""]];
  const gRow = (t, u) => { const i = gi[t + "||" + u] || {}; g.push([t, u, i.inv || "", i.c1 || "", i.c2 || ""]); };
  (l.geraete || []).filter((x) => x.typ).forEach((x) => { const u = (x.units || []).filter(Boolean); if (u.length === 0) gRow(x.typ, ""); else u.forEach((n) => gRow(x.typ, n)); });
  add("Geräte", g);
  add("BAS", [["Code", "Bezeichnung", "Gruppe", "Was steckt drin", "Wann wählen"], ...(l.bas || []).filter((x) => x.code).map((x) => [String(x.code), x.name || "", x.group || "", x.desc || "", x.wann || ""])]);
  const pr = { ...DEF_PROFIL, ...(l.profil || {}) }; const pfl = { ...DEF_PFLICHT, ...(l.pflicht || {}) };
  const jn = (v) => (v ? "ja" : "nein");
  add("Projekt", [["Einstellung", "Wert"], ...PROF_STR.slice(0, 3).map((k) => [k, pr[k]]), ["ort1Aktiv", jn(pr.ort1Aktiv)], ["ort2Aktiv", jn(pr.ort2Aktiv)], ["ort2", pr.ort2], ["ort2Optionen", (pr.ort2Optionen || []).filter(Boolean).join("; ")],
    ["ort2Ueb", jn(pr.ort2Ueb)], ["ort2UebLabel", pr.ort2UebLabel], ["stationAktiv", jn(pr.stationAktiv)], ["station", pr.station], ["schluessel", pr.schluessel], ["basAktiv", jn(pr.basAktiv)],
    ["taetLabel", pr.taetLabel], ["taetAktiv", jn(pr.taetAktiv)], ["e5Label", pr.e5Label], ["e5Aktiv", jn(pr.e5Aktiv)], ["e6Label", pr.e6Label], ["e6Aktiv", jn(pr.e6Aktiv)],
    ...Object.keys(DEF_PFLICHT).map((k) => ["pflicht." + k, jn(pfl[k])])]);
  return wb;
}
function workbookToLists(wb, cur) {
  const out = { ...cur }; const found = [];
  const rows = (name) => { const ws = wb.Sheets[name]; return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }).slice(1) : null; };
  const head = (name) => { const ws = wb.Sheets[name]; return ws ? (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })[0] || []) : []; };
  const str = (v) => String(v ?? "").trim();
  LIST_SHEETS.forEach(([key, sheet]) => { const r = rows(sheet); if (r) { out[key] = r.map((x) => str(x[0])).filter(Boolean); found.push(sheet); } });
  const nu = rows("Nachunternehmer");
  if (nu) { const names = []; const an = {}; nu.forEach((x) => { const n = str(x[0]); if (!n) return; names.push(n); if (str(x[1])) an[n] = str(x[1]); }); out.nachunternehmer = names; out.nuAnsprech = an; found.push("Nachunternehmer"); }
  const pe = rows("Personen");
  if (pe) { const h = head("Personen"); out.personalSpalten = [str(h[2]), str(h[3])]; out.personen = pe.map((x) => ({ name: str(x[0]), rolle: str(x[1]), c1: str(x[2]), c2: str(x[3]) })).filter((x) => x.name); found.push("Personen"); }
  const g = rows("Geräte");
  if (g) {
    const h = head("Geräte"); const m = new Map(); const info = {};
    g.forEach((x) => { const t = str(x[0]); if (!t) return; if (!m.has(t)) m.set(t, []); const u = str(x[1]); if (u && !m.get(t).includes(u)) m.get(t).push(u);
      const i = { inv: str(x[2]), c1: str(x[3]), c2: str(x[4]) }; const k = t + "||" + u;
      if ((i.inv || i.c1 || i.c2) && !info[k]) info[k] = i; });
    out.geraete = [...m.entries()].map(([typ, units]) => ({ typ, units })); out.geraeteInfo = info; out.geraeteSpalten = [str(h[3]), str(h[4])]; found.push("Geräte");
  }
  const b = rows("BAS");
  if (b) { out.bas = b.map((x) => ({ code: str(x[0]), name: str(x[1]), group: str(x[2]), desc: str(x[3]), wann: str(x[4]) })).filter((x) => x.code); found.push("BAS"); }
  const pj = rows("Projekt");
  if (pj) {
    const pr = { ...DEF_PROFIL, ...(cur.profil || {}) }; const pfl = { ...DEF_PFLICHT, ...(cur.pflicht || {}) };
    const yes = (v) => /^(ja|true|1|x)$/i.test(str(v));
    pj.forEach((x) => {
      const k = str(x[0]); const v = x[1];
      if (k.startsWith("pflicht.") && k.slice(8) in DEF_PFLICHT) pfl[k.slice(8)] = yes(v);
      else if (PROF_BOOL.includes(k)) pr[k] = yes(v);
      else if (k === "ort2Optionen") pr.ort2Optionen = str(v).split(";").map((t) => t.trim()).filter(Boolean);
      else if (PROF_STR.includes(k) && str(v)) pr[k] = str(v);
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
/* Rendert EINEN Tagesbericht ab der aktuellen Seite von doc (Einzel-PDF und Projekt-PDF nutzen dieselbe Funktion). */
function renderDayPdf(doc, autoTable, day, positions, kurz, fotos) {
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
    head: [["Nr", `${_prof.schluessel} / ${_prof.ort1}${_prof.ort2Aktiv ? " · " + _prof.ort2 : ""}`.replace(/^ \/ /, ""), "Tätigkeit", "Beschreibung", "Menge", "P-Std", "G-Std"]],
    body: positions.map((p, i) => [
      i + 1, [p.bas, posOrt(p)].filter(Boolean).join("\n") || "—",
      (p.taetigkeit || "") + (p.nachunternehmer ? "\nNU: " + p.nachunternehmer : ""), p.beschreibung || "", num(p.menge) ? `${fmt(num(p.menge))} ${p.einheit || ""}` : "", fmt(phOf(p)), fmt(ghOf(p)),
    ]),
    styles: { fontSize: 8, cellPadding: 3, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [15, 30, 70], textColor: 255, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 100 }, 4: { halign: "right", cellWidth: 50 }, 5: { halign: "right", cellWidth: 32 }, 6: { halign: "right", cellWidth: 32 } },
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
      if (col === 0 && y + ih + 36 > H - 40) { doc.addPage(); y = 46; }
      const x = M + col * (cw + 12);
      try { doc.addImage(f.data, "JPEG", x, y, cw, ih); } catch (e) {}
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      const pos = f.posId ? positions.findIndex((p) => p.id === f.posId) : -1;
      const cap = f.posId ? `Leistung Nr. ${pos + 1} – ${pos >= 0 ? (positions[pos].bas ? kurz(positions[pos].bas) : positions[pos].taetigkeit || "") : ""}${f.text || f.name ? ": " + (f.text || f.name) : ""}` : `${f.still ? "Stillstand " + f.still + ": " : (i + 1) + ". "}${f.text || f.name || ""}`;
      const capLines = doc.splitTextToSize(cap, cw).slice(0, 3);
      doc.text(capLines, x, y + ih + 10);
      rowH = Math.max(rowH, ih + 14 + capLines.length * 10);
      if (col === 1) { y += rowH; rowH = 0; col = 0; } else col = 1;
    });
  };
  const fl = fotos || [];
  const byPos = fl.filter((f) => f.posId).sort((a, b) => positions.findIndex((p) => p.id === a.posId) - positions.findIndex((p) => p.id === b.posId));
  drawFotos("Fotos zu Leistungen", byPos);
  drawFotos("Fotos zu Stillstandszeiten", fl.filter((f) => f.still && !f.posId));
  drawFotos("Fotos", fl.filter((f) => !f.still && !f.posId));
}
function addPageFooters(doc, label) {
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight(); const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(103, 123, 164);
    doc.text(label, 40, H - 18); doc.text(`Seite ${i} / ${n}`, W - 40, H - 18, { align: "right" });
  }
}
async function buildPdfBlob(day, positions, kurz, fotos) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  renderDayPdf(doc, autoTable, day, positions, kurz, fotos);
  addPageFooters(doc, "HABAU INFRA | Bautagesbericht " + dateDE(day.datum));
  return doc.output("blob");
}
/* Projekt-PDF: Deckblatt + Inhaltsverzeichnis, danach jeder Bericht auf neuer Seite. entries = [{day, positions, fotos}] (älteste zuerst) */
async function buildProjectPdfBlob(entries, kurz, projekt) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); const M = 40;
  const von = entries[0].day.datum, bis = entries[entries.length - 1].day.datum;
  doc.setTextColor(15, 30, 70);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("HABAU INFRA", M, 60);
  doc.setFontSize(26); doc.text("Bautagesberichte", M, 100);
  doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.text(String(projekt || ""), M, 124);
  doc.setFontSize(10); doc.text(`Zeitraum: ${dateDE(von)} – ${dateDE(bis)}`, M, 144); doc.text(`Anzahl Berichte: ${entries.length}`, M, 158);
  doc.setDrawColor(250, 210, 0); doc.setLineWidth(2); doc.line(M, 170, W - M, 170);
  autoTable(doc, {
    startY: 186, head: [["Datum", "Leistungen", "Personal-Std", "Geräte-Std"]],
    body: entries.map((e) => [dateDE(e.day.datum), String(e.positions.length), fmt(e.positions.reduce((a, p) => a + phOf(p), 0)), fmt(e.positions.reduce((a, p) => a + ghOf(p), 0))]),
    styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [15, 30, 70], textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } }, margin: { left: M, right: M },
  });
  for (const e of entries) { doc.addPage(); renderDayPdf(doc, autoTable, e.day, e.positions, kurz, e.fotos); }
  addPageFooters(doc, "HABAU INFRA | Bautagesberichte " + (projekt || ""));
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

/* Senden: PDF + Excel + XML. Handy -> Teilen-Menü (Outlook wählen). PC -> E-Mail-Entwurf für Outlook. Rückgabe: was passiert ist. */
async function shareReport(day, positions, kurz, fotos) {
  const base = fileBase(day);
  const xmlFile = new File([buildXML(day, positions, kurz)], base + ".xml", { type: "application/xml" });
  let pdfFile = null;
  try { const pdf = await buildPdfBlob(day, positions, kurz, fotos); pdfFile = new File([pdf], base + ".pdf", { type: "application/pdf" }); } catch (e) { /* PDF nicht möglich -> nur XML */ }
  let xlsxFile = null;
  try { xlsxFile = new File([XLSX.write(buildWorkbook(day, positions, kurz), { bookType: "xlsx", type: "array" })], base + ".xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); } catch (e) { /* Excel nicht möglich */ }
  const files = [pdfFile, xlsxFile, xmlFile].filter(Boolean);
  const subject = `Bautagesbericht ${day.projekt || ""} ${dateDE(day.datum)}`.replace(/\s+/g, " ").trim();
  const text = `Guten Tag,\n\nanbei der Bautagesbericht vom ${dateDE(day.datum)} (${positions.length} Leistungen) als PDF, Excel und XML.\n\nViele Grüße${day.bauleiter ? "\n" + day.bauleiter : ""}`;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  // 1) Handy: natives Teilen-Menü – Outlook wählen, alle Dateien sind angehängt
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
  id: uid(), sektion: "", vorhabenUeb: "Nein", vorhaben: "", station: "", ebene5: "", ebene6: "", taetigkeit: "", nachunternehmer: "", bas: "", beschreibung: "", menge: "", einheit: "",
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
const EMPTY_OBJ = {};
const CAP = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#0F1E46]/70";

/* Eine Ebene (Zeile): Bezeichnung, Aktiv, Pflicht, Liste bearbeiten – Listeneditor klappt direkt darunter auf */
function LevelRow({ lv, nr, prof, pf, count, isOpen, onToggle, onProfil, onPflicht, children }) {
  const aktiv = !!prof[lv.akt];
  return (
    <div data-level={lv.key} data-pflicht={lv.key} className="border-b border-[#C8D2E6] py-3">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <span className="w-6 pb-2.5 text-sm font-bold tabular-nums text-[#677BA4]">{nr}</span>
        <div className="min-w-[150px] flex-1"><span className={CAP}>Bezeichnung</span><input className={CELL_INPUT} value={prof[lv.lab] ?? ""} onChange={(e) => onProfil({ [lv.lab]: e.target.value })} placeholder={lv.def} aria-label={`Bezeichnung Ebene ${nr}`} /></div>
        <div><span className={CAP}>Aktiv</span><JaNein value={aktiv} onChange={(v) => onProfil({ [lv.akt]: v })} /></div>
        <div className={`min-w-[180px] ${aktiv ? "" : "pointer-events-none opacity-40"}`}><span className={CAP}>Angabe</span><PflichtToggle value={pf[lv.key]} onChange={(v) => onPflicht(lv.key, v)} /></div>
        <button type="button" data-open={lv.key} aria-expanded={isOpen} onClick={onToggle} className="inline-flex min-h-[40px] items-center gap-2 rounded-sm bg-[#FAD200] px-3 text-sm font-bold text-[#0F1E46] transition hover:bg-[#FCE466]"><ListChecks size={15} />{isOpen ? "Liste schließen" : "Liste bearbeiten"} ({count})</button>
      </div>
      {isOpen && <div className="mt-3 min-w-0 border-l-4 border-[#DAE1F0] pl-3 sm:pl-4">{children}</div>}
    </div>
  );
}

/* Tab "Projekt": Vorlage wählen und die 6 Ebenen einer Leistung einstellen */
function ProjektTab({ prof, pf, lists, open, setOpen, onProfil, onPflicht, onList, onTyp }) {
  const [mitBeispiel, setMitBeispiel] = useState(false);
  const opts = (prof.ort2Optionen || []).filter((x) => x.trim());
  const cnt = (a) => (a || []).filter((x) => String(x).trim()).length;
  const counts = { sektion: cnt(lists.sektionen), vorhaben: opts.length, taetigkeit: cnt(lists.taetigkeiten), bas: (lists.bas || []).filter((b) => b.code).length, ebene5: cnt(lists.ebene5), ebene6: cnt(lists.ebene6) };
  const lab = (lv) => prof[lv.lab] || lv.def;
  const tog = (k) => setOpen(open === k ? "" : k);
  const WEITERE = [["beschreibung", "Beschreibung", "Freitext: was wurde konkret ausgeführt"], ["menge", "Menge und Einheit", "Menge größer 0 mit Einheit"], ["personal", "Personal", "Mindestens eine Person mit Rolle, Anzahl und Stunden"], ["geraete", "Geräte", "Mindestens ein Gerät mit Anzahl und Betriebsstunden"]];
  return (
    <div className="space-y-4">
      <section className="min-w-0 rounded-sm border border-[#C8D2E6] border-l-4 border-l-[#FAD200] bg-white p-4">
        <h2 className="text-sm font-bold text-[#0F1E46]">1 · Vorlage wählen (optional)</h2>
        <p className="mt-1 text-sm text-[#0F1E46]/70">Eine Vorlage füllt die Ebenen passend vor. Danach kannst du unten alles anpassen.</p>
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
        <label className="mt-3 flex items-start gap-2 text-sm text-[#0F1E46]"><input type="checkbox" className="mt-1" checked={mitBeispiel} onChange={(e) => setMitBeispiel(e.target.checked)} /><span>Beispiel-Einträge für die erste Ebene mit übernehmen <span className="text-[#C62828]">(ersetzt die jetzige Liste)</span></span></label>
      </section>

      <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4">
        <h2 className="text-sm font-bold text-[#0F1E46]">2 · Einstellungen für dieses Projekt</h2>
        <ProfRow title="Projektname" hint="Steht im Kopf jedes neuen Tagesberichts."><input className={CELL_INPUT} value={prof.projekt} onChange={(e) => onProfil({ projekt: e.target.value })} placeholder="Name des Projekts" /></ProfRow>
        <div className="pt-3">
          <p className="text-sm font-semibold text-[#0F1E46]">Ebenen einer Leistung</p>
          <p className="text-xs text-[#0F1E46]/70">Bis zu 6 Ebenen. Gib jeder Ebene einen Namen, schalte nicht benötigte aus und lege fest, ob die Angabe Pflicht ist. Die Auswahllisten pflegst du je Ebene mit „Liste bearbeiten“.</p>
        </div>
        {LEVELS.map((lv, i) => (
          <LevelRow key={lv.key} lv={lv} nr={i + 1} prof={prof} pf={pf} count={counts[lv.key]} isOpen={open === lv.key} onToggle={() => tog(lv.key)} onProfil={onProfil} onPflicht={onPflicht}>
            {lv.key === "vorhaben" ? (
              <div className="space-y-4">
                <div><p className="mb-1 text-sm font-semibold text-[#0F1E46]">Auswahlmöglichkeiten</p><ListTable items={prof.ort2Optionen || []} onChange={(v) => onProfil({ ort2Optionen: v })} placeholder="z. B. Richtung Nord" /></div>
                <div><p className="text-sm font-semibold text-[#0F1E46]">Auswahl „gilt für alle“</p><p className="mb-2 text-xs text-[#0F1E46]/70">Zusätzliche Schaltfläche, wenn eine Leistung mehrere oder alle betrifft.</p><div className="space-y-2"><JaNein value={prof.ort2Ueb} onChange={(v) => onProfil({ ort2Ueb: v })} />{prof.ort2Ueb && <input className={CELL_INPUT} value={prof.ort2UebLabel} onChange={(e) => onProfil({ ort2UebLabel: e.target.value })} placeholder="Beide Richtungen" />}</div></div>
              </div>
            ) : lv.key === "bas" ? <BasTable bas={lists.bas} onChange={(v) => onList("bas", v)} />
              : <ListTable items={lists[lv.list || "sektionen"] || []} onChange={(v) => onList(lv.list || "sektionen", v)} placeholder={lv.ph || "Sektion 1"} />}
          </LevelRow>
        ))}
        <ProfRow title="Freies Feld für die genaue Lage" hint="Zum Beispiel Station (km von – bis), Achse oder Raum. Freier Text, immer freiwillig."><div className="space-y-2"><JaNein value={prof.stationAktiv} onChange={(v) => onProfil({ stationAktiv: v })} />{prof.stationAktiv && <input className={CELL_INPUT} value={prof.station} onChange={(e) => onProfil({ station: e.target.value })} placeholder="Station (km von – bis)" />}</div></ProfRow>
        <div className="pt-3">
          <p className="text-sm font-semibold text-[#0F1E46]">Weitere Pflichtfelder</p>
          {WEITERE.map(([k, l, was]) => (
            <div key={k} data-pflicht={k} className="grid gap-2 border-b border-[#C8D2E6] py-3 last:border-b-0 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] sm:gap-4">
              <div><p className="text-sm font-semibold text-[#0F1E46]">{l}</p><p className="text-xs text-[#0F1E46]/70">{was}</p></div>
              <div><PflichtToggle value={pf[k]} onChange={(v) => onPflicht(k, v)} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="min-w-0 border-l-4 border-[#FAD200] bg-[#DAE1F0] p-4">
        <h2 className="text-sm font-bold text-[#0F1E46]">So sieht es beim Erfassen einer Leistung aus</h2>
        <div className="mt-2 space-y-2 text-sm text-[#0F1E46]">
          {LEVELS.filter((lv) => prof[lv.akt]).map((lv) => lv.key === "vorhaben"
            ? <div key={lv.key} className="flex flex-wrap items-center gap-2"><span className="font-bold">{lab(lv)}{pf[lv.key] ? " *" : ""}:</span>{opts.map((o) => <span key={o} className="rounded-sm border border-[#0F1E46] bg-white px-2 py-1 text-xs font-semibold">{o}</span>)}{prof.ort2Ueb && <span className="rounded-sm border border-[#0F1E46] bg-white px-2 py-1 text-xs font-semibold">{prof.ort2UebLabel}</span>}{opts.length === 0 && !prof.ort2Ueb && <span className="text-xs text-[#C62828]">Noch keine Auswahlmöglichkeit eingetragen.</span>}</div>
            : <p key={lv.key}><span className="font-bold">{lab(lv)}{pf[lv.key] ? " *" : ""}:</span> Auswahl aus der Liste</p>)}
          {prof.stationAktiv && <p><span className="font-bold">{prof.station}:</span> freier Text</p>}
          {LEVELS.every((lv) => !prof[lv.akt]) && <p className="text-xs text-[#677BA4]">Keine Ebene aktiv.</p>}
        </div>
      </section>
    </div>
  );
}

/* Gemeinsamer Tabellenkopf-Eingabefeld für frei benennbare Spalten */
const HEAD_INPUT = "w-full min-h-[34px] rounded-sm border border-white/40 bg-white px-2 text-xs font-semibold normal-case tracking-normal text-[#0F1E46] placeholder-[#96A8C7] outline-none focus:border-[#FAD200]";

/* Tab "Personal": Rollen + Personen */
function PersonalTab({ lists, pf, onList, onPflicht }) {
  const personen = lists.personen || [];
  const sp = lists.personalSpalten || ["", ""];
  const rollen = (lists.rollen || []).filter((r) => r.trim());
  const [q, setQ] = useState("");
  const wrap = React.useRef(null); const focusRow = React.useRef(-1);
  useEffect(() => { if (focusRow.current < 0) return; const el = wrap.current && wrap.current.querySelector(`[data-prow="${focusRow.current}"]`); focusRow.current = -1; if (el) el.focus(); }, [personen.length]);
  const ql = q.trim().toLowerCase();
  const rows = personen.map((p, i) => ({ p, i })).filter(({ p }) => !ql || `${p.name} ${p.rolle} ${p.c1} ${p.c2}`.toLowerCase().includes(ql));
  const setP = (i, patch) => onList("personen", personen.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setSp = (j, v) => onList("personalSpalten", sp.map((x, k) => (k === j ? v : x)));
  return (
    <div className="space-y-4">
      <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-[#0F1E46]">Rollen</h2>
        <PflichtBar frage="Muss jede Leistung mindestens eine Person enthalten?" value={pf.personal} onChange={(v) => onPflicht("personal", v)} />
        <ListTable items={lists.rollen} onChange={(v) => onList("rollen", v)} placeholder="Polier" />
      </section>
      <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-[#0F1E46]">Personen</h2>
        <div className="mb-4 border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3 text-sm text-[#0F1E46]">Namen werden nur auf diesem Gerät und in der Excel-Datei gespeichert, nicht auf dem gemeinsamen Server. Beim Erfassen einer Leistung kannst du sie je Rolle antippen.</div>
        <div ref={wrap}>
          {personen.length > 15 && <div className="mb-3 flex"><TableSearch value={q} onChange={setQ} placeholder="Personen suchen…" /></div>}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <thead><tr className="bg-[#0F1E46] text-white">
                <th className={`${TH_CLS} w-[26%]`}>Name</th><th className={`${TH_CLS} w-[22%]`}>Rolle</th>
                <th className="w-[22%] px-2 py-2"><input className={HEAD_INPUT} value={sp[0] || ""} onChange={(e) => setSp(0, e.target.value)} placeholder="Eigene Spalte" aria-label="Titel freie Spalte 1" /></th>
                <th className="w-[22%] px-2 py-2"><input className={HEAD_INPUT} value={sp[1] || ""} onChange={(e) => setSp(1, e.target.value)} placeholder="Eigene Spalte" aria-label="Titel freie Spalte 2" /></th>
                <th className="w-12 px-1 py-2"><span className="sr-only">Löschen</span></th>
              </tr></thead>
              <tbody>
                {rows.map(({ p, i }) => (
                  <tr key={i} className="border-b border-[#C8D2E6] align-top">
                    <td className="px-2 py-1.5"><input data-prow={i} className={CELL_INPUT} value={p.name || ""} placeholder="Name" onChange={(e) => setP(i, { name: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><select className={CELL_INPUT} value={p.rolle || ""} onChange={(e) => setP(i, { rolle: e.target.value })}><option value="">– Rolle –</option>{p.rolle && !rollen.includes(p.rolle) && <option value={p.rolle}>{p.rolle}</option>}{rollen.map((r) => <option key={r} value={r}>{r}</option>)}</select></td>
                    <td className="px-2 py-1.5"><input className={CELL_INPUT} value={p.c1 || ""} onChange={(e) => setP(i, { c1: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><input className={CELL_INPUT} value={p.c2 || ""} onChange={(e) => setP(i, { c2: e.target.value })} /></td>
                    <td className="px-1 py-1.5 text-center"><button onClick={() => onList("personen", personen.filter((_, k) => k !== i))} className={DEL_BTN} aria-label="Zeile löschen"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-sm text-[#677BA4]">{personen.length === 0 ? "Noch keine Personen." : "Keine Treffer."}</td></tr>}
              </tbody>
            </table>
          </div>
          <AddBtn onClick={() => { setQ(""); focusRow.current = personen.length; onList("personen", [...personen, { name: "", rolle: "", c1: "", c2: "" }]); }}>Person hinzufügen</AddBtn>
        </div>
      </section>
    </div>
  );
}

/* Tab "Nachunternehmer": Name | Ansprechpartner (Liste bleibt Array aus Namen, Ansprechpartner je Name daneben) */
function NuTable({ names, ansprech, onChange }) {
  const [q, setQ] = useState("");
  const wrap = React.useRef(null); const focusRow = React.useRef(-1);
  useEffect(() => { if (focusRow.current < 0) return; const el = wrap.current && wrap.current.querySelector(`[data-row="${focusRow.current}"]`); focusRow.current = -1; if (el) el.focus(); }, [names.length]);
  const ql = q.trim().toLowerCase();
  const rows = names.map((v, i) => ({ v, i })).filter(({ v }) => !ql || `${v} ${ansprech[v] || ""}`.toLowerCase().includes(ql));
  const rename = (i, nv) => { const old = names[i]; const an = { ...ansprech }; if (old !== nv && old in an) { an[nv] = an[old]; delete an[old]; } onChange(names.map((x, k) => (k === i ? nv : x)), an); };
  const setAn = (name, v) => onChange(names, { ...ansprech, [name]: v });
  const del = (i) => { const an = { ...ansprech }; if (names.filter((x) => x === names[i]).length === 1) delete an[names[i]]; onChange(names.filter((_, k) => k !== i), an); };
  return (
    <div ref={wrap}>
      {names.length > 15 && <div className="mb-3 flex"><TableSearch value={q} onChange={setQ} placeholder="Suchen…" /></div>}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[420px] table-fixed border-collapse text-sm">
          <thead><tr className="bg-[#0F1E46] text-white"><th className={`${TH_CLS} w-[48%]`}>Name</th><th className={TH_CLS}>Ansprechpartner</th><th className="w-12 px-1 py-2"><span className="sr-only">Löschen</span></th></tr></thead>
          <tbody>
            {rows.map(({ v, i }) => (
              <tr key={i} className="border-b border-[#C8D2E6]">
                <td className="px-2 py-1.5"><input data-row={i} className={CELL_INPUT} value={v} placeholder="Name der Firma" onChange={(e) => rename(i, e.target.value)} /></td>
                <td className="px-2 py-1.5"><input className={CELL_INPUT} value={ansprech[v] || ""} disabled={!v.trim()} placeholder={v.trim() ? "Name, Telefon" : "erst Firma eintragen"} onChange={(e) => setAn(v, e.target.value)} /></td>
                <td className="px-1 py-1.5 text-center"><button onClick={() => del(i)} className={DEL_BTN} aria-label="Zeile löschen"><Trash2 size={16} /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="px-2 py-3 text-sm text-[#677BA4]">{names.length === 0 ? "Noch keine Einträge." : "Keine Treffer."}</td></tr>}
          </tbody>
        </table>
      </div>
      <AddBtn onClick={() => { setQ(""); focusRow.current = names.length; onChange([...names, ""], ansprech); }}>Zeile hinzufügen</AddBtn>
    </div>
  );
}

/* Geräte als flache Tabelle. Bearbeitet werden Zeilen (lokal); gespeichert wird weiter
   lists.geraete = [{typ, units}] plus lists.geraeteInfo[typ||unit] = {inv, c1, c2}. */
const geraeteRows = (geraete, info) => {
  const out = [];
  (geraete || []).forEach((g) => { const u = (g.units || []).filter(Boolean); const mk = (unit) => { const i = (info || {})[g.typ + "||" + unit] || {}; return { rid: uid(), typ: g.typ, unit, inv: i.inv || "", c1: i.c1 || "", c2: i.c2 || "" }; }; if (u.length === 0) out.push(mk("")); else u.forEach((x) => out.push(mk(x))); });
  return out;
};
const geraeteFromRows = (rows) => {
  const m = new Map(); const info = {};
  rows.forEach((r) => { const t = (r.typ || "").trim(); if (!t) return; if (!m.has(t)) m.set(t, []); const u = (r.unit || "").trim(); if (u && !m.get(t).includes(u)) m.get(t).push(u);
    const i = { inv: r.inv || "", c1: r.c1 || "", c2: r.c2 || "" }; const k = t + "||" + u; if ((i.inv || i.c1 || i.c2) && !info[k]) info[k] = i; });
  return { geraete: [...m.entries()].map(([typ, units]) => ({ typ, units })), geraeteInfo: info };
};
function GeraeteFlat({ geraete, info, spalten, onChange }) {
  const [rows, setRows] = useState(() => geraeteRows(geraete, info));
  const last = React.useRef({ g: geraete, i: info });
  const [q, setQ] = useState("");
  const wrap = React.useRef(null); const focusRid = React.useRef("");
  useEffect(() => { if (geraete !== last.current.g || info !== last.current.i) { last.current = { g: geraete, i: info }; setRows(geraeteRows(geraete, info)); } }, [geraete, info]);
  useEffect(() => { if (!focusRid.current) return; const el = wrap.current && wrap.current.querySelector(`[data-rid="${focusRid.current}"]`); focusRid.current = ""; if (el) el.focus(); }, [rows.length]);
  const sp = spalten || ["", ""];
  const emit = (next) => { setRows(next); const d = geraeteFromRows(next); last.current = { g: d.geraete, i: d.geraeteInfo }; onChange({ geraete: d.geraete, geraeteInfo: d.geraeteInfo }); };
  const setR = (rid, patch) => emit(rows.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  const ql = q.trim().toLowerCase();
  const shown = rows.filter((r) => !ql || `${r.typ} ${r.unit} ${r.inv} ${r.c1} ${r.c2}`.toLowerCase().includes(ql));
  const hi = "w-full min-h-[34px] rounded-sm border border-white/40 bg-white px-2 text-xs font-semibold normal-case tracking-normal text-[#0F1E46] placeholder-[#96A8C7] outline-none focus:border-[#FAD200]";
  return (
    <div ref={wrap}>
      {rows.length > 15 && <div className="mb-3 flex"><TableSearch value={q} onChange={setQ} placeholder="Geräte suchen…" /></div>}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
          <thead><tr className="bg-[#0F1E46] text-white">
            <th className={`${TH_CLS} w-[22%]`}>Gerätetyp</th><th className={`${TH_CLS} w-[22%]`}>Genaue Bezeichnung</th><th className={`${TH_CLS} w-[16%]`}>Inventarnummer</th>
            <th className="w-[17%] px-2 py-2"><input className={hi} value={sp[0] || ""} onChange={(e) => onChange({ geraeteSpalten: [e.target.value, sp[1] || ""] })} placeholder="Eigene Spalte" aria-label="Titel freie Spalte 1" /></th>
            <th className="w-[17%] px-2 py-2"><input className={hi} value={sp[1] || ""} onChange={(e) => onChange({ geraeteSpalten: [sp[0] || "", e.target.value] })} placeholder="Eigene Spalte" aria-label="Titel freie Spalte 2" /></th>
            <th className="w-12 px-1 py-2"><span className="sr-only">Löschen</span></th>
          </tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.rid} className="border-b border-[#C8D2E6] align-top">
                <td className="px-2 py-1.5"><input data-rid={r.rid} className={CELL_INPUT} value={r.typ} placeholder="z. B. Kettenbagger" onChange={(e) => setR(r.rid, { typ: e.target.value })} /></td>
                <td className="px-2 py-1.5"><input className={CELL_INPUT} value={r.unit} placeholder="CAT 320" onChange={(e) => setR(r.rid, { unit: e.target.value })} /></td>
                <td className="px-2 py-1.5"><input className={CELL_INPUT} value={r.inv} placeholder="Inv.-Nr." onChange={(e) => setR(r.rid, { inv: e.target.value })} /></td>
                <td className="px-2 py-1.5"><input className={CELL_INPUT} value={r.c1} onChange={(e) => setR(r.rid, { c1: e.target.value })} /></td>
                <td className="px-2 py-1.5"><input className={CELL_INPUT} value={r.c2} onChange={(e) => setR(r.rid, { c2: e.target.value })} /></td>
                <td className="px-1 py-1.5 text-center"><button onClick={() => emit(rows.filter((x) => x.rid !== r.rid))} className={DEL_BTN} aria-label="Zeile löschen"><Trash2 size={16} /></button></td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="px-2 py-3 text-sm text-[#677BA4]">{rows.length === 0 ? "Noch keine Geräte." : "Keine Treffer."}</td></tr>}
          </tbody>
        </table>
      </div>
      <AddBtn onClick={() => { setQ(""); const rid = uid(); focusRid.current = rid; setRows([...rows, { rid, typ: "", unit: "", inv: "", c1: "", c2: "" }]); }}>Zeile hinzufügen</AddBtn>
      <p className="mt-2 text-xs text-[#0F1E46]/70">Gleicher Gerätetyp in mehreren Zeilen = mehrere genaue Geräte dieses Typs. Zeilen ohne Gerätetyp werden nicht gespeichert.</p>
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
  const [lvlOpen, setLvlOpen] = useState(""); // geöffneter Listeneditor im Reiter Projekt
  const [listsMsg, setListsMsg] = useState("");
  const [sendMsg, setSendMsg] = useState(""); // Hinweis nach „Senden“
  const [projBusy, setProjBusy] = useState(false);
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
        try { const d = await sbLoadLists(); if (d) setLists((cur) => ({ ...defaultLists(), ...d, personen: cur.personen || [], nuAnsprech: cur.nuAnsprech || {} })); } // gemeinsame Listen
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
  const setListKey = (key, value) => setListKeys({ [key]: value });
  const setListKeys = (patch) => setLists((l) => {
    const n = { ...l, ...patch };
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
    if (SB_ON) { try { const d = await sbLoadLists(); const n = { ...defaultLists(), ...(d || {}), personen: lists.personen || [], nuAnsprech: lists.nuAnsprech || {} }; setLists(n); persistLists(n); } catch (e) { setListsErr("Gemeinsame Listen konnten nicht geladen werden."); } }
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
  const addFotos = async (files, stillId, posId) => {
    const neu = []; const data = {};
    for (const file of Array.from(files || [])) {
      try { const url = await fileToJpeg(file); const id = uid(); data[id] = url; neu.push({ id, name: file.name, text: "", ...(stillId ? { stillId } : {}), ...(posId ? { posId } : {}) }); try { if (window.storage) await window.storage.set("btb_foto_" + id, url); } catch (e) {} } catch (e) {}
    }
    if (neu.length === 0) return;
    setFotoData((d) => ({ ...d, ...data }));
    const n = { ...day, fotos: [...(day.fotos || []), ...neu] }; setDay(n); persist({ day: n });
  };
  const delFoto = async (id) => { delDayRow("fotos", id); try { if (window.storage) await window.storage.delete("btb_foto_" + id); } catch (e) {} };
  const stillValid = (d) => (d.stillstand || []).filter((x) => x.start || x.ende || x.grund || x.sektion);
  const fotosOf = (d) => (d.fotos || []).map((f) => ({ ...f, data: fotoData[f.id], still: f.stillId ? stillValid(d).findIndex((x) => x.id === f.stillId) + 1 : 0 })).filter((f) => f.data);
  const dropPosFotos = (id) => {
    (day.fotos || []).filter((f) => f.posId === id).forEach((f) => { try { if (window.storage) window.storage.delete("btb_foto_" + f.id); } catch (e) {} });
    const n = { ...day, fotos: (day.fotos || []).filter((f) => f.posId !== id) }; setDay(n); persist({ day: n }); return n;
  };
  const cancelWizard = () => { if (!positions.some((p) => p.id === draft.id)) dropPosFotos(draft.id); setView("home"); };
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
  const ebene5Opts = useMemo(() => (lists.ebene5 || []).filter(Boolean).map((s) => ({ value: s, label: s })), [lists.ebene5]);
  const ebene6Opts = useMemo(() => (lists.ebene6 || []).filter(Boolean).map((s) => ({ value: s, label: s })), [lists.ebene6]);
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
  const rq = Object.fromEntries(LEVELS.map((lv) => [lv.key, !!prof[lv.akt] && !!pf[lv.key]])); // Pflicht gilt nur bei aktiver Ebene
  const lvLab = (k) => { const lv = LEVELS.find((x) => x.key === k); return prof[lv.lab] || lv.def; };
  const missA = [
    rq.sektion && !draft.sektion && lvLab("sektion"),
    rq.vorhaben && !(draft.vorhaben || draft.vorhabenUeb === "Ja") && lvLab("vorhaben"),
    rq.taetigkeit && !draft.taetigkeit && lvLab("taetigkeit"),
    rq.bas && !draft.bas && lvLab("bas"),
    rq.ebene5 && !draft.ebene5 && lvLab("ebene5"),
    rq.ebene6 && !draft.ebene6 && lvLab("ebene6"),
  ].filter(Boolean);
  const missB = [
    pf.beschreibung && !descOk && "Beschreibung",
    pf.menge && !mengeOk && "Menge (> 0)",
    (pf.menge || mengeOk) && !draft.einheit && "Einheit",
  ].filter(Boolean);
  const stepValid = [
    missA.length === 0,
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
  const deletePosition = (id) => { const nd = dropPosFotos(id); const list = positions.filter((p) => p.id !== id); setPositions(list); persist({ positions: list, day: nd }); };
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
  const loadFotoData = async (d) => {
    const out = [];
    for (const f of d.fotos || []) {
      let data = fotoData[f.id];
      if (!data) { try { const r = window.storage && await window.storage.get("btb_foto_" + f.id); data = (r && r.value) || ""; } catch (e) { data = ""; } }
      if (data) out.push({ ...f, data, still: f.stillId ? stillValid(d).findIndex((x) => x.id === f.stillId) + 1 : 0 });
    }
    return out;
  };
  const exportProjectPdf = async () => {
    if (archive.length === 0 || projBusy) return;
    setProjBusy(true);
    try {
      const recs = archive.map((a) => ({ day: a.day, positions: a.positions })).sort((a, b) => String(a.day.datum).localeCompare(String(b.day.datum)));
      if (positions.length > 0) recs.push({ day, positions });
      const entries = [];
      for (const r of recs) entries.push({ ...r, fotos: await loadFotoData(r.day) });
      const blob = await buildProjectPdfBlob(entries, basName, day.projekt || entries[0].day.projekt);
      const pj = (day.projekt || entries[0].day.projekt || "Projekt").replace(/[^\wÄÖÜäöüß-]+/g, "_");
      downloadBlob(blob, `Bautagesberichte_${pj}_${entries[0].day.datum}_${entries[entries.length - 1].day.datum}.pdf`);
    } catch (e) { console.error(e); }
    setProjBusy(false);
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
    const TABS = [["projekt", "Projekt"], ["personal", "Personal"], ["nachunternehmer", "Nachunternehmer"], ["geraete", "Geräte"]];
    return (
      <Shell>
        <TopBar title="Einstellungen" subtitle={session ? `Admin: ${session.email}` : localEdit ? "Listen nur auf diesem Gerät" : SB_ON ? "Anmeldung für gemeinsame Listen" : "Lokaler Modus"}
          left={<button onClick={() => setView("home")} className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-white hover:bg-white/20" aria-label="Zurück"><ChevronLeft size={18} /></button>}
          right={session ? <button onClick={doLogout} className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"><LogOut size={15} /> <span className="hidden sm:inline">Abmelden</span></button> : null} />
        <main className={`mx-auto ${!needLogin && ((listsTab === "projekt" && lvlOpen === "bas") || listsTab === "geraete" || listsTab === "personal") ? "max-w-6xl" : "max-w-4xl"} space-y-4 px-3 py-4 sm:px-4 sm:py-6`}>
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
                  <button key={k} onClick={() => setListsTab(k)} className={`min-h-[40px] rounded-sm border px-3 text-sm font-semibold transition ${listsTab === k ? "border-[#0F1E46] bg-[#DAE1F0] text-[#0F1E46]" : "border-[#C8D2E6] bg-white text-[#0F1E46]/70 hover:bg-[#DAE1F0]"}`}>{l}{k !== "projekt" && <> <span className="text-[#677BA4]">{k === "personal" ? (lists.personen || []).length : k === "geraete" ? lists.geraete.length : (lists[k] || []).filter((x) => x.trim()).length}</span></>}</button>
                ))}
              </div>

              {listsTab === "projekt" && <ProjektTab prof={prof} pf={pf} lists={lists} open={lvlOpen} setOpen={setLvlOpen} onProfil={setProfil} onPflicht={(k, v) => setListKey("pflicht", { ...pf, [k]: v })} onList={setListKey} onTyp={applyTyp} />}
              {listsTab === "personal" && <PersonalTab lists={lists} pf={pf} onList={setListKey} onPflicht={(k, v) => setListKey("pflicht", { ...pf, [k]: v })} />}
              {listsTab === "nachunternehmer" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><div className="mb-4 border-l-4 border-[#FAD200] bg-[#DAE1F0] p-3 text-sm text-[#0F1E46]">Ohne Auswahl gilt die Leistung als Eigenleistung. Ansprechpartner werden nur auf diesem Gerät und in der Excel-Datei gespeichert, nicht auf dem gemeinsamen Server.</div><NuTable names={lists.nachunternehmer || []} ansprech={lists.nuAnsprech || {}} onChange={(n, a) => setListKeys({ nachunternehmer: n, nuAnsprech: a })} /></section>}
              {listsTab === "geraete" && <section className="min-w-0 rounded-sm border border-[#C8D2E6] bg-white p-4"><PflichtBar frage="Muss jede Leistung mindestens ein Gerät enthalten?" value={pf.geraete} onChange={(v) => setListKey("pflicht", { ...pf, geraete: v })} /><GeraeteFlat geraete={lists.geraete} info={lists.geraeteInfo || EMPTY_OBJ} spalten={lists.geraeteSpalten} onChange={setListKeys} /></section>}
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
          left={<button onClick={cancelWizard} className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-white hover:bg-white/20" aria-label="Abbrechen"><X size={18} /></button>} />
        <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <H>Leistung</H>
            <div className="space-y-4 rounded-sm border border-[#C8D2E6] bg-white p-4 sm:p-5">
              {prof.ort1Aktiv && <Field label={lvLab("sektion") + (rq.sektion ? " *" : "")}><Combo value={draft.sektion} onChange={(v) => setD("sektion", v)} options={sektOpts} /></Field>}
              {(() => { const si = prof.ort1Aktiv && sektInfo(draft.sektion); return si ? (
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
                  <Label>{lvLab("vorhaben") + (rq.vorhaben ? " *" : "")}</Label>
                  {ort2Opts.length > 6 ? (
                    <Combo value={draft.vorhabenUeb === "Ja" ? prof.ort2UebLabel : draft.vorhaben} options={ort2Opts.map((o) => ({ value: o, label: o }))}
                      onChange={(v) => setDraft((d) => (prof.ort2Ueb && v === prof.ort2UebLabel ? { ...d, vorhaben: "", vorhabenUeb: "Ja" } : { ...d, vorhaben: v, vorhabenUeb: "Nein" }))} />
                  ) : (
                  <div className="flex flex-wrap gap-2">
                    {(prof.ort2Optionen || []).filter((x) => x && x.trim()).map((o) => (
                      <button key={o} onClick={() => setDraft((d) => ({ ...d, vorhaben: o, vorhabenUeb: "Nein" }))} className={`min-h-[46px] min-w-[96px] flex-1 break-words rounded-sm border px-3 text-sm font-semibold transition ${draft.vorhabenUeb !== "Ja" && draft.vorhaben === o ? "border-[#0F1E46] bg-[#DAE1F0] text-[#0F1E46]" : "border-[#C8D2E6] bg-white text-[#0F1E46]/70 hover:bg-[#DAE1F0]"}`}>{o}</button>
                    ))}
                    {prof.ort2Ueb && <button onClick={() => setDraft((d) => ({ ...d, vorhaben: "", vorhabenUeb: "Ja" }))} className={`min-h-[46px] min-w-[96px] flex-1 break-words rounded-sm border px-3 text-sm font-semibold transition ${draft.vorhabenUeb === "Ja" ? "border-[#0F1E46] bg-[#DAE1F0] text-[#0F1E46]" : "border-[#C8D2E6] bg-white text-[#0F1E46]/70 hover:bg-[#DAE1F0]"}`}>{prof.ort2UebLabel}</button>}
                  </div>
                  )}
                  {draft.vorhaben && draft.vorhabenUeb !== "Ja" && !(prof.ort2Optionen || []).includes(draft.vorhaben) && <p className="mt-1 text-xs text-[#0F1E46]/70">Bisher gewählt: {draft.vorhaben}</p>}
                </div>
              )}
              {prof.stationAktiv && <Field label={prof.station} hint="(freiwillig)"><input className={inputCls} value={draft.station || ""} onChange={(e) => setD("station", e.target.value)} placeholder="z. B. 12+350 – 12+480" /></Field>}
              {prof.taetAktiv && <Field label={lvLab("taetigkeit") + (rq.taetigkeit ? " *" : "")}><Combo value={draft.taetigkeit} onChange={(v) => setD("taetigkeit", v)} options={taetOpts} /></Field>}
              <Field label="Ausführung durch"><NuSelect value={draft.nachunternehmer || ""} names={nuNames} onChange={(v) => { setD("nachunternehmer", v); rememberNu(v); }} /></Field>
              {prof.basAktiv && <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label hint="(Leistungs-/Kostenschlüssel)">{lvLab("bas") + (rq.bas ? " *" : "")}</Label>
                  {draft.bas && <button onClick={() => setBasModal(draft.bas)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F1E46] underline"><Info size={13} /> Was ist enthalten?</button>}
                </div>
                <Combo value={draft.bas} onChange={(v) => setD("bas", v)} options={basOpts} />
              </div>}
              {prof.basAktiv && draft.bas && (() => { const m = basMeta(draft.bas); return (m.lv || m.desc || m.wann) ? (
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
              {prof.e5Aktiv && <Field label={lvLab("ebene5") + (rq.ebene5 ? " *" : "")}><Combo value={draft.ebene5 || ""} onChange={(v) => setD("ebene5", v)} options={ebene5Opts} /></Field>}
              {prof.e6Aktiv && <Field label={lvLab("ebene6") + (rq.ebene6 ? " *" : "")}><Combo value={draft.ebene6 || ""} onChange={(v) => setD("ebene6", v)} options={ebene6Opts} /></Field>}
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
                    <div className="mt-3"><Field label="Namen" hint="(optional)"><input className={inputCls} value={p.name || ""} onChange={(e) => updRow("personal", p.id, { name: e.target.value })} placeholder="z. B. Müller, Popescu" /></Field>
                      {(() => { const all = (lists.personen || []).filter((x) => x.name && x.name.trim()); const match = all.filter((x) => x.rolle && x.rolle === p.rolle); const chips = match.length ? match : all; if (!chips.length) return null;
                        const have = (p.name || "").split(",").map((x) => x.trim()).filter(Boolean);
                        return (<div data-chips className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-auto">{chips.map((x, k) => { const nm = x.name.trim(); const on = have.includes(nm); return (
                          <button key={k} type="button" disabled={on} onClick={() => updRow("personal", p.id, { name: [...have, nm].join(", ") })} className={`min-h-[34px] rounded-sm border px-2.5 text-xs font-semibold transition ${on ? "border-[#C8D2E6] bg-[#DAE1F0] text-[#677BA4]" : "border-[#0F1E46] bg-white text-[#0F1E46] hover:bg-[#DAE1F0]"}`}>{on ? "✓ " : "+ "}{nm}</button>); })}</div>); })()}
                    </div>
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
              <H>Fotos zur Leistung (freiwillig)</H>
            <div className="rounded-sm border border-[#C8D2E6] bg-white p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(day.fotos || []).filter((f) => f.posId === draft.id).map((f) => (
                  <div key={f.id} className="rounded-sm border border-[#C8D2E6] bg-white p-1.5" data-posfoto={f.id}>
                    <div className="relative">
                      {fotoData[f.id] ? <img src={fotoData[f.id]} alt={f.text || f.name} className="h-24 w-full rounded-sm object-cover" /> : <div className="flex h-24 items-center justify-center bg-[#DAE1F0] text-xs text-[#677BA4]">lädt …</div>}
                      <button onClick={() => delFoto(f.id)} className="absolute right-1 top-1 rounded-sm bg-white p-1 text-[#C62828]" aria-label="Foto löschen"><Trash2 size={13} /></button>
                    </div>
                    <input className="mt-1.5 min-h-[34px] w-full rounded-sm border border-[#C8D2E6] px-2 text-xs text-[#0F1E46] outline-none focus:border-[#0F1E46]" value={f.text || ""} onChange={(e) => updDayRow("fotos", f.id, { text: e.target.value })} placeholder="Beschreibung" />
                  </div>
                ))}
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-[#FAD200] px-2.5 py-1.5 text-xs font-bold text-[#0F1E46] hover:bg-[#FCE466]"><Camera size={13} /> Foto zur Leistung
                <input type="file" accept="image/*" multiple className="hidden" data-pos={draft.id} onChange={(e) => { addFotos(e.target.files, undefined, draft.id); e.target.value = ""; }} />
              </label>
            </div>
            </div>
          </div>
        </main>
        <div className="sticky bottom-0 border-t border-[#C8D2E6] bg-white print:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:px-4">
            <button onClick={cancelWizard} className="rounded-sm border border-[#0F1E46] bg-white px-4 py-3 text-sm font-semibold text-[#0F1E46] hover:bg-[#DAE1F0]">Abbrechen</button>
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
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <button onClick={exportProjectPdf} disabled={archive.length === 0 || projBusy} className={`inline-flex items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-bold ${archive.length === 0 || projBusy ? "cursor-not-allowed bg-[#B1BFD8] text-white" : "bg-[#FAD200] text-[#0F1E46] hover:bg-[#FCE466]"}`}><FileText size={16} /> {projBusy ? "PDF wird erstellt …" : "Projekt-PDF (alle Berichte)"}</button>
            {archive.length === 0 && <span className="text-xs text-[#0F1E46]/70">Erst einen Tag mit „Tag abschließen“ ablegen.</span>}
          </div>
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
            <button onClick={async () => { if (offenP > 0) return; setSendMsg(""); const r = await shareReport(d, ps, basName, fotosOf(d)); setSendMsg(r === "eml" ? `E-Mail-Entwurf „${fileBase(d)}.eml“ wurde heruntergeladen. Datei öffnen – Outlook zeigt eine neue E-Mail mit PDF, Excel und XML im Anhang. Empfänger eintragen und senden.` : r === "download" ? "PDF, Excel und XML wurden heruntergeladen. Bitte an eine E-Mail anhängen." : ""); }} disabled={offenP > 0} className={`inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-bold ${offenP > 0 ? "cursor-not-allowed bg-[#B1BFD8] text-white" : "bg-[#FAD200] text-[#0F1E46] hover:bg-[#FCE466]"}`}><Share2 size={16} /> Senden</button>
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
                  <span className="tabular-nums text-sm font-bold text-[#0F1E46]">{i + 1}.</span>
                  <b className="text-[#0F1E46]">{p.bas ? basName(p.bas) : "Ohne BAS"}</b>
                  {p.bas && <span className="rounded-sm bg-[#0F1E46] px-2 py-0.5 tabular-nums text-xs font-bold text-[#FAD200]">{p.bas}</span>}
                  <span className="text-sm text-[#0F1E46]/70">{posZeile(p)}{p.nachunternehmer ? ` · NU: ${p.nachunternehmer}` : ""}</span>
                  {num(p.menge) > 0 && <span className="ml-auto tabular-nums text-sm font-semibold text-[#0F1E46]">{fmt(num(p.menge))} {p.einheit || ""}</span>}
                </div>
                {p.beschreibung && <p className="mb-3 text-sm text-[#0F1E46]/70">{p.beschreibung}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <MiniTable head={["Rolle", "Anz.", "Std."]} rows={p.personal.filter((x) => x.rolle).map((x) => [x.rolle + (x.name ? ` – ${x.name}` : ""), x.anzahl, x.stunden])} foot={`${fmt(phOf(p))} Pers.-Std.`} />
                  <MiniTable head={["Gerät", "Anz.", "Std."]} rows={p.geraete.filter((x) => x.typ).map((x) => [geraetLabel(x), x.anzahl, x.stunden])} foot={`${fmt(ghOf(p))} Std.`} />
                </div>
                {(d.fotos || []).filter((f) => f.posId === p.id).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {(d.fotos || []).filter((f) => f.posId === p.id).map((f) => (
                      <figure key={f.id} className="break-inside-avoid">
                        {fotoData[f.id] ? <img src={fotoData[f.id]} alt={f.text || f.name} className="w-full rounded-sm border border-[#C8D2E6]" /> : <div className="flex h-28 items-center justify-center bg-[#DAE1F0] text-xs text-[#677BA4]">Foto nicht auf diesem Gerät</div>}
                        <figcaption className="mt-1 text-xs text-[#0F1E46]"><span className="font-bold">Leistung {i + 1}:</span> {f.text || f.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
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

            {(d.fotos || []).filter((f) => !f.stillId && !f.posId).length > 0 && (
              <div className="mt-6">
                <h2 className="mb-2 border-b border-[#C8D2E6] pb-1 text-sm font-bold uppercase tracking-wider text-[#0F1E46]">Fotos</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(d.fotos || []).filter((f) => !f.stillId && !f.posId).map((f, i) => (
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
                  <th className="w-9 px-2 py-1">Nr.</th><th className="px-2 py-1">Leistung</th><th className="hidden w-24 px-2 py-1 text-right sm:table-cell">Menge</th><th className="w-[34%] px-2 py-1 sm:w-44">Ausführung durch</th><th className="w-[76px] px-1 py-1" />
                </tr></thead>
                <tbody>
                  {positions.map((p, pi) => (
                    <tr key={p.id} onClick={() => startEdit(p)} className={`cursor-pointer border-b border-[#C8D2E6] align-top hover:bg-[#DAE1F0]/40 ${p.pruefen ? "text-[#C62828]" : "text-[#0F1E46]"}`}>
                      <td className={`px-2 py-2 font-bold tabular-nums ${p.pruefen ? "border-l-4 border-[#C62828]" : ""}`}>{pi + 1}</td>
                      <td className="px-2 py-2">
                        <p className="break-words font-semibold">{p.bas ? basName(p.bas) : "Ohne BAS"}</p>
                        {p.pruefen && <p className="text-[11px] font-bold uppercase tracking-wider">Übernommen – bitte prüfen</p>}
                        <p className={`text-xs ${p.pruefen ? "" : "text-[#0F1E46]/70"}`}>{p.bas && <span className="mr-1.5 rounded-sm bg-[#0F1E46] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#FAD200]">{p.bas}</span>}{posZeile(p)}</p>
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
              <div className="flex items-center gap-2 border-b border-[#C8D2E6] px-4 py-2.5"><Camera size={16} className="text-[#0F1E46]" /><h2 className="text-sm font-bold">Fotos</h2><span className="text-xs text-[#677BA4]">({(day.fotos || []).filter((f) => !f.stillId && !f.posId).length})</span></div>
              <div className="p-4">
                {(day.fotos || []).filter((f) => !f.stillId && !f.posId).length === 0 && <p className="mb-3 text-sm text-[#677BA4]">Noch keine Fotos.</p>}
                <div className="grid grid-cols-2 gap-3">
                  {(day.fotos || []).filter((f) => !f.stillId && !f.posId).map((f) => (
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
            <button onClick={() => exportExcel(day, positions, basName)} className="inline-flex items-center gap-2 rounded-sm bg-[#FAD200] px-4 py-2.5 text-sm font-bold text-[#0F1E46] hover:bg-[#FCE466]"><FileSpreadsheet size={16} /> Excel exportieren</button>
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
