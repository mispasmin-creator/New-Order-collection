"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Activity,
  ShoppingCart,
  FileCheck,
  FileText,
  Truck,
  CheckSquare,
  Calendar,
  BadgeCheck,
  Package,
  Scale,
  Receipt,
  FileCheck2,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Loader2,
  RefreshCw,
} from "lucide-react"

const STAGE_META = {
  order: { label: "Order", route: "/order", icon: ShoppingCart, isTotal: true },
  checkPO: { label: "Check PO", route: "/check-po", icon: FileCheck },
  receivedAccounts: { label: "Received Accounts", route: "/received-accounts", icon: FileText },
  checkDelivery: { label: "Check for Delivery", route: "/check-delivery", icon: Truck },
  arrangeLogistics: { label: "Arrange Logistics", route: "/arrange-logistics", icon: Truck },
  logisticsApproval: { label: "Logistics Approval", route: "/logistics-approval", icon: CheckSquare },
  dispatchPlanning: { label: "Dispatch Planning", route: "/dispatch-planning", icon: Calendar },
  accountsApproval: { label: "Accounts Approval", route: "/accounts-approval", icon: BadgeCheck },
  logistic: { label: "Logistic", route: "/logistic", icon: Package },
  loadMaterial: { label: "Load Material", route: "/load-material", icon: Truck },
  wetmanEntry: { label: "Weighment Entry", route: "/wetman-entry", icon: Scale },
  invoice: { label: "Invoice", route: "/invoice", icon: Receipt },
  tc: { label: "TC", route: "/tc", icon: FileCheck2 },
  fullkitting: { label: "Fullkitting", route: "/fullkitting", icon: PackageCheck },
  biltyUpdate: { label: "Bilty Update", route: "/logistics-fulfillment", icon: PackageCheck },
  materialReturn: { label: "Material Return", route: "/material-return", icon: RotateCcw },
  returnOfMaterial: { label: "Return of Material", route: "/return-of-material", icon: RotateCcw },
  managementApproval: { label: "Management Approval", route: "/management-approval", icon: ShieldCheck },
  debitNote: { label: "Credit Note", route: "/debit-note", icon: FileText },
  retention: { label: "Retention", route: "/retention", icon: Receipt },
  makePI: { label: "Make PI", route: "/payments-pi", icon: FileText },
  receivedPIPayment: { label: "Received PI Payment", route: "/received-pi-payment", icon: Receipt },
}

const STAGE_GROUPS = [
  { title: "Order Processing", stages: ["order", "checkPO", "receivedAccounts", "checkDelivery"] },
  { title: "Logistics", stages: ["arrangeLogistics", "logisticsApproval", "dispatchPlanning", "accountsApproval", "logistic", "loadMaterial"] },
  { title: "Dispatch & Delivery", stages: ["wetmanEntry", "invoice", "tc", "fullkitting", "biltyUpdate"] },
  { title: "Returns & Approvals", stages: ["materialReturn", "returnOfMaterial", "managementApproval", "debitNote"] },
  { title: "Finance", stages: ["retention", "makePI", "receivedPIPayment"] },
]

const isFilled = (v) => v !== null && v !== undefined && String(v).trim() !== ""

