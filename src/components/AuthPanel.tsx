import { FormEvent, useState } from "react";
import { sendMagicLink } from "../lib/auth";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    try {
      await sendMagicLink(email);
      setStatus("sent");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div className="auth-panel">
        <p>Check {email} for a magic sign-in link.</p>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {status === "error" && errorMessage && <p className="auth-panel-error">{errorMessage}</p>}
    </form>
  );
}
