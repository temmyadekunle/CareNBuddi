import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getGreeting, greetingKey, greetingText } from "./greeting";

describe("getGreeting", () => {
  it("returns morning for 5am-11am", () => {
    assert.equal(getGreeting(5), "morning");
    assert.equal(getGreeting(8), "morning");
    assert.equal(getGreeting(11), "morning");
  });

  it("returns afternoon for 12pm-5pm", () => {
    assert.equal(getGreeting(12), "afternoon");
    assert.equal(getGreeting(16), "afternoon");
  });

  it("returns evening for 5pm-8pm", () => {
    assert.equal(getGreeting(17), "evening");
    assert.equal(getGreeting(20), "evening");
  });

  it("returns late for 9pm onwards", () => {
    assert.equal(getGreeting(21), "late");
    assert.equal(getGreeting(22), "late");
    assert.equal(getGreeting(23), "late");
    assert.equal(getGreeting(0), "late");
    assert.equal(getGreeting(4), "late");
  });
});

describe("greetingKey", () => {
  it("returns morning key for morning hours", () => {
    assert.equal(greetingKey(5), "greeting_morning");
    assert.equal(greetingKey(11), "greeting_morning");
  });

  it("returns afternoon key for afternoon hours", () => {
    assert.equal(greetingKey(12), "greeting_afternoon");
    assert.equal(greetingKey(16), "greeting_afternoon");
  });

  it("returns evening key for evening hours", () => {
    assert.equal(greetingKey(17), "greeting_evening");
    assert.equal(greetingKey(20), "greeting_evening");
  });

  it("returns late-night key for late night hours", () => {
    assert.equal(greetingKey(21), "greeting_late");
    assert.equal(greetingKey(0), "greeting_late");
    assert.equal(greetingKey(4), "greeting_late");
  });
});

describe("greetingText", () => {
  it("returns Good morning without name", () => {
    assert.equal(greetingText(8), "Good morning.");
  });

  it("returns Welcome back at late hours without name", () => {
    assert.equal(greetingText(22), "Welcome back.");
  });

  it("includes name when provided", () => {
    assert.equal(greetingText(8, "Ada"), "Good morning, Ada.");
    assert.equal(greetingText(22, "Ada"), "Welcome back, Ada.");
  });
});
