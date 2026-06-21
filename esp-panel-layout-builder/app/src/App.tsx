import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLayout, resetLayout as resetStoredLayout, saveLayout } from "./api";
import { DEFAULT_LAYOUT, GRID_COLUMNS, GRID_ROWS, type ClockVariant, type LayoutState, type LayoutWidget } from "./types";
import { ClockWidget } from "./components/ClockWidget";

const SCREEN_SIZE = 480;
const CELL_WIDTH = SCREEN_SIZE / GRID_COLUMNS;
const CELL_HEIGHT = SCREEN_SIZE / GRID_ROWS;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createClock(idNumber: number): LayoutWidget {
  return {
    id: `clock-${idNumber}`,
    type: "clock",
    title: `Clock ${idNumber}`,
    variant: idNumber % 2 === 0 ? "analogue" : "digital",
    x: 0,
    y: 0,
    w: 4,
    h: idNumber % 2 === 0 ? 4 : 2,
    showSeconds: false
  };
}

function App() {
  const [layout, setLayout] = useState<LayoutState>(DEFAULT_LAYOUT);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_LAYOUT.widgets[0]?.id ?? "");
  const [now, setNow] = useState(() => new Date());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading saved layout...");
  const [exportText, setExportText] = useState("");
  const screenRef = useRef<HTMLDivElement | null>(null);
  const skipAutoSaveRef = useRef(true);
  const resizeOriginRef = useRef<{ pointerX: number; pointerY: number; widget: LayoutWidget } | null>(null);

  const widgets = layout.widgets;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const response = await fetchLayout();
        if (!active) return;
        setLayout(response.layout);
        setSelectedId(response.layout.widgets[0]?.id ?? "");
        setExportText(response.exportText);
        setStatus("Loaded saved layout.");
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load layout.");
        setStatus("Using in-browser defaults.");
      } finally {
        if (active) {
          skipAutoSaveRef.current = true;
          setIsLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draggingId && !resizingId) return;

    function onPointerMove(event: PointerEvent) {
      const rect = screenRef.current?.getBoundingClientRect();
      const widget = widgets.find((entry) => entry.id === draggingId || entry.id === resizingId);
      if (!rect || !widget) return;

      if (draggingId) {
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const nextX = clamp(Math.round(localX / CELL_WIDTH - widget.w / 2), 0, GRID_COLUMNS - widget.w);
        const nextY = clamp(Math.round(localY / CELL_HEIGHT - widget.h / 2), 0, GRID_ROWS - widget.h);

        setLayout((current) => ({
          ...current,
          widgets: current.widgets.map((entry) => (entry.id === draggingId ? { ...entry, x: nextX, y: nextY } : entry))
        }));
        return;
      }

      if (resizingId && resizeOriginRef.current) {
        const deltaColumns = Math.round((event.clientX - resizeOriginRef.current.pointerX) / CELL_WIDTH);
        const deltaRows = Math.round((event.clientY - resizeOriginRef.current.pointerY) / CELL_HEIGHT);
        const originWidget = resizeOriginRef.current.widget;
        const nextW = clamp(originWidget.w + deltaColumns, 2, GRID_COLUMNS - originWidget.x);
        const nextH = clamp(originWidget.h + deltaRows, 2, GRID_ROWS - originWidget.y);

        setLayout((current) => ({
          ...current,
          widgets: current.widgets.map((entry) => (entry.id === resizingId ? { ...entry, w: nextW, h: nextH } : entry))
        }));
      }
    }

    function onPointerUp() {
      setDraggingId(null);
      setResizingId(null);
      resizeOriginRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingId, resizingId, widgets]);

  useEffect(() => {
    if (isLoading) return;
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSaving(true);
      setError("");
      try {
        const response = await saveLayout(layout);
        setLayout(response.layout);
        setExportText(response.exportText);
        setStatus(`Saved ${response.layout.widgets.length} clock widget${response.layout.widgets.length === 1 ? "" : "s"}.`);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save layout.");
        setStatus("Save failed.");
      } finally {
        setIsSaving(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [isLoading, layout]);

  const selectedWidget = useMemo(() => widgets.find((widget) => widget.id === selectedId) ?? null, [selectedId, widgets]);

  function updateWidget(id: string, patch: Partial<LayoutWidget>) {
    setLayout((current) => ({
      ...current,
      widgets: current.widgets.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget))
    }));
  }

  function updateSelected(patch: Partial<LayoutWidget>) {
    if (!selectedWidget) return;
    const next = { ...selectedWidget, ...patch };
    next.w = clamp(next.w, 2, GRID_COLUMNS);
    next.h = clamp(next.h, 2, GRID_ROWS);
    next.x = clamp(next.x, 0, GRID_COLUMNS - next.w);
    next.y = clamp(next.y, 0, GRID_ROWS - next.h);
    updateWidget(selectedWidget.id, next);
  }

  function addClock() {
    const nextClock = createClock(widgets.length + 1);
    const occupied = widgets.length;
    nextClock.x = occupied % (GRID_COLUMNS - nextClock.w + 1);
    nextClock.y = Math.min(Math.floor(occupied / 2), GRID_ROWS - nextClock.h);
    setLayout((current) => ({
      ...current,
      widgets: [...current.widgets, nextClock]
    }));
    setSelectedId(nextClock.id);
  }

  function removeSelected() {
    if (!selectedWidget) return;
    const next = widgets.filter((widget) => widget.id !== selectedWidget.id);
    setLayout((current) => ({
      ...current,
      widgets: next
    }));
    setSelectedId(next[0]?.id ?? "");
  }

  async function handleReset() {
    setError("");
    try {
      const response = await resetStoredLayout();
      skipAutoSaveRef.current = true;
      setLayout(response.layout);
      setSelectedId(response.layout.widgets[0]?.id ?? "");
      setExportText(response.exportText);
      setStatus("Layout reset to defaults.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset layout.");
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="overline">LVGL Grid Builder</span>
          <h1>Clock Layout Preview</h1>
        </div>
        <div className="header-actions">
          <button className="ghost-button" onClick={handleReset}>Reset</button>
          <button className="primary-button" onClick={addClock}>Add Clock</button>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      <div className="banner info">{isSaving ? "Saving layout..." : status}</div>

      <div className="workspace">
        <aside className="sidebar">
          <section className="panel-section">
            <div className="section-head">
              <h2>Widgets</h2>
              <span>{widgets.length}</span>
            </div>
            <div className="widget-list">
              {widgets.map((widget) => (
                <button
                  key={widget.id}
                  className={`widget-row${widget.id === selectedId ? " active" : ""}`}
                  onClick={() => setSelectedId(widget.id)}
                >
                  <strong>{widget.title}</strong>
                  <span>{widget.variant}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-head">
              <h2>ESPHome YAML</h2>
              <span>Generated</span>
            </div>
            <textarea className="export-box" readOnly value={exportText} />
          </section>
        </aside>

        <main className="canvas-panel">
          <div className="canvas-meta">
            <span>480 x 480</span>
            <span>{layout.screen.columns} columns</span>
            <span>{layout.screen.rows} rows</span>
          </div>

          <div className="panel-frame">
            <div
              ref={screenRef}
              className="lvgl-screen"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
              }}
            >
              {Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, index) => (
                <div key={index} className="grid-cell" />
              ))}

              {widgets.map((widget) => (
                <ClockWidget
                  key={widget.id}
                  now={now}
                  selected={widget.id === selectedId}
                  widget={widget}
                  cellWidth={CELL_WIDTH}
                  cellHeight={CELL_HEIGHT}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setSelectedId(widget.id);
                    setDraggingId(widget.id);
                    setResizingId(null);
                  }}
                  onResizeStart={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedId(widget.id);
                    setDraggingId(null);
                    setResizingId(widget.id);
                    resizeOriginRef.current = {
                      pointerX: event.clientX,
                      pointerY: event.clientY,
                      widget: { ...widget }
                    };
                  }}
                  onSelect={() => setSelectedId(widget.id)}
                />
              ))}
            </div>
          </div>
        </main>

        <aside className="sidebar">
          <section className="panel-section">
            <div className="section-head">
              <h2>Inspector</h2>
              <span>{selectedWidget?.id ?? "none"}</span>
            </div>

            {selectedWidget ? (
              <div className="inspector">
                <label className="field">
                  <span>Title</span>
                  <input
                    value={selectedWidget.title}
                    onChange={(event) => updateSelected({ title: event.target.value })}
                  />
                </label>

                <label className="field">
                  <span>View</span>
                  <select
                    value={selectedWidget.variant}
                    onChange={(event) => updateSelected({ variant: event.target.value as ClockVariant })}
                  >
                    <option value="digital">Digital</option>
                    <option value="analogue">Analogue</option>
                  </select>
                </label>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={selectedWidget.showSeconds}
                    onChange={(event) => updateSelected({ showSeconds: event.target.checked })}
                  />
                  <span>Show seconds</span>
                </label>

                <div className="field-grid">
                  <label className="field">
                    <span>X</span>
                    <input
                      type="number"
                      min={0}
                      max={GRID_COLUMNS - selectedWidget.w}
                      value={selectedWidget.x}
                      onChange={(event) => updateSelected({ x: Number.parseInt(event.target.value || "0", 10) })}
                    />
                  </label>
                  <label className="field">
                    <span>Y</span>
                    <input
                      type="number"
                      min={0}
                      max={GRID_ROWS - selectedWidget.h}
                      value={selectedWidget.y}
                      onChange={(event) => updateSelected({ y: Number.parseInt(event.target.value || "0", 10) })}
                    />
                  </label>
                </div>

                <div className="field-grid">
                  <label className="field">
                    <span>Width</span>
                    <input
                      type="number"
                      min={2}
                      max={GRID_COLUMNS}
                      value={selectedWidget.w}
                      onChange={(event) => updateSelected({ w: Number.parseInt(event.target.value || "2", 10) })}
                    />
                  </label>
                  <label className="field">
                    <span>Height</span>
                    <input
                      type="number"
                      min={2}
                      max={GRID_ROWS}
                      value={selectedWidget.h}
                      onChange={(event) => updateSelected({ h: Number.parseInt(event.target.value || "2", 10) })}
                    />
                  </label>
                </div>

                <button className="danger-button" onClick={removeSelected}>Delete Clock</button>
              </div>
            ) : (
              <div className="empty-state">No clock selected.</div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default App;
