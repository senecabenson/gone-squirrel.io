"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useProjectStore } from "@/store/project";

import { Project } from "@/types/project";

interface DeleteProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  taskCount: number;
}

export function DeleteProjectDialog({
  isOpen,
  onClose,
  project,
  taskCount,
}: DeleteProjectDialogProps) {
  const { deleteProject } = useProjectStore();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProject(project.id);
      onClose();
      project.onClose?.();
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>
            <span className="block">
              <strong className="text-ink">{project.name}</strong> will be removed.
            </span>
            <span className="mt-2 block text-[hsl(var(--urgency-soon))]">
              This can&apos;t be undone.
            </span>
            {taskCount > 0 && (
              <span className="mt-2 block text-ink-soft">
                {taskCount} task{taskCount === 1 ? "" : "s"} attached to it will
                go too.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Removing..." : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
