"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
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
import { Loader2, CheckSquare, XCircle, LayoutList, Truck } from "lucide-react"

export default function LogisticsApproval({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [transporters, setTransporters] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fetchingTransporters, setFetchingTransporters] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      // Fetch orders pending approval
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
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const openReviewDialog = async (order) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
    setFetchingTransporters(true)
    
    try {
      const { data, error } = await supabase
        .from("po_transporters")
        .select("*")
        .eq("po_id", order.id)
        .order("id", { ascending: true })
        
      if (error) throw error
      
      setTransporters(data || [])
    } catch (err) {
      console.error("Error fetching transporters:", err)
      toast({
        title: "Failed to load transporters",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setFetchingTransporters(false)
    }
  }

  const handleApprove = async (transporterId) => {
    try {
      setIsSubmitting(true)

      // 1. Update chosen transporter to 'Approved'
      const { error: approveError } = await supabase
        .from("po_transporters")
        .update({ status: "Approved" })
        .eq("id", transporterId)

      if (approveError) throw approveError

      // Update other transporters to 'Rejected'
      await supabase
        .from("po_transporters")
        .update({ status: "Rejected" })
        .eq("po_id", selectedOrder.id)
        .neq("id", transporterId)

      // 2. Update order status and link approved transporter
      const { error: updateOrderError } = await supabase
        .from("ORDER RECEIPT")
        .update({ 
          logistics_status: "Approved",
          approved_transporter_id: transporterId
        })
        .eq("id", selectedOrder.id)

      if (updateOrderError) throw updateOrderError

      toast({
        title: "Transporter Approved",
        description: "The logistics option has been finalized.",
        className: "bg-green-50 text-green-800 border-green-200"
      })

      setIsDialogOpen(false)
      fetchOrders()

    } catch (error) {
      console.error("Approval flow error:", error)
      toast({
        title: "Error Approvng",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRejectAll = async () => {
    try {
      setIsSubmitting(true)

      // Reject all transporters
      await supabase
        .from("po_transporters")
        .update({ status: "Rejected" })
        .eq("po_id", selectedOrder.id)

      // Send the order back to arrangement phase
      const { error: updateOrderError } = await supabase
        .from("ORDER RECEIPT")
        .update({ 
          logistics_status: "Pending Arrangement"
        })
        .eq("id", selectedOrder.id)

      if (updateOrderError) throw updateOrderError

      toast({
        title: "Options Rejected",
        description: "The PO has been sent back for new logistics arrangement.",
        className: "bg-red-50 text-red-800 border-red-200"
      })

      setIsDialogOpen(false)
      fetchOrders()

    } catch (error) {
      console.error("Rejection error:", error)
      toast({
        title: "Error rejecting",
        description: error.message,
        variant: "destructive"
      })
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
          <p className="text-gray-600">Review and approve transporter arrangements</p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
                  orders.map(order => (
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
                          Review Options
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-50">
          <DialogHeader className="bg-white p-6 -m-6 mb-6 pb-6 border-b">
            <DialogTitle className="text-xl">Review Logistics Options</DialogTitle>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {transporters.map((t, index) => (
                <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                  <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-semibold flex items-center">
                      <Truck className="w-4 h-4 mr-2" /> Option {index + 1}
                    </h3>
                    <span className="bg-blue-800 px-2 py-1 rounded text-xs font-bold">
                       ₹ {t.rate}
                    </span>
                  </div>
                  <div className="p-5 flex-1 space-y-4 text-sm">
                     <div>
                       <span className="text-gray-500 text-xs uppercase block mb-1">Agency / Name</span>
                       <span className="font-medium text-base">{t.transporter_name}</span>
                     </div>
                     <div>
                       <span className="text-gray-500 text-xs uppercase block mb-1">Contact Details</span>
                       <span className="font-medium">{t.contact_number || "N/A"}</span>
                     </div>
                     <div>
                       <span className="text-gray-500 text-xs uppercase block mb-1">Availability</span>
                       <span className="font-medium">{t.availability || "N/A"}</span>
                     </div>
                     {t.remarks && (
                       <div className="pt-2 border-t border-gray-100">
                         <span className="text-gray-500 text-xs uppercase block mb-1">Remarks</span>
                         <span className="text-gray-700 italic">{t.remarks}</span>
                       </div>
                     )}
                  </div>
                  <div className="p-4 bg-gray-50 border-t border-gray-100">
                     <Button 
                       className="w-full bg-green-600 hover:bg-green-700 font-semibold"
                       onClick={() => handleApprove(t.id)}
                       disabled={isSubmitting}
                     >
                       <CheckSquare className="w-4 h-4 mr-2" /> Select & Approve
                     </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              Close
            </Button>
            <Button 
               variant="destructive" 
               onClick={handleRejectAll}
               disabled={isSubmitting || fetchingTransporters}
            >
              <XCircle className="w-4 h-4 mr-2" /> Reject All & Arrange Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
