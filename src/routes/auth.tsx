import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, LockKeyhole, ShieldCheck, Store } from "lucide-react";
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
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
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
    <main className="auth-shell flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[1.7rem] border border-border/70 bg-card shadow-2xl shadow-emerald-950/5 lg:grid-cols-[1fr_.9fr]">
        <aside className="auth-aside relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
          <div className="brand-lockup">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12"><Store className="h-5 w-5" /></span>
            <span><span className="brand-name block text-white">warmahkasir</span><span className="block text-xs text-white/65">Warmah Kediri · POS</span></span>
          </div>
          <div className="relative z-10 py-12">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-emerald-100/80">Ruang kerja kamu</p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-[-.04em]">Kelola usaha dengan lebih tenang.</h1>
            <p className="mt-4 max-w-sm leading-7 text-white/70">Laporan, produk, dan operasional dalam satu dashboard yang dirancang agar mudah dipahami.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70"><ShieldCheck className="h-4 w-4" /> Akses admin terlindungi</div>
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full border border-white/15 shadow-[0_0_0_40px_rgba(255,255,255,.04),0_0_0_80px_rgba(255,255,255,.03)]" />
        </aside>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
          <form onSubmit={submit} className="w-full max-w-sm space-y-6">
            <div className="mb-8 lg:hidden">
              <div className="brand-lockup"><span className="brand-mark"><Store className="h-5 w-5" /></span><span className="brand-name">warmahkasir</span></div>
            </div>
            <div>
              <span className="eyebrow"><LockKeyhole className="h-3.5 w-3.5" /> Area admin</span>
              <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight">Selamat datang.</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Masuk dengan akun admin untuk melanjutkan.</p>
            </div>
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@usaha.com" required className="h-12 rounded-xl" /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Password</Label></div><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" required className="h-12 rounded-xl" /></div>
            <Button className="h-12 w-full rounded-xl text-sm font-bold" disabled={busy}>{busy ? "Memeriksa akun…" : "Masuk ke dashboard"}</Button>
            <p className="text-center text-xs leading-5 text-muted-foreground">Akses hanya untuk pengguna yang memiliki akun dan izin admin.</p>
            <button type="button" onClick={() => navigate({ to: "/" })} className="mx-auto flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Kembali ke beranda</button>
          </form>
        </section>
      </div>
    </main>
  );
}
