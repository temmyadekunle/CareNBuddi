/**
 * Health Passport preferences — pure model.
 *
 * Kept out of the profile UI components so both the profile page, the
 * settings panel and tests import the same shape from a TypeScript module
 * (node --test strips .ts, but not .tsx). No storage, DOM or React here.
 */

export interface PassportPrefs {
  hmo: string;
  emergencyContact: string;
  emergencyPhone: string;
  /** National Identification Number — kept identity field. */
  nin: string;
}

export const PASSPORT_DEFAULTS: PassportPrefs = {
  hmo: "",
  emergencyContact: "",
  emergencyPhone: "",
  nin: "",
};

/**
 * One-time privacy scrub for the BVN removal.
 *
 * The Health Passport used to carry a Bank Verification Number; the field is
 * gone from the interface and the stored shape, but older devices may still
 * hold it in the localStorage payload — and, because the passport is a
 * synced collection, in the cloud backup too. Call this once per passport
 * surface mount: when the stored value still contains a legacy `bvn`, it
 * returns the cleaned payload and the caller writes it back, which also
 * replaces the cloud copy on the next backup push. NIN and every other
 * field pass through untouched, and no database column is touched (none
 * existed — the passport is a whole-document backup, not columns).
 */
export function stripLegacyBvn(value: unknown): {
  clean: PassportPrefs;
  hadBvn: boolean;
} {
  const base = typeof value === "object" && value !== null ? value : {};
  const hadBvn = Object.prototype.hasOwnProperty.call(base, "bvn");
  if (!hadBvn) {
    return {
      clean: { ...PASSPORT_DEFAULTS, ...(base as Partial<PassportPrefs>) },
      hadBvn,
    };
  }
  const { bvn, ...rest } = base as Record<string, unknown> & { bvn?: unknown };
  void bvn;
  return {
    clean: { ...PASSPORT_DEFAULTS, ...(rest as Partial<PassportPrefs>) },
    hadBvn: true,
  };
}
