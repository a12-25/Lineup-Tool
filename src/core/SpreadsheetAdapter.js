export class SpreadsheetAdapter {
  constructor(sheet = null) {
    this.sheet = sheet;
  }

  normalizeHeader(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\$/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  createHeaderMap(headerRow = 1) {
    if (!this.sheet) {
      throw new Error("A sheet reference is required to build a header map.");
    }

    const lastColumn = this.sheet.getLastColumn();
    if (lastColumn < 1) {
      throw new Error(`No columns were found on "${this.sheet.getName()}".`);
    }

    const headers = this.sheet
      .getRange(headerRow, 1, 1, lastColumn)
      .getDisplayValues()[0];

    const headerMap = {};

    headers.forEach((header, index) => {
      const normalized = this.normalizeHeader(header);

      if (normalized && !headerMap[normalized]) {
        headerMap[normalized] = index + 1;
      }
    });

    return headerMap;
  }

  findHeaderColumn(headerMap, aliases, fieldDescription) {
    for (const alias of aliases) {
      const normalizedAlias = this.normalizeHeader(alias);

      if (headerMap[normalizedAlias]) {
        return headerMap[normalizedAlias];
      }
    }

    throw new Error(
      `Could not find the ${fieldDescription} column. Accepted headers: ${aliases.join(", ")}.`
    );
  }

  normalizePosition(value) {
    return String(value ?? "")
      .toUpperCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[\/,]/g, "-")
      .replace(/[–—]/g, "-")
      .replace(/-+/g, "-");
  }

  getEligibleLineupSlots(position) {
    const positionMap = {
      PG: ["PG"],
      G: ["PG", "SG"],
      "G-F": ["SG", "SF"],
      "F-G": ["SG", "SF"],
      F: ["SF", "PF"],
      "F-C": ["PF", "C"],
      "C-F": ["PF", "C"],
      C: ["C"]
    };

    return positionMap[position] || [];
  }

  uniqueSorted(values) {
    return [...new Set(values)]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }
}
