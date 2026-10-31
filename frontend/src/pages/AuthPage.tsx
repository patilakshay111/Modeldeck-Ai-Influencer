import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { PRODUCT } from "../config";

export const AuthPage = ({ mode }: { mode: "signin" | "register" }) => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password, name);
      navigate("/studio");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p className="muted">{PRODUCT.name}</p>

        {mode === "register" ? (
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
        ) : null}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === "register" ? 10 : undefined}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </label>

        {mode === "register" ? (
          <p className="muted small">
            At least 10 characters. You will confirm your age before your first
            generation.
          </p>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <p className="muted small">
          {mode === "signin" ? (
            <>
              No account? <Link to="/register">Create one</Link>
            </>
          ) : (
            <>
              Already have one? <Link to="/signin">Sign in</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
};
