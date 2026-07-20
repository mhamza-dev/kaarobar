import Hero from "@/components/landing/Hero";
import TrustedBy from "@/components/landing/TrustedBy";
import Modules from "@/components/landing/Modules";
import ComparisonTable from "@/components/landing/ComparisonTable";
import MobileAppShowcase from "@/components/landing/MobileAppShowcase";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import HomeAuthRedirect from "@/components/auth/HomeAuthRedirect";

export default function Home() {
  return (
    <>
      <HomeAuthRedirect />
      <Hero />
      <TrustedBy />
      <Modules />
      <ComparisonTable />
      <MobileAppShowcase />
      <Pricing />
      <FAQ />
    </>
  );
}
