import { test } from "node:test";
import assert from "node:assert";

// This test verifies the FIXED implementation matches Daily's spec
// We replicate the fixed logic here to test it independently

const DAILY_HMAC_SECRET_BASE64 = "NQrSA5z0FkJ44QPrFerW7uCc5kdNLv3l2FDEKDanL1U=";

// Use current timestamp (within 5 minutes)
const CURRENT_TIMESTAMP = String(Date.now());

const EVENT_PAYLOAD = {
  events: [
    {
      id: "evt_01HVK9YJ2X3Z4W5V6U7T8S9R",
      type: "participant.joined",
      room_name: "carenbuddi-consult-abc123",
      payload: {
        session_id: "sess_01HVK9YJ2X3Z4W5V6U7T8S9R",
        user_id: "usr_01HVK9YJ2X3Z4W5V6U7T8S9R",
        user_name: "Dr. Smith",
      },
    },
  ],
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function computeDailySignature(timestamp: string, event: unknown, secretBase64: string): Promise<string> {
  // Daily's algorithm: HMAC-SHA256(Base64Decode(secret), timestamp + "." + JSON.stringify(event))
  // Result is Base64 encoded
  const binary = atob(secretBase64);
  const keyData = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    keyData[i] = binary.charCodeAt(i);
  }
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  
  const signedContent = timestamp + "." + JSON.stringify(event);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  return arrayBufferToBase64(sig);
}

async function verifyDailyWebhookSignatureFixed(
  body: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
): Promise<{ valid: boolean; timestamp?: number }> {
  const DAILY_WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;
  
  if (!signatureHeader || !timestampHeader) return { valid: false };
  const signature = signatureHeader.trim();
  const timestampStr = timestampHeader.trim();
  if (!signature || !timestampStr) return { valid: false };

  const timestamp = Number.parseInt(timestampStr, 10);
  if (!Number.isFinite(timestamp)) return { valid: false };

  const now = Date.now();
  if (now - timestamp > DAILY_WEBHOOK_MAX_AGE_MS) return { valid: false };

  // Decode base64 secret
  let keyData: ArrayBuffer;
  try {
    const binary = atob(secret);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    keyData = bytes.buffer;
  } catch {
    return { valid: false };
  }

  // Import key
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Parse body and use JSON.stringify for signed content (Daily's spec)
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    return { valid: false };
  }

  const signedContent = `${timestamp}.${JSON.stringify(parsedBody)}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  
  // Convert to base64 (not hex!)
  const expectedBase64 = arrayBufferToBase64(sig);

  // Constant-time comparison on base64
  if (signature.length !== expectedBase64.length) return { valid: false };
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expectedBase64.charCodeAt(i);
  return { valid: diff === 0, timestamp };
}

test("Fixed implementation accepts valid Daily signature", async () => {
  const bodyText = JSON.stringify(EVENT_PAYLOAD);
  
  // Compute signature using Daily's algorithm (what Daily sends)
  const validSignature = await computeDailySignature(CURRENT_TIMESTAMP, EVENT_PAYLOAD, DAILY_HMAC_SECRET_BASE64);
  
  // Verify using fixed implementation
  const result = await verifyDailyWebhookSignatureFixed(bodyText, validSignature, CURRENT_TIMESTAMP, DAILY_HMAC_SECRET_BASE64);
  
  assert.strictEqual(result.valid, true, "Valid signature should be accepted");
  assert.strictEqual(result.timestamp, parseInt(CURRENT_TIMESTAMP, 10));
});

test("Fixed implementation rejects invalid signature", async () => {
  const bodyText = JSON.stringify(EVENT_PAYLOAD);
  const invalidSignature = "invalid_signature_that_is_long_enough_to_pass_length_check====";
  
  const result = await verifyDailyWebhookSignatureFixed(bodyText, invalidSignature, CURRENT_TIMESTAMP, DAILY_HMAC_SECRET_BASE64);
  
  assert.strictEqual(result.valid, false, "Invalid signature should be rejected");
});

test("Fixed implementation rejects missing signature header", async () => {
  const bodyText = JSON.stringify(EVENT_PAYLOAD);
  
  const result = await verifyDailyWebhookSignatureFixed(bodyText, null, CURRENT_TIMESTAMP, DAILY_HMAC_SECRET_BASE64);
  
  assert.strictEqual(result.valid, false, "Missing signature should be rejected");
});

test("Fixed implementation rejects missing timestamp header", async () => {
  const bodyText = JSON.stringify(EVENT_PAYLOAD);
  const validSignature = await computeDailySignature(CURRENT_TIMESTAMP, EVENT_PAYLOAD, DAILY_HMAC_SECRET_BASE64);
  
  const result = await verifyDailyWebhookSignatureFixed(bodyText, validSignature, null, DAILY_HMAC_SECRET_BASE64);
  
  assert.strictEqual(result.valid, false, "Missing timestamp should be rejected");
});

test("Fixed implementation rejects expired timestamp", async () => {
  const bodyText = JSON.stringify(EVENT_PAYLOAD);
  const expiredTimestamp = String(Date.now() - 6 * 60 * 1000); // 6 minutes ago
  const validSignature = await computeDailySignature(expiredTimestamp, EVENT_PAYLOAD, DAILY_HMAC_SECRET_BASE64);
  
  const result = await verifyDailyWebhookSignatureFixed(bodyText, validSignature, expiredTimestamp, DAILY_HMAC_SECRET_BASE64);
  
  assert.strictEqual(result.valid, false, "Expired timestamp should be rejected");
});

test("Fixed implementation rejects malformed timestamp", async () => {
  const bodyText = JSON.stringify(EVENT_PAYLOAD);
  const validSignature = await computeDailySignature(CURRENT_TIMESTAMP, EVENT_PAYLOAD, DAILY_HMAC_SECRET_BASE64);
  
  const result = await verifyDailyWebhookSignatureFixed(bodyText, validSignature, "not_a_number", DAILY_HMAC_SECRET_BASE64);
  
  assert.strictEqual(result.valid, false, "Malformed timestamp should be rejected");
});

test("Fixed implementation handles JSON whitespace normalization", async () => {
  // Daily might send JSON with whitespace
  const bodyWithWhitespace = '{\n  "events": [\n    {"id": "evt_1", "type": "participant.joined", "room_name": "test", "payload": {"session_id": "sess_1"}}\n  ]\n}';
  
  // Compute signature using parsed JSON (Daily's way)
  const validSignature = await computeDailySignature(CURRENT_TIMESTAMP, JSON.parse(bodyWithWhitespace), DAILY_HMAC_SECRET_BASE64);
  
  // Verify using fixed implementation - should parse and re-stringify
  const result = await verifyDailyWebhookSignatureFixed(bodyWithWhitespace, validSignature, CURRENT_TIMESTAMP, DAILY_HMAC_SECRET_BASE64);
  
  assert.strictEqual(result.valid, true, "Whitespace-normalized JSON should be accepted");
});

test("Fixed implementation handles Daily's test payload", async () => {
  // Daily sends {"test": "test"} for verification
  const testPayload = { test: "test" };
  const bodyText = JSON.stringify(testPayload);
  
  const validSignature = await computeDailySignature(CURRENT_TIMESTAMP, testPayload, DAILY_HMAC_SECRET_BASE64);
  
  const result = await verifyDailyWebhookSignatureFixed(bodyText, validSignature, CURRENT_TIMESTAMP, DAILY_HMAC_SECRET_BASE64);
  
  assert.strictEqual(result.valid, true, "Daily's test payload should be accepted");
});