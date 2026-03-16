export interface LicenseNormalizationResult {
  normalizedExpression?: string;
  warnings: string[];
}

const EXACT_LICENSE_MAP = new Map<string, string>([
  ["MIT", "MIT"],
  ["ISC", "ISC"],
  ["WTFPL", "WTFPL"],
  ["UNLICENSED", "UNLICENSED"],
  ["APACHE-2.0", "Apache-2.0"],
  ["APACHE 2.0", "Apache-2.0"],
  ["APACHE LICENSE 2.0", "Apache-2.0"],
  ["APACHE LICENSE VERSION 2.0", "Apache-2.0"],
  ["APACHE-2", "Apache-2.0"],
  ["BSD-2-CLAUSE", "BSD-2-Clause"],
  ["BSD 2-CLAUSE", "BSD-2-Clause"],
  ["BSD-3-CLAUSE", "BSD-3-Clause"],
  ["BSD 3-CLAUSE", "BSD-3-Clause"],
  ["MPL-2.0", "MPL-2.0"],
  ["MPL 2.0", "MPL-2.0"],
  ["CC-BY-4.0", "CC-BY-4.0"],
  ["PYTHON-2.0", "Python-2.0"],
  ["GPL-2.0", "GPL-2.0"],
  ["GPL-2.0-ONLY", "GPL-2.0-only"],
  ["GPL-2.0-OR-LATER", "GPL-2.0-or-later"],
  ["GPLV2", "GPL-2.0-only"],
  ["GPL V2", "GPL-2.0-only"],
  ["GPL VERSION 2", "GPL-2.0-only"],
  ["GPL-3.0", "GPL-3.0"],
  ["GPL-3.0-ONLY", "GPL-3.0-only"],
  ["GPL-3.0-OR-LATER", "GPL-3.0-or-later"],
  ["GPLV3", "GPL-3.0-only"],
  ["GPL V3", "GPL-3.0-only"],
  ["LGPL-2.1", "LGPL-2.1"],
  ["LGPL-2.1-ONLY", "LGPL-2.1-only"],
  ["LGPL-2.1-OR-LATER", "LGPL-2.1-or-later"],
  ["LGPL-3.0", "LGPL-3.0"],
  ["LGPL-3.0-ONLY", "LGPL-3.0-only"],
  ["LGPL-3.0-OR-LATER", "LGPL-3.0-or-later"],
]);

function cleanLicenseValue(value: string): string {
  return value.trim().replace(/^\(+|\)+$/g, "").replace(/\s+/g, " ");
}

function mapExactLicense(value: string): string | undefined {
  return EXACT_LICENSE_MAP.get(value.toUpperCase());
}

function normalizeReferenceLicense(value: string): LicenseNormalizationResult {
  if (/^SEE LICEN[CS]E IN /i.test(value)) {
    return {
      normalizedExpression: value,
      warnings: ["License uses a file reference instead of a normalized SPDX expression."],
    };
  }

  return {
    normalizedExpression: value,
    warnings: ["License metadata could not be normalized to a known SPDX-style identifier."],
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
  const cleanedValue = cleanLicenseValue(value);
  const exactMatch = mapExactLicense(cleanedValue);

  if (exactMatch) {
    return { normalizedExpression: exactMatch, warnings: [] };
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
