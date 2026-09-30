import type { Lang } from "./lang";

export interface Faq {
  q: string;
  a: string;
}

export interface TopicLocale {
  title?: string;
  summary?: string;
}

export interface Topic {
  slug: string;
  title: string;
  summary: string;
  locale?: Partial<Record<Lang, TopicLocale>>;
  healthCategory: string;
  whatItIs: string;
  symptoms: string[];
  riskFactors: string[];
  prevention: string[];
  whenToSeekHelp: string;
  faqs: Faq[];
  categories: string[];
  source: string;
  reviewedBy: string;
  reviewedOn: string;
}

export type ProviderCategory =
  | "Hospital"
  | "Clinic"
  | "Primary health centre"
  | "Laboratory"
  | "Pharmacy"
  | "Diagnostic centre"
  | "Mental health service"
  | "Maternal health service"
  | "Professional";

export interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  services: string[];
  city: string;
  state: string;
  lga: string;
  address: string;
  phone: string;
  whatsapp?: string;
  hours: string;
  verified: boolean;
  rating?: number;
  description: string;
  emergency?: boolean;
}

export interface EmergencyContact {
  name: string;
  number: string;
  note: string;
}

export function topicTitle(topic: Topic, lang: Lang): string {
  return topic.locale?.[lang]?.title ?? topic.title;
}

export function topicSummary(topic: Topic, lang: Lang): string {
  return topic.locale?.[lang]?.summary ?? topic.summary;
}

export const PROVIDER_CATEGORY_LABELS: Record<Lang, Record<ProviderCategory, string>> = {
  en: {
    Hospital: "Hospital",
    Clinic: "Clinic",
    "Primary health centre": "Primary health centre (PHC)",
    Laboratory: "Laboratory",
    Pharmacy: "Pharmacy",
    "Diagnostic centre": "Diagnostic centre",
    "Mental health service": "Mental health service",
    "Maternal health service": "Maternal health service",
    Professional: "Professional",
  },
  yo: {
    Hospital: "Ilé-ìwòsàn",
    Clinic: "Ilé-ìwòsàn kékeré",
    "Primary health centre": "Ilé-ìwòsàn àkọ́kọ́ (PHC)",
    Laboratory: "Ilé-awakọ̀",
    Pharmacy: "Ilé-oògùn",
    "Diagnostic centre": "Ilé-ìwádìí",
    "Mental health service": "Iṣẹ́ ìlera ọpọlọ",
    "Maternal health service": "Iṣẹ́ ìlera aboyun",
    Professional: "Òjògbón",
  },
  ha: {
    Hospital: "Asibiti",
    Clinic: "Asibiti karama",
    "Primary health centre": "Cibiyar kula ta farko (PHC)",
    Laboratory: "Dakin gwaji",
    Pharmacy: "Kanti magani",
    "Diagnostic centre": "Cibiyar bincike",
    "Mental health service": "Sabis lafiyar kwakwalwa",
    "Maternal health service": "Sabis lafiyar mata masu juna biyu",
    Professional: "Kwararre",
  },
  ig: {
    Hospital: "Ụlọ ọgwụ",
    Clinic: "Ụlọ ọgwụ nta",
    "Primary health centre": "Ebe nlekọta mbụ (PHC)",
    Laboratory: "Ụlọ nyocha",
    Pharmacy: "Ebe ọgwụ",
    "Diagnostic centre": "Ebe nchọpụta",
    "Mental health service": "Ọrụ ahụike uche",
    "Maternal health service": "Ọrụ ahụike ime",
    Professional: "Ọkachamara",
  },
};

