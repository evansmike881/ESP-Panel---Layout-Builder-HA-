import type { PanelTheme, WidgetConfig, WidgetResponse } from "./types";

export interface EntityOption {
  entity_id: string;
  name: string;
  domain: string;
  state: string;
}

function apiUrl(path: string) {
  const href = window.location.href.replace(/[#?].*$/, "");
  const base = href.endsWith("/") ? href : `${href}/`;
  return new URL(path.replace(/^\//, ""), base).toString();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === "string" ? body : body?.error || "Request failed";
    throw new Error(message);
  }

  return body as T;
}

export function fetchWidgets() {
  return request<WidgetResponse>("api/widgets");
}

export function reloadWidgets() {
  return request<WidgetResponse>("api/reload", {
    method: "POST"
  });
}

export function applyWidgets(widgets: WidgetConfig[], theme: PanelTheme) {
  return request<{ ok: boolean; widgets: WidgetConfig[]; warnings: string[] }>("api/apply", {
    method: "POST",
    body: JSON.stringify({ widgets, theme })
  });
}

export function applyWidget(widget: WidgetConfig) {
  return request<{ ok: boolean; widget: WidgetConfig; warnings: string[] }>(`api/widgets/${widget.id}`, {
    method: "POST",
    body: JSON.stringify(widget)
  });
}

export function fetchEntities() {
  return request<{ entities: EntityOption[] }>("api/entities");
}

export function fetchValueSources() {
  return request<{ entities: EntityOption[] }>("api/value-sources");
}
