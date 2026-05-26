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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-widest text-[#8762F7]">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Privacy Policy</h1>
          <p className="mt-2 text-sm text-white/40">
            Last updated: {new Date().getFullYear()}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <Section title="Introduction">
            DenkenAI respects your privacy. This policy explains what data we
            collect and how it is used to improve your learning experience.
          </Section>

          <Section title="Information We Collect">
            <ul className="space-y-2">
              <li>• Account information (name, email)</li>
              <li>• Exam preferences and settings</li>
              <li>• Test performance and usage data</li>
            </ul>
          </Section>

          <Section title="How We Use Your Data">
            We use your data to personalize tests, provide insights, improve
            accuracy of recommendations, and enhance your overall experience.
          </Section>

          <Section title="Data Security">
            We implement reasonable safeguards to protect your data, but no
            system is completely secure.
          </Section>

          <Section title="Your Rights">
            You may request data deletion or modification at any time.
          </Section>
        </div>

        {/* Highlight */}
        <div className="mt-10 rounded-xl border border-[#8762F7]/20 bg-[#8762F7]/10 p-5 text-sm text-white/70">
          Your data is used to improve your preparation — not to exploit it.
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
