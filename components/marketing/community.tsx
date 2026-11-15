import { CheckIcon, LockIcon, ShieldIcon, StethoscopeIcon, UserIcon } from "@/components/icons";
import { Reveal } from "@/components/marketing/reveal";
import { StatusBadge } from "@/components/marketing/status-badge";

const PATIENT_FEATURES = [
  "Ask health questions",
  "Reply in discussions",
  "Edit or delete your posts",
  "Report harmful content",
  "Moderated spaces",
  "Signed-in access only",
];

const PROVIDER_FEATURES = [
  "Verified-provider space",
  "Professional discussions",
  "Post and reply",
  "Reporting and moderation",
  "Separate from the patient space",
  "Signed-in access only",
];

const SAFETY = [
  {
    title: "Separate spaces",
    body: "Patient and professional communities are distinct environments with different members.",
  },
  {
    title: "Verified access",
    body: "Provider verification is required for the professional space; posting needs a signed-in account.",
  },
  {
    title: "Privacy first",
    body: "Posting guidance asks members not to share names, contacts, results or other identifying details.",
  },
  {
    title: "Clear boundaries",
    body: "Community is for discussion and support, never a professional diagnosis or treatment.",
  },
  {
    title: "Guidelines and reporting",
    body: "Members can report posts and comments. Moderators can hide, restore or remove content, and every action is recorded.",
  },
  {
    title: "No open free-for-all",
    body: "Only signed-in members can post, and the provider space is verified-only.",
  },
];

/**
 * CareNBuddi Community.
 *
 * The feed, comments, reporting and moderation queue are implemented and
 * server-backed. The copy below describes only what a member can do today;
 * peer support groups, events and Academy learning are not claimed here.
 */
export function CommunitySection() {
  return (
    <section id="community" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
              Available in the app
            </p>
            <StatusBadge status="available" />
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            CareNBuddi Community
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-600">
            Two separate, moderated discussion spaces: questions and shared experience for
            patients, and a professional space for verified healthcare providers.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {/* ------------------------------------------ patient community */}
          <Reveal className="h-full">
            <article className="flex h-full flex-col rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-brand-100/70 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white">
                  <UserIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Patient Community</h3>
                  <p className="text-xs text-slate-600">Support, learning and shared experience</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-700">
                A welcoming discussion space where patients can ask questions, share experiences
                and reply to one another. Members can edit or delete their own posts.
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                {PATIENT_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px] text-slate-700">
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-xl border border-brand-200 bg-white/80 p-4 text-[13px] leading-relaxed text-slate-700">
                <span className="font-semibold text-brand-800">For example:</span> a person with a
                question about managing hypertension can start a discussion and hear how other
                patients approach the same challenge. Community discussion is not a diagnosis.
              </p>
            </article>
          </Reveal>

          {/* ----------------------------------------- provider community */}
          <Reveal delay={80} className="h-full">
            <article className="flex h-full flex-col rounded-3xl bg-brand-900 p-6 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-brand-100">
                  <StethoscopeIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">Healthcare Provider Community</h3>
                  <p className="text-xs text-brand-100/80">Verified professionals only</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-brand-50/90">
                A professional discussion space for verified healthcare providers to share
                knowledge and discuss practice with one another.
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                {PROVIDER_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px] text-brand-50/90">
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-200" />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className="mt-5 flex items-start gap-2 rounded-xl border border-white/15 bg-white/5 p-4 text-[12px] leading-relaxed text-brand-100">
                <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                Access to the professional space requires provider verification. Community runs
                on the CareNBuddi backend; there is no offline or demo feed.
              </p>
            </article>
          </Reveal>
        </div>

        {/* --------------------------------------------- community safety */}
        <Reveal delay={100}>
          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-2">
              <ShieldIcon className="h-5 w-5 text-brand-700" />
              <h3 className="text-base font-semibold text-slate-900">Built with safety in mind</h3>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SAFETY.map((item) => (
                <div key={item.title}>
                  <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
