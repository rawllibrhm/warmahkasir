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
    const { data: activeTable, error: tableError } = await db.rpc("is_active_pos_table", { _table_no: data.table_no });
    if (tableError || !activeTable) throw new Error("Meja tidak aktif atau sudah dihapus");
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
const isWarmahOwner = (ctx: { claims?: { email?: unknown } }) =>
  String(ctx.claims?.email ?? "").toLowerCase() === "warmah@kediri.com";

async function assertAdmin(ctx: { supabase: any; userId: string; claims?: { email?: unknown } }) {
  if (isWarmahOwner(ctx)) return;
  const [adminRole, superAdminRole] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" }),
  ]);
  if (!adminRole.data && !superAdminRole.data) throw new Error("Khusus admin");
}

async function assertSuperAdmin(ctx: { supabase: any; userId: string; claims?: { email?: unknown } }) {
  if (isWarmahOwner(ctx)) return;
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (!error && data) return;
  // Bootstrap: while no Super Admin has been assigned, an existing admin can configure the panel.
  const db = await admin();
  const { data: owners, error: ownersError } = await db.from("user_roles").select("user_id").eq("role", "super_admin").limit(1);
  const { data: adminRole } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (ownersError || owners?.length || !adminRole.data) throw new Error("Fitur ini hanya untuk Super Admin");
}

async function assertCashierOrAdmin(ctx: { supabase: any; userId: string; claims?: { email?: unknown } }) {
  if (isWarmahOwner(ctx)) return;
  const roles = await Promise.all(["kasir", "admin", "super_admin"].map((_role) =>
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role })
  ));
  if (!roles.some((r: { data: boolean | null }) => r.data === true)) {
    throw new Error("Akun tidak memiliki akses kasir");
  }
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


// ---------- Pengaturan Super Admin & meja ----------
export const getPosSettings = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db.from("app_settings").select("key,value").in("key", ["cashier_can_add_products", "cashier_whatsapp_number"]);
  if (error) throw new Error(`Pengaturan POS gagal dimuat: ${error.message}. Jalankan migrasi 0004_cashier_messages_feedback_and_pos_repair.sql dan 0005_cashier_history_whatsapp_replies.sql di Supabase.`);
  const settings = new Map((data ?? []).map((row) => [row.key, row.value]));
  return {
    cashierCanAddProducts: settings.get("cashier_can_add_products") === true,
    whatsappNumber: typeof settings.get("cashier_whatsapp_number") === "string" ? settings.get("cashier_whatsapp_number") as string : "6285142274765",
  };
});

export const setCashierAddProductEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { error } = await db.from("app_settings").upsert({
      key: "cashier_can_add_products",
      value: data.enabled,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { cashierCanAddProducts: data.enabled };
  });

export const createCashierProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().trim().min(1).max(80),
    barcode: z.string().trim().max(40).optional(),
    category: z.string().trim().min(1).max(30),
    price: z.number().int().min(0),
    cost: z.number().int().min(0),
    stock: z.number().int().min(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCashierOrAdmin(context);
    const db = await admin();
    const { data: setting, error: settingError } = await db.from("app_settings").select("value").eq("key", "cashier_can_add_products").maybeSingle();
    if (settingError || setting?.value !== true) throw new Error("Penambahan barang dari kasir belum diaktifkan Super Admin");
    const { error } = await db.from("products").insert({
      name: data.name,
      barcode: data.barcode || null,
      category: data.category,
      price: data.price,
      cost: data.cost,
      stock: data.stock,
      active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPosTables = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db.from("pos_tables").select("table_no,active,created_at").eq("active", true).order("table_no");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const addPosTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ table_no: z.string().trim().min(1).max(10).regex(/^[a-zA-Z0-9-]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("pos_tables").upsert({ table_no: data.table_no, active: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePosTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ table_no: z.string().min(1).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: pending, error: pendingError } = await db.from("orders").select("id").eq("table_no", data.table_no).in("status", ["menunggu_bukti", "menunggu_pembayaran", "menunggu_validasi"]).limit(1);
    if (pendingError) throw new Error(pendingError.message);
    if (pending?.length) throw new Error("Meja masih memiliki pesanan aktif; selesaikan atau tolak pesanan terlebih dahulu");
    const { error } = await db.from("pos_tables").update({ active: false }).eq("table_no", data.table_no);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    // Permanently remove the catalog entry. order_items keeps a snapshot of
    // name, price, cost and quantity; its product_id FK uses ON DELETE SET NULL.
    // Restock history is also preserved by the migration's ON DELETE SET NULL.
    const { data: deleted, error } = await db.from("products").delete().eq("id", data.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Menu tidak ditemukan atau sudah dihapus");
    return { ok: true };
  });

export const getAdminPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [adminRole, superRole] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
    ]);
    const db = await admin();
    const { data: owners, error } = await db.from("user_roles").select("user_id").eq("role", "super_admin").limit(1);
    const bootstrapSuperAdmin = !error && !owners?.length && adminRole.data === true;
    const namedSuperAdmin = isWarmahOwner(context);
    return {
      isAdmin: adminRole.data === true || superRole.data === true || namedSuperAdmin,
      isSuperAdmin: superRole.data === true || bootstrapSuperAdmin || namedSuperAdmin,
    };
  });


