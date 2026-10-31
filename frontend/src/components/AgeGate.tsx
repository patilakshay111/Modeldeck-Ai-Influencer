import { useState } from "react";
import { useAuth } from "../lib/auth";

/**
 * Age attestation.
 *
 * The service only generates for accounts that have confirmed they are an
 * adult, because the catalogue includes models whose subject matter is
 * restricted. The gate is modal and blocks the studio until it is answered.
 */
export const AgeGate = () => {
  const { attestAge } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await attestAge();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Confirm your age</h2>
        <p>
          This studio offers image and video models whose subject matter is
          restricted to adults. You must confirm that you are 18 or older
          before generating. The confirmation is recorded against your account.
        </p>
        <p className="muted">
          Synthetic media must not depict real people without their consent.
          Do not create likenesses of anyone who has not agreed to it.
        </p>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button type="button" className="primary" onClick={confirm} disabled={busy}>
            {busy ? "Recording…" : "I am 18 or older"}
          </button>
        </div>
      </div>
    </div>
  );
};
