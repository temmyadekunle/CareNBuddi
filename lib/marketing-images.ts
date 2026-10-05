/**
 * Central registry of every photograph used on the marketing site.
 *
 * All images are free-to-use Pexels photos (Pexels License: free to use,
 * attribution appreciated but not required). Swap any entry for a local file by
 * pointing `local` at a path inside /public and replacing `src`.
 */

export type MarketingImage = {
  /** Absolute URL at a given render width. */
  src: (width: number) => string;
  srcSet: string;
  sizes: string;
  alt: string;
  /** Intrinsic aspect ratio, used to reserve space and avoid layout shift. */
  width: number;
  height: number;
  credit: string;
  source: string;
};

const WIDTHS = [480, 768, 1080, 1440];

function pexels(photoId: number) {
  return (width: number) =>
    `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

function image(opts: {
  photoId: number;
  alt: string;
  width: number;
  height: number;
  credit: string;
  local?: string;
}): MarketingImage {
  const remote = pexels(opts.photoId);
  const useLocal = Boolean(opts.local);
  const build = (w: number) => (useLocal ? (opts.local as string) : remote(w));
  return {
    src: build,
    srcSet: useLocal ? "" : WIDTHS.map((w) => `${remote(w)} ${w}w`).join(", "),
    sizes: "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 620px",
    alt: opts.alt,
    width: opts.width,
    height: opts.height,
    credit: opts.credit,
    source: `https://www.pexels.com/photo/${opts.photoId}/`,
  };
}

export const MARKETING_IMAGES = {
  /** Hero: clinician speaking with a patient in a clinic corridor. */
  careConsultation: image({
    photoId: 6303645,
    alt: "A healthcare professional explaining a diagnosis to a patient during a clinic consultation",
    width: 1400,
    height: 933,
    credit: "Klaus Nielsen / Pexels",
  }),

  /** For Patients: a patient talking with a doctor in a hospital hallway. */
  patientExperience: image({
    photoId: 6303659,
    alt: "A patient talking with a doctor in a hospital hallway",
    width: 1400,
    height: 973,
    credit: "Klaus Nielsen / Pexels",
  }),

  /** For Providers: a diverse clinical team. */
  providerTeam: image({
    photoId: 6129507,
    alt: "A diverse team of doctors and nurses standing together in a hospital",
    width: 1400,
    height: 933,
    credit: "RDNE Stock project / Pexels",
  }),

  /** Portrait crop: a nurse speaking with a patient. */
  nurseWithPatient: image({
    photoId: 6303647,
    alt: "A nurse speaking with a patient in a hospital corridor",
    width: 1400,
    height: 2100,
    credit: "Klaus Nielsen / Pexels",
  }),

  /** Final CTA: a nurse walking with a patient through a corridor. */
  corridorCare: image({
    photoId: 33932453,
    alt: "A nurse walking alongside a patient in a hospital corridor",
    width: 1400,
    height: 935,
    credit: "Wellington Tavares / Pexels",
  }),

  /** Mobile usage: a person holding a phone. */
  phoneInHand: image({
    photoId: 9429449,
    alt: "A person holding a smartphone",
    width: 1400,
    height: 933,
    credit: "Pexels",
  }),

  /** Care in progress: a nurse taking a sample from a patient. */
  careInProgress: image({
    photoId: 6129680,
    alt: "A nurse in scrubs caring for a patient in a hospital ward",
    width: 1400,
    height: 933,
    credit: "RDNE Stock project / Pexels",
  }),
} satisfies Record<string, MarketingImage>;

export type MarketingImageKey = keyof typeof MARKETING_IMAGES;
