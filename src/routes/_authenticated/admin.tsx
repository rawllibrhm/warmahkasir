import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LogOut, Trash2, TrendingUp, Wallet, Receipt, Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getReport, resetRevenue, listProductsAll, upsertProduct } from "@/lib/pos.functions";
import { rp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — Warmah Kediri" },
      { name: "description", content: "Laporan laba rugi, produk, dan QR meja." },
      { property: "og:title", content: "Dashboard Admin — Warmah Kediri" },
      { property: "og:description", content: "Laporan laba rugi, produk, dan QR meja." },
    ],
  }),
  component: AdminPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function logout() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <p className="font-display text-xl font-bold">Warmah<span className="text-primary">.</span>Admin</p>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut className="mr-1 h-4 w-4" />Keluar</Button>
      </header>
      <Tabs defaultValue="laba" className="dashboard-content px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">Ikhtisar usaha</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Pantau penjualan, produk, dan kebutuhan operasional.</p></div><TabsList className="h-11 w-fit rounded-xl bg-secondary p-1"><TabsTrigger className="rounded-lg px-4" value="laba">Laba/Rugi</TabsTrigger><TabsTrigger className="rounded-lg px-4" value="produk">Produk</TabsTrigger><TabsTrigger className="rounded-lg px-4" value="qr">QR Meja</TabsTrigger></TabsList></div>
        <TabsContent value="laba"><Report /></TabsContent>
        <TabsContent value="produk"><Products /></TabsContent>
        <TabsContent value="qr"><TableQr /></TabsContent>
      </Tabs>
    </div>
  );
}

function Report() {
  const report = useServerFn(getReport);
  const reset = useServerFn(resetRevenue);
  const qc = useQueryClient();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const range = { from: new Date(from + "T00:00:00").toISOString(), to: new Date(to + "T23:59:59").toISOString() };
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["report", from, to], queryFn: () => report({ data: range }) });

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const cost = orders.reduce((s, o) => s + o.cost_total, 0);

  async function doReset(all: boolean) {
    try {
      await reset({ data: all ? {} : range });
      toast.success("Data pendapatan dihapus");
      qc.invalidateQueries({ queryKey: ["report"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="text-sm">Dari<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Sampai<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <Button variant="secondary" onClick={() => { setFrom(today()); setTo(today()); }}>Hari ini</Button>
        <div className="ml-auto flex gap-2">
          <ConfirmReset label="Hapus periode ini" desc={`Semua transaksi ${from} s/d ${to} akan dihapus permanen.`} onOk={() => doReset(false)} />
          <ConfirmReset label="Reset semua" desc="SELURUH data pendapatan & laba akan dihapus permanen." onOk={() => doReset(true)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Wallet} label="Pendapatan" value={rp(revenue)} />
        <Stat icon={Coins} label="Modal (HPP)" value={rp(cost)} />
        <Stat icon={TrendingUp} label={revenue - cost >= 0 ? "Laba" : "Rugi"} value={rp(revenue - cost)} accent />
        <Stat icon={Receipt} label="Transaksi" value={String(orders.length)} />
      </div>
      <div className="table-wrap overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">#</th><th>Waktu</th><th>Sumber</th><th>Bayar</th><th className="text-right">Total</th><th className="pr-3 text-right">Laba</th></tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-3" colSpan={6}>Memuat…</td></tr>}
            {!isLoading && !orders.length && <tr><td className="p-3 text-muted-foreground" colSpan={6}>Tidak ada transaksi.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3">{o.order_no}</td>
                <td>{new Date(o.confirmed_at!).toLocaleString("id-ID")}</td>
                <td>{o.source === "pos" ? "Kasir" : `Meja ${o.table_no}`}</td>
                <td className="uppercase">{o.payment_method}</td>
                <td className="text-right">{rp(o.total)}</td>
                <td className="pr-3 text-right">{rp(o.total - o.cost_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfirmReset({ label, desc, onOk }: { label: string; desc: string; onOk: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-1 h-4 w-4" />{label}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Yakin?</AlertDialogTitle><AlertDialogDescription>{desc} Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={onOk}>Hapus</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Wallet; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`stat-card rounded-2xl border p-5 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <Icon className="h-5 w-5 opacity-70" />
      <p className="mt-2 text-sm opacity-80">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

const empty = { name: "", barcode: "", category: "Makanan", price: "", cost: "", stock: "" };

function Products() {
  const fn = useServerFn(listProductsAll);
  const save = useServerFn(upsertProduct);
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products-all"], queryFn: () => fn() });
  const [f, setF] = useState(empty);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save({ data: { name: f.name, barcode: f.barcode, category: f.category, price: +f.price, cost: +f.cost, stock: +f.stock, active: true } });
      setF(empty); toast.success("Produk disimpan");
      qc.invalidateQueries({ queryKey: ["products-all"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function toggle(p: (typeof products)[number]) {
    await save({ data: { id: p.id, name: p.name, barcode: p.barcode ?? "", category: p.category, price: p.price, cost: p.cost, stock: p.stock, active: !p.active } });
    qc.invalidateQueries({ queryKey: ["products-all"] });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-7">
        <Input placeholder="Nama" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Barcode" value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
        <Input placeholder="Kategori" required value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <Input placeholder="Harga jual" type="number" required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <Input placeholder="Modal" type="number" required value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        <Input placeholder="Stok" type="number" required value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
        <Button>Tambah produk</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">Nama</th><th>Kategori</th><th>Harga</th><th>Modal</th><th>Stok</th><th /></tr></thead>
          <tbody>{products.map((p) => (
            <tr key={p.id} className={`border-t ${p.active ? "" : "opacity-50"}`}>
              <td className="p-3">{p.name}</td><td>{p.category}</td><td>{rp(p.price)}</td><td>{rp(p.cost)}</td><td>{p.stock}</td>
              <td className="pr-3 text-right"><Button size="sm" variant="outline" onClick={() => toggle(p)}>{p.active ? "Sembunyikan" : "Tampilkan"}</Button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function TableQr() {
  const [n, setN] = useState(10);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 print:hidden">
        <span className="text-sm">Jumlah meja</span>
        <Input type="number" className="w-24" value={n} onChange={(e) => setN(Math.min(100, Math.max(1, +e.target.value)))} />
        <Button variant="outline" onClick={() => window.print()}>Cetak QR</Button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: n }, (_, i) => String(i + 1)).map((no) => (
          <div key={no} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4">
            <QRCodeSVG value={`${origin}/meja/${no}`} size={130} />
            <p className="font-display text-lg font-bold">Meja {no}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
