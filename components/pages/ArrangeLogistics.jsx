"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Truck, CheckCircle, Clock, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { groupRowsByPo } from "@/lib/workflowGrouping"

export default function ArrangeLogistics({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transporterOptions, setTransporterOptions] = useState([])
  const [masterTransporters, setMasterTransporters] = useState([])
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

  useEffect(() => {
    fetchOrders()
    fetchMasterTransporters()
  }, [])

  const fetchMasterTransporters = async () => {
    try {
      const { data, error } = await supabase
        .from("MASTER")
        .select('"Transporter Name"')
        .not("Transporter Name", "is", null)
      if (error) throw error
      if (data) {
        const unique = [...new Set(data.map((d) => d["Transporter Name"]).filter((t) => t && t.trim() !== ""))]
        setMasterTransporters(unique.sort())
      }
    } catch (error) {
      console.error("Error fetching master transporters:", error)
    }
  }

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("ORDER RECEIPT")
        .select("*")
        .not("Actual 2", "is", null)
        .or("logistics_status.eq.Pending Arrangement,logistics_status.is.null")
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

  const emptyOption = () => ({
    transporter_name: "",
    rateType: "",
    cost: "",
  })

  const openArrangeDialog = (group) => {
    setSelectedGroup(group)
    setTransporterOptions([emptyOption(), emptyOption(), emptyOption()])
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setSelectedGroup(null)
    setTransporterOptions([])
  }

  const handleOptionChange = (optionIndex, field, value) => {
    if (field === "cost") value = value === "" ? "" : value.replace(/[^0-9.]/g, "")
    setTransporterOptions((prev) => {
      const next = [...prev]
      next[optionIndex] = { ...next[optionIndex], [field]: value }
      return next
    })
  }

  const addOption = () => {
    if (transporterOptions.length >= 10) {
      toast({ description: "Max 10 transporter options allowed", variant: "destructive" })
      return
    }
    setTransporterOptions((prev) => [...prev, emptyOption()])
  }

  const removeOption = (optionIndex) => {
    if (transporterOptions.length <= 1) {
      toast({ description: "At least one transporter option required", variant: "destructive" })
      return
    }
    setTransporterOptions((prev) => prev.filter((_, i) => i !== optionIndex))
  }

  const handleSubmit = async () => {
    const validOptions = transporterOptions.filter((o) => o.transporter_name.trim())
    if (validOptions.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill at least one transporter option.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      // 1. Create one plan for the entire PO group
      const { data: insertedPlan, error: planError } = await supabase
        .from("po_logistics_plans")
        .insert([{
          po_id: selectedGroup.rows[0].id,
          mode: "single",
          status: "Pending Approval",
          created_by: user?.name || user?.username || user?.email || "Unknown",
        }])
        .select("id")
        .single()

      if (planError) throw planError

      // 2. Duplicate splits per product (order) so LogisticsApproval can allocate
      const splitRows = []
      selectedGroup.rows.forEach((order, pIdx) => {
        validOptions.forEach((opt, oIdx) => {
          splitRows.push({
            plan_id: insertedPlan.id,
            po_id: order.id,
            transporter_name: opt.transporter_name,
            vehicle_details: opt.rateType, // Using vehicle_details to store rateType for display
            rate: parseFloat(opt.cost) || 0,
            allocated_qty: parseFloat(order.Quantity) || 1,
            sort_order: pIdx * 10 + oIdx,
          })
        })
      })

      const { error: splitError } = await supabase
        .from("po_logistics_splits")
        .insert(splitRows)

      if (splitError) throw splitError

      // 3. Update all ORDER RECEIPT rows in this PO to Pending Approval
      const { error: updateError } = await supabase
        .from("ORDER RECEIPT")
        .update({ logistics_status: "Pending Approval", approved_logistics_plan_id: null })
        .in("id", selectedGroup.rows.map((r) => r.id))

      if (updateError) throw updateError

      toast({
        title: "Success",
        description: "Logistics plan submitted for approval.",
        className: "bg-green-50 text-green-800 border-green-200",
      })

      closeDialog()
      fetchOrders()
    } catch (error) {
      console.error("Error submitting logistics plan:", error)
      toast({ title: "Submission Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading pending logistics...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Arrange Logistics</h1>
          <p className="text-gray-600">Assign a transporter for each product in a PO</p>
        </div>
        <Button variant="outline" onClick={fetchOrders} disabled={loading}>
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending PO Arrangement</CardTitle>
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
                      No POs currently pending logistics arrangement.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedOrders.map((group) => {
                    const isExpanded = expandedPO === group.key
                    return (
                      <Fragment key={group.key}>
                        {/* PO header row */}
                        <TableRow
                          className="bg-slate-50 cursor-pointer hover:bg-slate-100"
                          onClick={() => setExpandedPO(isExpanded ? null : group.key)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => openArrangeDialog(group)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Truck className="w-4 h-4 mr-2" />
                              Arrange
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

                        {/* Expanded detail panel */}
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-5xl max-h-[94vh] overflow-y-auto p-0">

          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              Arrange Logistics
            </DialogTitle>
            <div className="flex flex-col gap-2 mt-4 text-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Products in this PO</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedGroup?.rows.map((row, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <span className="font-medium text-gray-800 truncate mr-2" title={row["Product Name"]}>{row["Product Name"]}</span>
                    <span className="text-xs font-bold text-gray-600 bg-gray-200/60 px-2 py-0.5 rounded">{row.Quantity} Tons</span>
                  </div>
                ))}
              </div>
            </div>
          </DialogHeader>

          {/* Global Transporter Options */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Transporter Options</p>
                <p className="text-xs text-gray-500">Provide options for the entire PO (max 10).</p>
              </div>
              <Button variant="outline" size="sm" onClick={addOption}>
                <Plus className="w-4 h-4 mr-1" /> Add Transporter
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {transporterOptions.map((opt, oIdx) => {
                // Calculate est total based on PO quantity sum
                const totalPoQty = selectedGroup?.rows.reduce((sum, r) => sum + (parseFloat(r.Quantity) || 0), 0) || 1
                const entered = parseFloat(opt.cost) || 0
                const isFixed = opt.rateType === "Fixed"
                const estTotalCost = isFixed ? entered : entered * totalPoQty
                const estRatePerMt = isFixed ? (entered / totalPoQty) : entered

                return (
                  <div
                    key={oIdx}
                    className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/30 hover:border-gray-300 transition-all"
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Transporter {oIdx + 1}
                      </span>
                      {transporterOptions.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeOption(oIdx)}
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Name / Agency */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Name / Agency</Label>
                      <Select
                        value={opt.transporter_name}
                        onValueChange={(v) => handleOptionChange(oIdx, "transporter_name", v)}
                      >
                        <SelectTrigger className="h-9 bg-white text-sm">
                          <SelectValue placeholder="Select Transporter" />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 overflow-y-auto">
                          {masterTransporters.length === 0 ? (
                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                          ) : (
                            masterTransporters.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Rate Type + Entered Rate */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="block mb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Rate Type</Label>
                        <Select value={opt.rateType || undefined} onValueChange={(value) => handleOptionChange(oIdx, "rateType", value)}>
                          <SelectTrigger className="text-sm border-gray-200 h-9 bg-white text-gray-700">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Fixed">Fixed</SelectItem>
                            <SelectItem value="Per MT">Per MT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="block mb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Entered Rate</Label>
                        <Input 
                          value={opt.cost} 
                          onChange={(e) => handleOptionChange(oIdx, "cost", e.target.value)} 
                          className="text-sm border-gray-200 h-9 bg-white" 
                          placeholder="0.00" 
                        />
                      </div>
                    </div>

                    {/* Cost Estimates */}
                    {opt.cost && opt.rateType && (
                      <div className="pt-3 border-t border-gray-100 space-y-2">
                        <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50/50 border border-blue-100/50">
                          <span className="text-xs font-medium text-blue-700">Est. Rate per MT:</span>
                          <span className="text-sm font-bold text-blue-700">₹{estRatePerMt.toLocaleString("en-IN", {maximumFractionDigits:2})}</span>
                        </div>
                        <div className="flex justify-between items-center px-2 text-xs">
                          <span className="text-gray-500 italic">Total PO Est. Cost:</span>
                          <span className="font-semibold text-gray-700">₹{estTotalCost.toLocaleString("en-IN", {maximumFractionDigits:2})}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-white border-t p-4 px-6 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting} className="px-6">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || transporterOptions.every((o) => !o.transporter_name.trim())}
              className="px-6 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" /> Submit for Approval</>
              )}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </div>
  )
}
