/**
 * Central registry of every photograph used on the marketing site.
 *
 * Image policy: every photo shows Black African or Nigerian people, and most
 * were photographed in Nigeria. Each entry documents which real app feature it
 * illustrates, so a photo can never advertise something we have not built.
 *
 * All images are free-to-use Pexels photos (Pexels License: free to use,
 * attribution appreciated but not required), served from the Pexels CDN with
 * imgix crops. Photographer names cannot be read automatically — the site
 * blocks scraping — so credit is recorded as the provider.
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
  /** The app feature this photo illustrates. */
  feature: string;
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
 *               so a 3:2 original is never downloaded for a 3:4 slot.
 * @param focus  imgix focal point, e.g. "faces" to keep heads in frame.
 */
function image(opts: {
  photoId: number;
  alt: string;
  width: number;
  height: number;
  feature: string;
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
    feature: opts.feature,
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
  feature: string;
}): MarketingImage {
  return {
    src: () => opts.path,
    srcSet: "",
    sizes: "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 620px",
    alt: opts.alt,
    width: opts.width,
    height: opts.height,
    credit: "CareNBuddi",
    source: opts.path,
    feature: opts.feature,
  };
}

export const MARKETING_IMAGES = {
  /** Hero: a doctor consulting with a patient during a clinic visit in Lagos. */
  lagosConsultation: image({
    photoId: 30677597,
    alt: "A doctor consulting with a patient during a clinic visit in Lagos",
    width: 2000,
    height: 1333,
    feature: "Marketing hero — the whole product in one picture",
    ratio: 1.25,
    focus: "faces",
  }),

  /** For Patients: an African health worker checking an older patient's blood pressure. */
  communityHealthCheck: image({
    photoId: 8248433,
    alt: "A health worker checking an older woman's blood pressure during a check-up",
    width: 1200,
    height: 798,
    feature: "Find Care and health check-ups",
    ratio: 1.15,
  }),

  /** For Providers: a Black female doctor working on a tablet. */
  providerWithTablet: image({
    photoId: 19957218,
    alt: "A doctor using a tablet while working with patients",
    width: 2000,
    height: 3000,
    feature: "Provider directory and appointment requests",
    ratio: 0.78,
    focus: "faces",
  }),

  /** Feature: logging vitals, photographed in Lagos. */
  vitalsCheck: image({
    photoId: 30688589,
    alt: "A healthcare professional checking a patient's blood pressure in Lagos",
    width: 2000,
    height: 1333,
    feature: "Health dashboard — blood pressure, weight, blood sugar",
    ratio: 1.2,
  }),

  /** Feature: an African health worker administering a vaccine. */
  vaccination: image({
    photoId: 10794860,
    alt: "A health worker administering a vaccine to a patient",
    width: 1200,
    height: 900,
    feature: "Vaccine and dose tracking",
    credit: "Francis Agyemang Opoku / Pexels",
    ratio: 1.2,
  }),

  /** Feature: an African health professional holding medication. */
  medication: image({
    photoId: 38774683,
    alt: "A healthcare professional holding medication in a clinic",
    width: 1200,
    height: 1680,
    feature: "Prescriptions and medicines",
    ratio: 1.2,
    focus: "faces",
  }),

  /** Final CTA background: a surgeon in a Lagos hospital. */
  lagosSurgeon: image({
    photoId: 16903231,
    alt: "A surgeon in scrubs and a face mask in a hospital in Lagos",
    width: 1200,
    height: 675,
    feature: "Hospital care and referrals",
    ratio: 1.6,
  }),

  /**
   * Our own founder photograph, shipped from /public/brand/founder.jpg
   * (source: Assets/Founder.jpeg), pre-cropped to a square around the face
   * for the Meet Our Team card.
   */
  founderPhoto: localBrandImage({
    path: "/brand/founder.jpg",
    alt: "The founder of CareNBuddi",
    width: 520,
    height: 520,
    feature: "Who we are",
  }),

  /* ---------------------------------------------------------------------
   * Ready for the app and for new sections, not used on the landing page yet.
   * Each one is tied to a real feature, so any of these can ship as a category
   * banner in the app or as a future marketing section.
   * ------------------------------------------------------------------- */

  /** Symptom journal. */
  symptomsConsultation: image({
    photoId: 6303646,
    alt: "A patient discussing a diagnosis with a doctor in a hospital",
    width: 1200,
    height: 1800,
    feature: "Symptom journal",
    ratio: 0.78,
    focus: "faces",
  }),

  /** Emergency care. */
  emergencyCare: image({
    photoId: 6098046,
    alt: "A healthcare professional in protective clothing in a hospital",
    width: 1200,
    height: 1800,
    feature: "Emergency and urgent care",
    ratio: 0.78,
    focus: "faces",
  }),

  /** Health records and documentation. */
  healthRecords: image({
    photoId: 6098051,
    alt: "A healthcare professional writing up patient notes in a hospital",
    width: 1200,
    height: 800,
    feature: "Health records and documents",
    ratio: 1.15,
  }),

  /** Nurse consultation in a hospital corridor. */
  nurseConsultation: image({
    photoId: 6303647,
    alt: "A nurse talking with a patient in a hospital corridor",
    width: 1200,
    height: 1800,
    feature: "Care plans and referrals",
    ratio: 0.78,
    focus: "faces",
  }),

  /** A patient talking with a doctor in a hospital hallway. */
  patientInHospital: image({
    photoId: 6303659,
    alt: "A patient talking with a doctor in a hospital hallway",
    width: 1200,
    height: 834,
    feature: "Talking to a doctor",
    ratio: 1.15,
  }),

  /* ---------------------------------------------------------------------
   * Held back on purpose — do not add these to any page yet.
   *
   * CareNBuddi has no online consultation and no mental health module, so
   * showing a telehealth or counselling photo would advertise a feature that
   * does not exist. Kept here for when those modules ship.
   * ------------------------------------------------------------------- */

  /** Reserved for a future online consultation feature. */
  telehealthConsultation: image({
    photoId: 18252405,
    alt: "A doctor sitting with a smartphone and tablet for a remote consultation",
    width: 2000,
    height: 1333,
    feature: "NOT BUILT — online consultation",
  }),

  /** Reserved for a future mental health feature. */
  counsellingSession: image({
    photoId: 5699447,
    alt: "A person having a private conversation with a mental health professional",
    width: 2000,
    height: 1333,
    feature: "NOT BUILT — mental health",
  }),
} satisfies Record<string, MarketingImage>;

export type MarketingImageKey = keyof typeof MARKETING_IMAGES;
