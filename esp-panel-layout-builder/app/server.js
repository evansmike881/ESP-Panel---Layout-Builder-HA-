import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT || "8099", 10);
const HASS_URL = process.env.HASS_URL || "http://supervisor/core/api";
const TOKEN = process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN || "";
const GRID_SIZE = 6;
const WIDGET_IDS = ["w01", "w02", "w03", "w04", "w05", "w06"];
const WIDGET_TYPES = [
  "blank",
  "clock",
  "date",
  "weather",
  "temperature",
  "humidity",
  "button",
  "status"
];
const DEFAULT_LAYOUT = [
  { id: "w01", type: "clock", visible: true, label: "Clock", value: "--:--", icon: "clock", action: "clock", x: 0, y: 0, w: 3, h: 1 },
  { id: "w02", type: "date", visible: true, label: "Date", value: "--", icon: "calendar", action: "date", x: 3, y: 0, w: 3, h: 1 },
  { id: "w03", type: "weather", visible: true, label: "Weather", value: "Partly Cloudy", icon: "weather-partly-cloudy", action: "weather", x: 0, y: 1, w: 3, h: 1 },
  { id: "w04", type: "temperature", visible: true, label: "Temp", value: "12.5", icon: "thermometer", action: "temperature", x: 3, y: 1, w: 2, h: 1 },
  { id: "w05", type: "humidity", visible: true, label: "Humidity", value: "80", icon: "water-percent", action: "humidity", x: 5, y: 1, w: 1, h: 1 },
  { id: "w06", type: "button", visible: true, label: "Main Light", value: "OFF", icon: "ceiling-light", action: "office_light", x: 0, y: 4, w: 2, h: 2 }
];

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
    label: `input_text.esp_panel_${id}_label`,
    value: `input_text.esp_panel_${id}_value`,
    icon: `input_text.esp_panel_${id}_icon`,
    action: `input_text.esp_panel_${id}_action`,
    x: `input_number.esp_panel_${id}_x`,
    y: `input_number.esp_panel_${id}_y`,
    w: `input_number.esp_panel_${id}_w`,
    h: `input_number.esp_panel_${id}_h`
  };
}

function copyDefaultWidget(id) {
  const widget = DEFAULT_LAYOUT.find((item) => item.id === id);
  if (!widget) {
    throw new Error(`Default widget definition missing for ${id}`);
  }
  return { ...widget };
}

