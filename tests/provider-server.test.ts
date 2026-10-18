import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPLICATION_TRANSITIONS,
  canTransition,
  newApplication,
  type ProviderApplication,
  type ProviderApplicationStatus,
} from "../lib/provider-application";
import {
  applicationToPayload,
  describeServerFailure,
  rowToApplication,
} from "../lib/server-provider-applications";

/**
 * The client/server contract for the provider application workflow.
 *
 * Migration 0007 validates every write on the server; these tests pin the
 * client side of the same rules: what travels in a payload, how a server
 * row is read back, and that the client transition matrix is identical to
 * the SQL one — a divergence would surface as an admin UI button the
 * database then refuses.
 */

const AUTHORITATIVE_FIELDS = [
  "userId",
  "status",
  "submittedAt",
  "updatedAt",
  "reviewNote",
  "reviewedBy",
  "reviewedAt",
] as const;

const BASE_ID = "0f0e0d0c-0b0a-4999-8888-777766665555";

describe("applicationToPayload", () => {
  it("strips every field the applicant must not be able to set", () => {
    const app: ProviderApplication = {
      ...newApplication({ id: BASE_ID, userId: "u1", email: "a@b.test" }),
      status: "verified",
      submittedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      reviewNote: "forged",
      reviewedBy: "admin",
      reviewedAt: "2026-01-03T00:00:00.000Z",
    };
    const payload = applicationToPayload(app);
    for (const field of AUTHORITATIVE_FIELDS) {
      assert.equal(field in payload, false, field);
    }
  });

  it("carries the local application id so the server adopts the id storage paths name", () => {
    const app = newApplication({ id: BASE_ID, userId: "u1", email: "a@b.test" });
    assert.equal(applicationToPayload(app).id, BASE_ID);
  });

  it("round-trips its own output into an identical writable application", () => {
    const app: ProviderApplication = {
      ...newApplication({ id: BASE_ID, userId: "u1", email: "a@b.test" }),
      email: "a@b.test",
      fullName: "Ada",
      phone: "+2340000000001",
      category: "doctor",
      speciality: "Cardiology",
      languages: "English, Hausa",
    };
    const payload = applicationToPayload(app);
    const row: Record<string, unknown> = {
      id: app.id,
      user_id: "u1",
      status: "submitted",
      submitted_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      // snake_case of every key the payload carries
      email: payload.email,
      full_name: payload.fullName,
      phone: payload.phone,
      accepted_terms: payload.acceptedTerms,
      accepted_privacy: payload.acceptedPrivacy,
      category: payload.category,
      trainee: payload.trainee,
      speciality: payload.speciality,
      qualifications: payload.qualifications,
      institution: payload.institution,
      registration_number: payload.registrationNumber,
      licensing_body: payload.licensingBody,
      licence_expiry: payload.licenceExpiry,
      years_experience: payload.yearsExperience,
      bio: payload.bio,
      languages: payload.languages,
      state: payload.state,
      city: payload.city,
      facility: payload.facility,
      services: payload.services,
      identity_document: payload.identityDocument,
      identity_status: "submitted",
      credential_evidence: payload.credentialEvidence,
      credentials_status: "not-started",
      review_note: "",
      reviewed_by: null,
      reviewed_at: null,
    };
    const rebuilt = rowToApplication(row);
    const original = applicationToPayload(app);
    const fromRow = applicationToPayload(rebuilt);
    for (const key of Object.keys(original)) {
      if (key === "identityStatus" || key === "identityDocument" ||
          key === "credentialEvidence" || key === "credentialsStatus") continue;
      assert.deepEqual(
        original[key],
        (fromRow as Record<string, unknown>)[key],
        `${key} changed across the cycle`,
      );
    }
  });
});

describe("rowToApplication", () => {
  it("reads a database row into the domain object, server status intact", () => {
    const app = rowToApplication({
      id: "0f0e0d0c-0b0a-4999-8888-777766665555",
      user_id: "u1",
      email: "a@b.test",
      full_name: "Ada",
      accepted_terms: true,
      accepted_privacy: true,
      category: "doctor",
      trainee: false,
      status: "under-review",
      identity_status: "submitted",
      credentials_status: "not-started",
      review_note: "",
      reviewed_by: null,
      reviewed_at: null,
      submitted_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
    assert.equal(app.status, "under-review");
    assert.equal(app.userId, "u1");
    assert.equal(app.identityStatus, "submitted");
    assert.equal(app.fullName, "Ada");
    assert.equal(app.acceptedTerms, true);
    assert.equal(app.reviewedBy, null);
  });

  it("treats missing server columns as empty, never as locally invented state", () => {
    const app = rowToApplication({});
    assert.equal(app.status, "");
    assert.equal(app.fullName, "");
    assert.equal(app.identityDocument, null);
    assert.equal(app.acceptedTerms, false);
  });
});

describe("canTransition <-> migration 0007 SQL matrix", () => {
  // The SQL list in `can_review_transition` (0007). Any drift between the
  // two lists must fail here first, not as a surprise RPC error in the
  // admin dashboard.
  const SQL_MATRIX = {
    draft: ["submitted"],
    submitted: ["under-review", "needs-info", "verified", "rejected"],
    "under-review": ["needs-info", "verified", "rejected", "suspended"],
    "needs-info": ["under-review", "verified", "rejected", "suspended"],
    verified: ["suspended"],
    rejected: [],
    suspended: ["verified", "rejected"],
  } satisfies Partial<Record<ProviderApplicationStatus, ProviderApplicationStatus[]>>;

  it("is identical to the SQL matrix", () => {
    assert.deepEqual(APPLICATION_TRANSITIONS, SQL_MATRIX);
  });

  it("refuses the transitions an applicant must never control", () => {
    for (const [from, to] of [
      ["draft", "draft"],
      ["draft", "verified"],
      ["submitted", "submitted"],
      ["rejected", "verified"],
      ["suspended", "draft"],
    ] as const) {
      assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
    }
  });

  it("never leaves the application without a way forward or a terminal", () => {
    for (const status of Object.keys(SQL_MATRIX) as ProviderApplicationStatus[]) {
      const forward = SQL_MATRIX[status];
      if (status !== "rejected") assert.ok(forward.length > 0, `${status} dead-ends`);
    }
  });
});

describe("describeServerFailure", () => {
  it("maps session expiry to calm copy", () => {
    assert.match(describeServerFailure("JWT expired"), /session has expired/i);
  });
  it("maps permission refusals without leaking internals", () => {
    assert.match(describeServerFailure("permission denied for table provider_applications"), /not permitted/i);
  });
  it("maps reachability problems to a cloud message", () => {
    assert.match(describeServerFailure("Failed to fetch"), /unreachable/i);
  });
  it("passes through the database's own operational messages", () => {
    assert.equal(
      describeServerFailure("application is locked while under administrator control"),
      "application is locked while under administrator control",
    );
  });
});
