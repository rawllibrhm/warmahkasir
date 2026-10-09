import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LogOut, Trash2, TrendingUp, Wallet, Receipt, Coins, Pencil, Plus, ShieldCheck, Search, MessageSquare, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getReport, resetRevenue, listProductsAll, upsertProduct, deleteProduct, listPosTables, addPosTable, deletePosTable, getPosSettings, setCashierAddProductEnabled, getAdminPermissions, sendCashierMessage, listCustomerFeedback, setCashierWhatsappNumber, listCashierMessageReplies } from "@/lib/pos.functions";
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
  const fetchPermissions = useServerFn(getAdminPermissions);
  const { data: permissions } = useQuery({ queryKey: ["admin-permissions"], queryFn: () => fetchPermissions() });
  async function logout() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="app-header sticky top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="brand-lockup"><span className="brand-mark"><TrendingUp className="h-5 w-5" /></span><span><span className="brand-name block">warmah<span className="text-primary">kasir</span></span><span className="block text-xs text-muted-foreground">Dashboard admin</span></span></div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={logout}><LogOut className="mr-1 h-4 w-4" />Keluar</Button>
      </header>
      <Tabs defaultValue="laba" className="dashboard-content px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">Ikhtisar usaha</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Pantau penjualan, produk, dan kebutuhan operasional.</p></div><TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-secondary p-1 sm:w-fit"><TabsTrigger className="min-w-0 flex-1 rounded-lg px-2 text-xs sm:flex-none sm:px-4 sm:text-sm" value="laba">Laba/Rugi</TabsTrigger><TabsTrigger className="min-w-0 flex-1 rounded-lg px-2 text-xs sm:flex-none sm:px-4 sm:text-sm" value="produk">Produk</TabsTrigger><TabsTrigger className="min-w-0 flex-1 rounded-lg px-2 text-xs sm:flex-none sm:px-4 sm:text-sm" value="qr">Meja & QR</TabsTrigger>{permissions?.isSuperAdmin && <TabsTrigger className="min-w-0 flex-1 rounded-lg px-2 text-xs sm:flex-none sm:px-4 sm:text-sm" value="messages">Pesan Kasir</TabsTrigger>}{permissions?.isAdmin && <TabsTrigger className="min-w-0 flex-1 rounded-lg px-2 text-xs sm:flex-none sm:px-4 sm:text-sm" value="cashier-settings">Pengaturan Kasir</TabsTrigger>}</TabsList></div>
        <TabsContent value="laba"><Report /></TabsContent>
        <TabsContent value="produk"><Products /></TabsContent>
        <TabsContent value="qr"><TableQr /></TabsContent>
        {permissions?.isSuperAdmin && <TabsContent value="messages"><CashierMessagePanel /></TabsContent>}
        {permissions?.isAdmin && <TabsContent value="cashier-settings"><CashierSettingsPanel canManage={permissions.isSuperAdmin} /></TabsContent>}
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

  function downloadPdf() {
    const htmlEntities: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
    const rows = orders.map((o) => {
      const profit = o.total - o.cost_total;
      return `<tr>
        <td>${escape(String(o.order_no))}</td>
        <td>${escape(new Date(o.confirmed_at!).toLocaleString("id-ID"))}</td>
        <td>${o.source === "pos" ? "Kasir" : "Meja " + escape(String(o.table_no))}</td>
        <td>${escape(o.payment_method.toUpperCase())}</td>
        <td class="num">${escape(rp(o.total))}</td>
        <td class="num">${escape(rp(o.cost_total))}</td>
        <td class="num">${escape(rp(profit))}</td>
      </tr>`;
    }).join("");
    const w = window.open("", "_blank", "width=1000,height=750");
    if (!w) {
      toast.error("Izinkan pop-up browser untuk menyimpan laporan sebagai PDF.");
      return;
    }
    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <title>Laporan Laba Rugi Warmah Kediri</title>
      <style>
        body{font:12px Arial,sans-serif;color:#111;padding:28px}
        h1{margin:0 0 6px;font-size:22px}.muted{color:#555}
        .summary{display:flex;flex-wrap:wrap;gap:22px;margin:18px 0;padding:14px;background:#f2f2f2}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background:#eee}.num{text-align:right;white-space:nowrap}
        tfoot td{font-weight:bold;background:#f7f7f7}
        @media print{body{padding:0}@page{size:landscape;margin:12mm}}
      </style></head><body>
      <h1>Warmah Kediri — Laporan Laba/Rugi</h1>
      <p class="muted">Periode ${escape(from)} sampai ${escape(to)} · Dicetak ${escape(new Date().toLocaleString("id-ID"))}</p>
      <div class="summary">
        <span>Pendapatan: <b>${escape(rp(revenue))}</b></span>
        <span>Modal (HPP): <b>${escape(rp(cost))}</b></span>
        <span>${revenue - cost >= 0 ? "Laba" : "Rugi"}: <b>${escape(rp(revenue - cost))}</b></span>
        <span>Transaksi: <b>${orders.length}</b></span>
      </div>
      <table><thead><tr><th>No. transaksi</th><th>Waktu</th><th>Sumber</th><th>Pembayaran</th><th class="num">Pendapatan</th><th class="num">HPP</th><th class="num">Laba/Rugi</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">Tidak ada transaksi pada periode ini.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="4">TOTAL</td><td class="num">${escape(rp(revenue))}</td><td class="num">${escape(rp(cost))}</td><td class="num">${escape(rp(revenue - cost))}</td></tr></tfoot></table>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  async function doReset(all: boolean) {
    try {
      await reset({ data: all ? {} : range });
      toast.success("Data pendapatan dihapus");
      qc.invalidateQueries({ queryKey: ["report"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4">
        <label className="text-sm">Dari<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Sampai<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <Button variant="secondary" onClick={() => { setFrom(today()); setTo(today()); }}>Hari ini</Button>
        <Button variant="outline" disabled={isLoading} onClick={downloadPdf}><Download className="mr-2 h-4 w-4" />Cetak / Simpan PDF</Button>
        <div className="grid grid-cols-1 gap-2 sm:ml-auto sm:flex sm:flex-wrap">
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
      <div className="space-y-3 sm:hidden">
        {isLoading && <p className="rounded-xl border p-4 text-sm text-muted-foreground">Memuat transaksi…</p>}
        {!isLoading && !orders.length && <p className="rounded-xl border p-5 text-center text-sm text-muted-foreground">Tidak ada transaksi.</p>}
        {orders.map((o) => (
          <article key={o.id} className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Transaksi #{o.order_no}</p><p className="text-xs text-muted-foreground">{new Date(o.confirmed_at!).toLocaleString("id-ID")}</p></div><span className="rounded-full bg-secondary px-2 py-1 text-xs">{o.source === "pos" ? "Kasir" : `Meja ${o.table_no}`}</span></div>
            <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Pembayaran</span><span className="uppercase">{o.payment_method}</span></div>
            <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Total</span><strong>{rp(o.total)}</strong></div>
            <div className="flex items-center justify-between gap-3 border-t pt-2 text-sm"><span className="text-muted-foreground">Laba</span><strong>{rp(o.total - o.cost_total)}</strong></div>
          </article>
        ))}
      </div>
      <div className="table-wrap hidden overflow-x-auto sm:block">
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
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const remove = useServerFn(deleteProduct);
  const filteredProducts = products.filter((p) => [p.name, p.category, p.barcode ?? ""].some((v) => v.toLowerCase().includes(search.toLowerCase().trim())));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save({ data: { ...(editId ? { id: editId } : {}), name: f.name, barcode: f.barcode, category: f.category, price: +f.price, cost: +f.cost, stock: +f.stock, active: true } });
      setF(empty); setEditId(null); toast.success(editId ? "Perubahan produk disimpan" : "Produk disimpan");
      qc.invalidateQueries({ queryKey: ["products-all"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function edit(p: (typeof products)[number]) {
    setEditId(p.id);
    setF({ name: p.name, barcode: p.barcode ?? "", category: p.category, price: String(p.price), cost: String(p.cost), stock: String(p.stock) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeProduct(id: string, name: string) {
    if (!window.confirm(`HAPUS PERMANEN menu "${name}"? Menu akan dihapus dari katalog dan tidak bisa ditampilkan kembali. Riwayat transaksi dan restock tetap disimpan. Tindakan ini tidak bisa dibatalkan.`)) return;
    try { await remove({ data: { id } }); toast.success("Menu dihapus permanen; riwayat tetap tersimpan"); qc.invalidateQueries({ queryKey: ["products-all"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function toggle(p: (typeof products)[number]) {
    await save({ data: { id: p.id, name: p.name, barcode: p.barcode ?? "", category: p.category, price: p.price, cost: p.cost, stock: p.stock, active: !p.active } });
    qc.invalidateQueries({ queryKey: ["products-all"] });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4 xl:grid-cols-7">
        <Input placeholder="Nama" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Barcode" value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
        <Input placeholder="Kategori" required value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <Input placeholder="Harga jual" type="number" required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <Input placeholder="Modal" type="number" required value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        <Input placeholder="Stok" type="number" required value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
        <Button className="h-11 w-full">{editId ? "Simpan perubahan" : "Tambah produk"}</Button>
        {editId && <Button className="h-11 w-full" type="button" variant="outline" onClick={() => { setF(empty); setEditId(null); }}>Batal edit</Button>}
      </form>
      <div className="flex items-center gap-2 rounded-xl border bg-card p-3"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Cari menu berdasarkan nama, kategori, atau barcode…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="space-y-3 sm:hidden">
        {filteredProducts.map((p) => (
          <article key={p.id} className={`min-w-0 space-y-3 rounded-2xl border bg-card p-4 ${p.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{p.name}</h3><p className="break-all text-xs text-muted-foreground">{p.category} · {p.barcode || "Tanpa barcode"}</p></div><span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs">Stok {p.stock}</span></div>
            <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">Harga jual</p><p className="break-words font-semibold">{rp(p.price)}</p></div><div><p className="text-xs text-muted-foreground">Modal</p><p className="break-words font-semibold">{rp(p.cost)}</p></div></div>
            <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
              <Button className="h-10 w-full" variant="outline" onClick={() => edit(p)}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
              <Button className="h-10 w-full" variant="outline" onClick={() => toggle(p)}>{p.active ? "Sembunyikan" : "Tampilkan"}</Button>
              <Button className="h-10 w-full" variant="destructive" onClick={() => removeProduct(p.id, p.name)}><Trash2 className="mr-1 h-3 w-3" />Hapus</Button>
            </div>
          </article>
        ))}
        {!filteredProducts.length && <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Produk tidak ditemukan.</p>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">Nama</th><th>Kategori</th><th>Harga</th><th>Modal</th><th>Stok</th><th /></tr></thead>
          <tbody>{filteredProducts.map((p) => (
            <tr key={p.id} className={`border-t ${p.active ? "" : "opacity-50"}`}>
              <td className="p-3">{p.name}</td><td>{p.category}</td><td>{rp(p.price)}</td><td>{rp(p.cost)}</td><td>{p.stock}</td>
              <td className="pr-3 text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => edit(p)}><Pencil className="mr-1 h-3 w-3" />Edit</Button><Button size="sm" variant="outline" onClick={() => toggle(p)}>{p.active ? "Sembunyikan" : "Tampilkan"}</Button><Button size="sm" variant="destructive" onClick={() => removeProduct(p.id, p.name)}><Trash2 className="mr-1 h-3 w-3" />Hapus</Button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function TableQr() {
  const qc = useQueryClient();
  const fetchTables = useServerFn(listPosTables);
  const addTable = useServerFn(addPosTable);
  const removeTable = useServerFn(deletePosTable);
  const { data: tables = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ["pos-tables"], queryFn: () => fetchTables() });
  const [tableNo, setTableNo] = useState("");

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    const value = tableNo.trim().replace(/^meja\s+/i, "").replace(/\s+/g, " ");
    if (!value) return;
    try {
      await addTable({ data: { table_no: value } });
      setTableNo("");
      await qc.invalidateQueries({ queryKey: ["pos-tables"] });
      toast.success(`Meja ${value} ditambahkan`);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(no: string) {
    if (!window.confirm(`Hapus Meja ${no}? QR meja ini tidak dapat membuat pesanan baru.`)) return;
    try {
      await removeTable({ data: { table_no: no } });
      await qc.invalidateQueries({ queryKey: ["pos-tables"] });
      toast.success(`Meja ${no} dihapus`);
    } catch (e) { toast.error((e as Error).message); }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="space-y-4">
      <form onSubmit={createTable} className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4">
        <label className="min-w-48 flex-1 text-sm">Nomor / kode meja<Input value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="Contoh: 11 atau VIP-A" required maxLength={10} /></label>
        <Button className="h-11 w-full sm:w-auto" type="submit"><Plus className="mr-1 h-4 w-4" />Tambah meja</Button>
        <Button className="h-11 w-full sm:w-auto" type="button" variant="outline" onClick={() => window.print()}>Cetak QR</Button>
      </form>
      <p className="text-sm text-muted-foreground">Meja yang dihapus tidak bisa menerima pesanan baru dari QR. Meja dengan pesanan aktif harus diselesaikan terlebih dahulu.</p>
      {isLoading ? <p className="p-4 text-muted-foreground">Memuat daftar meja…</p> : isError ? (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-semibold text-destructive">Daftar meja gagal dimuat.</p>
          <p className="break-words text-sm text-muted-foreground">{error instanceof Error ? error.message : "Periksa koneksi database dan migrasi pos_tables."}</p>
          <Button type="button" variant="outline" onClick={() => refetch()}>Coba muat ulang</Button>
          <p className="text-xs text-muted-foreground">Jika muncul “Could not find the table 'public.pos_tables' in the schema cache”, jalankan migrasi 0004_cashier_messages_feedback_and_pos_repair.sql pada project Supabase yang dipakai aplikasi.</p>
        </div>
      ) : !tables.length ? <p className="rounded-xl border p-8 text-center text-muted-foreground">Belum ada meja aktif.</p> : (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {[...tables].sort((a, b) => a.table_no.localeCompare(b.table_no, "id", { numeric: true })).map(({ table_no: no }) => (
            <div key={no} className="flex min-w-0 flex-col items-center gap-3 rounded-xl border bg-card p-4">
              <QRCodeSVG value={`${origin}/meja/${encodeURIComponent(no)}`} size={130} className="h-auto max-w-full" />
              <p className="font-display text-lg font-bold">Meja {no}</p>
              <Button variant="destructive" size="sm" className="print:hidden" onClick={() => remove(no)}><Trash2 className="mr-1 h-3 w-3" />Hapus meja</Button>
            </div>
          ))}
        </div>
      )}
      <FeedbackInbox />
    </div>
  );
}

function FeedbackInbox() {
  const fetchFeedback = useServerFn(listCustomerFeedback);
  const { data = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ["customer-feedback"], queryFn: () => fetchFeedback(), refetchInterval: 15000 });
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div><h2 className="font-display text-xl font-bold">Kritik & Saran Pelanggan</h2><p className="text-sm text-muted-foreground">Masukan yang dikirim dari halaman scan QR meja.</p></div>
      {isLoading ? <p className="text-sm text-muted-foreground">Memuat masukan…</p> : isError ? <div role="alert" className="text-sm"><p className="text-destructive">{error instanceof Error ? error.message : "Gagal memuat masukan."}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Coba lagi</Button></div> : !data.length ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Belum ada kritik atau saran.</p> : (
        <div className="space-y-3">{data.map((item) => <article key={item.id} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{item.kind === "kritik" ? "Kritik" : "Saran"} · Meja {item.table_no}</p><span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("id-ID")}</span></div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.message}</p><p className="mt-2 text-xs text-muted-foreground">{item.customer_name || "Pelanggan tanpa nama"}</p>
        </article>)}</div>
      )}
    </section>
  );
}

function CashierSettingsPanel({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getPosSettings);
  const updateSetting = useServerFn(setCashierAddProductEnabled);
  const saveWhatsapp = useServerFn(setCashierWhatsappNumber);
  const [whatsapp, setWhatsapp] = useState("");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const whatsappInitialized = useRef(false);
  const { data: settings, isLoading, isError, error, refetch } = useQuery({ queryKey: ["pos-settings"], queryFn: () => fetchSettings() });
  useEffect(() => { if (settings?.whatsappNumber && !whatsappInitialized.current) { setWhatsapp(settings.whatsappNumber); whatsappInitialized.current = true; } }, [settings?.whatsappNumber]);

  async function toggle(enabled: boolean) {
    try {
      await updateSetting({ data: { enabled } });
      await qc.invalidateQueries({ queryKey: ["pos-settings"] });
      toast.success(enabled ? "Kasir sekarang diizinkan menambah barang" : "Penambahan barang dari kasir dinonaktifkan");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start">
          <span className="w-fit shrink-0 rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="h-6 w-6" /></span>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold">Pengaturan Kasir</h2>
            <p className="mt-1 text-sm text-muted-foreground">Atur fitur operasional kasir. Pengaturan ini mengontrol apakah kasir boleh menambahkan menu baru langsung dari halaman POS. Hak perubahan dibatasi untuk Super Admin dan diperiksa kembali di backend.</p>
            {isError && <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"><p className="font-semibold text-destructive">Pengaturan gagal dimuat</p><p className="mt-1 break-words text-muted-foreground">{error instanceof Error ? error.message : "Periksa migrasi Supabase."}</p><Button className="mt-2" variant="outline" size="sm" onClick={() => refetch()}>Coba lagi</Button></div>}
            <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <span className={settings?.cashierCanAddProducts ? "rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary" : "rounded-full bg-secondary px-3 py-1 text-sm font-semibold"}>{isLoading ? "Memuat…" : settings?.cashierCanAddProducts ? "Fitur aktif" : "Fitur nonaktif"}</span>
              <Button className="h-auto min-h-11 w-full whitespace-normal py-3 sm:w-auto" disabled={!canManage || isLoading || !settings} variant={settings?.cashierCanAddProducts ? "destructive" : "default"} onClick={() => toggle(!settings?.cashierCanAddProducts)}>{!canManage ? "Hanya Super Admin yang dapat mengubah" : settings?.cashierCanAddProducts ? "Matikan tambah barang di kasir" : "Aktifkan tambah barang di kasir"}</Button>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="font-display text-xl font-bold">Nomor WhatsApp Rekap</h2>
        <p className="mt-1 text-sm text-muted-foreground">Nomor ini dipakai tombol WhatsApp pada rekap kasir dan pintasan pelanggan. Gunakan kode negara, misalnya 6285142274765.</p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={async (e) => { e.preventDefault(); setSavingWhatsapp(true); try { await saveWhatsapp({ data: { phone: whatsapp } }); await qc.invalidateQueries({ queryKey: ["pos-settings"] }); toast.success("Nomor WhatsApp disimpan"); } catch (e) { toast.error((e as Error).message); } finally { setSavingWhatsapp(false); } }}>
          <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="628xxxxxxxxxx" inputMode="tel" maxLength={20} required disabled={!canManage} />
          <Button type="submit" disabled={!canManage || savingWhatsapp}>{savingWhatsapp ? "Menyimpan…" : "Simpan nomor"}</Button>
        </form>
        {!canManage && <p className="mt-2 text-xs text-muted-foreground">Hanya Super Admin yang dapat mengubah nomor WhatsApp.</p>}
      </div>
    </div>
  );
}


function CashierMessagePanel() {
  const send = useServerFn(sendCashierMessage);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fetchReplies = useServerFn(listCashierMessageReplies);
  const { data: replies = [], isLoading: repliesLoading } = useQuery({ queryKey: ["cashier-message-replies"], queryFn: () => fetchReplies(), refetchInterval: 5000 });
  const seenReplies = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (repliesLoading) return;
    const ids = new Set(replies.map(r => r.id));
    if (seenReplies.current === null) { seenReplies.current = ids; return; }
    const fresh = replies.filter(r => !seenReplies.current!.has(r.id));
    seenReplies.current = ids;
    if (fresh.length) toast.success("Kasir membalas: Oke", { description: fresh.map(r => r.replied_by || "Kasir").join(", ") });
  }, [replies, repliesLoading]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send({ data: { message } });
      setMessage("");
      toast.success("Pesan dikirim ke halaman kasir");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-primary/10 p-3 text-primary"><MessageSquare className="h-6 w-6" /></span>
          <div><h2 className="font-display text-xl font-bold">Pesan Operasional ke Kasir</h2><p className="text-sm text-muted-foreground">Tampil seperti kartu pemberitahuan order meja, dengan alarm berbeda. Saat kasir menekan “Oke”, admin mendapat notifikasi balasan.</p></div>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm font-medium">Isi pesan<textarea className="mt-1 min-h-28 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} required placeholder="Contoh: Mohon cek stok minuman dan rapikan area kasir." /></label>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{message.length}/500 karakter</span><Button type="submit" disabled={busy || !message.trim()}><MessageSquare className="mr-2 h-4 w-4" />{busy ? "Mengirim…" : "Kirim pesan"}</Button></div>
        </form>
      </div>
      <div className="rounded-2xl border bg-card p-4"><h3 className="font-semibold">Balasan dari kasir</h3><p className="mb-3 text-sm text-muted-foreground">Notifikasi muncul otomatis saat kasir menekan tombol Oke.</p>{replies.length ? replies.slice(0,8).map(r => <div key={r.id} className="flex items-center justify-between gap-3 border-t py-3 text-sm"><div><p className="font-medium">{r.reply} — {r.replied_by || "Kasir"}</p><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID")}</p></div><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Diterima</span></div>) : <p className="text-sm text-muted-foreground">Belum ada balasan.</p>}</div>
    </div>
  );
}
