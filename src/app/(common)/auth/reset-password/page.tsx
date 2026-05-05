import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export const metadata = {
  title: "Reset Password - FluidCalendar",
  description: "Reset your FluidCalendar account password",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <PasswordResetForm />
    </div>
  );
}
