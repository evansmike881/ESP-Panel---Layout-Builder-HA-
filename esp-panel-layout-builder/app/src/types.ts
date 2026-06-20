export const GRID_SIZE = 6;
export const WIDGET_IDS = ["w01", "w02", "w03", "w04", "w05", "w06", "w07", "w08", "w09", "w10", "w11", "w12"] as const;
export const PANEL_THEME_IDS = ["light", "dark", "blue", "red", "green", "custom"] as const;
export const WIDGET_TYPES = [
  "blank",
  "clock",
  "date",
  "button",
  "media",
  "status"
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];
export type PanelThemeId = (typeof PANEL_THEME_IDS)[number];
export type WidgetType = (typeof WIDGET_TYPES)[number];
export type WidgetContentAlign = "start" | "center" | "end";
export type WidgetTextTransform = "none" | "uppercase";
export type WidgetFontWeight = "normal" | "bold";

export interface PanelTheme {
  id: PanelThemeId;
  name: string;
  screenBg: string;
  widgetBg: string;
  widgetBorder: string;
  buttonOnBg: string;
  buttonOffBg: string;
  iconColor: string;
  labelColor: string;
  valueColor: string;
  overlayBg: string;
  overlayTitle: string;
  overlayText: string;
  accent: string;
}

export interface WidgetConfig {
  id: WidgetId;
  type: WidgetType;
  visible: boolean;
  showBorder: boolean;
  showIcon: boolean;
  showLabel: boolean;
  showValue: boolean;
  widgetBgColor: string;
  label: string;
  value: string;
  valueSource: string;
  icon: string;
  action: string;
  contentAlign: WidgetContentAlign;
  labelTransform: WidgetTextTransform;
  labelWeight: WidgetFontWeight;
  valueWeight: WidgetFontWeight;
  iconColor: string;
  labelColor: string;
  valueColor: string;
  iconScale: number;
  labelScale: number;
  valueScale: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetResponse {
  error?: string;
  widgets: WidgetConfig[];
  warnings: string[];
  missingHelpers: string[];
  helperYaml: string;
  defaults: WidgetConfig[];
  theme: PanelTheme;
}

export const PANEL_THEMES: Record<PanelThemeId, PanelTheme> = {
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
  contentAlign: "start" as const,
  labelTransform: "none" as const,
  labelWeight: "bold" as const,
  valueWeight: "normal" as const,
  iconColor: PANEL_THEMES.blue.iconColor,
  labelColor: PANEL_THEMES.blue.labelColor,
  valueColor: PANEL_THEMES.blue.valueColor,
  iconScale: 100,
  labelScale: 100,
  valueScale: 100
};

export const DEFAULT_LAYOUT: WidgetConfig[] = [
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
