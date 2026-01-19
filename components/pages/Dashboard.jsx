"use client";

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
} from "lucide-react";

export default function Dashboard({ user, orders }) {
  // Filter orders based on user role and firm
  const getFilteredOrders = () => {
    if (user.role === "master") {
      return orders;
    } else {
      return orders.filter((order) => order.firmName === user.firm);
    }
  };

  const filteredOrders = getFilteredOrders();

  // Calculate statistics
  const totalOrders = filteredOrders.length;
  const pendingOrders = filteredOrders.filter(
    (order) => !order.expectedDeliveryDate
  ).length;
  const completedOrders = filteredOrders.filter(
    (order) => order.materialReceived
  ).length;
  const inProgress = totalOrders - pendingOrders - completedOrders;

  const stats = [
    {
      title: "Total Orders",
      value: totalOrders,
      icon: ShoppingCart,
      color: "bg-gradient-to-r from-blue-500 to-blue-600",
      change: "+12%",
      trend: "up",
      description: "vs last month",
    },
    {
      title: "Pending Orders",
      value: pendingOrders,
      icon: Clock,
      color: "bg-gradient-to-r from-yellow-500 to-yellow-600",
      change: "-5%",
      trend: "down",
      description: "vs last month",
    },
    {
      title: "In Progress",
      value: inProgress,
      icon: TrendingUp,
      color: "bg-gradient-to-r from-orange-500 to-orange-600",
      change: "+8%",
      trend: "up",
      description: "vs last month",
    },
    {
      title: "Completed",
      value: completedOrders,
      icon: CheckCircle,
      color: "bg-gradient-to-r from-green-500 to-green-600",
      change: "+15%",
      trend: "up",
      description: "vs last month",
    },
  ];

  const recentOrders = filteredOrders.slice(-5).reverse();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 hidden lg:block">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Welcome back,{" "}
              <span className="font-semibold text-gray-900">{user.name}</span>!
              Here's what's happening with your orders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200"
            >
              {user.firm} - {user.role}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`absolute inset-0 ${stat.color} opacity-5`}></div>
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          stat.trend === "up"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {stat.trend === "up" ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {stat.change}
                      </div>
                      <span className="text-xs text-gray-500">
                        {stat.description}
                      </span>
                    </div>
                  </div>
                  <div className={`${stat.color} p-3 rounded-xl shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Orders and Firm Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Recent Orders
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Latest orders in the system
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentOrders.length > 0 ? (
              recentOrders.map((order, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {order.serialNo}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {order.partyName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {order.firmName}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold text-gray-900">
                      ₹
                      {Number.parseFloat(
                        order.totalPOValue || 0
                      ).toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.partyPODate).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No orders found</p>
                <p className="text-gray-400 text-xs mt-1">
                  Orders will appear here once created
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Firm Overview */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Firm Overview
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Orders and revenue by firm
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.role === "master" ? (
              ["AAA", "BBB", "CCC", "DDD"].map((firm) => {
                const firmOrders = orders.filter(
                  (order) => order.firmName === firm
                );
                const firmRevenue = firmOrders.reduce(
                  (sum, order) =>
                    sum + Number.parseFloat(order.totalPOValue || 0),
                  0
                );
                const colors = {
                  AAA: "bg-blue-100 text-blue-700 border-blue-200",
                  BBB: "bg-green-100 text-green-700 border-green-200",
                  CCC: "bg-purple-100 text-purple-700 border-purple-200",
                  DDD: "bg-orange-100 text-orange-700 border-orange-200",
                };

                return (
                  <div
                    key={firm}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-700">
                          {firm.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {firm}
                        </p>
                        <p className="text-xs text-gray-600">
                          {firmOrders.length} orders
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        ₹{firmRevenue.toLocaleString("en-IN")}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-xs mt-1 ${colors[firm]}`}
                      >
                        Active
                      </Badge>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-700">
                      {user.firm.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {user.firm}
                    </p>
                    <p className="text-xs text-gray-600">
                      {filteredOrders.length} orders
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    ₹
                    {filteredOrders
                      .reduce(
                        (sum, order) =>
                          sum + Number.parseFloat(order.totalPOValue || 0),
                        0
                      )
                      .toLocaleString("en-IN")}
                  </p>
                  <Badge
                    variant="outline"
                    className="text-xs mt-1 bg-blue-50 text-blue-700 border-blue-200"
                  >
                    Your Firm
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