export const HEALTH_CATEGORY_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    "General Health": "General Health",
    "Women's Health": "Women's Health",
    "Men's Health": "Men's Health",
    "Mental Health": "Mental Health",
    "Children's Health": "Children's Health",
    Nutrition: "Nutrition",
    "Sexual & Reproductive Health": "Sexual & Reproductive Health",
    "Maternal Health": "Maternal Health",
    "Preventive Health": "Preventive Health",
    "Chronic Conditions": "Chronic Conditions",
    "First Aid": "First Aid",
    "Oral Health": "Oral Health",
    "Eye Health": "Eye Health",
    "Healthy Ageing": "Healthy Ageing",
    "Environmental Health": "Environmental Health",
    "Occupational Health": "Occupational Health",
  },
  yo: {
    "General Health": "Ìlera Gbogbogbòò",
    "Women's Health": "Ìlera Obìnrin",
    "Men's Health": "Ìlera Ọkùnrin",
    "Mental Health": "Ìlera Ọpọlọ",
    "Children's Health": "Ìlera Ọmọdé",
    Nutrition: "Oúnjẹ Àgbàra",
    "Sexual & Reproductive Health": "Ìlera Ìbálòpọ̀",
    "Maternal Health": "Ìlera Aboyun",
    "Preventive Health": "Ìlera Ìdènà",
    "Chronic Conditions": "Àìsàn onípẹ́",
    "First Aid": "Ìrànwọ́ Kìíní",
    "Oral Health": "Ìlera Ehín",
    "Eye Health": "Ìlera Ojú",
    "Healthy Ageing": "Ògbó Tó Dáa",
    "Environmental Health": "Ìlera Àyíká",
    "Occupational Health": "Ìlera Iṣẹ́",
  },
  ha: {
    "General Health": "Lafiya ta gabaɗaya",
    "Women's Health": "Lafiyar mata",
    "Men's Health": "Lafiyar maza",
    "Mental Health": "Lafiyar kwakwalwa",
    "Children's Health": "Lafiyar yara",
    Nutrition: "Abinci mai gina jiki",
    "Sexual & Reproductive Health": "Lafiyar jima'i",
    "Maternal Health": "Lafiyar haihuwa",
    "Preventive Health": "Lafiyar rigakafi",
    "Chronic Conditions": "Cututtuka masu ɗorewa",
    "First Aid": "Taimakon farko",
    "Oral Health": "Lafiyar baki",
    "Eye Health": "Lafiyar ido",
    "Healthy Ageing": "Tsufa mai lafiya",
    "Environmental Health": "Lafiyar muhalli",
    "Occupational Health": "Lafiyar aiki",
  },
  ig: {
    "General Health": "Ahụike izugbe",
    "Women's Health": "Ahụike ụmụ nwanyị",
    "Men's Health": "Ahụike ụmụ nwoke",
    "Mental Health": "Ahụike uche",
    "Children's Health": "Ahụike ụmụaka",
    Nutrition: "Nri na-edozi ahụ",
    "Sexual & Reproductive Health": "Ahụike mmekọahụ",
    "Maternal Health": "Ahụike ime",
    "Preventive Health": "Ahụike mgbochi",
    "Chronic Conditions": "Ọrịa na-adịte aka",
    "First Aid": "Enyemaka mbụ",
    "Oral Health": "Ahụike ọnụ (ezé)",
    "Eye Health": "Ahụike anya",
    "Healthy Ageing": "Ika ọjọ dị mma",
    "Environmental Health": "Ahụike gburugburu",
    "Occupational Health": "Ahụike ọrụ",
  },
};

export function topicLanguageTitle(
  value: string,
  lang: Lang,
  map: Record<Lang, Record<string, string>>,
): string {
  return map[lang]?.[value] ?? map.en[value] ?? value;
}

