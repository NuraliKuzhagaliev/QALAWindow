import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  LocateFixed,
  Clock3,
  Footprints,
  Leaf,
  Coffee,
  Landmark,
  Sparkles,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Download,
  FolderOpen,
  ShieldCheck,
  Wind,
  CloudSun,
  Users,
  SlidersHorizontal,
  Bookmark,
  FileText,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Navigation,
  Plus,
  Minus,
} from "lucide-react";
import {
  RequestSchema,
  astanaInput,
  isoAstana,
  formatTime,
  inCity,
  type Coord,
  type Snapshot,
  type PlanRequest,
  type PlanResult,
  type POI,
} from "../../packages/domain/index";
import {
  parseChallenge,
  validatePack,
  type Pack,
} from "../../packages/domain/imports";
import { WalkingGraph, type Network } from "../../packages/planner/routes";
import {
  fetchCityWeather,
  WeatherSnapshotSchema,
  weatherFreshMs,
  type WeatherSnapshot,
} from "../../packages/domain/weather";
import { resolveLandmark } from "../../packages/retrieval/landmarks";
import { solve, planDiff } from "../../packages/planner/index";
import { copy, type Language } from "./i18n";
import { saveLocal, listLocal, deleteLocal, clearLocal } from "./storage";
import {
  applyExplanation,
  ExplanationPatchSchema,
} from "../../packages/domain/explanations";
import { version as appVersion } from "../../package.json";
const MapView = lazy(() => import("./MapView"));
const api =
  window.qalaNative?.apiBase || import.meta.env.VITE_PUBLIC_API_URL || "";
const devicePlanning =
  import.meta.env.VITE_STATIC_HOST === "true" ||
  Boolean(window.qalaNative && !api);
const desktopDownload = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as
  string | undefined;
const desktopChecksum = import.meta.env.VITE_DESKTOP_CHECKSUM_URL as
  string | undefined;
