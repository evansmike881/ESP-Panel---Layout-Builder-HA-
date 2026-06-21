import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { applyWidgets, fetchEntities, fetchValueSources, fetchWidgets, reloadWidgets, type EntityOption } from "./api";
import {
  DEFAULT_LAYOUT,
  PANEL_THEME_IDS,
  PANEL_THEMES,
  type PanelTheme,
  type PanelThemeId,
  type WidgetConfig,
  type WidgetResponse
} from "./types";

const WIDGET_TYPE_LABELS: Record<WidgetConfig["type"], string> = {
  blank: "Spacer",
  clock: "Clock",
  date: "Date",
  button: "Button",
  media: "Media",
  status: "Status"
};

const CONTENT_ALIGN_OPTIONS = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" }
] as const;

const LAYOUT_MODE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "stacked", label: "Stacked" },
  { value: "icon_right", label: "Icon right" }
] as const;

const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", label: "Normal" },
  { value: "uppercase", label: "Uppercase" }
] as const;

const FONT_WEIGHT_OPTIONS = [
  { value: "normal", label: "Regular" },
  { value: "bold", label: "Bold" }
] as const;

const SCREEN_PRESETS = [
  {
    id: "command",
    name: "Command Center",
    summary: "Balanced home dashboard with weather, controls, telemetry and queue.",
    apply(widgets: WidgetConfig[]) {
      return widgets.map((widget) => {
        switch (widget.id) {
          case "w01": return { ...widget, visible: true, type: "clock", label: "Local Time", value: "18:42", icon: "clock", w: 3, h: 1 };
          case "w02": return { ...widget, visible: true, type: "date", label: "Today", value: "Sun 21 Jun", icon: "calendar", w: 3, h: 1 };
          case "w03": return { ...widget, visible: true, type: "status", label: "Weather", value: "Partly Cloudy", icon: "weather-partly-cloudy", w: 3, h: 2 };
          case "w04": return { ...widget, visible: true, type: "status", label: "Indoor Temp", value: "21.5", icon: "thermometer", w: 1, h: 1 };
          case "w05": return { ...widget, visible: true, type: "status", label: "Humidity", value: "54", icon: "water-percent", w: 1, h: 1 };
          case "w06": return { ...widget, visible: true, type: "button", label: "Main Light", value: "ON", icon: "ceiling-light", w: 2, h: 2 };
          case "w07": return { ...widget, visible: true, type: "status", label: "WiFi", value: "Online", icon: "wifi", w: 1, h: 1 };
          case "w08": return { ...widget, visible: true, type: "status", label: "Scene", value: "Home", icon: "home", w: 1, h: 1 };
          case "w09": return { ...widget, visible: true, type: "button", label: "Front Door", value: "Closed", icon: "door", w: 2, h: 1 };
          case "w10": return { ...widget, visible: true, type: "status", label: "Sofa", value: "Ready", icon: "sofa", w: 2, h: 1 };
          case "w11": return { ...widget, visible: true, type: "media", label: "Studio Audio", value: "Playing", icon: "speaker", w: 3, h: 1 };
          case "w12": return { ...widget, visible: true, type: "button", label: "Scenes", value: "Tap", icon: "shape", w: 1, h: 1 };
          default: return widget;
        }
      });
    }
  },
  {
    id: "climate",
    name: "Climate Focus",
    summary: "Environmental information first, with calmer controls and denser telemetry.",
    apply(widgets: WidgetConfig[]) {
      return widgets.map((widget) => {
        switch (widget.id) {
          case "w03": return { ...widget, visible: true, type: "status", label: "Outside", value: "19.0", icon: "weather-cloudy", w: 3, h: 2 };
          case "w04": return { ...widget, visible: true, type: "status", label: "Indoor", value: "21.3", icon: "thermometer", w: 2, h: 1 };
          case "w05": return { ...widget, visible: true, type: "status", label: "Humidity", value: "48", icon: "water-percent", w: 1, h: 1 };
          case "w06": return { ...widget, visible: true, type: "button", label: "Climate", value: "AUTO", icon: "home", w: 2, h: 1 };
          case "w07": return { ...widget, visible: true, type: "status", label: "Air", value: "Good", icon: "wifi", w: 2, h: 1 };
          case "w08": return { ...widget, visible: true, type: "status", label: "Vent", value: "Normal", icon: "shape", w: 2, h: 1 };
          case "w09": return { ...widget, visible: false };
          case "w10": return { ...widget, visible: true, type: "status", label: "Windows", value: "Closed", icon: "door", w: 2, h: 1 };
          case "w11": return { ...widget, visible: false };
          case "w12": return { ...widget, visible: true, type: "button", label: "Boost", value: "Tap", icon: "ceiling-light", w: 2, h: 1 };
          default: return { ...widget, visible: widget.id === "w01" || widget.id === "w02" || widget.visible };
        }
      });
    }
  },
  {
    id: "media",
    name: "Media Deck",
    summary: "Large hero, playback control emphasis, and compact home-state indicators.",
    apply(widgets: WidgetConfig[]) {
      return widgets.map((widget) => {
        switch (widget.id) {
          case "w03": return { ...widget, visible: true, type: "media", label: "Now Playing", value: "Lo-fi Radio", icon: "speaker", w: 3, h: 2 };
          case "w04": return { ...widget, visible: true, type: "status", label: "Volume", value: "68", icon: "speaker", w: 2, h: 1 };
          case "w05": return { ...widget, visible: true, type: "status", label: "WiFi", value: "Online", icon: "wifi", w: 1, h: 1 };
          case "w06": return { ...widget, visible: true, type: "button", label: "Play / Pause", value: "Playing", icon: "speaker", w: 2, h: 2 };
          case "w07": return { ...widget, visible: true, type: "button", label: "Next", value: "Tap", icon: "shape", w: 1, h: 1 };
          case "w08": return { ...widget, visible: true, type: "button", label: "Scene", value: "Evening", icon: "home", w: 1, h: 1 };
          case "w09": return { ...widget, visible: true, type: "button", label: "Lights", value: "DIM", icon: "ceiling-light", w: 2, h: 1 };
          case "w10": return { ...widget, visible: true, type: "status", label: "Door", value: "Locked", icon: "door", w: 2, h: 1 };
          case "w11": return { ...widget, visible: true, type: "media", label: "Queue", value: "12 tracks", icon: "calendar", w: 3, h: 1 };
          case "w12": return { ...widget, visible: false };
          default: return { ...widget, visible: widget.id === "w01" || widget.id === "w02" || widget.visible };
        }
      });
    }
  }
] as const;

