export const GRID_COLUMNS = 6;
export const GRID_ROWS = 6;

export type ClockVariant = "digital" | "analogue";

export interface LayoutWidget {
  id: string;
  type: "clock";
  title: string;
  variant: ClockVariant;
  x: number;
  y: number;
  w: number;
  h: number;
  showSeconds: boolean;
}

export interface LayoutState {
  version: number;
  screen: {
    width: number;
    height: number;
    columns: number;
    rows: number;
  };
  widgets: LayoutWidget[];
}

export const DEFAULT_LAYOUT: LayoutState = {
  version: 1,
  screen: {
    width: 480,
    height: 480,
    columns: GRID_COLUMNS,
    rows: GRID_ROWS
  },
  widgets: [
    {
      id: "clock-1",
      type: "clock",
      title: "Primary Clock",
      variant: "digital",
      x: 0,
      y: 0,
      w: 4,
      h: 2,
      showSeconds: false
    },
    {
      id: "clock-2",
      type: "clock",
      title: "Analogue Clock",
      variant: "analogue",
      x: 2,
      y: 2,
      w: 3,
      h: 3,
      showSeconds: true
    }
  ]
};
