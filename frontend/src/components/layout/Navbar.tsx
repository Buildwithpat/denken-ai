'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Exams", href: "/#exams" },
  { label: "Why DenkenAI?", href: "/#why" },
  { label: "About", href: "/about" },
] as const;

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 bg-[#0B0E14]">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-3">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/DenkenLogo.svg" alt="DenkenAI" width={40} height={40} priority />
          <span className="text-xl font-semibold tracking-tight">
            <span className="text-white">Denken</span>
            <span className="text-[#8762F7]">AI</span>
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <DesktopNavLink key={href} href={href} label={label} />
          ))}
        </nav>

        {/* ── Desktop auth ── */}
        <div className="hidden items-center gap-2 md:flex">
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-[#8762F7] to-[#6B47D4] px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(135,98,247,0.45)] focus-visible:outline-none"
            >
              Log in
            </Link>
          </motion.div>

          <motion.div whileTap={{ scale: 0.97 }}>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-md border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-none"
            >
              Sign up
            </Link>
          </motion.div>
        </div>

        {/* ── Mobile hamburger ── */}
        <motion.button
          className="text-white md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {mobileOpen ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="block"
              >
                <X size={22} />
              </motion.span>
            ) : (
              <motion.span
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="block"
              >
                <Menu size={22} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* ── Mobile dropdown ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-[#0B0E14] md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col px-4 py-6">
              <nav className="flex flex-col gap-4">
                {NAV_LINKS.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm tracking-tight text-white/60 transition-colors hover:text-white"
                    onClick={() => setMobileOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-[#8762F7] to-[#6B47D4] px-4 py-2 text-sm font-medium text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center rounded-md border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign up
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function DesktopNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group relative text-sm tracking-tight text-white/60 transition-colors hover:text-white"
    >
      <motion.span
        whileHover={{ y: -1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="inline-block"
      >
        {label}
      </motion.span>
      <motion.span
        className="absolute -bottom-0.5 left-0 h-px w-full origin-left bg-[#8762F7]"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
    </Link>
  );
}
