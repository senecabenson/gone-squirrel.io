type WordmarkTaglineProps = {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

export function WordmarkTagline({
  className,
  style,
  title = "GoneSquirrel.io — caught it.",
}: WordmarkTaglineProps) {
  return (
    <svg
      viewBox="0 0 1620 410"
      role="img"
      aria-label={title}
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>
      <text
        x="810"
        y="220"
        textAnchor="middle"
        fontFamily="var(--font-brand), Nunito, 'Segoe UI', system-ui, sans-serif"
        fontWeight={800}
        fontSize={220}
        letterSpacing={-2}
        fill="currentColor"
      >
        GoneSquirrel<tspan fill="#D97706">.io</tspan>
      </text>
      <text
        x="810"
        y="370"
        textAnchor="middle"
        fontFamily="var(--font-brand), Nunito, 'Segoe UI', system-ui, sans-serif"
        fontWeight={600}
        fontStyle="italic"
        fontSize={96}
        fill="currentColor"
      >
        caught it.
      </text>
    </svg>
  );
}
