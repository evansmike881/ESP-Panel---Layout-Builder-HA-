import express from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const LAYOUT_STORE_PATH = path.join(DATA_DIR, "layout-config.json");

const PORT = Number.parseInt(process.env.PORT || "8099", 10);
const HASS_URL = process.env.HASS_URL || "http://supervisor/core/api";
const TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN || "";
const VALUE_SOURCE_SYNC_INTERVAL_MS = Math.max(
  1000,
  Number.parseInt(process.env.VALUE_SOURCE_SYNC_INTERVAL_MS || "15000", 10) || 15000
);
const GRID_SIZE = 6;
const WIDGET_IDS = ["w01", "w02", "w03", "w04", "w05", "w06", "w07", "w08", "w09", "w10", "w11", "w12"];
const PANEL_THEME_IDS = ["light", "dark", "blue", "red", "green", "custom"];
const ACTION_ENTITY_DOMAINS = new Set([
  "light",
  "switch",
  "scene",
  "script",
  "fan",
  "cover",
  "lock",
  "climate",
  "media_player",
  "input_boolean",
  "input_select",
  "automation",
  "button"
]);
const VALUE_SOURCE_ENTITY_DOMAINS = new Set([
  ...ACTION_ENTITY_DOMAINS,
  "sensor",
  "binary_sensor",
  "person",
  "device_tracker",
  "sun",
  "weather",
  "vacuum"
]);
const WIDGET_TYPES = [
  "blank",
  "clock",
  "date",
  "button",
  "media",
  "status"
];
const LEGACY_WIDGET_TYPE_MAP = {
  weather: "status",
  temperature: "status",
  humidity: "status"
};
const CONTENT_ALIGN_OPTIONS = ["start", "center", "end"];
const TEXT_TRANSFORM_OPTIONS = ["none", "uppercase"];
const FONT_WEIGHT_OPTIONS = ["normal", "bold"];
const PANEL_THEMES = {
  light: {
    id: "light",
    name: "Light",
    screenBg: "#f3f6fb",
    widgetBg: "#ffffff",
    widgetBorder: "#d4deee",
    buttonOnBg: "#b7f7cb",
    buttonOffBg: "#d8dee9",
    iconColor: "#2563eb",
    labelColor: "#5b6f8d",
    valueColor: "#14213d",
    overlayBg: "#d8e4f4",
    overlayTitle: "#1d4ed8",
    overlayText: "#14213d",
    accent: "#2563eb"
  },
  dark: {
    id: "dark",
    name: "Dark",
    screenBg: "#050814",
    widgetBg: "#101826",
    widgetBorder: "#283548",
    buttonOnBg: "#147452",
    buttonOffBg: "#1f2937",
    iconColor: "#f59e0b",
    labelColor: "#8ea4c2",
    valueColor: "#f8fbff",
    overlayBg: "#000000",
    overlayTitle: "#f59e0b",
    overlayText: "#f8fbff",
    accent: "#f59e0b"
  },
  blue: {
    id: "blue",
    name: "Blue",
    screenBg: "#08142d",
    widgetBg: "#0d1b33",
    widgetBorder: "#285ea8",
    buttonOnBg: "#14b8a6",
    buttonOffBg: "#1f2937",
    iconColor: "#ffd166",
    labelColor: "#a8c3ea",
    valueColor: "#f1f5f9",
    overlayBg: "#06101f",
    overlayTitle: "#ffd166",
    overlayText: "#f1f5f9",
    accent: "#3b82f6"
  },
  red: {
    id: "red",
    name: "Red",
    screenBg: "#2a0b12",
    widgetBg: "#48121d",
    widgetBorder: "#7f1d1d",
    buttonOnBg: "#16a34a",
    buttonOffBg: "#3f3f46",
    iconColor: "#fca5a5",
    labelColor: "#fecaca",
    valueColor: "#fff1f2",
    overlayBg: "#140509",
    overlayTitle: "#fb7185",
    overlayText: "#fff1f2",
    accent: "#ef4444"
  },
  green: {
    id: "green",
    name: "Green",
    screenBg: "#071b14",
    widgetBg: "#0e2a20",
    widgetBorder: "#1f6f54",
    buttonOnBg: "#22c55e",
    buttonOffBg: "#1f2937",
    iconColor: "#86efac",
    labelColor: "#b7f7cb",
    valueColor: "#f0fdf4",
    overlayBg: "#04110d",
    overlayTitle: "#4ade80",
    overlayText: "#f0fdf4",
    accent: "#22c55e"
  },
  custom: {
    id: "custom",
    name: "Custom",
    screenBg: "#08142d",
    widgetBg: "#0d1b33",
    widgetBorder: "#285ea8",
    buttonOnBg: "#14b8a6",
    buttonOffBg: "#1f2937",
    iconColor: "#ffd166",
    labelColor: "#a8c3ea",
    valueColor: "#f1f5f9",
    overlayBg: "#06101f",
    overlayTitle: "#ffd166",
    overlayText: "#f1f5f9",
    accent: "#3b82f6"
  }
};
const DEFAULT_STYLE = {
  showBorder: true,
  showIcon: true,
  showLabel: true,
  showValue: true,
  widgetBgColor: "",
  contentAlign: "start",
  labelTransform: "none",
  labelWeight: "bold",
  valueWeight: "normal",
  iconColor: PANEL_THEMES.blue.iconColor,
  labelColor: PANEL_THEMES.blue.labelColor,
  valueColor: PANEL_THEMES.blue.valueColor,
  iconScale: 100,
  labelScale: 100,
  valueScale: 100
};
const DEFAULT_LAYOUT = [
  { id: "w01", type: "clock", visible: true, label: "Clock", value: "--:--", valueSource: "", icon: "clock", action: "clock", x: 0, y: 0, w: 3, h: 1, ...DEFAULT_STYLE },
  { id: "w02", type: "date", visible: true, label: "Date", value: "--", valueSource: "", icon: "calendar", action: "date", x: 3, y: 0, w: 3, h: 1, ...DEFAULT_STYLE },
  { id: "w03", type: "status", visible: true, label: "Weather", value: "Partly Cloudy", valueSource: "", icon: "weather-partly-cloudy", action: "weather", x: 0, y: 1, w: 3, h: 1, ...DEFAULT_STYLE },
  { id: "w04", type: "status", visible: true, label: "Temp", value: "12.5", valueSource: "", icon: "thermometer", action: "temperature", x: 3, y: 1, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w05", type: "status", visible: true, label: "Humidity", value: "80", valueSource: "", icon: "water-percent", action: "humidity", x: 5, y: 1, w: 1, h: 1, ...DEFAULT_STYLE },
  { id: "w06", type: "button", visible: true, label: "Main Light", value: "OFF", valueSource: "switch.office_main_light", icon: "ceiling-light", action: "switch.office_main_light", x: 0, y: 4, w: 2, h: 2, ...DEFAULT_STYLE },
  { id: "w07", type: "status", visible: false, label: "WiFi", value: "Online", valueSource: "", icon: "wifi", action: "wifi_status", x: 2, y: 4, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w08", type: "status", visible: false, label: "Scene", value: "Home", valueSource: "", icon: "home", action: "home_scene", x: 2, y: 5, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w09", type: "button", visible: false, label: "Door", value: "Closed", valueSource: "", icon: "door", action: "", x: 4, y: 4, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w10", type: "status", visible: false, label: "Sofa", value: "Ready", valueSource: "", icon: "sofa", action: "sofa_status", x: 4, y: 5, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w11", type: "blank", visible: false, label: "Blank", value: "", valueSource: "", icon: "shape", action: "", x: 0, y: 2, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w12", type: "blank", visible: false, label: "Blank", value: "", valueSource: "", icon: "shape", action: "", x: 2, y: 2, w: 2, h: 1, ...DEFAULT_STYLE }
];
const DEFAULT_WIDGETS_BY_ID = new Map(DEFAULT_LAYOUT.map((widget) => [widget.id, widget]));
const HELPER_YAML = helperPackageYaml();

const app = express();
app.use(express.json({ limit: "1mb" }));

function log(message, extra) {
  if (extra !== undefined) {
    console.log(`[ESP Panel Layout Builder] ${message}`, extra);
    return;
  }
  console.log(`[ESP Panel Layout Builder] ${message}`);
}

function helperMap(id) {
  return {
    type: `input_select.esp_panel_${id}_type`,
    visible: `input_boolean.esp_panel_${id}_visible`,
    showBorder: `input_boolean.esp_panel_${id}_show_border`,
    showIcon: `input_boolean.esp_panel_${id}_show_icon`,
    showLabel: `input_boolean.esp_panel_${id}_show_label`,
    showValue: `input_boolean.esp_panel_${id}_show_value`,
    widgetBgColor: `input_text.esp_panel_${id}_bg_color`,
    label: `input_text.esp_panel_${id}_label`,
    value: `input_text.esp_panel_${id}_value`,
    valueSource: `input_text.esp_panel_${id}_value_source`,
    icon: `input_text.esp_panel_${id}_icon`,
    action: `input_text.esp_panel_${id}_action`,
    contentAlign: `input_select.esp_panel_${id}_content_align`,
    labelTransform: `input_select.esp_panel_${id}_label_transform`,
    labelWeight: `input_select.esp_panel_${id}_label_weight`,
    valueWeight: `input_select.esp_panel_${id}_value_weight`,
    iconColor: `input_text.esp_panel_${id}_icon_color`,
    labelColor: `input_text.esp_panel_${id}_label_color`,
    valueColor: `input_text.esp_panel_${id}_value_color`,
    iconScale: `input_number.esp_panel_${id}_icon_scale`,
    labelScale: `input_number.esp_panel_${id}_label_scale`,
    valueScale: `input_number.esp_panel_${id}_value_scale`,
    x: `input_number.esp_panel_${id}_x`,
    y: `input_number.esp_panel_${id}_y`,
    w: `input_number.esp_panel_${id}_w`,
    h: `input_number.esp_panel_${id}_h`
  };
}

function themeHelperMap() {
  return {
    theme: "input_select.esp_panel_theme",
    screenBg: "input_text.esp_panel_screen_bg_color",
    widgetBg: "input_text.esp_panel_widget_bg_color",
    widgetBorder: "input_text.esp_panel_widget_border_color",
    buttonOnBg: "input_text.esp_panel_button_on_bg_color",
    buttonOffBg: "input_text.esp_panel_button_off_bg_color",
    overlayBg: "input_text.esp_panel_overlay_bg_color",
    overlayTitle: "input_text.esp_panel_overlay_title_color",
    overlayText: "input_text.esp_panel_overlay_text_color"
  };
}

function copyDefaultWidget(id) {
  const widget = DEFAULT_WIDGETS_BY_ID.get(id);
  if (!widget) {
    throw new Error(`Default widget definition missing for ${id}`);
  }
  return { ...widget };
}

function copyDefaultTheme(id = "blue") {
  const theme = PANEL_THEMES[id] || PANEL_THEMES.blue;
  return { ...theme };
}

function normalizeText(value) {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function encodeRuntimeText(value) {
  return encodeURIComponent(normalizeText(value));
}

function looksLikeEntityId(value) {
  const normalized = normalizeText(value).trim();
  return /^[a-z0-9_]+\.[a-z0-9_]+$/i.test(normalized);
}

function runtimeActionValue(widget) {
  if (looksLikeEntityId(widget.action)) {
    return widget.action;
  }
  if (widget.type === "media") {
    const target = looksLikeEntityId(widget.valueSource) ? widget.valueSource.trim() : "";
    const streamUrl = normalizeText(widget.action).trim();
    if (target && streamUrl) {
      return `media|${target}|${streamUrl}`;
    }
  }
  if (widget.type === "button" && looksLikeEntityId(widget.valueSource)) {
    return widget.valueSource;
  }
  return widget.action;
}

function runtimeWidgetConfigValue(widget) {
  return [
    widget.type,
    widget.visible ? "1" : "0",
    widget.showBorder ? "1" : "0",
    widget.showIcon ? "1" : "0",
    widget.showLabel ? "1" : "0",
    widget.showValue ? "1" : "0",
    widget.widgetBgColor,
    widget.label,
    widget.icon,
    widget.contentAlign,
    "auto",
    widget.labelTransform,
    widget.labelWeight,
    widget.valueWeight,
    widget.iconColor,
    widget.labelColor,
    widget.valueColor,
    String(widget.iconScale),
    String(widget.labelScale),
    String(widget.valueScale),
    String(widget.x),
    String(widget.y),
    String(widget.w),
    String(widget.h)
  ].map(encodeRuntimeText).join("|");
}

function runtimeThemeConfigValue(theme) {
  return [
    theme.id,
    theme.screenBg,
    theme.widgetBg,
    theme.widgetBorder,
    theme.buttonOnBg,
    theme.buttonOffBg,
    theme.overlayBg,
    theme.overlayTitle,
    theme.overlayText
  ].map(encodeRuntimeText).join("|");
}

function runtimeHelperMap(id) {
  return {
    config: `input_text.esp_panel_runtime_${id}_config`,
    value: `input_text.esp_panel_runtime_${id}_value`,
    action: `input_text.esp_panel_runtime_${id}_action`
  };
}

function runtimeThemeHelper() {
  return "input_text.esp_panel_runtime_theme";
}

function normalizeWidgetType(value, fallback) {
  if (WIDGET_TYPES.includes(value)) {
    return value;
  }
  if (value && LEGACY_WIDGET_TYPE_MAP[value]) {
    return LEGACY_WIDGET_TYPE_MAP[value];
  }
  return fallback;
}

function normalizeNumber(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOption(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeColor(value, fallback) {
  const normalized = normalizeText(value).trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
}

function normalizeWidgetBgColor(value, fallback = "") {
  const normalized = normalizeText(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === "transparent") {
    return "transparent";
  }
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function sanitizeTheme(input) {
  const baseTheme = copyDefaultTheme(input?.id);
  return {
    ...baseTheme,
    screenBg: normalizeColor(input?.screenBg, baseTheme.screenBg),
    widgetBg: normalizeColor(input?.widgetBg, baseTheme.widgetBg),
    widgetBorder: normalizeColor(input?.widgetBorder, baseTheme.widgetBorder),
    buttonOnBg: normalizeColor(input?.buttonOnBg, baseTheme.buttonOnBg),
    buttonOffBg: normalizeColor(input?.buttonOffBg, baseTheme.buttonOffBg),
    iconColor: normalizeColor(input?.iconColor, baseTheme.iconColor),
    labelColor: normalizeColor(input?.labelColor, baseTheme.labelColor),
    valueColor: normalizeColor(input?.valueColor, baseTheme.valueColor),
    overlayBg: normalizeColor(input?.overlayBg, baseTheme.overlayBg),
    overlayTitle: normalizeColor(input?.overlayTitle, baseTheme.overlayTitle),
    overlayText: normalizeColor(input?.overlayText, baseTheme.overlayText),
    accent: normalizeColor(input?.accent, baseTheme.accent)
  };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStoredConfigFile() {
  try {
    const raw = await fs.readFile(LAYOUT_STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeStoredConfigFile(config) {
  await ensureDataDir();
  await fs.writeFile(LAYOUT_STORE_PATH, JSON.stringify(config, null, 2));
}

function validateWidget(widget) {
  const errors = [];

  if (!WIDGET_IDS.includes(widget.id)) {
    errors.push(`Unknown widget id: ${widget.id}`);
  }
  if (!WIDGET_TYPES.includes(widget.type)) {
    errors.push(`Invalid widget type for ${widget.id}: ${widget.type}`);
  }
  ["visible", "showBorder", "showIcon", "showLabel", "showValue"].forEach((field) => {
    if (typeof widget[field] !== "boolean") {
      errors.push(`${widget.id} ${field} must be true or false`);
    }
  });
  if (!CONTENT_ALIGN_OPTIONS.includes(widget.contentAlign)) {
    errors.push(`${widget.id} contentAlign must be start, center, or end`);
  }
  if (!TEXT_TRANSFORM_OPTIONS.includes(widget.labelTransform)) {
    errors.push(`${widget.id} labelTransform must be none or uppercase`);
  }
  if (!FONT_WEIGHT_OPTIONS.includes(widget.labelWeight)) {
    errors.push(`${widget.id} labelWeight must be normal or bold`);
  }
  if (!FONT_WEIGHT_OPTIONS.includes(widget.valueWeight)) {
    errors.push(`${widget.id} valueWeight must be normal or bold`);
  }
  ["iconScale", "labelScale", "valueScale", "x", "y", "w", "h"].forEach((field) => {
    if (!Number.isInteger(widget[field])) {
      errors.push(`${widget.id} ${field} must be an integer`);
    }
  });
  ["iconColor", "labelColor", "valueColor"].forEach((field) => {
    if (!/^#[0-9a-f]{6}$/i.test(widget[field])) {
      errors.push(`${widget.id} ${field} must be a hex color like #ffffff`);
    }
  });
  if (widget.widgetBgColor && widget.widgetBgColor !== "transparent" && !/^#[0-9a-f]{6}$/i.test(widget.widgetBgColor)) {
    errors.push(`${widget.id} widgetBgColor must be blank, transparent, or a hex color like #ffffff`);
  }
  ["iconScale", "labelScale", "valueScale"].forEach((field) => {
    if (widget[field] < 25 || widget[field] > 180) {
      errors.push(`${widget.id} ${field} must be between 25 and 180`);
    }
  });
  if (widget.x < 0 || widget.x > GRID_SIZE - 1) {
    errors.push(`${widget.id} x must be between 0 and 5`);
  }
  if (widget.y < 0 || widget.y > GRID_SIZE - 1) {
    errors.push(`${widget.id} y must be between 0 and 5`);
  }
  if (widget.w < 1 || widget.w > GRID_SIZE) {
    errors.push(`${widget.id} w must be between 1 and 6`);
  }
  if (widget.h < 1 || widget.h > GRID_SIZE) {
    errors.push(`${widget.id} h must be between 1 and 6`);
  }
  if (widget.x + widget.w > GRID_SIZE) {
    errors.push(`${widget.id} extends past the right edge of the grid`);
  }
  if (widget.y + widget.h > GRID_SIZE) {
    errors.push(`${widget.id} extends past the bottom edge of the grid`);
  }

  return errors;
}

function findOverlapWarnings(widgets) {
  const warnings = [];
  for (let index = 0; index < widgets.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < widgets.length; otherIndex += 1) {
      const a = widgets[index];
      const b = widgets[otherIndex];
      const overlaps =
        a.visible &&
        b.visible &&
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;

      if (overlaps) {
        warnings.push(`Widgets ${a.id} and ${b.id} overlap on the 6x6 grid.`);
      }
    }
  }
  return warnings;
}

function sanitizeWidget(input, fallback) {
  const widget = {
    id: input?.id || fallback.id,
    type: normalizeWidgetType(input?.type, fallback.type),
    visible: typeof input?.visible === "boolean" ? input.visible : fallback.visible,
    showBorder: typeof input?.showBorder === "boolean" ? input.showBorder : fallback.showBorder,
    showIcon: typeof input?.showIcon === "boolean" ? input.showIcon : fallback.showIcon,
    showLabel: typeof input?.showLabel === "boolean" ? input.showLabel : fallback.showLabel,
    showValue: typeof input?.showValue === "boolean" ? input.showValue : fallback.showValue,
    widgetBgColor: normalizeWidgetBgColor(input?.widgetBgColor, fallback.widgetBgColor),
    label: normalizeText(input?.label ?? fallback.label),
    value: normalizeText(input?.value ?? fallback.value),
    valueSource: normalizeText(input?.valueSource ?? fallback.valueSource),
    icon: normalizeText(input?.icon ?? fallback.icon),
    action: normalizeText(input?.action ?? fallback.action),
    contentAlign: normalizeOption(input?.contentAlign, CONTENT_ALIGN_OPTIONS, fallback.contentAlign),
    labelTransform: normalizeOption(input?.labelTransform, TEXT_TRANSFORM_OPTIONS, fallback.labelTransform),
    labelWeight: normalizeOption(input?.labelWeight, FONT_WEIGHT_OPTIONS, fallback.labelWeight),
    valueWeight: normalizeOption(input?.valueWeight, FONT_WEIGHT_OPTIONS, fallback.valueWeight),
    iconColor: normalizeColor(input?.iconColor, fallback.iconColor),
    labelColor: normalizeColor(input?.labelColor, fallback.labelColor),
    valueColor: normalizeColor(input?.valueColor, fallback.valueColor),
    iconScale: normalizeNumber(input?.iconScale, fallback.iconScale),
    labelScale: normalizeNumber(input?.labelScale, fallback.labelScale),
    valueScale: normalizeNumber(input?.valueScale, fallback.valueScale),
    x: normalizeNumber(input?.x, fallback.x),
    y: normalizeNumber(input?.y, fallback.y),
    w: normalizeNumber(input?.w, fallback.w),
    h: normalizeNumber(input?.h, fallback.h)
  };

  return widget;
}

function sanitizeWidgetCollection(inputWidgets) {
  return WIDGET_IDS.map((id) => {
    const fallback = copyDefaultWidget(id);
    const rawWidget = Array.isArray(inputWidgets) ? inputWidgets.find((widget) => widget?.id === id) || { id } : { id };
    return sanitizeWidget(rawWidget, fallback);
  });
}

async function hassFetch(endpoint, options = {}) {
  if (!TOKEN) {
    throw new Error("Missing SUPERVISOR_TOKEN or HASSIO_TOKEN environment variable.");
  }

  const response = await fetch(`${HASS_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Home Assistant API request failed: ${response.status} ${response.statusText} ${body}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function getStatesMap() {
  const states = await hassFetch("/states");
  return new Map(states.map((state) => [state.entity_id, state]));
}

async function getEntityOptions(domainSet) {
  const states = await hassFetch("/states");
  return states
    .filter((state) => domainSet.has(state.entity_id.split(".")[0]))
    .map((state) => ({
      entity_id: state.entity_id,
      name: state.attributes?.friendly_name || state.entity_id,
      domain: state.entity_id.split(".")[0],
      state: state.state
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function widgetFromStates(id, statesMap) {
  const helpers = helperMap(id);
  const fallback = copyDefaultWidget(id);
  const missing = [];

  const readState = (entityId) => {
    const state = statesMap.get(entityId);
    if (!state) {
      missing.push(entityId);
      return undefined;
    }
    return state.state;
  };

  const type = readState(helpers.type);
  const visible = readState(helpers.visible);
  const showBorder = readState(helpers.showBorder);
  const showIcon = readState(helpers.showIcon);
  const showLabel = readState(helpers.showLabel);
  const showValue = readState(helpers.showValue);
  const widgetBgColor = readState(helpers.widgetBgColor);
  const label = readState(helpers.label);
  const value = readState(helpers.value);
  const valueSource = readState(helpers.valueSource);
  const icon = readState(helpers.icon);
  const action = readState(helpers.action);
  const contentAlign = readState(helpers.contentAlign);
  const labelTransform = readState(helpers.labelTransform);
  const labelWeight = readState(helpers.labelWeight);
  const valueWeight = readState(helpers.valueWeight);
  const iconColor = readState(helpers.iconColor);
  const labelColor = readState(helpers.labelColor);
  const valueColor = readState(helpers.valueColor);
  const iconScale = readState(helpers.iconScale);
  const labelScale = readState(helpers.labelScale);
  const valueScale = readState(helpers.valueScale);
  const x = readState(helpers.x);
  const y = readState(helpers.y);
  const w = readState(helpers.w);
  const h = readState(helpers.h);

  return {
    widget: sanitizeWidget({
      id,
      type,
      visible: visible === undefined ? fallback.visible : visible === "on",
      showBorder: showBorder === undefined ? fallback.showBorder : showBorder === "on",
      showIcon: showIcon === undefined ? fallback.showIcon : showIcon === "on",
      showLabel: showLabel === undefined ? fallback.showLabel : showLabel === "on",
      showValue: showValue === undefined ? fallback.showValue : showValue === "on",
      widgetBgColor,
      label,
      value,
      valueSource,
      icon,
      action,
      contentAlign,
      labelTransform,
      labelWeight,
      valueWeight,
      iconColor,
      labelColor,
      valueColor,
      iconScale,
      labelScale,
      valueScale,
      x,
      y,
      w,
      h
    }, fallback),
    missing
  };
}

function themeFromStates(statesMap) {
  const helpers = themeHelperMap();
  const missing = [];
  const readState = (entityId) => {
    const state = statesMap.get(entityId);
    if (!state) {
      missing.push(entityId);
      return undefined;
    }
    return state.state;
  };

  const themeId = readState(helpers.theme);
  const theme = sanitizeTheme({
    id: PANEL_THEME_IDS.includes(themeId) ? themeId : "blue",
    screenBg: readState(helpers.screenBg),
    widgetBg: readState(helpers.widgetBg),
    widgetBorder: readState(helpers.widgetBorder),
    buttonOnBg: readState(helpers.buttonOnBg),
    buttonOffBg: readState(helpers.buttonOffBg),
    overlayBg: readState(helpers.overlayBg),
    overlayTitle: readState(helpers.overlayTitle),
    overlayText: readState(helpers.overlayText)
  });

  return { theme, missing };
}

function helperPackageYaml() {
  const defaultTheme = copyDefaultTheme();
  const themeLine = `  esp_panel_runtime_theme:
    name: ESP Panel Runtime Theme
    initial: "${runtimeThemeConfigValue(defaultTheme)}"
    max: 255`;
  const textLines = WIDGET_IDS.flatMap((id) => {
    const fallback = copyDefaultWidget(id);
    return [
      `  esp_panel_runtime_${id}_config:
    name: ESP Panel Runtime ${id.toUpperCase()} Config
    initial: "${runtimeWidgetConfigValue(fallback)}"
    max: 255`,
      `  esp_panel_runtime_${id}_value:
    name: ESP Panel Runtime ${id.toUpperCase()} Value
    initial: "${fallback.value}"`,
      `  esp_panel_runtime_${id}_action:
    name: ESP Panel Runtime ${id.toUpperCase()} Action
    initial: "${runtimeActionValue(fallback)}"
    max: 255`
    ];
  }).join("\n");
  return `input_text:
${themeLine}
${textLines}
`;
}

async function importLegacyStoredConfig() {
  const statesMap = await getStatesMap();
  const themeResult = themeFromStates(statesMap);
  const widgets = WIDGET_IDS.map((id) => widgetFromStates(id, statesMap).widget);
  const config = {
    widgets,
    theme: themeResult.theme
  };
  await writeStoredConfigFile(config);
  return config;
}

async function loadStoredConfig() {
  const fileConfig = await readStoredConfigFile();
  if (fileConfig) {
    const theme = sanitizeTheme(fileConfig.theme);
    const widgets = sanitizeWidgetCollection(fileConfig.widgets);
    return { widgets, theme };
  }

  try {
    return await importLegacyStoredConfig();
  } catch (error) {
    log("Falling back to built-in defaults for layout store", error instanceof Error ? error.message : error);
    const config = {
      widgets: DEFAULT_LAYOUT.map((widget) => ({ ...widget })),
      theme: copyDefaultTheme()
    };
    await writeStoredConfigFile(config);
    return config;
  }
}

async function saveStoredConfig(widgets, theme) {
  const config = {
    widgets: sanitizeWidgetCollection(widgets),
    theme: sanitizeTheme(theme)
  };
  await writeStoredConfigFile(config);
  return config;
}

async function writeRuntimeText(entityId, value, warningLabel) {
  try {
    await hassFetch("/services/input_text/set_value", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entityId,
        value
      })
    });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unknown error while updating ${warningLabel}.`;
    return `${warningLabel} was not updated: ${message}`;
  }
}

async function syncRuntimeTheme(theme) {
  const warning = await writeRuntimeText(runtimeThemeHelper(), runtimeThemeConfigValue(theme), "Theme runtime helper");
  return warning ? [warning] : [];
}

async function syncRuntimeWidget(widget) {
  const helpers = runtimeHelperMap(widget.id);
  const warnings = await Promise.all([
    writeRuntimeText(helpers.config, runtimeWidgetConfigValue(widget), `${widget.id} config helper`),
    writeRuntimeText(helpers.value, widget.value, `${widget.id} value helper`),
    writeRuntimeText(helpers.action, runtimeActionValue(widget), `${widget.id} action helper`)
  ]);
  return warnings.filter(Boolean);
}

async function syncRuntimeConfig(widgets, theme) {
  const warningGroups = await Promise.all([
    syncRuntimeTheme(theme),
    ...widgets.map((widget) => syncRuntimeWidget(widget))
  ]);
  return warningGroups.flat();
}

async function findMissingRuntimeHelpers() {
  try {
    const statesMap = await getStatesMap();
    const required = [
      runtimeThemeHelper(),
      ...WIDGET_IDS.flatMap((id) => {
        const helpers = runtimeHelperMap(id);
        return [helpers.config, helpers.value, helpers.action];
      })
    ];
    return required.filter((entityId) => !statesMap.has(entityId));
  } catch {
    return [];
  }
}

function formatEntityState(state) {
  const rawState = normalizeText(state?.state);
  const unit = normalizeText(state?.attributes?.unit_of_measurement);
  if (!rawState) {
    return "";
  }
  if (rawState === "unknown" || rawState === "unavailable") {
    return rawState;
  }
  if (unit && !rawState.endsWith(unit)) {
    return `${rawState} ${unit}`.trim();
  }
  return rawState;
}

async function syncValueSources() {
  const states = await hassFetch("/states");
  const statesMap = new Map(states.map((state) => [state.entity_id, state]));
  const stored = await loadStoredConfig();
  let changed = false;
  const runtimeUpdates = [];

  for (const widget of stored.widgets) {
    if (!widget.valueSource) {
      continue;
    }

    const sourceState = statesMap.get(widget.valueSource);
    if (!sourceState) {
      continue;
    }

    const nextValue = formatEntityState(sourceState);
    if (nextValue && nextValue !== widget.value) {
      widget.value = nextValue;
      changed = true;
      runtimeUpdates.push(writeRuntimeText(runtimeHelperMap(widget.id).value, nextValue, `${widget.id} value helper`));
    }
  }

  const runtimeWarnings = await Promise.all(runtimeUpdates);
  runtimeWarnings.filter(Boolean).forEach((warning) => log(warning));

  if (changed) {
    await saveStoredConfig(stored.widgets, stored.theme);
  }
}

async function buildWidgetResponse() {
  const stored = await loadStoredConfig();
  const missingHelpers = await findMissingRuntimeHelpers();

  return {
    widgets: stored.widgets,
    warnings: [
      ...findOverlapWarnings(stored.widgets),
      ...(missingHelpers.length > 0
        ? [`Missing ${missingHelpers.length} helper entities. Open Helper YAML to create them.`]
        : [])
    ],
    missingHelpers,
    helperYaml: HELPER_YAML,
    defaults: DEFAULT_LAYOUT,
    theme: stored.theme
  };
}

function defaultWidgetResponse(errorMessage) {
  return {
    error: errorMessage,
    widgets: DEFAULT_LAYOUT,
    warnings: ["Falling back to the built-in default layout."],
    missingHelpers: [],
    helperYaml: HELPER_YAML,
    defaults: DEFAULT_LAYOUT,
    theme: copyDefaultTheme()
  };
}

app.get("/api/widgets", async (_request, response) => {
  try {
    response.json(await buildWidgetResponse());
  } catch (error) {
    log("Failed to load widgets", error);
    response.json(defaultWidgetResponse(error instanceof Error ? error.message : "Unknown error while loading widgets."));
  }
});

app.get("/api/helper-yaml", (_request, response) => {
  response.type("text/plain").send(HELPER_YAML);
});

app.get("/api/entities", async (_request, response) => {
  try {
    response.json({
      entities: await getEntityOptions(ACTION_ENTITY_DOMAINS)
    });
  } catch (error) {
    log("Failed to load entity options", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while loading entity options."
    });
  }
});

app.get("/api/value-sources", async (_request, response) => {
  try {
    response.json({
      entities: await getEntityOptions(VALUE_SOURCE_ENTITY_DOMAINS)
    });
  } catch (error) {
    log("Failed to load value source options", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while loading value source options."
    });
  }
});

app.post("/api/apply", async (request, response) => {
  try {
    const inputWidgets = Array.isArray(request.body?.widgets) ? request.body.widgets : [];
    const theme = sanitizeTheme(request.body?.theme);
    if (inputWidgets.length !== WIDGET_IDS.length) {
      response.status(400).json({ error: `Expected ${WIDGET_IDS.length} widgets in request body.` });
      return;
    }

    const widgets = sanitizeWidgetCollection(inputWidgets);

    const errors = widgets.flatMap((widget) => validateWidget(widget));
    if (errors.length > 0) {
      response.status(400).json({ error: errors.join(" ") });
      return;
    }

    await saveStoredConfig(widgets, theme);
    const runtimeWarnings = await syncRuntimeConfig(widgets, theme);
    const current = await buildWidgetResponse();

    response.json({
      ok: true,
      widgets: current.widgets,
      warnings: [...current.warnings, ...runtimeWarnings]
    });
  } catch (error) {
    log("Failed to apply widget layout", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while applying widget layout."
    });
  }
});

app.post("/api/reload", async (_request, response) => {
  try {
    response.json(await buildWidgetResponse());
  } catch (error) {
    log("Failed to reload widgets", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while reloading widget layout."
    });
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (_request, response) => {
  response.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  log(`Server listening on 0.0.0.0:${PORT}`);
  if (!TOKEN) {
    log("Warning: no Home Assistant supervisor token found. API calls will fail until the add-on runs inside Home Assistant.");
    return;
  }

  void loadStoredConfig()
    .then((config) => syncRuntimeConfig(config.widgets, config.theme))
    .then((warnings) => warnings.forEach((warning) => log(warning)))
    .catch((error) => log("Initial runtime sync failed", error));
});

setInterval(() => {
  void syncValueSources().catch((error) => log("Value source sync failed", error));
}, VALUE_SOURCE_SYNC_INTERVAL_MS);
