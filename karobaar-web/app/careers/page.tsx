import Link from "@/components/ui/Link";
import { routes } from "@/lib/navigation";

export default function CareersPage() {
  return (
    <section className="bg-bg-primary py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">
          Careers
        </p>
        <h1 className="mt-3 text-4xl font-bold text-heading md:text-5xl">
          Build the future with Kaarobar
        </h1>
        <p className="mt-5 text-lg leading-8 text-body">
          We&apos;re growing our team. Reach out if you want to help shape the
          next generation of business software.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link href={routes.contact} size="lg">
            Contact Us
          </Link>
          <Link href={routes.about} variant="outline" size="lg">
            About Kaarobar
          </Link>
        </div>
      </div>
    </section>
  );
}
