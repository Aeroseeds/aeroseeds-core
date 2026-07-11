"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/farms", label: "Farms" },
  { href: "/scan", label: "Detect" },
  { href: "/scans/unassigned", label: "Unassigned Scans" },
];

export default function NavBar() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <nav className="nav-bar">
      <div className="nav-bar-links">
        {NAV_LINKS.map((link) => {
          const active =
            pathname === link.href ||
            pathname.startsWith(`${link.href}/`) ||
            (link.href === "/scan" && pathname.startsWith("/batch"));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-bar-link${active ? " nav-bar-link-active" : ""}`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
