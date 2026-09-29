export interface Faq {
  q: string;
  a: string;
}

export interface Topic {
  slug: string;
  title: string;
  summary: string;
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
  | "Laboratory"
  | "Pharmacy"
  | "Diagnostic centre"
  | "Mental health service"
  | "Maternal health service";

export interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  services: string[];
  city: string;
  state: string;
  phone: string;
  hours: string;
}

export interface EmergencyContact {
  name: string;
  number: string;
  note: string;
}

export const TOPICS: Topic[] = [
  {
    slug: "hypertension",
    title: "Hypertension (high blood pressure)",
    summary:
      "High blood pressure that stays high over time and can quietly damage your heart and blood vessels.",
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
  {
    id: "p1",
    name: "CityCare General Hospital",
    category: "Hospital",
    services: ["Emergency care", "Inpatient wards", "Maternity", "Laboratory", "Imaging"],
    city: "Ikeja",
    state: "Lagos",
    phone: "+234 800 111 2222",
    hours: "Open 24 hours",
  },
  {
    id: "p2",
    name: "Lagos Diagnostics Lab",
    category: "Laboratory",
    services: ["Blood tests", "Malaria RDT", "Full blood count", "Urinalysis"],
    city: "Ikeja",
    state: "Lagos",
    phone: "+234 800 333 4444",
    hours: "Mon–Sat, 7am–6pm",
  },
  {
    id: "p3",
    name: "Blessed Health Pharmacy",
    category: "Pharmacy",
    services: ["Prescription medicines", "Blood pressure checks", "Anti-malaria meds"],
    city: "Surulere",
    state: "Lagos",
    phone: "+234 800 555 6666",
    hours: "Mon–Sun, 8am–9pm",
  },
  {
    id: "p4",
    name: "WellSpring Women's Clinic",
    category: "Maternal health service",
    services: ["Antenatal care", "Family planning", "Delivery", "Newborn care"],
    city: "Surulere",
    state: "Lagos",
    phone: "+234 800 777 8888",
    hours: "Mon–Fri, 8am–5pm",
  },
  {
    id: "p5",
    name: "MindEase Mental Health Centre",
    category: "Mental health service",
    services: ["Counselling", "Anxiety support", "Crisis support", "Therapy"],
    city: "Port Harcourt",
    state: "Rivers",
    phone: "+234 800 999 0000",
    hours: "Mon–Sat, 9am–6pm",
  },
  {
    id: "p6",
    name: "Harbour Medical Centre",
    category: "Clinic",
    services: ["General consultation", "Malaria treatment", "Minor procedures"],
    city: "Port Harcourt",
    state: "Rivers",
    phone: "+234 800 123 4567",
    hours: "Mon–Sun, 8am–8pm",
  },
  {
    id: "p7",
    name: "Central Diagnostic Centre",
    category: "Diagnostic centre",
    services: ["Ultrasound", "X-ray", "ECG", "Blood pressure monitor"],
    city: "Wuse",
    state: "Abuja",
    phone: "+234 800 234 5678",
    hours: "Mon–Fri, 7am–5pm",
  },
  {
    id: "p8",
    name: "FCT General Hospital",
    category: "Hospital",
    services: ["Emergency care", "Surgery", "Maternity", "Imaging", "Pharmacy"],
    city: "Wuse",
    state: "Abuja",
    phone: "+234 800 345 6789",
    hours: "Open 24 hours",
  },
];

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { name: "National emergency line", number: "112", note: "Works from any phone" },
  { name: "Fire & rescue", number: "199", note: "Reports and rescue" },
  { name: "Police emergency", number: "199", note: "" },
];

export const ALL_CATEGORIES: string[] = [
  "Hospital",
  "Clinic",
  "Laboratory",
  "Pharmacy",
  "Diagnostic centre",
  "Mental health service",
  "Maternal health service",
];

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
    `${provider.name}, ${provider.city}, ${provider.state}`,
  )}`;
}