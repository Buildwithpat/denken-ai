"use client";

import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-white px-4 py-20">
      <div className="mx-auto max-w-2xl">
        {/* Title */}
        <h1 className="text-3xl font-semibold">Contact</h1>
        <p className="mt-2 text-white/50">
          Have feedback, questions, or ideas? I’d love to hear from you.
        </p>

        {/* Contact Cards */}
        <div className="mt-10 space-y-4">
          {/* Email */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <Mail className="text-[#8762F7]" size={18} />
              <p className="text-sm font-medium">Email</p>
            </div>

            <p className="mt-2 text-sm text-white/60">
              Reach out directly via email for any queries or feedback.
            </p>

            <a
              href="mailto:aakashbwp@example.com"
              className="mt-3 inline-block text-sm text-[#8762F7] hover:underline"
            >
              aakashbwp@example.com
            </a>
          </div>

          {/* LinkedIn */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <MessageCircle className="text-[#8762F7]" size={18} />
              <p className="text-sm font-medium">LinkedIn</p>
            </div>

            <p className="mt-2 text-sm text-white/60">
              Connect with me or drop a message on LinkedIn.
            </p>

            <a
              href="https://www.linkedin.com/in/aakash-pathak-7aa151304/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-[#8762F7] hover:underline"
            >
              View Profile
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-sm text-white/40">
          Prefer exploring first?{" "}
          <Link href="/" className="text-[#8762F7] hover:underline">
            Go back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
