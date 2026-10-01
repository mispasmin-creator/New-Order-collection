# Supabase Data Flow – Order Collection System

Ye document batata hai ki system ka har page Supabase se **kaunsi table / bucket / RPC** se data **read** karta hai aur kahan **write (insert / update / upsert / delete)** karta hai.

> Line numbers `components/...` files ke hain (clickable). Sab calls ek hi client se jaati hain: [lib/supabaseClient.js](lib/supabaseClient.js).

---

## 1. Connection Setup

| Item | Detail |
|---|---|
| Client file | [lib/supabaseClient.js](lib/supabaseClient.js) – `createClient(url, anonKey)` |
| Env vars | `NEXT_PUBLIC_SUPABASE_PROJECT_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Key type | **Anon key** (browser se direct calls – koi backend API nahi) |
| Auth | Supabase Auth use **nahi** hota. Login `USER` table se username/password match karke hota hai |
| Storage bucket | `images` (sab uploads – SO, PI, bilty, bill, TC, debit note, etc.) |
| Storage helper | [lib/storageUtils.js](lib/storageUtils.js) – `getSignedUrl()` → `images` bucket ka 1-hour signed URL |
| Realtime | Use nahi ho raha (koi `channel()` / `subscribe()` nahi) |

---

## 2. Database Objects (Summary)

### 2.1 Tables

| Table | Purpose | Main Pages (Write) |
|---|---|---|
| `USER` | Login users, roles, firm access | Manage Users |
| `MASTER` | Dropdown master data (Firm, Party, Product, Transporter…) | Dashboard (add master), Order Form (read) |
| `ORDER RECEIPT` | PO / Order header + stage columns (`Actual 1/2`, `Planned 2/3`, `logistics_status`, payment cols) | Order, Check PO, Received Accounts, Check Delivery, Arrange Logistics, Logistics Approval, Dispatch Planning, TC |
| `po_logistics_plans` | Logistics plan per PO (Pending Approval / Approved / Rejected) | Arrange Logistics, Logistics Approval, Dispatch Planning, Order |
| `po_logistics_splits` | Transporter-wise qty split per plan (Checked → Dispatched → Accounts Approved → Logistic Completed) | Arrange Logistics, Logistics Approval, Dispatch Planning, Accounts Approval, Logistic, Order |
| `po_pi_records` | Proforma Invoice slabs & payment tracking | Make PI, Received PI Payment |
| `po_retention_records` | Retention payment tracking per PO | Retention |
| `DISPATCH` | Dispatch rows (`D-Sr Number`) + stage columns `Planned1-4 / Actual1-4` | Dispatch Planning, Logistic, Load Material, Wetman Entry, Invoice, Fullkitting, TC, Bilty Update |
| `SALE FORM 3` | Approval step after Invoice (1 row per `dispatch_id`) | Invoice (upsert), Sale Form 3 |
| `DELIVERY` | Delivery rows (bill / bilty) | Sale Form 3, TC, Fullkitting, Invoice (admin edit), Bilty Update, CRM |
| `POST DELIVERY` | Material receipt / post-delivery details | Material Receipt, CRM, Invoice (admin edit) |
| `Material Return` | Return from party, debit note, management approval, return transport | Material Return, Management Approval, Debit Note, Return of Material |
| `PARTY LEDGER` / `PAYMENT COLLECTION` / `RECEIVED ACCOUNTS` … | Dashboard ledger lookups (sab case-variants try kiye jaate hain, jo exist kare) | Dashboard (read only) |

### 2.2 RPC Functions (Postgres)

| RPC | Kya karta hai | Kahan call hota hai |
|---|---|---|
| `next_do_number` | Naya DO (Delivery Order) number | Order Form – [OrderForm.jsx:599](components/forms/OrderForm.jsx#L599) |
| `next_d_sr_number` | Naya `D-Sr Number` (Dispatch) | Dispatch Planning – [DispatchPlanningPage.jsx:617](components/pages/DispatchPlanningPage.jsx#L617) |
| `next_lgst_number` | Naya `LGST-Sr Number` | Logistic – [LogisticPage.jsx:311](components/pages/LogisticPage.jsx#L311) |

> Note: in RPCs ki definition `supabase/migrations/` me nahi hai – ye direct Supabase DB me bani hain.

### 2.3 Triggers

| Trigger | Table | Kaam |
|---|---|---|
| `trg_dispatch_workflow` ([dispatch_trigger_update.sql](supabase/migrations/dispatch_trigger_update.sql)) | `DISPATCH` | INSERT pe `Planned1 = Timestamp`; `ActualN` set hone pe `Planned(N+1) = ActualN`; `Delay1-4` (hours) calculate; `"Order Receipt id" = po_id` |
| `enforce_max_transporters` ([logistics_schema.sql](supabase/migrations/logistics_schema.sql)) | `po_transporters` | Max transporters limit |

> `DISPATCH` ka stage chain isi trigger se chalta hai: Load Material (`Actual1`) → Wetman (`Planned3`) → Invoice (`Planned4`/`Actual4`) …

---

## 3. Overall Flow (High Level)

```
Login (USER)
   │
