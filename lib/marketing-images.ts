/**
 * Central registry of every photograph used on the marketing site.
 *
 * All images are free-to-use Pexels photos (Pexels License: free to use,
 * attribution appreciated but not required). The footer carries the credit
 * line. To add photographer names, open each photo's Pexels page — the site
 * blocks scraping, so names cannot be read automatically.
 *
 * The set is deliberately Nigeria- and Africa-led: the hero and the preventive
 * care image were photographed in Lagos, and the provider, patient and records
 * images all show Black clinicians and patients.
 *
 * Every entry is tied to a feature that actually exists in the app. Images for
 * features we have not built are kept at the bottom of this file, unused, so
 * they are ready if those modules ship — they must not appear on the marketing
 * site until then.
 */

export type MarketingImage = {
  /** Absolute URL at a given render width. */
  src: (width: number) => string;
  srcSet: string;
  sizes: string;
  alt: string;
  /** Intrinsic dimensions, used to reserve space and avoid layout shift. */
  width: number;
  height: number;
  credit: string;
  source: string;
};

const WIDTHS = [480, 768, 1080, 1440];

function pexelsUrl(photoId: number, width: number, ratio?: number, focus?: string) {
  const base = `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
  if (!ratio) return base;
  const crop = focus ? `&crop=${focus}` : "";
  return `${base}&h=${Math.round(width / ratio)}&fit=crop${crop}`;
}

/**
 * @param ratio  Optional display aspect ratio. When set, the CDN crops to it
 *               so we never download a 3:2 original for a 3:4 slot.
 * @param focus  imgix focal point, e.g. "faces" to keep heads in frame.
 */
function image(opts: {
  photoId: number;
  alt: string;
  width: number;
  height: number;
  credit?: string;
  ratio?: number;
  focus?: string;
}): MarketingImage {
  const url = (w: number) => pexelsUrl(opts.photoId, w, opts.ratio, opts.focus);
  return {
    src: url,
    srcSet: WIDTHS.map((w) => `${url(w)} ${w}w`).join(", "),
    sizes: "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 620px",
    alt: opts.alt,
    width: opts.width,
    height: opts.height,
    credit: opts.credit ?? "Pexels",
    source: `https://www.pexels.com/photo/${opts.photoId}/`,
  };
}

/**
 * A brand-owned photograph shipped from /public rather than a stock CDN.
 * There is no srcSet because these files are not resized at build time.
 */
function localBrandImage(opts: {
  path: string;
  alt: string;
  width: number;
  height: number;
  credit?: string;
}): MarketingImage {
  return {
    src: () => opts.path,
    srcSet: "",
    sizes: "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 620px",
    alt: opts.alt,
    width: opts.width,
    height: opts.height,
    credit: opts.credit ?? "HealthLink",
    source: opts.path,
  };
}

export const MARKETING_IMAGES = {
  /** Hero: a doctor consulting with a patient during a clinic visit in Lagos. */
  lagosConsultation: image({
    photoId: 30677597,
    alt: "A doctor consulting with a patient during a clinic visit in Lagos",
    width: 2000,
    height: 1333,
    ratio: 1.25,
    focus: "faces",
  }),

  /** For Patients: a patient talking with her doctor during a consultation. */
  patientConsultation: image({
    photoId: 4266930,
    alt: "A patient talking with her doctor during a consultation",
    width: 2000,
    height: 3000,
    ratio: 0.78,
    focus: "faces",
  }),

  /** For Providers: a doctor working on a tablet, for the provider directory. */
  providerWithTablet: image({
    photoId: 19957218,
    alt: "A doctor using a tablet while working with patients",
    width: 2000,
    height: 3000,
    ratio: 0.78,
    focus: "faces",
  }),

  /** Feature: logging and tracking vitals, photographed in Lagos. */
  preventiveCareLagos: image({
    photoId: 30688589,
    alt: "A healthcare professional checking a patient's blood pressure in Lagos",
    width: 2000,
    height: 1333,
    ratio: 1.2,
  }),

  /** Feature: a doctor explaining a diagnosis and results to a patient. */
  diagnosisExplained: image({
    photoId: 6303652,
    alt: "A doctor explaining a diagnosis to a patient in a hospital",
    width: 2000,
    height: 1333,
    ratio: 1.2,
  }),

  /** Feature: digital health records on a tablet. */
  digitalRecords: image({
    photoId: 5452188,
    alt: "A doctor using a tablet computer to review health records",
    width: 2000,
    height: 3000,
    ratio: 0.78,
    focus: "faces",
  }),

  /** Final CTA background: a care worker walking with a patient. */
  careCorridor: image({
    photoId: 33932453,
    alt: "A care worker walking alongside a patient in a hospital corridor",
    width: 2000,
    height: 1333,
    credit: "Wellington Tavares / Pexels",
  }),

  /**
   * Our own founder photograph, shipped from /public/brand/founder.jpg
   * (source: Assets/Founder.jpeg). Add the founder's name and one-line bio to
   * the caption on the landing page once you are happy for it to be public.
   */
  founderPhoto: localBrandImage({
    path: "/brand/founder.jpg",
    alt: "The founder of HealthLink",
    width: 853,
    height: 1280,
  }),

  /* ---------------------------------------------------------------------
   * Held back on purpose — do not add these to the page yet.
   *
   * HealthLink has no online consultation and no mental health module, so
   * showing a telehealth or counselling photo would advertise a feature that
   * does not exist. Keep them here for when those modules ship.
   * ------------------------------------------------------------------- */

  /** Reserved for a future online consultation feature. */
  telehealthConsultation: image({
    photoId: 18252405,
    alt: "A doctor sitting with a smartphone and tablet for a remote consultation",
    width: 2000,
    height: 1333,
  }),

  /** Reserved for a future mental health feature. */
  counsellingSession: image({
    photoId: 5699447,
    alt: "A person having a private conversation with a mental health professional",
    width: 2000,
    height: 1333,
  }),
} satisfies Record<string, MarketingImage>;

export type MarketingImageKey = keyof typeof MARKETING_IMAGES;