function normalizeText(value) {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function normalizeNumber(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateWidget(widget) {
  const errors = [];

  if (!WIDGET_IDS.includes(widget.id)) {
    errors.push(`Unknown widget id: ${widget.id}`);
  }
  if (!WIDGET_TYPES.includes(widget.type)) {
    errors.push(`Invalid widget type for ${widget.id}: ${widget.type}`);
  }
  ["x", "y", "w", "h"].forEach((field) => {
    if (!Number.isInteger(widget[field])) {
      errors.push(`${widget.id} ${field} must be an integer`);
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
    type: WIDGET_TYPES.includes(input?.type) ? input.type : fallback.type,
    visible: typeof input?.visible === "boolean" ? input.visible : fallback.visible,
    label: normalizeText(input?.label ?? fallback.label),
    value: normalizeText(input?.value ?? fallback.value),
    icon: normalizeText(input?.icon ?? fallback.icon),
    action: normalizeText(input?.action ?? fallback.action),
    x: normalizeNumber(input?.x, fallback.x),
    y: normalizeNumber(input?.y, fallback.y),
    w: normalizeNumber(input?.w, fallback.w),
    h: normalizeNumber(input?.h, fallback.h)
  };

  return widget;
}

function compareWidgetValues(expected, actual) {
  const mismatches = [];

  for (const field of ["type", "visible", "label", "value", "icon", "action", "x", "y", "w", "h"]) {
    if (expected[field] !== actual[field]) {
      mismatches.push(
        `${expected.id} ${field} expected "${expected[field]}" but Home Assistant has "${actual[field]}"`
      );
    }
  }

  return mismatches;
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
  const label = readState(helpers.label);
  const value = readState(helpers.value);
  const icon = readState(helpers.icon);
  const action = readState(helpers.action);
  const x = readState(helpers.x);
  const y = readState(helpers.y);
  const w = readState(helpers.w);
  const h = readState(helpers.h);

  return {
    widget: {
      id,
      type: WIDGET_TYPES.includes(type) ? type : fallback.type,
      visible: visible === undefined ? fallback.visible : visible === "on",
      label: normalizeText(label ?? fallback.label),
      value: normalizeText(value ?? fallback.value),
      icon: normalizeText(icon ?? fallback.icon),
      action: normalizeText(action ?? fallback.action),
      x: normalizeNumber(x, fallback.x),
      y: normalizeNumber(y, fallback.y),
      w: normalizeNumber(w, fallback.w),
      h: normalizeNumber(h, fallback.h)
    },
    missing
  };
}

function helperPackageYaml() {
  const selectLines = WIDGET_IDS.map((id) => {
    const fallback = copyDefaultWidget(id);
    return `  esp_panel_${id}_type:
    name: ESP Panel ${id.toUpperCase()} Type
    options:
${WIDGET_TYPES.map((type) => `      - ${type}`).join("\n")}
    initial: ${fallback.type}`;
  }).join("\n");

  const booleanLines = WIDGET_IDS.map((id) => {
    const fallback = copyDefaultWidget(id);
    return `  esp_panel_${id}_visible:
    name: ESP Panel ${id.toUpperCase()} Visible
    initial: ${fallback.visible ? "true" : "false"}`;
  }).join("\n");

  const textLines = WIDGET_IDS.flatMap((id) => {
    const fallback = copyDefaultWidget(id);
    return [
      `  esp_panel_${id}_label:
    name: ESP Panel ${id.toUpperCase()} Label
    initial: "${fallback.label}"`,
      `  esp_panel_${id}_value:
    name: ESP Panel ${id.toUpperCase()} Value
    initial: "${fallback.value}"`,
      `  esp_panel_${id}_icon:
    name: ESP Panel ${id.toUpperCase()} Icon
    initial: "${fallback.icon}"`,
      `  esp_panel_${id}_action:
    name: ESP Panel ${id.toUpperCase()} Action
    initial: "${fallback.action}"`
    ];
  }).join("\n");

  const numberLines = WIDGET_IDS.flatMap((id) => {
    const fallback = copyDefaultWidget(id);
    return [
      `  esp_panel_${id}_x:
    name: ESP Panel ${id.toUpperCase()} X
    min: 0
    max: 5
    step: 1
    mode: box
    initial: ${fallback.x}`,
      `  esp_panel_${id}_y:
    name: ESP Panel ${id.toUpperCase()} Y
    min: 0
    max: 5
    step: 1
    mode: box
    initial: ${fallback.y}`,
      `  esp_panel_${id}_w:
    name: ESP Panel ${id.toUpperCase()} Width
    min: 1
    max: 6
    step: 1
    mode: box
    initial: ${fallback.w}`,
      `  esp_panel_${id}_h:
    name: ESP Panel ${id.toUpperCase()} Height
    min: 1
    max: 6
    step: 1
    mode: box
    initial: ${fallback.h}`
    ];
  }).join("\n");

  return `input_select:
${selectLines}

input_boolean:
${booleanLines}

input_text:
${textLines}

input_number:
${numberLines}
`;
}

async function writeWidget(widget) {
  const helpers = helperMap(widget.id);

  await hassFetch("/services/input_select/select_option", {
    method: "POST",
    body: JSON.stringify({
      entity_id: helpers.type,
      option: widget.type
    })
  });

  await hassFetch(`/services/input_boolean/${widget.visible ? "turn_on" : "turn_off"}`, {
    method: "POST",
    body: JSON.stringify({
      entity_id: helpers.visible
    })
  });

  for (const [field, entityId] of Object.entries({
    label: helpers.label,
    value: helpers.value,
    icon: helpers.icon,
    action: helpers.action
  })) {
    await hassFetch("/services/input_text/set_value", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entityId,
        value: widget[field]
      })
    });
  }

  for (const [field, entityId] of Object.entries({
    x: helpers.x,
    y: helpers.y,
    w: helpers.w,
    h: helpers.h
  })) {
    await hassFetch("/services/input_number/set_value", {
      method: "POST",
      body: JSON.stringify({
        entity_id: entityId,
        value: widget[field]
      })
    });
  }
}

async function buildWidgetResponse() {
  const statesMap = await getStatesMap();
  const missingHelpers = [];
  const widgets = WIDGET_IDS.map((id) => {
    const result = widgetFromStates(id, statesMap);
    missingHelpers.push(...result.missing);
    return result.widget;
  });

  return {
    widgets,
    warnings: [
      ...findOverlapWarnings(widgets),
      ...(missingHelpers.length > 0
        ? [`Missing ${missingHelpers.length} helper entities. Open Helper YAML to create them.`]
        : [])
    ],
    missingHelpers,
    helperYaml: helperPackageYaml(),
    defaults: DEFAULT_LAYOUT
  };
}

async function verifyWrittenWidgets(expectedWidgets) {
  const current = await buildWidgetResponse();
  const mismatches = expectedWidgets.flatMap((expected) => {
    const actual = current.widgets.find((widget) => widget.id === expected.id);
    if (!actual) {
      return [`${expected.id} could not be read back from Home Assistant after apply.`];
    }
    return compareWidgetValues(expected, actual);
  });

  return {
    current,
    mismatches
  };
}

app.get("/api/widgets", async (_request, response) => {
  try {
    response.json(await buildWidgetResponse());
  } catch (error) {
    log("Failed to load widgets", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while loading widgets.",
      widgets: DEFAULT_LAYOUT,
      warnings: ["Falling back to the built-in default layout."],
      missingHelpers: [],
      helperYaml: helperPackageYaml(),
      defaults: DEFAULT_LAYOUT
    });
  }
});

