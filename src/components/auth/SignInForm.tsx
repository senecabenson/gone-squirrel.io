"use client";

import { useState } from "react";
import { useEffect } from "react";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { isPublicSignupEnabledClient } from "@/lib/auth/client-public-signup";
import { logger } from "@/lib/logger";

const LOG_SOURCE = "SignInForm";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [publicSignupEnabled, setPublicSignupEnabled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkPublicSignup = async () => {
      try {
        const isEnabled = await isPublicSignupEnabledClient();
        setPublicSignupEnabled(isEnabled);
      } catch (error) {
        logger.error(
          "Failed to check if public signup is enabled",
          { error: error instanceof Error ? error.message : "Unknown error" },
          LOG_SOURCE
        );
      }
    };

    checkPublicSignup();
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Hmm, that didn't match — try again?", {
          description: "Double-check your email and password.",
        });
      } else {
        toast.success("Signed in successfully");

        // The token is set in the background, so we'll redirect after a minimal delay
        // to ensure the token is available for the next request
        setTimeout(() => {
          // Force a hard navigation to ensure the middleware re-evaluates with the new token
          window.location.href = "/calendar";
        }, 100);
      }
    } catch (error) {
      logger.error(
        "Error signing in",
        { error: error instanceof Error ? error.message : "Unknown error" },
        LOG_SOURCE
      );
      toast.error("An error occurred", {
        description: "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error("Registration failed", {
          description: data.error || "Please try again later.",
        });
      } else {
        toast.success("Account created successfully", {
          description: "You can now sign in with your credentials.",
        });
        setActiveTab("signin");
      }
    } catch (error) {
      logger.error(
        "Error signing up",
        { error: error instanceof Error ? error.message : "Unknown error" },
        LOG_SOURCE
      );
      toast.error("An error occurred", {
        description: "Please try again later.",
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

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "signin" | "signup")}
      >
        {/* Tab headers — sign in vs sign up */}
        <TabsList className="mb-8 grid w-full grid-cols-2 bg-surface-sunken">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          {publicSignupEnabled && (
            <TabsTrigger value="signup">Create account</TabsTrigger>
          )}
        </TabsList>

        {/* Sign In tab */}
        <TabsContent value="signin">
          <h1 className="mb-1 font-display text-display leading-[1.05] tracking-[-0.018em] text-ink">
            Welcome back.
          </h1>
          <p className="mb-8 text-body text-ink-soft">
            Sign in to pick up where you left off.
          </p>

          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-xs uppercase tracking-wide text-ink-mute"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="text-body-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              onClick={() => router.push("/auth/reset-password")}
            >
              Forgot password?
            </button>
            {publicSignupEnabled && (
              <button
                type="button"
                className="text-body-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                onClick={() => setActiveTab("signup")}
              >
                Need an account?
              </button>
            )}
          </div>
        </TabsContent>

        {/* Sign Up tab */}
        {publicSignupEnabled && (
          <TabsContent value="signup">
            <h1 className="mb-1 font-display text-display leading-[1.05] tracking-[-0.018em] text-ink">
              Create account.
            </h1>
            <p className="mb-8 text-body text-ink-soft">
              Get started in seconds.
            </p>

            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="signup-name"
                  className="text-xs uppercase tracking-wide text-ink-mute"
                >
                  Name (optional)
                </label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="signup-email"
                  className="text-xs uppercase tracking-wide text-ink-mute"
                >
                  Email
                </label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="signup-password"
                  className="text-xs uppercase tracking-wide text-ink-mute"
                >
                  Password
                </label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <div className="mt-4">
              <button
                type="button"
                className="text-body-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                onClick={() => setActiveTab("signin")}
              >
                Already have an account? Sign in
              </button>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <p className="mt-10 text-body-sm text-ink-mute">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
