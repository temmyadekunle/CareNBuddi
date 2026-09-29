export interface ExerciseDef {
  slug: string;
  name: string;
  category: string;
  focus: string;
  typicalMin: number;
  description: string;
  instructions: string[];
}

export interface FitnessProfile {
  id: "profile";
  heightCm: number;
  startWeightKg: number;
  goalWeightKg: number;
}

export interface Workout {
  id: string;
  date: string;
  slug: string;
  durationMin: number;
  note?: string;
}

export interface WeighIn {
  id: string;
  date: string;
  weightKg: number;
}

export interface ExerciseReminder {
  id: "reminder";
  enabled: boolean;
  time: string;
}

export const EXERCISES: ExerciseDef[] = [
  {
    slug: "jumping-jacks",
    name: "Jumping Jacks",
    category: "Cardio",
    focus: "Full body",
    typicalMin: 10,
    description: "A full-body warm-up and cardio session that gets your heart rate up quickly.",
    instructions: [
      "Stand tall, feet together, arms at your sides.",
      "Jump up while spreading your feet and raising your arms overhead.",
      "Jump back to the start position and repeat at a steady pace.",
    ],
  },
  {
    slug: "brisk-walk",
    name: "Brisk Walk",
    category: "Cardio",
    focus: "Full body · joint-friendly",
    typicalMin: 30,
    description: "A low-impact walk at a pace where you can talk but not sing.",
    instructions: [
      "Wear comfortable shoes and warm up for 3–5 minutes at a normal pace.",
      "Pick up speed until your breathing quickens but you can still talk.",
      "Keep your posture upright and swing your arms naturally.",
    ],
  },
  {
    slug: "running",
    name: "Running / Jogging",
    category: "Cardio",
    focus: "Heart & lungs",
    typicalMin: 25,
    description: "Builds endurance and burns calories. Start with run–walk intervals if you are new.",
    instructions: [
      "Warm up with 5 minutes of walking or light jogging.",
      "Alternate jogging with walking in comfortable intervals.",
      "Finish with a cool-down walk and gentle stretching.",
    ],
  },
  {
    slug: "cycling",
    name: "Cycling",
    category: "Cardio",
    focus: "Legs & endurance",
    typicalMin: 25,
    description: "Gentle on the knees while giving your legs and heart a solid workout.",
    instructions: [
      "Adjust the seat so your leg is nearly straight at the bottom of the pedal stroke.",
      "Keep a steady, comfortable pace throughout your ride.",
      "Ride on flat or gentle terrain if you are new to cycling.",
    ],
  },
  {
    slug: "squats",
    name: "Squats",
    category: "Strength",
    focus: "Legs & glutes",
    typicalMin: 10,
    description: "Strengthens your thighs, hips and glutes — a key movement for everyday life.",
    instructions: [
      "Stand with feet shoulder-width apart, toes slightly out.",
      "Bend your knees and hips, keeping your chest up and knees over toes.",
      "Lower as far as comfortable, then press back up to standing.",
    ],
  },
  {
    slug: "push-ups",
    name: "Push-ups",
    category: "Strength",
    focus: "Upper body & core",
    typicalMin: 8,
    description: "Builds chest, shoulders and arm strength. Bend knees to make it easier.",
    instructions: [
      "Start in a plank position with hands slightly wider than shoulders.",
      "Lower your chest toward the floor while keeping a straight line.",
      "Push back up until your arms are straight.",
    ],
  },
  {
    slug: "lunges",
    name: "Lunges",
    category: "Strength",
    focus: "Legs & balance",
    typicalMin: 8,
    description: "Improves balance and single-leg strength.",
    instructions: [
      "Stand tall and take a large step forward with one leg.",
      "Lower until both knees are bent near 90 degrees.",
      "Push off the front foot to return to standing, then switch legs.",
    ],
  },
  {
    slug: "plank",
    name: "Plank",
    category: "Core",
    focus: "Abdominals & back",
    typicalMin: 5,
    description: "Strengthens your core and improves posture. Start with 20–30 second holds.",
    instructions: [
      "Rest on your forearms and toes, body in a straight line.",
      "Tighten your stomach and glutes; avoid letting your hips sag.",
      "Hold for 20–30 seconds and repeat 2–3 times.",
    ],
  },
];

export const seedFitnessProfile: FitnessProfile = {
  id: "profile",
  heightCm: 172,
  startWeightKg: 92,
  goalWeightKg: 80,
};

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const seedWeighIns: WeighIn[] = [
  { id: "seed-w1", date: isoDaysAgo(42), weightKg: 92.4 },
  { id: "seed-w2", date: isoDaysAgo(35), weightKg: 92 },
  { id: "seed-w3", date: isoDaysAgo(28), weightKg: 91.1 },
  { id: "seed-w4", date: isoDaysAgo(21), weightKg: 90.2 },
  { id: "seed-w5", date: isoDaysAgo(14), weightKg: 89.4 },
  { id: "seed-w6", date: isoDaysAgo(7), weightKg: 88.5 },
  { id: "seed-w7", date: isoDaysAgo(1), weightKg: 87.9 },
];

export const seedWorkouts: Workout[] = [
  { id: "seed-x1", date: isoDaysAgo(2), slug: "running", durationMin: 25 },
  { id: "seed-x2", date: isoDaysAgo(1), slug: "jumping-jacks", durationMin: 10 },
  { id: "seed-x3", date: isoDaysAgo(0), slug: "squats", durationMin: 12 },
];

export const seedExerciseReminder: ExerciseReminder = {
  id: "reminder",
  enabled: true,
  time: "07:00",
};

export function imageCandidates(slug: string): string[] {
  return [
    `/exercise/images/${slug}.jpg`,
    `/exercise/images/${slug}.png`,
    `/exercise/images/${slug}.webp`,
    `/exercise/images/${slug}.svg`,
  ];
}

export function videoCandidates(slug: string): string[] {
  return [`/exercise/videos/${slug}.mp4`, `/exercise/videos/${slug}.webm`];
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy range";
  if (bmi < 30) return "Overweight";
  return "Obesity range";
}