// ---------- Pesan admin ke kasir & kritik/saran pelanggan ----------
export const listCashierMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCashierOrAdmin(context);
    const db = await admin();
    const { data, error } = await db.from("pos_messages").select("id,message,created_at,created_by").eq("active", true).order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    const messages = data ?? [];
    if (!messages.length) return [];
    // Hanya pesan yang belum dibalas "Oke" yang dikirim ke layar kasir.
    // Dengan begitu, pesan lama tetap muncul setelah HP offline, tetapi pesan
    // yang sudah diakui tidak muncul lagi setiap kali halaman dibuka.
    const { data: replies, error: repliesError } = await db.from("pos_message_replies")
      .select("message_id")
      .in("message_id", messages.map((message) => message.id));
    if (repliesError) throw new Error(repliesError.message);
    const acknowledged = new Set((replies ?? []).map((reply) => reply.message_id));
    return messages.filter((message) => !acknowledged.has(message.id));
  });

export const sendCashierMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ message: z.string().trim().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { error } = await db.from("pos_messages").insert({ message: data.message, created_by: String(context.claims?.email ?? "Admin") });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitCustomerFeedback = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    table_no: z.string().trim().min(1).max(10),
    customer_name: z.string().trim().max(60).optional(),
    kind: z.enum(["kritik", "saran"]),
    message: z.string().trim().min(3).max(1000),
  }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: activeTable, error: tableError } = await db.rpc("is_active_pos_table", { _table_no: data.table_no });
    if (tableError || !activeTable) throw new Error("Meja tidak aktif. Silakan hubungi kasir.");
    const { error } = await db.from("customer_feedback").insert({
      table_no: data.table_no,
      customer_name: data.customer_name || null,
      kind: data.kind,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const getCashierHistorySecure = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    accessToken: z.string().min(20).max(5000),
  }).parse(d))
  .handler(async ({ data }) => {
    // TanStack Server Functions do not automatically forward the Supabase
    // browser session as an Authorization header. Validate the session token
    // explicitly here rather than treating a missing header as an auth failure.
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Konfigurasi autentikasi belum lengkap.");
    const authClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(data.accessToken);
    const claims = claimsData?.claims;
    const userId = typeof claims?.sub === "string" ? claims.sub : "";
    if (claimsError || !userId) throw new Error("Sesi login tidak valid. Silakan login ulang.");
    const email = String(claims?.email ?? "").toLowerCase();
    const db = await admin();
    if (email !== "warmah@kediri.com") {
      const { data: roles, error: rolesError } = await db.from("user_roles")
        .select("role").eq("user_id", userId).in("role", ["kasir", "admin", "super_admin"]);
      if (rolesError) throw new Error("Gagal memeriksa izin akun.");
      if (!roles?.length) throw new Error("Akun tidak memiliki akses kasir.");
    }
    const { data: orders, error } = await db.from("orders")
      .select("id,order_no,source,table_no,payment_method,total,status,created_at,confirmed_at,order_items(name,qty,price)")
      .eq("status", "dikonfirmasi")
      .gte("confirmed_at", data.from)
      .lte("confirmed_at", data.to)
      .order("confirmed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return orders ?? [];
  });

export const setCashierWhatsappNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().trim().max(20).regex(/^[+0-9\\s()-]*$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { error } = await db.from("app_settings").upsert({
      key: "cashier_whatsapp_number",
      value: data.phone.replace(/[^0-9]/g, ""),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCashierMessageReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { data, error } = await db.from("pos_message_replies")
      .select("id,message_id,reply,created_at,replied_by")
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const acknowledgeCashierMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ message_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCashierOrAdmin(context);
    const db = await admin();
    const { error } = await db.from("pos_message_replies").upsert({
      message_id: data.message_id,
      reply: "Oke",
      replied_by: String(context.claims?.email ?? "Kasir"),
    }, { onConflict: "message_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCustomerFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data, error } = await db.from("customer_feedback").select("id,table_no,customer_name,kind,message,created_at,status").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
