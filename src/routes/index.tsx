import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, LayoutDashboard, QrCode } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Warmah Kediri — POS & Self-Order QR Meja" },
      { name: "description", content: "Sistem kasir dan pemesanan mandiri lewat QR meja untuk Warmah Kediri." },
      { property: "og:title", content: "Warmah Kediri — POS & Self-Order QR Meja" },
      { property: "og:description", content: "Sistem kasir dan pemesanan mandiri lewat QR meja untuk Warmah Kediri." },
    ],
  }),
  component: Home,
});

function Home() {
  const cards = [
    { to: "/kasir", icon: ChefHat, title: "Kasir", desc: "POS, restock, dan pesanan meja dengan alarm." },
    { to: "/admin", icon: LayoutDashboard, title: "Admin", desc: "Laba/rugi, filter tanggal, produk, QR meja." },
    { to: "/meja/$no", icon: QrCode, title: "Contoh Menu Meja 1", desc: "Tampilan pelanggan setelah scan QR." },
  ] as const;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Warung Makan · Kediri</p>
      <h1 className="mt-2 text-center font-display text-5xl font-extrabold">Warmah<span className="text-primary">.</span></h1>
      <p className="mt-3 max-w-md text-center text-muted-foreground">Kasir & self-order QR meja dalam satu tempat.</p>
      <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {cards.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to} params={{ no: "1" }} className="group rounded-2xl border bg-card p-6 transition hover:-translate-y-1 hover:border-primary">
            <Icon className="h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-lg font-bold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
