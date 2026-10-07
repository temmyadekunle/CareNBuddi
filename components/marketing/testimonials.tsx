import { StarIcon } from "@/components/icons";

type Testimonial = {
  quote: string;
  name: string;
  context: string;
};

/**
 * PLACEHOLDER TESTIMONIALS — layout scaffolding only.
 *
 * These are illustrative examples, not real customer statements. Replace every
 * entry with a genuine, permissioned testimonial before launch and set
 * `PLACEHOLDER_TESTIMONIALS = false` to hide the notice below the grid.
 */
const PLACEHOLDER_TESTIMONIALS = true;

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I wanted one place to see which clinic to go to and what my next appointment is. CareNBuddi keeps that in my pocket instead of scattered across paper and messages.",
    name: "Placeholder name 1",
    context: "Patient, Lagos",
  },
  {
    quote:
      "My mother takes her medication in three languages depending on who is caring for her that day. Having CareNBuddi in Yoruba and English changed how we manage her care.",
    name: "Placeholder name 2",
    context: "Caregiver, Ibadan",
  },
  {
    quote:
      "We can now show patients our details and receive appointment requests directly. The clinic stopped losing enquiries that used to arrive as missed calls.",
    name: "Placeholder name 3",
    context: "Clinic administrator, Abuja",
  },
];

export function Testimonials() {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((item) => (
          <figure
            key={item.name}
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
          >
            <div aria-hidden className="flex gap-0.5 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-slate-600">
              {item.quote}
            </blockquote>
            <figcaption className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500">{item.context}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      {PLACEHOLDER_TESTIMONIALS ? (
        <p className="mt-4 text-center text-xs text-slate-500">
          Placeholder testimonials shown for layout review — these are not real customer
          statements and will be replaced with genuine, permissioned quotes before launch.
        </p>
      ) : null}
    </div>
  );
}