export const TOPICS: Topic[] = [
  {
    slug: "hypertension",
    title: "Hypertension (high blood pressure)",
    summary:
      "High blood pressure that stays high over time and can quietly damage your heart and blood vessels.",
    locale: {
      yo: {
        title: "Hypertension (ẹ̀jẹ̀ gíga)",
        summary:
          "Ẹ̀jẹ̀ tó ga tó ń wà fun àsìkò pípẹ́, tó lè ba ọkàn àti àwọn iṣẹ́ ẹ̀jẹ̀ jẹ́ lọ́nà rọrùn (láìsí àmì).",
      },
      ha: {
        title: "Hawan jini (high blood pressure)",
        summary:
          "Hawan jini da ke tsawo a tsawon lokaci kuma yana iya lalata zuciya da jijiyoyin jini ba tare da alamomi ba.",
      },
      ig: {
        title: "Ọbara elu (high blood pressure)",
        summary:
          "Ọbara dị elu nke na-adị ogologo oge ma nwee ike mebie obi na akwara ọbara gị na-enweghị ihe mgbaàmà.",
      },
    },
    healthCategory: "Chronic Conditions",
    whatItIs:
      "Blood pressure is the force of your blood pushing against your blood vessel walls. Hypertension means this force stays too high for too long. Most people feel nothing, which is why it is often called a 'silent' condition. It is common and manageable with regular checks and healthy habits.",
    symptoms: [
      "Often no symptoms at all — that is why regular checks matter",
      "Possible severe headache",
      "Blurred vision",
      "Chest pain or difficulty breathing (seek urgent care)",
      "Dizziness",
    ],
    riskFactors: [
      "Family history of high blood pressure",
      "High salt intake",
      "Being overweight or inactive",
      "Smoking and heavy alcohol use",
      "Chronic stress",
      "Age over 40",
    ],
    prevention: [
      "Eat more fruits, vegetables, and whole grains; reduce salt",
      "Stay active — aim for at least 30 minutes most days",
      "Maintain a healthy weight",
      "Limit alcohol and quit smoking",
      "Check your blood pressure regularly",
    ],
    whenToSeekHelp:
      "See a health professional to confirm a high reading (usually ≥140/90) and agree on next steps. If you ever have chest pain, fainting, severe headache with confusion, or trouble speaking, call emergency services immediately.",
    faqs: [
      {
        q: "Can I feel when my blood pressure is high?",
        a: "Usually not. Many people only find out during a routine check, so regular measurement is important.",
      },
      {
        q: "Do I need medication forever?",
        a: "Some people manage with lifestyle changes alone. Others need medicine, and a professional will review your treatment regularly.",
      },
    ],
    categories: [
      "Hospital",
      "Clinic",
      "Laboratory",
      "Pharmacy",
      "Diagnostic centre",
    ],
    source: "WHO fact sheet on hypertension (reviewed)",
    reviewedBy: "Temitope Adekunle — Health Educator & Mental Health Counsellor",
    reviewedOn: "2026-09-20",
  },
  {
    slug: "malaria",
    title: "Malaria",
    summary:
      "A mosquito-borne illness that causes fever and chills and becomes dangerous if not treated quickly.",
    locale: {
      yo: {
        title: "Ìbà",
        summary: "Àrùn tí ẹ̀fọn ń mú, tó ń fa ibà àti ìrìrì, tó sì lè léwu tí wọn ò bá tọ́jú rẹ̀ kíákíá.",
      },
      ha: {
        title: "Zazzabin cizon sauro",
        summary: "Cutar da sauro ke cizo, tana haifar da zazzabi da rawa, kuma tana da haɗari idan ba a maganin ta da wuri ba.",
      },
      ig: {
        title: "Ọrịa iba",
        summary: "Ọrịa anwụnta na-ebute, nke na-akpata ahụ ọkụ na ịma jijiji, ma dị ize ndụ ma ọ bụrụ na agwọghị ya ngwa ngwa.",
      },
    },
    healthCategory: "Preventive Health",
    whatItIs:
      "Malaria is caused by a parasite passed through the bite of an infected mosquito. It develops quickly and, in children and pregnant women especially, can become severe within hours. With prompt testing and treatment it is fully curable.",
    symptoms: [
      "Fever, with chills and sweating",
      "Headache and body aches",
      "Tiredness and weakness",
      "Nausea and vomiting",
      "In severe cases: confusion, difficulty breathing, or reduced urine",
    ],
    riskFactors: [
      "Living in or travelling to malaria areas",
      "No bed-net or preventive mosquito protection",
      "Pregnancy and young children",
      "Delayed treatment",
    ],
    prevention: [
      "Sleep under an insecticide-treated bed net",
      "Use mosquito repellent and cover skin in the evening",
      "Clear stagnant water around the home",
      "Take preventative medicine if your health worker recommends it",
    ],
    whenToSeekHelp:
      "In a malaria area, any fever should be tested promptly — within 24 hours. Malaria is treated with a confirmed test result. Seek immediate care for confusion, difficulty breathing, or if a child cannot keep fluids down.",
    faqs: [
      {
        q: "Will any fever mean malaria?",
        a: "No — but in malaria-prone areas a fever should be checked. Only a blood test (e.g. RDT) confirms malaria.",
      },
      {
        q: "Can malaria be prevented?",
        a: "Yes, largely. Bed nets, repellents, and prompt testing all greatly reduce the risk and impact.",
      },
    ],
    categories: ["Hospital", "Clinic", "Laboratory", "Pharmacy", "Diagnostic centre"],
    source: "WHO malaria guidance (reviewed)",
    reviewedBy: "Temitope Adekunle — Health Educator & Mental Health Counsellor",
    reviewedOn: "2026-09-18",
  },
  {
    slug: "mental-health",
    title: "Mental health & stress",
    summary:
      "Practical information on stress, anxiety, and low mood, and when to reach out for support.",
    locale: {
      yo: {
        title: "Ìlera ọpọlọ & wahala",
        summary: "Àlàyé tó wúlò nípa ìdààmú, àníyàn àti ìrẹ̀wẹ̀sì, àti ìgbà tí o yẹ kí o wá ìrànlọ́wọ́.",
      },
      ha: {
        title: "Lafiyar kwakwalwa & damuwa",
        summary: "Bayani mai amfani kan damuwa, fargaba da bacin rai, da lokacin neman tallafi.",
      },
      ig: {
        title: "Ahụike uche & nrụgide",
        summary: "Ozi bara uru banyere nchegbu, ụjọ na obi ụtọ dị ala, na mgbe ị ga-achọ enyemaka.",
      },
    },
    healthCategory: "Mental Health",
    whatItIs:
      "Mental health is about how we think, feel, and cope with daily life. Everyone has good and bad periods. Stress, anxiety, and low mood are common — especially in young adults — and often improve with support, rest, and simple routines.",
    symptoms: [
      "Feeling worried, on edge, or irritable most of the time",
      "Trouble sleeping or loss of appetite",
      "Feeling tired without a clear cause",
      "Losing interest in things you used to enjoy",
      "Feeling hopeless or unable to cope",
    ],
    riskFactors: [
      "Major life changes or loss",
      "Pressure at work, school, or home",
      "Isolation or lack of social support",
      "History of mental illness in the family",
      "Chronic physical illness",
    ],
    prevention: [
      "Keep a routine for sleep, meals, and activity",
      "Talk to someone you trust regularly",
      "Limit stress triggers where you can",
      "Exercise and spend time outdoors",
      "Limit alcohol and stimulants",
    ],
    whenToSeekHelp:
      "Reach out when symptoms last more than two weeks, affect your work or relationships, or you feel you can not cope. If you or someone you know is in crisis or thinking of self-harm, call emergency services or a crisis line immediately — do not wait.",
    faqs: [
      {
        q: "Is asking for help normal?",
        a: "Yes. Seeking support early is a strength and usually makes a big difference.",
      },
      {
        q: "Do I need to see a psychiatrist?",
        a: "Not necessarily. Counsellors, psychologists, and community mental health workers can all help, depending on your needs.",
      },
    ],
    categories: ["Mental health service", "Clinic"],
    source: "WHO mental health guidance (reviewed)",
    reviewedBy: "Temitope Adekunle — Health Educator & Mental Health Counsellor",
    reviewedOn: "2026-09-15",
  },
  {
    slug: "first-aid",
    title: "First aid basics",
    summary:
      "Simple, safe steps for common emergencies while you get professional help.",
    locale: {
      yo: {
        title: "Ìpìlẹ̀ ìrànlọ́wọ́ kìíní",
        summary: "Àwọn ìgbésẹ̀ tó dánra tó sì léwu nípa àwọn pàjáwìrì wọ̀ọ́kú wọ̀ọ́kú nígbà tí o ń dúró de ìrànlọ́wọ́ ọ̀jọ̀gbọ́n.",
      },
      ha: {
        title: "Tushen taimakon farko",
        summary: "Matakai masu sauƙi amma amintattu na gaggawa a lokacin da kake jiran taimakon ƙwararru.",
      },
      ig: {
        title: "Ihe ndabere enyemaka mbụ",
        summary: "Usoro dị mfe ma dị nchebe maka mberede dị iche iche mgbe ị na-echere enyemaka ọkachamara.",
      },
    },
    healthCategory: "First Aid",
    whatItIs:
      "First aid is the immediate help given before professional care arrives. It can relieve pain, prevent worsening, and in serious cases save a life. The most important first step is always to keep yourself safe and call for help.",
    symptoms: [
      "Bleeding that does not stop",
      "Burns (red, blistered, or worse)",
      "Someone unconscious or not breathing",
      "Choking",
      "Sudden chest pain or stroke signs (face drooping, arm weakness, slurred speech)",
    ],
    riskFactors: [
      "Scenarios where accidents are more likely (traffic, cooking, work)",
      "Long distances to the nearest health facility",
      "Not knowing the local emergency number",
    ],
    prevention: [
      "Know your local emergency numbers by heart",
      "Keep a basic first-aid kit (plasters, gauze, antiseptic, gloves)",
      "Learn CPR and how to put someone in the recovery position",
      "Remove hazards in the home and workplace",
    ],
    whenToSeekHelp:
      "Call emergency services immediately for unconsciousness, chest pain, severe bleeding, serious burns, or stroke signs. For minor injuries, seeing a clinic the same day is still wise.",
    faqs: [
      {
        q: "Should I move someone who is injured?",
        a: "Only move them if staying where they are is dangerous. Otherwise leave them and call for help.",
      },
      {
        q: "What should I do for a burn?",
        a: "Run cool tap water over it for at least 20 minutes. Do not apply ice, butter, or toothpaste.",
      },
    ],
    categories: ["Hospital", "Clinic", "Pharmacy"],
    source: "International Red Cross first-aid guidance (reviewed)",
    reviewedBy: "Temitope Adekunle — Health Educator & Mental Health Counsellor",
    reviewedOn: "2026-09-12",
  },
];