Order ──► ORDER RECEIPT (insert, DO no. via rpc next_do_number)
   │
Make PI ──► po_pi_records ──► Received PI Payment
   │
Check PO (Actual 1 / Planned 2) ──► Received Accounts (Actual 2 / Planned 3)
   │
Check for Delivery (check_delivery_*)
   │
Arrange Logistics ──► po_logistics_plans + po_logistics_splits (Pending Approval)
   │
Logistics Approval ──► splits = Checked, plan = Approved
   │
Dispatch Planning ──► DISPATCH insert (rpc next_d_sr_number), split = Dispatched
   │
Accounts Approval ──► split = Accounts Approved
   │
Logistic ──► DISPATCH update (rpc next_lgst_number), split = Logistic Completed
   │
Load Material (DISPATCH Planned2 → Actual)
   │
Wetman Entry (DISPATCH Planned3 → Actual)
   │
Invoice (DISPATCH Actual4 + SALE FORM 3 upsert Pending)
   │
Sale Form 3 (Approve → DELIVERY insert)
   │
Fullkitting / TC (DISPATCH + DELIVERY)
   │
Bilty Update (DELIVERY + DISPATCH bilty) ──► Material Receipt (POST DELIVERY)
   │
CRM (POST DELIVERY insert, DELIVERY Actual4)
   │
Retention (po_retention_records)

Material Return ──► Management Approval ──► Debit Note ──► Return of Material
                (all on "Material Return" table)
