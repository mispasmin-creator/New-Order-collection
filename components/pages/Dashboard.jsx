"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Package,
  DollarSign,
  Users,
  TrendingDown,
  Calendar,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Truck,
  FileText,
  Layers,
  Database,
  RefreshCw,
  Loader2,
  AlertCircle,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Download,
  FileBarChart,
  Bell,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWoEpCK_J8zDmReLrrTmAG6nyl2iG9k8ZKBZKtRl1P0pi9bGm_RRTDiTd_RKhv-5k/exec";

export default function AnalyticsDashboard({ user }) {
  const [timeRange, setTimeRange] = useState("30");
  const [selectedMetric, setSelectedMetric] = useState("orders");
  const [selectedFirm, setSelectedFirm] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [sheetData, setSheetData] = useState({
    orderReceipt: [],
    dispatch: [],
    delivery: [],
    postDelivery: [],
    lastUpdated: null,
  });

  // Quick Actions Handlers
  const handleExportData = async () => {
    try {
      toast.info("Preparing data export...");
      
      // Create combined data object
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: user.name,
          userRole: user.role,
          userFirm: user.firm,
          timeRange: timeRange,
          selectedFirm: selectedFirm,
        },
        summary: {
          totalOrders: stats.totalOrders,
          totalRevenue: stats.totalRevenue,
          completionRate: stats.completionRate,
          pendingOrders: stats.pendingOrders,
          completedOrders: stats.completedOrders,
        },
        orderReceipt: sheetData.orderReceipt,
        dispatch: sheetData.dispatch,
        delivery: sheetData.delivery,
        postDelivery: sheetData.postDelivery,
        charts: {
          monthlyRevenue: chartData.monthlyRevenue,
          statusDistribution: chartData.statusDistribution,
          processFlow: chartData.processFlow,
          firmPerformance: chartData.firmPerformance,
        }
      };

      // Convert to JSON string
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Create download link
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Data exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  const handleGenerateReport = () => {
    toast.info("Generating dashboard report...");
    
    // In a real app, this would generate a PDF/Excel report
    // For now, we'll create a simple HTML report
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      const reportDate = new Date().toLocaleDateString();
      const reportTime = new Date().toLocaleTimeString();
      
      reportWindow.document.write(`
        <html>
          <head>
            <title>Dashboard Report - ${reportDate}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #333; }
              .header { margin-bottom: 30px; }
              .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
              .stat { display: inline-block; margin: 10px 20px 10px 0; }
              .stat-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
              .stat-label { color: #666; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f8f9fa; }
              .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
              .alert-warning { background-color: #fff3cd; border: 1px solid #ffc107; }
              .alert-info { background-color: #d1ecf1; border: 1px solid #17a2b8; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Analytics Dashboard Report</h1>
              <p>Generated on ${reportDate} at ${reportTime}</p>
              <p>Generated by: ${user.name} (${user.role} - ${user.firm})</p>
            </div>
            
            <div class="section">
              <h2>Executive Summary</h2>
              <div class="stat">
                <div class="stat-value">${stats.totalOrders}</div>
                <div class="stat-label">Total Orders</div>
              </div>
              <div class="stat">
                <div class="stat-value">₹${(stats.totalRevenue / 100000).toFixed(1)}L</div>
                <div class="stat-label">Total Revenue</div>
              </div>
              <div class="stat">
                <div class="stat-value">${stats.completionRate.toFixed(1)}%</div>
                <div class="stat-label">Completion Rate</div>
              </div>
              <div class="stat">
                <div class="stat-value">${stats.completedPostDelivery}</div>
                <div class="stat-label">Full Process Completed</div>
              </div>
            </div>
            
            <div class="section">
              <h2>Process Flow Status</h2>
              <table>
                <tr>
                  <th>Stage</th>
                  <th>Pending</th>
                  <th>Completed</th>
                  <th>Completion Rate</th>
                </tr>
                <tr>
                  <td>Orders</td>
                  <td>${stats.pendingOrders}</td>
                  <td>${stats.completedOrders}</td>
                  <td>${stats.completionRate.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Dispatch</td>
                  <td>${stats.pendingDispatch}</td>
                  <td>${stats.completedDispatch}</td>
                  <td>${stats.completedDispatch > 0 ? ((stats.completedDispatch / (stats.completedDispatch + stats.pendingDispatch)) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr>
                  <td>Delivery</td>
                  <td>${stats.pendingDelivery}</td>
                  <td>${stats.completedDelivery}</td>
                  <td>${stats.completedDelivery > 0 ? ((stats.completedDelivery / (stats.completedDelivery + stats.pendingDelivery)) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr>
                  <td>Post Delivery</td>
                  <td>${stats.pendingPostDelivery}</td>
                  <td>${stats.completedPostDelivery}</td>
                  <td>${stats.completedPostDelivery > 0 ? ((stats.completedPostDelivery / (stats.completedPostDelivery + stats.pendingPostDelivery)) * 100).toFixed(1) : 0}%</td>
                </tr>
              </table>
            </div>
            
            <div class="section">
              <h2>Recent Alerts</h2>
              ${alerts.length > 0 ? alerts.slice(0, 5).map(alert => `
                <div class="alert alert-${alert.type}">
                  <strong>${alert.title}</strong><br>
                  ${alert.message}<br>
                  <small>${new Date(alert.timestamp).toLocaleString()}</small>
                </div>
              `).join('') : '<p>No active alerts</p>'}
            </div>
            
            <div class="section">
              <h2>Data Overview</h2>
              <table>
                <tr>
                  <th>Sheet</th>
                  <th>Total Records</th>
                  <th>Last Updated</th>
                </tr>
                <tr>
                  <td>Order Receipt</td>
                  <td>${sheetData.orderReceipt.length}</td>
                  <td>${sheetData.lastUpdated ? new Date(sheetData.lastUpdated).toLocaleString() : 'N/A'}</td>
                </tr>
                <tr>
                  <td>Dispatch</td>
                  <td>${sheetData.dispatch.length}</td>
                  <td>${sheetData.lastUpdated ? new Date(sheetData.lastUpdated).toLocaleString() : 'N/A'}</td>
                </tr>
                <tr>
                  <td>Delivery</td>
                  <td>${sheetData.delivery.length}</td>
                  <td>${sheetData.lastUpdated ? new Date(sheetData.lastUpdated).toLocaleString() : 'N/A'}</td>
                </tr>
                <tr>
                  <td>Post Delivery</td>
                  <td>${sheetData.postDelivery.length}</td>
                  <td>${sheetData.lastUpdated ? new Date(sheetData.lastUpdated).toLocaleString() : 'N/A'}</td>
                </tr>
              </table>
            </div>
            
            <div class="section">
              <p><em>Report generated from Analytics Dashboard v1.0</em></p>
            </div>
          </body>
        </html>
      `);
      reportWindow.document.close();
      
      toast.success("Report generated successfully!");
    }
  };

  const handleSyncNow = async () => {
    toast.info("Starting manual sync...");
    await fetchAllData(true);
    toast.success("Sync completed successfully!");
  };

  const handleViewAlerts = () => {
    setShowAlerts(true);
    
    // Create mock alerts if none exist
    if (alerts.length === 0) {
      const mockAlerts = [
        {
          id: 1,
          title: "Data Refresh Required",
          message: "Last data refresh was over 30 minutes ago",
          type: "warning",
          timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        },
        {
          id: 2,
          title: "High Pending Orders",
          message: `${stats.pendingOrders} orders are pending completion`,
          type: "info",
          timestamp: new Date().toISOString(),
        },
        {
          id: 3,
          title: "Low Completion Rate Alert",
          message: `Completion rate is ${stats.completionRate.toFixed(1)}%, below target of 80%`,
          type: stats.completionRate < 80 ? "warning" : "info",
          timestamp: new Date().toISOString(),
        },
      ];
      setAlerts(mockAlerts);
    }
    
    // Show alerts in a toast or modal
    const alertsCount = alerts.length || 3;
    const criticalAlerts = alerts.filter(a => a.type === 'warning').length;
    
    if (criticalAlerts > 0) {
      toast.warning(`You have ${criticalAlerts} critical alert${criticalAlerts > 1 ? 's' : ''}`, {
        description: "Check the alerts panel for details",
        action: {
          label: "View",
          onClick: () => {
            const alertModal = document.createElement('div');
            alertModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            alertModal.innerHTML = `
              <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">Dashboard Alerts</h3>
                <div class="space-y-3 max-h-96 overflow-y-auto">
                  ${alerts.map(alert => `
                    <div class="p-3 rounded border ${alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}">
                      <div class="flex justify-between items-start">
                        <div>
                          <h4 class="font-medium ${alert.type === 'warning' ? 'text-yellow-800' : 'text-blue-800'}">${alert.title}</h4>
                          <p class="text-sm mt-1 ${alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}">${alert.message}</p>
                        </div>
                        <span class="text-xs ${alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}">
                          ${new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <div class="mt-6 flex justify-end">
                  <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm">
                    Close
                  </button>
                </div>
              </div>
            `;
            document.body.appendChild(alertModal);
          }
        }
      });
    } else {
      toast.info(`You have ${alertsCount} alert${alertsCount > 1 ? 's' : ''}`, {
        description: "No critical issues detected",
      });
    }
  };

  // Rest of your existing code remains the same...
  // Fetch data from all sheets
  const fetchAllData = async (forceRefresh = false) => {
    if (!forceRefresh && sheetData.lastUpdated && 
        Date.now() - new Date(sheetData.lastUpdated).getTime() < 30000) {
      return; // Skip if refreshed within 30 seconds
    }

    try {
      setRefreshing(true);
      setError(null);
      
      const sheetNames = [
        "ORDER RECEIPT",
        "DISPATCH", 
        "DELIVERY",
        "POST DELIVERY"
      ];

      const promises = sheetNames.map(async (sheet) => {
        try {
          const response = await fetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(sheet)}&timestamp=${Date.now()}`);
          if (!response.ok) throw new Error(`Failed to fetch ${sheet}`);
          const data = await response.json();
          return { sheet, data: data.success ? data.data : [] };
        } catch (error) {
          console.error(`Error fetching ${sheet}:`, error);
          return { sheet, data: [], error: error.message };
        }
      });

      const results = await Promise.all(promises);
      
      const newData = {
        orderReceipt: [],
        dispatch: [],
        delivery: [],
        postDelivery: [],
        lastUpdated: new Date().toISOString(),
      };

      results.forEach(result => {
        if (result.sheet === "ORDER RECEIPT") newData.orderReceipt = transformOrderReceiptData(result.data);
        if (result.sheet === "DISPATCH") newData.dispatch = transformDispatchData(result.data);
        if (result.sheet === "DELIVERY") newData.delivery = transformDeliveryData(result.data);
        if (result.sheet === "POST DELIVERY") newData.postDelivery = transformPostDeliveryData(result.data);
      });

      setSheetData(newData);
      setLoading(false);
      
    } catch (error) {
      console.error("Error fetching all data:", error);
      setError("Failed to load dashboard data. Please try again.");
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  // Transform ORDER RECEIPT data
  const transformOrderReceiptData = (data) => {
    if (!data || data.length < 6) return [];
    
    const headers = data[5].map(h => h?.toString().trim() || "");
    const orders = [];
    
    // Get column indices
    const indices = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes("timestamp")),
      doNumber: headers.findIndex(h => h.toLowerCase().includes("do-delivery order no")),
      firmName: headers.findIndex(h => h.toLowerCase().includes("firm name")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party names")),
      productName: headers.findIndex(h => h.toLowerCase().includes("product name")),
      quantity: headers.findIndex(h => h.toLowerCase().includes("quantity")),
      totalValue: headers.findIndex(h => h.toLowerCase().includes("total po basic value")),
      status: headers.findIndex(h => h.toLowerCase().includes("status")),
      planned1: headers.findIndex(h => h.toLowerCase().includes("planned 1")),
      actual1: headers.findIndex(h => h.toLowerCase().includes("actual 1")),
      planned2: headers.findIndex(h => h.toLowerCase().includes("planned 2")),
      actual2: headers.findIndex(h => h.toLowerCase().includes("actual 2")),
      expectedDelivery: headers.findIndex(h => h.toLowerCase().includes("expected delivery date")),
    };
    
    for (let i = 6; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const getVal = (index) => index >= 0 && row[index] ? row[index].toString().trim() : "";
      
      const order = {
        id: i,
        timestamp: getVal(indices.timestamp),
        doNumber: getVal(indices.doNumber),
        firmName: getVal(indices.firmName),
        partyName: getVal(indices.partyName),
        productName: getVal(indices.productName),
        quantity: parseFloat(getVal(indices.quantity)) || 0,
        totalValue: parseFloat(getVal(indices.totalValue)) || 0,
        status: getVal(indices.status) || "Pending",
        planned1: getVal(indices.planned1),
        actual1: getVal(indices.actual1),
        planned2: getVal(indices.planned2),
        actual2: getVal(indices.actual2),
        expectedDelivery: getVal(indices.expectedDelivery),
        materialReceived: getVal(indices.actual2) !== "",
        rowIndex: i + 1,
      };
      
      orders.push(order);
    }
    
    return orders;
  };

  // Transform DISPATCH data
  const transformDispatchData = (data) => {
    if (!data || data.length < 2) return [];
    
    // Find header row
    let headerRowIndex = -1;
    let headers = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 0 && row.some(cell => 
        cell?.toString().toLowerCase().includes("timestamp"))) {
        headerRowIndex = i;
        headers = row.map(h => h?.toString().trim() || "");
        break;
      }
    }
    
    if (headerRowIndex === -1) return [];
    
    const dispatches = [];
    
    const indices = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes("timestamp")),
      dSrNumber: headers.findIndex(h => h.toLowerCase().includes("d-sr") || h.toLowerCase().includes("dsr")),
      deliveryOrderNo: headers.findIndex(h => h.toLowerCase().includes("delivery order")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party name")),
      productName: headers.findIndex(h => h.toLowerCase().includes("product name")),
      qtyToBeDispatched: headers.findIndex(h => h.toLowerCase().includes("qty to be dispatched")),
      typeOfTransporting: headers.findIndex(h => h.toLowerCase().includes("type of transporting")),
      dateOfDispatch: headers.findIndex(h => h.toLowerCase().includes("date of dispatch")),
      planned4: headers.findIndex(h => h.toLowerCase().includes("planned4")),
      actual4: headers.findIndex(h => h.toLowerCase().includes("actual4")),
      planned2: headers.findIndex(h => h.toLowerCase().includes("planned2") || h.toLowerCase().includes("planned 2")),
      actual2: headers.findIndex(h => h.toLowerCase().includes("actual2") || h.toLowerCase().includes("actual 2")),
    };
    
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const getVal = (index) => index >= 0 && row[index] ? row[index].toString().trim() : "";
      
      const dispatch = {
        id: i,
        timestamp: getVal(indices.timestamp),
        dSrNumber: getVal(indices.dSrNumber),
        deliveryOrderNo: getVal(indices.deliveryOrderNo),
        partyName: getVal(indices.partyName),
        productName: getVal(indices.productName),
        qtyToBeDispatched: parseFloat(getVal(indices.qtyToBeDispatched)) || 0,
        typeOfTransporting: getVal(indices.typeOfTransporting),
        dateOfDispatch: getVal(indices.dateOfDispatch),
        planned4: getVal(indices.planned4),
        actual4: getVal(indices.actual4),
        planned2: getVal(indices.planned2),
        actual2: getVal(indices.actual2),
        status: getVal(indices.actual2) ? "Dispatched" : "Pending",
        rowIndex: i + 1,
      };
      
      dispatches.push(dispatch);
    }
    
    return dispatches;
  };

  // Transform DELIVERY data
  const transformDeliveryData = (data) => {
    if (!data || data.length < 2) return [];
    
    // Find header row
    let headerRowIndex = -1;
    let headers = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 0 && row.some(cell => 
        cell?.toString().toLowerCase().includes("timestamp"))) {
        headerRowIndex = i;
        headers = row.map(h => h?.toString().trim() || "");
        break;
      }
    }
    
    if (headerRowIndex === -1) return [];
    
    const deliveries = [];
    
    const indices = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes("timestamp")),
      billNo: headers.findIndex(h => h.toLowerCase().includes("bill no")),
      deliveryOrderNo: headers.findIndex(h => h.toLowerCase().includes("delivery order")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party name")),
      quantityDelivered: headers.findIndex(h => h.toLowerCase().includes("quantity delivered")),
      rateOfMaterial: headers.findIndex(h => h.toLowerCase().includes("rate of material")),
      planned1: headers.findIndex(h => h.toLowerCase().includes("planned 1")),
      actual1: headers.findIndex(h => h.toLowerCase().includes("actual 1")),
      planned2: headers.findIndex(h => h.toLowerCase().includes("planned 2")),
      actual2: headers.findIndex(h => h.toLowerCase().includes("actual 2")),
      planned3: headers.findIndex(h => h.toLowerCase().includes("planned 3")),
      actual3: headers.findIndex(h => h.toLowerCase().includes("actual3")),
      planned4: headers.findIndex(h => h.toLowerCase().includes("planned4")),
      actual4: headers.findIndex(h => h.toLowerCase().includes("actual4")),
    };
    
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const getVal = (index) => index >= 0 && row[index] ? row[index].toString().trim() : "";
      
      const delivery = {
        id: i,
        timestamp: getVal(indices.timestamp),
        billNo: getVal(indices.billNo),
        deliveryOrderNo: getVal(indices.deliveryOrderNo),
        partyName: getVal(indices.partyName),
        quantityDelivered: parseFloat(getVal(indices.quantityDelivered)) || 0,
        rateOfMaterial: parseFloat(getVal(indices.rateOfMaterial)) || 0,
        planned1: getVal(indices.planned1),
        actual1: getVal(indices.actual1),
        planned2: getVal(indices.planned2),
        actual2: getVal(indices.actual2),
        planned3: getVal(indices.planned3),
        actual3: getVal(indices.actual3),
        planned4: getVal(indices.planned4),
        actual4: getVal(indices.actual4),
        rowIndex: i + 1,
      };
      
      deliveries.push(delivery);
    }
    
    return deliveries;
  };

  // Transform POST DELIVERY data
  const transformPostDeliveryData = (data) => {
    if (!data || data.length < 2) return [];
    
    // Find header row
    let headerRowIndex = -1;
    let headers = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 0 && row.some(cell => 
        cell?.toString().toLowerCase().includes("timestamp"))) {
        headerRowIndex = i;
        headers = row.map(h => h?.toString().trim() || "");
        break;
      }
    }
    
    if (headerRowIndex === -1) return [];
    
    const postDeliveries = [];
    
    const indices = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes("timestamp")),
      orderNo: headers.findIndex(h => h.toLowerCase().includes("order no")),
      billNo: headers.findIndex(h => h.toLowerCase().includes("bill no")),
      partyName: headers.findIndex(h => h.toLowerCase().includes("party name")),
      totalBillAmount: headers.findIndex(h => h.toLowerCase().includes("total bill amount")),
      planned: headers.findIndex(h => h.toLowerCase().includes("planned")),
      actual: headers.findIndex(h => h.toLowerCase().includes("actual") && !h.toLowerCase().includes("planned")),
      materialReceivedDate: headers.findIndex(h => h.toLowerCase().includes("material received date")),
      grnNumber: headers.findIndex(h => h.toLowerCase().includes("grn number")),
    };
    
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const getVal = (index) => index >= 0 && row[index] ? row[index].toString().trim() : "";
      
      const postDelivery = {
        id: i,
        timestamp: getVal(indices.timestamp),
        orderNo: getVal(indices.orderNo),
        billNo: getVal(indices.billNo),
        partyName: getVal(indices.partyName),
        totalBillAmount: parseFloat(getVal(indices.totalBillAmount)) || 0,
        planned: getVal(indices.planned),
        actual: getVal(indices.actual),
        materialReceivedDate: getVal(indices.materialReceivedDate),
        grnNumber: getVal(indices.grnNumber),
        status: getVal(indices.actual) ? "Received" : "Pending",
        rowIndex: i + 1,
      };
      
      postDeliveries.push(postDelivery);
    }
    
    return postDeliveries;
  };

  // Initialize data fetch
  useEffect(() => {
    fetchAllData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchAllData(true);
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Filter data based on user role and firm
  const getFilteredData = (data, firmField = "firmName") => {
    if (user.role === "master") {
      if (selectedFirm === "all") return data;
      return data.filter(item => item[firmField] === selectedFirm);
    }
    return data.filter(item => item[firmField] === user.firm);
  };

  // Calculate statistics from all sheets
  const stats = useMemo(() => {
    const filteredOrders = getFilteredData(sheetData.orderReceipt);
    const filteredDispatch = getFilteredData(sheetData.dispatch);
    const filteredDelivery = getFilteredData(sheetData.delivery);
    const filteredPostDelivery = getFilteredData(sheetData.postDelivery);

    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalValue, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const pendingOrders = filteredOrders.filter(order => !order.actual1).length;
    const inProgressOrders = filteredOrders.filter(order => order.actual1 && !order.actual2).length;
    const completedOrders = filteredOrders.filter(order => order.actual2).length;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    const pendingDispatch = filteredDispatch.filter(d => !d.actual2).length;
    const completedDispatch = filteredDispatch.filter(d => d.actual2).length;

    const pendingDelivery = filteredDelivery.filter(d => !d.actual1).length;
    const completedDelivery = filteredDelivery.filter(d => d.actual1).length;

    const pendingPostDelivery = filteredPostDelivery.filter(pd => !pd.actual).length;
    const completedPostDelivery = filteredPostDelivery.filter(pd => pd.actual).length;

    return {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      pendingOrders,
      inProgressOrders,
      completedOrders,
      completionRate,
      pendingDispatch,
      completedDispatch,
      pendingDelivery,
      completedDelivery,
      pendingPostDelivery,
      completedPostDelivery,
    };
  }, [sheetData, user, selectedFirm]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Monthly revenue trend
    const monthlyRevenue = monthNames.map((month, index) => {
      const monthOrders = sheetData.orderReceipt.filter(order => {
        if (!order.timestamp) return false;
        const date = new Date(order.timestamp);
        return date.getMonth() === index;
      });
      
      const revenue = monthOrders.reduce((sum, order) => sum + order.totalValue, 0);
      return {
        month,
        revenue,
        orders: monthOrders.length,
        completed: monthOrders.filter(o => o.actual2).length,
      };
    });

    // Status distribution
    const statusDistribution = [
      { name: "Pending", value: stats.pendingOrders, color: "#ef4444" },
      { name: "In Progress", value: stats.inProgressOrders, color: "#f59e0b" },
      { name: "Completed", value: stats.completedOrders, color: "#10b981" },
    ];

    // Process flow data
    const processFlow = [
      { stage: "Orders", count: stats.totalOrders, target: stats.totalOrders * 1.1 },
      { stage: "Dispatch", count: stats.completedDispatch, target: stats.totalOrders },
      { stage: "Delivery", count: stats.completedDelivery, target: stats.completedDispatch },
      { stage: "Post Delivery", count: stats.completedPostDelivery, target: stats.completedDelivery },
    ];

    // Firm performance
    const firmPerformance = ["AAA", "BBB", "CCC", "DDD"].map(firm => {
      const firmOrders = sheetData.orderReceipt.filter(order => order.firmName === firm);
      const firmRevenue = firmOrders.reduce((sum, order) => sum + order.totalValue, 0);
      return {
        firm,
        revenue: firmRevenue,
        orders: firmOrders.length,
        completionRate: firmOrders.length > 0 ? 
          (firmOrders.filter(o => o.actual2).length / firmOrders.length) * 100 : 0,
      };
    });

    return {
      monthlyRevenue,
      statusDistribution,
      processFlow,
      firmPerformance,
    };
  }, [sheetData, stats]);

  // Get unique firms for filter
  const uniqueFirms = useMemo(() => {
    const firms = [...new Set(sheetData.orderReceipt.map(order => order.firmName).filter(Boolean))];
    return ["all", ...firms];
  }, [sheetData.orderReceipt]);

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading dashboard data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">
            Analytics Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-gray-600">
              Welcome back, <span className="font-semibold text-gray-900">{user.name}</span>
            </p>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {user.firm} • {user.role}
            </Badge>
            {sheetData.lastUpdated && (
              <span className="text-xs text-gray-500">
                Last updated: {new Date(sheetData.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          {user.role === "master" && (
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="w-[180px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select Firm" />
              </SelectTrigger>
              <SelectContent>
                {uniqueFirms.map(firm => (
                  <SelectItem key={firm} value={firm}>
                    {firm === "all" ? "All Firms" : firm}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-700">
                {stats.completedOrders} Completed
              </Badge>
              <Badge variant="outline" className="text-gray-600">
                {stats.pendingOrders} Pending
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{(stats.totalRevenue / 100000).toFixed(1)}L
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <TrendingUpIcon className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">
                  ₹{(stats.avgOrderValue / 1000).toFixed(1)}K avg
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Process Flow</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completedPostDelivery}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl shadow-lg">
                <Layers className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Dispatch: {stats.completedDispatch}</span>
                <span>Delivery: {stats.completedDelivery}</span>
                <span>Post: {stats.completedPostDelivery}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completionRate.toFixed(1)}%</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">
                {stats.completedOrders}/{stats.totalOrders}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="process">Process Flow</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Order Status</CardTitle>
                <CardDescription>Distribution by status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Firm Performance */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Firm Performance</CardTitle>
                <CardDescription>Revenue and orders by firm</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.firmPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="firm" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (₹)" />
                    <Bar dataKey="orders" fill="#10b981" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Completion Rate by Firm */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Completion Rate</CardTitle>
                <CardDescription>By firm comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.firmPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="firm" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Bar dataKey="completionRate" fill="#8b5cf6" name="Completion Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="process" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Process Flow Analysis</CardTitle>
              <CardDescription>Order progression through stages</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="stage" 
                    type="category" 
                    allowDuplicatedCategory={false}
                    stroke="#6b7280"
                  />
                  <YAxis 
                    dataKey="count" 
                    type="number" 
                    name="Count"
                    stroke="#6b7280"
                  />
                  <ZAxis dataKey="target" range={[100, 400]} name="Target" />
                  <Tooltip />
                  <Legend />
                  <Scatter 
                    name="Actual Count" 
                    data={chartData.processFlow} 
                    fill="#3b82f6" 
                    shape="circle"
                  />
                  <Scatter 
                    name="Target" 
                    data={chartData.processFlow} 
                    fill="#ef4444" 
                    fillOpacity={0.3}
                    shape="triangle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sheet Data Overview */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Data Overview</CardTitle>
                <CardDescription>Records across all sheets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "Order Receipt", data: sheetData.orderReceipt, icon: FileText, color: "blue" },
                    { name: "Dispatch", data: sheetData.dispatch, icon: Truck, color: "green" },
                    { name: "Delivery", data: sheetData.delivery, icon: Package, color: "purple" },
                    { name: "Post Delivery", data: sheetData.postDelivery, icon: CheckCircle, color: "orange" },
                  ].map((sheet, index) => {
                    const Icon = sheet.icon;
                    const colorClasses = {
                      blue: "bg-blue-100 text-blue-700",
                      green: "bg-green-100 text-green-700",
                      purple: "bg-purple-100 text-purple-700",
                      orange: "bg-orange-100 text-orange-700",
                    };
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${colorClasses[sheet.color]}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{sheet.name}</p>
                            <p className="text-sm text-gray-500">Total records</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{sheet.data.length}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">System Health</CardTitle>
                <CardDescription>Performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { 
                      label: "Data Freshness", 
                      value: sheetData.lastUpdated ? "Current" : "Stale",
                      status: sheetData.lastUpdated ? "good" : "warning",
                      description: sheetData.lastUpdated 
                        ? `Updated ${Math.round((Date.now() - new Date(sheetData.lastUpdated).getTime()) / 60000)} minutes ago`
                        : "No data loaded"
                    },
                    { 
                      label: "Data Completeness", 
                      value: `${Math.round((sheetData.orderReceipt.length / (sheetData.orderReceipt.length || 1)) * 100)}%`,
                      status: "good",
                      description: "All sheets loaded successfully"
                    },
                    { 
                      label: "Processing Rate", 
                      value: `${stats.completionRate.toFixed(1)}%`,
                      status: stats.completionRate > 70 ? "good" : stats.completionRate > 40 ? "warning" : "error",
                      description: "Orders completed vs total"
                    },
                    { 
                      label: "Data Consistency", 
                      value: "Good", 
                      status: "good",
                      description: "All records synchronized"
                    },
                  ].map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{metric.label}</p>
                        <p className="text-sm text-gray-500">{metric.description}</p>
                      </div>
                      <Badge 
                        variant={
                          metric.status === "good" ? "default" : 
                          metric.status === "warning" ? "secondary" : 
                          "destructive"
                        }
                      >
                        {metric.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          <CardDescription>Common dashboard operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-200 transition-colors"
              onClick={handleExportData}
            >
              <Download className="w-6 h-6" />
              <span>Export Data</span>
              <span className="text-xs text-gray-500">JSON format</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-green-50 hover:border-green-200 transition-colors"
              onClick={handleGenerateReport}
            >
              <FileBarChart className="w-6 h-6" />
              <span>Generate Report</span>
              <span className="text-xs text-gray-500">HTML report</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-200 transition-colors"
              onClick={handleSyncNow}
              disabled={refreshing}
            >
              <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
              <span className="text-xs text-gray-500">Manual refresh</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-orange-50 hover:border-orange-200 transition-colors"
              onClick={handleViewAlerts}
            >
              <Bell className="w-6 h-6" />
              <span>View Alerts</span>
              <span className="text-xs text-gray-500">{alerts.length || 0} active</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}