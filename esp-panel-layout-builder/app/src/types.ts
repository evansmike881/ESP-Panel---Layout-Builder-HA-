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
export type WidgetLayoutMode = "auto" | "stacked" | "icon_right";
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
  layoutMode: WidgetLayoutMode;
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
    name: "Arctic Glass",
    screenBg: "#eaf1f8",
    widgetBg: "#ffffff",
    widgetBorder: "#c6d7ea",
    buttonOnBg: "#3fbf93",
    buttonOffBg: "#bac7d8",
    iconColor: "#2563eb",
    labelColor: "#59708f",
    valueColor: "#14233d",
    overlayBg: "#d8e6f6",
    overlayTitle: "#2159c9",
    overlayText: "#14233d",
    accent: "#2d6cdf"
  },
  dark: {
    id: "dark",
    name: "Midnight Depth",
    screenBg: "#08142a",
    widgetBg: "#0f1d35",
    widgetBorder: "#274f84",
    buttonOnBg: "#0f9d78",
    buttonOffBg: "#1a2739",
    iconColor: "#f7c55f",
    labelColor: "#9fb6d4",
    valueColor: "#f4f8ff",
    overlayBg: "#07111e",
    overlayTitle: "#f7c55f",
    overlayText: "#f4f8ff",
    accent: "#4b86ff"
  },
  blue: {
    id: "blue",
    name: "Aurora Blue",
    screenBg: "#09152d",
    widgetBg: "#0d1c35",
    widgetBorder: "#2e67b3",
    buttonOnBg: "#18b39b",
    buttonOffBg: "#1c2738",
    iconColor: "#ffd166",
    labelColor: "#a9c7ee",
    valueColor: "#f1f6fc",
    overlayBg: "#07111f",
    overlayTitle: "#ffd166",
    overlayText: "#f1f6fc",
    accent: "#4a88ff"
  },
  red: {
    id: "red",
    name: "Signal Red",
    screenBg: "#250b14",
    widgetBg: "#42111d",
    widgetBorder: "#8f2640",
    buttonOnBg: "#1aa46a",
    buttonOffBg: "#34202a",
    iconColor: "#ffb0bb",
    labelColor: "#ffd2d8",
    valueColor: "#fff2f4",
    overlayBg: "#13060b",
    overlayTitle: "#ff829b",
    overlayText: "#fff2f4",
    accent: "#ff5470"
  },
  green: {
    id: "green",
    name: "Forest Pulse",
    screenBg: "#081c17",
    widgetBg: "#0f2d24",
    widgetBorder: "#247559",
    buttonOnBg: "#26c971",
    buttonOffBg: "#1e2837",
    iconColor: "#95efb7",
    labelColor: "#c2f7d3",
    valueColor: "#effdf5",
    overlayBg: "#06120e",
    overlayTitle: "#56db89",
    overlayText: "#effdf5",
    accent: "#2fcc78"
  },
  custom: {
    id: "custom",
    name: "Custom",
    screenBg: "#09152d",
    widgetBg: "#0d1c35",
    widgetBorder: "#2e67b3",
    buttonOnBg: "#18b39b",
    buttonOffBg: "#1c2738",
    iconColor: "#ffd166",
    labelColor: "#a9c7ee",
    valueColor: "#f1f6fc",
    overlayBg: "#07111f",
    overlayTitle: "#ffd166",
    overlayText: "#f1f6fc",
    accent: "#4a88ff"
  }
};

const DEFAULT_STYLE = {
  showBorder: true,
  showIcon: true,
  showLabel: true,
  showValue: true,
  widgetBgColor: "",
  contentAlign: "start" as const,
  layoutMode: "auto" as const,
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
