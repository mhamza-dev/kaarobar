import Hero from "@/components/landing/Hero";
import TrustedBy from "@/components/landing/TrustedBy";
import ComparisonTable from "@/components/landing/ComparisonTable";
import MobileAppShowcase from "@/components/landing/MobileAppShowcase";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <ComparisonTable />
      <MobileAppShowcase />
      <Pricing />
      <FAQ />
    </>
  );
}
