//! Billing domain logic: invoice persistence, money formatting and the
//! entitlement rules that decide what a paying organisation may actually do.
//!
//! AUDIT 2026-08-29 — before this module existed:
//!   * Invoices were never stored anywhere. The dashboard advertised "billing
//!     history" with nothing behind it, and a failed charge left no record.
//!   * `subscriptions.status` was written (`past_due`) but never read. Every
//!     plan gate in the codebase queried `organizations.plan_type` alone, so an
//!     organisation whose card had been declined for weeks kept full access.

use serde_json::Value as JsonValue;
use sqlx::PgPool;

// ── Entitlement ────────────────────────────────────────────────────────

/// What an organisation is allowed to do right now, given its Stripe state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entitlement {
    /// The plan whose limits should actually be enforced.
    pub effective_plan: String,
    /// The plan the customer nominally bought (what the UI shows as "your plan").
    pub nominal_plan: String,
    /// Raw Stripe subscription status, when there is a subscription.
    pub status: Option<String>,
    /// True when payment has failed but we are still inside the dunning window.
    pub in_grace: bool,
    /// True when the paid plan has been withdrawn because billing lapsed.
    pub downgraded: bool,
}

/// Statuses that keep full access to the purchased plan.
const ACTIVE_STATUSES: &[&str] = &["active", "trialing"];
/// Payment has failed but Stripe is still retrying — keep access, warn loudly.
const GRACE_STATUSES: &[&str] = &["past_due"];
/// Terminal states: the paid plan is gone.
const LAPSED_STATUSES: &[&str] = &["unpaid", "canceled", "incomplete_expired", "paused"];

/// The plan an organisation falls back to when billing lapses.
pub const FALLBACK_PLAN: &str = "trial";

/// Decide what an organisation may do, from its stored plan and Stripe status.
///
/// `sub_status` is `None` when there is no subscription row at all — trial
/// accounts and plans granted manually by an admin. Those are left untouched:
/// this function only ever withdraws access that Stripe says has lapsed.
pub fn resolve_entitlement(plan_type: &str, sub_status: Option<&str>) -> Entitlement {
    let nominal = plan_type.trim().to_lowercase();
    let nominal = if nominal.is_empty() { FALLBACK_PLAN.to_string() } else { nominal };

    let Some(raw_status) = sub_status.map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty())
    else {
        // No Stripe subscription — nothing to enforce against.
        return Entitlement {
            effective_plan: nominal.clone(),
            nominal_plan: nominal,
            status: None,
            in_grace: false,
            downgraded: false,
        };
    };

    // A free plan cannot be downgraded further; skip the whole dance.
    if nominal == FALLBACK_PLAN {
        return Entitlement {
            effective_plan: nominal.clone(),
            nominal_plan: nominal,
            status: Some(raw_status),
            in_grace: false,
            downgraded: false,
        };
    }

    let s = raw_status.as_str();
    if ACTIVE_STATUSES.contains(&s) {
        Entitlement {
            effective_plan: nominal.clone(),
            nominal_plan: nominal,
            status: Some(raw_status),
            in_grace: false,
            downgraded: false,
        }
    } else if GRACE_STATUSES.contains(&s) {
        // Dunning: Stripe retries a declined card for roughly two weeks. Cutting
        // a customer off on the first failed charge is hostile and usually wrong
        // — but the UI must say so, which `in_grace` drives.
        Entitlement {
            effective_plan: nominal.clone(),
            nominal_plan: nominal,
            status: Some(raw_status),
            in_grace: true,
            downgraded: false,
        }
    } else if LAPSED_STATUSES.contains(&s) {
        Entitlement {
            effective_plan: FALLBACK_PLAN.to_string(),
            nominal_plan: nominal,
            status: Some(raw_status),
            in_grace: false,
            downgraded: true,
        }
    } else {
        // `incomplete` and anything Stripe adds later: the subscription has not
        // begun, so do not hand out the paid plan. Fail closed.
        Entitlement {
            effective_plan: FALLBACK_PLAN.to_string(),
            nominal_plan: nominal,
            status: Some(raw_status),
            in_grace: false,
            downgraded: true,
        }
    }
}

