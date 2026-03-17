import type { Warning } from "../../types/dependency.js";
import type { WarningCode, WarningDetailsByCode } from "../../core/warning-codes.js";

export function createAdapterWarning<Code extends WarningCode>(
  code: Code,
  options?: {
    packageName?: string;
    details?: Code extends keyof WarningDetailsByCode ? WarningDetailsByCode[Code] : never;
  },
): Warning {
  return {
    code,
    packageName: options?.packageName,
    details: options?.details,
  } as Warning;
}
