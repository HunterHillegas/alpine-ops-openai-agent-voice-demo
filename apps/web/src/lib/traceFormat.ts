const sensitiveKeyPattern = /(authorization|client.?secret|email|phone|token)/i;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
const tokenPattern = /\b(?:sk|eph|tok)_[A-Za-z0-9_-]+\b/g;

export function formatEventArgs(args: Record<string, unknown>) {
  const text = JSON.stringify(redactTraceValue(args), null, 2);
  return text.length > 360 ? `${text.slice(0, 357)}...` : text;
}

export function redactTraceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactTraceValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[redacted]" : redactTraceValue(nested)
      ])
    );
  }
  if (typeof value === "string") return redactTraceString(value);
  return value;
}

function redactTraceString(value: string) {
  return value
    .replace(emailPattern, "[redacted-email]")
    .replace(phonePattern, "[redacted-phone]")
    .replace(tokenPattern, "[redacted-token]");
}
