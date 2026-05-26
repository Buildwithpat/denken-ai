import Image from 'next/image';

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 32 }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/DenkenLogo.svg"
        alt="DenkenAI logo"
        width={size}
        height={size}
        priority
      />
      <span className="text-xl font-bold tracking-tight">
        <span className="text-white">Denken</span>
        <span className="text-brand-purple">AI</span>
      </span>
    </div>
  );
}
