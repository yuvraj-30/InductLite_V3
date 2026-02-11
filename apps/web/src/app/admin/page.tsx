import { requireAuthPageReadOnly } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminIndexPage() {
  const user = await requireAuthPageReadOnly();
  redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/admin/sites");
  return null;
}