export const PROVIDERS: Provider[] = [
  // ---- Lagos ----
  {
    id: "lag-01", name: "Mainland General Hospital", category: "Hospital", lga: "Yaba",
    city: "Yaba, Lagos", state: "Lagos", address: "24 Herbert Macaulay Way, Yaba",
    phone: "+234 801 111 0001", whatsapp: "+2348011110001", hours: "Open 24 hours",
    services: ["Emergency care", "Inpatient wards", "Surgery", "Maternity", "Imaging"],
    verified: true, rating: 4.6, emergency: true,
    description: "Government referral hospital with emergency, maternity and surgical services.",
  },
  {
    id: "lag-02", name: "Apapa General Hospital", category: "Hospital", lga: "Apapa",
    city: "Apapa, Lagos", state: "Lagos", address: "1 Marine Road, Apapa",
    phone: "+234 801 111 0002", whatsapp: "+2348011110002", hours: "Open 24 hours",
    services: ["Emergency care", "Inpatient wards", "Laboratory", "Pharmacy"],
    verified: true, rating: 4.4, emergency: true,
    description: "Community hospital serving the Apapa port area with walk-in emergency care.",
  },
  {
    id: "lag-03", name: "Lagos Island Private Hospital", category: "Hospital", lga: "Lagos Island",
    city: "Lagos Island, Lagos", state: "Lagos", address: "18 Broad Street, Lagos Island",
    phone: "+234 801 111 0003", whatsapp: "+2348011110003", hours: "Open 24 hours",
    services: ["Emergency care", "Surgery", "Maternity", "Diagnostics"],
    verified: true, rating: 4.7, emergency: true,
    description: "Private hospital on Lagos Island with specialists and 24-hour emergency bay.",
  },
  {
    id: "lag-04", name: "Epe General Hospital", category: "Hospital", lga: "Epe",
    city: "Epe, Lagos", state: "Lagos", address: "Ita-Opo Road, Epe",
    phone: "+234 801 111 0004", whatsapp: "+2348011110004", hours: "Open 24 hours",
    services: ["Emergency care", "Maternity", "Inpatient wards", "Laboratory"],
    verified: true, rating: 4.2, emergency: true,
    description: "District hospital serving the Epe axis with emergency and maternity services.",
  },
  {
    id: "lag-05", name: "Ajah Family Clinic", category: "Clinic", lga: "Eti-Osa",
    city: "Ajah, Lagos", state: "Lagos", address: "12 Addo Road, Ajah",
    phone: "+234 802 222 0005", whatsapp: "+2348022220005", hours: "Mon–Sun, 8am–8pm",
    services: ["General consultation", "Malaria treatment", "Antenatal care", "Vaccination"],
    verified: true, rating: 4.5,
    description: "Family-owned clinic offering general and antenatal outpatient care.",
  },
  {
    id: "lag-06", name: "Ikeja Medical Centre", category: "Clinic", lga: "Ikeja",
    city: "Ikeja, Lagos", state: "Lagos", address: "48 Obafemi Awolowo Way, Ikeja",
    phone: "+234 802 222 0006", whatsapp: "+2348022220006", hours: "Mon–Sat, 7am–7pm",
    services: ["General consultation", "Minor procedures", "Rapid testing", "Pharmacy"],
    verified: true, rating: 4.3,
    description: "Neighbourhood medical centre with same-day consultations and testing.",
  },
  {
    id: "lag-07", name: "Festac Town Clinic", category: "Clinic", lga: "Amuwo-Odofin",
    city: "Festac, Lagos", state: "Lagos", address: "3rd Avenue, Festac Town",
    phone: "+234 802 222 0007", whatsapp: "+2348022220007", hours: "Mon–Sun, 8am–8pm",
    services: ["General consultation", "BP checks", "Malaria diagnosis", "Wellness checks"],
    verified: false, rating: 4.1,
    description: "Community clinic with focus on family medicine and routine check-ups.",
  },
  {
    id: "lag-08", name: "Ikorodu Primary Health Centre", category: "Primary health centre", lga: "Ikorodu",
    city: "Ikorodu, Lagos", state: "Lagos", address: "Ota-Ona Road, Ikorodu",
    phone: "+234 803 333 0008", whatsapp: "+2348033330008", hours: "Mon–Sat, 8am–4pm",
    services: ["Immunisation", "Antenatal care", "Malaria RDT", "Family planning"],
    verified: true, rating: 4.0,
    description: "Government PHC providing free and low-cost primary care services.",
  },
  {
    id: "lag-09", name: "Isolo Primary Health Centre", category: "Primary health centre", lga: "Oshodi-Isolo",
    city: "Isolo, Lagos", state: "Lagos", address: "Shogunle Road, Isolo",
    phone: "+234 803 333 0009", whatsapp: "+2348033330009", hours: "Mon–Fri, 8am–4pm",
    services: ["Immunisation", "Antenatal care", "Health education", "Referrals"],
    verified: true,
    description: "First-line centre for immunisation, antenatal care and referrals.",
  },
  {
    id: "lag-10", name: "Bariga Primary Health Centre", category: "Primary health centre", lga: "Somolu",
    city: "Bariga, Lagos", state: "Lagos", address: "Ilupeju Road, Bariga",
    phone: "+234 803 333 0010", whatsapp: "+2348033330010", hours: "Mon–Sat, 8am–4pm",
    services: ["Immunisation", "Malaria treatment", "First aid", "BP checks"],
    verified: false,
    description: "Community PHC focused on prevention and primary outpatient care.",
  },
  {
    id: "lag-11", name: "Yaba Reference Laboratory", category: "Laboratory", lga: "Yaba",
    city: "Yaba, Lagos", state: "Lagos", address: "96 Commercial Avenue, Yaba",
    phone: "+234 804 444 0011", whatsapp: "+2348044440011", hours: "Mon–Sat, 7am–6pm",
    services: ["Blood tests", "Malaria RDT", "Full blood count", "Urinalysis"],
    verified: true, rating: 4.5,
    description: "Independent laboratory with same-day results for common tests.",
  },
  {
    id: "lag-12", name: "Victoria Island Medical Lab", category: "Laboratory", lga: "Eti-Osa",
    city: "Victoria Island, Lagos", state: "Lagos", address: "27 Adeola Odeku Street, VI",
    phone: "+234 804 444 0012", whatsapp: "+2348044440012", hours: "Mon–Sat, 7am–5pm",
    services: ["Blood chemistry", "Hormone tests", "Malaria tests", "Sample collection"],
    verified: true, rating: 4.6,
    description: "Modern laboratory offering clinical chemistry and home sample pickup.",
  },
  {
    id: "lag-13", name: "Surulere Care Pharmacy", category: "Pharmacy", lga: "Surulere",
    city: "Surulere, Lagos", state: "Lagos", address: "22 Adelabu Street, Surulere",
    phone: "+234 805 555 0013", whatsapp: "+2348055550013", hours: "Mon–Sun, 8am–9pm",
    services: ["Prescription medicines", "BP checks", "Anti-malaria meds", "First-aid supplies"],
    verified: true, rating: 4.4,
    description: "Community pharmacy with a qualified pharmacist and BP checks.",
  },
  {
    id: "lag-14", name: "Lekki Wellness Pharmacy", category: "Pharmacy", lga: "Eti-Osa",
    city: "Lekki, Lagos", state: "Lagos", address: "Admiralty Way, Lekki Phase 1",
    phone: "+234 805 555 0014", whatsapp: "+2348055550014", hours: "Mon–Sun, 8am–10pm",
    services: ["Prescription medicines", "Vitamins & supplements", "BP checks"],
    verified: true, rating: 4.7,
    description: "Full-service pharmacy focusing on everyday wellness and medication advice.",
  },
  {
    id: "lag-15", name: "Maryland Diagnostic Centre", category: "Diagnostic centre", lga: "Ikeja",
    city: "Maryland, Lagos", state: "Lagos", address: "178 Ikorodu Road, Maryland",
    phone: "+234 806 666 0015", whatsapp: "+2348066660015", hours: "Mon–Fri, 7am–5pm; Sat 8am–2pm",
    services: ["Ultrasound", "X-ray", "ECG", "Laboratory"],
    verified: true, rating: 4.3,
    description: "Imaging and laboratory centre with structured reports and referrals.",
  },
  {
    id: "lag-16", name: "Ikoyi Medical Imaging Centre", category: "Diagnostic centre", lga: "Eti-Osa",
    city: "Ikoyi, Lagos", state: "Lagos", address: "5 Bourdillon Road, Ikoyi",
    phone: "+234 806 666 0016", whatsapp: "+2348066660016", hours: "Mon–Fri, 7am–6pm",
    services: ["MRI", "CT scan", "Ultrasound", "X-ray"],
    verified: true, rating: 4.8,
    description: "Advanced imaging centre with radiologist-reviewed results.",
  },
  {
    id: "lag-17", name: "Dr. Kola Adebayo — Consultant Cardiologist", category: "Professional", lga: "Ikeja",
    city: "Ikeja, Lagos", state: "Lagos", address: "Suite 3, 60 Allen Avenue, Ikeja",
    phone: "+234 809 777 0017", whatsapp: "+2348097770017", hours: "Mon–Fri, 9am–5pm (by appointment)",
    services: ["Cardiology consultation", "BP management", "ECG interpretation"],
    verified: true, rating: 4.9,
    description: "Consultant cardiologist for high blood pressure, heart checks and ECG review.",
  },
  {
    id: "lag-18", name: "Dr. Amina Bello — Paediatrician", category: "Professional", lga: "Eti-Osa",
    city: "Lekki, Lagos", state: "Lagos", address: "10 Freedom Way, Lekki Phase 1",
    phone: "+234 809 777 0018", whatsapp: "+2348097770018", hours: "Tue–Sat, 9am–4pm (by appointment)",
    services: ["Child health", "Immunisation", "Growth monitoring"],
    verified: true, rating: 4.8,
    description: "Paediatrician focused on child growth, vaccines and common childhood illness.",
  },
  // ---- Ogun ----
  {
    id: "ogu-01", name: "Abeokuta Central Hospital", category: "Hospital", lga: "Abeokuta South",
    city: "Abeokuta, Ogun", state: "Ogun", address: "15 Onikolobo Road, Abeokuta",
    phone: "+234 807 888 0021", whatsapp: "+2348078880021", hours: "Open 24 hours",
    services: ["Emergency care", "Inpatient wards", "Maternity", "Laboratory"],
    verified: true, rating: 4.3, emergency: true,
    description: "Central hospital with emergency, maternity and inpatient services in Abeokuta.",
  },
  {
    id: "ogu-02", name: "Ota Cottage Hospital", category: "Hospital", lga: "Ado-Odo/Ota",
    city: "Ota, Ogun", state: "Ogun", address: "Idiroko Road, Ota",
    phone: "+234 807 888 0022", whatsapp: "+2348078880022", hours: "Open 24 hours",
    services: ["Emergency care", "Maternity", "Minor surgery"],
    verified: true, rating: 4.1, emergency: true,
    description: "Cottage hospital serving Ota community with emergency and maternity care.",
  },
  {
    id: "ogu-03", name: "Sagamu Health Clinic", category: "Clinic", lga: "Sagamu",
    city: "Sagamu, Ogun", state: "Ogun", address: "Ijebu Road, Sagamu",
    phone: "+234 808 999 0023", whatsapp: "+2348089990023", hours: "Mon–Sun, 8am–8pm",
    services: ["General consultation", "Malaria treatment", "BP checks"],
    verified: true, rating: 4.2,
    description: "Community clinic in Sagamu for everyday consultations and treatment.",
  },
  {
    id: "ogu-04", name: "Ijebu-Ode Family Clinic", category: "Clinic", lga: "Ijebu-Ode",
    city: "Ijebu-Ode, Ogun", state: "Ogun", address: "32 Ijagba Road, Ijebu-Ode",
    phone: "+234 808 999 0024", whatsapp: "+2348089990024", hours: "Mon–Sat, 8am–7pm",
    services: ["General consultation", "Antenatal care", "Family planning"],
    verified: true, rating: 4.4,
    description: "Family clinic offering primary care and reproductive health services.",
  },
  {
    id: "ogu-05", name: "Obafemi Ogun Primary Health Centre", category: "Primary health centre", lga: "Abeokuta North",
    city: "Abeokuta, Ogun", state: "Ogun", address: "Obafemi Road, Abeokuta",
    phone: "+234 809 000 0025", whatsapp: "+2348090000025", hours: "Mon–Sat, 8am–4pm",
    services: ["Immunisation", "Antenatal care", "Malaria RDT", "Health education"],
    verified: true, rating: 4.0,
    description: "Verified community PHC for vaccination, antenatal care and prevention outreach.",
  },
  {
    id: "ogu-06", name: "Ota Primary Health Centre", category: "Primary health centre", lga: "Ado-Odo/Ota",
    city: "Ota, Ogun", state: "Ogun", address: "Oluwatobi Street, Ota",
    phone: "+234 809 000 0026", whatsapp: "+2348090000026", hours: "Mon–Fri, 8am–4pm",
    services: ["Immunisation", "Family planning", "First aid", "Referrals"],
    verified: true,
    description: "First-line PHC in Ota with immunisation and referral services.",
  },
  {
    id: "ogu-07", name: "Ilaro Primary Health Centre", category: "Primary health centre", lga: "Yewa South",
    city: "Ilaro, Ogun", state: "Ogun", address: "Oke-Ola Road, Ilaro",
    phone: "+234 809 000 0027", whatsapp: "+2348090000027", hours: "Mon–Fri, 8am–4pm",
    services: ["Immunisation", "Antenatal care", "Malaria treatment"],
    verified: false,
    description: "Community PHC serving the Ilaro and Yewa axis.",
  },
  {
    id: "ogu-08", name: "Gateway Diagnostics Abeokuta", category: "Diagnostic centre", lga: "Abeokuta South",
    city: "Abeokuta, Ogun", state: "Ogun", address: "Isale-Oko Road, Abeokuta",
    phone: "+234 809 111 0028", whatsapp: "+2348091110028", hours: "Mon–Sat, 7am–5pm",
    services: ["Ultrasound", "X-ray", "Laboratory", "ECG"],
    verified: true, rating: 4.2,
    description: "Diagnostics centre providing imaging and lab services in Abeokuta.",
  },
  {
    id: "ogu-09", name: "Ogun State Public Health Laboratory", category: "Laboratory", lga: "Odeda",
    city: "Abeokuta, Ogun", state: "Ogun", address: "Medical Village, Odeda Road",
    phone: "+234 809 222 0029", whatsapp: "+2348092220029", hours: "Mon–Fri, 8am–4pm",
    services: ["Blood tests", "Malaria RDT", "Urinalysis", "Referral testing"],
    verified: true, rating: 4.0,
    description: "Public health laboratory supporting community screening programmes.",
  },
  {
    id: "ogu-10", name: "Abeokuta Central Pharmacy", category: "Pharmacy", lga: "Abeokuta South",
    city: "Abeokuta, Ogun", state: "Ogun", address: "3 Kuto Market Road, Abeokuta",
    phone: "+234 809 333 0030", whatsapp: "+2348093330030", hours: "Mon–Sun, 8am–9pm",
    services: ["Prescription medicines", "Anti-malaria meds", "BP checks"],
    verified: true, rating: 4.1,
    description: "Widely used community pharmacy in central Abeokuta.",
  },
  {
    id: "ogu-11", name: "Dr. Tunde Ogunleye — Physiotherapist", category: "Professional", lga: "Abeokuta South",
    city: "Abeokuta, Ogun", state: "Ogun", address: "Suite 2, Gbenga Plaza, Abeokuta",
    phone: "+234 809 444 0031", whatsapp: "+2348094440031", hours: "Mon–Fri, 9am–5pm (by appointment)",
    services: ["Physiotherapy", "Back pain care", "Stroke rehabilitation", "Exercise guidance"],
    verified: true, rating: 4.6,
    description: "Chartered physiotherapist supporting recovery and exercise-based rehabilitation.",
  },
];

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { name: "National emergency line", number: "112", note: "Works from any phone" },
  { name: "Fire & rescue", number: "199", note: "Reports and rescue" },
  { name: "Police emergency", number: "199", note: "" },
];

