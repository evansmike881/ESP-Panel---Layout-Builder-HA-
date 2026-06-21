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
const GENERATED_HELPER_PATH = path.resolve(__dirname, "..", "esp-panel-live-helpers.yaml");
const HASS_URL = process.env.HASS_URL || "http://supervisor/core/api";
const TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN || "";

const SCREEN = {
  width: 480,
  height: 480,
  columns: 6,
  rows: 6
};

const MAX_CLOCK_WIDGETS = 8;
const CELL_SIZE = 80;

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

function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function slotIndex(index) {
  return index + 1;
}

function helperEntityId(index) {
  return `input_text.esp_panel_clock_slot_${slotIndex(index)}`;
}

function sanitizeTitle(title) {
  return normalizeText(title, "Clock").replace(/\|/g, "/").trim().slice(0, 64) || "Clock";
}

function sanitizeClockWidget(input, fallback) {
  const variant = input?.variant === "analogue" ? "analogue" : "digital";
  const w = clamp(normalizeInteger(input?.w, fallback.w), 2, SCREEN.columns);
  const h = clamp(normalizeInteger(input?.h, fallback.h), 2, SCREEN.rows);

  return {
    id: normalizeText(input?.id, fallback.id),
    type: "clock",
    title: sanitizeTitle(input?.title ?? fallback.title),
    variant,
    x: clamp(normalizeInteger(input?.x, fallback.x), 0, SCREEN.columns - w),
    y: clamp(normalizeInteger(input?.y, fallback.y), 0, SCREEN.rows - h),
    w,
    h,
    showSeconds: typeof input?.showSeconds === "boolean" ? input.showSeconds : fallback.showSeconds
  };
}

function sanitizeLayout(input) {
  const rawWidgets = Array.isArray(input?.widgets) ? input.widgets.slice(0, MAX_CLOCK_WIDGETS) : DEFAULT_LAYOUT.widgets;
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

  if (layout.widgets.length > MAX_CLOCK_WIDGETS) {
    errors.push(`Layout supports a maximum of ${MAX_CLOCK_WIDGETS} clock widgets.`);
  }

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
    target: "lvgl-runtime-helpers",
    maxWidgets: MAX_CLOCK_WIDGETS,
    screen: {
      width: layout.screen.width,
      height: layout.screen.height,
      columns: layout.screen.columns,
      rows: layout.screen.rows,
      cellSize: CELL_SIZE
    },
    helpers: Array.from({ length: MAX_CLOCK_WIDGETS }, (_, index) => ({
      entity_id: helperEntityId(index),
      slot: slotIndex(index)
    })),
    widgets: layout.widgets.map((widget, index) => ({
      slot: slotIndex(index),
      payload: encodeWidgetPayload(widget)
    }))
  };
}

function encodeWidgetPayload(widget) {
  return [
    widget.variant,
    sanitizeTitle(widget.title),
    widget.x,
    widget.y,
    widget.w,
    widget.h,
    widget.showSeconds ? 1 : 0
  ].join("|");
}

function buildHelperYaml() {
  const helperBlocks = Array.from({ length: MAX_CLOCK_WIDGETS }, (_, index) => `  esp_panel_clock_slot_${slotIndex(index)}:
    name: ESP Panel Clock Slot ${slotIndex(index)}
    max: 255`).join("\n");

  return `input_text:
${helperBlocks}
`;
}

