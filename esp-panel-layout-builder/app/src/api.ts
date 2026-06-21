import type { LayoutState } from "./types";

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

export interface LayoutApiResponse {
  layout: LayoutState;
  exportModel: unknown;
  exportText: string;
}

export function fetchLayout() {
  return request<LayoutApiResponse>("api/layout");
}

export function saveLayout(layout: LayoutState) {
  return request<LayoutApiResponse>("api/layout", {
    method: "POST",
    body: JSON.stringify({ layout })
  });
}

export function resetLayout() {
  return request<LayoutApiResponse>("api/layout/reset", {
    method: "POST"
  });
}

export function fetchExport() {
  return request<{ exportModel: unknown; exportText: string }>("api/export");
}
