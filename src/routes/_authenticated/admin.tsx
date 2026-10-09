import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LogOut, Trash2, TrendingUp, Wallet, Receipt, Coins, Pencil, Plus, ShieldCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getReport, resetRevenue, listProductsAll, upsertProduct, deleteProduct, listPosTables, addPosTable, deletePosTable, getPosSettings, setCashierAddProductEnabled, getAdminPermissions } from "@/lib/pos.functions";
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">Ikhtisar usaha</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Pantau penjualan, produk, dan kebutuhan operasional.</p></div><TabsList className="h-11 w-fit rounded-xl bg-secondary p-1"><TabsTrigger className="rounded-lg px-4" value="laba">Laba/Rugi</TabsTrigger><TabsTrigger className="rounded-lg px-4" value="produk">Produk</TabsTrigger><TabsTrigger className="rounded-lg px-4" value="qr">Meja & QR</TabsTrigger>{permissions?.isSuperAdmin && <TabsTrigger className="rounded-lg px-4" value="superadmin">Super Admin</TabsTrigger>}</TabsList></div>
        <TabsContent value="laba"><Report /></TabsContent>
        <TabsContent value="produk"><Products /></TabsContent>
        <TabsContent value="qr"><TableQr /></TabsContent>
        {permissions?.isSuperAdmin && <TabsContent value="superadmin"><SuperAdminPanel /></TabsContent>}
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
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const remove = useServerFn(deleteProduct);

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
    if (!window.confirm(`Hapus menu "${name}"? Menu akan disembunyikan dari pelanggan, riwayat transaksi tetap aman.`)) return;
    try { await remove({ data: { id } }); toast.success("Menu dihapus"); qc.invalidateQueries({ queryKey: ["products-all"] }); }
    catch (e) { toast.error((e as Error).message); }
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
        <Button>{editId ? "Simpan perubahan" : "Tambah produk"}</Button>
        {editId && <Button type="button" variant="outline" onClick={() => { setF(empty); setEditId(null); }}>Batal edit</Button>}
      </form>
      <div className="flex items-center gap-2 rounded-xl border bg-card p-3"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Cari menu berdasarkan nama, kategori, atau barcode…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">Nama</th><th>Kategori</th><th>Harga</th><th>Modal</th><th>Stok</th><th /></tr></thead>
          <tbody>{products.filter((p) => [p.name, p.category, p.barcode ?? ""].some((v) => v.toLowerCase().includes(search.toLowerCase()))).map((p) => (
            <tr key={p.id} className={`border-t ${p.active ? "" : "opacity-50"}`}>
              <td className="p-3">{p.name}</td><td>{p.category}</td><td>{rp(p.price)}</td><td>{rp(p.cost)}</td><td>{p.stock}</td>
              <td className="pr-3 text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => edit(p)}><Pencil className="mr-1 h-3 w-3" />Edit</Button><Button size="sm" variant="outline" onClick={() => toggle(p)}>{p.active ? "Sembunyikan" : "Tampilkan"}</Button><Button size="sm" variant="destructive" disabled={!p.active} onClick={() => removeProduct(p.id, p.name)}><Trash2 className="mr-1 h-3 w-3" />Hapus</Button></div></td>
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
  const { data: tables = [], isLoading } = useQuery({ queryKey: ["pos-tables"], queryFn: () => fetchTables() });
  const [tableNo, setTableNo] = useState("");

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    const value = tableNo.trim();
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
      <form onSubmit={createTable} className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4">
        <label className="min-w-48 flex-1 text-sm">Nomor / kode meja<Input value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="Contoh: 11 atau VIP-A" required maxLength={10} /></label>
        <Button type="submit"><Plus className="mr-1 h-4 w-4" />Tambah meja</Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>Cetak QR</Button>
      </form>
      <p className="text-sm text-muted-foreground">Meja yang dihapus tidak bisa menerima pesanan baru dari QR. Meja dengan pesanan aktif harus diselesaikan terlebih dahulu.</p>
      {isLoading ? <p className="p-4 text-muted-foreground">Memuat daftar meja…</p> : !tables.length ? <p className="rounded-xl border p-8 text-center text-muted-foreground">Belum ada meja aktif.</p> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {tables.map(({ table_no: no }) => (
            <div key={no} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4">
              <QRCodeSVG value={`${origin}/meja/${encodeURIComponent(no)}`} size={130} />
              <p className="font-display text-lg font-bold">Meja {no}</p>
              <Button variant="destructive" size="sm" className="print:hidden" onClick={() => remove(no)}><Trash2 className="mr-1 h-3 w-3" />Hapus meja</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SuperAdminPanel() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getPosSettings);
  const updateSetting = useServerFn(setCashierAddProductEnabled);
  const { data: settings, isLoading } = useQuery({ queryKey: ["pos-settings"], queryFn: () => fetchSettings() });

  async function toggle(enabled: boolean) {
    try {
      await updateSetting({ data: { enabled } });
      await qc.invalidateQueries({ queryKey: ["pos-settings"] });
      toast.success(enabled ? "Kasir sekarang diizinkan menambah barang" : "Penambahan barang dari kasir dinonaktifkan");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="h-6 w-6" /></span>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold">Kontrol akses kasir</h2>
            <p className="mt-1 text-sm text-muted-foreground">Atur apakah akun dengan hak akses kasir boleh membuat barang baru langsung dari halaman POS. Perubahan ini diperiksa kembali di backend.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={settings?.cashierCanAddProducts ? "rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary" : "rounded-full bg-secondary px-3 py-1 text-sm font-semibold"}>{isLoading ? "Memuat…" : settings?.cashierCanAddProducts ? "Fitur aktif" : "Fitur nonaktif"}</span>
              <Button disabled={isLoading || !settings} variant={settings?.cashierCanAddProducts ? "destructive" : "default"} onClick={() => toggle(!settings?.cashierCanAddProducts)}>{settings?.cashierCanAddProducts ? "Matikan tambah barang di kasir" : "Aktifkan tambah barang di kasir"}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
