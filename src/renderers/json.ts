import type { ScanResult } from "../types/dependency.js";

export function renderJson(results: ScanResult[]): string {
  return JSON.stringify(results, null, 2);
}
