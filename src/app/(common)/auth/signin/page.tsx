import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/SignInForm";

import { getAuthOptions } from "@/lib/auth/auth-options";

export const metadata = {
  title: "Sign In | GoneSquirrel",
  description: "Sign in to your GoneSquirrel account",
};

export default async function SignInPage() {
  // Check if user is already signed in
  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/calendar");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <SignInForm />
    </div>
  );
}
