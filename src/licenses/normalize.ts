import { WARNING_CODES } from "../core/warning-codes.js";
import type { Warning } from "../types/dependency.js";
import spdxCorrect from "spdx-correct";
import parseSpdxExpression from "spdx-expression-parse";
import validateSpdxExpression from "spdx-expression-validate";
import validateNpmPackageLicense from "validate-npm-package-license";

export interface LicenseNormalizationResult {
  normalizedExpression?: string;
  warnings: Warning[];
}

function cleanLicenseValue(value: string): string {
  return value
    .trim()
    .replace(/^\(+|\)+$/g, "")
    .replace(/\s+/g, " ");
}

function normalizeOperators(value: string): string {
  return value.replace(/\s+or\s+/gi, " OR ").replace(/\s+and\s+/gi, " AND ");
}

function isAmbiguousHeuristicInput(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();

  if (["BSD", "GPL", "LGPL", "AGPL"].includes(normalized)) {
    return true;
  }

  return (
    /^BSD(?:[- ]?\d)?$/.test(normalized) ||
    /^GPL(?:[- ]?V?\d(?:\.\d+)?)?$/.test(normalized) ||
    /^LGPL(?:[- ]?V?\d(?:\.\d+)?)?$/.test(normalized) ||
    /^AGPL(?:[- ]?V?\d(?:\.\d+)?)?$/.test(normalized)
  );
}

function isValidSpdxExpression(value: string): boolean {
  if (!validateSpdxExpression(value)) {
    return false;
  }

  try {
    parseSpdxExpression(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeUsingNpmLicenseValidation(value: string): string | undefined {
  const validationResult = validateNpmPackageLicense(value);

  if (validationResult.spdx && isValidSpdxExpression(value)) {
    return value;
  }

  if (validationResult.unlicensed) {
    return "UNLICENSED";
  }

  return undefined;
}

function normalizeReferenceLicense(value: string): LicenseNormalizationResult {
  if (/^SEE LICEN[CS]E IN /i.test(value)) {
    return {
      normalizedExpression: value,
      warnings: [{ code: WARNING_CODES.licenseFileReference }],
    };
  }

  return {
    normalizedExpression: value,
    warnings: [{ code: WARNING_CODES.licenseNotNormalized }],
  };
}

function splitCompositeLicense(value: string): { parts: string[]; separator: string } | undefined {
  if (value.includes(" OR ")) {
    return { parts: value.split(/\s+OR\s+/i), separator: " OR " };
  }

  if (value.includes(" AND ")) {
    return { parts: value.split(/\s+AND\s+/i), separator: " AND " };
  }

  if (value.includes("/")) {
    return { parts: value.split("/"), separator: " OR " };
  }

  return undefined;
}

export function normalizeLicenseValue(value: string): LicenseNormalizationResult {
  const cleanedValue = normalizeOperators(cleanLicenseValue(value));

  if (/^SEE LICEN[CS]E IN /i.test(cleanedValue)) {
    return normalizeReferenceLicense(cleanedValue);
  }

  const npmValidatedExpression = normalizeUsingNpmLicenseValidation(cleanedValue);
  if (npmValidatedExpression) {
    return { normalizedExpression: npmValidatedExpression, warnings: [] };
  }

  if (isValidSpdxExpression(cleanedValue)) {
    return { normalizedExpression: cleanedValue, warnings: [] };
  }

  const composite = splitCompositeLicense(cleanedValue);
  if (composite) {
    const normalizedParts = composite.parts.map((part) => normalizeLicenseValue(part));
    const normalizedExpression = normalizedParts
      .map((part) => part.normalizedExpression)
      .filter((part): part is string => part !== undefined)
      .join(composite.separator);

    return {
      normalizedExpression: normalizedExpression || cleanedValue,
      warnings: normalizedParts.flatMap((part) => part.warnings),
    };
  }

  const correctedLicense = spdxCorrect(cleanedValue);
  if (correctedLicense && isValidSpdxExpression(correctedLicense)) {
    return {
      normalizedExpression: correctedLicense,
      warnings: isAmbiguousHeuristicInput(cleanedValue)
        ? [
            {
              code: WARNING_CODES.licenseHeuristicallyNormalized,
              details: {
                normalizedExpression: correctedLicense,
              },
            },
          ]
        : [],
    };
  }

  return normalizeReferenceLicense(cleanedValue);
}

export function normalizeLicenseField(value: string | string[]): LicenseNormalizationResult {
  if (Array.isArray(value)) {
    const normalizedParts = value.map((part) => normalizeLicenseValue(part));

    return {
      normalizedExpression: normalizedParts
        .map((part) => part.normalizedExpression)
        .filter((part): part is string => part !== undefined)
        .join(" OR "),
      warnings: normalizedParts.flatMap((part) => part.warnings),
    };
  }

  return normalizeLicenseValue(value);
}