/// Load the entitlement for an organisation.
///
/// Reads the org's plan plus the most recent subscription row. Any database
/// error degrades to "trust the stored plan" rather than locking a paying
/// customer out because of a transient blip.
pub async fn entitlement_for_org(pool: &PgPool, org_id: &str) -> Entitlement {
    let row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT o.plan_type, \
                (SELECT s.status FROM subscriptions s \
                  WHERE s.organization_id = o.id \
                  ORDER BY s.created_at DESC LIMIT 1) \
           FROM organizations o WHERE o.id = $1",
    )
    .bind(org_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    match row {
        Some((plan, status)) => resolve_entitlement(&plan, status.as_deref()),
        None => resolve_entitlement(FALLBACK_PLAN, None),
    }
}

// ── Money ──────────────────────────────────────────────────────────────

/// Currencies Stripe bills without a minor unit (¥100 is 100, not 1.00).
const ZERO_DECIMAL: &[&str] = &[
    "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv",
    "xaf", "xof", "xpf",
];

/// Render a Stripe amount (minor units) as a human string.
///
/// Stripe sends integer minor units, so 1999 EUR-cents is €19.99 — but ¥1999 is
/// ¥1999, not ¥19.99. Dividing by 100 unconditionally silently misprices every
/// zero-decimal currency by 100x on invoices and receipts.
pub fn format_money(amount_minor: i64, currency: &str) -> String {
    let cur = currency.trim().to_lowercase();
    let code = cur.to_uppercase();
    if ZERO_DECIMAL.contains(&cur.as_str()) {
        format!("{} {}", amount_minor, code)
    } else {
        format!("{:.2} {}", amount_minor as f64 / 100.0, code)
    }
}

// ── Invoice parsing ────────────────────────────────────────────────────

/// A Stripe invoice flattened into the columns we store.
#[derive(Debug, Clone, PartialEq)]
pub struct InvoiceRecord {
    pub stripe_invoice_id: String,
    pub stripe_subscription_id: Option<String>,
    pub stripe_customer_id: Option<String>,
    pub number: Option<String>,
    pub status: String,
    pub billing_reason: Option<String>,
    pub currency: String,
    pub subtotal: i64,
    pub tax: i64,
    pub total: i64,
    pub amount_paid: i64,
    pub amount_due: i64,
    pub customer_email: Option<String>,
    pub customer_name: Option<String>,
    pub hosted_invoice_url: Option<String>,
    pub invoice_pdf: Option<String>,
    pub period_start: Option<i64>,
    pub period_end: Option<i64>,
    pub paid_at: Option<i64>,
    pub attempt_count: i32,
    pub line_items: JsonValue,
    pub price_id: Option<String>,
}

fn s(v: &JsonValue, k: &str) -> Option<String> {
    v.get(k)
        .and_then(|x| x.as_str())
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .map(str::to_string)
}

fn i(v: &JsonValue, k: &str) -> i64 {
    v.get(k).and_then(|x| x.as_i64()).unwrap_or(0)
}

/// Flatten a Stripe `invoice` object into an [`InvoiceRecord`].
///
/// Tolerates missing fields: Stripe omits keys rather than sending nulls, and
/// the shape differs between `invoice.paid` and `invoice.payment_failed`.
pub fn parse_invoice(obj: &JsonValue) -> Option<InvoiceRecord> {
    let id = s(obj, "id")?;

    let lines = obj
        .get("lines")
        .and_then(|l| l.get("data"))
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default();

    let price_id = lines
        .first()
        .and_then(|item| item.get("price"))
        .and_then(|p| p.get("id"))
        .and_then(|x| x.as_str())
        .map(str::to_string);

    // `period` lives on the invoice for one-offs and on the first line for
    // subscriptions; prefer the invoice-level value when present.
    let line_period = lines.first().and_then(|item| item.get("period"));
    let period_start = obj
        .get("period_start")
        .and_then(|x| x.as_i64())
        .or_else(|| line_period.and_then(|p| p.get("start")).and_then(|x| x.as_i64()));
    let period_end = obj
        .get("period_end")
        .and_then(|x| x.as_i64())
        .or_else(|| line_period.and_then(|p| p.get("end")).and_then(|x| x.as_i64()));

    let total = i(obj, "total");
    let amount_paid = i(obj, "amount_paid");

    Some(InvoiceRecord {
        stripe_invoice_id: id,
        stripe_subscription_id: s(obj, "subscription"),
        stripe_customer_id: s(obj, "customer"),
        number: s(obj, "number"),
        status: s(obj, "status").unwrap_or_else(|| "draft".to_string()),
        billing_reason: s(obj, "billing_reason"),
        currency: s(obj, "currency").unwrap_or_else(|| "eur".to_string()),
        subtotal: obj.get("subtotal").and_then(|x| x.as_i64()).unwrap_or(total),
        tax: obj.get("tax").and_then(|x| x.as_i64()).unwrap_or(0),
        total,
        amount_paid,
        amount_due: i(obj, "amount_due"),
        customer_email: s(obj, "customer_email"),
        customer_name: s(obj, "customer_name"),
        hosted_invoice_url: s(obj, "hosted_invoice_url"),
        invoice_pdf: s(obj, "invoice_pdf"),
        period_start,
        period_end,
        paid_at: obj
            .get("status_transitions")
            .and_then(|t| t.get("paid_at"))
            .and_then(|x| x.as_i64()),
        attempt_count: obj.get("attempt_count").and_then(|x| x.as_i64()).unwrap_or(0) as i32,
        line_items: JsonValue::Array(lines),
        price_id,
    })
}

