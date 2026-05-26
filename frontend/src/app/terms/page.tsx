"use client";

import Link from "next/link";

function Section({ title, children }: any) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-white/60">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-widest text-[#8762F7]">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Terms & Conditions</h1>
          <p className="mt-2 text-sm text-white/40">
            Last updated: {new Date().getFullYear()}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <Section title="Acceptance of Terms">
            By using DenkenAI, you agree to these terms and conditions.
          </Section>

          <Section title="Use of Platform">
            You agree to use the platform responsibly and not misuse features or
            attempt to disrupt the system.
          </Section>

          <Section title="User Content">
            You retain ownership of your data, but allow DenkenAI to process it
            for improving functionality.
          </Section>

          <Section title="Limitation of Liability">
            DenkenAI is not responsible for exam outcomes or decisions based on
            platform insights.
          </Section>

          <Section title="Changes to Terms">
            We may update these terms as the platform evolves.
          </Section>
        </div>

        {/* Highlight */}
        <div className="mt-10 rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/10 p-5 text-sm text-white/70">
          Use DenkenAI as a guide — your effort is still the key driver of
          success.
        </div>

        {/* Back */}
        <Link
          href="/"
          className="mt-10 inline-block text-[#8762F7] hover:underline"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
