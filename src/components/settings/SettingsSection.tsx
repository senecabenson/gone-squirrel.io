interface SettingsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

interface SettingRowProps {
  label: string;
  description: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-block">
      <header className="flex flex-col gap-1.5">
        <h2 className="font-display text-display-sm leading-tight tracking-[-0.014em] text-ink">
          {title}
        </h2>
        <p className="max-w-[62ch] text-body-sm text-ink-soft">{description}</p>
      </header>
      <div className="flex flex-col gap-block border-t border-[hsl(var(--border-subtle))] pt-block">
        {children}
      </div>
    </section>
  );
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-block">
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-body-sm font-medium text-ink">{label}</span>
        <span className="text-body-sm text-ink-soft">{description}</span>
      </div>
      <div className="flex w-full md:max-w-xs md:flex-1">{children}</div>
    </div>
  );
}
