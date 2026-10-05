import AdminShell from "@/components/admin/AdminShell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
