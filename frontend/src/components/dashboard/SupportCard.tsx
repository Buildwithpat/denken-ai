'use client';

export default function SupportCard() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_0_24px_rgba(135,98,247,0.07)]">
      <h2 className="mb-4 text-sm font-semibold text-white">Need help getting started?</h2>
      <button className="w-full cursor-pointer rounded-md bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] py-2.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90 hover:shadow-[0_4px_16px_rgba(135,98,247,0.3)]">
        Contact Support →
      </button>
    </div>
  );
}