export default function ProcessDashboard({ user }) {
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchCounts() }, [])

  const fetchCounts = async () => {
    try {
      setRefreshing(true)
      const userFirms = user?.role !== "ADMIN"
        ? (user?.firm ? user.firm.split(",").map((f) => f.trim()).filter(Boolean) : [])
        : null
      const shouldFilter = userFirms && !userFirms.includes("all") && userFirms.length > 0

      let orderQuery = supabase.from("ORDER RECEIPT").select("*")
      if (shouldFilter) orderQuery = orderQuery.in("Firm Name", userFirms)
      const { data: orders } = await orderQuery
      const allOrders = orders || []

      const accessibleOrderIds = allOrders.map((o) => o.id)
      const allowedDoNumbers = allOrders.map((o) => o["DO-Delivery Order No."]).filter(Boolean)

      // Dispatch/Delivery/Post-Delivery/Material Return have no Firm Name column of
      // their own, so they're scoped by joining through the firm-filtered order set above.
      let dispatchQuery = supabase.from("DISPATCH").select("*")
      if (shouldFilter) dispatchQuery = dispatchQuery.in("po_id", accessibleOrderIds)

      let deliveryQuery = supabase.from("DELIVERY").select("*").not("Planned 3", "is", null)
      if (shouldFilter) deliveryQuery = deliveryQuery.in('"Delivery Order No."', allowedDoNumbers)

      let postDeliveryQuery = supabase.from("POST DELIVERY").select("*")
      if (shouldFilter) postDeliveryQuery = postDeliveryQuery.in('"Order No."', allowedDoNumbers)

      let splitsQuery = supabase.from("po_logistics_splits").select("*")
      if (shouldFilter) splitsQuery = splitsQuery.in("po_id", accessibleOrderIds)

      let materialReturnQuery = supabase.from("Material Return").select("*")
      if (shouldFilter) materialReturnQuery = materialReturnQuery.in('"D.O Number"', allowedDoNumbers)

      let retentionQuery = supabase.from("po_retention_records").select("po_number, status")

      let piQuery = supabase.from("po_pi_records").select("po_number, status, firm_name")
      if (shouldFilter) piQuery = piQuery.in("firm_name", userFirms)

      const [
        { data: dispatch },
        { data: delivery },
        { data: postDelivery },
        { data: splits },
        { data: materialReturn },
        { data: retentionRecords },
        { data: piRecords },
      ] = await Promise.all([dispatchQuery, deliveryQuery, postDeliveryQuery, splitsQuery, materialReturnQuery, retentionQuery, piQuery])

      const dispatchRows = dispatch || []
      const deliveryRows = delivery || []
      const postDeliveryRows = postDelivery || []
      const splitRows = splits || []
      const returnRows = materialReturn || []

      const newCounts = {}

      // Order intake — total accessible orders, not a "pending" count.
      newCounts.order = allOrders.length

      // Check PO: Planned 1 set, Actual 1 not set.
      newCounts.checkPO = allOrders.filter((o) => isFilled(o["Planned 1"]) && !isFilled(o["Actual 1"])).length

      // Received Accounts: Planned 2 set, Actual 2 not set.
      newCounts.receivedAccounts = allOrders.filter((o) => isFilled(o["Planned 2"]) && !isFilled(o["Actual 2"])).length

      // Check for Delivery: Actual 2 set, check_delivery_actual not set.
      newCounts.checkDelivery = allOrders.filter((o) => isFilled(o["Actual 2"]) && !isFilled(o.check_delivery_actual)).length

      // Arrange Logistics: past the delivery-check gate, no plan submitted yet.
      newCounts.arrangeLogistics = allOrders.filter((o) =>
        isFilled(o["Actual 2"]) && isFilled(o.check_delivery_actual) &&
        (!o.logistics_status || o.logistics_status === "Pending Arrangement")
      ).length

      // Logistics Approval: plan submitted, awaiting approval.
      newCounts.logisticsApproval = allOrders.filter((o) => o.logistics_status === "Pending Approval").length

      // Dispatch Planning: split checked but not yet turned into a dispatch record.
      newCounts.dispatchPlanning = splitRows.filter((s) => s.status === "Checked" && !s.dispatch_record_id).length

      // Accounts Approval: split dispatched, awaiting accounts sign-off.
      newCounts.accountsApproval = splitRows.filter((s) => s.status === "Dispatched").length

      // Logistic: Planned1 set, Actual1 not set.
      newCounts.logistic = dispatchRows.filter((d) => isFilled(d.Planned1) && !isFilled(d.Actual1)).length

      // Load Material: Planned2 set, Actual2 not set.
      newCounts.loadMaterial = dispatchRows.filter((d) => isFilled(d.Planned2) && !isFilled(d.Actual2)).length

      // Weighment Entry: Planned3 set, Actual3 not set.
      newCounts.wetmanEntry = dispatchRows.filter((d) => isFilled(d.Planned3) && !isFilled(d.Actual3)).length

      // Invoice: Planned4 set, Actual4 not set.
      newCounts.invoice = dispatchRows.filter((d) => isFilled(d.Planned4) && !isFilled(d.Actual4)).length

      // TC: invoice issued, TC required, no matching DELIVERY row yet.
      const deliveryDSrNumbers = new Set(deliveryRows.map((d) => d["D-Sr Number"]).filter(Boolean))
      newCounts.tc = dispatchRows.filter((d) =>
        isFilled(d.Actual4) && d["TC Required"] === "Yes" &&
        d["D-Sr Number"] && !deliveryDSrNumbers.has(d["D-Sr Number"])
      ).length

      // Fullkitting: invoice issued, not yet fullkitted, and delivery-ready
      // (ex-factory needs only a delivery row; others also need that row's Actual3 set).
      const deliveryByDSr = new Map()
      deliveryRows.forEach((d) => { if (d["D-Sr Number"]) deliveryByDSr.set(d["D-Sr Number"], d) })
      newCounts.fullkitting = dispatchRows.filter((d) => {
        if (isFilled(d["Fullkitting Actual"])) return false
        if (!isFilled(d.Actual4)) return false
        const type = (d["Type Of Transporting  "] || d["Type Of Transporting"] || "").toLowerCase().trim()
        const delRow = d["D-Sr Number"] ? deliveryByDSr.get(d["D-Sr Number"]) : null
        return type === "ex-factory" || type === "ex factory" ? !!delRow : !!(delRow && delRow.Actual3)
      }).length

      // Bilty Update: delivery planned (non ex-factory), no matching receipt yet.
      // Firm-name is joined per row since Bill No. is not unique across firms.
      const firmMap = {}
      allOrders.forEach((o) => { if (o["DO-Delivery Order No."]) firmMap[o["DO-Delivery Order No."]] = o["Firm Name"] })
      const taggedPostDelivery = postDeliveryRows.map((pd) => ({ ...pd, firmName: firmMap[pd["Order No."]] || "" }))
      newCounts.biltyUpdate = deliveryRows.filter((d) => {
        const type = (d["Type Of Transporting"] || "").toLowerCase().trim()
        if (type === "ex-factory" || type === "ex factory") return false
        const delFirm = firmMap[d["Delivery Order No."]] || ""
        const receipt = taggedPostDelivery.find((pd) =>
          d["Bill No."] ? (pd["Bill No."] === d["Bill No."] && pd.firmName === delFirm) : (pd["Order No."] === d["Delivery Order No."])
        )
        return !isFilled(receipt?.Actual)
      }).length

      // Material Return sub-stages (all scoped to the same "Material Return" table).
      newCounts.materialReturn = returnRows.filter((r) => isFilled(r.Planned) && !isFilled(r.Actual)).length
      newCounts.returnOfMaterial = returnRows.filter((r) =>
        isFilled(r.Actual5) && r["Reason Of Material Return"] === "Material Return" && !isFilled(r["Return Dispatched At"])
      ).length
      newCounts.managementApproval = returnRows.filter((r) => isFilled(r["Time Stamp"]) && !isFilled(r.Actual5)).length
      newCounts.debitNote = returnRows.filter((r) =>
        isFilled(r.Actual5) && r["Reason Of Material Return"] !== "Material Return" && !isFilled(r["Debit Note Issued At"])
      ).length

      // Retention: PO flagged for retention, no payment record yet marked Paid.
      const retentionOrders = allOrders.filter((o) => o["Retention Payment"] === "Yes")
      const retentionStatusByPo = new Map()
      ;(retentionRecords || []).forEach((r) => retentionStatusByPo.set(r.po_number, r.status))
      const retentionPoSeen = new Set()
      let retentionPending = 0
      retentionOrders.forEach((o) => {
        const po = o["PARTY PO NO (As Per Po Exact)"]
        if (!po || retentionPoSeen.has(po)) return
        retentionPoSeen.add(po)
        const status = retentionStatusByPo.get(po) || "Pending"
        if (status !== "Paid") retentionPending++
      })
      newCounts.retention = retentionPending

      // Make PI: accounts cleared, no PI raised yet for that PO.
      const existingPIPoSet = new Set((piRecords || []).map((r) => r.po_number))
      const makePIPoSet = new Set()
      allOrders.forEach((o) => {
        const po = o["PARTY PO NO (As Per Po Exact)"]
        if (isFilled(o["Actual 2"]) && po && !existingPIPoSet.has(po)) makePIPoSet.add(po)
      })
      newCounts.makePI = makePIPoSet.size

      // Received PI Payment: PI slabs still pending payment.
      newCounts.receivedPIPayment = new Set(
        (piRecords || []).filter((r) => r.status === "Pending").map((r) => r.po_number)
      ).size

      setCounts(newCounts)
    } catch (error) {
      console.error("Error fetching process dashboard counts:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-[#5b6e33]" /> Process Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Pending count at every step of the pipeline, end to end</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchCounts}
          disabled={refreshing}
          className="border-[#5b6e33]/30 text-[#48581f] hover:bg-[#5b6e33]/10"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#5b6e33]" />
          Loading pipeline status...
        </div>
      ) : (
        <div className="space-y-8">
          {STAGE_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{group.title}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.stages.map((key) => {
                  const meta = STAGE_META[key]
                  const Icon = meta.icon
                  const count = counts[key] ?? 0
                  return (
                    <Link key={key} href={meta.route}>
                      <Card className="hover:shadow-md hover:border-[#5b6e33]/30 transition-all cursor-pointer h-full">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-500 truncate">{meta.label}</p>
                            <p className={`text-2xl font-bold ${meta.isTotal ? "text-slate-800" : count > 0 ? "text-[#48581f]" : "text-slate-400"}`}>
                              {count}
                            </p>
                            {!meta.isTotal && <p className="text-[10px] text-slate-400">pending</p>}
                          </div>
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${count > 0 ? "bg-[#5b6e33]/10 text-[#48581f]" : "bg-slate-100 text-slate-400"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
