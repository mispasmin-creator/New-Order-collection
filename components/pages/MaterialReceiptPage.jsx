"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Search, CheckCircle2, Calendar } from "lucide-react"

export default function MaterialReceiptPage({ user, orders, updateOrders }) {
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    materialReceivedDate: "",
    grnNumber: "",
  })

  // Filter orders based on user role and full kitting completed
const getFilteredOrders = () => {
  let filtered = orders.filter(order => 
    order.expectedDeliveryDate &&  // Only orders with expected delivery
    !order.materialReceiptChecked &&   // Only show unchecked entries
    order.wetmanEntryChecked           // Only show with wetman entry history
  )
  
  if (user.role !== "master") {
    filtered = filtered.filter(order => order.firmName === user.firm)
  }
  return filtered
}

  const filteredOrders = getFilteredOrders()
  const pendingOrders = filteredOrders.filter((order) => !order.materialReceived)
  const historyOrders = orders.filter(order => 
    order.materialReceiptChecked &&
    order.expectedDeliveryDate &&
    (user.role === "master" || order.firmName === user.firm)
  )

  // Apply search filter
  const searchFilteredOrders = (ordersList) => {
    return ordersList.filter((order) =>
      Object.values(order).some((value) => value?.toString().toLowerCase().includes(searchTerm.toLowerCase())),
    )
  }

  const displayOrders =
    activeTab === "pending" ? searchFilteredOrders(pendingOrders) : searchFilteredOrders(historyOrders)

  const handleMaterial = (order) => {
    setSelectedOrder(order)
    setFormData({
      materialReceivedDate: "",
      grnNumber: "",
    })
  }

  const handleSubmit = () => {
  if (!selectedOrder) return

  const updatedOrders = orders.map((order) => {
    if (order.id === selectedOrder.id) {
      return {
        ...order,
        materialReceiptChecked: true,
        materialReceived: true,
        materialReceiptDate: new Date().toISOString().split("T")[0],
        // Add any other form fields
        ...formData
      }
    }
    return order
  })

  updateOrders(updatedOrders)
  setSelectedOrder(null)
  setFormData({
    materialReceivedDate: "",
    grnNumber: "",
  })
}

  const handleCancel = () => {
    setSelectedOrder(null)
    setFormData({
      materialReceivedDate: "",
      grnNumber: "",
    })
  }

  return (
    <div className="space-y-6">
      {/* Desktop Header */}
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-gray-900">Material Receipt</h1>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Material Receipt</h1>
        <p className="text-sm text-gray-600 mt-1">Manage material receipts</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Material Receipt Management</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-t-lg">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "pending"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending ({pendingOrders.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all text-center ${
                  activeTab === "history"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                History ({historyOrders.length})
              </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50 w-full"
                />
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                    {activeTab === "pending" && (
                      <TableHead className="font-semibold text-gray-900 py-4 px-6">Action</TableHead>
                    )}
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">DS-Number</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Serial No</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">LGST-SrN</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Firm Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Party Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Type of Transporting</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bill No</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bilty No</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-4 px-6">Bilty Image</TableHead>
                    {activeTab === "history" && (
                      <>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">Material Received Date</TableHead>
                        <TableHead className="font-semibold text-gray-900 py-4 px-6">GRN Number</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                      {activeTab === "pending" && (
                        <TableCell className="py-4 px-6">
                          <Button
                            size="sm"
                            onClick={() => handleMaterial(order)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Material
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="font-medium py-4 px-6">{order.dsNumber}</TableCell>
                      <TableCell className="py-4 px-6">{order.serialNo}</TableCell>
                      <TableCell className="font-medium py-4 px-6">{order.lgstNumber}</TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                          {order.firmName}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6">{order.partyName}</TableCell>
                      <TableCell className="py-4 px-6">{order.typeOfTransporting}</TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge className="bg-green-500 text-white rounded-full">{order.billNo}</Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge className="bg-purple-500 text-white rounded-full">{order.biltyNo}</Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {order.biltyImage && <Badge className="bg-blue-500 text-white rounded-full">Uploaded</Badge>}
                      </TableCell>
                      {activeTab === "history" && (
                        <>
                          <TableCell className="py-4 px-6">
                            <Badge className="bg-green-500 text-white rounded-full">
                              {order.materialReceivedDate}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge className="bg-orange-500 text-white rounded-full">{order.grnNumber}</Badge>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
                {displayOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No orders found</p>
                ) : (
                  displayOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">#{order.serialNo}</p>
                          <p className="text-xs text-gray-500">{order.partyPODate}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full text-xs">
                          {order.firmName}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">DS #:</span>
                          <span className="font-medium">{order.dsNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">LGST:</span>
                          <Badge className="bg-blue-500 text-white text-xs">{order.lgstNumber}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Party:</span>
                          <span className="font-medium">{order.partyName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transport:</span>
                          <span className="font-medium">{order.typeOfTransporting}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bill #:</span>
                          <Badge className="bg-green-500 text-white text-xs">{order.billNo}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bilty:</span>
                          <span className="font-medium">{order.biltyNo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Image:</span>
                          {order.biltyImage ? (
                            <Badge className="bg-blue-500 text-white text-xs">Uploaded</Badge>
                          ) : (
                            <span className="text-xs text-gray-500">Not uploaded</span>
                          )}
                        </div>
                        {activeTab === "history" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Received:</span>
                              <Badge className="bg-green-500 text-white text-xs">{order.materialReceivedDate}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">GRN #:</span>
                              <Badge className="bg-orange-500 text-white text-xs">{order.grnNumber}</Badge>
                            </div>
                          </>
                        )}
                      </div>

                      {activeTab === "pending" && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <Button
                            size="sm"
                            onClick={() => handleMaterial(order)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Confirm Receipt
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Results Count */}
            <div className="px-4 sm:px-6 py-3 bg-gray-50 text-sm text-gray-600 rounded-b-lg border-t border-gray-200">
              Showing {displayOrders.length} of{" "}
              {activeTab === "pending" ? pendingOrders.length : historyOrders.length} orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Material Modal - Fullscreen on Mobile */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">Material Receipt</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-4">
                {/* Pre-filled fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <Label className="text-xs">DS-Number</Label>
                    <Input value={selectedOrder.dsNumber} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Serial No</Label>
                    <Input value={selectedOrder.serialNo} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">LGST-SrN</Label>
                    <Input value={selectedOrder.lgstNumber} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Firm Name</Label>
                    <Input value={selectedOrder.firmName} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Party Name</Label>
                    <Input value={selectedOrder.partyName} disabled className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Product Name</Label>
                    <Input value={selectedOrder.products?.[0]?.productName || "N/A"} disabled className="h-9" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Bill No</Label>
                    <Input value={selectedOrder.billNo} disabled className="h-9" />
                  </div>
                </div>

                {/* Editable fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Material Received Date *</Label>
                    <Input
                      type="date"
                      value={formData.materialReceivedDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, materialReceivedDate: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">GRN Number *</Label>
                    <Input
                      value={formData.grnNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, grnNumber: e.target.value }))}
                      placeholder="Enter GRN number"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                    Submit Receipt
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}