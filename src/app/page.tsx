import { redirect } from "next/navigation";

// Auth wiring happens in the NextAuth task; unconditionally redirecting to /giris for now.
export default function RootPage() {
  redirect("/giris");
}