function buildWidgetCard(slot) {
  return `      - obj:
          id: slot_${slot}_card
          x: !lambda return id(slot_${slot}_x) * ${CELL_SIZE};
          y: !lambda return id(slot_${slot}_y) * ${CELL_SIZE};
          width: !lambda return id(slot_${slot}_w) * ${CELL_SIZE};
          height: !lambda return id(slot_${slot}_h) * ${CELL_SIZE};
          hidden: !lambda return !id(slot_${slot}_visible);
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
          widgets:
            - label:
                id: slot_${slot}_title
                x: 0
                y: 0
                width: 100%
                text: !lambda return id(slot_${slot}_title_text);
                text_font: montserrat_bold_14
                text_color: 0x9FC7FF
            - obj:
                id: slot_${slot}_digital
                x: 0
                y: 34
                width: 100%
                height: !lambda return id(slot_${slot}_h) * ${CELL_SIZE} - 48;
                hidden: !lambda return !id(slot_${slot}_visible) || id(slot_${slot}_analogue);
                bg_opa: TRANSP
                border_width: 0
                scrollable: false
                layout:
                  type: FLEX
                  flex_flow: COLUMN
                  flex_align_main: CENTER
                  flex_align_cross: START
                  flex_align_track: CENTER
                widgets:
                  - label:
                      id: slot_${slot}_time
                      text: "--:--"
                      text_font: montserrat_bold_52
                      text_color: 0xF5F9FF
                  - label:
                      id: slot_${slot}_date
                      text: "-- ---"
                      text_font: montserrat_18
                      text_color: 0xC8DAF7
            - meter:
                id: slot_${slot}_analog
                x: 0
                y: 28
                width: 100%
                height: !lambda return id(slot_${slot}_h) * ${CELL_SIZE} - 42;
                hidden: !lambda return !id(slot_${slot}_visible) || !id(slot_${slot}_analogue);
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
                          id: slot_${slot}_minute_hand
                          width: 4
                          color: 0x8FDCFF
                          length: 78%
                          rounded: true
                          value: 0
                      - line:
                          id: slot_${slot}_second_hand
                          width: 2
                          color: 0xFFD36B
                          length: 86%
                          rounded: true
                          value: 0
                  - range_from: 1
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
                          id: slot_${slot}_hour_hand
                          width: 6
                          color: 0xF7FBFF
                          length: 56%
                          rounded: true
                          value: 0`;
}

