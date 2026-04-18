"use client"

import { useState, useEffect } from "react"
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
import { Loader2, Truck, Plus, Trash2, CheckCircle, Clock } from "lucide-react"

export default function ArrangeLogistics({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // State for transporters
  const [transporters, setTransporters] = useState([
    { transporter_name: "", contact_number: "", rate: "", availability: "", remarks: "" }
  ])
  const [masterTransporters, setMasterTransporters] = useState([])

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
        const unique = [...new Set(data.map(d => d["Transporter Name"]).filter(t => t && t.trim() !== ""))]
        setMasterTransporters(unique.sort())
      }
    } catch (error) {
      console.error("Error fetching master transporters:", error)
    }
  }

  const fetchOrders = async () => {
    try {
      setLoading(true)
      // Fetch orders that have been received in accounts (Actual 2 is not null)
      // and haven't been submitted for logistics approval yet
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
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const openArrangeDialog = (order) => {
    setSelectedOrder(order)
    setTransporters([{ transporter_name: "", contact_number: "", rate: "", availability: "", remarks: "" }])
    setIsDialogOpen(true)
  }

  const handleAddTransporter = () => {
    if (transporters.length >= 3) {
      toast({
        title: "Limit Reached",
        description: "You can only add up to 3 transporters per PO.",
        variant: "warning"
      })
      return
    }
    setTransporters([...transporters, { transporter_name: "", contact_number: "", rate: "", availability: "", remarks: "" }])
  }

  const handleRemoveTransporter = (index) => {
    const newTransporters = [...transporters]
    newTransporters.splice(index, 1)
    setTransporters(newTransporters)
  }

  const handleTransporterChange = (index, field, value) => {
    const newTransporters = [...transporters]
    newTransporters[index][field] = value
    setTransporters(newTransporters)
  }

  const handleSubmit = async () => {
    // Validate
    const validTransporters = transporters.filter(t => t.transporter_name.trim() !== "")
    if (validTransporters.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one valid transporter.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)

      // 1. Insert transporters
      const transportersToInsert = validTransporters.map(t => ({
        po_id: selectedOrder.id,
        transporter_name: t.transporter_name,
        contact_number: t.contact_number,
        rate: parseFloat(t.rate) || 0,
        availability: t.availability,
        remarks: t.remarks,
        status: "Pending"
      }))

      const { error: insertError } = await supabase
        .from("po_transporters")
        .insert(transportersToInsert)

      if (insertError) throw insertError

      // 2. Update order status
      const { error: updateError } = await supabase
        .from("ORDER RECEIPT")
        .update({ logistics_status: "Pending Approval" })
        .eq("id", selectedOrder.id)

      if (updateError) throw updateError

      toast({
        title: "Success",
        description: "Logistics details submitted for approval.",
        className: "bg-green-50 text-green-800 border-green-200"
      })

      setIsDialogOpen(false)
      fetchOrders()

    } catch (error) {
      console.error("Error submitting details:", error)
      toast({
        title: "Submission Error",
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
        <span className="text-gray-600">Loading pending logistics...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Arrange Logistics</h1>
          <p className="text-gray-600">Capture transporter details for approved POs</p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending PO Arragement</CardTitle>
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
                  orders.map(order => (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Arrange Transporters</DialogTitle>
            <DialogDescription>
              Enter up to 3 transporter alternatives for PO: {selectedOrder?.["DO-Delivery Order No."]}
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
                  Transporter Option
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  <div className="lg:col-span-5 space-y-2">
                    <Label>Remarks (Optional)</Label>
                    <Input 
                      placeholder="Vehicle type, conditions, etc."
                      value={transporter.remarks}
                      onChange={(e) => handleTransporterChange(index, "remarks", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {transporters.length < 3 && (
              <Button 
                variant="outline" 
                onClick={handleAddTransporter}
                className="w-full border-dashed py-8 text-gray-500 hover:bg-gray-50 hover:text-blue-600"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Another Transporter Option
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || transporters.every(t => t.transporter_name.trim() === "")}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" /> Submit for Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
