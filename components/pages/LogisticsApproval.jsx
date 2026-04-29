"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, CheckSquare, XCircle, LayoutList, Truck, ChevronDown, ChevronRight, Clock, Plus, Minus } from "lucide-react"
import { groupRowsByPo } from "@/lib/workflowGrouping"

export default function LogisticsApproval() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [plan, setPlan] = useState(null)
  const [transporterOptions, setTransporterOptions] = useState([])
  const [poTotalQty, setPoTotalQty] = useState(0)
  const [allocations, setAllocations] = useState({})
  const [isSplitMode, setIsSplitMode] = useState(false)
  const [selectedTransporterId, setSelectedTransporterId] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fetchingPlan, setFetchingPlan] = useState(false)
  const [expandedPO, setExpandedPO] = useState(null)

  const { toast } = useToast()

  const groupedOrders = useMemo(
    () =>
      groupRowsByPo(orders, {
        poNumberKey: "PARTY PO NO (As Per Po Exact)",
        partyNameKey: "Party Names",
      }),
    [orders]
  )

  useEffect(() => { fetchOrders() }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("ORDER RECEIPT")
        .select("*")
        .eq("logistics_status", "Pending Approval")
        .order("id", { ascending: false })
      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const openReviewDialog = async (group) => {
    setSelectedGroup(group)
    setIsDialogOpen(true)
    setFetchingPlan(true)
    setPlan(null)
    setTransporterOptions([])
    setPoTotalQty(0)
    setAllocations({})
    setIsSplitMode(false)
    setSelectedTransporterId(null)

    try {
      const orderIds = group.rows.map((r) => r.id)

      const { data: plans, error: planError } = await supabase
        .from("po_logistics_plans")
        .select("*")
        .in("po_id", orderIds)
        .eq("status", "Pending Approval")
        .order("id", { ascending: false })
        .limit(1)

      if (planError) throw planError

      const currentPlan = plans?.[0]
      if (!currentPlan) {
        toast({ title: "No plan found", description: "No pending logistics plan found for this PO.", variant: "destructive" })
        setIsDialogOpen(false)
        return
      }

      setPlan(currentPlan)

      const { data: splits, error: splitError } = await supabase
        .from("po_logistics_splits")
        .select("*")
        .eq("plan_id", currentPlan.id)
        .order("sort_order", { ascending: true })

      if (splitError) throw splitError

      // Calculate PO total quantity
      const total = group.rows.reduce((sum, order) => sum + (parseFloat(order.Quantity) || 0), 0)
      setPoTotalQty(total)

      // We only need the transporter options once. Take from first product.
      const firstOrderId = group.rows[0].id
      const firstProductSplits = splits.filter((s) => s.po_id === firstOrderId) || []

      const options = firstProductSplits.map((s) => ({
        id: s.id,
        transporter_name: s.transporter_name || "",
        rate: s.rate?.toString() || "",
        allocated_qty: s.allocated_qty?.toString() || "",
        contact_number: s.contact_number || "",
        availability: s.availability || "",
        vehicle_details: s.vehicle_details || "",
        remarks: s.remarks || "",
      }))

      setTransporterOptions(options)

      // Init allocation: put full qty on first split if nothing is allocated yet
      const initAlloc = {}
      const hasQty = options.some((s) => parseFloat(s.allocated_qty) > 0)
      options.forEach((s) => {
        if (hasQty) {
          initAlloc[s.id] = s.allocated_qty || "0"
        } else {
          initAlloc[s.id] = "0"
        }
      })
      setAllocations(initAlloc)
      setSelectedTransporterId(options.length > 0 ? options[0].id : null)
      setIsSplitMode(false)
    } catch (err) {
      console.error("Error loading plan:", err)
      toast({ title: "Failed to load plan", description: err.message, variant: "destructive" })
    } finally {
      setFetchingPlan(false)
    }
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setSelectedGroup(null)
    setPlan(null)
    setTransporterOptions([])
    setPoTotalQty(0)
    setAllocations({})
    setIsSplitMode(false)
    setSelectedTransporterId(null)
  }

  const updateAllocation = (splitId, value) => {
    setAllocations((prev) => ({ ...prev, [splitId]: value }))
  }

  const handleApprove = async () => {
    let finalAllocations = {}

    if (isSplitMode) {
      const totalAllocated = Object.values(allocations).reduce((sum, q) => sum + (parseFloat(q) || 0), 0)
      const activeCount = Object.values(allocations).filter((q) => parseFloat(q) > 0).length
      if (activeCount === 0) {
        toast({ title: "Validation Error", description: "Allocate at least some qty to a transporter.", variant: "destructive" })
        return
      }
      if (Math.abs(totalAllocated - poTotalQty) > 0.01) {
        toast({ title: "Quantity Mismatch", description: `Allocations must sum exactly to ${poTotalQty} for the PO (currently ${totalAllocated}).`, variant: "destructive" })
        return
      }
      finalAllocations = allocations
    } else {
      if (!selectedTransporterId) {
        toast({ title: "Validation Error", description: "Please select a transporter.", variant: "destructive" })
        return
      }
      finalAllocations = { [selectedTransporterId]: poTotalQty.toString() }
    }

    try {
      setIsSubmitting(true)

      // Delete existing splits
      const { error: deleteError } = await supabase
        .from("po_logistics_splits")
        .delete()
        .eq("plan_id", plan.id)
      if (deleteError) throw deleteError

      // Build Checked splits — one per product per transporter,
      // qty distributed proportionally based on each product's share of total PO qty
      const finalSplits = []
      let subIdx = 0
      const productRows = selectedGroup.rows

      for (const opt of transporterOptions) {
        const totalAllocQty = parseFloat(finalAllocations[opt.id] || "0") || 0
        if (totalAllocQty <= 0) continue

        let remainingQty = totalAllocQty
        for (let i = 0; i < productRows.length; i++) {
          const orderRow = productRows[i]
          const isLast = i === productRows.length - 1

          let productAllocQty
          if (isLast) {
            // Last product gets the remainder to avoid rounding drift
            productAllocQty = Math.round(remainingQty * 1000) / 1000
          } else {
            const productQty = parseFloat(orderRow.Quantity) || 0
            const share = poTotalQty > 0 ? productQty / poTotalQty : 1 / productRows.length
            productAllocQty = Math.round(totalAllocQty * share * 1000) / 1000
            remainingQty -= productAllocQty
          }

          if (productAllocQty <= 0) continue

          finalSplits.push({
            plan_id: plan.id,
            po_id: orderRow.id,
            transporter_name: opt.transporter_name,
            contact_number: opt.contact_number || "",
            rate: parseFloat(opt.rate) || 0,
            availability: opt.availability || "",
            remarks: opt.remarks || "",
            vehicle_details: opt.vehicle_details || "",
            status: "Checked",
            allocated_qty: productAllocQty,
            sort_order: subIdx,
          })
          subIdx++
        }
      }

      const { error: insertError } = await supabase.from("po_logistics_splits").insert(finalSplits)
      if (insertError) throw insertError

      const { error: planError } = await supabase
        .from("po_logistics_plans")
        .update({ status: "Approved" })
        .eq("id", plan.id)
      if (planError) throw planError

      const { error: orderError } = await supabase
        .from("ORDER RECEIPT")
        .update({ logistics_status: "Approved", approved_logistics_plan_id: plan.id })
        .in("id", selectedGroup.rows.map((r) => r.id))
      if (orderError) throw orderError

      toast({ title: "Approved", description: "Logistics plan approved successfully.", className: "bg-green-50 text-green-800 border-green-200" })
      closeDialog()
      fetchOrders()
    } catch (error) {
      console.error("Approval error:", error)
      toast({ title: "Approval failed", description: error.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRejectBack = async () => {
    try {
      setIsSubmitting(true)
      if (plan) {
        await supabase.from("po_logistics_plans").update({ status: "Rejected" }).eq("id", plan.id)
        await supabase.from("po_logistics_splits").update({ status: "Rejected" }).eq("plan_id", plan.id)
      }
      await supabase
        .from("ORDER RECEIPT")
        .update({ logistics_status: "Pending Arrangement", approved_logistics_plan_id: null })
        .in("id", selectedGroup.rows.map((r) => r.id))
      toast({ title: "Sent Back", description: "PO sent back for a new arrangement.", className: "bg-orange-50 text-orange-800 border-orange-200" })
      closeDialog()
      fetchOrders()
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFullReject = async () => {
    try {
      setIsSubmitting(true)
      if (plan) {
        await supabase.from("po_logistics_plans").update({ status: "Rejected" }).eq("id", plan.id)
        await supabase.from("po_logistics_splits").update({ status: "Rejected" }).eq("plan_id", plan.id)
      }
      await supabase
        .from("ORDER RECEIPT")
        .update({ logistics_status: "Logistics Rejected", approved_logistics_plan_id: null })
        .in("id", selectedGroup.rows.map((r) => r.id))
      toast({ title: "Fully Rejected", description: "Logistics cancelled for this PO.", className: "bg-red-50 text-red-800 border-red-200" })
      closeDialog()
      fetchOrders()
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading pending approvals...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistics Approval</h1>
          <p className="text-gray-600">Select a transporter option and approve</p>
        </div>
        <Button variant="outline" onClick={fetchOrders} disabled={loading}>
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Logistics Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Firm</TableHead>
                  <TableHead>Products</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No logistics currently pending approval.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedOrders.map((group) => {
                    const isExpanded = expandedPO === group.key
                    return (
                      <Fragment key={group.key}>
                        <TableRow
                          className="bg-slate-50 cursor-pointer hover:bg-slate-100"
                          onClick={() => setExpandedPO(isExpanded ? null : group.key)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => openReviewDialog(group)}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              <LayoutList className="w-4 h-4 mr-2" />
                              Review Plan
                            </Button>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              }
                              {group.poNumber}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-700">{group.partyName}</TableCell>
                          <TableCell className="text-slate-600">{group.rows[0]?.["Firm Name"]}</TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-500">
                              {group.rows.length} product{group.rows.length > 1 ? "s" : ""}
                            </span>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="p-0 border-b border-slate-200">
                              <div className="bg-slate-50/80 px-6 py-4 space-y-3">
                                {group.rows.map((order) => (
                                  <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-sm font-semibold text-gray-800">{order["Product Name"]}</span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Qty: {order.Quantity}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                      <div>
                                        <span className="text-gray-500">DO Number</span>
                                        <p className="font-mono font-medium text-gray-800">{order["DO-Delivery Order No."] || "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Party PO Date</span>
                                        <p className="font-medium text-gray-800">{order["Party PO Date"] || "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Rate</span>
                                        <p className="font-medium text-gray-800">{order["Rate Of Material"] ? `₹${order["Rate Of Material"]}` : "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Total PO Value</span>
                                        <p className="font-medium text-green-700">{order["Total PO Basic Value"] ? `₹${Number(order["Total PO Basic Value"]).toLocaleString()}` : "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Transport Type</span>
                                        <p className="font-medium text-gray-800">{order["Type Of Transporting"] || "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Payment</span>
                                        <p className="font-medium text-gray-800">{order["Payment to Be Taken"] || "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">GST Number</span>
                                        <p className="font-medium text-gray-800">{order["Gst Number"] || "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Contact Person</span>
                                        <p className="font-medium text-gray-800">{order["Contact Person Name"] || "—"}</p>
                                      </div>
                                      {order["Address"] && (
                                        <div className="col-span-2">
                                          <span className="text-gray-500">Address</span>
                                          <p className="font-medium text-gray-800">{order["Address"]}</p>
                                        </div>
                                      )}
                                      {order["Specific Concern"] && (
                                        <div className="col-span-2">
                                          <span className="text-gray-500">Specific Concern</span>
                                          <p className="font-medium text-orange-700">{order["Specific Concern"]}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-4xl max-h-[94vh] overflow-y-auto p-0">

          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              Review Logistics Plan
            </DialogTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
              <div className="p-3 rounded-lg bg-gray-50">
                <span className="block text-xs text-gray-500">PO Number</span>
                <span className="font-medium">{selectedGroup?.poNumber}</span>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <span className="block text-xs text-gray-500">Party</span>
                <span className="font-medium">{selectedGroup?.partyName}</span>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <span className="block text-xs text-gray-500">Firm</span>
                <span className="font-medium">{selectedGroup?.rows[0]?.["Firm Name"]}</span>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <span className="block text-xs text-gray-500">Products</span>
                <span className="font-medium">{selectedGroup?.rows.length}</span>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="p-6 space-y-8">
            {fetchingPlan ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : transporterOptions.length === 0 ? (
              <div className="text-center p-8 text-gray-500">No plan data found.</div>
            ) : (
              <div className="space-y-4">
                {/* PO Quantity header & Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Total PO Quantity: <span className="text-purple-700 text-base">{poTotalQty}</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">Choose how to allocate transport for this PO.</p>
                  </div>
                  <div className="flex bg-gray-200/80 p-1 rounded-lg self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsSplitMode(false)}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${!isSplitMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Single Transporter
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSplitMode(true)}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${isSplitMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Split Quantities
                    </button>
                  </div>
                </div>

                {isSplitMode && (
                  <div className="flex items-center justify-end">
                    {(() => {
                      const totalAllocated = Object.values(allocations).reduce((sum, q) => sum + (parseFloat(q) || 0), 0)
                      const remaining = poTotalQty - totalAllocated
                      const isBalanced = Math.abs(remaining) < 0.01

                      return (
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          isBalanced ? "bg-green-100 text-green-700" : remaining > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                        }`}>
                          {isBalanced ? "✓ Balanced" : remaining > 0 ? `${remaining} unallocated` : `${Math.abs(remaining)} over`}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Transport option allocation cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(() => {
                    const rates = transporterOptions.map(s => parseFloat(s.rate)).filter(r => !isNaN(r) && r > 0)
                    const minRate = rates.length > 0 ? Math.min(...rates) : null
                    return transporterOptions.map((split) => {
                    const isLowestCost = minRate !== null && parseFloat(split.rate) === minRate
                    // Logic based on mode
                    const isSelectedSingle = !isSplitMode && selectedTransporterId === split.id
                    const allocVal = allocations[split.id] || "0"
                    
                    const allocNum = isSplitMode 
                      ? parseFloat(allocVal) || 0 
                      : (isSelectedSingle ? poTotalQty : 0)

                    const isActive = isSplitMode ? allocNum > 0 : isSelectedSingle
                    const estTotal = split.rate && allocNum ? parseFloat(split.rate) * allocNum : null
                    const isFixed = split.vehicle_details === "Fixed"

                    return (
                      <div
                        key={split.id}
                        onClick={() => { if (!isSplitMode) setSelectedTransporterId(split.id) }}
                        className={`p-4 border rounded-xl space-y-3 transition-all ${!isSplitMode && "cursor-pointer hover:border-purple-300"} ${
                          isLowestCost
                            ? "border-green-500 bg-green-50/40 shadow-sm ring-1 ring-green-500/20"
                            : isActive
                            ? "border-purple-500 bg-purple-50/50 shadow-sm ring-1 ring-purple-500/20"
                            : "border-gray-200 bg-white opacity-80 hover:opacity-100"
                        }`}
                      >
                        {/* Transporter info */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {!isSplitMode && (
                              <div className={`w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center shrink-0 ${isSelectedSingle ? "bg-purple-600 border-purple-600" : "bg-white"}`}>
                                {isSelectedSingle && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-gray-900 leading-tight">{split.transporter_name || "—"}</p>
                              {split.availability && <p className="text-[10px] text-gray-500 mt-0.5">{split.availability}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isLowestCost && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-600 text-white">Lowest Cost</span>
                            )}
                            {isSplitMode && isActive && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-600 text-white">Active</span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-white/60 p-2 rounded-lg border border-gray-100">
                          <div>
                            <span className="text-gray-400 block text-[10px] uppercase">Rate Type</span>
                            <span className="font-medium text-gray-800">{split.vehicle_details || "—"}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px] uppercase">Entered Rate</span>
                            <span className="font-medium text-gray-800">{split.rate ? `₹${split.rate}` : "—"}</span>
                          </div>
                          {split.contact_number && (
                            <div className="col-span-2 mt-1">
                              <span className="text-gray-400 block text-[10px] uppercase">Contact</span>
                              <span className="font-medium text-gray-800">{split.contact_number}</span>
                            </div>
                          )}
                        </div>

                        {/* Qty allocation input (ONLY IN SPLIT MODE) */}
                        {isSplitMode && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Allocate Qty (Tons)</label>
                            <Input
                              type="number"
                              min="0"
                              value={allocVal}
                              onChange={(e) => updateAllocation(split.id, e.target.value)}
                              className="h-8 text-sm bg-white font-medium border-gray-200"
                              placeholder="Enter amount"
                            />
                          </div>
                        )}

                        {estTotal !== null && (
                          <div className={`flex justify-between items-center px-2 py-1.5 rounded ${isLowestCost ? "bg-green-100/70" : "bg-purple-100/50"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${isLowestCost ? "text-green-700" : "text-purple-700"}`}>Est. Cost</span>
                            <span className={`text-xs font-bold ${isLowestCost ? "text-green-700" : "text-purple-700"}`}>₹{(isFixed ? estTotal / poTotalQty * allocNum : estTotal).toLocaleString("en-IN", {maximumFractionDigits:2})}</span>
                          </div>
                        )}
                      </div>
                    )
                  })
                  })()}
                </div>

                {/* Grand total for the PO (ONLY IN SPLIT MODE) */}
                {isSplitMode && (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-100 text-sm">
                    <span className="text-gray-600">Total Allocated</span>
                    {(() => {
                      const totalAllocated = Object.values(allocations).reduce((sum, q) => sum + (parseFloat(q) || 0), 0)
                      const isBalanced = Math.abs(totalAllocated - poTotalQty) < 0.01
                      return (
                        <span className={`font-semibold ${isBalanced ? "text-green-700" : "text-red-600"}`}>
                          {totalAllocated} / {poTotalQty} {isBalanced ? "✓" : ""}
                        </span>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-white border-t p-4 px-6 flex flex-wrap justify-end gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Close
            </Button>
            <Button
              variant="outline"
              className="border-orange-200 text-orange-700 hover:bg-orange-50"
              onClick={handleRejectBack}
              disabled={isSubmitting || fetchingPlan}
            >
              <Truck className="w-4 h-4 mr-2" /> Reject &amp; Plan Again
            </Button>
            <Button
              variant="destructive"
              onClick={handleFullReject}
              disabled={isSubmitting || fetchingPlan}
            >
              <XCircle className="w-4 h-4 mr-2" /> Fully Reject
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 px-6"
              onClick={handleApprove}
              disabled={isSubmitting || fetchingPlan || transporterOptions.length === 0}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Approving...</>
              ) : (
                <><CheckSquare className="w-4 h-4 mr-2" /> Approve Plan</>
              )}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </div>
  )
}
