export function realtimeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";

  if (name === "NotAllowedError" || message.includes("Permission denied") || message.includes("Permission dismissed")) {
    return "Microphone permission denied. Allow microphone access for this browser, then click Connect voice again.";
  }

  if (name === "NotFoundError" || message.includes("Requested device not found")) {
    return "No microphone was found. Connect or enable a microphone, then click Connect voice again.";
  }

  return message || "Unable to connect realtime session.";
}
