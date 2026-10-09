import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login Admin — Warmah Kediri" },
      { name: "description", content: "Masuk ke dashboard admin Warmah Kediri." },
      { property: "og:title", content: "Login Admin — Warmah Kediri" },
      { property: "og:description", content: "Masuk ke dashboard admin Warmah Kediri." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Email atau password salah");
        return;
      }
      await navigate({ to: "/admin", replace: true });
    } catch {
      toast.error("Tidak dapat masuk. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f7f4] p-3 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-teal-100/70 blur-3xl" />

      <div className="relative grid min-h-[min(760px,calc(100vh-3rem))] w-full max-w-[1180px] overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_32px_100px_rgba(15,45,32,0.13)] lg:grid-cols-[1.04fr_.96fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#102c24] p-9 text-white sm:p-12 lg:flex xl:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.22) 1px, transparent 0)", backgroundSize: "26px 26px" }} />
          <div className="pointer-events-none absolute -right-36 -top-32 h-[34rem] w-[34rem] rounded-full border border-emerald-100/10 shadow-[0_0_0_42px_rgba(255,255,255,.025),0_0_0_84px_rgba(255,255,255,.02)]" />
          <div className="pointer-events-none absolute bottom-[-12rem] left-[-8rem] h-[27rem] w-[27rem] rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative z-10 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-lg shadow-black/10">
              <Store className="h-6 w-6 text-emerald-200" />
            </span>
            <span>
              <span className="block font-display text-xl font-extrabold tracking-[-.05em]">warmah<span className="text-emerald-300">kasir</span></span>
              <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[.18em] text-white/50">Warmah Kediri · Admin</span>
            </span>
          </div>

          <div className="relative z-10 my-10 max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-100/10 px-3.5 py-2 text-xs font-semibold text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" /> Pusat kendali operasional
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-[-.055em] xl:text-[3.35rem]">
              Bisnis tertata.
              <span className="mt-1 block text-emerald-300">Keputusan lebih yakin.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/65 xl:text-base">
              Satu ruang kerja untuk memantau penjualan, mengatur menu, dan menjaga operasional Warmah tetap berjalan rapi.
            </p>

            <div className="mt-9 max-w-md rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-white/55">Panel operasional</p>
                  <p className="mt-1 text-sm font-bold">Semua modul dalam kendali</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/15 text-emerald-200"><TrendingUp className="h-5 w-5" /></span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: "Transaksi", value: "Kasir" },
                  { label: "Katalog", value: "Menu" },
                  { label: "Ringkasan", value: "Laporan" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                    <p className="text-[10px] text-white/45">{item.label}</p>
                    <p className="mt-1 text-sm font-bold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-emerald-100/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Sistem siap digunakan setelah Anda masuk
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-white/55">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Akses admin terlindungi</span>
            <span>© {new Date().getFullYear()} Warmah Kediri</span>
          </div>
        </aside>

        <section className="relative flex items-center justify-center px-5 py-8 sm:px-10 sm:py-12 lg:px-12 xl:px-16">
          <div className="w-full max-w-[390px]">
            <div className="mb-9 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#123b2d] text-white shadow-lg shadow-emerald-950/15"><Store className="h-5 w-5" /></span>
                <span>
                  <span className="block font-display text-lg font-extrabold tracking-[-.05em] text-slate-900">warmah<span className="text-emerald-700">kasir</span></span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Warmah Kediri</span>
                </span>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-800"><ShieldCheck className="h-4 w-4" /></span>
            </div>

            <div className="mb-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.13em] text-emerald-800">
                <Fingerprint className="h-3.5 w-3.5" /> Login administrator
              </div>
              <h2 className="font-display text-3xl font-extrabold tracking-[-.055em] text-slate-900 sm:text-[2.5rem]">Selamat datang.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">Masuk untuk membuka ruang kerja admin Warmah.</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-slate-700">Email admin</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@usaha.com"
                  required
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/70 px-4 text-sm shadow-none placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/15"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-700">Password</Label>
                  <span className="text-[11px] font-medium text-slate-400">Rahasia akun Anda</span>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    required
                    className="h-12 rounded-xl border-slate-200 bg-slate-50/70 px-4 pr-12 text-sm shadow-none placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-slate-400 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="group h-12 w-full rounded-xl bg-[#14513b] text-sm font-bold text-white shadow-lg shadow-emerald-950/10 hover:bg-[#103e2e]" disabled={busy}>
                {busy ? "Memeriksa akun…" : <span className="flex items-center justify-center gap-2">Masuk ke dashboard <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>}
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-emerald-800 shadow-sm"><LockKeyhole className="h-3.5 w-3.5" /></span>
              <p className="text-[11px] leading-5 text-slate-500">Area terbatas. Hanya akun yang terdaftar dan memiliki izin admin yang dapat masuk.</p>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="mx-auto mt-7 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
