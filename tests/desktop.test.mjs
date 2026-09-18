import test from "node:test";
import assert from "node:assert/strict";
import policy from "../desktop/url-policy.cjs";
test("Desktop solo admite origen HTTPS configurado", () => {
  assert.equal(
    policy.validateSiteUrl("https://duna.example.com/"),
    "https://duna.example.com",
  );
  for (const bad of [
    "http://duna.example.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@duna.example.com",
    "https://duna.example.com/admin",
    "https://TU-PROYECTO.vercel.app",
    "https://duna.example.com/?next=evil",
  ])
    assert.throws(() => policy.validateSiteUrl(bad));
  assert.equal(
    policy.sameOrigin(
      "https://duna.example.com/admin",
      "https://duna.example.com",
    ),
    true,
  );
  assert.equal(
    policy.sameOrigin(
      "https://duna.example.com.evil.test",
      "https://duna.example.com",
    ),
    false,
  );
});