const session = crypto.randomUUID();
const minute = (s: number) => Math.ceil(s / 60);
const interestOptions = [
  { id: "explore", icon: Sparkles },
  { id: "coffee", icon: Coffee },
  { id: "nature", icon: Leaf },
  { id: "culture", icon: Landmark },
] as const;
async function jsonFetch(
  path: string,
  options: RequestInit = {},
  timeout = 35000,
) {
  const response = await fetch(api + path, {
    ...options,
    signal: AbortSignal.timeout(timeout),
    headers: {
      "Content-Type": "application/json",
      "x-qala-session": session,
      ...options.headers,
    },
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Service unavailable");
  return value;
}
export default function App() {
  const [language, setLanguage] = useState<Language>("en"),
    t = copy[language];
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [graph, setGraph] = useState<WalkingGraph | null>(null),
    [loadError, setLoadError] = useState("");
  const [sourceLocationName, setSourceLocationName] = useState("");
  const [landmarkQuery, setLandmarkQuery] = useState("");
  const [anchor, setAnchor] = useState("0"),
    [custom, setCustom] = useState<Coord | null>(null),
    [coordinateText, setCoordinateText] = useState(""),
    [selecting, setSelecting] = useState(false),
    [endAnchor, setEndAnchor] = useState("same");
  const [startInput, setStartInput] = useState(astanaInput()),
    [deadlineInput, setDeadlineInput] = useState(
      astanaInput(new Date(Date.now() + 60 * 60000)),
    ),
    [interests, setInterests] = useState(["explore", "coffee"]),
    [query, setQuery] = useState("");
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [advanced, setAdvanced] = useState(false),
    [buffer, setBuffer] = useState(5),
    [outdoor, setOutdoor] = useState(90),
    [maxWalk, setMaxWalk] = useState(30),
    [stepFree, setStepFree] = useState<PlanRequest["stepFree"]>("off"),
    [breakPreference, setBreakPreference] =
      useState<PlanRequest["breakPreference"]>("none");
  const [sockets, setSockets] = useState(false),
    [quiet, setQuiet] = useState(false),
    [child, setChild] = useState(false),
    [freeOnly, setFreeOnly] = useState(false),
    [requireHours, setRequireHours] = useState(false),
    [flight, setFlight] = useState(false),
    [groupSize, setGroupSize] = useState(1),
    [people, setPeople] = useState<PlanRequest["people"]>([]);
  const [result, setResult] = useState<PlanResult | null>(null),
    [pending, setPending] = useState(false),
    [ai, setAI] = useState<"idle" | "loading" | "error">("idle"),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(0),
    [receipt, setReceipt] = useState<POI | null>(null),
    [panel, setPanel] = useState<
      "privacy" | "saved" | "weather" | "judge" | "desktop" | null
    >(null);
  const [weatherSnapshot, setWeather] = useState<WeatherSnapshot | null>(null),
    [weatherError, setWeatherError] = useState(false),
    [planBLimit, setPlanBLimit] = useState(15),
    [difference, setDifference] = useState<ReturnType<typeof planDiff> | null>(
      null,
    ),
    [simulation, setSimulation] = useState(false),
    [closedIds, setClosedIds] = useState<string[]>([]),
    [challenge, setChallenge] = useState(""),
    [challengeApplied, setChallengeApplied] = useState(false),
    [importMessage, setImportMessage] = useState(""),
    [packs, setPacks] = useState<Pack[]>([]),
    [clearing, setClearing] = useState(false),
    [clearState, setClearState] = useState<"idle" | "done" | "failed">("idle"),
    [exactConsent, setExactConsent] = useState(false),
    [savedNotice, setSavedNotice] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine),
    [loadedPack, setLoadedPack] = useState<Pack | null>(null);
  const generation = useRef(0),
    upload = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    lastRequest = useRef<PlanRequest | null>(null);
  const weatherLimitEdited = useRef(false);
  const weather =
    weatherSnapshot &&
    Date.now() - Date.parse(weatherSnapshot.retrieved_at) < weatherFreshMs
      ? weatherSnapshot
      : null;
  useEffect(() => {
    const load = async () => {
      try {
        const [s, n] = await Promise.all([
          fetch("./data/pois.json").then((r) => {
            if (!r.ok) throw new Error("Dataset missing");
            return r.json();
          }),
          fetch("./data/network.json").then((r) => {
            if (!r.ok) throw new Error("Network missing");
            return r.json();
          }),
        ]);
        setSnapshot(s);
        setGraph(new WalkingGraph(n as Network));
      } catch (e) {
        setLoadError((e as Error).message);
      }
    };
    load();
    listLocal()
      .then(setPacks)
      .catch(() => {});
    const on = () => setOffline(false),
      off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (location.hash === "#judge") setPanel("judge");
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if ((panel || receipt) && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    else if (!panel && !receipt && dialog.current?.open) dialog.current.close();
  }, [panel, receipt]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    if (panel !== "weather" || weather) return;
    setWeatherError(offline);
    if (offline) return;
    let active = true;
    const loadForecast = async () => {
      let value: WeatherSnapshot;
      try {
        if (devicePlanning) throw new Error("Direct forecast is configured");
        const response = await fetch(api + "/api/weather", {
          signal: AbortSignal.timeout(5500),
        });
        if (!response.ok) throw new Error("Forecast proxy unavailable");
        value = WeatherSnapshotSchema.parse(await response.json());
      } catch {
        if (!active) return;
        try {
          value = await fetchCityWeather(4000);
        } catch {
          if (active) setWeatherError(true);
          return;
        }
      }
      if (!active) return;
      setWeather(value);
      if (!weatherLimitEdited.current) {
        setPlanBLimit(
          value.current.apparent_temperature < -5 ||
            value.current.wind_speed_10m > 25 ||
            value.current.precipitation > 0
            ? 15
            : 30,
        );
      }
    };
    void loadForecast();
    return () => {
      active = false;
    };
  }, [panel, offline, weather]);
  const start =
    custom ??
    snapshot?.anchors[Number(anchor)]?.coordinates ??
    ([71.4, 51.1] as Coord);
  const end =
    endAnchor === "same"
      ? start
      : (snapshot?.anchors[Number(endAnchor)]?.coordinates ?? start);
  const startMillis = Date.parse(isoAstana(startInput));
  const minutes = (Date.parse(isoAstana(deadlineInput)) - startMillis) / 60_000;
  const setWindow = (value: number) => {
    if (!Number.isFinite(startMillis)) {
      setAdvanced(true);
      return;
    }
    setDeadlineInput(astanaInput(new Date(startMillis + value * 60_000)));
    invalidate();
  };
  const invalidate = () => {
    generation.current++;
    setAI("idle");
    setLoadedPack(null);
    setResult(null);
    setPending(false);
  };
  function chooseStart(value: string) {
    setAnchor(value);
    setCustom(null);
    setSourceLocationName("");
    setExactConsent(false);
    setSelecting(false);
    invalidate();
  }
  function pick(c: Coord) {
    if (snapshot && !inCity(c, snapshot.boundary.bounds)) {
      setError("Position outside Astana coverage bounds");
      return;
    }
    setCustom(c);
    setSourceLocationName("");
    setCoordinateText(c.map((x) => x.toFixed(6)).join(", "));
    setSelecting(false);
    setExactConsent(false);
    invalidate();
  }
  function group(value: number) {
    setGroupSize(value);
    setPeople(
      Array.from(
        { length: value === 1 ? 0 : value },
        (_, i) =>
          people[i] ?? {
            id: `person-${i + 1}`,
            interests: [interestOptions[i % 4].id],
            stepFree: "off",
            sockets: false,
            quiet: false,
            child: false,
            maxWalkMinutes: maxWalk,
          },
      ),
    );
    invalidate();
  }
  async function locate() {
    setError("");
    if (!navigator.geolocation) {
      setError(t.gpsDenied);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => pick([p.coords.longitude, p.coords.latitude]),
      () => setError(t.gpsDenied),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  function updatePerson(
    id: string,
    changes: Partial<PlanRequest["people"][number]>,
  ) {
    setPeople((current) =>
      current.map((person) =>
        person.id === id ? { ...person, ...changes } : person,
      ),
    );
    invalidate();
  }
  function makeRequest(overrides: Partial<PlanRequest> = {}): PlanRequest {
    return RequestSchema.parse({
      query,
      start,
      end,
      startTime: isoAstana(startInput),
      deadline: isoAstana(deadlineInput),
      interests,
      language,
      movement: "walking",
      bufferMinutes: buffer,
      outdoorMinutes: outdoor,
      maxWalkMinutes: maxWalk,
      maxDistanceMetres: 5000,
      stepFree,
      breakPreference,
      sockets,
      quiet,
      child,
      freeOnly,
      requireHours,
      people,
      closedIds,
      simulation,
      usableAirportBudget: flight,
      ...overrides,
    });
  }
  async function plan(overrides: Partial<PlanRequest> = {}, isPlanB = false) {
    if (!snapshot || !graph) return;
    const ticket = ++generation.current;
    setPending(true);
    setError("");
    setAI("idle");
    setLoadedPack(null);
    setSavedNotice("");
    let request: PlanRequest;
    try {
      request = makeRequest(overrides);
      lastRequest.current = request;
      if (
        !inCity(request.start, snapshot.boundary.bounds) ||
        !inCity(request.end, snapshot.boundary.bounds)
      )
        throw new Error("Location outside collected Astana coverage");
      let data: PlanResult;
      let server = false;
      try {
        if (devicePlanning || offline || request.people.length > 0)
          throw new Error("Local mode");
        data = await jsonFetch("/api/plan", {
          method: "POST",
          body: JSON.stringify({
            request,
            challenge: challengeApplied ? challenge : undefined,
          }),
        });
        server = true;
      } catch {
        const pois = challengeApplied
          ? parseChallenge(challenge, snapshot.boundary.bounds)
          : snapshot.pois;
        data = solve(pois, request, graph, snapshot.version);
        data.warnings.push(
          request.people.length
            ? t.groupLocal
            : devicePlanning
              ? t.plannedLocally
              : t.apiFallback,
        );
      }
      if (ticket !== generation.current) return;
      if (isPlanB) setDifference(planDiff(result?.plan ?? null, data.plan));
      else setDifference(null);
      setResult(data);
      setSelected(0);
      setPending(false);
      if (server && data.plan && !challengeApplied) {
        setAI("loading");
        try {
          const generated = ExplanationPatchSchema.parse(
            await jsonFetch(
              "/api/explain",
              {
                method: "POST",
                body: JSON.stringify({ requestId: data.requestId }),
              },
              20000,
            ),
          );
          if (ticket === generation.current) {
            setResult(applyExplanation(data, generated));
            setAI("idle");
          }
        } catch {
          if (ticket === generation.current) setAI("error");
        }
      }
    } catch (e) {
      if (ticket === generation.current) setError((e as Error).message);
    } finally {
      if (ticket === generation.current) setPending(false);
    }
  }
  function changeLanguage(value: Language) {
    setLanguage(value);
    invalidate();
    if (result) setResult(null);
  }
  async function save() {
    if (!snapshot || !result?.plan) return;
    const isPublic = !custom || Boolean(sourceLocationName);
    if (!isPublic && !exactConsent) {
      setError(t.packConsent);
      return;
    }
    const pack: Pack = {
      format: "qala-route-pack",
      version: 1,
      saved_at: new Date().toISOString(),
      attribution: snapshot.attribution,
      datasetVersion: result.datasetVersion,
      result,
      publicStart: isPublic,
    };
    setError("");
    setSavedNotice("");
    try {
      validatePack(pack);
      await saveLocal(pack);
      setPacks(await listLocal());
    } catch {
      setError(t.saveFailed);
      return;
    }
    setSavedNotice(t.savedLabel);
    try {
      const text = JSON.stringify(pack, null, 2);
      if (window.qalaNative) {
        const exported = await window.qalaNative.save(text);
        setSavedNotice(exported ? t.exported : t.exportCancelled);
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(
          new Blob([text], { type: "application/json" }),
        );
        a.download = `QALA-${pack.saved_at.slice(0, 10)}.qala.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } catch {
      setError(t.exportFailed);
    }
  }
  function loadPack(pack: Pack) {
    generation.current++;
    setResult({
      ...pack.result,
      mode: "local_solver",
      provider: null,
      model: null,
      warnings: [...pack.result.warnings, t.stale],
    });
    setLoadedPack(pack);
    setSelected(0);
    setPanel(null);
    setAI("idle");
    setDifference(null);
    setPending(false);
  }
  async function openPack(text: string) {
    try {
      if (new TextEncoder().encode(text).length > 5000000)
        throw new Error("Pack exceeds 5 MB");
      const pack = validatePack(JSON.parse(text));
      await saveLocal(pack);
      setPacks(await listLocal());
      loadPack(pack);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function openNative() {
    if (window.qalaNative) {
      const text = await window.qalaNative.open();
      if (text) await openPack(text);
    } else upload.current?.click();
  }
  const closeDialog = () => {
    setPanel(null);
    setReceipt(null);
  };
  const currentPlan = result?.plan;
  const toggleInterest = (id: string) => {
    setInterests(
      interests.includes(id)
        ? interests.filter((x) => x !== id)
        : [...interests, id],
    );
    invalidate();
  };
  return (
    <div
      className={`app-shell ${advanced ? "advanced-open" : ""} ${sheetCollapsed ? "sheet-collapsed" : ""}`}
    >
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            closeDialog();
          }}
        >
          <span className="brand-mark">
            <span />
            <span />
          </span>
          <span>
            QALA <span className="brand-window">Window</span>
          </span>
        </a>
        <div className="coverage">
          <span className="status-dot" />
          {t.coverage}
        </div>
        <nav aria-label="Main navigation">
          <div className="languages">
            {(["en", "ru", "kk"] as const).map((l) => (
              <button
                key={l}
                className={l === language ? "active" : ""}
                onClick={() => changeLanguage(l)}
                aria-pressed={l === language}
              >
                {l === "kk" ? "KZ" : l.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className="nav-text privacy-button"
            aria-label={t.privacy}
            onClick={() => {
              setClearState("idle");
              setPanel("privacy");
            }}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{t.privacy}</span>
          </button>
          <button
            className="desktop-button"
            onClick={() => setPanel("desktop")}
          >
            <Download size={15} />
            <span>{t.download}</span>
          </button>
          <button
            className="icon-button saved-button"
            aria-label={t.saved}
            onClick={() => setPanel("saved")}
          >
            <Bookmark size={19} />
          </button>
        </nav>
      </header>
      <main className="workspace">
        <section className="rail" aria-label="Walk planner">
          <button
            className="sheet-toggle"
            aria-expanded={!sheetCollapsed}
            aria-label={
              language === "ru"
                ? "Свернуть или раскрыть планировщик"
                : language === "kk"
                  ? "Жоспарлағышты жинау не ашу"
                  : "Collapse or expand planner"
            }
            onClick={() => setSheetCollapsed(!sheetCollapsed)}
          >
            <span />
            <ChevronDown size={15} className={sheetCollapsed ? "rotate" : ""} />
          </button>
          <div className="rail-scroll">
            <div className="eyebrow">
              <span className="tiny-window" />
              {language === "ru"
                ? "ВАШ ГОРОД. ВАШ ТЕМП."
                : language === "kk"
                  ? "ҚАЛАҢЫЗ. ӨЗ ҚАРҚЫНЫҢЫЗ."
                  : "YOUR CITY. YOUR PACE."}
            </div>
            <h1>
              {t.headline.split("\n").map((s, i) => (
                <span key={i}>{s}</span>
              ))}
            </h1>
            <p className="intro">{t.intro}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                plan();
              }}
            >
              <div className="field-label">
                <label htmlFor="start-point">{t.where}</label>
                <span>01</span>
              </div>
              <div className="location-box">
                <MapPin size={19} />
                <select
                  id="start-point"
                  value={custom ? "custom" : anchor}
                  onChange={(e) => chooseStart(e.target.value)}
                >
                  {snapshot?.anchors.map((a, i) => (
                    <option value={i} key={a.id}>
                      {i === 0 ? "Expo / Mega Silk Way" : "Nurzhol / Bayterek"}{" "}
                      · {a.name}
                    </option>
                  ))}
                  {custom && (
                    <option value="custom">
                      {sourceLocationName || coordinateText}
                    </option>
                  )}
                </select>
              </div>
              <div className="location-actions">
                <button type="button" onClick={locate}>
                  <LocateFixed size={13} />
                  {t.gps}
                </button>
                <button
                  type="button"
                  onClick={() => setSelecting(!selecting)}
                  aria-pressed={selecting}
                >
                  <MapPin size={13} />
                  {t.manual}
                </button>
              </div>
              <div className="field-label">
                <label>{t.minutes}</label>
                <span>02</span>
              </div>
              <div className="time-presets">
                {[30, 45, 60, 90].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={minutes === n ? "active" : ""}
                    onClick={() => setWindow(n)}
                    aria-pressed={minutes === n}
                  >
                    {n}
                    <small>min</small>
                    {minutes === n && <span className="preset-dot" />}
                  </button>
                ))}
              </div>
              <div className="field-label">
                <label>{t.interests}</label>
                <span>03</span>
              </div>
              <div className="interest-grid">
                {interestOptions.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleInterest(id)}
                    className={interests.includes(id) ? "active" : ""}
                    aria-pressed={interests.includes(id)}
                  >
                    <Icon size={16} />
                    {t[id]}
                    {interests.includes(id) && <Check size={12} />}
                  </button>
                ))}
              </div>
              <label className="query-label" htmlFor="query">
                {t.query}
              </label>
              <textarea
                id="query"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  invalidate();
                }}
                maxLength={800}
                placeholder={t.placeholder}
                rows={2}
              />
              <button
                className="advanced-toggle"
                type="button"
                onClick={() => setAdvanced(!advanced)}
                aria-expanded={advanced}
              >
                <SlidersHorizontal size={15} />
                {t.advanced}
                <ChevronDown size={15} className={advanced ? "rotate" : ""} />
              </button>
              {advanced && (
                <div className="advanced">
                  <div className="field-pair">
                    <label>
                      {t.startTime}
                      <input
                        type="datetime-local"
                        value={startInput}
                        onChange={(e) => {
                          setStartInput(e.target.value);
                          invalidate();
                        }}
                        required
                      />
                    </label>
                    <label>
                      {t.returnBy}
                      <input
                        type="datetime-local"
                        value={deadlineInput}
                        onChange={(e) => {
                          setDeadlineInput(e.target.value);
                          invalidate();
                        }}
                        required
                      />
                    </label>
                  </div>
                  <label>
                    {t.end}
                    <select
                      value={endAnchor}
                      onChange={(e) => {
                        setEndAnchor(e.target.value);
                        invalidate();
                      }}
                    >
                      <option value="same">{t.same}</option>
                      {snapshot?.anchors.map((a, i) => (
                        <option key={a.id} value={i}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {language === "ru"
                      ? "Поиск по местным названиям"
                      : language === "kk"
                        ? "Жергілікті атаулардан іздеу"
                        : "Search local names"}
                    <input
                      list="local-landmarks"
                      value={landmarkQuery}
                      onChange={(e) => setLandmarkQuery(e.target.value)}
                      onBlur={() => {
                        if (!landmarkQuery || !snapshot) return;
                        const resolved = resolveLandmark(
                          snapshot,
                          landmarkQuery,
                        );
                        if (resolved.state === "found") {
                          pick(resolved.matches[0].coordinates);
                          setSourceLocationName(resolved.matches[0].label);
                        } else
                          setError(
                            resolved.state === "ambiguous"
                              ? language === "ru"
                                ? "Найдено несколько филиалов. Выберите точку на карте."
                                : language === "kk"
                                  ? "Бірнеше филиал табылды. Картадан нүктені таңдаңыз."
                                  : "Several branches match. Choose a map position or a more specific place."
                              : language === "ru"
                                ? "Название не найдено. Выберите точку на карте."
                                : language === "kk"
                                  ? "Атау табылмады. Картадан нүктені таңдаңыз."
                                  : "No matching local name. Choose a landmark or a map position.",
                          );
                      }}
                    />
                    <datalist id="local-landmarks">
                      {snapshot?.anchors
                        .flatMap((a) => [a.name, ...a.aliases])
                        .map((name, i) => (
                          <option value={name} key={"a" + i} />
                        ))}
                      {snapshot?.pois.map((p) => (
                        <option value={p.name} key={p.id} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    {t.coordinates}
                    <input
                      value={coordinateText}
                      onChange={(e) => {
                        setCoordinateText(e.target.value);
                        setSourceLocationName("");
                      }}
                      placeholder="71.4, 51.1"
                      onBlur={() => {
                        if (coordinateText) {
                          const c = coordinateText.split(",").map(Number);
                          if (c.length === 2 && c.every(Number.isFinite)) {
                            if (
                              c.some(
                                (v, i) => Math.abs(v - start[i]) > 0.000001,
                              )
                            )
                              pick(c as Coord);
                          } else setError("Use longitude, latitude");
                        }
                      }}
                    />
                  </label>
                  <div className="field-pair">
                    <label>
                      {t.buffer}
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={buffer}
                        onChange={(e) => {
                          setBuffer(+e.target.value);
                          invalidate();
                        }}
                      />
                    </label>
                    <label>
                      {t.outdoor}
                      <input
                        type="number"
                        min="0"
                        max="180"
                        value={outdoor}
                        onChange={(e) => {
                          setOutdoor(+e.target.value);
                          invalidate();
                        }}
                      />
                    </label>
                  </div>
                  <label>
                    {t.continuous}
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={maxWalk}
                      onChange={(e) => {
                        setMaxWalk(+e.target.value);
                        invalidate();
                      }}
                    />
                  </label>
                  <div className="field-pair">
                    <label>
                      {t.access}
                      <select
                        value={stepFree}
                        onChange={(e) => {
                          setStepFree(e.target.value as any);
                          invalidate();
                        }}
                      >
                        <option value="off">{t.off}</option>
                        <option value="preferred">{t.preferred}</option>
                        <option value="required">{t.required}</option>
                      </select>
                    </label>
                    <label>
                      {t.breaks}
                      <select
                        value={breakPreference}
                        onChange={(e) => {
                          setBreakPreference(e.target.value as any);
                          invalidate();
                        }}
                      >
                        <option value="none">{t.none}</option>
                        <option value="rest">{t.rest}</option>
                        <option value="indoor">{t.indoor}</option>
                      </select>
                    </label>
                  </div>
                  {(
                    [
                      [sockets, setSockets, t.socket],
                      [quiet, setQuiet, t.quiet],
                      [child, setChild, t.child],
                      [freeOnly, setFreeOnly, t.free],
                      [requireHours, setRequireHours, t.hours],
                      [flight, setFlight, t.flight],
                    ] as const
                  ).map(([v, set, label]) => (
                    <label className="check-row" key={label}>
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={(e) => {
                          set(e.target.checked);
                          invalidate();
                        }}
                      />
                      {label}
                    </label>
                  ))}
                  <label>
                    {t.group}
                    <select
                      value={groupSize}
                      onChange={(e) => group(+e.target.value)}
                    >
                      <option value="1">{t.solo}</option>
                      {[3, 4, 5].map((n) => (
                        <option value={n} key={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  {people.map((person, i) => (
                    <div className="person" key={person.id}>
                      <b>
                        <Users size={13} /> {t.person} {i + 1}
                      </b>
                      <div className="person-interests">
                        {interestOptions.map(({ id }) => (
                          <button
                            type="button"
                            key={id}
                            aria-pressed={person.interests.includes(id)}
                            className={
                              person.interests.includes(id) ? "active" : ""
                            }
                            onClick={() =>
                              updatePerson(person.id, {
                                interests: person.interests.includes(id)
                                  ? person.interests.filter((x) => x !== id)
                                  : [...person.interests, id],
                              })
                            }
                          >
                            {t[id]}
                          </button>
                        ))}
                      </div>
                      <div className="two-columns">
                        <label>
                          {t.access}
                          <select
                            value={person.stepFree}
                            onChange={(e) =>
                              updatePerson(person.id, {
                                stepFree: e.target
                                  .value as PlanRequest["stepFree"],
                              })
                            }
                          >
                            <option value="off">{t.off}</option>
                            <option value="preferred">{t.preferred}</option>
                            <option value="required">{t.required}</option>
                          </select>
                        </label>
                        <label>
                          {t.continuous}
                          <input
                            type="number"
                            min={1}
                            max={90}
                            required
                            value={
                              Number.isFinite(person.maxWalkMinutes)
                                ? person.maxWalkMinutes
                                : ""
                            }
                            onChange={(e) =>
                              updatePerson(person.id, {
                                maxWalkMinutes: e.target.valueAsNumber,
                              })
                            }
                          />
                        </label>
                      </div>
                      {(
                        [
                          ["sockets", t.socket],
                          ["quiet", t.quiet],
                          ["child", t.child],
                        ] as const
                      ).map(([field, label]) => (
                        <label className="check-row" key={field}>
                          <input
                            type="checkbox"
                            checked={person[field]}
                            onChange={(e) =>
                              updatePerson(person.id, {
                                [field]: e.target.checked,
                              })
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <button
                className="primary-button"
                aria-label={pending ? t.planning : t.find}
                disabled={pending || !snapshot || !graph}
                type="submit"
              >
                {pending ? (
                  <RefreshCw className="spin" size={18} />
                ) : (
                  <span className="window-icon">↗</span>
                )}
                {pending ? t.planning : t.find}
                <ArrowRight size={18} />
              </button>
              <p className="under-button">
                <Footprints size={12} /> {t.walking} · {buffer}{" "}
                {t.buffer.split(",")[0]} · Astana UTC+5
              </p>
            </form>
            {(error || loadError) && (
              <div role="alert" className="error-box">
                <AlertTriangle size={16} />
                <span>{error || loadError}</span>
                <button
                  className="icon-button"
                  aria-label={t.close}
                  onClick={() => setError("")}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            {!snapshot && !loadError && <p role="status">{t.loading}</p>}
            <div className="result-section" aria-live="polite">
              {result ? (
                <>
                  <div className="section-title">
                    <h2>{currentPlan ? t.results : t.noResult}</h2>
                    <span className="tiny-number">
                      {currentPlan?.stops.length ?? 0}
                    </span>
                  </div>
                  <div className="mode-row">
                    <span
                      className={`mode-badge ${result.mode === "live_ai" ? "live" : ""}`}
                    >
                      {offline
                        ? t.offline
                        : ai === "loading"
                          ? t.aiLoading
                          : ai === "error"
                            ? t.aiError
                            : result.mode === "live_ai"
                              ? result.trace.some(
                                  (item) =>
                                    item.stage === "generate" &&
                                    item.summary.startsWith("Cached"),
                                )
                                ? t.cached
                                : t.live
                              : t.local}
                    </span>
                    {(simulation || result.simulation || challengeApplied) && (
                      <span className="simulation-badge">{t.simulation}</span>
                    )}
                  </div>
                  {loadedPack && (
                    <div className="notice">
                      {t.lastSync}:{" "}
                      {new Date(loadedPack.saved_at).toLocaleString()}
                      <br />
                      {t.stale}
                    </div>
                  )}
                  {currentPlan ? (
                    <>
                      <Timeline plan={currentPlan} t={t} />
                      <p className="feasibility">
                        <AlertTriangle size={13} />
                        {currentPlan.feasibility === "modeled"
                          ? t.modeled
                          : t.conditional}
                      </p>
                      <div className="cards" aria-label={t.list}>
                        {currentPlan.stops.map((s, i) => (
                          <article
                            className={`place-card ${selected === i ? "selected" : ""}`}
                            key={s.poi.id}
                          >
                            <button
                              className="card-select"
                              onClick={() => setSelected(i)}
                              aria-label={`${i + 1}: ${s.poi.name}`}
                            >
                              <span className="stop-number">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span className="place-category">
                                {s.poi.category}
                              </span>
                              <ArrowUpRight size={17} />
                            </button>
                            <h3>{s.poi.name}</h3>
                            <p className="reason">{s.reason}</p>
                            <div className="card-metrics">
                              <span>
                                <Footprints size={13} />
                                {minute(currentPlan.legs[i].seconds)} min ·{" "}
                                {currentPlan.legs[i].metres} m
                              </span>
                              <span>
                                <Clock3 size={13} />
                                {minute(s.dwellSeconds)} min
                              </span>
                            </div>
                            <div className="hours-status">
                              <span
                                className={`hours-dot ${s.hours === "scheduled" ? "scheduled" : ""}`}
                              />
                              {s.hours === "scheduled"
                                ? t.scheduled
                                : t.unknown}{" "}
                              · {formatTime(s.arrival)}
                            </div>
                            <p className="activity">
                              <span>{t.suggested}</span>
                              {s.activity}
                            </p>
                            {groupSize > 1 && (
                              <div className="matches">
                                {t.groupMatch}:{" "}
                                {s.matches.map((m, j) => (
                                  <span key={j}>
                                    {j + 1}: {m}
                                  </span>
                                ))}
                              </div>
                            )}
                            <button
                              className="receipt-link"
                              onClick={() => setReceipt(s.poi)}
                            >
                              <ShieldCheck size={14} />
                              {t.why}
                              <ChevronRight size={14} />
                            </button>
                          </article>
                        ))}
                      </div>
                      <p className="route-caution">{t.aboutRoute}</p>
                      <div className="result-actions">
                        <button className="secondary-button" onClick={save}>
                          <Download size={15} />
                          {t.save}
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => {
                            weatherLimitEdited.current = false;
                            setPanel("weather");
                          }}
                        >
                          <Wind size={15} />
                          {t.planB}
                        </button>
                      </div>
                      {custom && (
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={exactConsent}
                            onChange={(e) => setExactConsent(e.target.checked)}
                          />
                          {t.includeExact}
                        </label>
                      )}
                      {savedNotice && (
                        <p role="status" className="success-text">
                          <Check size={13} />
                          {savedNotice}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="empty-result-text">{t.noResultBody}</p>
                      <div className="relaxations">
                        <button
                          onClick={() => {
                            setWindow(90);
                            plan({
                              deadline: new Date(
                                Date.parse(isoAstana(startInput)) + 90 * 60000,
                              ).toISOString(),
                            });
                          }}
                        >
                          90 min <ArrowRight size={13} />
                        </button>
                        {stepFree === "required" && (
                          <button
                            onClick={() => {
                              setStepFree("preferred");
                              plan({ stepFree: "preferred" });
                            }}
                          >
                            {t.access}: {t.preferred}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {difference && (
                    <div className="diff-panel">
                      <strong>{t.diff}</strong>
                      <p>
                        {t.removed}: {difference.removed.join(", ") || "—"}
                      </p>
                      <p>
                        {t.added}: {difference.added.join(", ") || "—"}
                      </p>
                      <p>
                        {t.walking}:{" "}
                        {Math.round(difference.walkingSeconds / 60)} min ·{" "}
                        {t.slack}: {Math.round(difference.slackSeconds / 60)}{" "}
                        min
                      </p>
                    </div>
                  )}
                  {result.warnings.map((w, i) => (
                    <p key={i} className="data-warning">
                      {w}
                    </p>
                  ))}
                </>
              ) : (
                <div className="rail-empty">
                  <span className="empty-mark">✳</span>
                  <h2>{t.empty}</h2>
                  <p>{t.emptyBody}</p>
                </div>
              )}
            </div>
            <footer className="rail-footer">
              <button onClick={() => setPanel("judge")}>
                <FileText size={13} />
                {t.judge}
                <ArrowUpRight size={12} />
              </button>
              <span>v{appVersion} · Astana</span>
            </footer>
          </div>
        </section>
        <section className="map-region" aria-label="Map and route">
          <Suspense fallback={<div className="map-loading">{t.loading}</div>}>
            {snapshot && graph && (
              <MapView
                snapshot={snapshot}
                network={graph!.network}
                result={result}
                start={loadedPack?.result.plan?.legs[0]?.geometry[0] ?? start}
                end={
                  loadedPack?.result.plan?.legs.at(-1)?.geometry.at(-1) ?? end
                }
                selecting={selecting}
                onPick={pick}
                selected={selected}
                onSelect={setSelected}
                language={language}
              />
            )}
          </Suspense>
          {!currentPlan && (
            <div className="map-welcome">
              <span className="welcome-index">{t.coverage}</span>
              <div className="welcome-shape">
                <span />
                <span />
                <span />
                <span />
              </div>
              <h2>{t.area}</h2>
              <p>{t.coverageDetail}</p>
              <span className="welcome-rule" />
              <p className="welcome-caption">{t.tagline}</p>
            </div>
          )}
          {currentPlan && (
            <div className="map-plan-summary">
              <span className="map-summary-icon">
                <Footprints size={21} />
              </span>
              <div>
                <b>
                  {currentPlan.stops.length} stops ·{" "}
                  {minute(currentPlan.travelSeconds)} min {t.walking}
                </b>
                <span>
                  {t.returnBy.split(" ·")[0]}{" "}
                  {formatTime(currentPlan.returnTime)} ·{" "}
                  {minute(currentPlan.slackSeconds)} min {t.slack}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label={t.read}
                onClick={() =>
                  setReceipt(
                    currentPlan.stops[selected]?.poi ??
                      currentPlan.stops[0].poi,
                  )
                }
              >
                <ArrowUpRight size={21} />
              </button>
            </div>
          )}
          <div className="map-bottom-note">
            <ShieldCheck size={14} />
            <span>
              {t.source} · {t.unknownValue}
            </span>
          </div>
        </section>
      </main>
      <input
        ref={upload}
        type="file"
        accept=".json,.qala.json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > 5000000) setError("Pack exceeds 5 MB");
            else await openPack(await file.text());
          }
          e.target.value = "";
        }}
      />
      <dialog
        ref={dialog}
        className={`drawer ${panel === "judge" ? "wide-drawer" : ""}`}
        onCancel={closeDialog}
        onClick={(e) => {
          if (e.target === dialog.current) closeDialog();
        }}
      >
        <div className="drawer-inner">
          <div className="drawer-heading">
            <div>
              <span className="eyebrow">QALA WINDOW</span>
              <h2>
                {receipt
                  ? t.receipt
                  : panel === "privacy"
                    ? t.privacy
                    : panel === "saved"
                      ? t.saved
                      : panel === "weather"
                        ? t.weatherPlan
                        : panel === "judge"
                          ? t.judge
                          : t.download}
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label={t.close}
              onClick={closeDialog}
            >
              <X size={21} />
            </button>
          </div>
          {receipt && (
            <>
              <h3 className="receipt-name">{receipt.name}</h3>
              <span className="mode-badge">
                {receipt.challenge ? "Judge supplied · unverified" : receipt.id}
              </span>
              <h4>{t.source}</h4>
              {Object.entries(receipt.fields).map(([key, field]) => (
                <div className="evidence-field" key={key}>
                  <b>{key}</b>
                  <span className={`evidence-state ${field.state}`}>
                    {field.state}
                  </span>
                  <p>
                    {field.value == null
                      ? t.unknownValue
                      : typeof field.value === "object"
                        ? JSON.stringify(field.value)
                        : String(field.value)}
                  </p>
                  <small>
                    {t.sourceDate}: {field.retrieved_at}
                    <br />
                    {t.upstreamDate}:{" "}
                    {field.source_updated_at ?? t.unknownValue}
                    <br />
                    {field.transformation}
                  </small>
                  {receipt.sources.find((s) => s.id === field.source_id) && (
                    <a
                      href={
                        receipt.sources.find((s) => s.id === field.source_id)!
                          .url
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {field.source_id}
                      <ArrowUpRight size={12} />
                    </a>
                  )}
                </div>
              ))}
              <h4>{t.calculated}</h4>
              <pre>
                {JSON.stringify(
                  {
                    visit_range_seconds: receipt.visitSeconds,
                    visit_basis: "Product estimate by category, not venue fact",
                    legs: currentPlan?.legs.filter(
                      (l) => l.from === receipt.id || l.to === receipt.id,
                    ),
                    buffer_seconds: currentPlan?.bufferSeconds,
                    slack_seconds: currentPlan?.slackSeconds,
                    timezone: "Asia/Almaty",
                  },
                  null,
                  2,
                )}
              </pre>
              <h4>{t.suggested}</h4>
              <p>
                {
                  currentPlan?.stops.find((s) => s.poi.id === receipt.id)
                    ?.activity
                }
              </p>
              <p className="fine-print">
                Snapshot hashes establish file integrity, not truth. Conflicting
                records are retained. Unknown facts do not establish strict
                requirements.
              </p>
            </>
          )}
          {panel === "privacy" && (
            <>
              <p className="drawer-lead">{t.privacyBody}</p>
              <p className="fine-print">{t.gpsConsent}</p>
              <p className="fine-print">
                Gemini free-tier data-use conditions may differ from paid plans.
                Open-Meteo: non-commercial service. OSM data: ODbL. Map:
                OpenFreeMap / OpenMapTiles / OSM. No field safety audit has been
                performed.
              </p>
              <button
                className="secondary-button danger"
                disabled={clearing}
                onClick={async () => {
                  setClearing(true);
                  setClearState("idle");
                  try {
                    await clearLocal();
                    setPacks([]);
                    setSavedNotice("");
                    if (loadedPack) invalidate();
                    setClearState("done");
                  } catch {
                    setClearState("failed");
                    setPacks(await listLocal().catch(() => []));
                  } finally {
                    setClearing(false);
                  }
                }}
              >
                <Trash2 size={16} />
                {t.clear}
              </button>
              {clearState !== "idle" && (
                <p
                  className="notice"
                  role={clearState === "failed" ? "alert" : "status"}
                >
                  {clearState === "failed" ? t.clearFailed : t.clearDone}
                </p>
              )}
            </>
          )}
          {panel === "saved" && (
            <>
              <button className="secondary-button" onClick={openNative}>
                <FolderOpen size={16} />
                {t.open}
              </button>
              {packs.length === 0 && <p>{t.noSaved}</p>}
              {packs.map((pack) => (
                <div className="saved-pack" key={pack.saved_at}>
                  <b>
                    {pack.result.plan?.stops
                      .map((s) => s.poi.name)
                      .join(" / ") || "QALA"}
                  </b>
                  <p>
                    {t.lastSync}: {new Date(pack.saved_at).toLocaleString()}
                  </p>
                  <div>
                    <button onClick={() => loadPack(pack)}>
                      {t.view}
                      <ArrowRight size={13} />
                    </button>
                    <button
                      aria-label={t.delete}
                      onClick={async () => {
                        await deleteLocal(pack.saved_at);
                        setPacks(await listLocal());
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          {panel === "weather" && (
            <>
              <div className="weather-card">
                <CloudSun size={38} />
                <div>
                  <b>
                    {weather
                      ? `${weather.current.apparent_temperature} °C`
                      : t.forecast}
                  </b>
                  <p>
                    {weather
                      ? `${weather.current.wind_speed_10m} km/h · wind · ${weather.current.precipitation} mm`
                      : weatherError
                        ? t.unavailable
                        : t.capacity}
                  </p>
                </div>
              </div>
              {weather && (
                <p className="fine-print">
                  Forecast: {weather.current.time} · {t.sourceDate}{" "}
                  {weather.retrieved_at}
                  <br />
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open-Meteo · CC BY 4.0
                  </a>
                </p>
              )}
              <p>{t.weatherBody}</p>
              <label className="drawer-label">
                {t.weatherLimit}
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={planBLimit}
                  onChange={(e) => {
                    weatherLimitEdited.current = true;
                    setPlanBLimit(+e.target.value);
                  }}
                />
              </label>
              <button
                className="primary-button"
                onClick={() => {
                  setOutdoor(planBLimit);
                  const simulated = !weather;
                  setSimulation(simulated);
                  closeDialog();
                  plan(
                    { outdoorMinutes: planBLimit, simulation: simulated },
                    true,
                  );
                }}
              >
                {t.apply}
                <ArrowRight size={17} />
              </button>
              <p className="fine-print">
                {!weather
                  ? t.simulation
                  : "Manual comfort limit applied alongside the timestamped forecast. Forecast does not establish sidewalk conditions."}
              </p>
            </>
          )}
          {panel === "judge" && (
            <>
              <span className="simulation-badge">
                {t.simulation} / ISOLATED DATA
              </span>
              <h4>{t.health}</h4>
              <dl className="health-grid">
                <div>
                  <dt>POIs</dt>
                  <dd>{snapshot?.pois.length ?? 0}</dd>
                </div>
                <div>
                  <dt>{t.unknown}</dt>
                  <dd>{snapshot?.pois.filter((p) => !p.hours).length ?? 0}</dd>
                </div>
                <div>
                  <dt>{t.network}</dt>
                  <dd>{graph?.network.ways.length ?? 0} ways</dd>
                </div>
                <div>
                  <dt>Dataset</dt>
                  <dd className="small-value">{snapshot?.version}</dd>
                </div>
              </dl>
              <p className="fine-print">
                {t.lastSync}: {snapshot?.retrieved_at}
                <br />
                {snapshot?.boundary.source_url}
              </p>
              <h4>{t.import}</h4>
              <p>{t.importHint}</p>
              <textarea
                className="import-area"
                value={challenge}
                onChange={(e) => {
                  setChallenge(e.target.value);
                  setChallengeApplied(false);
                }}
                placeholder={
                  '[{"name":"Judge place","coordinates":[71.407,51.089],"category":"artwork","description":"Unverified test place"}]'
                }
                rows={6}
                maxLength={64000}
              />
              <button
                className="secondary-button"
                onClick={() => {
                  try {
                    const rows = parseChallenge(
                      challenge,
                      snapshot!.boundary.bounds,
                    );
                    setChallengeApplied(true);
                    setSimulation(true);
                    setImportMessage(
                      `${rows.length} judge-supplied entries. Unverified attributes remain unknown.`,
                    );
                    invalidate();
                  } catch (e) {
                    setImportMessage((e as Error).message);
                  }
                }}
              >
                {t.apply}
              </button>
              {importMessage && (
                <p role="status" className="notice">
                  {importMessage}
                </p>
              )}
              <h4>{t.closeStop}</h4>
              {result?.plan?.stops.map((s) => (
                <label className="check-row" key={s.poi.id}>
                  <input
                    type="checkbox"
                    checked={closedIds.includes(s.poi.id)}
                    onChange={(e) => {
                      setClosedIds(
                        e.target.checked
                          ? [...closedIds, s.poi.id]
                          : closedIds.filter((id) => id !== s.poi.id),
                      );
                      setSimulation(true);
                      invalidate();
                    }}
                  />
                  {s.poi.name}
                </label>
              ))}
              <div className="field-pair">
                <button
                  className="primary-button"
                  onClick={() => {
                    closeDialog();
                    plan();
                  }}
                >
                  {t.find}
                  <ArrowRight size={16} />
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setClosedIds([]);
                    setChallenge("");
                    setChallengeApplied(false);
                    setSimulation(false);
                    setImportMessage("");
                    setResult(null);
                    invalidate();
                  }}
                >
                  <RefreshCw size={14} />
                  {t.reset}
                </button>
              </div>
              <h4>{t.trace}</h4>
              {result?.trace.map((entry, i) => (
                <div className="trace-step" key={i}>
                  <span>{i + 1}</span>
                  <div>
                    <b>{entry.stage}</b>
                    <p>{entry.summary}</p>
                    {entry.ids && <code>{entry.ids.join(", ")}</code>}
                  </div>
                </div>
              ))}
              <details>
                <summary>Excluded candidates</summary>
                <pre>{JSON.stringify(result?.exclusions ?? [], null, 2)}</pre>
              </details>
              <p className="fine-print">{t.languageNote}</p>
            </>
          )}
          {panel === "desktop" && (
            <>
              <div className="desktop-illustration">
                <span className="brand-mark">
                  <span />
                  <span />
                </span>
                <b>QALA Window</b>
                <span>Windows x64</span>
              </div>
              <p className="drawer-lead">
                {language === "ru"
                  ? "Сохраните прогулку, маршрут и источники на компьютере. Открывайте сохранённые планы без подключения."
                  : language === "kk"
                    ? "Серуенді, бағытты және дереккөздерді компьютерде сақтаңыз. Сақталған жоспарларды интернетсіз ашыңыз."
                    : "Keep your walk, route and source receipts on your computer. Open saved plans even without a connection."}
              </p>
              {desktopDownload ? (
                <a className="primary-button" href={desktopDownload} download>
                  <Download size={17} />
                  Windows portable · {appVersion}
                </a>
              ) : (
                <p className="notice">
                  {language === "ru"
                    ? "Прямая загрузка Windows пока недоступна на этом сайте."
                    : language === "kk"
                      ? "Бұл сайтта Windows нұсқасын жүктеу әзірге қолжетімсіз."
                      : "The Windows download is currently unavailable on this site."}
                </p>
              )}
              {desktopChecksum && (
                <p className="fine-print">
                  <a href={desktopChecksum}>SHA256</a>
                </p>
              )}
              <p className="fine-print">{t.notSigned}</p>
              <button className="secondary-button" onClick={openNative}>
                <FolderOpen size={15} />
                {t.open}
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
function Timeline({
  plan,
  t,
}: {
  plan: NonNullable<PlanResult["plan"]>;
  t: typeof copy.en;
}) {
  const total =
    plan.travelSeconds +
    plan.visitSeconds +
    plan.bufferSeconds +
    plan.slackSeconds;
  const back = plan.legs.at(-1)?.seconds ?? 0;
  const segments = [
    { label: t.walking, value: plan.travelSeconds - back, cls: "walk-segment" },
    { label: t.visiting, value: plan.visitSeconds, cls: "visit-segment" },
    { label: t.return, value: back, cls: "return-segment" },
    { label: t.buffer, value: plan.bufferSeconds, cls: "buffer-segment" },
    { label: t.spare, value: plan.slackSeconds, cls: "spare-segment" },
  ];
  return (
    <div className="timeline">
      <div className="timeline-title">
        <span>{t.timeFit}</span>
        <b>
          {minute(total)}
          <small> min</small>
        </b>
      </div>
      <div
        className="time-ribbon"
        role="img"
        aria-label={segments
          .map((s) => `${s.label}: ${minute(s.value)} min`)
          .join(", ")}
      >
        {segments.map((s) => (
          <span
            key={s.cls}
            className={s.cls}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="ribbon-key">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span key={s.cls}>
              <i className={s.cls} />
              {minute(s.value)} {s.label.split(",")[0]}
            </span>
          ))}
      </div>
    </div>
  );
}
