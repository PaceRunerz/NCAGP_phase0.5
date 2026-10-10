import { parseCsv, parseCsvToObjects, stringifyCsv } from './csv-utils';

describe('csv-utils', () => {
  describe('parseCsv', () => {
    it('parses a simple comma-separated file', () => {
      const rows = parseCsv('a,b,c\n1,2,3');
      expect(rows).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ]);
    });

    it('handles quoted fields containing commas', () => {
      const rows = parseCsv('name,notes\n"Desktop 1","Floor 3, Room 12"');
      expect(rows[1]).toEqual(['Desktop 1', 'Floor 3, Room 12']);
    });

    it('handles escaped double quotes inside a quoted field', () => {
      const rows = parseCsv('name\n"He said ""hello"""');
      expect(rows[1]).toEqual(['He said "hello"']);
    });

    it('handles a file with no trailing newline', () => {
      const rows = parseCsv('a,b\n1,2');
      expect(rows.length).toBe(2);
    });

    it('handles CRLF line endings (typical Excel export)', () => {
      const rows = parseCsv('a,b\r\n1,2\r\n3,4');
      expect(rows).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    it('ignores fully blank lines', () => {
      const rows = parseCsv('a,b\n1,2\n\n3,4');
      expect(rows.length).toBe(3);
    });
  });

  describe('parseCsvToObjects', () => {
    it('maps header labels to keys, case-insensitively', () => {
      const map = { 'asset name': 'name', department: 'businessUnit' };
      const objects = parseCsvToObjects('Asset Name,Department\nDesktop 1,IT Division', map);
      expect(objects).toEqual([{ name: 'Desktop 1', businessUnit: 'IT Division' }]);
    });

    it('falls back to the raw header text when no mapping exists', () => {
      const objects = parseCsvToObjects('Unknown Column\nvalue1', {});
      expect(objects).toEqual([{ 'Unknown Column': 'value1' }]);
    });

    it('trims whitespace from every cell', () => {
      const map = { name: 'name' };
      const objects = parseCsvToObjects('name\n  Desktop 1  ', map);
      expect(objects[0].name).toBe('Desktop 1');
    });

    it('returns an empty array for a header-only file', () => {
      const objects = parseCsvToObjects('name,department', { name: 'name', department: 'businessUnit' });
      expect(objects).toEqual([]);
    });
  });

  describe('stringifyCsv', () => {
    it('quotes fields containing commas on the way back out', () => {
      const csv = stringifyCsv([['name', 'notes'], ['Desktop 1', 'Floor 3, Room 12']]);
      expect(csv).toContain('"Floor 3, Room 12"');
    });

    it('round-trips through parseCsv unchanged', () => {
      const original = [
        ['name', 'notes'],
        ['Desktop "Prime"', 'has, a comma'],
      ];
      const csv = stringifyCsv(original);
      const reparsed = parseCsv(csv);
      expect(reparsed).toEqual(original);
    });
  });
});
