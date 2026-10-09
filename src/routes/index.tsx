import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ChefHat, LayoutDashboard, QrCode, ShieldCheck, Sparkles, Store } from "lucide-react";

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
    { to: "/kasir", icon: ChefHat, title: "Mulai Kasir", desc: "Kelola transaksi, pesanan meja, dan stok dari satu layar.", tag: "Operasional" },
    { to: "/admin", icon: LayoutDashboard, title: "Dashboard Admin", desc: "Pantau performa, laporan laba-rugi, produk, dan QR meja.", tag: "Manajemen" },
    { to: "/meja/$no", icon: QrCode, title: "Menu Pelanggan", desc: "Lihat pengalaman pemesanan mandiri melalui QR meja.", tag: "Self-order" },
  ] as const;

  return (
    <main className="app-shell min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-10 flex items-center justify-between px-1">
          <Link to="/" className="brand-lockup" aria-label="Warmahkasir beranda">
            <span className="brand-mark"><Store className="h-5 w-5" /></span>
            <span><span className="brand-name block">warmah<span className="text-primary">kasir</span></span><span className="block text-xs text-muted-foreground">POS · Kediri</span></span>
          </Link>
          <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Sistem operasional
          </div>
        </header>

        <section className="home-hero px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          <div className="relative z-10 max-w-3xl">
            <span className="eyebrow"><Sparkles className="h-3.5 w-3.5" /> Sistem kasir terpadu</span>
            <h1 className="mt-6 max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-7xl">
              Operasional lebih rapi. <span className="text-primary">Bisnis lebih fokus.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Semua yang dibutuhkan Warmah dalam satu tempat — dari transaksi kasir sampai pesanan meja dan laporan usaha.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/kasir" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 hover:bg-primary/90">
                Buka kasir <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link to="/admin" className="inline-flex h-12 items-center gap-2 rounded-xl border bg-card px-5 text-sm font-bold hover:border-primary">
                Dashboard admin
              </Link>
            </div>
          </div>
          <div className="relative z-10 mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-emerald-900/10 pt-5 text-sm font-medium text-muted-foreground sm:mt-14">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Alur kerja terpadu</span>
            <span className="inline-flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" /> Pesan lewat QR meja</span>
            <span className="inline-flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-primary" /> Ringkasan penjualan</span>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4 px-1">
            <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">Ruang kerja</p><h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Apa yang ingin kamu lakukan?</h2></div>
            <span className="hidden text-sm text-muted-foreground sm:block">Pilih modul untuk melanjutkan</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {cards.map(({ to, icon: Icon, title, desc, tag }) => (
              <Link key={to} to={to} params={{ no: "1" }} className="feature-card group">
                <div className="flex items-start justify-between gap-3"><span className="feature-icon"><Icon className="h-6 w-6" /></span><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground">{tag}</span></div>
                <h3 className="mt-6 font-display text-xl font-bold tracking-tight">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{desc}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary">Buka modul <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-2 border-t border-border/70 px-1 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Warmah Kediri</span>
          <span>Dibuat untuk pengalaman kerja yang sederhana dan jelas.</span>
        </footer>
      </div>
    </main>
  );
}
