import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Logo from "@/components/Navbar/Logo";
import BackButton from "@/components/profile/BackButton";
import { HOME_BY_ROLE } from "@/lib/auth/require-role";
import type { UserRole } from "@/lib/db/users";

/** Read-only profiles of other users (companies, institutions, faculty, students). Signed-in users only. */
export default async function ViewLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const home = HOME_BY_ROLE[session.user.role as UserRole] ?? "/";
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-lightgray bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <BackButton fallback={home} />
          <span className="h-5 w-px bg-lightgray" />
          <Logo className="h-7" />
          <Link href={home} className="ml-auto rounded-lg bg-navy px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1f2937]">
            My dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
