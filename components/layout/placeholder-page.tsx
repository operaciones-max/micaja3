"use client";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="glass p-6 text-foreground">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-bia-gray-light">Modulo en construccion 🚧</p>
    </section>
  );
}
