import { useEffect, useMemo, useRef, useState } from "react";
import type { Influencer } from "../lib/api";

/**
 * A prompt box with `@` mentions.
 *
 * Typing `@` opens a picker of your characters. Choosing one inserts
 * `@handle` into the text and reports the character, so the caller can use
 * their reference image — that is the face-lock: the same character across
 * every model.
 */
export const MentionInput = ({
  value,
  onChange,
  characters,
  onMention,
  placeholder,
  rows = 4,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  characters: Influencer[];
  onMention?: (character: Influencer) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) => {
  const [query, setQuery] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const box = useRef<HTMLTextAreaElement | null>(null);

  /** The `@word` being typed at the caret, if any. */
  const active = useMemo(() => {
    if (query === null) return null;
    const before = value.slice(0, caret);
    const match = /@([a-z0-9_]*)$/i.exec(before);
    if (!match) return null;
    return { term: match[1] ?? "", start: caret - (match[0]?.length ?? 0) };
  }, [query, value, caret]);

  const matches = useMemo(() => {
    if (!active) return [];
    const term = active.term.toLowerCase();
    return characters
      .filter(
        (character) =>
          character.handle.includes(term) ||
          character.name.toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [active, characters]);

  useEffect(() => {
    if (!matches.length) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Tab") return;
      event.preventDefault();
      choose(matches[0]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  const choose = (character: Influencer) => {
    if (!active) return;
    const next = `${value.slice(0, active.start)}@${character.handle} ${value.slice(caret)}`;
    onChange(next);
    onMention?.(character);
    setQuery(null);
    requestAnimationFrame(() => {
      const element = box.current;
      if (!element) return;
      const position = active.start + character.handle.length + 2;
      element.focus();
      element.setSelectionRange(position, position);
    });
  };

  const handleChange = (next: string, position: number) => {
    onChange(next);
    setCaret(position);
    const before = next.slice(0, position);
    const match = /@([a-z0-9_]*)$/i.exec(before);
    setQuery(match ? (match[1] ?? "") : null);
  };

  return (
    <div className="mention-wrap">
      <textarea
        ref={box}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          const position = event.target.selectionStart ?? event.target.value.length;
          handleChange(event.target.value, position);
        }}
        onClick={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
        onBlur={() => window.setTimeout(() => setQuery(null), 160)}
      />
      {active && matches.length > 0 ? (
        <div className="mention-menu">
          {matches.map((character) => (
            <button
              type="button"
              key={character.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(character)}
            >
              <img src={character.image} alt="" />
              <span>
                <strong>@{character.handle}</strong>
                <small>{character.name}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** The characters named by `@handle` mentions in a prompt. */
export const mentionedCharacters = (
  prompt: string,
  characters: Influencer[],
): Influencer[] => {
  const found: Influencer[] = [];
  for (const character of characters) {
    const pattern = new RegExp(`@${character.handle}\\b`, "i");
    if (pattern.test(prompt) && !found.includes(character)) found.push(character);
  }
  return found;
};
