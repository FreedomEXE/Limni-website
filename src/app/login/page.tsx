import { redirect } from "next/navigation";
import { isAuthenticated, login } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/");
  }

  async function handleLogin(formData: FormData) {
    "use server";

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    const success = await login(username, password);

    if (success) {
      redirect("/");
    } else {
      redirect("/login?error=invalid");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <LoginForm handleLogin={handleLogin} />
    </div>
  );
}
