import React, { useId } from 'react';

export const NewShapeLogo: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const uid = useId().replace(/:/g, '');
  const aboveId = `ns-above-${uid}`;
  const belowId = `ns-below-${uid}`;

  return (
    <div
      className="inline-flex items-center select-none"
      role="img"
      aria-label="New Shape"
    >
      <svg
        viewBox="0 0 212 90"
        className={`overflow-visible ${compact ? 'h-10 w-auto' : 'h-16 sm:h-[72px] w-auto'}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id={aboveId}>
            <polygon points="-10,-10 222,-10 222,52.5 -10,61" />
          </clipPath>
          <clipPath id={belowId}>
            <polygon points="-10,61 222,52.5 222,105 -10,105" />
          </clipPath>
        </defs>

        {/* Top "new" */}
        <text
          x="6"
          y="23"
          fontFamily="'Playfair Display', Georgia, serif"
          fontWeight="800"
          fontSize="26"
          letterSpacing="-0.4"
          fill="#FACC15"
        >
          new
        </text>

        {/* Bottom "shape": solid gold above the diagonal cut line */}
        <text
          x="4"
          y="70"
          fontFamily="'Playfair Display', Georgia, serif"
          fontWeight="900"
          fontSize="60"
          letterSpacing="-2.4"
          fill="#FACC15"
          clipPath={`url(#${aboveId})`}
        >
          shape
        </text>

        {/* Bottom "shape": hollow gold outline below the diagonal cut line */}
        <text
          x="4"
          y="70"
          fontFamily="'Playfair Display', Georgia, serif"
          fontWeight="900"
          fontSize="60"
          letterSpacing="-2.4"
          fill="none"
          stroke="#FACC15"
          strokeWidth="1.9"
          strokeLinejoin="round"
          clipPath={`url(#${belowId})`}
        >
          shape
        </text>

        {/* Signature tilted diagonal cut line */}
        <line
          x1="1"
          y1="60.5"
          x2="188"
          y2="53.8"
          stroke="#FACC15"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
