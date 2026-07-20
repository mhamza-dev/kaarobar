"use client";

import { Mail, Phone, User, Building2, MessageSquare } from "lucide-react";
import type { FormikHelpers } from "formik";

import Button from "@/components/ui/Button";
import CustomForm from "@/components/ui/CustomForm";
import Input from "@/components/ui/Input";

interface ContactFormValues {
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
}

export default function ContactForm() {
  const initialValues: ContactFormValues = {
    name: "",
    email: "",
    phone: "",
    company: "",
    subject: "",
    message: "",
  };

  const handleSubmit = async (
    values: ContactFormValues,
    { setSubmitting, resetForm }: FormikHelpers<ContactFormValues>,
  ) => {
    console.log(values);

    // TODO: Call your API here

    resetForm();
    setSubmitting(false);
  };

  return (
    <section id="contact-form" className="bg-bg-primary py-28">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-5">
        {/* Left */}

        <div className="lg:col-span-2">
          <span className="rounded-md bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Write to us
          </span>

          <h2 className="mt-6 text-5xl font-bold text-heading">
            Send a message
          </h2>

          <p className="mt-6 leading-8 text-body">
            Fill this in and we’ll get back to you. Demos, setup questions,
            pricing—whatever you need.
          </p>
        </div>

        {/* Right */}

        <div className="rounded-md border border-border bg-card p-8 shadow-lg lg:col-span-3">
          <CustomForm<ContactFormValues>
            initialValues={initialValues}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting }) => (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <Input
                    type="text"
                    name="name"
                    label="Full Name"
                    placeholder="John Doe"
                    leftIcon={<User size={18} />}
                  />

                  <Input
                    type="email"
                    name="email"
                    label="Email"
                    placeholder="john@example.com"
                    leftIcon={<Mail size={18} />}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Input
                    type="tel"
                    name="phone"
                    label="Phone"
                    placeholder="+92..."
                    leftIcon={<Phone size={18} />}
                  />

                  <Input
                    type="text"
                    name="company"
                    label="Company"
                    placeholder="Company Name"
                    leftIcon={<Building2 size={18} />}
                  />
                </div>

                <Input
                  type="text"
                  name="subject"
                  label="Subject"
                  placeholder="How can we help?"
                  leftIcon={<MessageSquare size={18} />}
                />

                <Input
                  type="textarea"
                  name="message"
                  label="Message"
                  rows={6}
                  placeholder="What’s going on? How can we help?"
                />

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={isSubmitting}
                >
                  Send Message
                </Button>
              </>
            )}
          </CustomForm>
        </div>
      </div>
    </section>
  );
}
