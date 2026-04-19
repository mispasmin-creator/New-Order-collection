"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, CheckSquare, XCircle, LayoutList, Truck, SplitSquareVertical } from "lucide-react"
import { groupRowsByPo } from "@/lib/workflowGrouping"

export default function LogisticsApproval() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [transporters, setTransporters] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [isLegacyTransporters, setIsLegacyTransporters] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fetchingTransporters, setFetchingTransporters] = useState(false)
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
  }, [])

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
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const openReviewDialog = async (order) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
    setFetchingTransporters(true)
    setSelectedPlan(null)
    setIsLegacyTransporters(false)

    try {
      const { data: plans, error: planError } = await supabase
        .from("po_logistics_plans")
        .select("*")
        .eq("po_id", order.id)
        .eq("status", "Pending Approval")
        .order("id", { ascending: false })
        .limit(1)

      if (planError && planError.code !== "PGRST205") throw planError

      const currentPlan = plans?.[0]
      if (currentPlan) {
        const { data: splits, error: splitError } = await supabase
          .from("po_logistics_splits")
          .select("*")
          .eq("plan_id", currentPlan.id)
          .order("sort_order", { ascending: true })

        if (splitError) throw splitError

        setSelectedPlan(currentPlan)
        setTransporters(splits || [])
        setIsLegacyTransporters(false)
        return
      }

      const { data, error } = await supabase
        .from("po_transporters")
        .select("*")
        .eq("po_id", order.id)
        .order("id", { ascending: true })

      if (error) throw error

      setTransporters(data || [])
      setIsLegacyTransporters(true)
    } catch (err) {
      console.error("Error fetching logistics plan:", err)
      toast({
        title: "Failed to load logistics plan",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setFetchingTransporters(false)
    }
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setSelectedOrder(null)
    setSelectedPlan(null)
    setTransporters([])
    setIsLegacyTransporters(false)
  }

  const handleApprove = async (selectedSplitId = null) => {
    try {
      setIsSubmitting(true)

      if (selectedPlan && !isLegacyTransporters) {
        // Update Plan Status
        const { error: approvePlanError } = await supabase
          .from("po_logistics_plans")
          .update({ status: "Approved" })
          .eq("id", selectedPlan.id)

        if (approvePlanError) throw approvePlanError

        // If a specific split is selected (Single/Comparison mode)
        if (selectedSplitId) {
          // Approve the selected one
          await supabase
            .from("po_logistics_splits")
            .update({ status: "Approved" })
            .eq("id", selectedSplitId)

          // Reject the others
          await supabase
            .from("po_logistics_splits")
            .update({ status: "Rejected" })
            .eq("plan_id", selectedPlan.id)
            .neq("id", selectedSplitId)
        } else {
          // Default: Approve all splits (Split logistics)
          const { error: splitApproveError } = await supabase
            .from("po_logistics_splits")
            .update({ status: "Approved" })
            .eq("plan_id", selectedPlan.id)

          if (splitApproveError) throw splitApproveError
        }

        const { error: updateOrderError } = await supabase
          .from("ORDER RECEIPT")
          .update({
            logistics_status: "Approved",
            approved_logistics_plan_id: selectedPlan.id,
            approved_transporter_id: null,
          })
          .eq("id", selectedOrder.id)

        if (updateOrderError) throw updateOrderError
      } else {
        const transporterId = transporters[0]?.id
        if (!transporterId) {
          throw new Error("No legacy transporter option found to approve.")
        }

        const { error: approveError } = await supabase
          .from("po_transporters")
          .update({ status: "Approved" })
          .eq("id", transporterId)

        if (approveError) throw approveError

        await supabase
          .from("po_transporters")
          .update({ status: "Rejected" })
          .eq("po_id", selectedOrder.id)
          .neq("id", transporterId)

        const { error: updateOrderError } = await supabase
          .from("ORDER RECEIPT")
          .update({
            logistics_status: "Approved",
            approved_transporter_id: transporterId,
            approved_logistics_plan_id: null,
          })
          .eq("id", selectedOrder.id)

        if (updateOrderError) throw updateOrderError
      }

      toast({
        title: "Logistics Plan Approved",
        description: "The logistics arrangement has been finalized.",
        className: "bg-green-50 text-green-800 border-green-200",
      })

      closeDialog()
      fetchOrders()
    } catch (error) {
      console.error("Approval flow error:", error)
      toast({
        title: "Error approving plan",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRejectAll = async () => {
    try {
      setIsSubmitting(true)

      if (selectedPlan && !isLegacyTransporters) {
        await supabase
          .from("po_logistics_plans")
          .update({ status: "Rejected" })
          .eq("id", selectedPlan.id)

        await supabase
          .from("po_logistics_splits")
          .update({ status: "Rejected" })
          .eq("plan_id", selectedPlan.id)
      }

      const { error: updateOrderError } = await supabase
        .from("ORDER RECEIPT")
        .update({
          logistics_status: "Pending Arrangement",
          approved_logistics_plan_id: null,
        })
        .eq("id", selectedOrder.id)

      if (updateOrderError) throw updateOrderError

      toast({
        title: "Arrangement Sent Back",
        description: "The PO has been sent back for a new logistics arrangement.",
        className: "bg-orange-50 text-orange-800 border-orange-200",
      })

      closeDialog()
      fetchOrders()
    } catch (error) {
      console.error("Rejection error:", error)
      toast({
        title: "Error rejecting plan",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFullReject = async () => {
    try {
      setIsSubmitting(true)

      if (selectedPlan && !isLegacyTransporters) {
        await supabase
          .from("po_logistics_plans")
          .update({ status: "Rejected" })
          .eq("id", selectedPlan.id)

        await supabase
          .from("po_logistics_splits")
          .update({ status: "Rejected" })
          .eq("plan_id", selectedPlan.id)
      }

      const { error: updateOrderError } = await supabase
        .from("ORDER RECEIPT")
        .update({
          logistics_status: "Logistics Rejected",
          approved_logistics_plan_id: null,
        })
        .eq("id", selectedOrder.id)

      if (updateOrderError) throw updateOrderError

      toast({
        title: "Logistics Fully Rejected",
        description: "The logistics for this PO have been cancelled and removed from the active pipeline.",
        className: "bg-red-50 text-red-800 border-red-200",
      })

      closeDialog()
      fetchOrders()
    } catch (error) {
      console.error("Full rejection error:", error)
      toast({
        title: "Error during full rejection",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper to determine if we are in comparison mode (either explicitly or auto-detected)
  const isComparisonMode = useMemo(() => {
    if (!selectedPlan || !selectedOrder) return false;
    if (selectedPlan.mode === "single") return true;
    
    // Auto-detection: If it's saved as "split" but we have multiple rows 
    // where each row has the FULL quantity, it's actually a comparison (options).
    const orderQty = parseFloat(selectedOrder.Quantity) || 0;
    if (selectedPlan.mode === "split" && transporters.length > 1 && orderQty > 0) {
      return transporters.every(t => Math.abs((parseFloat(t.allocated_qty) || 0) - orderQty) < 0.01);
    }
    
    return false;
  }, [selectedPlan, selectedOrder, transporters]);

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
          <p className="text-gray-600">Review and approve transporter arrangements</p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Logistics Verification</CardTitle>
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
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No logistics currently pending approval.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedOrders.map((group) => (
                    <Fragment key={group.key}>
                      <TableRow className="bg-slate-50">
                        <TableCell colSpan={6} className="px-4 py-3">
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
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openReviewDialog(order)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <LayoutList className="w-4 h-4 mr-2" />
                          Review Plan
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-50">
          <DialogHeader className="bg-white p-6 -m-6 mb-6 pb-6 border-b">
            <DialogTitle className="text-xl">Review Logistics Plan</DialogTitle>
            <DialogDescription className="mt-2">
              PO: <span className="font-semibold">{selectedOrder?.["DO-Delivery Order No."]}</span> | Product: {selectedOrder?.["Product Name"]} ({selectedOrder?.Quantity})
            </DialogDescription>
          </DialogHeader>

          {fetchingTransporters ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : transporters.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No transporters found for this arrangement.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 flex items-center">
                    {selectedPlan && !isLegacyTransporters ? (
                      <>
                        <SplitSquareVertical className="w-4 h-4 mr-2" />
                        {selectedPlan.mode === "split" ? "Split Logistics Plan" : "Single Logistics Plan"}
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4 mr-2" />
                        Legacy Transporter Options
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {isComparisonMode
                      ? "Choose the best transporter option from the list below."
                      : "Review the full arrangement and approve or reject it as one plan."}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Rows: {transporters.length}
                  </Badge>
                  {selectedPlan && !isLegacyTransporters && (
                    <Badge variant="outline" className={`border-2 ${isComparisonMode && selectedPlan.mode === "split" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                      Mode: {isComparisonMode ? "comparison (options)" : selectedPlan.mode}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Transporter</TableHead>
                      <TableHead>Allocated Qty</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Vehicle Details</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Remarks</TableHead>
                      {isComparisonMode && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transporters.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {isComparisonMode && <span className="text-xs text-blue-600 block">Option {index + 1}</span>}
                          {row.transporter_name}
                        </TableCell>
                        <TableCell>{row.allocated_qty ?? selectedOrder?.Quantity ?? "N/A"}</TableCell>
                        <TableCell>{row.rate ?? "N/A"}</TableCell>
                        <TableCell>{row.vehicle_details || "N/A"}</TableCell>
                        <TableCell>{row.contact_number || "N/A"}</TableCell>
                        <TableCell>{row.availability || "N/A"}</TableCell>
                        <TableCell>{row.remarks || "N/A"}</TableCell>
                        {isComparisonMode && (
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white font-bold"
                              onClick={() => handleApprove(row.id)}
                              disabled={isSubmitting}
                            >
                              <CheckSquare className="w-4 h-4 mr-2" />
                              Approve Option {index + 1}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Close
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 font-bold"
              onClick={() => handleApprove()}
              disabled={isSubmitting || fetchingTransporters || transporters.length === 0 || isComparisonMode}
            >
              <CheckSquare className="w-4 h-4 mr-2" /> Approve All Splits
            </Button>
            <Button
              variant="outline"
              className="border-orange-200 text-orange-700 hover:bg-orange-50 font-medium"
              onClick={handleRejectAll}
              disabled={isSubmitting || fetchingTransporters || transporters.length === 0}
            >
              <Truck className="w-4 h-4 mr-2" /> Reject & Plan Again
            </Button>
            <Button
              variant="destructive"
              onClick={handleFullReject}
              disabled={isSubmitting || fetchingTransporters || transporters.length === 0}
            >
              <XCircle className="w-4 h-4 mr-2" /> Fully Reject (Cancel)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
