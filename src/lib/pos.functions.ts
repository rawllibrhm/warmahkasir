import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const itemsSchema = z.array(z.object({ product_id: z.string().uuid(), qty: z.number().int().min(1).max(99) })).min(1).max(50);

async function buildItems(items: { product_id: string; qty: number }[]) {
  const db = await admin();
  const { data: prods, error } = await db.from("products").select("id,name,price,cost,stock").in("id", items.map((i) => i.product_id));
  if (error) throw new Error(error.message);
  const rows = items.map((i) => {
    const p = prods!.find((x) => x.id === i.product_id);
    if (!p) throw new Error("Produk tidak ditemukan");
    return { product_id: p.id, name: p.name, price: p.price, cost: p.cost, qty: i.qty };
  });
  const total = rows.reduce((s, r) => s + r.price * r.qty, 0);
  const cost_total = rows.reduce((s, r) => s + r.cost * r.qty, 0);
  return { rows, total, cost_total };
}

async function decrementStock(orderId: string) {
  const db = await admin();
  const { data: items } = await db.from("order_items").select("product_id,qty").eq("order_id", orderId);
  for (const it of items ?? []) {
    if (!it.product_id) continue;
    const { data: p } = await db.from("products").select("stock").eq("id", it.product_id).single();
    if (p) await db.from("products").update({ stock: Math.max(0, p.stock - it.qty) }).eq("id", it.product_id);
  }
}

// ---------- Pelanggan ----------
export const createTableOrder = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      table_no: z.string().min(1).max(10),
      customer_name: z.string().max(60).optional(),
      payment_method: z.enum(["tunai", "qris"]),
      items: itemsSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { rows, total, cost_total } = await buildItems(data.items);
    const { data: order, error } = await db
      .from("orders")
      .insert({
        source: "meja",
        table_no: data.table_no,
        customer_name: data.customer_name || null,
        payment_method: data.payment_method,
        status: data.payment_method === "qris" ? "menunggu_bukti" : "menunggu_pembayaran",
        total,
        cost_total,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await db.from("order_items").insert(rows.map((r) => ({ ...r, order_id: order.id })));
    return { id: order.id };
  });

export const submitProof = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), path: z.string().min(5).max(200) }).parse(d))
  .handler(async ({ data }) => {
    if (!data.path.startsWith(`${data.id}/`)) throw new Error("Path tidak valid");
    const db = await admin();
    const { error } = await db
      .from("orders")
      .update({ proof_path: data.path, status: "menunggu_validasi" })
      .eq("id", data.id)
      .in("status", ["menunggu_bukti", "menunggu_validasi"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: order } = await db
      .from("orders")
      .select("id,order_no,source,table_no,customer_name,payment_method,status,total,cash_received,change_amount,created_at,confirmed_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!order) return null;
    const { data: items } = await db.from("order_items").select("name,price,qty").eq("order_id", data.id);
    return { ...order, items: items ?? [] };
  });

// ---------- Kasir ----------
export const listProductsAll = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  const { data } = await db.from("products").select("*").order("category").order("name");
  return data ?? [];
});

export const listLiveOrders = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("orders")
    .select("id,order_no,table_no,customer_name,payment_method,status,total,proof_path,created_at,order_items(name,qty,price)")
    .eq("source", "meja")
    .in("status", ["menunggu_bukti", "menunggu_pembayaran", "menunggu_validasi"])
    .order("created_at", { ascending: true });
  return data ?? [];
});

export const getProofUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("proof_path").eq("id", data.id).single();
    if (!o?.proof_path) return null;
    const { data: s } = await db.storage.from("bukti").createSignedUrl(o.proof_path, 600);
    return s?.signedUrl ?? null;
  });

export const confirmOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), cash_received: z.number().int().min(0).optional() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("total,status,payment_method").eq("id", data.id).single();
    if (!o) throw new Error("Pesanan tidak ditemukan");
    if (o.status === "dikonfirmasi") return { ok: true };
    const patch: { status: string; confirmed_at: string; cash_received?: number; change_amount?: number } = { status: "dikonfirmasi", confirmed_at: new Date().toISOString() };
    if (o.payment_method === "tunai") {
      const cash = data.cash_received ?? o.total;
      if (cash < o.total) throw new Error("Uang kurang");
      patch.cash_received = cash;
      patch.change_amount = cash - o.total;
    }
    await db.from("orders").update(patch).eq("id", data.id);
    await decrementStock(data.id);
    return { ok: true };
  });

export const rejectOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("orders").update({ status: "ditolak" }).eq("id", data.id);
    return { ok: true };
  });

export const posCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ items: itemsSchema, payment_method: z.enum(["tunai", "qris"]), cash_received: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { rows, total, cost_total } = await buildItems(data.items);
    const cash = data.payment_method === "tunai" ? data.cash_received : total;
    if (cash < total) throw new Error("Uang kurang");
    const { data: order, error } = await db
      .from("orders")
      .insert({
        source: "pos",
        payment_method: data.payment_method,
        status: "dikonfirmasi",
        total,
        cost_total,
        cash_received: cash,
        change_amount: cash - total,
        confirmed_at: new Date().toISOString(),
      })
      .select("id,order_no")
      .single();
    if (error) throw new Error(error.message);
    await db.from("order_items").insert(rows.map((r) => ({ ...r, order_id: order.id })));
    await decrementStock(order.id);
    return { order_no: order.order_no, total, change: cash - total };
  });

export const restockProduct = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ product_id: z.string().uuid(), qty: z.number().int().min(1).max(10000), cost: z.number().int().min(0).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: p } = await db.from("products").select("stock").eq("id", data.product_id).single();
    if (!p) throw new Error("Produk tidak ditemukan");
    const patch = data.cost !== undefined ? { stock: p.stock + data.qty, cost: data.cost } : { stock: p.stock + data.qty };
    await db.from("products").update(patch).eq("id", data.product_id);
    await db.from("restocks").insert({ product_id: data.product_id, qty: data.qty, cost: data.cost ?? null });
    return { ok: true };
  });

// ---------- Admin ----------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Khusus admin");
}

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: orders } = await db
      .from("orders")
      .select("id,order_no,source,table_no,payment_method,total,cost_total,confirmed_at")
      .eq("status", "dikonfirmasi")
      .gte("confirmed_at", data.from)
      .lte("confirmed_at", data.to)
      .order("confirmed_at", { ascending: false });
    return orders ?? [];
  });

export const resetRevenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().optional(), to: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    let q = db.from("orders").delete().in("status", ["dikonfirmasi", "ditolak"]);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(80),
      barcode: z.string().max(40).optional(),
      category: z.string().min(1).max(30),
      price: z.number().int().min(0),
      cost: z.number().int().min(0),
      stock: z.number().int().min(0),
      active: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { id, ...rest } = data;
    const row = { ...rest, barcode: rest.barcode || null };
    const { error } = id ? await db.from("products").update(row).eq("id", id) : await db.from("products").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
