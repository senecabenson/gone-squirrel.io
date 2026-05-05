import { redirect } from "next/navigation";

import { SetupForm } from "@/components/setup/SetupForm";

import { checkSetupStatus } from "@/lib/setup-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Setup FluidCalendar",
  description: "Set up your FluidCalendar admin account",
};

export default async function SetupPage() {
  // Check if any users already exist
  const { needsSetup } = await checkSetupStatus();

  // If users already exist, redirect to home page
  if (!needsSetup) {
    redirect("/calendar");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <SetupForm />
    </div>
  );
}