function parseNumericValue(value: string) {
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function widgetTone(widget: WidgetConfig) {
  const value = widget.value.trim().toLowerCase();
  if (["on", "open", "online", "playing", "home", "ready", "good", "auto", "locked", "dim"].includes(value)) return "active";
  if (["off", "offline", "closed", "away", "stopped"].includes(value)) return "idle";
  return "neutral";
}

function formatWidgetValue(widget: WidgetConfig) {
  if (widget.type === "status" && /^-?\d+(\.\d+)?$/.test(widget.value.trim())) {
    if (widget.label.toLowerCase().includes("humid")) return `${widget.value}%`;
    if (widget.label.toLowerCase().includes("temp") || widget.label.toLowerCase().includes("outside") || widget.label.toLowerCase().includes("indoor")) return `${widget.value} C`;
  }
  return widget.value || "--";
}

function iconGlyph(icon: string) {
  const normalized = icon.trim().toLowerCase();
  if (normalized.includes("weather-sunny")) return "Sun";
  if (normalized.includes("weather-partly-cloudy")) return "Cloud";
  if (normalized.includes("weather-cloudy")) return "Sky";
  if (normalized.includes("weather-rainy")) return "Rain";
  if (normalized.includes("weather")) return "Wx";
  if (normalized.includes("thermometer")) return "Temp";
  if (normalized.includes("water-percent")) return "Hum";
  if (normalized.includes("ceiling-light")) return "Light";
  if (normalized.includes("clock")) return "Time";
  if (normalized.includes("calendar")) return "Date";
  if (normalized.includes("speaker")) return "Audio";
  if (normalized.includes("wifi")) return "WiFi";
  if (normalized.includes("door")) return "Door";
  if (normalized.includes("home")) return "Home";
  if (normalized.includes("sofa")) return "Lounge";
  return normalized.slice(0, 6) || "Icon";
}

function themeVars(theme: PanelTheme): CSSProperties {
  return {
    ["--screen-bg" as string]: theme.screenBg,
    ["--screen-bg-elevated" as string]: `color-mix(in srgb, ${theme.screenBg} 78%, white)`,
    ["--screen-bg-deep" as string]: `color-mix(in srgb, ${theme.screenBg} 86%, black)`,
    ["--surface" as string]: theme.widgetBg,
    ["--surface-border" as string]: theme.widgetBorder,
    ["--surface-soft" as string]: `color-mix(in srgb, ${theme.widgetBg} 76%, ${theme.screenBg})`,
    ["--accent" as string]: theme.accent,
    ["--accent-strong" as string]: `color-mix(in srgb, ${theme.accent} 82%, white)`,
    ["--accent-soft" as string]: `color-mix(in srgb, ${theme.accent} 24%, transparent)`,
    ["--text-strong" as string]: theme.valueColor,
    ["--text-soft" as string]: theme.labelColor,
    ["--button-on" as string]: theme.buttonOnBg,
    ["--button-off" as string]: theme.buttonOffBg,
    ["--overlay" as string]: theme.overlayBg
  };
}

function applyThemeColors(themeId: PanelThemeId, widgets: WidgetConfig[]) {
  const theme = PANEL_THEMES[themeId];
  return widgets.map((widget) => ({ ...widget, iconColor: theme.iconColor, labelColor: theme.labelColor, valueColor: theme.valueColor }));
}

function copyWidgetResponse(payload: WidgetResponse) {
  return {
    widgets: payload.widgets.map((widget) => ({ ...widget })),
    defaults: payload.defaults.map((widget) => ({ ...widget })),
    theme: { ...payload.theme },
    missingHelpers: [...payload.missingHelpers],
    warnings: [...payload.warnings],
    helperYaml: payload.helperYaml
  };
}
function App() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_LAYOUT.map((widget) => ({ ...widget })));
  const [defaults, setDefaults] = useState<WidgetConfig[]>(DEFAULT_LAYOUT.map((widget) => ({ ...widget })));
  const [theme, setTheme] = useState<PanelTheme>(PANEL_THEMES.blue);
  const [selectedId, setSelectedId] = useState(DEFAULT_LAYOUT[0]?.id || "w01");
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [valueSources, setValueSources] = useState<EntityOption[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [missingHelpers, setMissingHelpers] = useState<string[]>([]);
  const [helperYaml, setHelperYaml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function hydrate() {
      setIsLoading(true);
      setError("");
      try {
        const [widgetPayload, entityPayload, valuePayload] = await Promise.all([
          fetchWidgets(),
          fetchEntities().catch(() => ({ entities: [] })),
          fetchValueSources().catch(() => ({ entities: [] }))
        ]);
        if (!active) return;
        const snapshot = copyWidgetResponse(widgetPayload);
        setWidgets(snapshot.widgets);
        setDefaults(snapshot.defaults);
        setTheme(snapshot.theme);
        setWarnings(snapshot.warnings);
        setMissingHelpers(snapshot.missingHelpers);
        setHelperYaml(snapshot.helperYaml);
        setEntities(entityPayload.entities);
        setValueSources(valuePayload.entities);
        setSelectedId(snapshot.widgets[0]?.id || "w01");
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load panel data.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const selectedWidget = useMemo(() => widgets.find((widget) => widget.id === selectedId) || widgets[0] || null, [selectedId, widgets]);
  const visibleWidgets = useMemo(() => widgets.filter((widget) => widget.visible && widget.type !== "blank"), [widgets]);
  const statusWidgets = useMemo(() => visibleWidgets.filter((widget) => widget.type === "status"), [visibleWidgets]);
  const actionWidgets = useMemo(() => visibleWidgets.filter((widget) => widget.type === "button" || widget.type === "media"), [visibleWidgets]);

  const heroWidget = statusWidgets[0] || actionWidgets[0] || visibleWidgets[0] || null;
  const headlineWidgets = visibleWidgets.filter((widget) => widget.type === "clock" || widget.type === "date");
  const metricWidgets = statusWidgets.slice(0, 4);
  const chartWidgets = statusWidgets.filter((widget) => parseNumericValue(widget.value) !== null).slice(0, 4);
  const sliderWidgets = actionWidgets.slice(0, 2);
  const listWidgets = visibleWidgets.filter((widget) => widget.id !== heroWidget?.id).slice(0, 5);

  const chartPoints = useMemo(() => {
    if (chartWidgets.length === 0) return "";
    const values = chartWidgets.map((widget) => parseNumericValue(widget.value) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values.map((value, index) => {
      const x = chartWidgets.length === 1 ? 12 : 12 + (index * 216) / (chartWidgets.length - 1);
      const ratio = max === min ? 0.5 : (value - min) / (max - min);
      const y = 104 - ratio * 68;
      return `${x},${y}`;
    }).join(" ");
  }, [chartWidgets]);

  function updateWidget(id: string, patch: Partial<WidgetConfig>) {
    setWidgets((current) => current.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget)));
  }

  function updateSelectedWidget<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) {
    if (!selectedWidget) return;
    updateWidget(selectedWidget.id, { [key]: value } as Partial<WidgetConfig>);
  }

  function applyScreenPreset(presetId: (typeof SCREEN_PRESETS)[number]["id"]) {
    const preset = SCREEN_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setWidgets((current) => preset.apply(current));
    setStatusMessage(`Applied ${preset.name}.`);
  }

  function restoreDefaults() {
    setWidgets(defaults.map((widget) => ({ ...widget })));
    setStatusMessage("Restored defaults from the stored layout.");
  }

  async function handleApply() {
    setIsApplying(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await applyWidgets(widgets, theme);
      setWidgets(response.widgets.map((widget) => ({ ...widget })));
      setWarnings([...response.warnings]);
      setStatusMessage("Changes applied to Home Assistant.");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Unable to apply changes.");
    } finally {
      setIsApplying(false);
    }
  }

  async function handleReload() {
    setIsReloading(true);
    setError("");
    setStatusMessage("");
    try {
      const payload = await reloadWidgets();
      const snapshot = copyWidgetResponse(payload);
      setWidgets(snapshot.widgets);
      setDefaults(snapshot.defaults);
      setTheme(snapshot.theme);
      setWarnings(snapshot.warnings);
      setMissingHelpers(snapshot.missingHelpers);
      setHelperYaml(snapshot.helperYaml);
      setSelectedId(snapshot.widgets[0]?.id || "w01");
      setStatusMessage("Reloaded widget data from Home Assistant.");
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : "Unable to reload widgets.");
    } finally {
      setIsReloading(false);
    }
  }

  async function handleCopyYaml() {
    try {
      await navigator.clipboard.writeText(helperYaml);
      setStatusMessage("Helper YAML copied.");
    } catch {
      setError("Clipboard copy failed in this browser session.");
    }
  }

  const hiddenCount = widgets.filter((widget) => !widget.visible).length;

  return (
    <div className="app-shell" style={themeVars(theme)}>
      <header className="topbar">
        <div>
          <p className="eyebrow">LVGL-first redesign</p>
          <h1>ESP Panel Display Builder</h1>
          <p className="lede">Rebuilt around containers, widgets, transitions and low-overhead embedded surfaces instead of a raw tile grid.</p>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={handleReload} disabled={isReloading || isLoading}>{isReloading ? "Reloading..." : "Reload"}</button>
          <button className="primary-button" onClick={handleApply} disabled={isApplying || isLoading}>{isApplying ? "Applying..." : "Apply to Home Assistant"}</button>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      {statusMessage ? <div className="banner success">{statusMessage}</div> : null}
      {warnings.length ? <div className="banner warn">{warnings.join(" ")}</div> : null}
      {missingHelpers.length ? <div className="banner warn">Missing helpers: {missingHelpers.join(", ")}</div> : null}

      <div className="workspace">
        <aside className="panel left-panel">
          <section className="panel-section">
            <div className="section-heading"><h2>Display System</h2><span>{visibleWidgets.length} active</span></div>
            <div className="theme-grid">
              {PANEL_THEME_IDS.map((themeId) => {
                const option = PANEL_THEMES[themeId];
                const active = theme.id === themeId;
                return (
                  <button
                    key={themeId}
                    className={`theme-card${active ? " active" : ""}`}
                    onClick={() => {
                      setTheme(option);
                      setWidgets((current) => applyThemeColors(themeId, current));
                    }}
                  >
                    <span className="theme-swatch" style={{ background: option.accent }} />
                    <strong>{option.name}</strong>
                    <small>{themeId}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading"><h2>Screen Presets</h2><span>LVGL patterns</span></div>
            <div className="preset-list">
              {SCREEN_PRESETS.map((preset) => (
                <button key={preset.id} className="preset-card" onClick={() => applyScreenPreset(preset.id)}>
                  <strong>{preset.name}</strong>
                  <span>{preset.summary}</span>
                </button>
              ))}
            </div>
            <button className="secondary-button stretch" onClick={restoreDefaults}>Restore Stored Defaults</button>
          </section>

          <section className="panel-section">
            <div className="section-heading"><h2>Widget Library</h2><span>{hiddenCount} hidden</span></div>
            <div className="widget-library">
              {widgets.map((widget) => {
                const active = widget.id === selectedId;
                return (
                  <button key={widget.id} className={`widget-chip${active ? " active" : ""}`} onClick={() => setSelectedId(widget.id)}>
                    <div>
                      <strong>{widget.label || widget.id}</strong>
                      <span>{widget.id} ? {WIDGET_TYPE_LABELS[widget.type]}</span>
                    </div>
                    <span className={`visibility-pill${widget.visible ? " on" : ""}`}>{widget.visible ? "Shown" : "Hidden"}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading"><h2>Helper YAML</h2><span>Runtime helpers</span></div>
            <button className="secondary-button stretch" onClick={handleCopyYaml} disabled={!helperYaml}>Copy Helper YAML</button>
            <textarea className="yaml-preview" readOnly value={helperYaml} />
          </section>
        </aside>

        <main className="panel preview-panel">
          <div className="panel-section preview-header">
            <div>
              <h2>Physical Display Preview</h2>
              <p>Previewing the panel as an embedded LVGL surface with image-led hero content, motion states and dense controls.</p>
            </div>
            <div className="lvgl-notes"><span>Buttons</span><span>Charts</span><span>Lists</span><span>Sliders</span><span>Images</span></div>
          </div>

          <div className="display-shell">
            <div className="display-screen">
              <div className="screen-topbar">
                <span>ESP Panel</span>
                <div className="screen-topbar-meta">
                  {headlineWidgets.slice(0, 2).map((widget) => <span key={widget.id}>{formatWidgetValue(widget)}</span>)}
                </div>
              </div>

              <div className="hero-card">
                <div className="hero-image"><div className="hero-badge">{iconGlyph(heroWidget?.icon || "shape")}</div></div>
                <div className="hero-copy">
                  <span className="hero-kicker">{heroWidget ? WIDGET_TYPE_LABELS[heroWidget.type] : "Widget"}</span>
                  <strong>{heroWidget?.label || "No headline widget"}</strong>
                  <p>{heroWidget ? formatWidgetValue(heroWidget) : "Activate a widget to populate the hero surface."}</p>
                </div>
              </div>

              <div className="metric-row">
                {metricWidgets.length ? metricWidgets.map((widget) => (
                  <button key={widget.id} className={`metric-card tone-${widgetTone(widget)}${selectedId === widget.id ? " selected" : ""}`} onClick={() => setSelectedId(widget.id)}>
                    <span>{widget.label}</span>
                    <strong>{formatWidgetValue(widget)}</strong>
                  </button>
                )) : <div className="empty-card">Add visible status widgets to feed metric tiles.</div>}
              </div>

              <div className="mid-grid">
                <section className="chart-card">
                  <div className="card-title"><h3>Telemetry</h3><span>Smooth line chart</span></div>
                  <svg viewBox="0 0 240 120" className="chart-svg" aria-hidden="true">
                    <defs>
                      <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-strong)" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="var(--accent-strong)" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <path d="M 12 104 H 228" className="chart-axis" />
                    {chartPoints ? <><polyline points={`${chartPoints} 228,104 12,104`} className="chart-fill" /><polyline points={chartPoints} className="chart-line" /></> : null}
                  </svg>
                  <div className="chart-legend">
                    {chartWidgets.length ? chartWidgets.map((widget) => <button key={widget.id} className="legend-chip" onClick={() => setSelectedId(widget.id)}>{widget.label}</button>) : <span className="empty-inline">Use numeric status widgets to draw the chart.</span>}
                  </div>
                </section>

                <section className="controls-card">
                  <div className="card-title"><h3>Quick Controls</h3><span>Styled LVGL buttons</span></div>
                  <div className="control-grid">
                    {actionWidgets.length ? actionWidgets.slice(0, 4).map((widget) => (
                      <button key={widget.id} className={`control-button tone-${widgetTone(widget)}${selectedId === widget.id ? " selected" : ""}`} onClick={() => setSelectedId(widget.id)}>
                        <span className="control-icon">{iconGlyph(widget.icon)}</span>
                        <strong>{widget.label}</strong>
                        <small>{formatWidgetValue(widget)}</small>
                      </button>
                    )) : <div className="empty-card compact">Make at least one button or media widget visible.</div>}
                  </div>
                </section>
              </div>

              <div className="lower-grid">
                <section className="list-card">
                  <div className="card-title"><h3>Automation Queue</h3><span>Scrollable LVGL list</span></div>
                  <div className="list-surface">
                    {listWidgets.length ? listWidgets.map((widget) => (
                      <button key={widget.id} className={`list-row${selectedId === widget.id ? " selected" : ""}`} onClick={() => setSelectedId(widget.id)}>
                        <span>{widget.label}</span>
                        <strong>{formatWidgetValue(widget)}</strong>
                      </button>
                    )) : <div className="empty-card compact">Visible widgets appear here as list items.</div>}
                  </div>
                </section>

                <section className="slider-card">
                  <div className="card-title"><h3>Fine Control</h3><span>Animated slider tracks</span></div>
                  <div className="slider-stack">
                    {sliderWidgets.length ? sliderWidgets.map((widget, index) => {
                      const numeric = parseNumericValue(widget.value);
                      const level = clamp(numeric ?? (widgetTone(widget) === "active" ? 78 : 36), 0, 100);
                      return (
                        <button key={widget.id} className={`slider-row${selectedId === widget.id ? " selected" : ""}`} onClick={() => setSelectedId(widget.id)}>
                          <div className="slider-meta"><span>{widget.label}</span><strong>{level}%</strong></div>
                          <div className="slider-track"><div className="slider-fill" style={{ width: `${level}%`, animationDelay: `${index * 120}ms` }} /></div>
                        </button>
                      );
                    }) : <div className="empty-card compact">Visible action widgets feed the slider surface.</div>}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>

        <aside className="panel right-panel">
          <section className="panel-section">
            <div className="section-heading"><h2>Widget Inspector</h2><span>{selectedWidget?.id || "None"}</span></div>

            {selectedWidget ? (
              <div className="inspector-form">
                <label className="field checkbox-field">
                  <input type="checkbox" checked={selectedWidget.visible} onChange={(event) => updateSelectedWidget("visible", event.target.checked)} />
                  <span>Visible in the display</span>
                </label>

                <div className="field-grid two">
                  <label className="field"><span>Label</span><input value={selectedWidget.label} onChange={(event) => updateSelectedWidget("label", event.target.value)} /></label>
                  <label className="field"><span>Value</span><input value={selectedWidget.value} onChange={(event) => updateSelectedWidget("value", event.target.value)} /></label>
                </div>

                <div className="field-grid two">
                  <label className="field"><span>Icon</span><input value={selectedWidget.icon} onChange={(event) => updateSelectedWidget("icon", event.target.value)} /></label>
                  <label className="field">
                    <span>Type</span>
                    <select value={selectedWidget.type} onChange={(event) => updateSelectedWidget("type", event.target.value as WidgetConfig["type"])}>
                      {Object.entries(WIDGET_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>

                <div className="field-grid two">
                  <label className="field">
                    <span>Action entity</span>
                    <select value={selectedWidget.action} onChange={(event) => updateSelectedWidget("action", event.target.value)}>
                      <option value="">Manual / none</option>
                      {entities.map((entity) => <option key={entity.entity_id} value={entity.entity_id}>{entity.name || entity.entity_id}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Value source</span>
                    <select value={selectedWidget.valueSource} onChange={(event) => updateSelectedWidget("valueSource", event.target.value)}>
                      <option value="">Manual / none</option>
                      {valueSources.map((entity) => <option key={entity.entity_id} value={entity.entity_id}>{entity.name || entity.entity_id}</option>)}
                    </select>
                  </label>
                </div>

                <div className="field-grid three">
                  <label className="field">
                    <span>Align</span>
                    <select value={selectedWidget.contentAlign} onChange={(event) => updateSelectedWidget("contentAlign", event.target.value as WidgetConfig["contentAlign"])}>
                      {CONTENT_ALIGN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Layout mode</span>
                    <select value={selectedWidget.layoutMode} onChange={(event) => updateSelectedWidget("layoutMode", event.target.value as WidgetConfig["layoutMode"])}>
                      {LAYOUT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Case</span>
                    <select value={selectedWidget.labelTransform} onChange={(event) => updateSelectedWidget("labelTransform", event.target.value as WidgetConfig["labelTransform"])}>
                      {TEXT_TRANSFORM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>

                <div className="field-grid three">
                  <label className="field">
                    <span>Label weight</span>
                    <select value={selectedWidget.labelWeight} onChange={(event) => updateSelectedWidget("labelWeight", event.target.value as WidgetConfig["labelWeight"])}>
                      {FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Value weight</span>
                    <select value={selectedWidget.valueWeight} onChange={(event) => updateSelectedWidget("valueWeight", event.target.value as WidgetConfig["valueWeight"])}>
                      {FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="field checkbox-field compact">
                    <input type="checkbox" checked={selectedWidget.showBorder} onChange={(event) => updateSelectedWidget("showBorder", event.target.checked)} />
                    <span>Border</span>
                  </label>
                </div>

                <div className="field-grid three">
                  <label className="field"><span>Icon scale</span><input type="number" min={50} max={200} value={selectedWidget.iconScale} onChange={(event) => updateSelectedWidget("iconScale", Number.parseInt(event.target.value || "100", 10))} /></label>
                  <label className="field"><span>Label scale</span><input type="number" min={50} max={200} value={selectedWidget.labelScale} onChange={(event) => updateSelectedWidget("labelScale", Number.parseInt(event.target.value || "100", 10))} /></label>
                  <label className="field"><span>Value scale</span><input type="number" min={50} max={200} value={selectedWidget.valueScale} onChange={(event) => updateSelectedWidget("valueScale", Number.parseInt(event.target.value || "100", 10))} /></label>
                </div>

                <div className="field-grid three">
                  <label className="field"><span>X</span><input type="number" value={selectedWidget.x} onChange={(event) => updateSelectedWidget("x", Number.parseInt(event.target.value || "0", 10))} /></label>
                  <label className="field"><span>Y</span><input type="number" value={selectedWidget.y} onChange={(event) => updateSelectedWidget("y", Number.parseInt(event.target.value || "0", 10))} /></label>
                  <label className="field">
                    <span>W x H</span>
                    <div className="inline-pair">
                      <input type="number" value={selectedWidget.w} onChange={(event) => updateSelectedWidget("w", Number.parseInt(event.target.value || "1", 10))} />
                      <input type="number" value={selectedWidget.h} onChange={(event) => updateSelectedWidget("h", Number.parseInt(event.target.value || "1", 10))} />
                    </div>
                  </label>
                </div>
              </div>
            ) : <div className="empty-card">Select a widget to edit its behavior.</div>}
          </section>
        </aside>
      </div>

      {isLoading ? <div className="loading-overlay">Loading panel data...</div> : null}
    </div>
  );
}

export default App;
