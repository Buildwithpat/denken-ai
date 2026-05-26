import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/sections/HeroSection';
import ProblemsSection from '@/components/sections/ProblemsSection';
import WhySection from '@/components/sections/WhySection';
import ExamsSection from '@/components/sections/ExamsSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import CustomExamSection from '@/components/sections/CustomExamSection';
import PricingSection from '@/components/sections/PricingSection';
import DenBotWidget from '@/components/DenBotWidget';
import { OnboardingProvider } from "@/context/OnboardingContext";
import DashboardPreview from "@/components/landing/DashboardPreview";

export default function LandingPage() {
  return (
    <OnboardingProvider>
      <div className="bg-[#0B0E14]">
        <Navbar />
        <main>
          <HeroSection />
          <ProblemsSection />
          <WhySection />
          <ExamsSection />
          <HowItWorksSection />
          <CustomExamSection />
          <PricingSection />
        </main>
        <Footer />
        <DenBotWidget />
      </div>
    </OnboardingProvider>
  );
}
