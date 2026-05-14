import { cn } from "@/lib/utils";

type SquirrelProps = {
  className?: string;
  style?: React.CSSProperties;
};

export function Squirrel({ className, style }: SquirrelProps) {
  return (
    <>
      <img
        src="/brand/svg/squirrel.svg"
        alt=""
        aria-hidden
        className={cn("block dark:hidden", className)}
        style={style}
      />
      <img
        src="/brand/svg/squirrel-dark.svg"
        alt=""
        aria-hidden
        className={cn("hidden dark:block", className)}
        style={style}
      />
    </>
  );
}
