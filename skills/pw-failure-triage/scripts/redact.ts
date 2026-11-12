/** Field names whose values must never reach triage output: credentials, tokens, session cookies. */
const SECRET_NAME = "pass(?:word)?|token|secret|otp|cookie|authorization";
const SECRET_KEY = new RegExp(SECRET_NAME, "i");
/**
 * A `code` is a secret only when it looks like a one-time code (4–8 digits). Backend error codes
 * (`MobileExists`) and HTTP statuses (`503`) are the evidence a triage needs.
 */
const CODE_KEY = /code$/i;
const OTP = /^\d{4,8}$/;

/** A quoted string, escaped quotes included, so a `\"` or `\'` inside a secret does not end it. */
const QUOTED_STRING = String.raw`"(?:[^"\\]|\\.)*"`;
const SINGLE_QUOTED_STRING = String.raw`'(?:[^'\\]|\\.)*'`;

const QUOTED_SECRET = new RegExp(`("[^"]*(?:${SECRET_NAME})[^"]*"\\s*:\\s*)(?:${QUOTED_STRING}|\\d+)`, "gi");
const QUOTED_CODE = /("[^"]*code"\s*:\s*)(?:"\d{4,8}"|\d{4,8}\b)/gi;
const BEARER = /\b(Bearer\s+)[^\s"',]+/g;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
/** The value may be quoted; a `Basic` scheme is masked with its credentials, which are only base64. */
const KEY_VALUE = new RegExp(
  `\\b(\\w*(?:${SECRET_NAME})\\w*\\s*[=:]\\s*)(?!\\*\\*\\*|Bearer\\b)(?:${QUOTED_STRING}|${SINGLE_QUOTED_STRING}|(?:Basic\\s+)?[^&\\s<"',;]+)`,
  "gi",
);
const CODE_VALUE = /\b(\w*code\s*[=:]\s*)\d{4,8}\b/gi;

/**
 * Mask secrets in free text: error messages, HTML or plain-text bodies. Covers JSON fields quoted
 * inside the text, bearer tokens, bare JWTs, and `key=value` / `key: value` pairs.
 */
export function redactText(text: string): string {
  return text
    .replace(QUOTED_SECRET, '$1"***"')
    .replace(QUOTED_CODE, '$1"***"')
    .replace(BEARER, "$1***")
    .replace(JWT, "***")
    .replace(KEY_VALUE, "$1***")
    .replace(CODE_VALUE, "$1***");
}

function isSecretField(key: string, value: unknown): boolean {
  if (SECRET_KEY.test(key)) return true;
  return CODE_KEY.test(key) && (typeof value === "string" || typeof value === "number") && OTP.test(String(value));
}

/**
 * Mask a JSON body: the whole value of a secret field (objects and arrays included), and secrets
 * inside the text of every other string. A body that is not JSON is masked as text.
 */
export function redactBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), (key, value: unknown) => {
      if (key && isSecretField(key, value)) return "***";
      return typeof value === "string" ? redactText(value) : value;
    });
  } catch {
    return redactText(body);
  }
}
