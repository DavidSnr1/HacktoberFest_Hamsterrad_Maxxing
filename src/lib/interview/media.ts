/** Browser media helpers with German error messages for the interview room. */

export type MediaCheckResult = { ok: true } | { ok: false; message: string };

function messageForError(error: unknown, device: "mic" | "camera"): string {
  const name = error instanceof DOMException ? error.name : "";
  const label = device === "mic" ? "Mikrofon" : "Kamera";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `Der Zugriff auf ${device === "mic" ? "dein Mikrofon" : "deine Kamera"} wurde verweigert. Erlaube ihn über das Schloss-Symbol in der Adressleiste und versuche es erneut.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `Es wurde kein ${label} gefunden. Schließe ein ${label} an und versuche es erneut.`;
    case "NotReadableError":
    case "AbortError":
      return `Dein ${label} wird gerade von einer anderen App verwendet. Schließe diese App und versuche es erneut.`;
    default:
      return `Auf ${device === "mic" ? "dein Mikrofon" : "deine Kamera"} konnte nicht zugegriffen werden.`;
  }
}

function mediaSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Asks for microphone permission and releases the device right away. */
export async function checkMicrophone(): Promise<MediaCheckResult> {
  if (!mediaSupported()) {
    return {
      ok: false,
      message: "Dein Browser unterstützt keine Mikrofonaufnahme. Nutze einen aktuellen Browser über eine sichere Verbindung (HTTPS).",
    };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageForError(error, "mic") };
  }
}

/** Opens the front camera for the local self view. The video never leaves the browser. */
export async function openCamera(): Promise<{ ok: true; stream: MediaStream } | { ok: false; message: string }> {
  if (!mediaSupported()) {
    return { ok: false, message: "Dein Browser unterstützt keine Kamera." };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    return { ok: true, stream };
  } catch (error) {
    return { ok: false, message: messageForError(error, "camera") };
  }
}
