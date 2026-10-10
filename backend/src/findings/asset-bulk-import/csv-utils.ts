// ─────────────────────────────────────────────────────────────────
// SYNC — Minimal CSV utils (Asset Register Spec, Section 7)
// No external dependency — handles quoted fields, embedded commas, and
// embedded quotes ("" escaping), which covers every real-world Excel
// export/import case this feature needs.
// File: src/asset-bulk-import/csv-utils.ts
// ─────────────────────────────────────────────────────────────────

export function stringifyCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((c) => {
      const s = c === null || c === undefined ? '' : String(c);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(',');
}

export function stringifyCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map(stringifyCsvRow).join('\r\n');
}

/** Parses raw CSV text into an array of string-cell rows, respecting quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  // Trailing cell/row (file may or may not end in newline)
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** Parses CSV into header-keyed row objects, using the given header->key map (label match, case-insensitive, trimmed). */
export function parseCsvToObjects(text: string, headerLabelToKey: Record<string, string>): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const keys = headerRow.map((h) => headerLabelToKey[h.trim().toLowerCase()] || h.trim());
  return dataRows.map((r) => {
    const obj: Record<string, string> = {};
    keys.forEach((k, idx) => {
      obj[k] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}
