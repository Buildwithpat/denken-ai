"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MobileRestricted({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    setMounted(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!mounted) return null;

  if (isMobile) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0B0E14] px-6 text-center">
        <div className="max-w-sm rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
          <Monitor className="mx-auto mb-4 text-[#8762F7]" size={32} />
          <h2 className="text-lg font-semibold text-white">Desktop Required</h2>
          <p className="mt-2 text-sm text-white/60">
            Use desktop to access this feature
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 w-full rounded-lg bg-[#8762F7] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#7652e6] transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
