import express from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT || "8099", 10);
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "clock-layout.json");
const GENERATED_YAML_PATH = path.resolve(__dirname, "..", "household-panel.generated.yaml");

const SCREEN = {
  width: 480,
  height: 480,
  columns: 6,
  rows: 6
};

const DEFAULT_LAYOUT = {
  version: 1,
  screen: SCREEN,
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

const app = express();
app.use(express.json({ limit: "1mb" }));

function log(message, extra) {
  if (extra !== undefined) {
    console.log(`[ESP Panel Layout Builder] ${message}`, extra);
    return;
  }
  console.log(`[ESP Panel Layout Builder] ${message}`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeClockWidget(input, fallback) {
  const variant = input?.variant === "analogue" ? "analogue" : "digital";
  const w = clamp(normalizeInteger(input?.w, fallback.w), 2, SCREEN.columns);
  const h = clamp(normalizeInteger(input?.h, fallback.h), 2, SCREEN.rows);

  return {
    id: normalizeText(input?.id, fallback.id),
    type: "clock",
    title: normalizeText(input?.title, fallback.title),
    variant,
    x: clamp(normalizeInteger(input?.x, fallback.x), 0, SCREEN.columns - w),
    y: clamp(normalizeInteger(input?.y, fallback.y), 0, SCREEN.rows - h),
    w,
    h,
    showSeconds: typeof input?.showSeconds === "boolean" ? input.showSeconds : fallback.showSeconds
  };
}

function sanitizeLayout(input) {
  const rawWidgets = Array.isArray(input?.widgets) ? input.widgets : DEFAULT_LAYOUT.widgets;
  const widgets = rawWidgets.map((widget, index) =>
    sanitizeClockWidget(widget, DEFAULT_LAYOUT.widgets[index] || DEFAULT_LAYOUT.widgets[0])
  );

  return {
    version: 1,
    screen: { ...SCREEN },
    widgets
  };
}

function validateLayout(layout) {
  const errors = [];
  const ids = new Set();

  layout.widgets.forEach((widget, index) => {
    if (!widget.id) {
      errors.push(`Widget ${index + 1} is missing an id.`);
    }
    if (ids.has(widget.id)) {
      errors.push(`Duplicate widget id: ${widget.id}.`);
    }
    ids.add(widget.id);

    if (widget.type !== "clock") {
      errors.push(`${widget.id} must be a clock widget.`);
    }
    if (!["digital", "analogue"].includes(widget.variant)) {
      errors.push(`${widget.id} has an invalid clock variant.`);
    }
    if (widget.x < 0 || widget.x + widget.w > SCREEN.columns) {
      errors.push(`${widget.id} extends past the grid width.`);
    }
    if (widget.y < 0 || widget.y + widget.h > SCREEN.rows) {
      errors.push(`${widget.id} extends past the grid height.`);
    }
  });

  for (let index = 0; index < layout.widgets.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < layout.widgets.length; otherIndex += 1) {
      const a = layout.widgets[index];
      const b = layout.widgets[otherIndex];
      const overlaps =
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;

      if (overlaps) {
        errors.push(`${a.id} overlaps ${b.id}.`);
      }
    }
  }

  return errors;
}

function buildLvglExport(layout) {
  return {
    version: 1,
    target: "lvgl",
    screen: {
      width: layout.screen.width,
      height: layout.screen.height,
      layout: "grid",
      columns: Array.from({ length: layout.screen.columns }, () => "LV_GRID_FR(1)"),
      rows: Array.from({ length: layout.screen.rows }, () => "LV_GRID_FR(1)"),
      rowGap: 8,
      columnGap: 8,
      padding: 12
    },
    widgets: layout.widgets.map((widget) => ({
      id: widget.id,
      type: widget.type,
      role: "time_display",
      title: widget.title,
      variant: widget.variant,
      gridCell: {
        column: widget.x,
        columnSpan: widget.w,
        row: widget.y,
        rowSpan: widget.h,
        columnAlign: "LV_GRID_ALIGN_STRETCH",
        rowAlign: "LV_GRID_ALIGN_STRETCH"
      },
      lvgl: {
        container: "lv_obj",
        style: "clock_card",
        children:
          widget.variant === "digital"
            ? [
                { widget: "lv_label", role: "title", textBinding: widget.title },
                { widget: "lv_label", role: "time", format: widget.showSeconds ? "HH:mm:ss" : "HH:mm" },
                { widget: "lv_label", role: "date", format: "EEE dd MMM" }
              ]
            : [
                { widget: "lv_label", role: "title", textBinding: widget.title },
                { widget: "lv_scale", role: "dial" },
                { widget: "lv_line", role: "hour_hand" },
                { widget: "lv_line", role: "minute_hand" },
                ...(widget.showSeconds ? [{ widget: "lv_line", role: "second_hand" }] : [])
              ]
      }
    }))
  };
}

function buildExportText(layout) {
  const model = buildLvglExport(layout);
  return JSON.stringify(model, null, 2);
}

function widgetKey(widget) {
  return widget.id.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildDigitalWidget(widget) {
  const key = widgetKey(widget);
  const timeFormat = widget.showSeconds ? "%H:%M:%S" : "%H:%M";
  const timeFont = widget.w >= 4 || widget.h >= 3 ? "montserrat_bold_52" : "montserrat_bold_36";
  const dateFont = widget.w >= 4 || widget.h >= 3 ? "montserrat_18" : "montserrat_14";

  return `      - obj:
          id: ${key}_card
          grid_cell_column_pos: ${widget.x}
          grid_cell_row_pos: ${widget.y}
          grid_cell_column_span: ${widget.w}
          grid_cell_row_span: ${widget.h}
          width: 100%
          height: 100%
          bg_color: 0x12315A
          bg_grad_color: 0x091A34
          bg_grad_dir: VER
          border_color: 0x6ED9FF
          border_width: 2
          radius: 22
          pad_top: 14
          pad_bottom: 14
          pad_left: 16
          pad_right: 16
          scrollable: false
          layout:
            type: FLEX
            flex_flow: COLUMN
            flex_align_main: CENTER
            flex_align_cross: START
            flex_align_track: CENTER
          widgets:
            - label:
                text: ${yamlString(widget.title)}
                text_font: montserrat_bold_14
                text_color: 0x9FC7FF
            - label:
                id: ${key}_time
                text: "--:--"
                text_font: ${timeFont}
                text_color: 0xF5F9FF
            - label:
                id: ${key}_date
                text: "-- ---"
                text_font: ${dateFont}
                text_color: 0xC8DAF7`;
}

function buildAnalogueWidget(widget) {
  const key = widgetKey(widget);

  return `      - obj:
          id: ${key}_card
          grid_cell_column_pos: ${widget.x}
          grid_cell_row_pos: ${widget.y}
          grid_cell_column_span: ${widget.w}
          grid_cell_row_span: ${widget.h}
          width: 100%
          height: 100%
          bg_color: 0x12315A
          bg_grad_color: 0x091A34
          bg_grad_dir: VER
          border_color: 0x6ED9FF
          border_width: 2
          radius: 22
          pad_top: 14
          pad_bottom: 14
          pad_left: 14
          pad_right: 14
          scrollable: false
          widgets:
            - label:
                x: 0
                y: 0
                width: 100%
                text_align: LEFT
                text: ${yamlString(widget.title)}
                text_font: montserrat_bold_14
                text_color: 0x9FC7FF
            - meter:
                id: ${key}_meter
                x: 0
                y: 24
                width: 100%
                height: 100%
                align: CENTER
                bg_opa: TRANSP
                border_width: 0
                pad_all: 0
                text_color: 0xDCEBFF
                scales:
                  - range_from: 0
                    range_to: 60
                    angle_range: 360
                    rotation: 270
                    ticks:
                      width: 1
                      count: 61
                      length: 10
                      color: 0xC8DAF7
                    indicators:
                      - line:
                          id: ${key}_minute_hand
                          width: 4
                          color: 0x8FDCFF
                          length: 78%
                          rounded: true
                          value: 0
${widget.showSeconds ? `                      - line:
                          id: ${key}_second_hand
                          width: 2
                          color: 0xFFD36B
                          length: 86%
                          rounded: true
                          value: 0
` : ""}                  - range_from: 1
                    range_to: 12
                    angle_range: 330
                    rotation: 300
                    ticks:
                      width: 1
                      count: 12
                      length: 1
                      color: 0x000000
                      major:
                        stride: 1
                        width: 3
                        length: 16
                        color: 0xF5F9FF
                        label_gap: 0
                  - range_from: 0
                    range_to: 720
                    angle_range: 360
                    rotation: 270
                    ticks:
                      count: 2
                    indicators:
                      - line:
                          id: ${key}_hour_hand
                          width: 6
                          color: 0xF7FBFF
                          length: 56%
                          rounded: true
                          value: 0`;
}

function buildClockUpdateActions(layout) {
  return layout.widgets.flatMap((widget) => {
    const key = widgetKey(widget);
    if (widget.variant === "digital") {
      const timeFormat = widget.showSeconds ? "%H:%M:%S" : "%H:%M";
      return [
        `      - lvgl.label.update:
          id: ${key}_time
          text: !lambda |-
            auto now = id(ha_time).now();
            if (!now.is_valid()) return std::string("--:--");
            char buffer[16];
            now.strftime(buffer, sizeof(buffer), ${yamlString(timeFormat)});
            return std::string(buffer);`,
        `      - lvgl.label.update:
          id: ${key}_date
          text: !lambda |-
            auto now = id(ha_time).now();
            if (!now.is_valid()) return std::string("-- ---");
            char buffer[24];
            now.strftime(buffer, sizeof(buffer), "%a %d %b");
            return std::string(buffer);`
      ];
    }

    return [
      `      - lvgl.indicator.update:
          id: ${key}_minute_hand
          value: !lambda |-
            auto now = id(ha_time).now();
            if (!now.is_valid()) return 0;
            return now.minute;`,
      `      - lvgl.indicator.update:
          id: ${key}_hour_hand
          value: !lambda |-
            auto now = id(ha_time).now();
            if (!now.is_valid()) return 0;
            return (now.hour % 12) * 60 + now.minute;`,
      ...(widget.showSeconds
        ? [
            `      - lvgl.indicator.update:
          id: ${key}_second_hand
          value: !lambda |-
            auto now = id(ha_time).now();
            if (!now.is_valid()) return 0;
            return now.second;`
          ]
        : [])
    ];
  });
}

function buildEsphomeYaml(layout) {
  const widgetYaml = layout.widgets.length
    ? layout.widgets
        .map((widget) => (widget.variant === "analogue" ? buildAnalogueWidget(widget) : buildDigitalWidget(widget)))
        .join("\n")
    : `      - label:
          text: "No widgets configured"
          text_font: montserrat_bold_22
          text_color: 0xF5F9FF
          align: CENTER`;

  const updateActions = buildClockUpdateActions(layout).join("\n");

  return `substitutions:
  screen_width: "480"
  screen_height: "480"

esphome:
  name: household-panel
  friendly_name: Household Panel
  min_version: 2026.4.0
  on_boot:
    priority: -200
    then:
      - delay: 1s
      - light.turn_on:
          id: display_backlight
          brightness: 85%
      - script.execute: sync_clock_widgets

esp32:
  board: esp32-s3-devkitc-1
  variant: esp32s3
  flash_size: 16MB
  framework:
    type: esp-idf
    advanced:
      execute_from_psram: true

psram:
  mode: octal
  speed: 80MHz

preferences:
  flash_write_interval: 5min

logger:
  level: WARN

api:

ota:
  - platform: esphome

wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  on_connect:
    then:
      - delay: 1s
      - script.execute: sync_clock_widgets

time:
  - platform: homeassistant
    id: ha_time
    on_time_sync:
      then:
        - script.execute: sync_clock_widgets
    on_time:
      - seconds: /1
        then:
          - script.execute: sync_clock_widgets

output:
  - platform: ledc
    pin: GPIO38
    id: gpio_backlight_pwm
    frequency: 100Hz

light:
  - platform: monochromatic
    output: gpio_backlight_pwm
    name: Display Backlight
    id: display_backlight
    restore_mode: ALWAYS_ON

i2c:
  - id: bus_a
    sda: GPIO19
    scl:
      number: GPIO45
      ignore_strapping_warning: true

touchscreen:
  platform: gt911
  id: panel_touch
  display: my_display
  i2c_id: bus_a
  transform:
    mirror_x: true
    mirror_y: true
    swap_xy: false

spi:
  - id: lcd_spi
    clk_pin: GPIO48
    mosi_pin: GPIO47

display:
  - platform: mipi_rgb
    id: my_display
    model: GUITION-4848S040
    auto_clear_enabled: false
    update_interval: never
    dimensions:
      width: 480
      height: 480

font:
  - file:
      type: gfonts
      family: Montserrat
      weight: 400
    id: montserrat_14
    size: 14
    bpp: 4
  - file:
      type: gfonts
      family: Montserrat
      weight: 400
    id: montserrat_18
    size: 18
    bpp: 4
  - file:
      type: gfonts
      family: Montserrat
      weight: 700
    id: montserrat_bold_14
    size: 14
    bpp: 4
  - file:
      type: gfonts
      family: Montserrat
      weight: 700
    id: montserrat_bold_22
    size: 22
    bpp: 4
  - file:
      type: gfonts
      family: Montserrat
      weight: 700
    id: montserrat_bold_36
    size: 36
    bpp: 4
  - file:
      type: gfonts
      family: Montserrat
      weight: 700
    id: montserrat_bold_52
    size: 52
    bpp: 4

script:
  - id: sync_clock_widgets
    then:
${updateActions}

lvgl:
  rotation: 180
  pages:
    - id: main_page
      bg_color: 0x08142D
      pad_all: 0
      scrollable: false
      scrollbar_mode: "OFF"
      widgets:
        - obj:
            id: screen_root
            x: 0
            y: 0
            width: 480
            height: 480
            bg_color: 0x08142D
            bg_grad_color: 0x050B16
            bg_grad_dir: VER
            border_width: 0
            pad_all: 12
            radius: 0
            scrollable: false
            layout:
              type: GRID
              grid_rows: 6
              grid_columns: 6
              pad_row: 8
              pad_column: 8
              grid_cell_x_align: center
              grid_cell_y_align: center
            widgets:
${widgetYaml}
`;
}

async function writeGeneratedYaml(layout) {
  await fs.writeFile(GENERATED_YAML_PATH, buildEsphomeYaml(layout));
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStoredLayout() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return sanitizeLayout(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeStoredLayout(layout) {
  await ensureDataDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(layout, null, 2));
}

async function loadLayout() {
  const existing = await readStoredLayout();
  if (existing) {
    await writeGeneratedYaml(existing);
    return existing;
  }

  const layout = sanitizeLayout(DEFAULT_LAYOUT);
  await writeStoredLayout(layout);
  await writeGeneratedYaml(layout);
  return layout;
}

async function saveLayout(input) {
  const layout = sanitizeLayout(input);
  const errors = validateLayout(layout);
  if (errors.length > 0) {
    const error = new Error(errors.join(" "));
    error.statusCode = 400;
    throw error;
  }

  await writeStoredLayout(layout);
  await writeGeneratedYaml(layout);
  return layout;
}

app.get("/api/layout", async (_request, response) => {
  try {
    const layout = await loadLayout();
    response.json({
      layout,
      exportModel: buildLvglExport(layout),
      exportText: buildEsphomeYaml(layout)
    });
  } catch (error) {
    log("Failed to load layout", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while loading layout."
    });
  }
});

app.post("/api/layout", async (request, response) => {
  try {
    const layout = await saveLayout(request.body?.layout);
    response.json({
      ok: true,
      layout,
      exportModel: buildLvglExport(layout),
      exportText: buildEsphomeYaml(layout)
    });
  } catch (error) {
    log("Failed to save layout", error);
    response.status(error?.statusCode || 500).json({
      error: error instanceof Error ? error.message : "Unknown error while saving layout."
    });
  }
});

app.post("/api/layout/reset", async (_request, response) => {
  try {
    const layout = sanitizeLayout(DEFAULT_LAYOUT);
    await writeStoredLayout(layout);
    response.json({
      ok: true,
      layout,
      exportModel: buildLvglExport(layout),
      exportText: buildEsphomeYaml(layout)
    });
  } catch (error) {
    log("Failed to reset layout", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while resetting layout."
    });
  }
});

app.get("/api/export", async (_request, response) => {
  try {
    const layout = await loadLayout();
    response.json({
      exportModel: buildLvglExport(layout),
      exportText: buildEsphomeYaml(layout)
    });
  } catch (error) {
    log("Failed to export layout", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while exporting layout."
    });
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (_request, response) => {
  response.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  log(`Server listening on 0.0.0.0:${PORT}`);
});