function buildEsphomeYaml() {
  const textSensors = Array.from({ length: MAX_CLOCK_WIDGETS }, (_, index) => {
    const slot = slotIndex(index);
    return `  - platform: homeassistant
    id: slot_${slot}_payload
    entity_id: ${helperEntityId(index)}
    on_value:
      then:
        - script.execute: apply_live_layout`;
  }).join("\n");

  const globals = Array.from({ length: MAX_CLOCK_WIDGETS }, (_, index) => {
    const slot = slotIndex(index);
    return `  - id: slot_${slot}_visible
    type: bool
    restore_value: no
    initial_value: "false"
  - id: slot_${slot}_analogue
    type: bool
    restore_value: no
    initial_value: "false"
  - id: slot_${slot}_show_seconds
    type: bool
    restore_value: no
    initial_value: "false"
  - id: slot_${slot}_x
    type: int
    restore_value: no
    initial_value: "0"
  - id: slot_${slot}_y
    type: int
    restore_value: no
    initial_value: "0"
  - id: slot_${slot}_w
    type: int
    restore_value: no
    initial_value: "2"
  - id: slot_${slot}_h
    type: int
    restore_value: no
    initial_value: "2"
  - id: slot_${slot}_title_text
    type: std::string
    restore_value: no
    initial_value: '"Clock"'`;
  }).join("\n");

  const refreshList = Array.from({ length: MAX_CLOCK_WIDGETS }, (_, index) => {
    const slot = slotIndex(index);
    return `              - slot_${slot}_card
              - slot_${slot}_title
              - slot_${slot}_digital
              - slot_${slot}_analog`;
  }).join("\n");

  const widgetBlocks = Array.from({ length: MAX_CLOCK_WIDGETS }, (_, index) => buildWidgetCard(slotIndex(index))).join("\n");

  const digitalUpdates = Array.from({ length: MAX_CLOCK_WIDGETS }, (_, index) => {
    const slot = slotIndex(index);
    return `      - if:
          condition:
            lambda: return id(slot_${slot}_visible) && !id(slot_${slot}_analogue);
          then:
            - lvgl.label.update:
                id: slot_${slot}_time
                text: !lambda |-
                  auto now = id(ha_time).now();
                  if (!now.is_valid()) return std::string("--:--");
                  char buffer[16];
                  now.strftime(buffer, sizeof(buffer), id(slot_${slot}_show_seconds) ? "%H:%M:%S" : "%H:%M");
                  return std::string(buffer);
            - lvgl.label.update:
                id: slot_${slot}_date
                text: !lambda |-
                  auto now = id(ha_time).now();
                  if (!now.is_valid()) return std::string("-- ---");
                  char buffer[24];
                  now.strftime(buffer, sizeof(buffer), "%a %d %b");
                  return std::string(buffer);`;
  }).join("\n");

  const analogUpdates = Array.from({ length: MAX_CLOCK_WIDGETS }, (_, index) => {
    const slot = slotIndex(index);
    return `      - if:
          condition:
            lambda: return id(slot_${slot}_visible) && id(slot_${slot}_analogue);
          then:
            - lvgl.indicator.update:
                id: slot_${slot}_minute_hand
                value: !lambda |-
                  auto now = id(ha_time).now();
                  if (!now.is_valid()) return 0;
                  return now.minute;
            - lvgl.indicator.update:
                id: slot_${slot}_hour_hand
                value: !lambda |-
                  auto now = id(ha_time).now();
                  if (!now.is_valid()) return 0;
                  return (now.hour % 12) * 60 + now.minute;
            - lvgl.indicator.update:
                id: slot_${slot}_second_hand
                value: !lambda |-
                  auto now = id(ha_time).now();
                  if (!now.is_valid()) return 0;
                  return now.second;`;
  }).join("\n");

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
      - script.execute: apply_live_layout
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
      - script.execute: apply_live_layout
      - script.execute: sync_clock_widgets

time:
  - platform: homeassistant
    id: ha_time
    on_time_sync:
      then:
        - script.execute: apply_live_layout
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

json:

font:
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
    id: montserrat_bold_52
    size: 52
    bpp: 4

text_sensor:
${textSensors}

globals:
${globals}

script:
  - id: apply_live_layout
    then:
      - lambda: |-
          auto parse_slot = [](const std::string &payload, bool &visible, bool &analogue, std::string &title, int &x, int &y, int &w, int &h, bool &show_seconds) {
            visible = false;
            analogue = false;
            title = "Clock";
            x = 0;
            y = 0;
            w = 2;
            h = 2;
            show_seconds = false;
            if (payload.empty()) {
              return;
            }

            std::vector<std::string> parts;
            size_t start = 0;
            while (true) {
              size_t pos = payload.find('|', start);
              if (pos == std::string::npos) {
                parts.push_back(payload.substr(start));
                break;
              }
              parts.push_back(payload.substr(start, pos - start));
              start = pos + 1;
            }

            if (parts.size() < 7) {
              return;
            }

            visible = true;
            analogue = parts[0] == "analogue";
            title = parts[1];
            x = std::max(0, std::min(${SCREEN.columns - 2}, atoi(parts[2].c_str())));
            y = std::max(0, std::min(${SCREEN.rows - 2}, atoi(parts[3].c_str())));
            w = std::max(2, std::min(${SCREEN.columns}, atoi(parts[4].c_str())));
            h = std::max(2, std::min(${SCREEN.rows}, atoi(parts[5].c_str())));
            if (x + w > ${SCREEN.columns}) x = ${SCREEN.columns} - w;
            if (y + h > ${SCREEN.rows}) y = ${SCREEN.rows} - h;
            show_seconds = atoi(parts[6].c_str()) == 1;
          };

          parse_slot(id(slot_1_payload).state, id(slot_1_visible), id(slot_1_analogue), id(slot_1_title_text), id(slot_1_x), id(slot_1_y), id(slot_1_w), id(slot_1_h), id(slot_1_show_seconds));
          parse_slot(id(slot_2_payload).state, id(slot_2_visible), id(slot_2_analogue), id(slot_2_title_text), id(slot_2_x), id(slot_2_y), id(slot_2_w), id(slot_2_h), id(slot_2_show_seconds));
          parse_slot(id(slot_3_payload).state, id(slot_3_visible), id(slot_3_analogue), id(slot_3_title_text), id(slot_3_x), id(slot_3_y), id(slot_3_w), id(slot_3_h), id(slot_3_show_seconds));
          parse_slot(id(slot_4_payload).state, id(slot_4_visible), id(slot_4_analogue), id(slot_4_title_text), id(slot_4_x), id(slot_4_y), id(slot_4_w), id(slot_4_h), id(slot_4_show_seconds));
          parse_slot(id(slot_5_payload).state, id(slot_5_visible), id(slot_5_analogue), id(slot_5_title_text), id(slot_5_x), id(slot_5_y), id(slot_5_w), id(slot_5_h), id(slot_5_show_seconds));
          parse_slot(id(slot_6_payload).state, id(slot_6_visible), id(slot_6_analogue), id(slot_6_title_text), id(slot_6_x), id(slot_6_y), id(slot_6_w), id(slot_6_h), id(slot_6_show_seconds));
          parse_slot(id(slot_7_payload).state, id(slot_7_visible), id(slot_7_analogue), id(slot_7_title_text), id(slot_7_x), id(slot_7_y), id(slot_7_w), id(slot_7_h), id(slot_7_show_seconds));
          parse_slot(id(slot_8_payload).state, id(slot_8_visible), id(slot_8_analogue), id(slot_8_title_text), id(slot_8_x), id(slot_8_y), id(slot_8_w), id(slot_8_h), id(slot_8_show_seconds));
      - lvgl.widget.refresh:
          id:
${refreshList}
      - script.execute: sync_clock_widgets

  - id: sync_clock_widgets
    then:
${digitalUpdates}
${analogUpdates}

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
            pad_all: 0
            radius: 0
            scrollable: false
            widgets:
${widgetBlocks}
`;
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

async function hassFetch(endpoint, options = {}) {
  if (!TOKEN) {
    throw new Error("Missing SUPERVISOR_TOKEN or HASSIO_TOKEN.");
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

async function setHelperValue(entityId, value) {
  await hassFetch("/services/input_text/set_value", {
    method: "POST",
    body: JSON.stringify({
      entity_id: entityId,
      value
    })
  });
}

async function syncHelpers(layout) {
  const warnings = [];

  for (let index = 0; index < MAX_CLOCK_WIDGETS; index += 1) {
    const entityId = helperEntityId(index);
    const widget = layout.widgets[index];
    const payload = widget ? encodeWidgetPayload(widget) : "";
    try {
      await setHelperValue(entityId, payload);
    } catch (error) {
      warnings.push(`${entityId} was not updated: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return warnings;
}

