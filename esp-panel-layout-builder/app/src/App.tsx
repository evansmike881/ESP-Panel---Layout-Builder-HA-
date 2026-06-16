import mdiIcons from "@iconify-json/mdi/icons.json";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { applyWidget, applyWidgets, fetchEntities, fetchValueSources, fetchWidgets, reloadWidgets, type EntityOption } from "./api";
import { DEFAULT_LAYOUT, GRID_SIZE, WIDGET_TYPES, type WidgetConfig, type WidgetResponse } from "./types";

type Interaction =
  | {
      mode: "drag";
      id: string;
      pointerId: number;
      startX: number;
      startY: number;
      startWidget: WidgetConfig;
    }
  | {
      mode: "resize";
      id: string;
      pointerId: number;
      startX: number;
      startY: number;
      startWidget: WidgetConfig;
    };

const GRID_LABELS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
  col: index % GRID_SIZE,
  row: Math.floor(index / GRID_SIZE)
}));
const MDI_ALIASES = (mdiIcons.aliases || {}) as Record<string, { parent: string }>;
const MDI_ICON_NAMES = Array.from(new Set([...Object.keys(mdiIcons.icons), ...Object.keys(MDI_ALIASES)])).sort();
const PANEL_SUPPORTED_ICONS = [
  "weather-sunny",
  "weather-partly-cloudy",
  "weather-cloudy",
  "weather-rainy",
  "weather-pouring",
  "weather-lightning",
  "weather-snowy",
  "weather-fog",
  "thermometer",
  "water-percent",
  "ceiling-light",
  "clock",
  "calendar",
  "shape",
  "wifi",
  "sofa",
  "door",
  "home",
  "cog"
] as const;
const PANEL_SUPPORTED_ICON_SET = new Set(PANEL_SUPPORTED_ICONS);
const CONTENT_ALIGN_OPTIONS = [
  { value: "start", label: "Left" },
  { value: "center", label: "Center" },
  { value: "end", label: "Right" }
] as const;
const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", label: "Normal case" },
  { value: "uppercase", label: "Uppercase" }
] as const;
const FONT_WEIGHT_OPTIONS = [
  { value: "normal", label: "Regular" },
  { value: "bold", label: "Bold" }
] as const;
const PREVIEW_SCALE_OPTIONS = [
  { value: 1, label: "100%" },
  { value: 0.5, label: "50%" },
  { value: 0.25, label: "25%" }
] as const;
const VALUE_PRESETS: Partial<Record<WidgetConfig["type"], string[]>> = {
  weather: ["Sunny", "Cloudy", "Partly Cloudy", "Rain", "Storm"],
  temperature: ["12.5", "18.0", "21.5", "24.0"],
  humidity: ["40", "55", "80"],
  button: ["ON", "OFF", "Tap"],
  status: ["Online", "Offline", "Ready", "Open", "Closed"]
};
const ACTION_PRESETS: Partial<Record<WidgetConfig["type"], string[]>> = {
  clock: ["clock"],
  date: ["date"],
  weather: ["weather"],
  temperature: ["temperature"],
  humidity: ["humidity"],
  button: ["office_light", "main_light", "front_door", "toggle_light"],
  status: ["wifi_status", "home_scene", "sofa_status", "system_status"]
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isAutoValueType(type: WidgetConfig["type"]) {
  return type === "clock" || type === "date";
}

function widgetCapabilities(type: WidgetConfig["type"]) {
  const blank = type === "blank";
  const autoValue = isAutoValueType(type);
  const action = type === "button" || type === "status";
  return {
    showLabel: !blank,
    showValueInput: !blank && !autoValue,
    showValueSource: !blank && !autoValue,
    showIcon: !blank,
    showAction: action,
    showAppearance: !blank,
    showValueAppearance: !blank
  };
}

function detectWarnings(widgets: WidgetConfig[]) {
  const warnings: string[] = [];
  for (let index = 0; index < widgets.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < widgets.length; otherIndex += 1) {
      const current = widgets[index];
      const other = widgets[otherIndex];
      const overlaps =
        current.visible &&
        other.visible &&
        current.x < other.x + other.w &&
        current.x + current.w > other.x &&
        current.y < other.y + other.h &&
        current.y + current.h > other.y;

      if (overlaps) {
        warnings.push(`${current.id} overlaps ${other.id}.`);
      }
    }
  }
  return warnings;
}

function getMdiIcon(icon: string) {
  const normalized = icon.trim().replace(/^mdi:/i, "").toLowerCase();
  if (!normalized) {
    return null;
  }

  const directIcon = mdiIcons.icons[normalized as keyof typeof mdiIcons.icons];
  if (directIcon) {
    return directIcon;
  }

  const alias = MDI_ALIASES[normalized];
  if (!alias) {
    return null;
  }

  return mdiIcons.icons[alias.parent as keyof typeof mdiIcons.icons] || null;
}

