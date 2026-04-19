"use client";

import { useState, useEffect, useMemo } from "react";
import { getISTFullDisplayDateTime } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Search,
  CheckCircle2,
  Loader2,
  Calendar,
  FileText,
  Truck,
  ChevronDown,
  ChevronRight,
  Building,
} from "lucide-react";

import { useNotification } from "@/components/providers/NotificationProvider";
import { supabase } from "@/lib/supabaseClient";
import { getISTTimestamp } from "@/lib/dateUtils";

export default function DispatchPlanningPage({ user }) {
  const { updateCount } = useNotification();
  const [orders, setOrders] = useState([]);
  const [dispatchHistory, setDispatchHistory] = useState([]); // New state for dispatch history
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    qtyToBeDispatched: "",
    typeOfTransporting: "",
    dateOfDispatch: "",
    toBeReconfirm: "Yes",
    testCertificateMade: "No",
    testCertificateFile: null,
  });
  const [expandedPOs, setExpandedPOs] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const pendingCount = orders.filter(
      (order) =>
        order.planned4 &&
        order.planned4.trim() !== "" &&
        (!order.actual4 || order.actual4.trim() === ""),
    ).length;
    updateCount("Dispatch Planning", pendingCount);
  }, [orders, updateCount]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch orders from ORDER RECEIPT
      let query = supabase
        .from("ORDER RECEIPT")
        .select("*")
        .order("id", { ascending: false });

      // Filter by user firm if not master
      if (user.role !== "master") {
        const userFirms = user.firm
          ? user.firm.split(",").map((f) => f.trim())
          : [];
        if (!userFirms.includes("all")) {
          query = query.in("Firm Name", userFirms);
        }
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      if (ordersData) {
        const transformedOrders = ordersData.map((row) => {
          const qty = parseFloat(row["Quantity"]) || 0;
          const delivered = parseFloat(row["Delivered"]) || 0;
          let pending = parseFloat(row["Pending Qty"]);
          if (
            row["Pending Qty"] === null ||
            row["Pending Qty"] === undefined ||
            isNaN(pending)
          ) {
            pending = qty - delivered;
          }

          return {
            id: row.id,
            rowIndex: row.id,
            deliveryOrderNo: row["DO-Delivery Order No."] || "",
            partyPONumber: row["PARTY PO NO (As Per Po Exact)"] || "",
            partyName: row["Party Names"] || "",
            productName: row["Product Name"] || "",
            quantity: qty,
            quantityDelivered: delivered,
            pendingQty: pending,
            status: row["Status"] || "Pending",
            firmName: row["Firm Name"] || "",
            planned4: formatDate(row["Planned 4"]),
            actual4: formatDate(row["Actual 4"]),
            typeOfTransporting: row["Type Of Transporting"] || "",
            dateOfDispatch: formatDate(row["Expected Delivery Date"]),
            timestamp: formatDate(row["Actual 4"]),
          };
        });

        setOrders(transformedOrders);

        // 2. Fetch dispatch history from DISPATCH table
        // We fetch this AFTER orders so we can filter by firm if needed
        const { data: dispatchData, error: dispatchError } = await supabase
          .from("DISPATCH")
          .select("*")
          .order("id", { ascending: false });

        if (dispatchError) throw dispatchError;

        if (dispatchData) {
          const transformedDispatch = dispatchData.map((row) => ({
            id: row.id,
            timestamp: formatDate(row["Timestamp"]),
            dSrNumber: row["D-Sr Number"] || "",
            deliveryOrderNo: row["Delivery Order No."] || "",
            partyName: row["Party Name"] || "",
            productName: row["Product Name"] || "",
            qtyToBeDispatched: row["Qty To Be Dispatched"] || 0,
            typeOfTransporting: row["Type Of Transporting"] || "",
            dateOfDispatch: formatDate(row["Date Of Dispatch"]),
            toBeReconfirm: row["To Be Reconfirm"] || "",
          }));
          setDispatchHistory(transformedDispatch);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error loading data",
        description: "Failed to fetch data: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      if (
        typeof dateString === "string" &&
        dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)
      ) {
        return dateString.split(" ")[0];
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  // Filter orders: Show only if Planned 4 is set and Actual 4 is NOT set
  const getPendingOrders = () => {
    return orders.filter(
      (order) =>
        order.planned4 &&
        order.planned4.trim() !== "" &&
        (!order.actual4 || order.actual4.trim() === ""),
    );
  };

  // History orders: Show entries from DISPATCH table
  const getHistoryOrders = () => {
    // If master, show all. If not, filtered by checking if deliveryOrderNo exists in user's accessible orders
    if (user.role === "master") {
      return dispatchHistory;
    }

    // Create a set of accessible DO numbers for faster lookup
    const userDOs = new Set(orders.map((o) => o.deliveryOrderNo));

    return dispatchHistory.filter(
      (d) => d.deliveryOrderNo && userDOs.has(d.deliveryOrderNo),
    );
  };

  const pendingOrders = getPendingOrders();
  const historyOrders = getHistoryOrders();

  // Group pending orders by PO Number
  const groupedPendingOrders = useMemo(() => {
    const groups = {};
    pendingOrders.forEach((order) => {
      const poKey = order.partyPONumber || "No PO Number";
      if (!groups[poKey]) {
        groups[poKey] = {
          poNumber: poKey,
          partyName: order.partyName,
          firmName: order.firmName,
          items: [],
        };
      }
      groups[poKey].items.push(order);
    });
    return Object.values(groups);
  }, [pendingOrders]);

  // Calculate counts for summary cards
  const completedOrdersCount = orders.filter(
    (o) =>
      o.planned4 &&
      o.planned4.trim() !== "" &&
      o.actual4 &&
      o.actual4.trim() !== "",
  ).length;

  const totalOrdersCount = pendingOrders.length + completedOrdersCount;

  // Filter groups or history items based on search
  const filteredGroupedPending = useMemo(() => {
    if (!searchTerm) return groupedPendingOrders;
    const term = searchTerm.toLowerCase();
    return groupedPendingOrders
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          Object.values(item).some((val) =>
            val?.toString().toLowerCase().includes(term),
          ),
        ),
      }))
      .filter(
        (group) =>
          group.items.length > 0 ||
          group.poNumber.toLowerCase().includes(term) ||
          group.partyName.toLowerCase().includes(term),
      );
  }, [groupedPendingOrders, searchTerm]);

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return historyOrders;
    const term = searchTerm.toLowerCase();
    return historyOrders.filter((order) =>
      Object.values(order).some((val) =>
        val?.toString().toLowerCase().includes(term),
      ),
    );
  }, [historyOrders, searchTerm]);

  const togglePOExpansion = (poNumber) => {
    setExpandedPOs((prev) =>
      prev.includes(poNumber)
        ? prev.filter((p) => p !== poNumber)
        : [...prev, poNumber],
    );
  };

  useEffect(() => {
    updateCount("Dispatch Planning", pendingOrders.length);
  }, [pendingOrders, updateCount]);

  const handlePlanning = (order) => {
    setSelectedOrder(order);
    setFormData({
      qtyToBeDispatched: order.pendingQty || "0",
      typeOfTransporting: order.typeOfTransporting || "",
      dateOfDispatch: "",
      toBeReconfirm: "Yes",
    });
  };

  const generateNewDSrNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("DISPATCH")
        .select('"D-Sr Number"')
        .order("id", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching max D-Sr Number:", error);
        return "D-01"; // Fallback
      }

      if (data && data.length > 0 && data[0]["D-Sr Number"]) {
        const lastSr = data[0]["D-Sr Number"];
        const match = lastSr.match(/D-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          return `D-${String(num + 1).padStart(2, "0")}`;
        }
      }

      return "D-01";
    } catch (error) {
      console.error("Error generating D-Sr Number:", error);
      return "D-01";
    }
  };

  const handleSubmit = async () => {
    if (!selectedOrder) return;

    try {
      setSubmitting(true);

      const timestamp = getISTTimestamp();
      const dSrNumber = await generateNewDSrNumber();

      // Upload test certificate file if provided
      let testCertificateUrl = "";
      if (
        formData.testCertificateMade === "Yes" &&
        formData.testCertificateFile
      ) {
        try {
          const file = formData.testCertificateFile;
          const fileExt = file.name.split(".").pop();
          const fileName = `${dSrNumber}_test_cert_${Date.now()}.${fileExt}`;
          const filePath = `dispatch/test-certificates/${fileName}`;

          const { data: uploadData, error: uploadError } =
            await supabase.storage.from("images").upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const {
            data: { publicUrl },
          } = supabase.storage.from("images").getPublicUrl(filePath);

          testCertificateUrl = publicUrl;
        } catch (uploadError) {
          console.error("Error uploading test certificate:", uploadError);
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload test certificate file",
          });
          throw uploadError;
        }
      }

      // Calculate quantities
      const dispatchQty = parseFloat(formData.qtyToBeDispatched) || 0;
      const currentDelivered = parseFloat(selectedOrder.quantityDelivered) || 0;
      const totalQty = parseFloat(selectedOrder.quantity) || 0;

      // Ensure we don't dispatch more than pending - DISABLED at User Request
      /* if (dispatchQty > selectedOrder.pendingQty) {
        throw new Error(`Cannot dispatch more than pending quantity (${selectedOrder.pendingQty})`)
      } */

      const newDelivered = currentDelivered + dispatchQty;
      const newPending = totalQty - newDelivered;

      // 1. Insert into DISPATCH table
      const dispatchPayload = {
        Timestamp: timestamp,
        "D-Sr Number": dSrNumber,
        "Delivery Order No.": selectedOrder.deliveryOrderNo || "",
        "Party Name": selectedOrder.partyName || "",
        "Product Name": selectedOrder.productName || "",
        "Qty To Be Dispatched": dispatchQty,
        "Type Of Transporting": formData.typeOfTransporting,
        "Date Of Dispatch": formData.dateOfDispatch,
        "To Be Reconfirm": formData.toBeReconfirm,
        "Trust Certificate Made": testCertificateUrl || null,
      };

      const { error: dispatchError } = await supabase
        .from("DISPATCH")
        .insert([dispatchPayload]);

      if (dispatchError) throw dispatchError;

      // 2. Update ORDER RECEIPT table
      // Always update Delivered and Pending Qty
      const updates = {
        Delivered: newDelivered,
      };

      // Only mark as completed (Actual 4) if fully dispatched
      // Use a small epsilon to handle floating point precision issues
      if (newPending <= 0.01) {
        updates["Actual 4"] = timestamp;
        updates["Pending Qty"] = 0; // Ensure it's exactly 0 in DB
      } else {
        updates["Pending Qty"] = newPending;
      }

      const { error: orderError } = await supabase
        .from("ORDER RECEIPT")
        .update(updates)
        .eq("id", selectedOrder.id);

      if (orderError) throw orderError;

      toast({
        title: "Success",
        description: `Dispatch submitted successfully! D-Sr: ${dSrNumber}`,
      });

      // Refresh data immediately
      await fetchData();

      // Clear form and selection
      setSelectedOrder(null);
      setFormData({
        qtyToBeDispatched: "",
        typeOfTransporting: "",
        dateOfDispatch: "",
        toBeReconfirm: "Yes",
        testCertificateMade: "No",
        testCertificateFile: null,
      });
    } catch (error) {
      console.error("Error submitting dispatch:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to submit. Error: ${error.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedOrder(null);
    setFormData({
      qtyToBeDispatched: "",
      typeOfTransporting: "",
      dateOfDispatch: "",
      toBeReconfirm: "Yes",
      testCertificateMade: "No",
      testCertificateFile: null,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">
          Loading orders from Google Sheets...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dispatch Planning
          </h1>
          <p className="text-gray-600">Plan and schedule order dispatches</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-100 shadow-sm relative overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between z-10 relative">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">
                Total Orders
              </p>
              <h2 className="text-3xl font-bold text-gray-900">
                {totalOrdersCount}
              </h2>
            </div>
            <div className="p-3 bg-blue-500 rounded-full text-white shadow-md">
              <FileText className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-100 shadow-sm relative overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between z-10 relative">
            <div>
              <p className="text-sm font-medium text-orange-600 mb-1">
                Pending Check
              </p>
              <h2 className="text-3xl font-bold text-gray-900">
                {pendingOrders.length}
              </h2>
            </div>
            <div className="p-3 bg-orange-500 rounded-full text-white shadow-md">
              <Loader2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm relative overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between z-10 relative">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">
                Completed Check
              </p>
              <h2 className="text-3xl font-bold text-gray-900">
                {completedOrdersCount}
              </h2>
            </div>
            <div className="p-3 bg-green-500 rounded-full text-white shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full"
              />
            </div>
          </div>

          <Button
            onClick={() => fetchData()}
            variant="outline"
            className="h-10 px-3"
            disabled={loading || submitting}
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4 flex bg-gray-100 p-1 rounded-md w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${
              activeTab === "pending"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Pending ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1.5 px-4 text-sm font-medium rounded-sm transition-all text-center ${
              activeTab === "history"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            History ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="mt-4">
        {(activeTab === "pending" && filteredGroupedPending.length === 0) ||
        (activeTab === "history" && filteredHistory.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <div className="bg-gray-50 p-4 rounded-full mb-3">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No{" "}
              {activeTab === "pending" ? "pending orders" : "dispatch history"}{" "}
              found
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              {activeTab === "pending"
                ? "All orders have been dispatched or no plan exists."
                : "No dispatch records available yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="lg:hidden space-y-4">
              {activeTab === "pending"
                ? filteredGroupedPending.map((group) => {
                    const isExpanded = expandedPOs.includes(group.poNumber);
                    return (
                      <div
                        key={group.poNumber}
                        className="space-y-3 bg-white rounded-lg border shadow-sm overflow-hidden"
                      >
                        <div
                          className="bg-blue-50 px-3 py-3 border-b border-blue-100 flex justify-between items-center cursor-pointer"
                          onClick={() => togglePOExpansion(group.poNumber)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-white p-1 rounded-full border shadow-sm">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <span className="text-[9px] text-blue-600 font-bold uppercase tracking-tighter">
                                PO: {group.poNumber}
                              </span>
                              <p className="text-sm font-bold text-gray-900 leading-tight">
                                {group.partyName}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-white h-5"
                          >
                            {group.firmName}
                          </Badge>
                        </div>

                        {isExpanded &&
                          group.items.map((order) => (
                            <div
                              key={order.id}
                              className="p-4 pt-1 space-y-3 border-b last:border-b-0"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-semibold text-gray-900 truncate max-w-[200px]">
                                    {order.productName}
                                  </h3>
                                  <p className="text-xs text-gray-500">
                                    DO: {order.deliveryOrderNo}
                                  </p>
                                </div>
                                <Badge
                                  className={`rounded-sm text-[10px] px-1.5 h-5 ${order.status.toLowerCase() === "pending" ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-green-100 text-green-800 border-green-200"}`}
                                >
                                  {order.status}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-xs border-t border-b border-gray-100 py-3">
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-gray-400 uppercase">
                                    Pending Qty
                                  </span>
                                  <span className="font-bold text-orange-600 text-sm">
                                    {order.pendingQty}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-gray-400 uppercase">
                                    Transport
                                  </span>
                                  <span className="font-medium text-gray-900 truncate">
                                    {order.typeOfTransporting || "N/A"}
                                  </span>
                                </div>
                              </div>

                              <Button
                                onClick={() => handlePlanning(order)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 shadow-sm"
                                size="sm"
                                disabled={submitting}
                              >
                                <Truck className="w-3.5 h-3.5 mr-2" />
                                Dispatch
                              </Button>
                            </div>
                          ))}
                      </div>
                    );
                  })
                : filteredHistory.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {order.partyName}
                          </h3>
                          <p className="text-xs text-gray-500">
                            DO: {order.deliveryOrderNo}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="font-mono bg-purple-50 text-purple-700 border-purple-200"
                        >
                          {order.dSrNumber}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm border-t border-b border-gray-100 py-3">
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Product</p>
                          <p className="font-medium text-gray-900 truncate">
                            {order.productName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">
                            Qty Dispatched
                          </p>
                          <p className="font-bold text-gray-900">
                            {order.qtyToBeDispatched}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Dispatch Date</p>
                          <p className="font-medium text-gray-900">
                            {order.dateOfDispatch
                              ? order.dateOfDispatch.split(" ")[0]
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>

            {/* Desktop View - Table/Modules */}
            <div className="hidden lg:block">
              {activeTab === "history" ? (
                <div className="bg-white rounded-md border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>D-Sr No</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Party Name</TableHead>
                          <TableHead>DO No.</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Transport</TableHead>
                          <TableHead>Dispatch Date</TableHead>
                          <TableHead>Reconfirm</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.map((order) => (
                          <TableRow key={order.id} className="hover:bg-gray-50">
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="font-mono bg-purple-50 text-purple-700 border-purple-200"
                              >
                                {order.dSrNumber}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-600 text-sm">
                              {order.timestamp
                                ? order.timestamp.split(" ")[0]
                                : "N/A"}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900">
                              {order.partyName}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-600">
                              {order.deliveryOrderNo}
                            </TableCell>
                            <TableCell
                              className="text-gray-600 max-w-[200px] truncate"
                              title={order.productName}
                            >
                              {order.productName}
                            </TableCell>
                            <TableCell className="font-bold text-gray-900">
                              {order.qtyToBeDispatched}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {order.typeOfTransporting}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {order.dateOfDispatch
                                ? order.dateOfDispatch.split(" ")[0]
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  order.toBeReconfirm === "Yes"
                                    ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
                                    : "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"
                                }
                              >
                                {order.toBeReconfirm}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredGroupedPending.map((group) => {
                    const isExpanded = expandedPOs.includes(group.poNumber);
                    return (
                      <Card
                        key={group.poNumber}
                        className={`border-l-4 border-l-blue-600 overflow-hidden transition-all duration-200 ${isExpanded ? "shadow-md" : "hover:shadow-sm"}`}
                      >
                        <div
                          className="bg-gray-50/80 py-4 px-4 flex flex-row items-center justify-between cursor-pointer hover:bg-gray-100/80 transition-colors"
                          onClick={() => togglePOExpansion(group.poNumber)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="bg-white p-1 rounded-full border shadow-sm">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  PO Number
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-mono bg-blue-100 text-blue-800 border-blue-200 uppercase"
                                >
                                  {group.poNumber}
                                </Badge>
                              </div>
                              <h4 className="font-bold text-gray-900 text-lg">
                                {group.partyName}
                              </h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right hidden sm:block">
                              <span className="text-[10px] font-bold text-gray-400 uppercase block leading-none mb-1">
                                Items
                              </span>
                              <span className="font-bold text-gray-900">
                                {group.items.length}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className="bg-white border-blue-200 text-blue-700 font-semibold px-3 py-1"
                            >
                              {group.firmName}
                            </Badge>
                          </div>
                        </div>
                        {isExpanded && (
                          <CardContent className="p-0 border-t bg-white">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50/30 border-b hover:bg-transparent">
                                    <TableHead className="w-[100px] pl-4 font-bold text-xs">
                                      Action
                                    </TableHead>
                                    <TableHead className="font-bold text-xs">
                                      DO No.
                                    </TableHead>
                                    <TableHead className="font-bold text-xs">
                                      Product Details
                                    </TableHead>
                                    <TableHead className="font-bold text-xs">
                                      Qty Info
                                    </TableHead>
                                    <TableHead className="font-bold text-xs">
                                      Transport
                                    </TableHead>
                                    <TableHead className="font-bold text-xs">
                                      Status
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map((item) => (
                                    <TableRow
                                      key={item.id}
                                      className="hover:bg-blue-50/30 transition-colors border-b last:border-0"
                                    >
                                      <TableCell className="pl-4 py-4">
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePlanning(item);
                                          }}
                                          className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs px-4 shadow-sm font-semibold rounded-md"
                                          size="sm"
                                          disabled={submitting}
                                        >
                                          <Truck className="w-3.5 h-3.5 mr-2" />
                                          Dispatch
                                        </Button>
                                      </TableCell>
                                      <TableCell className="font-mono text-[11px] text-gray-500 font-medium">
                                        {item.deliveryOrderNo}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-col">
                                          <span
                                            className="text-sm font-bold text-gray-900 truncate max-w-[200px]"
                                            title={item.productName}
                                          >
                                            {item.productName}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-4 text-xs font-medium">
                                          <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400 uppercase">
                                              Total
                                            </span>
                                            <span>{item.quantity}</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[9px] text-green-500 uppercase">
                                              Sent
                                            </span>
                                            <span className="text-green-600">
                                              {item.quantityDelivered}
                                            </span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[9px] text-orange-500 uppercase">
                                              Left
                                            </span>
                                            <span className="text-orange-600 font-bold">
                                              {item.pendingQty}
                                            </span>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-gray-500 text-xs italic font-medium">
                                        {item.typeOfTransporting ||
                                          "Not Specified"}
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase font-black tracking-wider ${item.status.toLowerCase() === "pending" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}`}
                                        >
                                          {item.status}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dispatch Form Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:p-0">
          <Card className="w-full max-w-2xl lg:max-w-3xl max-h-screen lg:max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <CardTitle className="text-lg lg:text-xl">
                Dispatch Planning
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={submitting}
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <div className="space-y-6">
                {/* Order Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Order Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-gray-500">
                        Party Name
                      </Label>
                      <p className="font-medium">{selectedOrder.partyName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">
                        Delivery Order No.
                      </Label>
                      <p className="font-medium">
                        {selectedOrder.deliveryOrderNo || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">
                        Product Name
                      </Label>
                      <p className="font-medium">{selectedOrder.productName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">
                        Order Quantity
                      </Label>
                      <p className="font-medium">{selectedOrder.quantity}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">
                        Already Delivered
                      </Label>
                      <p className="font-medium text-green-600">
                        {selectedOrder.quantityDelivered}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">
                        Pending Quantity
                      </Label>
                      <p className="font-medium text-orange-600">
                        {selectedOrder.pendingQty}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-3">
                    Dispatch Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Quantity to Dispatch *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.qtyToBeDispatched}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            qtyToBeDispatched: e.target.value,
                          }))
                        }
                        className="h-10"
                        placeholder="Enter quantity"
                        disabled={submitting}
                        min="0"
                      />
                      <p className="text-xs text-gray-500">
                        Max: {selectedOrder.pendingQty} units available
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Transport Type *</Label>
                      <Select
                        value={formData.typeOfTransporting}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            typeOfTransporting: value,
                          }))
                        }
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="For">For</SelectItem>
                          <SelectItem value="Ex Factory">Ex Factory</SelectItem>
                          <SelectItem value="Ex Factory But Paid By US">
                            Ex Factory But Paid By US
                          </SelectItem>
                          <SelectItem value="direct Suply">
                            direct Suply
                          </SelectItem>
                          <SelectItem value="Owned Truck">
                            Owned Truck
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Dispatch Date *</Label>
                      <Input
                        type="date"
                        value={formData.dateOfDispatch}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            dateOfDispatch: e.target.value,
                          }))
                        }
                        className="h-10"
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Reconfirm *</Label>
                      <Select
                        value={formData.toBeReconfirm}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            toBeReconfirm: value,
                          }))
                        }
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Test Certificate Made */}
                    <div className="space-y-2">
                      <Label className="text-sm">Test Certificate Made *</Label>
                      <Select
                        value={formData.testCertificateMade}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            testCertificateMade: value,
                            testCertificateFile:
                              value === "No" ? null : prev.testCertificateFile,
                          }))
                        }
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Test Certificate File Upload - Only show if Yes */}
                    {formData.testCertificateMade === "Yes" && (
                      <div className="space-y-2 col-span-2">
                        <Label className="text-sm">
                          Upload Test Certificate *
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                if (file.size > 5 * 1024 * 1024) {
                                  toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description:
                                      "File size should be less than 5MB",
                                  });
                                  e.target.value = "";
                                  return;
                                }
                                setFormData((prev) => ({
                                  ...prev,
                                  testCertificateFile: file,
                                }));
                              }
                            }}
                            className="h-10"
                            disabled={submitting}
                          />
                          {formData.testCertificateFile && (
                            <span className="text-sm text-green-600 truncate flex-shrink-0">
                              ✓ Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Accepts image or PDF files (max 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="w-full sm:w-auto"
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      disabled={
                        !formData.qtyToBeDispatched ||
                        parseFloat(formData.qtyToBeDispatched) <= 0 ||
                        !formData.typeOfTransporting ||
                        !formData.dateOfDispatch ||
                        !formData.toBeReconfirm ||
                        !formData.testCertificateMade ||
                        (formData.testCertificateMade === "Yes" &&
                          !formData.testCertificateFile) ||
                        submitting
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        `Submit Dispatch`
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
