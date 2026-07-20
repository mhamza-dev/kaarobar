import Newsletter from "@/components/blog/Newsletter";

export default function BlogPage() {
  return (
    <section className="bg-bg-primary py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">
          Blog
        </p>
        <h1 className="mt-3 text-4xl font-bold text-heading md:text-5xl">
          Notes from the Kaarobar team
        </h1>
        <p className="mt-4 text-lg text-body">
          We’re still writing the first posts. Leave your email if you want to
          know when they’re up.
        </p>
      </div>
      <Newsletter />
    </section>
  );
}
