import mdiIcons from "@iconify-json/mdi/icons.json";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { applyWidgets, fetchEntities, fetchValueSources, fetchWidgets, reloadWidgets, type EntityOption } from "./api";
import {
  DEFAULT_LAYOUT,
  GRID_SIZE,
  PANEL_THEME_IDS,
  PANEL_THEMES,
  WIDGET_TYPES,
  type PanelTheme,
  type PanelThemeId,
  type WidgetConfig,
  type WidgetResponse
} from "./types";

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
  "speaker",
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
const WIDGET_TYPE_LABELS: Record<WidgetConfig["type"], string> = {
  blank: "Blank spacer",
  clock: "Clock",
  date: "Date",
  button: "Button",
  media: "Media button",
  status: "Sensor / status"
};
const VALUE_PRESETS: Partial<Record<WidgetConfig["type"], string[]>> = {
  button: ["ON", "OFF", "Tap"],
  media: ["idle", "playing", "paused", "stopped"],
  status: ["Online", "Offline", "Ready", "Open", "Closed", "Sunny", "Partly Cloudy", "21.5", "55%"]
};
const ACTION_PRESETS: Partial<Record<WidgetConfig["type"], string[]>> = {
  clock: ["clock"],
  date: ["date"],
  button: ["office_light", "main_light", "front_door", "toggle_light"],
  media: ["https://example.com/stream.mp3", "https://example.com/live.aac"],
  status: ["weather", "temperature", "humidity", "wifi_status", "home_scene", "sofa_status", "system_status"]
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
  const action = type === "button" || type === "status" || type === "media";
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

function widgetStateTone(widget: WidgetConfig) {
  if (widget.widgetBgColor.trim()) {
    return "neutral";
  }
  const value = widget.value.trim().toLowerCase();
  if (widget.type !== "button" && widget.type !== "media") {
    return "neutral";
  }
  if (["on", "open", "opening", "playing", "online", "true", "active", "home"].includes(value)) {
    return "on";
  }
  if (["off", "closed", "closing", "paused", "offline", "false", "inactive", "away"].includes(value)) {
    return "off";
  }
  return "neutral";
}

function effectiveWidgetBg(widget: WidgetConfig, theme: PanelTheme) {
  const override = widget.widgetBgColor.trim().toLowerCase();
  if (!override) {
    return theme.widgetBg;
  }
  if (override === "transparent") {
    return theme.screenBg;
  }
  return override;
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

function applyThemeToWidgets(widgets: WidgetConfig[], theme: PanelTheme) {
  return widgets.map((widget) => ({
    ...widget,
    iconColor: theme.iconColor,
    labelColor: theme.labelColor,
    valueColor: theme.valueColor
  }));
}

function alphaHex(color: string, alpha: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;
}

function previewThemeStyle(theme: PanelTheme): CSSProperties {
  return {
    ["--panel-screen-bg" as string]: theme.screenBg,
    ["--panel-screen-bg-deep" as string]: `color-mix(in srgb, ${theme.screenBg} 82%, black)`,
    ["--panel-screen-bg-soft" as string]: `color-mix(in srgb, ${theme.screenBg} 78%, white)`,
    ["--panel-screen-sheen" as string]: `color-mix(in srgb, ${theme.accent} 26%, transparent)`,
    ["--panel-grid-line" as string]: alphaHex(theme.widgetBorder, "2b"),
    ["--panel-grid-text" as string]: alphaHex(theme.labelColor, "8f"),
    ["--widget-bg-color" as string]: theme.widgetBg,
    ["--widget-border-color" as string]: theme.widgetBorder,
    ["--button-on-bg-color" as string]: theme.buttonOnBg,
    ["--button-off-bg-color" as string]: theme.buttonOffBg,
    ["--widget-selected-color" as string]: theme.accent,
    ["--widget-blank-color" as string]: theme.valueColor,
    ["--panel-overlay-bg" as string]: theme.overlayBg,
    ["--panel-overlay-title" as string]: theme.overlayTitle,
    ["--panel-overlay-text" as string]: theme.overlayText,
    ["--panel-accent-soft" as string]: alphaHex(theme.accent, "2e"),
    ["--panel-accent-strong" as string]: alphaHex(theme.accent, "66")
  };
}

function customThemeFrom(theme: PanelTheme, patch: Partial<PanelTheme> = {}): PanelTheme {
  return {
    ...theme,
    ...patch,
    id: "custom",
    name: "Custom"
  };
}

function clampWidgetToGrid(widget: WidgetConfig): WidgetConfig {
  const w = clamp(widget.w, 1, GRID_SIZE);
  const h = clamp(widget.h, 1, GRID_SIZE);
  const x = clamp(widget.x, 0, GRID_SIZE - w);
  const y = clamp(widget.y, 0, GRID_SIZE - h);

  if (x === widget.x && y === widget.y && w === widget.w && h === widget.h) {
    return widget;
  }

  return { ...widget, x, y, w, h };
}

function widgetStyle(widget: WidgetConfig, theme: PanelTheme): CSSProperties {
  const tone = widgetStateTone(widget);
  return {
    left: `calc(${(widget.x / GRID_SIZE) * 100}% + 2px)`,
    top: `calc(${(widget.y / GRID_SIZE) * 100}% + 2px)`,
    width: `calc(${(widget.w / GRID_SIZE) * 100}% - 4px)`,
    height: `calc(${(widget.h / GRID_SIZE) * 100}% - 4px)`,
    ["--widget-bg-color" as string]: effectiveWidgetBg(widget, theme),
    ["--widget-border-color" as string]: theme.widgetBorder,
    ["--widget-border-width" as string]: widget.showBorder ? "2px" : "0px",
    ["--button-on-bg-color" as string]: theme.buttonOnBg,
    ["--button-off-bg-color" as string]: theme.buttonOffBg,
    ["--widget-selected-color" as string]: theme.accent,
    ["--widget-tone" as string]: tone,
    ["--widget-accent-color" as string]: widget.iconColor,
    ["--widget-icon-color" as string]: widget.iconColor,
    ["--widget-label-color" as string]: widget.labelColor,
    ["--widget-value-color" as string]: widget.valueColor
  };
}

type PreviewGeometry = {
  icon: { x: number; y: number; w: number; h: number; font: number };
  label: { x: number; y: number; w: number; h: number; font: number };
  value: { x: number; y: number; w: number; h: number; font: number };
  textAlign: CSSProperties["textAlign"];
};

function previewGeometry(widget: WidgetConfig): PreviewGeometry {
  const showIcon = widget.showIcon && widget.type !== "blank";
  const showLabel = widget.showLabel && widget.type !== "blank";
  const showValue = widget.showValue && widget.type !== "blank";
  const cardW = Math.max(1, widget.w) * 80 - 6;
  const cardH = Math.max(1, widget.h) * 80 - 6;
  const minSide = Math.min(cardW, cardH);
  const autoValue = widget.type === "clock" || widget.type === "date";
  const tall = cardH >= 148;
  const wide = cardW >= 228;
  const centerAligned = widget.contentAlign === "center";
  const endAligned = widget.contentAlign === "end";
  const squareish = cardH >= cardW - 12;
  const tiny = cardW <= 96;
  const stacked = tall || tiny || squareish;
  const padding = clamp(Math.round(minSide / 10), 6, 16);
  const gap = clamp(Math.round(minSide / 18), 4, 12);
  const textAlign: CSSProperties["textAlign"] = centerAligned ? "center" : endAligned ? "right" : "left";

  if (!showIcon && !showLabel && !showValue) {
    return {
      icon: { x: 0, y: 0, w: 0, h: 0, font: 0 },
      label: { x: padding, y: padding, w: Math.max(8, cardW - padding * 2), h: 0, font: 0 },
      value: { x: padding, y: padding, w: Math.max(8, cardW - padding * 2), h: 0, font: 0 },
      textAlign
    };
  }

  if (showValue && !showIcon && !showLabel) {
    const valueBase = autoValue ? cardH / 2 : cardH / 2;
    const valueFont = clamp(Math.round((valueBase * widget.valueScale) / 100), 16, 42);
    return {
      icon: { x: 0, y: 0, w: 0, h: 0, font: 0 },
      label: { x: 0, y: 0, w: 0, h: 0, font: 0 },
      value: {
        x: padding,
        y: Math.max(padding, (cardH - valueFont - 8) / 2),
        w: Math.max(8, cardW - padding * 2),
        h: valueFont + 12,
        font: valueFont
      },
      textAlign: centerAligned || !endAligned ? "center" : "right"
    };
  }

  if (showLabel && !showIcon && !showValue) {
    const labelFont = clamp(Math.round(((tall ? 18 : 16) * widget.labelScale) / 100), 12, 30);
    return {
      icon: { x: 0, y: 0, w: 0, h: 0, font: 0 },
      label: {
        x: padding,
        y: Math.max(padding, (cardH - labelFont - 8) / 2),
        w: Math.max(8, cardW - padding * 2),
        h: labelFont + 12,
        font: labelFont
      },
      value: { x: 0, y: 0, w: 0, h: 0, font: 0 },
      textAlign: centerAligned || !endAligned ? "center" : "right"
    };
  }

  if (showIcon && !showLabel && !showValue) {
    const iconFont = clamp(Math.round(((minSide / 2) * widget.iconScale) / 100), 24, 72);
    const iconW = Math.min(cardW - padding * 2, iconFont + 16);
    return {
      icon: { x: (cardW - iconW) / 2, y: Math.max(padding, (cardH - iconFont - 8) / 2), w: iconW, h: iconFont + 8, font: iconFont },
      label: { x: 0, y: 0, w: 0, h: 0, font: 0 },
      value: { x: 0, y: 0, w: 0, h: 0, font: 0 },
      textAlign: "center"
    };
  }

  if (stacked) {
    let iconFont = clamp(
      Math.round((((showIcon && showLabel && showValue ? minSide / 3 : tall ? minSide / 2 : minSide / 3) * widget.iconScale) / 100)),
      16,
      56
    );
    let labelFont = clamp(Math.round(((tall ? 14 : 12) * widget.labelScale) / 100), 9, 24);
    let valueFont = clamp(Math.round((((autoValue ? cardH / 4 : showIcon && showLabel ? cardH / 6 : cardH / 5) * widget.valueScale) / 100)), 12, 34);
    let stackGap = gap;

    let iconH = showIcon ? iconFont + 6 : 0;
    let labelH = showLabel ? labelFont + 6 : 0;
    let valueH = showValue ? valueFont + 6 : 0;
    let neededH = iconH + labelH + valueH;
    if (showIcon && (showLabel || showValue)) neededH += stackGap;
    if (showLabel && showValue) neededH += stackGap;
    const availableH = Math.max(24, cardH - padding * 2);

    if (neededH > availableH) {
      const fit = availableH / neededH;
      iconFont = showIcon ? clamp(Math.floor(iconFont * fit), 14, iconFont) : 0;
      labelFont = showLabel ? clamp(Math.floor(labelFont * fit), 9, labelFont) : 0;
      valueFont = showValue ? clamp(Math.floor(valueFont * fit), 11, valueFont) : 0;
      stackGap = Math.max(3, Math.floor(stackGap * fit));
      iconH = showIcon ? iconFont + 6 : 0;
      labelH = showLabel ? labelFont + 6 : 0;
      valueH = showValue ? valueFont + 6 : 0;
      neededH = iconH + labelH + valueH;
      if (showIcon && (showLabel || showValue)) neededH += stackGap;
      if (showLabel && showValue) neededH += stackGap;
    }

    const iconW = showIcon ? Math.min(cardW - padding * 2, iconFont + 12) : 0;
    const iconX = showIcon ? (centerAligned ? (cardW - iconW) / 2 : endAligned ? cardW - padding - iconW : padding) : 0;
    const blockY = padding + Math.max(0, Math.floor((availableH - neededH) / 2));
    const labelY = blockY + (showIcon ? iconH + stackGap : 0);
    const valueY = labelY + (showLabel ? labelH + stackGap : 0);

    return {
      icon: { x: iconX, y: blockY, w: iconW, h: iconH, font: showIcon ? iconFont : 0 },
      label: { x: padding, y: labelY, w: Math.max(8, cardW - padding * 2), h: labelH, font: showLabel ? labelFont : 0 },
      value: {
        x: padding,
        y: valueY,
        w: Math.max(8, cardW - padding * 2),
        h: Math.max(showValue ? valueFont + 6 : 0, cardH - valueY - padding),
        font: showValue ? valueFont : 0
      },
      textAlign
    };
  }

  const baseIconFont = clamp(cardH - padding * 2 - (widget.h > 1 ? 18 : 12), 22, 52);
  const iconFont = clamp(Math.round((baseIconFont * widget.iconScale) / 100), 18, 64);
  const labelFont = clamp(Math.round(((cardH / 6) * widget.labelScale) / 100), 10, wide ? 22 : 18);
  const valueBase = autoValue ? cardH / 2 : cardH / 3;
  const valueFont = clamp(Math.round((valueBase * widget.valueScale) / 100), 14, wide ? 40 : 32);
  const iconW = showIcon ? Math.min(iconFont + 12, Math.max(28, Math.round(cardW / 3))) : 0;
  const iconH = showIcon ? iconFont + 8 : 0;
  const textGap = gap + 2;
  const textW = Math.max(24, cardW - padding * 2 - (showIcon ? iconW + textGap : 0));
  const labelX = padding + (showIcon ? iconW + textGap : 0);
  const labelH = showLabel ? labelFont + 8 : 0;
  const textBlockH = labelH + (showLabel && showValue ? gap : 0) + (showValue ? valueFont + 8 : 0);
  const contentH = Math.max(iconH, textBlockH);
  const contentY = padding + Math.max(0, Math.floor((Math.max(24, cardH - padding * 2) - contentH) / 2));
  const labelY = contentY + Math.max(0, Math.floor((contentH - textBlockH) / 2));
  const valueY = labelY + (showLabel ? labelH + gap : 0);

  return {
    icon: { x: padding, y: showIcon ? contentY + Math.max(0, Math.floor((contentH - iconH) / 2)) : 0, w: iconW, h: iconH, font: showIcon ? iconFont : 0 },
    label: { x: labelX, y: labelY, w: textW, h: labelH, font: showLabel ? labelFont : 0 },
    value: {
      x: labelX,
      y: valueY,
      w: textW,
      h: Math.max(valueFont + 8, cardH - valueY - padding),
      font: showValue ? valueFont : 0
    },
    textAlign
  };
}

function transformLabel(label: string, transform: WidgetConfig["labelTransform"]) {
  return transform === "uppercase" ? label.toUpperCase() : label;
}

function MdiIcon({ icon, className, style }: { icon: string; className?: string; style?: CSSProperties }) {
  const iconData = getMdiIcon(icon);

  if (!iconData) {
    return (
      <div className={`widget-icon widget-icon-fallback ${className || ""}`.trim()} style={style}>
        {icon.slice(0, 3).toUpperCase() || "MDI"}
      </div>
    );
  }

  return (
    <svg
      className={`widget-icon ${className || ""}`.trim()}
      style={style}
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
    case "button":
      return "Example: ON or OFF";
    case "media":
      return "Example: playing or stopped";
    case "status":
      return "Example: Online, 21.5, or Partly Cloudy";
    default:
      return "Widget value";
  }
}

function actionPlaceholder(type: WidgetConfig["type"]) {
  switch (type) {
    case "button":
      return "Example: switch.office_main_light";
    case "media":
      return "Example: https://example.com/stream.mp3";
    case "status":
      return "Example: binary_sensor.front_door";
    default:
      return "Example: light.kitchen or automation.goodnight";
  }
}

function valueSourcePlaceholder(type: WidgetConfig["type"]) {
  switch (type) {
    case "status":
      return "Example: sensor.outdoor_temperature, sensor.office_humidity, or binary_sensor.front_door";
    case "button":
      return "Optional: show the state of a related entity";
    case "media":
      return "Target media_player entity, for example media_player.household_panel_speaker";
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
  const [appTheme, setAppTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem("esp-panel-builder-app-theme") === "dark" ? "dark" : "light";
  });
  const [status, setStatus] = useState("Loading from Home Assistant...");
  const [statusTone, setStatusTone] = useState<"ok" | "warn" | "error">("warn");
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const [missingHelpers, setMissingHelpers] = useState<string[]>([]);
  const [helperYaml, setHelperYaml] = useState("");
  const [showHelperYaml, setShowHelperYaml] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const [iconScope, setIconScope] = useState<"panel" | "all">("panel");
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [valueSourceEntities, setValueSourceEntities] = useState<EntityOption[]>([]);
  const [entityQuery, setEntityQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewScale, setPreviewScale] = useState(100);
  const [theme, setTheme] = useState<PanelTheme>(PANEL_THEMES.blue);
  const [workspaceTab, setWorkspaceTab] = useState<"theme" | "hidden">("theme");
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
    const actionQuery =
      selectedWidget?.type === "media"
        ? selectedWidget?.valueSource.trim().toLowerCase() || ""
        : selectedWidget?.action.trim().toLowerCase() || "";
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
    () => entities.find((entity) => entity.entity_id === (selectedWidget?.type === "media" ? selectedWidget?.valueSource : selectedWidget?.action)),
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
  const layoutWarnings = useMemo(() => detectWarnings(widgets), [widgets]);
  const warnings = useMemo(() => Array.from(new Set([...serverWarnings, ...layoutWarnings])), [layoutWarnings, serverWarnings]);

  useEffect(() => {
    void loadWidgets();
    void loadEntityOptions(fetchEntities, setEntities);
    void loadEntityOptions(fetchValueSources, setValueSourceEntities);
  }, []);

  useEffect(() => {
    setIconQuery(selectedWidget?.icon || "");
    setEntityQuery(selectedWidget?.type === "media" ? selectedWidget?.valueSource || "" : selectedWidget?.action || "");
  }, [selectedWidget?.id, selectedWidget?.icon, selectedWidget?.action, selectedWidget?.valueSource, selectedWidget?.type]);

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
    document.body.classList.remove("app-theme-light", "app-theme-dark");
    document.body.classList.add(`app-theme-${appTheme}`);
    window.localStorage.setItem("esp-panel-builder-app-theme", appTheme);
    return () => {
      document.body.classList.remove("app-theme-light", "app-theme-dark");
    };
  }, [appTheme]);

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
            if (widget.x === nextX && widget.y === nextY) {
              return widget;
            }
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
          if (widget.w === nextW && widget.h === nextH) {
            return widget;
          }
          return { ...widget, w: nextW, h: nextH };
        })
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      if (interactionRef.current && event.pointerId === interactionRef.current.pointerId) {
        interactionRef.current = null;
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  async function loadWidgets() {
    setBusy(true);
    try {
      const data = await fetchWidgets();
      const loadedFromFallback = Boolean(data.error);
      hydrateResponse(data, loadedFromFallback ? "Loaded fallback layout" : "Connected to Home Assistant");
      setStatusTone(loadedFromFallback || data.missingHelpers.length > 0 ? "warn" : "ok");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load widgets");
      setStatusTone("error");
      setServerWarnings(["Using local defaults until Home Assistant responds."]);
    } finally {
      setBusy(false);
    }
  }

  async function loadEntityOptions(
    loader: () => Promise<{ entities: EntityOption[] }>,
    assign: (entities: EntityOption[]) => void
  ) {
    try {
      const data = await loader();
      assign(data.entities);
    } catch (error) {
      console.error(error);
    }
  }

  function hydrateResponse(data: WidgetResponse, message: string) {
    setWidgets(data.widgets);
    setDefaults(data.defaults);
    setTheme(data.theme || PANEL_THEMES.blue);
    setHelperYaml(data.helperYaml);
    setServerWarnings(data.warnings);
    setMissingHelpers(data.missingHelpers);
    setSelectedId((current) => (data.widgets.some((widget) => widget.id === current) ? current : data.widgets[0]?.id || "w01"));
    setStatus(message);
  }

  function updateWidget(id: string, patch: Partial<WidgetConfig>) {
    setWidgets((current) => {
      return current.map((widget) => (widget.id === id ? clampWidgetToGrid({ ...widget, ...patch }) : widget));
    });
  }

  async function handleApplyAll() {
    setBusy(true);
    try {
      const result = await applyWidgets(widgets, theme);
      setWidgets(result.widgets);
      setServerWarnings(result.warnings);
      setStatus("All widget helpers updated");
      setStatusTone(result.warnings.length > 0 ? "warn" : "ok");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to apply widgets");
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
    const nextDefaults = applyThemeToWidgets(defaults, theme);
    setWidgets(nextDefaults);
    setServerWarnings([]);
    setStatus("Reset to default layout in the editor");
    setStatusTone("warn");
  }

  function handleThemeChange(nextThemeId: PanelThemeId) {
    const nextTheme = nextThemeId === "custom" ? customThemeFrom(theme) : PANEL_THEMES[nextThemeId];
    setTheme(nextTheme);
    setWidgets((current) => applyThemeToWidgets(current, nextTheme));
    setStatus(`${nextTheme.name} theme ready. Apply all widgets to sync Home Assistant and the panel.`);
    setStatusTone("warn");
  }

  function updateTheme(patch: Partial<PanelTheme>) {
    const nextTheme = customThemeFrom(theme, patch);
    setTheme(nextTheme);
    setWidgets((current) => applyThemeToWidgets(current, nextTheme));
    setStatus("Custom theme updated. Apply all widgets to sync Home Assistant and the panel.");
    setStatusTone("warn");
  }

  async function handleCopyYaml() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
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
    <div className={`app-shell app-theme-${appTheme}`}>
      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">LVGL-Inspired Builder</p>
          <h1>ESP Panel Layout Builder</h1>
          <p className="topbar-subtitle">A richer control-surface editor with live preview styling that tracks the physical panel more closely.</p>
          <div className="topbar-badges">
            <span className="hero-badge">{theme.name} theme</span>
            <span className="hero-badge">{visibleWidgets.length} visible widgets</span>
            <span className="hero-badge">{warnings.length > 0 ? `${warnings.length} warnings` : "Layout clean"}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="app-theme-toggle" aria-label="Builder theme">
            <button
              type="button"
              className={appTheme === "light" ? "app-theme-active" : ""}
              onClick={() => setAppTheme("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={appTheme === "dark" ? "app-theme-active" : ""}
              onClick={() => setAppTheme("dark")}
            >
              Dark
            </button>
          </div>
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

      <main className="workspace-shell">
        <section className="workspace-main">
          <section className="preview-panel preview-panel-sticky">
          <div className="preview-header">
            <div>
              <h2>Panel Preview</h2>
              <p>Live 480x480 view of the physical screen with LVGL-style depth, contrast, and chrome.</p>
            </div>
            <div className="preview-header-tools">
              <label className="preview-zoom" aria-label="Preview zoom">
                <div className="preview-zoom-row">
                  <input
                    type="range"
                    min={25}
                    max={100}
                    step={5}
                    value={previewScale}
                    onChange={(event) => setPreviewScale(Number.parseInt(event.target.value, 10))}
                  />
                  <strong>{previewScale}%</strong>
                </div>
              </label>
              <div className="grid-key">
                <span>Drag cards to move</span>
                <span>Use the corner handle to resize</span>
                <span>Long press opens media controls on device</span>
              </div>
            </div>
          </div>
          <div className="preview-meta-strip">
            <div className="preview-meta-pill">
              <strong>Selected</strong>
              <span>{selectedWidget?.id || "None"}</span>
            </div>
            <div className="preview-meta-pill">
              <strong>Profile</strong>
              <span>{theme.name}</span>
            </div>
            <div className="preview-meta-pill">
              <strong>Surface</strong>
              <span>{previewScale}%</span>
            </div>
          </div>

            <div className="board-wrap">
              <div
                className="board-stage"
                style={{ width: `${480 * (previewScale / 100)}px`, height: `${480 * (previewScale / 100)}px`, ...previewThemeStyle(theme) }}
              >
                <div
                  className="board"
                  ref={boardRef}
                  style={{ transform: `scale(${previewScale / 100})` }}
                >
                  <div className="board-surface-glow" />
                  <div className="board-corner-stamp">LVGL</div>
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
                    const geometry = previewGeometry(widget);

                    return (
                      <button
                        key={widget.id}
                        type="button"
                        className={`widget-card ${selectedId === widget.id ? "selected" : ""} ${widget.type === "blank" ? "blank-widget" : ""}`}
                        style={widgetStyle(widget, theme)}
                        onClick={() => setSelectedId(widget.id)}
                        onPointerDown={(event) => handlePointerStart(event, widget, "drag")}
                      >
                        <span className="widget-sheen" />
                        <div className="widget-meta">
                          <span className="widget-id-pill">{widget.id}</span>
                          <span className="widget-type-pill">{widget.type}</span>
                        </div>
                        {widget.type === "blank" ? (
                          <div className="widget-blank">Blank spacer</div>
                        ) : (
                          <>
                            {widget.showIcon && (
                              <MdiIcon
                                icon={widget.icon}
                                className="widget-preview-icon"
                                style={{
                                  left: `${geometry.icon.x}px`,
                                  top: `${geometry.icon.y}px`,
                                  width: `${geometry.icon.w}px`,
                                  height: `${geometry.icon.h}px`,
                                  fontSize: `${geometry.icon.font}px`
                                }}
                              />
                            )}
                            {widget.showLabel && (
                              <strong
                                className="widget-preview-label"
                                style={{
                                  left: `${geometry.label.x}px`,
                                  top: `${geometry.label.y}px`,
                                  width: `${geometry.label.w}px`,
                                  minHeight: `${geometry.label.h}px`,
                                  fontSize: `${geometry.label.font}px`,
                                  textAlign: geometry.textAlign,
                                  fontWeight: widget.labelWeight
                                }}
                              >
                                {previewLabel}
                              </strong>
                            )}
                            {widget.showValue && (
                              <span
                                className="widget-preview-value"
                                style={{
                                  left: `${geometry.value.x}px`,
                                  top: `${geometry.value.y}px`,
                                  width: `${geometry.value.w}px`,
                                  minHeight: `${geometry.value.h}px`,
                                  fontSize: `${geometry.value.font}px`,
                                  textAlign: geometry.textAlign,
                                  fontWeight: widget.valueWeight
                                }}
                              >
                                {previewValue}
                              </span>
                            )}
                          </>
                        )}
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
            <p className="preview-caption">Cards, borders, overlays, and accent treatment are styled to follow the same design language as the updated physical panel.</p>
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
                        {WIDGET_TYPE_LABELS[type]}
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

                  <div className="field-grid">
                    <label className="field checkbox-field">
                      <span>Show border</span>
                      <input
                        type="checkbox"
                        checked={selectedWidget.showBorder}
                        onChange={(event) => updateWidget(selectedWidget.id, { showBorder: event.target.checked })}
                      />
                    </label>
                    <label className="field checkbox-field">
                      <span>Show icon</span>
                      <input
                        type="checkbox"
                        checked={selectedWidget.showIcon}
                        onChange={(event) => updateWidget(selectedWidget.id, { showIcon: event.target.checked })}
                      />
                    </label>
                    <label className="field checkbox-field">
                      <span>Show label</span>
                      <input
                        type="checkbox"
                        checked={selectedWidget.showLabel}
                        onChange={(event) => updateWidget(selectedWidget.id, { showLabel: event.target.checked })}
                      />
                    </label>
                    <label className="field checkbox-field">
                      <span>Show value</span>
                      <input
                        type="checkbox"
                        checked={selectedWidget.showValue}
                        onChange={(event) => updateWidget(selectedWidget.id, { showValue: event.target.checked })}
                      />
                    </label>
                  </div>

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
                        label="Widget background override"
                        value={selectedWidget.widgetBgColor}
                        onChange={(value) => updateWidget(selectedWidget.id, { widgetBgColor: value })}
                      />
                      <div className="scope-toggle">
                        <button
                          type="button"
                          className={selectedWidget.widgetBgColor.trim() === "" ? "scope-active" : ""}
                          onClick={() => updateWidget(selectedWidget.id, { widgetBgColor: "" })}
                        >
                          Use theme
                        </button>
                        <button
                          type="button"
                          className={selectedWidget.widgetBgColor.trim().toLowerCase() === "transparent" ? "scope-active" : ""}
                          onClick={() => updateWidget(selectedWidget.id, { widgetBgColor: "transparent" })}
                        >
                          Transparent
                        </button>
                      </div>
                      <p className="field-hint">Leave blank to follow the theme, or use `transparent` to match the screen background.</p>
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
                          min={25}
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
                          min={25}
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
                          min={25}
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
                        <span>{selectedWidget.type === "media" ? "Target Player" : "Value Source"}</span>
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
                          <span>{selectedWidget.type === "media" ? "Media player targets" : "Entity state for widget content"}</span>
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
                        {selectedWidget.type === "media"
                          ? selectedValueEntity
                            ? `Tap will control ${selectedValueEntity.name} and use the stream URL below.`
                            : "Pick the Home Assistant media_player entity this button should control on the physical panel."
                          : selectedValueEntity
                            ? `The add-on will copy ${selectedValueEntity.name} into this widget roughly every 15 seconds.`
                            : "Pick an entity here if you want the widget content to follow a sensor, switch, binary sensor, or similar entity."}
                      </p>
                    </>
                  )}

                  {capabilities.showAction && (
                    <>
                      <label className="field">
                        <span>{selectedWidget.type === "media" ? "Stream URL" : "Action / Entity ID"}</span>
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
                        <span>{selectedWidget.type === "media" ? "Browse Player Entity" : "Browse Home Assistant entities"}</span>
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
                              className={`entity-option ${(selectedWidget.type === "media" ? selectedWidget.valueSource : selectedWidget.action) === entity.entity_id ? "active" : ""}`}
                              onClick={() => {
                                setEntityQuery(entity.entity_id);
                                updateWidget(selectedWidget.id, selectedWidget.type === "media" ? { valueSource: entity.entity_id } : { action: entity.entity_id });
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
                        {selectedWidget.type === "media"
                          ? "For media widgets, use the player picker above and put the stream URL in the Stream URL field."
                          : `Store a Home Assistant entity ID here to make tap automations much easier to wire up.${selectedActionEntity ? ` Selected: ${selectedActionEntity.name}` : ""}`}
                      </p>
                      {actionSuggestions.length > 0 && (
                        <div className="suggestion-block">
                          <div className="suggestion-header">
                            <span>Suggested actions</span>
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
                    const max =
                      field === "x"
                        ? GRID_SIZE - selectedWidget.w
                        : field === "y"
                          ? GRID_SIZE - selectedWidget.h
                          : field === "w"
                            ? GRID_SIZE - selectedWidget.x
                            : GRID_SIZE - selectedWidget.y;
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
                <button className="primary secondary-primary" onClick={() => void handleApplyAll()} disabled={busy}>
                  Apply all changes
                </button>
              </div>
            </>
          )}
        </aside>
        </section>

        <section className="workbench-panel">
          <div className="workbench-header">
            <div>
              <h2>Screen Workspace</h2>
              <p>Theme the dashboard, manage hidden cards, and keep the preview and panel visuals aligned.</p>
            </div>
            <div className="workbench-meta">
              <span>{visibleWidgets.length} visible widgets</span>
              <span>{hiddenWidgets.length} hidden widgets</span>
            </div>
          </div>

          <div className="workbench-toolbar">
            <div className="workspace-tabbar" aria-label="Workspace sections">
              <button
                type="button"
                className={workspaceTab === "theme" ? "workspace-tab-active" : ""}
                onClick={() => setWorkspaceTab("theme")}
              >
                Theme
              </button>
              <button
                type="button"
                className={workspaceTab === "hidden" ? "workspace-tab-active" : ""}
                onClick={() => setWorkspaceTab("hidden")}
              >
                Hidden Widgets
              </button>
            </div>
          </div>

          {workspaceTab === "theme" && (
            <div className="workbench-section">
              <div className="theme-toggle" aria-label="Panel theme">
                {PANEL_THEME_IDS.map((themeId) => (
                  <button
                    key={themeId}
                    type="button"
                    className={theme.id === themeId ? "theme-active" : ""}
                    onClick={() => handleThemeChange(themeId)}
                  >
                    {PANEL_THEMES[themeId].name}
                  </button>
                ))}
              </div>
              <EditorGroup title="Theme Colors" subtitle="Screen, card, border, text, and overlay palette" defaultOpen>
                <ColorField label="Screen background" value={theme.screenBg} onChange={(value) => updateTheme({ screenBg: value })} />
                <ColorField label="Widget background" value={theme.widgetBg} onChange={(value) => updateTheme({ widgetBg: value })} />
                <ColorField label="Widget border" value={theme.widgetBorder} onChange={(value) => updateTheme({ widgetBorder: value })} />
                <ColorField label="Button on background" value={theme.buttonOnBg} onChange={(value) => updateTheme({ buttonOnBg: value })} />
                <ColorField label="Button off background" value={theme.buttonOffBg} onChange={(value) => updateTheme({ buttonOffBg: value })} />
                <ColorField label="Accent" value={theme.accent} onChange={(value) => updateTheme({ accent: value })} />
                <ColorField label="Icon color" value={theme.iconColor} onChange={(value) => updateTheme({ iconColor: value })} />
                <ColorField label="Label color" value={theme.labelColor} onChange={(value) => updateTheme({ labelColor: value })} />
                <ColorField label="Value color" value={theme.valueColor} onChange={(value) => updateTheme({ valueColor: value })} />
                <ColorField label="Overlay background" value={theme.overlayBg} onChange={(value) => updateTheme({ overlayBg: value })} />
                <ColorField label="Overlay title" value={theme.overlayTitle} onChange={(value) => updateTheme({ overlayTitle: value })} />
                <ColorField label="Overlay text" value={theme.overlayText} onChange={(value) => updateTheme({ overlayText: value })} />
              </EditorGroup>
            </div>
          )}

          {workspaceTab === "hidden" && (
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
          )}
        </section>
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
