import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, ShoppingBag, Wallet, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createTableOrder } from "@/lib/pos.functions";
import { rp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/meja/$no")({
  head: ({ params }) => ({
    meta: [
      { title: `Menu Meja ${params.no} — Warmah Kediri` },
      { name: "description", content: "Pesan langsung dari meja Anda, bayar tunai atau QRIS." },
      { property: "og:title", content: `Menu Meja ${params.no} — Warmah Kediri` },
      { property: "og:description", content: "Pesan langsung dari meja Anda, bayar tunai atau QRIS." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { no } = Route.useParams();
  const navigate = useNavigate();
  const create = useServerFn(createTableOrder);
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => (await supabase.from("products").select("id,name,category,price,stock").order("category").order("name")).data ?? [],
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"tunai" | "qris">("qris");
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState("Semua");

  const cats = ["Semua", ...Array.from(new Set(products.map((p) => p.category)))];
  const shown = cat === "Semua" ? products : products.filter((p) => p.category === cat);
  const lines = useMemo(() => products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] })), [products, cart]);
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const add = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  async function checkout() {
    setBusy(true);
    try {
      const r = await create({ data: { table_no: no, customer_name: name || undefined, payment_method: method, items: lines.map((l) => ({ product_id: l.id, qty: l.qty })) } });
      navigate({ to: "/pesanan/$id", params: { id: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-28">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Meja {no}</p>
        <h1 className="font-display text-2xl font-bold">Warmah Kediri</h1>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${cat === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {c}
            </button>
          ))}
        </div>
      </header>
      <main className="space-y-3 px-5 pt-4">
        {isLoading && <p className="text-muted-foreground">Memuat menu…</p>}
        {shown.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div>
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-primary font-bold">{rp(p.price)}</p>
              {p.stock <= 0 && <p className="text-xs text-destructive">Habis</p>}
            </div>
            {cart[p.id] ? (
              <div className="flex items-center gap-3">
                <Button size="icon" variant="outline" onClick={() => add(p.id, -1)}><Minus className="h-4 w-4" /></Button>
                <span className="w-5 text-center font-bold">{cart[p.id]}</span>
                <Button size="icon" onClick={() => add(p.id, 1)} disabled={cart[p.id] >= p.stock}><Plus className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button onClick={() => add(p.id, 1)} disabled={p.stock <= 0}>Tambah</Button>
            )}
          </div>
        ))}
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg p-4">
          <Button className="h-14 w-full justify-between text-base" onClick={() => setOpen(true)}>
            <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> {count} item</span>
            <span>{rp(total)} · Checkout</span>
          </Button>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-lg overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>Checkout · Meja {no}</SheetTitle></SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-1 text-sm">
              {lines.map((l) => (
                <div key={l.id} className="flex justify-between"><span>{l.qty}× {l.name}</span><span>{rp(l.price * l.qty)}</span></div>
              ))}
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{rp(total)}</span></div>
            </div>
            <Input placeholder="Nama (opsional)" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              {([["qris", "QRIS", QrCode], ["tunai", "Tunai", Wallet]] as const).map(([v, label, Icon]) => (
                <button key={v} onClick={() => setMethod(v)} className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 font-semibold ${method === v ? "border-primary bg-primary/10" : "border-border"}`}>
                  <Icon className="h-6 w-6" />{label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{method === "qris" ? "Scan QRIS lalu upload bukti transfer." : "Silakan bayar di kasir setelah memesan."}</p>
            <Button className="h-12 w-full" disabled={busy} onClick={checkout}>{busy ? "Memproses…" : "Pesan Sekarang"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