app.get("/api/helper-yaml", (_request, response) => {
  response.type("text/plain").send(helperPackageYaml());
});

app.post("/api/widgets/:id", async (request, response) => {
  try {
    const id = request.params.id;
    if (!WIDGET_IDS.includes(id)) {
      response.status(400).json({ error: `Unsupported widget id: ${id}` });
      return;
    }

    const fallback = copyDefaultWidget(id);
    const widget = sanitizeWidget({ ...request.body, id }, fallback);
    const errors = validateWidget(widget);

    if (errors.length > 0) {
      response.status(400).json({ error: errors.join(" ") });
      return;
    }

    await writeWidget(widget);
    const { current, mismatches } = await verifyWrittenWidgets([widget]);
    const storedWidget = current.widgets.find((item) => item.id === widget.id) || widget;
    const warnings = [...current.warnings, ...mismatches];
    response.json({ ok: true, widget: storedWidget, warnings });
  } catch (error) {
    log("Failed to update widget", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while updating widget."
    });
  }
});

app.post("/api/apply", async (request, response) => {
  try {
    const inputWidgets = Array.isArray(request.body?.widgets) ? request.body.widgets : [];
    if (inputWidgets.length !== WIDGET_IDS.length) {
      response.status(400).json({ error: `Expected ${WIDGET_IDS.length} widgets in request body.` });
      return;
    }

    const widgets = WIDGET_IDS.map((id) => {
      const fallback = copyDefaultWidget(id);
      const rawWidget = inputWidgets.find((widget) => widget?.id === id) || { id };
      return sanitizeWidget(rawWidget, fallback);
    });

    const errors = widgets.flatMap((widget) => validateWidget(widget));
    if (errors.length > 0) {
      response.status(400).json({ error: errors.join(" ") });
      return;
    }

    for (const widget of widgets) {
      await writeWidget(widget);
    }

    const { current, mismatches } = await verifyWrittenWidgets(widgets);

    response.json({
      ok: true,
      widgets: current.widgets,
      warnings: [...current.warnings, ...mismatches]
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
  }
});
