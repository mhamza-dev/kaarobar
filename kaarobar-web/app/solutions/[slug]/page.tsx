import { notFound } from "next/navigation";

import SolutionHero from "@/components/solutions/SolutionHero";
import SolutionBody from "@/components/solutions/SolutionBody";
import CTA from "@/components/about/CTA";
import { getSolution, solutions } from "@/lib/solutions";

type SolutionPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return solutions.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({ params }: SolutionPageProps) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return { title: "Solution" };
  return {
    title: `${solution.label} · Kaarobar`,
    description: solution.subhead,
  };
}

export default async function SolutionPage({ params }: SolutionPageProps) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  return (
    <>
      <SolutionHero solution={solution} />
      <SolutionBody solution={solution} />
      <CTA />
    </>
  );
}
