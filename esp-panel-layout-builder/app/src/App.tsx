import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DEFAULT_LAYOUT, GRID_COLUMNS, GRID_ROWS, type ClockVariant, type LayoutWidget } from "./types";

const SCREEN_SIZE = 480;
const CELL_WIDTH = SCREEN_SIZE / GRID_COLUMNS;
const CELL_HEIGHT = SCREEN_SIZE / GRID_ROWS;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(date: Date, useSeconds: boolean) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(useSeconds ? { second: "2-digit" } : {})
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

function analogueHandAngles(date: Date) {
  const hours = date.getHours() % 12;
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  return {
    hour: hours * 30 + minutes * 0.5,
    minute: minutes * 6 + seconds * 0.1,
    second: seconds * 6
  };
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
  const [widgets, setWidgets] = useState<LayoutWidget[]>(DEFAULT_LAYOUT);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_LAYOUT[0]?.id ?? "");
  const [now, setNow] = useState(() => new Date());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!draggingId) return;

    function onPointerMove(event: PointerEvent) {
      const rect = screenRef.current?.getBoundingClientRect();
      const widget = widgets.find((entry) => entry.id === draggingId);
      if (!rect || !widget) return;

      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const nextX = clamp(Math.round(localX / CELL_WIDTH - widget.w / 2), 0, GRID_COLUMNS - widget.w);
      const nextY = clamp(Math.round(localY / CELL_HEIGHT - widget.h / 2), 0, GRID_ROWS - widget.h);

      setWidgets((current) =>
        current.map((entry) => (entry.id === draggingId ? { ...entry, x: nextX, y: nextY } : entry))
      );
    }

    function onPointerUp() {
      setDraggingId(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingId, widgets]);

  const selectedWidget = useMemo(
    () => widgets.find((widget) => widget.id === selectedId) ?? null,
    [selectedId, widgets]
  );

  function updateWidget(id: string, patch: Partial<LayoutWidget>) {
    setWidgets((current) => current.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget)));
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
    setWidgets((current) => [...current, nextClock]);
    setSelectedId(nextClock.id);
  }

  function removeSelected() {
    if (!selectedWidget) return;
    const next = widgets.filter((widget) => widget.id !== selectedWidget.id);
    setWidgets(next);
    setSelectedId(next[0]?.id ?? "");
  }

  function resetLayout() {
    setWidgets(DEFAULT_LAYOUT);
    setSelectedId(DEFAULT_LAYOUT[0]?.id ?? "");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="overline">LVGL Grid Builder</span>
          <h1>Clock Layout Preview</h1>
        </div>
        <div className="header-actions">
          <button className="ghost-button" onClick={resetLayout}>Reset</button>
          <button className="primary-button" onClick={addClock}>Add Clock</button>
        </div>
      </header>

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
              <h2>LVGL</h2>
              <span>{GRID_COLUMNS} x {GRID_ROWS}</span>
            </div>
            <div className="doc-list">
              <a href="https://lvgl.io/docs/open/common-widget-features/layouts/grid" target="_blank" rel="noreferrer">Grid layout</a>
              <a href="https://lvgl.io/docs/open/widgets" target="_blank" rel="noreferrer">Widgets</a>
              <a href="https://lvgl.io/docs/open/examples" target="_blank" rel="noreferrer">Examples</a>
              <a href="https://github.com/lvgl/lvgl" target="_blank" rel="noreferrer">LVGL repo</a>
            </div>
          </section>
        </aside>

        <main className="canvas-panel">
          <div className="canvas-meta">
            <span>480 x 480</span>
            <span>{GRID_COLUMNS} columns</span>
            <span>{GRID_ROWS} rows</span>
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
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setSelectedId(widget.id);
                    setDraggingId(widget.id);
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

function ClockWidget({
  widget,
  now,
  selected,
  onPointerDown,
  onSelect
}: {
  widget: LayoutWidget;
  now: Date;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onSelect: () => void;
}) {
  const timeLabel = formatTime(now, widget.showSeconds);
  const dateLabel = formatDate(now);
  const hands = analogueHandAngles(now);

  return (
    <button
      className={`clock-widget ${widget.variant}${selected ? " selected" : ""}`}
      style={{
        left: `${widget.x * CELL_WIDTH}px`,
        top: `${widget.y * CELL_HEIGHT}px`,
        width: `${widget.w * CELL_WIDTH}px`,
        height: `${widget.h * CELL_HEIGHT}px`
      }}
      onPointerDown={onPointerDown}
      onClick={onSelect}
    >
      <span className="widget-title">{widget.title}</span>

      {widget.variant === "digital" ? (
        <div className="digital-clock">
          <strong>{timeLabel}</strong>
          <span>{dateLabel}</span>
        </div>
      ) : (
        <div className="analogue-clock">
          <svg viewBox="0 0 160 160" className="clock-face" aria-hidden="true">
            <circle cx="80" cy="80" r="70" className="face-ring" />
            {Array.from({ length: 12 }, (_, index) => {
              const angle = (index * 30 * Math.PI) / 180;
              const x1 = 80 + Math.sin(angle) * 54;
              const y1 = 80 - Math.cos(angle) * 54;
              const x2 = 80 + Math.sin(angle) * 64;
              const y2 = 80 - Math.cos(angle) * 64;
              return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} className="tick" />;
            })}
            <g transform={`rotate(${hands.hour} 80 80)`}>
              <line x1="80" y1="84" x2="80" y2="44" className="hand hour-hand" />
            </g>
            <g transform={`rotate(${hands.minute} 80 80)`}>
              <line x1="80" y1="88" x2="80" y2="28" className="hand minute-hand" />
            </g>
            {widget.showSeconds ? (
              <g transform={`rotate(${hands.second} 80 80)`}>
                <line x1="80" y1="92" x2="80" y2="24" className="hand second-hand" />
              </g>
            ) : null}
            <circle cx="80" cy="80" r="6" className="hub" />
          </svg>
          <span>{timeLabel}</span>
        </div>
      )}
    </button>
  );
}

export default App;
