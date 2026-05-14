type IconMarkProps = {
  className?: string;
};

export function IconMark({ className }: IconMarkProps) {
  return (
    <img
      src="/brand/svg/icon.svg"
      alt=""
      aria-hidden
      className={className}
    />
  );
}
