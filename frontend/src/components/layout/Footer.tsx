import Link from 'next/link';
import Image from 'next/image';

const NAV = [
  {
    heading: 'Product',
    links: [
      { label: 'Features',     href: '/#custom-exam-section' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pricing',      href: '/#pricing-section' },
      { label: 'Exams',        href: '/#exams' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About',    href: '/about' },
      { label: 'Contact',  href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy',   href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
] as const;

export default function Footer() {
  return (
    <footer className="bg-[#0B0E14] py-16">
      <div className="mx-auto max-w-6xl px-4">

        {/* Top grid */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div>
            <p className="text-lg font-semibold">
              <span className="text-white">Denken</span>
              <span className="text-[#8762F7]">AI</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              DenkenAI is a performance intelligence system that helps students
              prepare smarter with personalized tests and deep analytics.
            </p>
          </div>

          {/* Nav columns */}
          {NAV.map(({ heading, links }) => (
            <div key={heading}>
              <p className="text-sm font-medium text-white">{heading}</p>
              <ul className="mt-4 space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-white/60 transition-colors duration-150 hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider + bottom row */}
        <div className="mt-10 border-t border-white/10 pt-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-sm text-white/50">
              © 2026 DenkenAI. All rights reserved.
            </p>

            <a
              href=""
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 opacity-70 transition-opacity duration-150 hover:opacity-100"
            >
              <span className="text-sm text-white/50">Built by</span>
              <Image
                src="/bwp-logo.svg"
                alt="BuildWithPat"
                width={0}
                height={24}
                style={{ height: '24px', width: 'auto', filter: 'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1234%) hue-rotate(233deg) brightness(98%) contrast(97%)' }}
              />
            </a>

          </div>
        </div>

      </div>
    </footer>
  );
}
