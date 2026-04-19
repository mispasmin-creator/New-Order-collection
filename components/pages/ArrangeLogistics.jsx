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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Truck, Plus, Trash2, CheckCircle, Clock, SplitSquareVertical } from "lucide-react"
import { groupRowsByPo } from "@/lib/workflowGrouping"

const createSplitRow = (quantity = "") => ({
  transporter_name: "",
  contact_number: "",
  rate: "",
  availability: "",
  remarks: "",
  allocated_qty: quantity,
})

const parseQuantity = (value) => {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function ArrangeLogistics({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [arrangementMode, setArrangementMode] = useState("single")
  const [transporters, setTransporters] = useState([createSplitRow("")])
  const [masterTransporters, setMasterTransporters] = useState([])
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
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const openArrangeDialog = (order) => {
    const totalQty = order?.Quantity?.toString?.() || ""
    setSelectedOrder(order)
    setArrangementMode("single")
    setTransporters([createSplitRow(totalQty)])
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setSelectedOrder(null)
    setArrangementMode("single")
    setTransporters([createSplitRow("")])
  }

  const handleAddTransporter = () => {
    setTransporters((prev) => [...prev, createSplitRow("")])
  }

  const handleRemoveTransporter = (index) => {
    setTransporters((prev) => {
      const next = [...prev]
      next.splice(index, 1)
      return next.length > 0 ? next : [createSplitRow("")]
    })
  }

  const handleTransporterChange = (index, field, value) => {
    setTransporters((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleModeChange = (mode) => {
    const totalQty = selectedOrder ? parseQuantity(selectedOrder.Quantity) : 0
    setArrangementMode(mode)

    if (mode === "single") {
      setTransporters((prev) => {
        const first = prev[0] || createSplitRow("")
        return [{ ...first, allocated_qty: totalQty > 0 ? totalQty.toString() : "" }]
      })
      return
    }

    setTransporters((prev) => {
      if (prev.length > 1) return prev
      const first = prev[0] || createSplitRow("")
      return [
        { ...first, allocated_qty: totalQty > 0 ? (totalQty / 2).toString() : "" },
        createSplitRow(""),
      ]
    })
  }

  const totalOrderQty = selectedOrder ? parseQuantity(selectedOrder.Quantity) : 0
  const allocatedQty = transporters.reduce((sum, row) => sum + parseQuantity(row.allocated_qty), 0)
  const remainingQty = totalOrderQty - allocatedQty
  const hasOverAllocation = remainingQty < 0
  const isExactAllocation = totalOrderQty > 0 && Math.abs(remainingQty) < 0.0001

  const rowErrors = transporters.map((row) => {
    const errors = []
    if (!row.transporter_name.trim()) {
      errors.push("Select a transporter")
    }
    if (parseQuantity(row.allocated_qty) <= 0) {
      errors.push("Enter a valid quantity")
    }
    return errors
  })

  const handleSubmit = async () => {
    const validRows = transporters.filter(
      (row) => row.transporter_name.trim() !== "" || parseQuantity(row.allocated_qty) > 0
    )

    if (validRows.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one valid logistics row.",
        variant: "destructive",
      })
      return
    }

    if (rowErrors.some((errors) => errors.length > 0)) {
      toast({
        title: "Validation Error",
        description: "Complete transporter and quantity details for every row.",
        variant: "destructive",
      })
      return
    }

    if (!isExactAllocation || hasOverAllocation) {
      toast({
        title: "Validation Error",
        description: "Allocated quantity must match the total item quantity exactly.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const planPayload = {
        po_id: selectedOrder.id,
        mode: arrangementMode === "split" || validRows.length > 1 ? "split" : "single",
        status: "Pending Approval",
        created_by: user?.name || user?.username || user?.email || "Unknown",
      }

      const { data: insertedPlan, error: planInsertError } = await supabase
        .from("po_logistics_plans")
        .insert([planPayload])
        .select("id")
        .single()

      if (planInsertError) throw planInsertError

      const splitRows = validRows.map((row, index) => ({
        plan_id: insertedPlan.id,
        po_id: selectedOrder.id,
        transporter_name: row.transporter_name,
        contact_number: row.contact_number,
        rate: parseFloat(row.rate) || 0,
        availability: row.availability,
        remarks: row.remarks,
        allocated_qty: parseQuantity(row.allocated_qty),
        sort_order: index,
      }))

      const { error: splitInsertError } = await supabase
        .from("po_logistics_splits")
        .insert(splitRows)

      if (splitInsertError) throw splitInsertError

      const { error: updateError } = await supabase
        .from("ORDER RECEIPT")
        .update({
          logistics_status: "Pending Approval",
          approved_logistics_plan_id: null,
        })
        .eq("id", selectedOrder.id)

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
      toast({
        title: "Submission Error",
        description: error.message,
        variant: "destructive",
      })
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
          <p className="text-gray-600">Capture single or split transporter allocations for approved POs</p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
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
                  <TableHead>PO ID</TableHead>
                  <TableHead>DO No.</TableHead>
                  <TableHead>Firm</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No POs currently pending logistics arrangement.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedOrders.map((group) => (
                    <Fragment key={group.key}>
                      <TableRow className="bg-slate-50">
                        <TableCell colSpan={7} className="px-4 py-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-900">PO Number: {group.poNumber}</span>
                              <span className="text-xs text-slate-600">Party Name: {group.partyName}</span>
                            </div>
                            <span className="text-xs text-slate-500">{group.rows.length} item{group.rows.length > 1 ? "s" : ""}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.rows.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.id}</TableCell>
                      <TableCell>{order["DO-Delivery Order No."]}</TableCell>
                      <TableCell>{order["Firm Name"]}</TableCell>
                      <TableCell>{order["Product Name"]}</TableCell>
                      <TableCell>{order.Quantity}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending Arrangement
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openArrangeDialog(order)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          Arrange
                        </Button>
                      </TableCell>
                    </TableRow>
                      ))}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Arrange Logistics</DialogTitle>
            <DialogDescription>
              Build a single or split logistics plan for PO: {selectedOrder?.["DO-Delivery Order No."]}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase">Product</p>
                <p className="text-sm font-medium">{selectedOrder?.["Product Name"]}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase">Quantity</p>
                <p className="text-sm font-medium">{selectedOrder?.Quantity}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase">Party Name</p>
                <p className="text-sm font-medium">{selectedOrder?.["Party Names"]}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase">Destination</p>
                <p className="text-sm font-medium">{selectedOrder?.Address || "Not specified"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => handleModeChange("single")}
                className={`rounded-xl border p-4 text-left transition-colors ${arrangementMode === "single" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
              >
                <p className="text-sm font-semibold text-gray-900 flex items-center">
                  <Truck className="w-4 h-4 mr-2" />
                  Single Transporter
                </p>
                <p className="mt-1 text-xs text-gray-600">Assign the full quantity to one transporter.</p>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("split")}
                className={`rounded-xl border p-4 text-left transition-colors ${arrangementMode === "split" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
              >
                <p className="text-sm font-semibold text-gray-900 flex items-center">
                  <SplitSquareVertical className="w-4 h-4 mr-2" />
                  Split Logistics
                </p>
                <p className="mt-1 text-xs text-gray-600">Split the quantity across multiple transporter rows.</p>
              </button>
              <div className={`rounded-xl border p-4 ${hasOverAllocation ? "border-red-200 bg-red-50" : isExactAllocation ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                <p className="text-xs font-semibold uppercase text-gray-600">Quantity Summary</p>
                <p className="mt-2 text-sm text-gray-800">Allocated: <span className="font-semibold">{allocatedQty}</span></p>
                <p className="text-sm text-gray-800">Remaining: <span className="font-semibold">{remainingQty}</span></p>
                {hasOverAllocation && <p className="mt-2 text-xs text-red-600">Allocated quantity exceeds the item quantity.</p>}
                {!hasOverAllocation && !isExactAllocation && <p className="mt-2 text-xs text-amber-700">Allocation must match the total quantity before submit.</p>}
                {isExactAllocation && <p className="mt-2 text-xs text-green-700">Quantity is balanced and ready for approval.</p>}
              </div>
            </div>

            {transporters.map((transporter, index) => (
              <div key={index} className="relative bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
                <div className="absolute top-4 right-4">
                  {transporters.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTransporter(index)}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 h-8"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  )}
                </div>

                <h3 className="text-md font-semibold text-gray-800 mb-4 flex items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 text-sm">
                    {index + 1}
                  </div>
                  {arrangementMode === "split" ? "Split Allocation" : "Transporter Assignment"}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="lg:col-span-2 space-y-2">
                    <Label>Name / Agency</Label>
                    <Select
                      value={transporter.transporter_name}
                      onValueChange={(value) => handleTransporterChange(index, "transporter_name", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Transporter" />
                      </SelectTrigger>
                      <SelectContent>
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
                  <div className="space-y-2">
                    <Label>Allocated Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Qty"
                      value={transporter.allocated_qty}
                      onChange={(e) => handleTransporterChange(index, "allocated_qty", e.target.value)}
                      disabled={arrangementMode === "single"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Info</Label>
                    <Input
                      placeholder="Phone or Name"
                      value={transporter.contact_number}
                      onChange={(e) => handleTransporterChange(index, "contact_number", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate</Label>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={transporter.rate}
                      onChange={(e) => handleTransporterChange(index, "rate", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Availability</Label>
                    <Input
                      placeholder="e.g. Tomorrow"
                      value={transporter.availability}
                      onChange={(e) => handleTransporterChange(index, "availability", e.target.value)}
                    />
                  </div>
                  <div className="lg:col-span-6 space-y-2">
                    <Label>Remarks (Optional)</Label>
                    <Input
                      placeholder="Vehicle type, conditions, etc."
                      value={transporter.remarks}
                      onChange={(e) => handleTransporterChange(index, "remarks", e.target.value)}
                    />
                  </div>
                </div>

                {rowErrors[index].length > 0 && (
                  <div className="mt-3 rounded-md bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                    {rowErrors[index].join(" • ")}
                  </div>
                )}
              </div>
            ))}

            {arrangementMode === "split" && (
              <Button
                variant="outline"
                onClick={handleAddTransporter}
                className="w-full border-dashed py-8 text-gray-500 hover:bg-gray-50 hover:text-blue-600"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Split Row
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || transporters.every((row) => row.transporter_name.trim() === "") || !isExactAllocation || hasOverAllocation || rowErrors.some((errors) => errors.length > 0)}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" /> Submit Plan for Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
