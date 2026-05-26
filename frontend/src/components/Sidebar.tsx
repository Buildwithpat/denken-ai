"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  RefreshCcw,
  BarChart3,
  Target,
  Sparkles,
  Route,
  Brain,
  LogOut,
  User,
  X,
  Settings,
} from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { clearAuth } from "@/lib/auth";
import { useEffect, useState } from "react";

const BASE_NAV = [
  { label: "Dashboard",    href: "/dashboard",    icon: LayoutDashboard },
  { label: "Tests",        href: "/tests",        icon: ClipboardList   },
  { label: "Revision",     href: "/revision",     icon: RefreshCcw      },
  { label: "Analysis",     href: "/analysis",     icon: BarChart3       },
  { label: "Focus Areas",  href: "/focus",        icon: Target          },
  { label: "Roadmap",      href: "/roadmap",      icon: Route           },
  { label: "AI Mentor",    href: "/mentor",       icon: Brain           },
  { label: "DenkenStudio", href: "/denkenstudio", icon: Sparkles        },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, reset } = useOnboarding();
  const { isOpen, close } = useSidebar();
  const { logout } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  function confirmLogout() {
    clearAuth(); // direct call — no context indirection, synchronously wipes localStorage
    logout();    // sync AuthContext React state (isAuthenticated → false)
    reset();     // sync OnboardingContext React state
    window.location.replace('/');
  }

  const EXAM_LABELS: Record<string, string> = {
    jee: "JEE Main + Advanced",
    neet: "NEET",
    cbse: "CBSE Boards",
  };

  const examLabel = data.examType
    ? data.examType === "custom"
      ? data.examName || "Custom Exam"
      : EXAM_LABELS[data.examType]
    : null;

  const showExamMode = data.examType === "jee" || data.examType === "neet";

  const NAV = showExamMode
    ? [
        BASE_NAV[0],
        BASE_NAV[1],
        { label: "Exam Mode", href: "/exam", icon: GraduationCap },
        ...BASE_NAV.slice(2),
      ]
    : BASE_NAV;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
      />

      {/* Sidebar */}
      <aside
        className={`flex h-screen w-64 flex-col border-r border-white/[0.07] bg-[#0B0E14]
        fixed top-0 left-0 z-50 transition-transform duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:static lg:translate-x-0`}
      >
        {/* 🔥 HEADER */}
        <div className="border-b border-white/[0.06] px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/DenkenLogo.svg"
                alt="DenkenAI"
                width={28}
                height={28}
              />
              <span className="text-base font-semibold tracking-tight">
                <span className="text-white">Denken</span>
                <span className="text-[#8762F7]">AI</span>
              </span>
            </Link>

            <button
              onClick={close}
              className="lg:hidden cursor-pointer rounded-lg p-1.5 text-white/40 hover:bg-white/[0.05] hover:text-white/70"
            >
              <X size={17} />
            </button>
          </div>

          {/* Capsule */}
          {examLabel && (
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full bg-[#8762F7]/15 px-3 py-1 text-xs text-[#8762F7]">
                {examLabel}
              </span>
            </div>
          )}
        </div>

        {/* 🔥 NAV */}
        <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={close}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[14px] font-medium transition-all
                ${
                  active
                    ? "bg-[#8762F7]/20 text-white shadow-[0_0_10px_rgba(135,98,247,0.15)]"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                <Icon size={17} className={active ? "text-[#8762F7]" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* 🔥 PROFILE */}
        <div className="border-t border-white/[0.06] p-3 space-y-1">
          {/* Profile link — navigates to /profile, highlights when active */}
          <Link
            href="/profile"
            onClick={close}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
              pathname === '/profile'
                ? 'bg-[#8762F7]/20 shadow-[0_0_10px_rgba(135,98,247,0.15)]'
                : 'hover:bg-white/[0.04]'
            }`}
          >
            <div className="relative h-7 w-7 shrink-0 rounded-full overflow-hidden border border-white/10 bg-white/5">
              {data.avatar ? (
                <Image
                  src={`/avatars/${data.avatar}.svg`}
                  alt="avatar"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User size={13} className="text-white/25" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${pathname === '/profile' ? 'text-white' : 'text-white/75'}`}>
                {data.name || "Student"}
              </p>
              <p className="truncate text-[11px] text-white/35">
                {data.email || "—"}
              </p>
            </div>
            <Settings
              size={13}
              className={pathname === '/profile' ? 'text-[#8762F7] shrink-0' : 'text-white/20 shrink-0'}
            />
          </Link>

          <button
            onClick={() => setShowLogoutDialog(true)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/40 hover:bg-white/[0.04] hover:text-white/70 transition"
          >
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </aside>

      {/* Logout confirmation modal */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xs rounded-xl border border-white/10 bg-[#0F1219] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Log out?</h3>
            <p className="mt-1.5 text-sm text-white/50">Are you sure you want to logout?</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={confirmLogout}
                className="flex-1 cursor-pointer rounded-lg bg-[#8762F7] py-2.5 text-sm font-medium text-white hover:bg-[#7652e6] transition"
              >
                Yes
              </button>
              <button
                onClick={() => setShowLogoutDialog(false)}
                className="flex-1 cursor-pointer rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 transition"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