function widgetScale(widget: WidgetConfig) {
  const area = widget.w * widget.h;
  const widthBoost = widget.w * 0.08;
  const heightBoost = widget.h * 0.12;
  return clamp(0.86 + Math.sqrt(area) * 0.3 + widthBoost + heightBoost, 0.9, 2.6);
}

function widgetStyle(widget: WidgetConfig): CSSProperties {
  const scale = widgetScale(widget);
  const justifyContent =
    widget.contentAlign === "center" ? "center" : widget.contentAlign === "end" ? "flex-end" : "flex-start";
  const textAlign = widget.contentAlign === "center" ? "center" : widget.contentAlign === "end" ? "right" : "left";

  return {
    left: `${(widget.x / GRID_SIZE) * 100}%`,
    top: `${(widget.y / GRID_SIZE) * 100}%`,
    width: `${(widget.w / GRID_SIZE) * 100}%`,
    height: `${(widget.h / GRID_SIZE) * 100}%`,
    ["--widget-scale" as string]: String(scale),
    ["--widget-padding" as string]: `${clamp(10 + widget.h * 2 + widget.w, 10, 24)}px`,
    ["--widget-gap" as string]: `${clamp(6 + widget.h * 2, 6, 18)}px`,
    ["--widget-main-justify" as string]: justifyContent,
    ["--widget-text-align" as string]: textAlign,
    ["--widget-icon-color" as string]: widget.iconColor,
    ["--widget-label-color" as string]: widget.labelColor,
    ["--widget-value-color" as string]: widget.valueColor,
    ["--widget-icon-scale" as string]: String(widget.iconScale / 100),
    ["--widget-label-scale" as string]: String(widget.labelScale / 100),
    ["--widget-value-scale" as string]: String(widget.valueScale / 100),
    ["--widget-label-weight" as string]: widget.labelWeight,
    ["--widget-value-weight" as string]: widget.valueWeight
  };
}

function transformLabel(label: string, transform: WidgetConfig["labelTransform"]) {
  return transform === "uppercase" ? label.toUpperCase() : label;
}

function MdiIcon({ icon, className }: { icon: string; className?: string }) {
  const iconData = getMdiIcon(icon);

  if (!iconData) {
    return <div className={`widget-icon widget-icon-fallback ${className || ""}`.trim()}>{icon.slice(0, 3).toUpperCase() || "MDI"}</div>;
  }

  return (
    <svg
      className={`widget-icon ${className || ""}`.trim()}
      viewBox={`0 0 ${iconData.width || 24} ${iconData.height || 24}`}
      aria-hidden="true"
    >
      <g dangerouslySetInnerHTML={{ __html: iconData.body }} />
    </svg>
  );
}

function valuePlaceholder(type: WidgetConfig["type"]) {
  switch (type) {
    case "clock":
      return "Auto-generated from Home Assistant time";
    case "date":
      return "Auto-generated from Home Assistant date";
    case "weather":
      return "Example: Partly Cloudy";
    case "temperature":
      return "Example: 21.5";
    case "humidity":
      return "Example: 55";
    case "button":
      return "Example: ON or OFF";
    case "status":
      return "Example: Online or Ready";
    default:
      return "Widget value";
  }
}

function actionPlaceholder(type: WidgetConfig["type"]) {
  switch (type) {
    case "button":
      return "Example: switch.office_main_light";
    case "status":
      return "Example: binary_sensor.front_door";
    default:
      return "Automation key used by your panel tap handler";
  }
}

function valueSourcePlaceholder(type: WidgetConfig["type"]) {
  switch (type) {
    case "temperature":
      return "Example: sensor.outdoor_temperature";
    case "humidity":
      return "Example: sensor.office_humidity";
    case "status":
      return "Example: binary_sensor.front_door or sensor.panel_status";
    case "button":
      return "Optional: show the state of a related entity";
    default:
      return "Optional Home Assistant entity to mirror into this widget value";
  }
}

