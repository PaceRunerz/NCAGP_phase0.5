import { resolveFieldsForGroups, FIELD_GROUPS, ALWAYS_REQUIRED_FIELDS } from './field-groups.config';

// Tests for the Field Group Engine (Asset Register Spec, Section 3) —
// pure functions, no DB/Nest module needed.
describe('field-groups.config', () => {
  describe('resolveFieldsForGroups', () => {
    it('returns fields from a single group in declared order', () => {
      const fields = resolveFieldsForGroups(['GROUP_1_PHYSICAL_IDENTITY']);
      expect(fields.length).toBe(FIELD_GROUPS.GROUP_1_PHYSICAL_IDENTITY.fields.length);
      expect(fields[0].key).toBe('assetTag');
    });

    it('merges multiple groups and de-duplicates shared keys', () => {
      const fields = resolveFieldsForGroups(['GROUP_1_PHYSICAL_IDENTITY', 'GROUP_2_SECURITY_POSTURE']);
      const keys = fields.map((f) => f.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size); // no duplicate keys even if a field name repeats across groups
    });

    it('ignores unknown group codes without throwing', () => {
      expect(() => resolveFieldsForGroups(['NOT_A_REAL_GROUP'])).not.toThrow();
      expect(resolveFieldsForGroups(['NOT_A_REAL_GROUP'])).toEqual([]);
    });

    it('returns an empty list for an empty group array', () => {
      expect(resolveFieldsForGroups([])).toEqual([]);
    });

    it('no field in the catalogue uses a plain boolean type', () => {
      // Section 6, rule 1: Yes/No fields must never silently default —
      // a plain boolean type would make that impossible to enforce in the UI,
      // since JS booleans have no way to represent "not yet known".
      const allFields = Object.values(FIELD_GROUPS).flatMap((g) => g.fields);
      for (const f of allFields) {
        expect(f.type).not.toBe('boolean');
      }
    });

    it('GROUP_6_LICENSE_CERT marks expiryDate as required and expiry-alerting', () => {
      const expiryField = FIELD_GROUPS.GROUP_6_LICENSE_CERT.fields.find((f) => f.key === 'expiryDate');
      expect(expiryField?.required).toBe(true);
      expect(expiryField?.drivesExpiryAlert).toBe(true);
    });
  });

  describe('ALWAYS_REQUIRED_FIELDS', () => {
    it('contains exactly the Section 1 minimum required set', () => {
      expect(ALWAYS_REQUIRED_FIELDS.sort()).toEqual(
        ['name', 'businessUnit', 'category', 'criticality', 'dataSensitivity'].sort(),
      );
    });
  });
});
