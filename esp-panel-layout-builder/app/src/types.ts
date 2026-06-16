export const GRID_SIZE = 6;
export const WIDGET_IDS = ["w01", "w02", "w03", "w04", "w05", "w06", "w07", "w08", "w09", "w10", "w11", "w12"] as const;
export const WIDGET_TYPES = [
  "blank",
  "clock",
  "date",
  "weather",
  "temperature",
  "humidity",
  "button",
  "status"
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];
export type WidgetType = (typeof WIDGET_TYPES)[number];
export type WidgetContentAlign = "start" | "center" | "end";
export type WidgetTextTransform = "none" | "uppercase";
export type WidgetFontWeight = "normal" | "bold";

export interface WidgetConfig {
  id: WidgetId;
  type: WidgetType;
  visible: boolean;
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
  widgets: WidgetConfig[];
  warnings: string[];
  missingHelpers: string[];
  helperYaml: string;
  defaults: WidgetConfig[];
}

const DEFAULT_STYLE = {
  contentAlign: "start" as const,
  labelTransform: "none" as const,
  labelWeight: "bold" as const,
  valueWeight: "normal" as const,
  iconColor: "#eff7ff",
  labelColor: "#ffffff",
  valueColor: "#dbeafe",
  iconScale: 100,
  labelScale: 100,
  valueScale: 100
};

export const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: "w01", type: "clock", visible: true, label: "Clock", value: "--:--", valueSource: "", icon: "clock", action: "clock", x: 0, y: 0, w: 3, h: 1, ...DEFAULT_STYLE },
  { id: "w02", type: "date", visible: true, label: "Date", value: "--", valueSource: "", icon: "calendar", action: "date", x: 3, y: 0, w: 3, h: 1, ...DEFAULT_STYLE },
  { id: "w03", type: "weather", visible: true, label: "Weather", value: "Partly Cloudy", valueSource: "", icon: "weather-partly-cloudy", action: "weather", x: 0, y: 1, w: 3, h: 1, ...DEFAULT_STYLE },
  { id: "w04", type: "temperature", visible: true, label: "Temp", value: "12.5", valueSource: "", icon: "thermometer", action: "temperature", x: 3, y: 1, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w05", type: "humidity", visible: true, label: "Humidity", value: "80", valueSource: "", icon: "water-percent", action: "humidity", x: 5, y: 1, w: 1, h: 1, ...DEFAULT_STYLE },
  { id: "w06", type: "button", visible: true, label: "Main Light", value: "OFF", valueSource: "switch.office_main_light", icon: "ceiling-light", action: "office_light", x: 0, y: 4, w: 2, h: 2, ...DEFAULT_STYLE },
  { id: "w07", type: "status", visible: false, label: "WiFi", value: "Online", valueSource: "", icon: "wifi", action: "wifi_status", x: 2, y: 4, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w08", type: "status", visible: false, label: "Scene", value: "Home", valueSource: "", icon: "home", action: "home_scene", x: 2, y: 5, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w09", type: "button", visible: false, label: "Door", value: "Closed", valueSource: "", icon: "door", action: "front_door", x: 4, y: 4, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w10", type: "status", visible: false, label: "Sofa", value: "Ready", valueSource: "", icon: "sofa", action: "sofa_status", x: 4, y: 5, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w11", type: "blank", visible: false, label: "Blank", value: "", valueSource: "", icon: "shape", action: "", x: 0, y: 2, w: 2, h: 1, ...DEFAULT_STYLE },
  { id: "w12", type: "blank", visible: false, label: "Blank", value: "", valueSource: "", icon: "shape", action: "", x: 2, y: 2, w: 2, h: 1, ...DEFAULT_STYLE }
];