function EditorGroup({
  title,
  subtitle,
  defaultOpen = true,
  children
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="editor-group" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {subtitle ? <small>{subtitle}</small> : null}
      </summary>
      <div className="editor-group-body">{children}</div>
    </details>
  );
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff";

  return (
    <label className="field">
      <span>{label}</span>
      <div className="color-field-row">
        <input type="color" value={pickerValue} onChange={(event) => onChange(event.target.value)} />
        <input type="text" value={value} placeholder="#ffffff" onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

export default function App() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_LAYOUT);
  const [defaults, setDefaults] = useState<WidgetConfig[]>(DEFAULT_LAYOUT);
  const [selectedId, setSelectedId] = useState<string>("w01");
  const [status, setStatus] = useState("Loading from Home Assistant...");
  const [statusTone, setStatusTone] = useState<"ok" | "warn" | "error">("warn");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [missingHelpers, setMissingHelpers] = useState<string[]>([]);
  const [helperYaml, setHelperYaml] = useState("");
  const [showHelperYaml, setShowHelperYaml] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const [iconScope, setIconScope] = useState<"panel" | "all">("panel");
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [valueSourceEntities, setValueSourceEntities] = useState<EntityOption[]>([]);
  const [entityQuery, setEntityQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewScale, setPreviewScale] = useState<(typeof PREVIEW_SCALE_OPTIONS)[number]["value"]>(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);

  const selectedWidget = useMemo(
    () => widgets.find((widget) => widget.id === selectedId) || widgets[0],
    [selectedId, widgets]
  );
  const capabilities = useMemo(
    () => (selectedWidget ? widgetCapabilities(selectedWidget.type) : widgetCapabilities("blank")),
    [selectedWidget]
  );
  const filteredIcons = useMemo(() => {
    const query = iconQuery.trim().replace(/^mdi:/i, "").toLowerCase();
    const iconSource = iconScope === "panel" ? PANEL_SUPPORTED_ICONS : MDI_ICON_NAMES;
    if (!query) {
      return iconSource.slice(0, 120);
    }
    return iconSource.filter((name) => name.includes(query)).slice(0, 120);
  }, [iconQuery, iconScope]);
  const actionSuggestions = useMemo(() => {
    if (!selectedWidget) {
      return [];
    }

    const existingActions = widgets
      .map((widget) => widget.action.trim())
      .filter((action) => action.length > 0);

    return Array.from(new Set([...(ACTION_PRESETS[selectedWidget.type] || []), ...existingActions])).slice(0, 20);
  }, [selectedWidget, widgets]);
  const valueSuggestions = useMemo(() => {
    if (!selectedWidget || !capabilities.showValueInput) {
      return [];
    }

    return VALUE_PRESETS[selectedWidget.type] || [];
  }, [capabilities.showValueInput, selectedWidget]);
  const entitySuggestions = useMemo(() => {
    const query = entityQuery.trim().toLowerCase();
    const actionQuery = selectedWidget?.action.trim().toLowerCase() || "";
    const effectiveQuery = query || actionQuery;

    if (!effectiveQuery) {
      return entities.slice(0, 30);
    }

    return entities
      .filter((entity) => entity.entity_id.toLowerCase().includes(effectiveQuery) || entity.name.toLowerCase().includes(effectiveQuery))
      .slice(0, 30);
  }, [entities, entityQuery, selectedWidget]);
  const valueSourceSuggestions = useMemo(() => {
    const query = (selectedWidget?.valueSource || "").trim().toLowerCase();
    if (!query) {
      return valueSourceEntities.slice(0, 30);
    }

    return valueSourceEntities
      .filter((entity) => entity.entity_id.toLowerCase().includes(query) || entity.name.toLowerCase().includes(query))
      .slice(0, 30);
  }, [valueSourceEntities, selectedWidget]);
  const selectedActionEntity = useMemo(
    () => entities.find((entity) => entity.entity_id === selectedWidget?.action),
    [entities, selectedWidget]
  );
  const selectedValueEntity = useMemo(
    () => valueSourceEntities.find((entity) => entity.entity_id === selectedWidget?.valueSource),
    [selectedWidget, valueSourceEntities]
  );
  const isPanelSafeIcon = useMemo(
    () => PANEL_SUPPORTED_ICON_SET.has((selectedWidget?.icon || "").replace(/^mdi:/i, "").toLowerCase()),
    [selectedWidget]
  );
  const visibleWidgets = useMemo(() => widgets.filter((widget) => widget.visible), [widgets]);
  const hiddenWidgets = useMemo(() => widgets.filter((widget) => !widget.visible), [widgets]);

  useEffect(() => {
    void loadWidgets();
    void loadEntities();
    void loadValueSources();
  }, []);

  useEffect(() => {
    setIconQuery(selectedWidget?.icon || "");
    setEntityQuery(selectedWidget?.action || "");
  }, [selectedWidget?.id, selectedWidget?.icon, selectedWidget?.action]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".menu-wrap")) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      const board = boardRef.current;

      if (!interaction || !board || event.pointerId !== interaction.pointerId) {
        return;
      }

      const rect = board.getBoundingClientRect();
      const cellWidth = rect.width / GRID_SIZE;
      const cellHeight = rect.height / GRID_SIZE;
      const deltaX = event.clientX - interaction.startX;
      const deltaY = event.clientY - interaction.startY;

      setWidgets((current) =>
        current.map((widget) => {
          if (widget.id !== interaction.id) {
            return widget;
          }

          if (interaction.mode === "drag") {
            const nextX = clamp(
              Math.round(interaction.startWidget.x + deltaX / cellWidth),
              0,
              GRID_SIZE - interaction.startWidget.w
            );
            const nextY = clamp(
              Math.round(interaction.startWidget.y + deltaY / cellHeight),
              0,
              GRID_SIZE - interaction.startWidget.h
            );
            return { ...widget, x: nextX, y: nextY };
          }

          const nextW = clamp(
            Math.round(interaction.startWidget.w + deltaX / cellWidth),
            1,
            GRID_SIZE - interaction.startWidget.x
          );
          const nextH = clamp(
            Math.round(interaction.startWidget.h + deltaY / cellHeight),
            1,
            GRID_SIZE - interaction.startWidget.y
          );
          return { ...widget, w: nextW, h: nextH };
        })
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      if (interactionRef.current && event.pointerId === interactionRef.current.pointerId) {
        interactionRef.current = null;
        setWarnings(detectWarnings(widgets));
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [widgets]);

  async function loadWidgets() {
    setBusy(true);
    try {
      const data = await fetchWidgets();
      hydrateResponse(data, "Connected to Home Assistant");
      setStatusTone(data.missingHelpers.length > 0 ? "warn" : "ok");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load widgets");
      setStatusTone("error");
      setWarnings(["Using local defaults until Home Assistant responds."]);
    } finally {
      setBusy(false);
    }
  }

  async function loadEntities() {
    try {
      const data = await fetchEntities();
      setEntities(data.entities);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadValueSources() {
    try {
      const data = await fetchValueSources();
      setValueSourceEntities(data.entities);
    } catch (error) {
      console.error(error);
    }
  }

  function hydrateResponse(data: WidgetResponse, message: string) {
    setWidgets(data.widgets);
    setDefaults(data.defaults);
    setHelperYaml(data.helperYaml);
    setWarnings(data.warnings);
    setMissingHelpers(data.missingHelpers);
    setSelectedId((current) => (data.widgets.some((widget) => widget.id === current) ? current : data.widgets[0]?.id || "w01"));
    setStatus(message);
  }

  function updateWidget(id: string, patch: Partial<WidgetConfig>) {
    setWidgets((current) => {
      const next = current.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget));
      setWarnings(detectWarnings(next));
      return next;
    });
  }

  async function handleApplyAll() {
    setBusy(true);
    try {
      const result = await applyWidgets(widgets);
      setWidgets(result.widgets);
      setWarnings(result.warnings);
      setStatus("All widget helpers updated");
      setStatusTone(result.warnings.length > 0 ? "warn" : "ok");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to apply widgets");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleApplySelected() {
    if (!selectedWidget) {
      return;
    }

    setBusy(true);
    try {
      const result = await applyWidget(selectedWidget);
      updateWidget(result.widget.id, result.widget);
      setWarnings(result.warnings);
      setStatus(`Applied ${result.widget.id}`);
      setStatusTone(result.warnings.length > 0 ? "warn" : "ok");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to apply selected widget");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleReload() {
    setBusy(true);
    try {
      const data = await reloadWidgets();
      hydrateResponse(data, "Reloaded from Home Assistant");
      setStatusTone(data.missingHelpers.length > 0 ? "warn" : "ok");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to reload widgets");
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setWidgets(defaults);
    setWarnings(detectWarnings(defaults));
    setStatus("Reset to default layout in the editor");
    setStatusTone("warn");
  }

  async function handleCopyYaml() {
    try {
      await navigator.clipboard.writeText(helperYaml);
      setStatus("Helper YAML copied to clipboard");
      setStatusTone("ok");
    } catch {
      setStatus("Could not copy automatically. Select and copy the Helper YAML manually.");
      setStatusTone("warn");
    }
  }

  function handlePointerStart(event: ReactPointerEvent<HTMLElement>, widget: WidgetConfig, mode: "drag" | "resize") {
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      mode,
      id: widget.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidget: { ...widget }
    };
    setSelectedId(widget.id);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Home Assistant Add-on</p>
          <h1>ESP Panel Layout Builder</h1>
        </div>
        <div className="topbar-actions">
          <div className={`status-pill status-${statusTone}`}>
            <span className="status-dot" />
            <span>{status}</span>
          </div>
          <div className="menu-wrap">
            <button
              type="button"
              className="menu-trigger"
              aria-label="Open tools menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span />
              <span />
              <span />
            </button>
            {menuOpen && (
              <div className="menu-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleReload();
                  }}
                  disabled={busy}
                >
                  Reload from Home Assistant
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleReset();
                  }}
                  disabled={busy}
                >
                  Reset to default layout
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowHelperYaml(true);
                  }}
                >
                  Helper YAML
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {(warnings.length > 0 || missingHelpers.length > 0) && (
        <section className="notice-panel">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {missingHelpers.length > 0 && <p>Missing helpers: {missingHelpers.join(", ")}</p>}
        </section>
      )}

      <main className="workspace">
        <section className="preview-panel">
          <div className="preview-header">
            <div>
              <h2>480x480 Preview</h2>
              <p>6 columns x 6 rows, 80px slots</p>
            </div>
            <div className="preview-header-tools">
              <div className="scale-toggle" aria-label="Preview scale">
                {PREVIEW_SCALE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={previewScale === option.value ? "scale-active" : ""}
                    onClick={() => setPreviewScale(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="grid-key">
                <span>Drag cards to move</span>
                <span>Use corner handle to resize</span>
              </div>
            </div>
          </div>

          <div className="board-wrap">
            <div className="board-stage" style={{ width: `${480 * previewScale}px` }}>
              <div className="board" ref={boardRef}>
                <div className="grid-overlay">
                  {GRID_LABELS.map((cell) => (
                    <div
                      key={`${cell.col}-${cell.row}`}
                      className="grid-cell"
                      style={{
                        left: `${(cell.col / GRID_SIZE) * 100}%`,
                        top: `${(cell.row / GRID_SIZE) * 100}%`,
                        width: `${100 / GRID_SIZE}%`,
                        height: `${100 / GRID_SIZE}%`
                      }}
                    >
                      <span>
                        {cell.col},{cell.row}
                      </span>
                    </div>
                  ))}
                </div>

                {visibleWidgets.map((widget) => {
                  const previewLabel = transformLabel(widget.label || "Untitled", widget.labelTransform);
                  const previewValue =
                    widget.type === "blank" ? "" : widget.value || (isAutoValueType(widget.type) ? valuePlaceholder(widget.type) : "No value");

                  return (
                    <button
                      key={widget.id}
                      type="button"
                      className={`widget-card ${selectedId === widget.id ? "selected" : ""} ${widget.type === "blank" ? "blank-widget" : ""}`}
                      style={widgetStyle(widget)}
                      onClick={() => setSelectedId(widget.id)}
                      onPointerDown={(event) => handlePointerStart(event, widget, "drag")}
                    >
                      <div className="widget-meta">
                        <span>{widget.id}</span>
                        <span>{widget.type}</span>
                      </div>
                      <div className="widget-main">
                        {widget.type !== "blank" && <MdiIcon icon={widget.icon} />}
                        <div className="widget-text">
                          {widget.type === "blank" ? (
                            <strong className="blank-widget-copy">Blank spacer</strong>
                          ) : (
                            <>
                              <strong>{previewLabel}</strong>
                              <span>{previewValue}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="widget-size">
                        {widget.w}x{widget.h}
                      </span>
                      <span className="resize-handle" onPointerDown={(event) => handlePointerStart(event, widget, "resize")} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="holding-area">
            <div className="holding-header">
              <div>
                <h3>Hidden Widgets</h3>
                <p>These stay off the screen preview until you mark them visible.</p>
              </div>
              <span>{hiddenWidgets.length} hidden</span>
            </div>
            {hiddenWidgets.length > 0 ? (
              <div className="holding-grid">
                {hiddenWidgets.map((widget) => {
                  const previewLabel = transformLabel(widget.label || "Untitled", widget.labelTransform);
                  const previewValue =
                    widget.type === "blank" ? "Blank spacer" : widget.value || (isAutoValueType(widget.type) ? valuePlaceholder(widget.type) : "No value");

                  return (
                    <button
                      key={widget.id}
                      type="button"
                      className={`holding-card ${selectedId === widget.id ? "selected" : ""}`}
                      onClick={() => setSelectedId(widget.id)}
                    >
                      <div className="holding-card-top">
                        <span>{widget.id}</span>
                        <small>{widget.type}</small>
                      </div>
                      <div className="holding-card-main">
                        {widget.type !== "blank" && <MdiIcon icon={widget.icon} className="holding-icon" />}
                        <div className="holding-text">
                          <strong>{previewLabel}</strong>
                          <span>{previewValue}</span>
                        </div>
                      </div>
                      <div className="holding-card-meta">
                        <span>
                          {widget.w}x{widget.h}
                        </span>
                        <span>
                          {widget.x},{widget.y}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="holding-empty">All widgets are currently visible on the panel preview.</p>
            )}
          </div>
        </section>

        <aside className="editor-panel">
          {selectedWidget && (
            <>
              <div className="editor-header">
                <h2>Widget Editor</h2>
                <span>{selectedWidget.id}</span>
              </div>

              <EditorGroup title="Basics" subtitle="Visibility and widget type">
                <label className="field checkbox-field">
                  <span>Visible</span>
                  <input
                    type="checkbox"
                    checked={selectedWidget.visible}
                    onChange={(event) => updateWidget(selectedWidget.id, { visible: event.target.checked })}
                  />
                </label>

                <label className="field">
                  <span>Type</span>
                  <select
                    value={selectedWidget.type}
                    onChange={(event) => updateWidget(selectedWidget.id, { type: event.target.value as WidgetConfig["type"] })}
                  >
                    {WIDGET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </EditorGroup>

              {(capabilities.showLabel || capabilities.showValueInput || valueSuggestions.length > 0) && (
                <EditorGroup title="Content" subtitle="What the widget says" defaultOpen={false}>
                  {capabilities.showLabel && (
                    <label className="field">
                      <span>Label</span>
                      <input
                        type="text"
                        value={selectedWidget.label}
                        onChange={(event) => updateWidget(selectedWidget.id, { label: event.target.value })}
                      />
                    </label>
                  )}

                  {capabilities.showValueInput && (
                    <>
                      <label className="field">
                        <span>Value</span>
                        <input
                          type="text"
                          value={selectedWidget.value}
                          placeholder={valuePlaceholder(selectedWidget.type)}
                          onChange={(event) => updateWidget(selectedWidget.id, { value: event.target.value })}
                        />
                      </label>
                      <p className="field-hint">
                        {selectedWidget.valueSource
                          ? "This value is being kept in sync from the selected Home Assistant entity."
                          : "This is the text shown as the main reading on the widget."}
                      </p>
                    </>
                  )}

                  {!capabilities.showValueInput && selectedWidget.type !== "blank" && (
                    <p className="field-hint">This widget type fills its value automatically on the panel, so the manual value field is hidden.</p>
                  )}

                  {valueSuggestions.length > 0 && (
                    <div className="suggestion-block">
                      <div className="suggestion-header">
                        <span>Quick values</span>
                      </div>
                      <div className="suggestion-chips">
                        {valueSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className={`suggestion-chip ${selectedWidget.value === suggestion ? "active" : ""}`}
                            onClick={() => updateWidget(selectedWidget.id, { value: suggestion })}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </EditorGroup>
              )}

              {capabilities.showAppearance && (
                <EditorGroup title="Appearance" subtitle="Alignment, colours, and icon style" defaultOpen={false}>
                  <label className="field">
                    <span>Content alignment</span>
                    <select
                      value={selectedWidget.contentAlign}
                      onChange={(event) =>
                        updateWidget(selectedWidget.id, {
                          contentAlign: event.target.value as WidgetConfig["contentAlign"]
                        })
                      }
                    >
                      {CONTENT_ALIGN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {capabilities.showLabel && (
                    <>
                      <div className="field-grid">
                        <label className="field">
                          <span>Label case</span>
                          <select
                            value={selectedWidget.labelTransform}
                            onChange={(event) =>
                              updateWidget(selectedWidget.id, {
                                labelTransform: event.target.value as WidgetConfig["labelTransform"]
                              })
                            }
                          >
                            {TEXT_TRANSFORM_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Label weight</span>
                          <select
                            value={selectedWidget.labelWeight}
                            onChange={(event) =>
                              updateWidget(selectedWidget.id, {
                                labelWeight: event.target.value as WidgetConfig["labelWeight"]
                              })
                            }
                          >
                            {FONT_WEIGHT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <ColorField
                        label="Label colour"
                        value={selectedWidget.labelColor}
                        onChange={(value) => updateWidget(selectedWidget.id, { labelColor: value })}
                      />
                    </>
                  )}

                  {capabilities.showValueAppearance && (
                    <>
                      <label className="field">
                        <span>Value weight</span>
                        <select
                          value={selectedWidget.valueWeight}
                          onChange={(event) =>
                            updateWidget(selectedWidget.id, {
                              valueWeight: event.target.value as WidgetConfig["valueWeight"]
                            })
                          }
                        >
                          {FONT_WEIGHT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <ColorField
                        label="Value colour"
                        value={selectedWidget.valueColor}
                        onChange={(value) => updateWidget(selectedWidget.id, { valueColor: value })}
                      />
                    </>
                  )}

                  {capabilities.showIcon && (
                    <>
                      <ColorField
                        label="Icon colour"
                        value={selectedWidget.iconColor}
                        onChange={(value) => updateWidget(selectedWidget.id, { iconColor: value })}
                      />

                      <label className="field">
                        <span>Icon</span>
                        <input
                          type="text"
                          value={iconQuery}
                          list="mdi-icons"
                          placeholder="Search MDI icons, for example weather-partly-cloudy"
                          onChange={(event) => {
                            const nextValue = event.target.value.replace(/^mdi:/i, "");
                            setIconQuery(nextValue);
                            updateWidget(selectedWidget.id, { icon: nextValue });
                          }}
                        />
                      </label>
                      <div className="scope-toggle">
                        <button
                          type="button"
                          className={iconScope === "panel" ? "scope-active" : ""}
                          onClick={() => setIconScope("panel")}
                        >
                          Panel-safe icons
                        </button>
                        <button
                          type="button"
                          className={iconScope === "all" ? "scope-active" : ""}
                          onClick={() => setIconScope("all")}
                        >
                          All MDI icons
                        </button>
                      </div>
                      <p className={`field-hint ${isPanelSafeIcon ? "" : "field-warning"}`}>
                        {isPanelSafeIcon
                          ? "This icon is supported by the physical panel mapping."
                          : "This icon currently only works in the web preview. Pick a panel-safe icon for the touchscreen."}
                      </p>
                      <datalist id="mdi-icons">
                        {MDI_ICON_NAMES.map((iconName) => (
                          <option key={iconName} value={iconName} />
                        ))}
                      </datalist>

                      <div className="icon-picker">
                        <div className="icon-picker-header">
                          <span>Matching MDI icons</span>
                          <span>{filteredIcons.length} shown</span>
                        </div>
                        <div className="icon-preview">
                          <MdiIcon icon={selectedWidget.icon} className="editor-icon-preview" />
                          <strong>{selectedWidget.icon || "No icon selected"}</strong>
                        </div>
                        <div className="icon-results">
                          {filteredIcons.map((iconName) => (
                            <button
                              key={iconName}
                              type="button"
                              className={`icon-option ${selectedWidget.icon === iconName ? "active" : ""}`}
                              onClick={() => {
                                setIconQuery(iconName);
                                updateWidget(selectedWidget.id, { icon: iconName });
                              }}
                            >
                              <MdiIcon icon={iconName} className="icon-option-glyph" />
                              <span>{iconName}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="field-grid">
                    {capabilities.showIcon && (
                      <label className="field">
                        <span>Icon size %</span>
                        <input
                          type="range"
                          min={60}
                          max={180}
                          value={selectedWidget.iconScale}
                          onChange={(event) => updateWidget(selectedWidget.id, { iconScale: Number.parseInt(event.target.value, 10) })}
                        />
                        <small className="range-value">{selectedWidget.iconScale}%</small>
                      </label>
                    )}
                    {capabilities.showLabel && (
                      <label className="field">
                        <span>Label size %</span>
                        <input
                          type="range"
                          min={60}
                          max={180}
                          value={selectedWidget.labelScale}
                          onChange={(event) => updateWidget(selectedWidget.id, { labelScale: Number.parseInt(event.target.value, 10) })}
                        />
                        <small className="range-value">{selectedWidget.labelScale}%</small>
                      </label>
                    )}
                    {capabilities.showValueAppearance && (
                      <label className="field">
                        <span>Value size %</span>
                        <input
                          type="range"
                          min={60}
                          max={180}
                          value={selectedWidget.valueScale}
                          onChange={(event) => updateWidget(selectedWidget.id, { valueScale: Number.parseInt(event.target.value, 10) })}
                        />
                        <small className="range-value">{selectedWidget.valueScale}%</small>
                      </label>
                    )}
                  </div>
                </EditorGroup>
              )}

              {(capabilities.showValueSource || capabilities.showAction) && (
                <EditorGroup title="Data And Actions" subtitle="Only shown when this type needs it" defaultOpen={false}>
                  {capabilities.showValueSource && (
                    <>
                      <label className="field">
                        <span>Value Source</span>
                        <input
                          type="text"
                          list="value-entity-options"
                          value={selectedWidget.valueSource}
                          placeholder={valueSourcePlaceholder(selectedWidget.type)}
                          onChange={(event) => updateWidget(selectedWidget.id, { valueSource: event.target.value })}
                        />
                      </label>
                      <datalist id="value-entity-options">
                        {valueSourceSuggestions.map((entity) => (
                          <option key={`value-${entity.entity_id}`} value={entity.entity_id}>
                            {entity.name}
                          </option>
                        ))}
                      </datalist>
                      <div className="suggestion-block">
                        <div className="suggestion-header">
                          <span>Entity state for widget content</span>
                          <span>{valueSourceSuggestions.length} shown</span>
                        </div>
                        <div className="entity-results">
                          {valueSourceSuggestions.map((entity) => (
                            <button
                              key={`value-entity-${entity.entity_id}`}
                              type="button"
                              className={`entity-option ${selectedWidget.valueSource === entity.entity_id ? "active" : ""}`}
                              onClick={() => updateWidget(selectedWidget.id, { valueSource: entity.entity_id })}
                            >
                              <strong>{entity.name}</strong>
                              <span>{entity.entity_id}</span>
                              <small>
                                {entity.domain} | {entity.state}
                              </small>
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="field-hint">
                        {selectedValueEntity
                          ? `The add-on will copy ${selectedValueEntity.name} into this widget every 15 seconds.`
                          : "Pick an entity here if you want the widget content to follow a sensor, switch, binary sensor, or similar entity."}
                      </p>
                    </>
                  )}

                  {capabilities.showAction && (
                    <>
                      <label className="field">
                        <span>Action Key</span>
                        <input
                          type="text"
                          list="action-keys"
                          value={selectedWidget.action}
                          placeholder={actionPlaceholder(selectedWidget.type)}
                          onChange={(event) => updateWidget(selectedWidget.id, { action: event.target.value })}
                        />
                      </label>
                      <datalist id="action-keys">
                        {actionSuggestions.map((action) => (
                          <option key={action} value={action} />
                        ))}
                      </datalist>
                      <label className="field">
                        <span>Target Entity</span>
                        <input
                          type="text"
                          list="entity-options"
                          value={entityQuery}
                          placeholder="Search Home Assistant entities, for example switch.office_main_light"
                          onChange={(event) => setEntityQuery(event.target.value)}
                        />
                      </label>
                      <datalist id="entity-options">
                        {entitySuggestions.map((entity) => (
                          <option key={entity.entity_id} value={entity.entity_id}>
                            {entity.name}
                          </option>
                        ))}
                      </datalist>
                      <div className="suggestion-block">
                        <div className="suggestion-header">
                          <span>Matching entities</span>
                          <span>{entitySuggestions.length} shown</span>
                        </div>
                        <div className="entity-results">
                          {entitySuggestions.map((entity) => (
                            <button
                              key={entity.entity_id}
                              type="button"
                              className={`entity-option ${selectedWidget.action === entity.entity_id ? "active" : ""}`}
                              onClick={() => {
                                setEntityQuery(entity.entity_id);
                                updateWidget(selectedWidget.id, { action: entity.entity_id });
                              }}
                            >
                              <strong>{entity.name}</strong>
                              <span>{entity.entity_id}</span>
                              <small>
                                {entity.domain} | {entity.state}
                              </small>
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="field-hint">
                        Store a Home Assistant entity ID here to make tap automations much easier to wire up.
                        {selectedActionEntity ? ` Selected: ${selectedActionEntity.name}` : ""}
                      </p>
                      {actionSuggestions.length > 0 && (
                        <div className="suggestion-block">
                          <div className="suggestion-header">
                            <span>Suggested action keys</span>
                          </div>
                          <div className="suggestion-chips">
                            {actionSuggestions.map((action) => (
                              <button
                                key={action}
                                type="button"
                                className={`suggestion-chip ${selectedWidget.action === action ? "active" : ""}`}
                                onClick={() => updateWidget(selectedWidget.id, { action })}
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </EditorGroup>
              )}

              <EditorGroup title="Layout" subtitle="Grid position and size" defaultOpen={false}>
                <div className="field-grid">
                  {(["x", "y", "w", "h"] as const).map((field) => {
                    const max = field === "x" || field === "y" ? GRID_SIZE - 1 : GRID_SIZE;
                    const min = field === "w" || field === "h" ? 1 : 0;
                    return (
                      <label key={field} className="field">
                        <span>{field.toUpperCase()}</span>
                        <input
                          type="number"
                          min={min}
                          max={max}
                          value={selectedWidget[field]}
                          onChange={(event) =>
                            updateWidget(selectedWidget.id, {
                              [field]: Number.parseInt(event.target.value || String(min), 10)
                            } as Partial<WidgetConfig>)
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              </EditorGroup>

              <div className="editor-actions">
                <button className="primary" onClick={() => void handleApplySelected()} disabled={busy}>
                  Apply selected widget
                </button>
                <button className="primary secondary-primary" onClick={() => void handleApplyAll()} disabled={busy}>
                  Apply all changes
                </button>
              </div>
            </>
          )}
        </aside>
      </main>

      {showHelperYaml && (
        <div className="modal-backdrop" onClick={() => setShowHelperYaml(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Helper YAML</h2>
              <div className="modal-actions">
                <button onClick={() => void handleCopyYaml()}>Copy YAML</button>
                <button onClick={() => setShowHelperYaml(false)}>Close</button>
              </div>
            </div>
            <p className="modal-copy">
              Paste this package into Home Assistant, reload helpers, then click <strong>Reload from Home Assistant</strong>.
            </p>
            <textarea readOnly value={helperYaml} />
          </div>
        </div>
      )}
    </div>
  );
}
