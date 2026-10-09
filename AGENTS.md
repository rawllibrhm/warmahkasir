<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules
- All order/product writes go through server functions in src/lib/pos.functions.ts using the admin client; prices are recomputed server-side so customers cannot tamper with totals.
- Cashier page is intentionally accountless; admin functions are protected by requireSupabaseAuth + has_role('admin').
- Live updates use short polling (2.5–3s) instead of realtime subscriptions, because order tables have no public read access.
- Payment proofs live in the private "bukti" bucket; cashiers view them through short-lived signed URLs.
