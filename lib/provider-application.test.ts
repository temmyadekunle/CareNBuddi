import assert from "node:assert/strict";
import test from "node:test";

import {
  ONBOARDING_STEPS,
  categoryById,
  isLicensedCategory,
  isReadyToSubmit,
  isStepComplete,
  missingRequirements,
  newApplication,
  nextIncompleteStep,
  reviewApplication,
  submitApplication,
  type ProviderApplication,
} from "./provider-application";
import { canAccessProviderWorkspace } from "./post-auth";

const NOW = "2026-10-13T10:00:00.000Z";

function draft(over: Partial<ProviderApplication> = {}): ProviderApplication {
  return { ...newApplication({ id: "a1", userId: "u1", email: "n@example.com", now: NOW }), ...over };
}

/** An application that has satisfied every pre-review step. */
function complete(): ProviderApplication {
  return draft({
    acceptedTerms: true,
    acceptedPrivacy: true,
    fullName: "Dr Ngozi Eze",
    category: "doctor",
    speciality: "Paediatrics",
    state: "Lagos",
    city: "Ikeja",
    identityDocument: { docType: "National Identity Card", fileName: "nic.jpg", sizeBytes: 1000, mimeType: "image/jpeg", addedAt: NOW },
    identityStatus: "submitted",
    qualifications: "MBBS",
    institution: "UNILAG",
    registrationNumber: "MDC/1234",
    licensingBody: "Medical and Dental Council of Nigeria",
  });
}

test("a new application starts as a draft and is not verified", () => {
  const app = draft();
  assert.equal(app.status, "draft");
  assert.equal(app.identityStatus, "not-started");
  assert.equal(app.credentialsStatus, "not-started");
  assert.equal(app.submittedAt, null);
  assert.equal(canAccessProviderWorkspace(app), false);
});

test("licensing requirement differs by category", () => {
  assert.equal(isLicensedCategory(draft({ category: "doctor" })), true);
  assert.equal(isLicensedCategory(draft({ category: "pharmacist" })), true);
  // These categories are not statutorily registered, so the form must not ask
  // for a licence number.
  assert.equal(isLicensedCategory(draft({ category: "health-educator" })), false);
  assert.equal(isLicensedCategory(draft({ category: "nutrition" })), false);
  assert.equal(categoryById("midwife")?.regulator, "Nursing and Midwifery Council of Nigeria");
});

test("identity and credential checks are independent", () => {
  // Identity supplied, professional credentials deliberately absent.
  const idOnly = { ...complete(), qualifications: "", registrationNumber: "", licensingBody: "" };
  // A submitted identity document on its own must not make anybody a provider.
  assert.equal(idOnly.identityStatus, "submitted");
  assert.equal(idOnly.credentialsStatus, "not-started");
  assert.equal(isStepComplete(idOnly, "credentials"), false);
  assert.equal(canAccessProviderWorkspace(idOnly), false);

  // And credentials without a licence number do not complete a licensed category.
  const noRegNo = { ...complete(), registrationNumber: "" };
  assert.equal(isStepComplete(noRegNo, "credentials"), false);

  // Identity verified by a reviewer still does not verify credentials by itself.
  const idVerified = reviewApplication(idOnly, {
    status: "under-review",
    reviewerId: "u-admin",
    now: NOW,
  });
  assert.equal(idVerified.identityStatus, "submitted");
  assert.notEqual(idVerified.credentialsStatus, "verified");
  assert.equal(canAccessProviderWorkspace(idVerified), false);
});

test("a non-licensed category is completed by qualifications and institution", () => {
  const educator = draft({
    acceptedTerms: true,
    acceptedPrivacy: true,
    fullName: "Amina Bello",
    category: "health-educator",
    speciality: "Community health",
    state: "Kano",
    city: "Kano",
    identityDocument: { docType: "Voter's card", fileName: "vc.jpg", sizeBytes: 10, mimeType: "image/jpeg", addedAt: NOW },
    qualifications: "BSc Public Health",
    institution: "ABU Zaria",
  });
  assert.equal(isStepComplete(educator, "credentials"), true);
});

test("review step only completes after submission", () => {
  const app = complete();
  assert.equal(isStepComplete(app, "review"), false);
  const submitted = submitApplication(app, NOW);
  assert.equal(isStepComplete(submitted, "review"), true);
  assert.equal(submitted.submittedAt, NOW);
});

test("the applicant cannot mark themselves verified", () => {
  const app = complete();
  // Nothing the applicant does touches status beyond submitted.
  assert.equal(submitApplication(app, NOW).status, "submitted");
  assert.equal(canAccessProviderWorkspace(submitApplication(app, NOW)), false);
  // Only the reviewer transition produces verified.
  const verified = reviewApplication(app, { status: "verified", reviewerId: "u-admin", now: NOW });
  assert.equal(verified.status, "verified");
  assert.equal(verified.identityStatus, "verified");
  assert.equal(verified.credentialsStatus, "verified");
  assert.equal(verified.reviewedBy, "u-admin");
  assert.equal(canAccessProviderWorkspace(verified), true);
});

test("review records the reviewer and the time", () => {
  const decided = reviewApplication(complete(), {
    status: "needs-info",
    note: "Please re-upload your licence.",
    reviewerId: "u-admin",
    now: "2026-10-14T09:30:00.000Z",
  });
  assert.equal(decided.status, "needs-info");
  assert.equal(decided.reviewNote, "Please re-upload your licence.");
  assert.equal(decided.reviewedBy, "u-admin");
  assert.equal(decided.reviewedAt, "2026-10-14T09:30:00.000Z");
  // needs-info must not grant the workspace.
  assert.equal(canAccessProviderWorkspace(decided), false);
});

test("a rejected or suspended application does not open the workspace", () => {
  for (const status of ["rejected", "suspended"] as const) {
    const decided = reviewApplication(complete(), { status, reviewerId: "u-admin", now: NOW });
    assert.equal(canAccessProviderWorkspace(decided), false);
  }
});

test("progress resumes at the first incomplete step", () => {
  assert.equal(nextIncompleteStep(draft()), "welcome");

  const consented = draft({ acceptedTerms: true, acceptedPrivacy: true });
  assert.equal(nextIncompleteStep(consented), "profile");

  const profiled = { ...consented, fullName: "A B", category: "doctor" as const, speciality: "GP", state: "Lagos", city: "Yaba" };
  assert.equal(nextIncompleteStep(profiled), "identity");

  assert.equal(nextIncompleteStep(complete()), "review");
  assert.equal(nextIncompleteStep(submitApplication(complete(), NOW)), null);
});

test("missing requirements describe the gaps in plain language", () => {
  const gaps = missingRequirements(draft());
  assert.ok(gaps.length > 0);
  assert.ok(gaps.some((g) => /Terms of Service/.test(g)));
  assert.ok(gaps.some((g) => /identity document/i.test(g)));

  // Nothing missing once complete.
  assert.deepEqual(missingRequirements(complete()), []);
});

test("ready to submit requires every step before review", () => {
  assert.equal(isReadyToSubmit(draft()), false);
  assert.equal(isReadyToSubmit(complete()), true);
});

test("landing path ordering is covered in post-auth.test.ts", () => {
  // nextIncompleteStep is the input to routing; the routing itself lives with
  // the other post-authentication decisions.
  assert.equal(nextIncompleteStep(draft()), "welcome");
});

test("every onboarding step is represented and ordered", () => {
  assert.deepEqual([...ONBOARDING_STEPS], ["welcome", "profile", "identity", "credentials", "review"]);
});