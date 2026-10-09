import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, ChefHat, Minus, Plus, ScanBarcode, Trash2, ZoomIn, Volume2, Search, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { listLiveOrders, listProductsAll, confirmOrder, rejectOrder, getProofUrl, posCheckout, restockProduct, listCashierMessages, getCashierHistorySecure, getPosSettings, acknowledgeCashierMessage } from "@/lib/pos.functions";
import { supabase } from "@/integrations/supabase/client";
import { rp, STATUS_LABEL, startAlarm } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/kasir")({
  head: () => ({
    meta: [
      { title: "Kasir — Warmah Kediri POS" },
      { name: "description", content: "Halaman kasir: POS, restock, dan pesanan meja real-time." },
      { property: "og:title", content: "Kasir — Warmah Kediri POS" },
      { property: "og:description", content: "Halaman kasir: POS, restock, dan pesanan meja real-time." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KasirPage,
});

type Live = Awaited<ReturnType<typeof listLiveOrders>>[number];

function KasirPage() {
  const fetchLive = useServerFn(listLiveOrders);
  const [armed, setArmed] = useState(false);
  const [alert, setAlert] = useState<Live[]>([]);
  const [messageAlert, setMessageAlert] = useState<Array<{ id: string; message: string; created_at: string; created_by: string | null }>>([]);
  const seenMessages = useRef<Set<string> | null>(null);
  const fetchMessages = useServerFn(listCashierMessages);
  const acknowledge = useServerFn(acknowledgeCashierMessage);
  const { data: cashierMessages = [] } = useQuery({ queryKey: ["cashier-messages"], queryFn: () => fetchMessages(), refetchInterval: 5000, refetchIntervalInBackground: true, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: 2 });
  const seen = useRef<Set<string> | null>(null);
  const stopRef = useRef<null | (() => void)>(null);

  const { data: live = [], isSuccess } = useQuery({ queryKey: ["live"], queryFn: () => fetchLive(), refetchInterval: 2500 });

  useEffect(() => {
    if (!isSuccess) return;
    const ids = new Set(live.map((o) => o.id));
    if (seen.current === null) { seen.current = ids; return; }
    const fresh = live.filter((o) => !seen.current!.has(o.id));
    // also alert when an order moves to "menunggu_validasi"
    seen.current = ids;
    if (fresh.length) {
      setAlert((a) => [...a, ...fresh]);
      if (armed && !stopRef.current) stopRef.current = startAlarm();
    }
  }, [live, armed, isSuccess]);

  useEffect(() => {
    if (!cashierMessages.length) {
      if (seenMessages.current === null) seenMessages.current = new Set();
      return;
    }
    const ids = new Set(cashierMessages.map((m) => m.id));
    // Pesan yang belum dijawab tetap ditampilkan saat kasir baru membuka halaman,
    // termasuk pesan yang dikirim ketika HP offline atau tab ditutup.
    const fresh = seenMessages.current === null
      ? cashierMessages
      : cashierMessages.filter((m) => !seenMessages.current!.has(m.id));
    seenMessages.current = ids;
    if (fresh.length) {
      setMessageAlert((old) => [...fresh, ...old.filter((m) => !fresh.some((n) => n.id === m.id))].slice(0, 10));
      if (armed) {
        const stop = startAlarm();
        window.setTimeout(stop, 2200);
      }
      toast.info(fresh.length === 1 ? "Ada pesan baru dari admin" : `Ada ${fresh.length} pesan admin yang belum dibaca`, { duration: 5000 });
      if ("Notification" in window && Notification.permission === "granted") {
        const latest = fresh[0];
        const notification = new Notification("Pesan dari Admin — Warmah Kasir", {
          body: latest.message,
          tag: `admin-message-${latest.id}`,
          renotify: true,
        });
        notification.onclick = () => { window.focus(); notification.close(); };
      }
    }
  }, [cashierMessages, armed]);

  const dismiss = () => { stopRef.current?.(); stopRef.current = null; setAlert([]); };


  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="app-header sticky top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="brand-lockup"><span className="brand-mark"><ChefHat className="h-5 w-5" /></span><span><span className="brand-name block">warmah<span className="text-primary">kasir</span></span><span className="block text-xs text-muted-foreground">Meja operasional</span></span></Link>
        <Button className="rounded-xl" variant={armed ? "secondary" : "default"} size="sm" onClick={async () => { setArmed(true); const s = startAlarm(); setTimeout(s, 400); if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch { /* izin notifikasi opsional; alarm halaman tetap aktif */ } } }}>
          <Volume2 className="mr-1 h-4 w-4" />{armed ? "Alarm aktif" : "Aktifkan alarm"}
        </Button>
      </header>
      <Tabs defaultValue="live" className="dashboard-content px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">Operasional</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Ruang kasir</h1><p className="mt-1 text-sm text-muted-foreground">Kelola pesanan, transaksi langsung, dan persediaan.</p></div><TabsList className="mb-5 grid h-auto min-h-11 w-full max-w-lg grid-cols-4 rounded-xl bg-secondary p-1">
          <TabsTrigger className="rounded-lg px-2 text-xs sm:text-sm" value="live">Order Meja {live.length > 0 && <span className="ml-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{live.length}</span>}</TabsTrigger>
          <TabsTrigger className="rounded-lg px-2 text-xs sm:text-sm" value="pos">POS</TabsTrigger>
          <TabsTrigger className="rounded-lg px-2 text-xs sm:text-sm" value="stok">Restock</TabsTrigger>
          <TabsTrigger className="rounded-lg px-2 text-xs sm:text-sm" value="history">Riwayat</TabsTrigger>
        </TabsList>
        <TabsContent value="live"><LiveOrders live={live} /></TabsContent>
        <TabsContent value="pos"><Pos /></TabsContent>
        <TabsContent value="stok"><Restock /></TabsContent>
        <TabsContent value="history"><CashierHistory /></TabsContent>
      </Tabs>

      <Dialog open={messageAlert.length > 0} onOpenChange={(o) => !o && setMessageAlert([])}>
        <DialogContent className="border-4 border-amber-500 bg-amber-50 text-slate-900 dark:bg-amber-950 dark:text-amber-50">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl"><BellRing className="h-7 w-7 animate-bounce text-amber-600" /> Pesan Operasional dari Admin</DialogTitle></DialogHeader>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Notifikasi khusus · berbeda dari order meja</p>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {messageAlert.map((m) => <div key={m.id} className="rounded-lg bg-secondary p-3"><p className="whitespace-pre-wrap break-words">{m.message}</p><p className="mt-2 text-xs text-muted-foreground">{m.created_by || "Admin"} · {new Date(m.created_at).toLocaleString("id-ID")}</p></div>)}
          </div>
          <Button className="h-12 text-base" onClick={async () => { try { await Promise.all(messageAlert.map((m) => acknowledge({ data: { message_id: m.id } }))); toast.success("Balasan Oke terkirim ke admin"); } catch (e) { toast.error((e as Error).message); } setMessageAlert([]); }}>Oke, dimengerti</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={alert.length > 0} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent className="border-4 border-primary">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl"><BellRing className="h-7 w-7 animate-bounce text-primary" /> Pesanan Baru!</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {alert.map((o) => (
              <div key={o.id} className="rounded-lg bg-secondary p-3">
                <p className="font-bold">Meja {o.table_no} · #{o.order_no} · {rp(o.total)}</p>
                <p className="text-sm text-muted-foreground">{o.payment_method.toUpperCase()} · {o.order_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
              </div>
            ))}
          </div>
          <Button className="h-12 text-base" onClick={dismiss}>Lihat Pesanan</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CashierHistory() {
  const fetchHistory = useServerFn(getCashierHistorySecure);
  const fetchSettings = useServerFn(getPosSettings);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const { data: settings } = useQuery({ queryKey: ["pos-settings"], queryFn: () => fetchSettings(), refetchInterval: 15000 });
  const range = { from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() };
  const { data: orders = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["cashier-history", from, to],
    queryFn: async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error("Gagal membaca sesi login. Silakan muat ulang halaman.");
      let session = sessionData.session;
      // Refresh a near-expired access token before asking the server to validate it.
      if (!session || (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 30)) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw new Error("Sesi login berakhir. Silakan masuk kembali.");
        session = refreshed.session;
      }
      const token = session?.access_token;
      if (!token) throw new Error("Sesi login berakhir. Silakan masuk kembali.");
      return fetchHistory({ data: { ...range, accessToken: token } });
    },
    retry: 1,
  });
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const itemsCount = orders.reduce((sum, order) => sum + order.order_items.reduce((n, item) => n + item.qty, 0), 0);
  const summary = `REKAP PENJUALAN WARMAH KEDIRI\nPeriode: ${from} s/d ${to}\nTransaksi: ${orders.length}\nJumlah item: ${itemsCount}\nTotal penjualan: ${rp(revenue)}\n\n${orders.map(o => `#${o.order_no} | ${new Date(o.confirmed_at || o.created_at).toLocaleString("id-ID")} | ${o.source === "pos" ? "Kasir" : `Meja ${o.table_no}`} | ${o.payment_method.toUpperCase()}\n${o.order_items.map(i => `${i.qty}x ${i.name} - ${rp(i.qty*i.price)}`).join("\n")}\nTotal: ${rp(o.total)}`).join("\n\n")}`;
  function printPdf() {
    const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c] || c));
    const rows = orders.map(o => `<section class="order"><h3>Transaksi #${escape(String(o.order_no))} — ${escape(new Date(o.confirmed_at || o.created_at).toLocaleString("id-ID"))}</h3><p>${o.source === "pos" ? "Kasir" : "Meja " + escape(String(o.table_no))} · ${escape(o.payment_method.toUpperCase())}</p><table><tbody>${o.order_items.map(i => `<tr><td>${i.qty} × ${escape(i.name)}</td><td>${escape(rp(i.qty*i.price))}</td></tr>`).join("")}</tbody></table><strong>Total: ${escape(rp(o.total))}</strong></section>`).join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast.error("Izinkan pop-up browser untuk membuat PDF."); return; }
    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rekap Warmah Kediri</title><style>body{font:14px Arial,sans-serif;color:#111;padding:28px}h1{margin-bottom:4px}.muted{color:#555}.summary{display:flex;gap:24px;margin:20px 0;padding:12px;background:#f2f2f2}.order{page-break-inside:avoid;border-top:1px solid #ccc;padding:12px 0}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:4px;border-bottom:1px solid #eee}td:last-child{text-align:right}@media print{button{display:none}}</style></head><body><h1>Warmah Kediri — Rekap Penjualan</h1><p class="muted">Periode ${escape(from)} sampai ${escape(to)} · Dicetak ${escape(new Date().toLocaleString("id-ID"))}</p><div class="summary"><span>Transaksi: <b>${orders.length}</b></span><span>Jumlah item: <b>${itemsCount}</b></span><span>Total penjualan: <b>${escape(rp(revenue))}</b></span></div>${rows || "<p>Tidak ada transaksi.</p>"}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }
  function sendWhatsApp() {
    const phone = (settings?.whatsappNumber || "").replace(/\D/g, "");
    if (!phone) { toast.error("Atur nomor WhatsApp di panel Admin terlebih dahulu."); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(summary + "\n\nPDF: silakan lampirkan file PDF yang sudah disimpan dari tombol Cetak / Simpan PDF.")}`, "_blank", "noopener,noreferrer");
  }
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="text-sm">Dari tanggal<Input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
      <label className="text-sm">Sampai tanggal<Input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
      <Button variant="outline" onClick={printPdf}>Cetak / Simpan PDF</Button>
      <Button onClick={sendWhatsApp}>Siapkan WhatsApp</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Total penjualan</p><p className="text-xl font-bold">{rp(revenue)}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Transaksi</p><p className="text-xl font-bold">{orders.length}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Jumlah item terjual</p><p className="text-xl font-bold">{itemsCount}</p></div></div>
    {isLoading && <p className="p-4 text-muted-foreground">Memuat riwayat…</p>}
    {isError && <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-4 text-sm"><p>{error instanceof Error ? error.message : "Riwayat gagal dimuat."}</p><Button type="button" variant="outline" onClick={() => refetch()}>Coba muat ulang</Button></div>}
    {!isLoading && !isError && !orders.length && <p className="rounded-xl border p-6 text-center text-muted-foreground">Tidak ada transaksi pada tanggal ini.</p>}
    <div className="space-y-3">{orders.map(o=><article key={o.id} className="space-y-2 rounded-xl border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">Transaksi #{o.order_no}</p><p className="text-xs text-muted-foreground">{new Date(o.confirmed_at || o.created_at).toLocaleString("id-ID")}</p></div><span className="rounded-full bg-secondary px-2 py-1 text-xs">{o.source === "pos" ? "Kasir" : `Meja ${o.table_no}`}</span></div><div className="space-y-1 text-sm">{o.order_items.map((item,i)=><div key={i} className="flex justify-between gap-3"><span>{item.qty}× {item.name}</span><span>{rp(item.qty*item.price)}</span></div>)}</div><div className="flex justify-between border-t pt-2"><span className="text-sm text-muted-foreground">{o.payment_method.toUpperCase()}</span><strong>{rp(o.total)}</strong></div></article>)}</div>
  </div>;
}

function LiveOrders({ live }: { live: Live[] }) {
  const qc = useQueryClient();
  const confirm = useServerFn(confirmOrder);
  const reject = useServerFn(rejectOrder);
  const proof = useServerFn(getProofUrl);
  const [img, setImg] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [cash, setCash] = useState<Record<string, string>>({});

  async function act(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); toast.success(msg); qc.invalidateQueries({ queryKey: ["live"] }); } catch (e) { toast.error((e as Error).message); }
  }

  if (!live.length) return <p className="py-16 text-center text-muted-foreground">Belum ada pesanan meja. Alarm akan berbunyi saat pesanan masuk.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {live.map((o) => {
        const c = Number(cash[o.id] || 0);
        return (
          <div key={o.id} className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-lg font-bold">Meja {o.table_no} <span className="text-sm text-muted-foreground">#{o.order_no}</span></p>
                <p className="text-xs text-muted-foreground">{o.customer_name || "Tamu"} · {new Date(o.created_at).toLocaleTimeString("id-ID")}</p>
              </div>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{STATUS_LABEL[o.status]}</span>
            </div>
            <ul className="text-sm">{o.order_items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.qty}× {i.name}</span><span>{rp(i.qty * i.price)}</span></li>)}</ul>
            <p className="flex justify-between border-t pt-2 font-bold"><span>{o.payment_method.toUpperCase()}</span><span>{rp(o.total)}</span></p>
            {o.payment_method === "qris" ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled={!o.proof_path} onClick={async () => { setZoom(false); setImg(await proof({ data: { id: o.id } })); }}>
                  <ZoomIn className="mr-1 h-4 w-4" />{o.proof_path ? "Cek Bukti" : "Belum upload"}
                </Button>
                <Button className="w-full sm:flex-1" disabled={o.status !== "menunggu_validasi"} onClick={() => act(() => confirm({ data: { id: o.id } }), "Pesanan dikonfirmasi")}>Konfirmasi Pesanan</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input type="number" placeholder="Uang diterima" value={cash[o.id] ?? ""} onChange={(e) => setCash({ ...cash, [o.id]: e.target.value })} />
                  <Button variant="outline" onClick={() => setCash({ ...cash, [o.id]: String(o.total) })}>Uang pas</Button>
                </div>
                <p className="text-sm">Kembalian: <b className={c >= o.total ? "text-success" : "text-destructive"}>{c ? rp(c - o.total) : "-"}</b></p>
                <Button className="w-full" disabled={c < o.total} onClick={() => act(() => confirm({ data: { id: o.id, cash_received: c } }), "Pesanan dikonfirmasi")}>Konfirmasi Pesanan</Button>
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => act(() => reject({ data: { id: o.id } }), "Pesanan ditolak")}>Tolak</Button>
          </div>
        );
      })}
      <Dialog open={!!img} onOpenChange={(o) => !o && setImg(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Bukti Transfer QRIS (klik untuk zoom)</DialogTitle></DialogHeader>
          <div className="max-h-[75vh] overflow-auto">
            {img && <img src={img} alt="Bukti transfer" onClick={() => setZoom(!zoom)} className={`mx-auto cursor-zoom-in transition-all ${zoom ? "max-w-none w-[200%] cursor-zoom-out" : "max-h-[70vh]"}`} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useProducts() {
  const fn = useServerFn(listProductsAll);
  return useQuery({ queryKey: ["products-all"], queryFn: () => fn() });
}

function Pos() {
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const checkout = useServerFn(posCheckout);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cash, setCash] = useState("");
  const [method, setMethod] = useState<"tunai" | "qris">("tunai");

  const filtered = products.filter((p) => p.active && (p.name.toLowerCase().includes(q.toLowerCase()) || p.barcode?.includes(q)));
  const lines = useMemo(() => products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] ?? 0 })), [products, cart]);
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const c = method === "tunai" ? Number(cash || 0) : total;
  const add = (id: string, d: number) => setCart((x) => { const n = Math.max(0, (x[id] ?? 0) + d); const y = { ...x, [id]: n }; if (!n) delete y[id]; return y; });

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const hit = products.find((p) => p.barcode === q.trim());
    if (hit) { add(hit.id, 1); setQ(""); } else if (filtered.length === 1) { add(filtered[0]!.id, 1); setQ(""); }
  }

  async function pay() {
    try {
      const r = await checkout({ data: { items: lines.map((l) => ({ product_id: l.id, qty: l.qty })), payment_method: method, cash_received: c } });
      toast.success(`Transaksi #${r.order_no} selesai · Kembalian ${rp(r.change)}`);
      setCart({}); setCash("");
      qc.invalidateQueries({ queryKey: ["products-all"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const quick = [total, 20000, 50000, 100000].filter((v, i, a) => v > 0 && a.indexOf(v) === i && v >= total);

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_390px] sm:gap-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <form onSubmit={onScan} className="relative min-w-0 flex-1">
            <ScanBarcode className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input autoFocus className="h-11 pl-10" placeholder="Cari nama atau scan barcode lalu Enter" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => add(p.id, 1)} disabled={p.stock <= (cart[p.id] ?? 0)} className="min-w-0 break-words rounded-xl border bg-card p-3 text-left transition hover:border-primary disabled:opacity-40 sm:p-4">
              <p className="font-semibold leading-tight">{p.name}</p>
              <p className="text-sm font-bold text-primary">{rp(p.price)}</p>
              <p className="text-xs text-muted-foreground">Stok {p.stock}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5 xl:sticky xl:top-24 xl:self-start">
        <h2 className="font-display text-lg font-bold">Keranjang</h2>
        {!lines.length && <p className="text-sm text-muted-foreground">Belum ada item.</p>}
        {lines.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex-1">{l.name}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => add(l.id, -1)}><Minus className="h-3 w-3" /></Button>
            <span className="w-5 text-center">{l.qty}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => add(l.id, 1)}><Plus className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => add(l.id, -l.qty)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
        <p className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{rp(total)}</span></p>
        <div className="grid grid-cols-2 gap-2">
          {(["tunai", "qris"] as const).map((m) => <Button key={m} variant={method === m ? "default" : "outline"} onClick={() => setMethod(m)}>{m.toUpperCase()}</Button>)}
        </div>
        {method === "tunai" && (
          <>
            <Input type="number" placeholder="Uang diterima" value={cash} onChange={(e) => setCash(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {quick.map((v) => <Button key={v} size="sm" variant="secondary" onClick={() => setCash(String(v))}>{v === total ? "Uang pas" : rp(v)}</Button>)}
            </div>
            <p className="flex justify-between text-lg"><span>Kembalian</span><b className={c >= total ? "text-success" : "text-destructive"}>{cash ? rp(c - total) : "-"}</b></p>
          </>
        )}
        <Button className="h-12 w-full text-base" disabled={!lines.length || c < total} onClick={pay}>Bayar</Button>
      </div>
    </div>
  );
}

function Restock() {
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const restock = useServerFn(restockProduct);
  const [search, setSearch] = useState("");
  const [vals, setVals] = useState<Record<string, { qty: string }>>({});
  const filteredProducts = products.filter((p) => [p.name, p.category, p.barcode ?? ""].some((v) => v.toLowerCase().includes(search.trim().toLowerCase())));

  async function save(id: string) {
    const v = vals[id];
    const qty = Number(v?.qty || 0);
    if (qty < 1) { toast.error("Isi jumlah"); return; }
    try {
      await restock({ data: { product_id: id, qty } });
      toast.success("Stok ditambah");
      setVals({ ...vals, [id]: { qty: "" } });
      qc.invalidateQueries({ queryKey: ["products-all"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border bg-card p-3"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Cari barang restock berdasarkan nama, kategori, atau barcode…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">Produk</th><th>Barcode</th><th>Stok</th><th>Modal</th><th>Tambah</th><th /></tr></thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}</td><td className="text-muted-foreground">{p.barcode || "—"}</td>
                <td className={p.stock < 10 ? "font-bold text-destructive" : ""}>{p.stock}</td><td>{rp(p.cost)}</td>
                <td><Input aria-label={`Jumlah restock ${p.name}`} className="h-9 w-20" type="number" min="1" value={vals[p.id]?.qty ?? ""} onChange={(e) => setVals({ ...vals, [p.id]: { qty: e.target.value } })} /></td>
                <td className="pr-3"><Button size="sm" onClick={() => save(p.id)}>Simpan</Button></td>
              </tr>
            ))}
            {!filteredProducts.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Barang tidak ditemukan.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {filteredProducts.map((p) => (
          <section key={p.id} className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="break-words font-semibold">{p.name}</h3><p className="break-all text-xs text-muted-foreground">{p.barcode || "Tanpa barcode"} · {p.category}</p></div>
              <div className="shrink-0 text-right"><p className={p.stock < 10 ? "font-bold text-destructive" : "font-semibold"}>Stok {p.stock}</p><p className="text-xs text-muted-foreground">Modal {rp(p.cost)}</p></div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <label className="min-w-0 text-sm">Jumlah tambah<Input aria-label={`Jumlah restock ${p.name}`} className="mt-1 h-11 w-full" type="number" min="1" inputMode="numeric" placeholder="0" value={vals[p.id]?.qty ?? ""} onChange={(e) => setVals({ ...vals, [p.id]: { qty: e.target.value } })} /></label>
            </div>
            <Button className="h-11 w-full" onClick={() => save(p.id)}>Simpan restock</Button>
          </section>
        ))}
        {!filteredProducts.length && <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Barang tidak ditemukan.</p>}
      </div>
    </div>
  );
}
