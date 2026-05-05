"use client";

import { useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { logger } from "@/lib/logger";

const LOG_SOURCE = "PasswordResetForm";

// Form validation schema
const requestSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RequestFormValues = z.infer<typeof requestSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export function PasswordResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const {
    register: registerRequest,
    handleSubmit: handleSubmitRequest,
    formState: { errors: requestErrors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
  });

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: resetErrors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  const onRequestSubmit = async (data: RequestFormValues) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to request password reset");
      }

      setRequestSent(true);

      toast.success("Password reset email sent", {
        description: "Please check your email for further instructions.",
      });

      // In development, show the reset link
      if (process.env.NODE_ENV === "development" && result.debug) {
        console.log("Debug - Reset URL:", result.debug.resetUrl);
      }
    } catch (error) {
      logger.error(
        "Error requesting password reset",
        { error: error instanceof Error ? error.message : "Unknown error" },
        LOG_SOURCE
      );
      toast.error("Failed to request password reset", {
        description: "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onResetSubmit = async (data: ResetFormValues) => {
    if (!token) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to reset password");
      }

      toast.success("Password reset successful", {
        description: "You can now sign in with your new password.",
      });

      // Redirect to sign in page
      router.push("/auth/signin");
    } catch (error) {
      logger.error(
        "Error resetting password",
        { error: error instanceof Error ? error.message : "Unknown error" },
        LOG_SOURCE
      );
      toast.error("Failed to reset password", {
        description:
          error instanceof Error ? error.message : "Please try again later.",
      });
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

      {token ? (
        /* Reset password form (token present) */
        <>
          <h1 className="mb-1 font-display text-display leading-[1.05] tracking-[-0.018em] text-ink">
            Reset password.
          </h1>
          <p className="mb-8 text-body text-ink-soft">
            Choose a strong new password below.
          </p>

          <form
            onSubmit={handleSubmitReset(onResetSubmit)}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-xs uppercase tracking-wide text-ink-mute"
              >
                New Password
              </label>
              <Input
                id="password"
                type="password"
                {...registerReset("password")}
                className={
                  resetErrors.password
                    ? "border-[hsl(var(--urgency-critical))]"
                    : ""
                }
                disabled={isLoading}
              />
              {resetErrors.password && (
                <p className="text-body-sm text-[hsl(var(--urgency-critical))]">
                  {resetErrors.password.message}
                </p>
              )}
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
                type="password"
                {...registerReset("confirmPassword")}
                className={
                  resetErrors.confirmPassword
                    ? "border-[hsl(var(--urgency-critical))]"
                    : ""
                }
                disabled={isLoading}
              />
              {resetErrors.confirmPassword && (
                <p className="text-body-sm text-[hsl(var(--urgency-critical))]">
                  {resetErrors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Resetting Password..." : "Reset Password"}
            </Button>
          </form>
        </>
      ) : (
        /* Request reset form (no token) */
        <>
          <h1 className="mb-1 font-display text-display leading-[1.05] tracking-[-0.018em] text-ink">
            Reset password.
          </h1>
          <p className="mb-8 text-body text-ink-soft">
            Pop in your email, we&apos;ll send you a link.
          </p>

          {requestSent && (
            <p className="mb-4 text-body-sm text-[hsl(var(--state-complete))]">
              Check your inbox — link is on the way.
            </p>
          )}

          <form
            onSubmit={handleSubmitRequest(onRequestSubmit)}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-xs uppercase tracking-wide text-ink-mute"
              >
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                {...registerRequest("email")}
                className={
                  requestErrors.email
                    ? "border-[hsl(var(--urgency-critical))]"
                    : ""
                }
                disabled={isLoading}
              />
              {requestErrors.email && (
                <p className="text-body-sm text-[hsl(var(--urgency-critical))]">
                  {requestErrors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Sending Reset Link..." : "Send Reset Link"}
            </Button>
          </form>
        </>
      )}

      <div className="mt-6">
        <button
          type="button"
          className="text-body-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          onClick={() => router.push("/auth/signin")}
        >
          Back to Sign in
        </button>
      </div>
    </div>
  );
}