async function writeGeneratedArtifacts() {
  await fs.writeFile(GENERATED_YAML_PATH, buildEsphomeYaml());
  await fs.writeFile(GENERATED_HELPER_PATH, buildHelperYaml());
}

async function loadLayout() {
  const existing = await readStoredLayout();
  if (existing) {
    await writeGeneratedArtifacts();
    return existing;
  }

  const layout = sanitizeLayout(DEFAULT_LAYOUT);
  await writeStoredLayout(layout);
  await writeGeneratedArtifacts();
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
  await writeGeneratedArtifacts();
  const warnings = await syncHelpers(layout);
  return { layout, warnings };
}

app.get("/api/layout", async (_request, response) => {
  try {
    const layout = await loadLayout();
    response.json({
      layout,
      warnings: [],
      helperYaml: buildHelperYaml(),
      exportModel: buildLvglExport(layout),
      exportText: buildEsphomeYaml()
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
    const { layout, warnings } = await saveLayout(request.body?.layout);
    response.json({
      ok: true,
      layout,
      warnings,
      helperYaml: buildHelperYaml(),
      exportModel: buildLvglExport(layout),
      exportText: buildEsphomeYaml()
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
    await writeGeneratedArtifacts();
    const warnings = await syncHelpers(layout);
    response.json({
      ok: true,
      layout,
      warnings,
      helperYaml: buildHelperYaml(),
      exportModel: buildLvglExport(layout),
      exportText: buildEsphomeYaml()
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
      helperYaml: buildHelperYaml(),
      exportModel: buildLvglExport(layout),
      exportText: buildEsphomeYaml()
    });
  } catch (error) {
    log("Failed to export layout", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while exporting layout."
    });
  }
});

app.get("/api/helper-yaml", (_request, response) => {
  response.type("text/plain").send(buildHelperYaml());
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (_request, response) => {
  response.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", async () => {
  log(`Server listening on 0.0.0.0:${PORT}`);
  try {
    await writeGeneratedArtifacts();
  } catch (error) {
    log("Failed to write generated artifacts on startup", error);
  }
});