```

---

## 4. Page-wise Detail

Legend: **R** = Read (select), **I** = Insert, **U** = Update, **UP** = Upsert, **D** = Delete, **S** = Storage upload, **RPC** = function call

### 4.0 Login & Auth

| File | Op | Table | Filter / Detail |
|---|---|---|---|
| [LoginForm.jsx:25](components/LoginForm.jsx#L25) | R | `USER` | `.eq(Username).eq(Password).single()` |
| [AuthProvider.jsx:27](components/providers/AuthProvider.jsx#L27) | R | `USER` | `refreshUserData` – `.eq(id)` (latest role/firm access) |

---

### 4.1 Dashboard — `/dashboard`
Component: [Dashboard.jsx](components/pages/Dashboard.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [623-628](components/pages/Dashboard.jsx#L623) | R | `ORDER RECEIPT`, `DISPATCH`, `DELIVERY`, `POST DELIVERY`, `po_pi_records`, `po_retention_records` | `select('*')` parallel (30 sec cache) |
| [631](components/pages/Dashboard.jsx#L631) | R | `PARTY_LEDGER_TABLES` list ([L121](components/pages/Dashboard.jsx#L121)) | Ledger tables – missing table error ignore |
| [359](components/pages/Dashboard.jsx#L359) | I | `MASTER` | Naya master value add (Party ke saath Address + GST) |

---

### 4.2 Process Dashboard — `/process-dashboard`
Component: [ProcessDashboard.jsx](components/pages/ProcessDashboard.jsx) — **Read only**

| Line | Op | Table | Detail |
|---|---|---|---|
| [80](components/pages/ProcessDashboard.jsx#L80) | R | `ORDER RECEIPT` | `*` (user firms filter) |
| [90](components/pages/ProcessDashboard.jsx#L90) | R | `DISPATCH` | `*` |
| [93](components/pages/ProcessDashboard.jsx#L93) | R | `DELIVERY` | `Planned 3` not null |
| [96](components/pages/ProcessDashboard.jsx#L96) | R | `POST DELIVERY` | `*` |
| [99](components/pages/ProcessDashboard.jsx#L99) | R | `po_logistics_splits` | `*` |
| [102](components/pages/ProcessDashboard.jsx#L102) | R | `Material Return` | `*` |
| [105](components/pages/ProcessDashboard.jsx#L105) | R | `po_retention_records` | `po_number, status` |
| [107](components/pages/ProcessDashboard.jsx#L107) | R | `po_pi_records` | `po_number, status, firm_name` |
| [110](components/pages/ProcessDashboard.jsx#L110) | R | `SALE FORM 3` | `dispatch_id, Status` |

---

### 4.3 Order — `/order`
Components: [OrderPage.jsx](components/pages/OrderPage.jsx), [OrderForm.jsx](components/forms/OrderForm.jsx)

| File:Line | Op | Table / Bucket | Detail |
|---|---|---|---|
| [OrderPage:167](components/pages/OrderPage.jsx#L167) | R | `ORDER RECEIPT` | `*` order by id desc |
| [OrderPage:332-347](components/pages/OrderPage.jsx#L332) | S + U | `images` → `ORDER RECEIPT` | SO upload → `Upload SO` |
| [OrderPage:605](components/pages/OrderPage.jsx#L605) | R | `ORDER RECEIPT` | Cancel ke liye Quantity / Delivered / Pending / Cancelled Qty |
| [OrderPage:642](components/pages/OrderPage.jsx#L642) | U | `ORDER RECEIPT` | Cancel qty update |
| [OrderPage:652-653](components/pages/OrderPage.jsx#L652) | U | `po_logistics_plans`, `po_logistics_splits` | `status = Rejected` for that `po_id` |
| [OrderForm:200](components/forms/OrderForm.jsx#L200) | R | `ORDER RECEIPT` | Last 50 DO numbers |
| [OrderForm:236](components/forms/OrderForm.jsx#L236) | R | `MASTER` | Dropdown data |
| [OrderForm:567-586](components/forms/OrderForm.jsx#L567) | S | `images` | PO / attachments |
| [OrderForm:599](components/forms/OrderForm.jsx#L599) | RPC | `next_do_number` | DO number generate |
| [OrderForm:622](components/forms/OrderForm.jsx#L622) | I | `ORDER RECEIPT` | Har product ki ek row |

---

### 4.4 Make PI — `/payments-pi`
Component: [MakePIPage.jsx](components/pages/MakePIPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [101](components/pages/MakePIPage.jsx#L101) | R | `ORDER RECEIPT` | `Actual 2` not null |
| [102](components/pages/MakePIPage.jsx#L102) | R | `po_pi_records` | `po_number, status, expected_amount, pi_quantity` |
| [226](components/pages/MakePIPage.jsx#L226) | R | `po_logistics_splits` | Dispatched / Logistic Completed / Accounts Approved qty |
| [290-292](components/pages/MakePIPage.jsx#L290) | S | `images` | PI copy |
| [322](components/pages/MakePIPage.jsx#L322) | I | `po_pi_records` | Naya PI slab |

> [PaymentsAndPIPage.jsx](components/pages/PaymentsAndPIPage.jsx) kisi route me use **nahi** ho raha (purana page). Wo `ORDER RECEIPT` read + `payment_received*` update karta tha.

---

### 4.5 Received PI Payment — `/received-pi-payment`
Component: [ReceivedPIPaymentPage.jsx](components/pages/ReceivedPIPaymentPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [187](components/pages/ReceivedPIPaymentPage.jsx#L187) | R | `po_pi_records` | `*` by created_at desc |
| [255](components/pages/ReceivedPIPaymentPage.jsx#L255) | U | `po_pi_records` | Full received → `status=Received`, `actual_amount`, `payment_log` |
| [287](components/pages/ReceivedPIPaymentPage.jsx#L287) | U | `po_pi_records` | Partial payment → `Partial` / `Received` |
| [317](components/pages/ReceivedPIPaymentPage.jsx#L317) | U | `po_pi_records` | Reschedule → `due_date`, `reschedule_log` |

---

### 4.6 Check PO — `/check-po`
Component: [CheckPOPage.jsx](components/pages/CheckPOPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [101](components/pages/CheckPOPage.jsx#L101) | R | `ORDER RECEIPT` | `*` |
| [318](components/pages/CheckPOPage.jsx#L318) | U | `ORDER RECEIPT` | `Actual 1`, `Planned 2`, `Expected Delivery Date` |

---

### 4.7 Received Accounts — `/received-accounts`
Component: [ReceivedAccounts.jsx](components/pages/ReceivedAccounts.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [93](components/pages/ReceivedAccounts.jsx#L93) | R | `ORDER RECEIPT` | `*` |
| [330](components/pages/ReceivedAccounts.jsx#L330) | U | `ORDER RECEIPT` | `Actual 2`, `Planned 3` |

---

### 4.8 Check for Delivery — `/check-delivery`
Component: [CheckDeliveryPage.jsx](components/pages/CheckDeliveryPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [76](components/pages/CheckDeliveryPage.jsx#L76) | R | `ORDER RECEIPT` | `Actual 2` not null |
| [236](components/pages/CheckDeliveryPage.jsx#L236) | U | `ORDER RECEIPT` | `check_delivery_*` columns (in-stock, actual etc.) |

---

### 4.9 Arrange Logistics — `/arrange-logistics`
Component: [ArrangeLogistics.jsx](components/pages/ArrangeLogistics.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [141](components/pages/ArrangeLogistics.jsx#L141) | R | `MASTER` | `Transporter Name` list |
| [165](components/pages/ArrangeLogistics.jsx#L165) | R | `ORDER RECEIPT` | `Actual 2` & `check_delivery_actual` not null |
| [189](components/pages/ArrangeLogistics.jsx#L189) | R | `po_logistics_splits` | Previous transporter / vehicle / rate |
| [351](components/pages/ArrangeLogistics.jsx#L351) | I | `po_logistics_plans` | `status = Pending Approval` |
| [390](components/pages/ArrangeLogistics.jsx#L390) | I | `po_logistics_splits` | Transporter-wise split rows |
| [397](components/pages/ArrangeLogistics.jsx#L397) | U | `ORDER RECEIPT` | `logistics_status = Pending Approval` |

---

### 4.10 Logistics Approval — `/logistics-approval`
Component: [LogisticsApproval.jsx](components/pages/LogisticsApproval.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [96](components/pages/LogisticsApproval.jsx#L96) | R | `ORDER RECEIPT` | `logistics_status in (Pending Approval, Approved)` |
| [160](components/pages/LogisticsApproval.jsx#L160) | R | `ORDER RECEIPT` | Same PO ke sab ids |
| [172](components/pages/LogisticsApproval.jsx#L172) | R | `po_logistics_plans` | Latest Pending plan |
| [191](components/pages/LogisticsApproval.jsx#L191) | R | `po_logistics_splits` | Plan ke splits |
| [266](components/pages/LogisticsApproval.jsx#L266) | U | `po_logistics_splits` | `allocated_qty`, `status = Checked` |
| [277, 295](components/pages/LogisticsApproval.jsx#L277) | R | `po_logistics_splits` | Approved qty total |
| [287](components/pages/LogisticsApproval.jsx#L287) | U | `po_logistics_plans` | `status = Approved` |
| [307](components/pages/LogisticsApproval.jsx#L307) | U | `ORDER RECEIPT` | `logistics_status`, `approved_logistics_plan_id`, `logistics_approved_qty` |
| [329-342](components/pages/LogisticsApproval.jsx#L329) | U | plans / splits / `ORDER RECEIPT` | **Reject back** → `Pending Arrangement` |
| [365-378](components/pages/LogisticsApproval.jsx#L365) | U | plans / splits / `ORDER RECEIPT` | **Full reject** → `Logistics Rejected` |

---

### 4.11 Dispatch Planning — `/dispatch-planning`
Component: [DispatchPlanningPage.jsx](components/pages/DispatchPlanningPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [181](components/pages/DispatchPlanningPage.jsx#L181) | R | `ORDER RECEIPT` | `*` |
| [197-199, 260-261](components/pages/DispatchPlanningPage.jsx#L197) | R | `po_logistics_splits`, `DISPATCH` | Checked / Dispatched splits + dispatch rows |
| [222-245](components/pages/DispatchPlanningPage.jsx#L222) | R/I/U | splits, plans, `ORDER RECEIPT` | **Ex Factory auto-bypass** – auto plan + split (`Checked`) |
| [617](components/pages/DispatchPlanningPage.jsx#L617) | RPC | `next_d_sr_number` | D-Sr number |
| [688-702](components/pages/DispatchPlanningPage.jsx#L688) | U | `ORDER RECEIPT`, plans, splits | **Order Cancel** → `Order Cancelled` / `Rejected` |
| [795-815](components/pages/DispatchPlanningPage.jsx#L795) | R/U | `ORDER RECEIPT` | `Delivered`, `Pending Qty` update |
| [829-834](components/pages/DispatchPlanningPage.jsx#L829) | I/U | plans, `ORDER RECEIPT`, splits | Plan na ho to auto-generate |
| [846](components/pages/DispatchPlanningPage.jsx#L846) | I | `DISPATCH` | Nayi dispatch row (trigger → `Planned1`) |
| [868](components/pages/DispatchPlanningPage.jsx#L868) | U | `po_logistics_splits` | `status = Dispatched`, `dispatch_record_id` |
| [877](components/pages/DispatchPlanningPage.jsx#L877) | I | `po_logistics_splits` | Bacha hua qty → naya `Checked` split |

---

### 4.12 Accounts Approval — `/accounts-approval`
Component: [AccountsApprovalPage.jsx](components/pages/AccountsApprovalPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [85](components/pages/AccountsApprovalPage.jsx#L85) | R | `ORDER RECEIPT` | `*` |
| [100](components/pages/AccountsApprovalPage.jsx#L100) | R | `po_logistics_splits` | Dispatched / Accounts Approved / Logistic Completed |
| [222](components/pages/AccountsApprovalPage.jsx#L222) | R | `po_pi_records` | PO ke PI slabs (view dialog) |
| [279](components/pages/AccountsApprovalPage.jsx#L279) | U | `po_logistics_splits` | `Accounts Approved`, `payment_term_status`, `accounts_remarks` |

---

### 4.13 Logistic — `/logistic`
Component: [LogisticPage.jsx](components/pages/LogisticPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [115](components/pages/LogisticPage.jsx#L115) | R | `ORDER RECEIPT` | PO, Party, Firm, Freight |
| [123](components/pages/LogisticPage.jsx#L123) | R | `DISPATCH` | `*` |
| [131](components/pages/LogisticPage.jsx#L131) | R | `po_logistics_splits` | Accounts Approved / Logistic Completed (rate, payment term) |
| [197](components/pages/LogisticPage.jsx#L197) | R | `MASTER` | Transporter Name |
| [311](components/pages/LogisticPage.jsx#L311) | RPC | `next_lgst_number` | LGST-Sr number |
| [391-393](components/pages/LogisticPage.jsx#L391) | S | `images` | Logistic docs |
| [432](components/pages/LogisticPage.jsx#L432) | U | `DISPATCH` | Truck / transporter / rate details |
| [443](components/pages/LogisticPage.jsx#L443) | U | `po_logistics_splits` | `Logistic Completed`, `lgst_sr_number` |

---

### 4.14 Load Material — `/load-material`
Component: [TestReportPage.jsx](components/pages/TestReportPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [69](components/pages/TestReportPage.jsx#L69) | R | `ORDER RECEIPT` | PO no, Firm |
| [83](components/pages/TestReportPage.jsx#L83) | R | `DISPATCH` | `Planned2` not null |
| [288-294](components/pages/TestReportPage.jsx#L288) | S | `images` | Load / test report photo |
| [315](components/pages/TestReportPage.jsx#L315) | U | `DISPATCH` | Load material actual + details |

---

### 4.15 Wetman (Weighment) Entry — `/wetman-entry`
Component: [WetmanEntryPage.jsx](components/pages/WetmanEntryPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [70](components/pages/WetmanEntryPage.jsx#L70) | R | `ORDER RECEIPT` | PO, Party, Firm |
| [78](components/pages/WetmanEntryPage.jsx#L78) | R | `DISPATCH` | `Planned3` not null |
| [311-320](components/pages/WetmanEntryPage.jsx#L311) | S | `images` | Weighment slip |
| [385](components/pages/WetmanEntryPage.jsx#L385) | U | `DISPATCH` | Actual truck qty, weighment data |

---

### 4.16 Invoice — `/invoice`
Component: [InvoicePage.jsx](components/pages/InvoicePage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [105](components/pages/InvoicePage.jsx#L105) | R | `ORDER RECEIPT` | Party, GST, Address, Rate, Freight, check_delivery… |
| [117](components/pages/InvoicePage.jsx#L117) | R | `DISPATCH` | `Planned4` not null |
| [129](components/pages/InvoicePage.jsx#L129) | R | `po_logistics_splits` | transporter, rate, vehicle |
| [615-625](components/pages/InvoicePage.jsx#L615) | S | `images` | Invoice copy |
| [656](components/pages/InvoicePage.jsx#L656) | UP | `SALE FORM 3` | `Status=Pending`, `Delivery Payload` (onConflict `dispatch_id`) |
| [674](components/pages/InvoicePage.jsx#L674) | U | `DISPATCH` | `Actual4`, `Bill Number`, `Bill Date`, `Bill Copy` |
| [723-772](components/pages/InvoicePage.jsx#L723) | S + U | `images`, `DISPATCH`, `DELIVERY`, `POST DELIVERY` | **Admin bill edit** – bill no / copy teeno tables me sync |

---

### 4.17 Sale Form 3 — `/sale-form-3`
Component: [SaleForm3Page.jsx](components/pages/SaleForm3Page.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [106](components/pages/SaleForm3Page.jsx#L106) | R | `ORDER RECEIPT` | PO, Party, Firm |
| [118](components/pages/SaleForm3Page.jsx#L118) | R | `SALE FORM 3` | Status / Planned / Actual |
| [124](components/pages/SaleForm3Page.jsx#L124) | R | `DISPATCH` | `Actual4` not null |
| [309](components/pages/SaleForm3Page.jsx#L309) | U | `SALE FORM 3` | Approve / Reject (sirf `Pending` row) |
| [267-277](components/pages/SaleForm3Page.jsx#L267) | R + I | `DELIVERY` | Approve pe `Delivery Payload` se DELIVERY row (duplicate check ke baad) |
| [333](components/pages/SaleForm3Page.jsx#L333) | U | `SALE FORM 3` | DELIVERY insert fail → rollback to Pending |
| [364](components/pages/SaleForm3Page.jsx#L364) | U | `SALE FORM 3` | Rejected → Reopen (Pending) |

> Backfill script: [sale_form_3_backfill.sql](supabase/migrations/sale_form_3_backfill.sql)

---

### 4.18 Fullkitting — `/fullkitting`
Component: [FullkittingPage.jsx](components/pages/FullkittingPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [170](components/pages/FullkittingPage.jsx#L170) | R | `ORDER RECEIPT` | `ORDER_RECEIPT_COLUMNS` |
| [179](components/pages/FullkittingPage.jsx#L179) | R | `DISPATCH` | `Actual4` not null |
| [190](components/pages/FullkittingPage.jsx#L190) | R | `po_logistics_splits` | rate |
| [205](components/pages/FullkittingPage.jsx#L205) | R | `DELIVERY` | Bill / Bilty info by `D-Sr Number` |
| [231](components/pages/FullkittingPage.jsx#L231) | R | `POST DELIVERY` | Receipt Qty |
| [514-522](components/pages/FullkittingPage.jsx#L514) | S | `images` | Fullkitting docs |
| [581](components/pages/FullkittingPage.jsx#L581) | U | `DISPATCH` | Fullkitting columns |
| [593](components/pages/FullkittingPage.jsx#L593) | U | `DELIVERY` | `Bilty No.` / `Bilty Number.` |

---

### 4.19 TC (Trust / Test Certificate) — `/tc`
Component: [TCPage.jsx](components/pages/TCPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [80](components/pages/TCPage.jsx#L80) | R | `ORDER RECEIPT` | DO, Rate, `TC Required`, Firm |
| [93](components/pages/TCPage.jsx#L93) | R | `DISPATCH` | `Actual4` not null |
| [99](components/pages/TCPage.jsx#L99) | R | `DELIVERY` | Existing delivery rows |
| [111](components/pages/TCPage.jsx#L111) | R | `SALE FORM 3` | Sirf approved dispatch dikhane ke liye |
| [335-370](components/pages/TCPage.jsx#L335) | S | `images` | TC file |
| [377](components/pages/TCPage.jsx#L377) | U | `DISPATCH` | `Trust Certificate Made`, `TC Required` |
| [387](components/pages/TCPage.jsx#L387) | U | `ORDER RECEIPT` | `TC Required` |
| [395](components/pages/TCPage.jsx#L395) | I | `DELIVERY` | Delivery rows insert |

---

### 4.20 Bilty Update / Bilty Entry — `/logistics-fulfillment`, `/bilty-entry`
Component: [UnifiedLogistics.jsx](components/pages/UnifiedLogistics.jsx) (`mode = "bilty"`)

### 4.21 Material Receipt — `/material-receipt`
Component: [UnifiedLogistics.jsx](components/pages/UnifiedLogistics.jsx) (`mode = "receipt"`, sirf bilty done shipments)

| Line | Op | Table | Detail |
|---|---|---|---|
| [117](components/pages/UnifiedLogistics.jsx#L117) | R | `ORDER RECEIPT` | DO, Firm, Party |
| [149](components/pages/UnifiedLogistics.jsx#L149) | R | `DELIVERY` | `Planned 3` not null |
| [150](components/pages/UnifiedLogistics.jsx#L150) | R | `POST DELIVERY` | `*` |
| [151](components/pages/UnifiedLogistics.jsx#L151) | R | `DISPATCH` | D-Sr, TC, LGST, rate fields |
| [590-601](components/pages/UnifiedLogistics.jsx#L590) | S | `images` | Bilty copy / receipt (arrival proof) |
| [609](components/pages/UnifiedLogistics.jsx#L609) | U | `DELIVERY` | Bilty no / copy (bilty mode) |
| [617](components/pages/UnifiedLogistics.jsx#L617) | U | `DISPATCH` | `Bilty No.`, `Bilty Copy` by D-Sr |
| [645 / 647](components/pages/UnifiedLogistics.jsx#L645) | U / I | `POST DELIVERY` | Receipt date, GRN, proof (receipt mode) |

---

### 4.22 CRM — `/crm`
Component: [Crm.jsx](components/pages/Crm.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [44](components/pages/Crm.jsx#L44) | R | `ORDER RECEIPT` | DO numbers of user firms |
| [51](components/pages/Crm.jsx#L51) | R | `DELIVERY` | `Planned 4` not null |
| [59](components/pages/Crm.jsx#L59) | R | `DISPATCH` | `Trust Certificate Made` not null |
| [243](components/pages/Crm.jsx#L243) | I | `POST DELIVERY` | Post-delivery entry |
| [253](components/pages/Crm.jsx#L253) | U | `DELIVERY` | `Actual4` |

> Note: `/crm` route exist karta hai lekin Sidebar ke `pageRoutes` me listed nahi hai.

---

### 4.23 Retention — `/retention`
Component: [RetentionPage.jsx](components/pages/RetentionPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [56](components/pages/RetentionPage.jsx#L56) | R | `ORDER RECEIPT` | `Retention Payment = Yes` |
| [57](components/pages/RetentionPage.jsx#L57) | R | `po_retention_records` | `*` |
| [58](components/pages/RetentionPage.jsx#L58) | R | `POST DELIVERY` | `Order No.`, `Total Bill Amount`, `Bill Date` |
| [288](components/pages/RetentionPage.jsx#L288) | UP | `po_retention_records` | onConflict `po_number` |

---

### 4.24 Material Return — `/material-return`
Component: [MaterialReturnPage.jsx](components/pages/MaterialReturnPage.jsx) (multiple tabs: Return from Party, Logistic, Received, Issue, CRM, Management)

| Line | Op | Table | Detail |
|---|---|---|---|
| [136](components/pages/MaterialReturnPage.jsx#L136) | R | `MASTER` | `*` |
| [183](components/pages/MaterialReturnPage.jsx#L183) | R | `DISPATCH` | Invoice (`Bill Number`) lookup `ilike` |
| [232, 427, 459](components/pages/MaterialReturnPage.jsx#L232) | R | `ORDER RECEIPT` | DO → Firm / Party / Rate mapping |
| [290](components/pages/MaterialReturnPage.jsx#L290) | R | `Material Return` | Same invoice pe pehle return hua qty |
| [440](components/pages/MaterialReturnPage.jsx#L440) | R | `Material Return` | `*` list |
| [569-573](components/pages/MaterialReturnPage.jsx#L569) | S | `images` | Debit note / docs |
| [597](components/pages/MaterialReturnPage.jsx#L597) | I | `Material Return` | Naya return entry |
| [642](components/pages/MaterialReturnPage.jsx#L642) | U | `Material Return` | Logistic tab |
| [670-681](components/pages/MaterialReturnPage.jsx#L670) | S | `images` | Received proof |
| [724](components/pages/MaterialReturnPage.jsx#L724) | U | `Material Return` | Received tab |
| [785](components/pages/MaterialReturnPage.jsx#L785) | U | `Material Return` | Issue tab |
| [930](components/pages/MaterialReturnPage.jsx#L930) | U | `Material Return` | CRM tab |
| [968](components/pages/MaterialReturnPage.jsx#L968) | U | `Material Return` | Management tab |

---

### 4.25 Management Approval — `/management-approval`
Component: [ManagementApprovalPage.jsx](components/pages/ManagementApprovalPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [72](components/pages/ManagementApprovalPage.jsx#L72) | R | `ORDER RECEIPT` | DO → Firm / Party |
| [91](components/pages/ManagementApprovalPage.jsx#L91) | R | `Material Return` | `*` |
| [192](components/pages/ManagementApprovalPage.jsx#L192) | U | `Material Return` | Approve → `Actual5`, `Management Status`, remarks |
| [219](components/pages/ManagementApprovalPage.jsx#L219) | U | `Material Return` | Reject |

---

### 4.26 Debit Note — `/debit-note`
Component: [DebitNotePage.jsx](components/pages/DebitNotePage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [138](components/pages/DebitNotePage.jsx#L138) | R | `ORDER RECEIPT` | DO → Firm / Party |
| [158](components/pages/DebitNotePage.jsx#L158) | R | `DISPATCH` | DO → `Bill Number` |
| [171](components/pages/DebitNotePage.jsx#L171) | R | `Material Return` | `Actual5` not null (management approved) |
| [323-327](components/pages/DebitNotePage.jsx#L323) | S | `images` | Debit note file |
| [343](components/pages/DebitNotePage.jsx#L343) | U | `Material Return` | Debit note issue |
| [400-412](components/pages/DebitNotePage.jsx#L400) | S + U | `images`, `Material Return` | Copy edit |

---

### 4.27 Return of Material — `/return-of-material`
Component: [ReturnOfMaterialPage.jsx](components/pages/ReturnOfMaterialPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [83](components/pages/ReturnOfMaterialPage.jsx#L83) | R | `MASTER` | Transporter Name |
| [118](components/pages/ReturnOfMaterialPage.jsx#L118) | R | `ORDER RECEIPT` | DO → Firm / Party |
| [138](components/pages/ReturnOfMaterialPage.jsx#L138) | R | `Material Return` | `Actual5` & `Debit Note Issued At` not null |
| [275-279](components/pages/ReturnOfMaterialPage.jsx#L275) | S | `images` | Return bilty copy |
| [302](components/pages/ReturnOfMaterialPage.jsx#L302) | U | `Material Return` | Return transport details |

---

### 4.28 Manage Users — `/manage-users`
Component: [ManageUsersPage.jsx](components/pages/ManageUsersPage.jsx)

| Line | Op | Table | Detail |
|---|---|---|---|
| [95](components/pages/ManageUsersPage.jsx#L95) | R | `USER` | `*` by Username |
| [96](components/pages/ManageUsersPage.jsx#L96) | R | `MASTER` | `Firm Name` list |
| [207](components/pages/ManageUsersPage.jsx#L207) | U | `USER` | Edit user |
| [211](components/pages/ManageUsersPage.jsx#L211) | I | `USER` | Add user |
| [228](components/pages/ManageUsersPage.jsx#L228) | D | `USER` | Delete user |

---

## 5. Table → Pages Matrix (Reverse Lookup)

Kaunsi table kis page pe use hoti hai:

| Table | Read | Write |
|---|---|---|
| `USER` | Login, AuthProvider, Manage Users | Manage Users (I/U/D) |
| `MASTER` | Order Form, Arrange Logistics, Logistic, Material Return, Return of Material, Manage Users | Dashboard (I) |
| `ORDER RECEIPT` | **Almost sab pages** | Order (I/U), Check PO, Received Accounts, Check Delivery, Arrange Logistics, Logistics Approval, Dispatch Planning, TC (U) |
| `po_logistics_plans` | Logistics Approval | Arrange Logistics (I), Logistics Approval (U), Dispatch Planning (I/U), Order (U) |
| `po_logistics_splits` | Arrange Logistics, Logistics Approval, Dispatch Planning, Accounts Approval, Logistic, Make PI, Invoice, Fullkitting, Process Dashboard | Arrange Logistics (I), Logistics Approval (U), Dispatch Planning (I/U), Accounts Approval (U), Logistic (U), Order (U) |
| `po_pi_records` | Make PI, Received PI Payment, Accounts Approval, Dashboard, Process Dashboard | Make PI (I), Received PI Payment (U) |
| `po_retention_records` | Retention, Dashboard, Process Dashboard | Retention (UP) |
| `DISPATCH` | Dispatch Planning, Logistic, Load Material, Wetman, Invoice, Sale Form 3, Fullkitting, TC, Bilty/Receipt, CRM, Material Return, Debit Note, Dashboards | Dispatch Planning (I), Logistic, Load Material, Wetman, Invoice, Fullkitting, TC, Bilty Update (U) |
| `SALE FORM 3` | Sale Form 3, TC, Process Dashboard | Invoice (UP), Sale Form 3 (U) |
| `DELIVERY` | Fullkitting, TC, Sale Form 3, Bilty/Receipt, CRM, Dashboards | Sale Form 3 (I), TC (I), Fullkitting (U), Invoice (U), Bilty Update (U), CRM (U) |
| `POST DELIVERY` | Fullkitting, Bilty/Receipt, Retention, Dashboards | Material Receipt (I/U), CRM (I), Invoice (U) |
| `Material Return` | Material Return, Management Approval, Debit Note, Return of Material, Process Dashboard | Material Return (I/U), Management Approval (U), Debit Note (U), Return of Material (U) |
| Storage `images` | `getSignedUrl` (view) | Order, Make PI, Logistic, Load Material, Wetman, Invoice, Fullkitting, TC, Bilty/Receipt, Material Return, Debit Note, Return of Material |

---

## 6. Status / Stage Columns Quick Reference

### `ORDER RECEIPT`
| Column | Set by |
|---|---|
| `Actual 1`, `Planned 2`, `Expected Delivery Date` | Check PO |
| `Actual 2`, `Planned 3` | Received Accounts |
| `check_delivery_*` | Check for Delivery |
| `logistics_status` (`Pending Approval` → `Approved` / `Pending Arrangement` / `Logistics Rejected` / `Order Cancelled`) | Arrange Logistics, Logistics Approval, Dispatch Planning |
| `approved_logistics_plan_id`, `logistics_approved_qty` | Logistics Approval, Dispatch Planning |
| `Delivered`, `Pending Qty`, `Cancelled Qty` | Dispatch Planning, Order (cancel) |
| `TC Required` | TC |

### `po_logistics_splits.status`
`Pending Approval` → `Checked` (Logistics Approval) → `Dispatched` (Dispatch Planning) → `Accounts Approved` (Accounts Approval) → `Logistic Completed` (Logistic). Reject pe `Rejected`.

### `DISPATCH` stages (trigger driven)
| Stage | Page | Filter used |
|---|---|---|
| `Planned1` → `Actual1` | Logistic | Dispatch insert pe `Planned1 = Timestamp` |
| `Planned2` → `Actual2` | Load Material | `Planned2 not null` |
| `Planned3` → `Actual3` | Wetman Entry | `Planned3 not null` |
| `Planned4` → `Actual4` | Invoice | `Planned4 not null` |
| After `Actual4` | Sale Form 3, Fullkitting, TC | `Actual4 not null` |

### `SALE FORM 3.Status`
`Pending` (Invoice upsert) → `Approved` (DELIVERY insert) / `Rejected` → Reopen → `Pending`.

### `Material Return`
Return entry → Logistic → Received → Issue → CRM → Management (`Actual5`, `Management Status`) → Debit Note (`Debit Note Issued At`) → Return of Material.
