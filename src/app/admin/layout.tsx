import type { ReactNode } from "react";

export const metadata = {
  title: "Usage — administrator",
  robots: "noindex, nofollow",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
