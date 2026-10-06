import { useState } from "react";

const VALUES = [1, 2, 3, 4, 5];

/**
 * The write-side counterpart to StarRating. A radio group rather than a row
 * of buttons, so it's keyboard-navigable and announces as one control.
 */
export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-0.5">
      {VALUES.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={`${v} star${v === 1 ? "" : "s"}`}
          disabled={disabled}
          onClick={() => onChange(v)}
          onMouseEnter={() => setHovered(v)}
          onMouseLeave={() => setHovered(0)}
          onFocus={() => setHovered(v)}
          onBlur={() => setHovered(0)}
          className={`text-2xl leading-none transition-colors disabled:cursor-not-allowed ${
            v <= shown ? "text-accent-dark" : "text-gray-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