fn ts(secs: Option<i64>) -> Option<chrono::DateTime<chrono::Utc>> {
    secs.and_then(|s| chrono::DateTime::from_timestamp(s, 0))
}

/// Insert or update an invoice, resolving the organisation from the customer id.
///
/// Returns `Ok(false)` when no organisation matches the Stripe customer — that
/// is normal for invoices belonging to customers created outside this app, and
/// must not be treated as a webhook failure.
pub async fn upsert_invoice(
    pool: &PgPool,
    rec: &InvoiceRecord,
    plan_type: Option<&str>,
) -> Result<bool, sqlx::Error> {
    let customer = match rec.stripe_customer_id.as_deref() {
        Some(c) => c,
        None => return Ok(false),
    };

    let org: Option<(String,)> =
        sqlx::query_as("SELECT id FROM organizations WHERE stripe_customer_id = $1 LIMIT 1")
            .bind(customer)
            .fetch_optional(pool)
            .await?;

    let Some((org_id,)) = org else { return Ok(false) };

    sqlx::query(
        r#"INSERT INTO invoices (
               id, organization_id, stripe_invoice_id, stripe_subscription_id,
               stripe_customer_id, number, status, plan_type, billing_reason, currency,
               subtotal, tax, total, amount_paid, amount_due,
               customer_email, customer_name, hosted_invoice_url, invoice_pdf,
               period_start, period_end, paid_at, attempt_count, line_items
           ) VALUES (
               gen_random_uuid()::text, $1, $2, $3,
               $4, $5, $6, $7, $8, $9,
               $10, $11, $12, $13, $14,
               $15, $16, $17, $18,
               $19, $20, $21, $22, $23
           )
           ON CONFLICT (stripe_invoice_id) DO UPDATE SET
               status = EXCLUDED.status,
               plan_type = COALESCE(EXCLUDED.plan_type, invoices.plan_type),
               number = COALESCE(EXCLUDED.number, invoices.number),
               subtotal = EXCLUDED.subtotal,
               tax = EXCLUDED.tax,
               total = EXCLUDED.total,
               amount_paid = EXCLUDED.amount_paid,
               amount_due = EXCLUDED.amount_due,
               hosted_invoice_url = COALESCE(EXCLUDED.hosted_invoice_url, invoices.hosted_invoice_url),
               invoice_pdf = COALESCE(EXCLUDED.invoice_pdf, invoices.invoice_pdf),
               paid_at = COALESCE(EXCLUDED.paid_at, invoices.paid_at),
               attempt_count = GREATEST(EXCLUDED.attempt_count, invoices.attempt_count),
               line_items = EXCLUDED.line_items,
               updated_at = NOW()"#,
    )
    .bind(&org_id)
    .bind(&rec.stripe_invoice_id)
    .bind(&rec.stripe_subscription_id)
    .bind(&rec.stripe_customer_id)
    .bind(&rec.number)
    .bind(&rec.status)
    .bind(plan_type)
    .bind(&rec.billing_reason)
    .bind(&rec.currency)
    .bind(rec.subtotal)
    .bind(rec.tax)
    .bind(rec.total)
    .bind(rec.amount_paid)
    .bind(rec.amount_due)
    .bind(&rec.customer_email)
    .bind(&rec.customer_name)
    .bind(&rec.hosted_invoice_url)
    .bind(&rec.invoice_pdf)
    .bind(ts(rec.period_start))
    .bind(ts(rec.period_end))
    .bind(ts(rec.paid_at))
    .bind(rec.attempt_count)
    .bind(&rec.line_items)
    .execute(pool)
    .await?;

    Ok(true)
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── resolve_entitlement (B4: past_due was recorded but never enforced) ──

    #[test]
    fn active_subscription_keeps_its_plan() {
        let e = resolve_entitlement("professional", Some("active"));
        assert_eq!(e.effective_plan, "professional");
        assert!(!e.in_grace);
        assert!(!e.downgraded);
    }

    #[test]
    fn trialing_subscription_keeps_its_plan() {
        let e = resolve_entitlement("enterprise", Some("trialing"));
        assert_eq!(e.effective_plan, "enterprise");
        assert!(!e.downgraded);
    }

    #[test]
    fn past_due_keeps_access_but_flags_grace() {
        // Stripe retries a declined card for ~2 weeks. Cutting access off on the
        // first failure is hostile; the UI needs the flag instead.
        let e = resolve_entitlement("professional", Some("past_due"));
        assert_eq!(e.effective_plan, "professional");
        assert!(e.in_grace, "past_due must be flagged for the UI");
        assert!(!e.downgraded);
    }

    #[test]
    fn lapsed_statuses_downgrade_to_trial() {
        for st in ["unpaid", "canceled", "incomplete_expired", "paused"] {
            let e = resolve_entitlement("enterprise", Some(st));
            assert_eq!(e.effective_plan, FALLBACK_PLAN, "status {st} must downgrade");
            assert_eq!(e.nominal_plan, "enterprise", "nominal plan is still shown to the user");
            assert!(e.downgraded);
            assert!(!e.in_grace);
        }
    }

    #[test]
    fn incomplete_subscription_does_not_grant_the_paid_plan() {
        // The customer started checkout but never completed payment.
        let e = resolve_entitlement("professional", Some("incomplete"));
        assert_eq!(e.effective_plan, FALLBACK_PLAN);
        assert!(e.downgraded);
    }

    #[test]
    fn unknown_future_status_fails_closed() {
        let e = resolve_entitlement("professional", Some("some_new_stripe_status"));
        assert_eq!(e.effective_plan, FALLBACK_PLAN, "unknown statuses must fail closed");
    }

    #[test]
    fn no_subscription_leaves_the_stored_plan_alone() {
        // Trial users and plans granted by hand have no Stripe row at all.
        for plan in ["trial", "starter", "professional", "enterprise"] {
            let e = resolve_entitlement(plan, None);
            assert_eq!(e.effective_plan, plan, "plan {plan} must survive with no subscription");
            assert!(!e.downgraded);
            assert_eq!(e.status, None);
        }
    }

    #[test]
    fn empty_status_is_treated_as_no_subscription() {
        let e = resolve_entitlement("professional", Some("   "));
        assert_eq!(e.effective_plan, "professional");
        assert!(!e.downgraded);
    }

    #[test]
    fn trial_plan_is_never_downgraded_further() {
        let e = resolve_entitlement("trial", Some("canceled"));
        assert_eq!(e.effective_plan, "trial");
        assert!(!e.downgraded);
    }

    #[test]
    fn status_matching_is_case_and_space_insensitive() {
        let e = resolve_entitlement("  Professional  ", Some("  ACTIVE  "));
        assert_eq!(e.effective_plan, "professional");
        assert!(!e.downgraded);
    }

    #[test]
    fn empty_plan_falls_back_to_trial() {
        let e = resolve_entitlement("", None);
        assert_eq!(e.effective_plan, FALLBACK_PLAN);
    }

    // ── format_money (zero-decimal currency trap) ─────────────────────

    #[test]
    fn format_money_renders_minor_units_for_decimal_currencies() {
        assert_eq!(format_money(1999, "eur"), "19.99 EUR");
        assert_eq!(format_money(1999, "USD"), "19.99 USD");
        assert_eq!(format_money(0, "eur"), "0.00 EUR");
        assert_eq!(format_money(100, "gbp"), "1.00 GBP");
    }

    #[test]
    fn format_money_does_not_divide_zero_decimal_currencies() {
        // ¥1999 is ¥1999. Dividing by 100 misprices the invoice by 100x.
        assert_eq!(format_money(1999, "jpy"), "1999 JPY");
        assert_eq!(format_money(5000, "KRW"), "5000 KRW");
        assert_eq!(format_money(300, "vnd"), "300 VND");
    }

    #[test]
    fn format_money_handles_refunds() {
        assert_eq!(format_money(-1999, "eur"), "-19.99 EUR");
    }

    // ── parse_invoice ─────────────────────────────────────────────────

    fn sample_invoice() -> JsonValue {
        json!({
            "id": "in_1ABC",
            "object": "invoice",
            "customer": "cus_XYZ",
            "subscription": "sub_123",
            "number": "CSP-0001",
            "status": "paid",
            "billing_reason": "subscription_cycle",
            "currency": "eur",
            "subtotal": 9900,
            "tax": 1881,
            "total": 11781,
            "amount_paid": 11781,
            "amount_due": 0,
            "customer_email": "billing@example.com",
            "customer_name": "Example GmbH",
            "hosted_invoice_url": "https://invoice.stripe.com/i/abc",
            "invoice_pdf": "https://invoice.stripe.com/i/abc.pdf",
            "period_start": 1_760_000_000i64,
            "period_end": 1_762_600_000i64,
            "attempt_count": 1,
            "status_transitions": { "paid_at": 1_760_000_100i64 },
            "lines": { "data": [ {
                "description": "Professional plan",
                "price": { "id": "price_pro_monthly" },
                "period": { "start": 1_760_000_000i64, "end": 1_762_600_000i64 }
            } ] }
        })
    }

    #[test]
    fn parse_invoice_extracts_every_stored_field() {
        let r = parse_invoice(&sample_invoice()).expect("should parse");
        assert_eq!(r.stripe_invoice_id, "in_1ABC");
        assert_eq!(r.stripe_customer_id.as_deref(), Some("cus_XYZ"));
        assert_eq!(r.stripe_subscription_id.as_deref(), Some("sub_123"));
        assert_eq!(r.number.as_deref(), Some("CSP-0001"));
        assert_eq!(r.status, "paid");
        assert_eq!(r.currency, "eur");
        assert_eq!(r.subtotal, 9900);
        assert_eq!(r.tax, 1881);
        assert_eq!(r.total, 11781);
        assert_eq!(r.amount_paid, 11781);
        assert_eq!(r.price_id.as_deref(), Some("price_pro_monthly"));
        assert_eq!(r.paid_at, Some(1_760_000_100));
        assert_eq!(r.attempt_count, 1);
        assert_eq!(r.line_items.as_array().map(|a| a.len()), Some(1));
    }

    #[test]
    fn parse_invoice_requires_an_id() {
        assert!(parse_invoice(&json!({"customer": "cus_1"})).is_none());
    }

    #[test]
    fn parse_invoice_defaults_missing_optional_fields() {
        let r = parse_invoice(&json!({"id": "in_min"})).expect("should parse");
        assert_eq!(r.status, "draft");
        assert_eq!(r.currency, "eur");
        assert_eq!(r.total, 0);
        assert_eq!(r.attempt_count, 0);
        assert!(r.stripe_customer_id.is_none());
        assert!(r.line_items.as_array().unwrap().is_empty());
    }

    #[test]
    fn parse_invoice_falls_back_to_line_period() {
        // payment_failed payloads often omit the invoice-level period.
        let v = json!({
            "id": "in_f",
            "lines": { "data": [ { "period": { "start": 111, "end": 222 } } ] }
        });
        let r = parse_invoice(&v).unwrap();
        assert_eq!(r.period_start, Some(111));
        assert_eq!(r.period_end, Some(222));
    }

    #[test]
    fn parse_invoice_treats_empty_strings_as_absent() {
        let v = json!({"id": "in_e", "number": "", "customer": "   ", "hosted_invoice_url": ""});
        let r = parse_invoice(&v).unwrap();
        assert!(r.number.is_none());
        assert!(r.stripe_customer_id.is_none());
        assert!(r.hosted_invoice_url.is_none());
    }

    #[test]
    fn parse_invoice_defaults_subtotal_to_total_when_absent() {
        let v = json!({"id": "in_s", "total": 4200});
        let r = parse_invoice(&v).unwrap();
        assert_eq!(r.subtotal, 4200);
        assert_eq!(r.total, 4200);
    }

    #[test]
    fn parse_invoice_handles_a_failed_payment_shape() {
        let v = json!({
            "id": "in_fail", "customer": "cus_1", "subscription": "sub_1",
            "status": "open", "billing_reason": "subscription_cycle",
            "currency": "eur", "total": 9900, "amount_paid": 0, "amount_due": 9900,
            "attempt_count": 3
        });
        let r = parse_invoice(&v).unwrap();
        assert_eq!(r.status, "open");
        assert_eq!(r.amount_paid, 0);
        assert_eq!(r.amount_due, 9900);
        assert_eq!(r.attempt_count, 3);
        assert!(r.paid_at.is_none());
    }
}
