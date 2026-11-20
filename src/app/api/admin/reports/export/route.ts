import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/guards";

// CSV exports for an accountant. Headers in Indonesian; amounts as plain
// integers with no thousands separators, currency symbol or parentheses —
// formatting is what makes a spreadsheet read a number as text.

const n = (v: unknown) => Math.round(Number(v ?? 0));

function csv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens UTF-8 correctly — without it Indonesian text mangles.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

function download(body: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "ledger";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const admin = createAdminClient();

  const stamp = new Date().toISOString().slice(0, 10);

  // A guest exporting their own statement is the one non-admin case.
  if (type === "my_statement") {
    const months = Number(searchParams.get("months") ?? 6);
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - (Number.isFinite(months) ? months : 6));

    const { data } = await admin
      .from("ledger_entries")
      .select("entry_date, event_type, account, direction, amount")
      .eq("user_id", viewer.id)
      .gte("entry_date", since.toISOString())
      .order("entry_date", { ascending: false });

    return download(
      csv([
        ["Tanggal", "Peristiwa", "Akun", "Arah", "Jumlah"],
        ...(data ?? []).map((e) => [
          String(e.entry_date).slice(0, 10), e.event_type, e.account, e.direction, n(e.amount),
        ]),
      ]),
      `verihome-rekening-${stamp}.csv`
    );
  }

  if (viewer.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  switch (type) {
    // ── Full ledger for a date range ─────────────────────────────────────────
    case "ledger": {
      let q = admin
        .from("ledger_entries")
        .select("entry_date, event_type, account, direction, amount, description, booking_id, viewing_id, consultation_id, property_id, user_id, owner_id, id")
        .order("entry_date", { ascending: true });
      if (from) q = q.gte("entry_date", from);
      if (to) q = q.lt("entry_date", to);
      const { data } = await q;

      return download(
        csv([
          ["Tanggal", "Peristiwa", "Akun", "Arah", "Jumlah", "Keterangan",
           "ID Pemesanan", "ID Kunjungan", "ID Konsultasi", "ID Properti", "ID Pengguna", "ID Pemilik", "ID Entri"],
          ...(data ?? []).map((e) => [
            String(e.entry_date).slice(0, 19).replace("T", " "),
            e.event_type, e.account, e.direction, n(e.amount), e.description,
            e.booking_id, e.viewing_id, e.consultation_id, e.property_id, e.user_id, e.owner_id, e.id,
          ]),
        ]),
        `verihome-buku-besar-${stamp}.csv`
      );
    }

    // ── Revenue by stream by month ───────────────────────────────────────────
    case "revenue_by_month": {
      const { data } = await admin.rpc("ledger_monthly_revenue", { p_months: 24 });
      const rows = (data ?? []) as Record<string, unknown>[];
      const months = [...new Set(rows.map((r) => String(r.month).slice(0, 7)))].sort();
      const accounts = [...new Set(rows.map((r) => String(r.account)))].sort();

      return download(
        csv([
          ["Bulan", ...accounts, "Total"],
          ...months.map((m) => {
            const vals = accounts.map((a) =>
              n(rows.find((r) => String(r.month).slice(0, 7) === m && r.account === a)?.amount));
            return [m, ...vals, vals.reduce((s, v) => s + v, 0)];
          }),
        ]),
        `verihome-pendapatan-per-bulan-${stamp}.csv`
      );
    }

    // ── Owner payable summary ────────────────────────────────────────────────
    case "owner_payable": {
      const { data: entries } = await admin
        .from("ledger_entries")
        .select("owner_id, direction, amount, property_id")
        .eq("account", "owner_payable");
      const { data: owners } = await admin.from("owners").select("id, name, email, phone_whatsapp");
      const { data: props } = await admin.from("properties").select("id, owner_id");

      // Entries carry property_id far more often than owner_id, so resolve the
      // owner through the property when it is missing.
      const ownerOfProperty = new Map((props ?? []).map((p) => [p.id, p.owner_id]));
      const totals = new Map<string, number>();
      for (const e of entries ?? []) {
        const oid = (e.owner_id as string) ?? ownerOfProperty.get(e.property_id as string);
        if (!oid) continue;
        const delta = e.direction === "credit" ? n(e.amount) : -n(e.amount);
        totals.set(oid, (totals.get(oid) ?? 0) + delta);
      }

      return download(
        csv([
          ["Pemilik", "Email", "WhatsApp", "Saldo Terhutang"],
          ...(owners ?? [])
            .map((o) => [o.name, o.email, o.phone_whatsapp, totals.get(o.id) ?? 0] as (string | number | null)[])
            .filter((r) => (r[3] as number) !== 0),
        ]),
        `verihome-hutang-pemilik-${stamp}.csv`
      );
    }

    // ── Every transaction with its ledger entries ────────────────────────────
    case "transactions": {
      let q = admin
        .from("ledger_entries")
        .select("entry_date, event_type, account, direction, amount, booking_id, viewing_id, consultation_id")
        .order("entry_date", { ascending: true });
      if (from) q = q.gte("entry_date", from);
      if (to) q = q.lt("entry_date", to);
      const { data: entries } = await q;

      const { data: bookings } = await admin.from("bookings").select("id, booking_code, check_in_date, check_out_date");
      const codeOf = new Map((bookings ?? []).map((b) => [b.id, b.booking_code]));

      return download(
        csv([
          ["Tanggal", "Transaksi", "Referensi", "Peristiwa", "Akun", "Arah", "Jumlah"],
          ...(entries ?? []).map((e) => {
            const kind = e.booking_id ? "Pemesanan" : e.viewing_id ? "Kunjungan"
                       : e.consultation_id ? "Konsultasi" : "Lainnya";
            const ref = e.booking_id ? (codeOf.get(e.booking_id as string) ?? e.booking_id)
                      : (e.viewing_id ?? e.consultation_id ?? "");
            return [
              String(e.entry_date).slice(0, 19).replace("T", " "),
              kind, ref, e.event_type, e.account, e.direction, n(e.amount),
            ];
          }),
        ]),
        `verihome-transaksi-${stamp}.csv`
      );
    }

    default:
      return NextResponse.json(
        { error: `Unknown export type "${type}". Expected: ledger, revenue_by_month, owner_payable, transactions.` },
        { status: 400 }
      );
  }
}
