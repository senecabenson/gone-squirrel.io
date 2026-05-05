"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { HiCheckCircle } from "react-icons/hi";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useSetupStore } from "@/store/setup";

export function SetupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { setSetupStatus } = useSetupStore();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic validation
    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to set up admin account");
      }

      setSuccess(true);

      // Update the setup store to indicate setup is complete
      setSetupStatus(false);

      // Redirect to home page after a short delay
      setTimeout(() => {
        router.push("/calendar");
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-stretch justify-center">
      {/* Wordmark */}
      <p className="mb-8 text-xs uppercase tracking-wide text-ink-mute">
        GoneSquirrel
      </p>

      <h1 className="mb-1 font-display text-display leading-[1.05] tracking-[-0.018em] text-ink">
        Let&apos;s get you set up.
      </h1>
      <p className="mb-8 text-body text-ink-soft">
        A few quick choices and you&apos;re in.
      </p>

      {/* Error message */}
      {error && (
        <p className="mb-4 text-body-sm text-[hsl(var(--urgency-critical))]">
          {error}
        </p>
      )}

      {/* Success message */}
      {success && (
        <div className="mb-4 flex items-center gap-2 text-body-sm text-[hsl(var(--state-complete))]">
          <HiCheckCircle className="h-4 w-4 shrink-0" />
          <span>
            Admin account created. Redirecting to your calendar&hellip;
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="name"
            className="text-xs uppercase tracking-wide text-ink-mute"
          >
            Name
          </label>
          <Input
            id="name"
            name="name"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange}
            disabled={isLoading || success}
            required
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="email"
            className="text-xs uppercase tracking-wide text-ink-mute"
          >
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="admin@example.com"
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading || success}
            required
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="text-xs uppercase tracking-wide text-ink-mute"
          >
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading || success}
            required
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="text-xs uppercase tracking-wide text-ink-mute"
          >
            Confirm Password
          </label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading || success}
            required
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isLoading || success}
        >
          {isLoading ? "Setting up..." : "Create Admin Account"}
        </Button>
      </form>

      <p className="mt-8 text-body-sm text-ink-mute">
        This will set up the initial admin user and migrate existing data.
      </p>
    </div>
  );
}
