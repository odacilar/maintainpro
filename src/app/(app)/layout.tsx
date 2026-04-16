import { AppShell } from "@/components/shell/app-shell";

// Auth guard is handled client-side in AppShell via useSession.
// Server-side auth() wiring will be added by the NextAuth task (@/lib/auth).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
