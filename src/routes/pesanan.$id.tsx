import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clock, Upload, XCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getOrder, submitProof, submitCustomerFeedback, getPosSettings } from "@/lib/pos.functions";
import { rp, STATUS_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Ganti dengan string QRIS asli toko Anda.

const QRIS_PAYLOAD = "00020101021126650013ID.CO.BCA.WWW011893600014000310522902150008850031052290303UMI51440014ID.CO.QRIS.WWW0215ID10254142884450303UMI5204581453033605802ID5914WARKOP WARMAH.6006KEDIRI61056418262070703A0163048363";

export const Route = createFileRoute("/pesanan/$id")({
  head: () => ({
    meta: [
      { title: "Status Pesanan — Warmah Kediri" },
      { name: "description", content: "Pantau status pesanan dan lihat struk digital Anda." },
      { property: "og:title", content: "Status Pesanan — Warmah Kediri" },
      { property: "og:description", content: "Pantau status pesanan dan lihat struk digital Anda." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const fetchOrder = useServerFn(getOrder);
  const send = useServerFn(submitProof);
  const sendFeedback = useServerFn(submitCustomerFeedback);
  const fetchSettings = useServerFn(getPosSettings);
  const { data: posSettings } = useQuery({ queryKey: ["pos-settings"], queryFn: () => fetchSettings(), staleTime: 30000 });
  const [feedbackKind, setFeedbackKind] = useState<"kritik" | "saran">("saran");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { data: o, refetch, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder({ data: { id } }),
    refetchInterval: (q) => (q.state.data?.status === "dikonfirmasi" || q.state.data?.status === "ditolak" ? false : 3000),
  });

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackBusy(true);
    try {
      await sendFeedback({ data: { table_no: o?.table_no ?? "", kind: feedbackKind, message: feedbackMessage, ...(feedbackName.trim() ? { customer_name: feedbackName.trim() } : {}) } });
      toast.success("Terima kasih, kritik dan saran Anda terkirim.");
      setFeedbackMessage("");
      setFeedbackName("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setFeedbackBusy(false); }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
      const { error } = await supabase.storage.from("bukti").upload(path, file);
      if (error) throw error;
      await send({ data: { id, path } });
      toast.success("Bukti terkirim");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return <p className="p-8 text-center text-muted-foreground">Memuat…</p>;
  if (!o) return <p className="p-8 text-center">Pesanan tidak ditemukan.</p>;

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-5 bg-background p-5">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Meja {o.table_no}</p>
        <h1 className="font-display text-2xl font-bold">Pesanan #{o.order_no}</h1>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-medium">
          {o.status === "dikonfirmasi" ? <CheckCircle2 className="h-4 w-4 text-success" /> : o.status === "ditolak" ? <XCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4" />}
          {STATUS_LABEL[o.status]}
        </span>
      </div>

      {o.status === "menunggu_bukti" && (
        <div className="space-y-4 rounded-2xl border bg-card p-5 text-center">
          <p className="font-semibold">Scan QRIS & bayar {rp(o.total)}</p>
          <div className="mx-auto w-fit rounded-xl bg-card p-3 ring-1 ring-border"><QRCodeSVG value={QRIS_PAYLOAD} size={220} /></div>
          <label className="block">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <span className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary font-medium text-primary-foreground">
              <Upload className="h-4 w-4" />{uploading ? "Mengunggah…" : "Upload Bukti Bayar"}
            </span>
          </label>
        </div>
      )}
      {o.status === "menunggu_validasi" && <Info text="Bukti bayar diterima. Kasir sedang memvalidasi — halaman ini otomatis diperbarui." />}
      {o.status === "menunggu_pembayaran" && <Info text={`Silakan ke kasir dan bayar tunai ${rp(o.total)}. Struk muncul di sini setelah dikonfirmasi.`} />}
      {o.status === "ditolak" && <Info text="Pesanan ditolak. Silakan hubungi kasir." />}

      {o.status === "dikonfirmasi" ? (
        <div className="rounded-2xl border bg-card p-5 font-mono text-sm shadow-sm">
          <div className="text-center">
            <p className="font-display text-lg font-bold">WARMAH KEDIRI</p>
            <p className="text-xs text-muted-foreground">E-Struk · #{o.order_no}</p>
            <p className="text-xs text-muted-foreground">{new Date(o.confirmed_at!).toLocaleString("id-ID")}</p>
          </div>
          <div className="my-3 border-t border-dashed" />
          {o.items.map((it, i) => (
            <div key={i} className="flex justify-between"><span>{it.qty}× {it.name}</span><span>{rp(it.price * it.qty)}</span></div>
          ))}
          <div className="my-3 border-t border-dashed" />
          <Row k="TOTAL" v={rp(o.total)} bold />
          <Row k="Bayar" v={o.payment_method.toUpperCase()} />
          {o.payment_method === "tunai" && o.cash_received != null && (<><Row k="Tunai" v={rp(o.cash_received)} /><Row k="Kembali" v={rp(o.change_amount ?? 0)} /></>)}
          <p className="mt-4 text-center text-xs text-muted-foreground">Terima kasih! Pesanan sedang disiapkan.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-5 text-sm">
          {o.items.map((it, i) => (<div key={i} className="flex justify-between"><span>{it.qty}× {it.name}</span><span>{rp(it.price * it.qty)}</span></div>))}
          <div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{rp(o.total)}</span></div>
        </div>
      )}
      {o.status === "dikonfirmasi" && <>
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-display text-lg font-bold">Bagaimana pengalaman Anda?</h2>
          <p className="text-sm text-muted-foreground">Pesanan selesai. Kritik dan saran Anda membantu kami meningkatkan pelayanan.</p>
          <form onSubmit={submitFeedback} className="space-y-3">
            <Input placeholder="Nama (opsional)" value={feedbackName} onChange={e => setFeedbackName(e.target.value)} maxLength={60} />
            <div className="grid grid-cols-2 gap-2"><Button type="button" variant={feedbackKind === "kritik" ? "default" : "outline"} onClick={() => setFeedbackKind("kritik")}>Kritik</Button><Button type="button" variant={feedbackKind === "saran" ? "default" : "outline"} onClick={() => setFeedbackKind("saran")}>Saran</Button></div>
            <textarea className="min-h-24 w-full rounded-xl border bg-background p-3 text-sm" placeholder="Tulis kritik atau saran Anda…" value={feedbackMessage} onChange={e => setFeedbackMessage(e.target.value)} required minLength={3} maxLength={1000} />
            <Button type="submit" className="w-full" disabled={feedbackBusy || feedbackMessage.trim().length < 3}>{feedbackBusy ? "Mengirim…" : "Kirim Kritik / Saran"}</Button>
          </form>
        </section>
        <a className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white" href={`https://wa.me/${(posSettings?.whatsappNumber || "6285142274765").replace(/\\D/g, "")}?text=${encodeURIComponent(`Halo Warmah Kediri, saya pelanggan meja ${o.table_no}, pesanan #${o.order_no} sudah selesai.`)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-5 w-5" />Hubungi via WhatsApp</a>
      </>}
      <Button variant="outline" className="w-full" onClick={() => history.back()}>Kembali ke Menu</Button>
    </div>
  );
}

const Info = ({ text }: { text: string }) => <div className="rounded-xl bg-secondary p-4 text-center text-sm">{text}</div>;
const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={`flex justify-between ${bold ? "font-bold" : ""}`}><span>{k}</span><span>{v}</span></div>
);
