import type { PointerEvent as ReactPointerEvent } from "react";
import type { LayoutWidget } from "../types";

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

export interface ClockWidgetProps {
  widget: LayoutWidget;
  now: Date;
  selected: boolean;
  cellWidth: number;
  cellHeight: number;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onSelect: () => void;
}

export function ClockWidget({
  widget,
  now,
  selected,
  cellWidth,
  cellHeight,
  onPointerDown,
  onResizeStart,
  onSelect
}: ClockWidgetProps) {
  const timeLabel = formatTime(now, widget.showSeconds);
  const dateLabel = formatDate(now);
  const hands = analogueHandAngles(now);

  return (
    <button
      className={`clock-widget ${widget.variant}${selected ? " selected" : ""}`}
      style={{
        left: `${widget.x * cellWidth}px`,
        top: `${widget.y * cellHeight}px`,
        width: `${widget.w * cellWidth}px`,
        height: `${widget.h * cellHeight}px`
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
        </div>
      )}
      <span className="resize-hint">{widget.w} x {widget.h}</span>
      <span className="resize-handle" role="presentation" onPointerDown={onResizeStart} />
    </button>
  );
}
