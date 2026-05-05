"use client";

import { Badge } from "@/components/ui/badge";

import { format } from "@/lib/date-utils";

import { Task, TaskStatus } from "@/types/task";

interface FocusedTaskProps {
  task: Task | null;
}

function linkifyText(text: string): React.ReactNode[] {
  if (!text) return [text];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const urls = text.match(urlRegex) || [];
  const result: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    result.push(part);
    if (urls[i]) {
      result.push(
        <a
          key={i}
          href={urls[i]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-action underline-offset-4 hover:underline"
        >
          {urls[i]}
        </a>
      );
    }
  });
  return result;
}

export function FocusedTask({ task }: FocusedTaskProps) {
  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-section text-center">
        <p className="font-display text-display-sm leading-tight text-ink">
          Nothing to focus on right now.
        </p>
        <p className="max-w-[44ch] text-body-sm text-ink-soft">
          Pick something from the queue, or capture a new task — you don&apos;t
          have to decide what&apos;s important yet.
        </p>
      </div>
    );
  }

  return (
    <article className="flex h-full flex-col gap-block px-block py-section md:px-section">
      {/* Hero header */}
      <header className="flex flex-col gap-3">
        {task.project && (
          <span className="inline-flex items-center gap-2 text-meta uppercase tracking-wide text-ink-mute">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor:
                  task.project.color || "hsl(var(--text-tertiary))",
              }}
              aria-hidden="true"
            />
            {task.project.name}
          </span>
        )}
        <h1 className="task-title font-display text-display-sm leading-[1.1] tracking-[-0.02em] text-ink md:text-display">
          {task.title}
        </h1>

        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {task.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                style={{
                  backgroundColor: tag.color ? `${tag.color}20` : undefined,
                  color: tag.color,
                  borderColor: tag.color ? `${tag.color}40` : undefined,
                }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {/* Meta block — proximity grouping, no card chrome */}
      <dl className="grid grid-cols-2 gap-x-block gap-y-3 md:grid-cols-3">
        {task.dueDate && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta uppercase tracking-wide text-ink-mute">
              Due
            </dt>
            <dd className="font-mono text-body-sm text-ink">
              {format(task.dueDate, "MMM d")}
            </dd>
          </div>
        )}
        {task.duration && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta uppercase tracking-wide text-ink-mute">
              Estimated
            </dt>
            <dd className="font-mono text-body-sm text-ink">
              {task.duration} min
            </dd>
          </div>
        )}
        {task.energyLevel && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta uppercase tracking-wide text-ink-mute">
              Energy
            </dt>
            <dd className="text-body-sm text-ink capitalize">
              {task.energyLevel.toLowerCase()}
            </dd>
          </div>
        )}
        {task.preferredTime && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta uppercase tracking-wide text-ink-mute">
              Time of day
            </dt>
            <dd className="text-body-sm text-ink capitalize">
              {task.preferredTime.toLowerCase()}
            </dd>
          </div>
        )}
        {task.scheduleScore && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta uppercase tracking-wide text-ink-mute">
              Match
            </dt>
            <dd className="font-mono text-body-sm text-ink">
              {Math.round(task.scheduleScore * 100)}%
            </dd>
          </div>
        )}
        {task.completedAt && task.status === TaskStatus.COMPLETED && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta uppercase tracking-wide text-ink-mute">
              Completed
            </dt>
            <dd className="font-mono text-body-sm text-ink">
              {format(task.completedAt, "MMM d, p")}
            </dd>
          </div>
        )}
        {task.isRecurring && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta uppercase tracking-wide text-ink-mute">
              Cadence
            </dt>
            <dd className="text-body-sm text-ink">Recurring</dd>
          </div>
        )}
      </dl>

      {/* Description — wide text column */}
      {task.description && (
        <section className="flex flex-col gap-2 border-t border-[hsl(var(--border-subtle))] pt-block">
          <h2 className="text-meta uppercase tracking-wide text-ink-mute">
            Notes
          </h2>
          <div className="task-description max-w-[62ch] whitespace-pre-wrap text-body leading-relaxed text-ink-soft">
            {linkifyText(task.description)}
          </div>
        </section>
      )}
    </article>
  );
}
