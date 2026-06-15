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

export interface WidgetConfig {
  id: WidgetId;
  type: WidgetType;
  visible: boolean;
  label: string;
  value: string;
  icon: string;
  action: string;
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

export const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: "w01", type: "clock", visible: true, label: "Clock", value: "--:--", icon: "clock", action: "clock", x: 0, y: 0, w: 3, h: 1 },
  { id: "w02", type: "date", visible: true, label: "Date", value: "--", icon: "calendar", action: "date", x: 3, y: 0, w: 3, h: 1 },
  { id: "w03", type: "weather", visible: true, label: "Weather", value: "Partly Cloudy", icon: "weather-partly-cloudy", action: "weather", x: 0, y: 1, w: 3, h: 1 },
  { id: "w04", type: "temperature", visible: true, label: "Temp", value: "12.5", icon: "thermometer", action: "temperature", x: 3, y: 1, w: 2, h: 1 },
  { id: "w05", type: "humidity", visible: true, label: "Humidity", value: "80", icon: "water-percent", action: "humidity", x: 5, y: 1, w: 1, h: 1 },
  { id: "w06", type: "button", visible: true, label: "Main Light", value: "OFF", icon: "ceiling-light", action: "office_light", x: 0, y: 4, w: 2, h: 2 },
  { id: "w07", type: "status", visible: false, label: "WiFi", value: "Online", icon: "wifi", action: "wifi_status", x: 2, y: 4, w: 2, h: 1 },
  { id: "w08", type: "status", visible: false, label: "Scene", value: "Home", icon: "home", action: "home_scene", x: 2, y: 5, w: 2, h: 1 },
  { id: "w09", type: "button", visible: false, label: "Door", value: "Closed", icon: "door", action: "front_door", x: 4, y: 4, w: 2, h: 1 },
  { id: "w10", type: "status", visible: false, label: "Sofa", value: "Ready", icon: "sofa", action: "sofa_status", x: 4, y: 5, w: 2, h: 1 },
  { id: "w11", type: "blank", visible: false, label: "Blank", value: "", icon: "shape", action: "", x: 0, y: 2, w: 2, h: 1 },
  { id: "w12", type: "blank", visible: false, label: "Blank", value: "", icon: "shape", action: "", x: 2, y: 2, w: 2, h: 1 }
];
