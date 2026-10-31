import { Studio } from "./Studio";

/**
 * Spicy studio.
 *
 * Uncensored models are hidden from the public catalogue unless
 * `ENABLE_SPICY_MODELS` is set on the backend. This page exists as the entry
 * point for that tier, keeping the spicy
 * models behind a separate studio surface.
 */
export const SpicyStudio = () => <Studio mode="image" />;