export const PROVIDER_CATEGORIES: ProviderCategory[] = [
  "Hospital",
  "Clinic",
  "Primary health centre",
  "Laboratory",
  "Pharmacy",
  "Diagnostic centre",
  "Mental health service",
  "Maternal health service",
  "Professional",
];

export const ALL_CATEGORIES: string[] = PROVIDER_CATEGORIES;

export const HEALTH_CATEGORIES: string[] = [
  "General Health",
  "Women's Health",
  "Men's Health",
  "Mental Health",
  "Children's Health",
  "Nutrition",
  "Sexual & Reproductive Health",
  "Maternal Health",
  "Preventive Health",
  "Chronic Conditions",
  "First Aid",
  "Oral Health",
  "Eye Health",
  "Healthy Ageing",
  "Environmental Health",
  "Occupational Health",
];

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "General Health": "Everyday health, wellbeing, and staying well information.",
  "Women's Health": "Health concerns that uniquely or predominantly affect women.",
  "Men's Health": "Health concerns that uniquely or predominantly affect men.",
  "Mental Health": "Stress, anxiety, mood, sleep, and emotional wellbeing.",
  "Children's Health": "Growth, development, and common childhood conditions.",
  Nutrition: "Food, diet, and healthy eating basics.",
  "Sexual & Reproductive Health": "Safe, accurate information on SRH topics.",
  "Maternal Health": "Care and wellbeing during pregnancy, birth, and after.",
  "Preventive Health": "Screening, vaccination, and staying well.",
  "Chronic Conditions": "Long-term conditions like hypertension and diabetes.",
  "First Aid": "Immediate care before professional help arrives.",
  "Oral Health": "Teeth, gums, and everyday mouth care.",
  "Eye Health": "Sight, vision care, and common eye conditions.",
  "Healthy Ageing": "Staying well and independent in later life.",
  "Environmental Health": "How air, water, climate, and surroundings affect health.",
  "Occupational Health": "Workplace safety and work-related health risks.",
};

export const ALL_STATES: string[] = Array.from(
  new Set(PROVIDERS.map((p) => p.state)),
).sort();

export function directionsUrl(provider: Provider): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${provider.name}, ${provider.address}, ${provider.state}`,
  )}`;
}

export function whatsappUrl(provider: Provider): string {
  const number = (provider.whatsapp ?? provider.phone.replace(/\D/g, "")).replace(/^0/, "234");
  return `https://wa.me/${number}?text=${encodeURIComponent(
    "Hello, I found you on HealthLink and would like more information.",
  )}`;
}

export const PROVIDER_SEED_ID = "ogu-05";

export function seedProviderFor(email: string): Provider | undefined {
  return email.endsWith("@provider.healthlink.ng") ? PROVIDERS.find((p) => p.id === PROVIDER_SEED_ID) : undefined;
}