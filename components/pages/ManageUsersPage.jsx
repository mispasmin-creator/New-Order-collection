"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  Users, UserPlus, Edit2, Trash2, Shield, Search, Key,
  Building2, ShieldCheck, AlertTriangle,
} from "lucide-react"

const ALL_PAGES = [
  "Dashboard",
  "Order",
  "Check PO",
  "Received Accounts",
  "Check for Delivery",
  "Arrange Logistics",
  "Logistics Approval",
  "Dispatch Planning",
  "Accounts Approval",
  "Logistic",
  "Load Material",
  "Wetman Entry",
  "Invoice",
  "TC",
  "Bilty Update",
  "Material Return",
  "Management Approval",
  "Debit Note",
  "Return of Material",
  "Retention",
  "Make PI",
  "Received PI Payment",
  "Manage Users",
]

const ROLES = ["ADMIN", "USER"]

const parsePages = (raw) => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  const t = raw.trim()
  if (!t) return []
  if (t.toLowerCase() === "all") return ["all"]
  return t.split(",").map((p) => p.trim()).filter(Boolean)
}

const parseFirms = (raw) => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  const t = raw.trim()
  if (!t) return []
  if (t.toLowerCase() === "all") return ["all"]
  return t.split(",").map((f) => f.trim()).filter(Boolean)
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableFirms, setAvailableFirms] = useState([])

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "operator",
    firms: [],
    pages: [],
  })

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const [usersRes, firmsRes] = await Promise.all([
        supabase.from("USER").select("*").order("Username", { ascending: true }),
        supabase.from("MASTER").select('"Firm Name"').not("Firm Name", "is", null),
      ])
      if (usersRes.error) throw usersRes.error
      setUsers(usersRes.data || [])

      // Unique firm names from MASTER table
      const firms = [...new Set(
        (firmsRes.data || []).map(r => (r["Firm Name"] || "").trim()).filter(Boolean)
      )].sort()
      setAvailableFirms(firms)
    } catch (err) {
      toast.error("Failed to fetch data: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditingUser(null)
    setFormData({ username: "", password: "", role: "operator", firms: [], pages: [] })
    setIsDialogOpen(true)
  }

  const openEdit = (u) => {
    setEditingUser(u)
    setFormData({
      username: u["Username"] || "",
      password: u["Password"] || "",
      role: u["Role"] || "operator",
      firms: parseFirms(u["Firm_Name"]),
      pages: parsePages(u["Page Acess"]),
    })
    setIsDialogOpen(true)
  }

  const togglePage = (page) => {
    setFormData((prev) => {
      if (page === "all") {
        return { ...prev, pages: prev.pages.includes("all") ? [] : ["all"] }
      }
      const without = prev.pages.filter((p) => p !== "all")
      return {
        ...prev,
        pages: without.includes(page) ? without.filter((p) => p !== page) : [...without, page],
      }
    })
  }

  const toggleFirm = (firm) => {
    setFormData((prev) => {
      if (firm === "all") {
        return { ...prev, firms: prev.firms.includes("all") ? [] : ["all"] }
      }
      const without = prev.firms.filter((f) => f !== "all")
      return {
        ...prev,
        firms: without.includes(firm) ? without.filter((f) => f !== firm) : [...without, firm],
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.username || !formData.password || !formData.role) {
      toast.error("Username, Password, and Role are required")
      return
    }

    setIsSubmitting(true)
    try {
      const pagesValue = formData.pages.includes("all") ? "all" : formData.pages.join(",")
      const firmsValue = formData.firms.includes("all") ? "all" : formData.firms.join(",")

      const payload = {
        Username: formData.username,
        Password: formData.password,
        Role: formData.role,
        Firm_Name: firmsValue,
        "Page Acess": pagesValue,
      }

      if (editingUser) {
        const { error } = await supabase.from("USER").update(payload).eq("id", editingUser.id)
        if (error) throw error
        toast.success("User updated successfully")
      } else {
        const { error } = await supabase.from("USER").insert([payload])
        if (error) throw error
        toast.success("User added successfully")
      }

      setIsDialogOpen(false)
      fetchUsers()
    } catch (err) {
      toast.error(err.message || "Failed to save user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id, username) => {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      const { error } = await supabase.from("USER").delete().eq("id", id)
      if (error) throw error
      toast.success("User deleted")
      fetchUsers()
    } catch (err) {
      toast.error("Failed to delete user: " + err.message)
    }
  }

  const filtered = users.filter(
    (u) =>
      (u["Username"] || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u["Firm_Name"] || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u["Role"] || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" /> Manage Users
          </h1>
          <p className="text-gray-500 text-sm mt-1">Configure user access, firm assignments, and page permissions</p>
        </div>
        <Button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white w-fit">
          <UserPlus className="mr-2 h-4 w-4" /> Add New User
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-slate-50/50 py-4 px-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, firm or role..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Badge variant="outline" className="w-fit">{users.length} Users</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Username</TableHead>
                  <TableHead className="font-bold">Role</TableHead>
                  <TableHead className="font-bold">Firm</TableHead>
                  <TableHead className="font-bold">Page Access</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      {Array(5).fill(0).map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length > 0 ? filtered.map((u) => {
                  const pages = parsePages(u["Page Acess"])
                  const isAll = pages.includes("all")
                  return (
                    <TableRow key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                            {u["Username"]?.charAt(0).toUpperCase()}
                          </div>
                          {u["Username"]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          u["Role"] === "ADMIN"
                            ? "border-purple-200 bg-purple-50 text-purple-700"
                            : "border-gray-200 bg-gray-50 text-gray-700"
                        }>
                          {u["Role"] || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-none">
                          <Building2 className="h-3 w-3 mr-1" />
                          {u["Firm_Name"] || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isAll ? (
                            <Badge className="bg-purple-100 text-purple-700 border-none text-xs">
                              <ShieldCheck className="h-3 w-3 mr-1" /> All Pages
                            </Badge>
                          ) : pages.length > 0 ? (
                            <>
                              {pages.slice(0, 4).map((p, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-100">{p}</Badge>
                              ))}
                              {pages.length > 4 && (
                                <Badge variant="outline" className="text-[10px] text-gray-500">+{pages.length - 4} more</Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No access</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" className="hover:text-indigo-600 hover:bg-indigo-50" onClick={() => openEdit(u)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(u.id, u["Username"])}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                }) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-gray-400">
                      <Users className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingUser ? <Edit2 className="h-4 w-4 text-indigo-600" /> : <UserPlus className="h-4 w-4 text-indigo-600" />}
                {editingUser ? "Edit User" : "Add New User"}
              </DialogTitle>
              <DialogDescription>Configure credentials, firm access, and page permissions</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              {/* Left column */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs font-semibold text-gray-600">Username <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="username"
                      placeholder="e.g. john_doe"
                      className="pl-10 h-9"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      disabled={!!editingUser}
                    />
                  </div>
                  {editingUser && <p className="text-[10px] text-gray-400 italic">Username cannot be changed</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-gray-600">Password <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="text"
                      placeholder="Set password"
                      className="pl-10 h-9"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">Role <span className="text-red-500">*</span></Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Firm access */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600 flex items-center justify-between">
                    Firm Access
                    <Badge variant="outline" className="text-[10px]">
                      {formData.firms.includes("all") ? "All Firms" : `${formData.firms.length} Selected`}
                    </Badge>
                  </Label>
                  <div className="border border-gray-100 rounded-lg p-3 bg-slate-50/30 space-y-2">
                    <div className="flex items-center gap-2 p-1.5 bg-blue-50 rounded border border-blue-100">
                      <Checkbox
                        id="firm-all"
                        checked={formData.firms.includes("all")}
                        onCheckedChange={() => toggleFirm("all")}
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <Label htmlFor="firm-all" className="text-xs font-bold text-blue-900 cursor-pointer flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> All Firms
                      </Label>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {availableFirms.map((firm) => (
                        <div key={firm} className="flex items-center gap-2 p-1.5 hover:bg-white rounded transition-colors">
                          <Checkbox
                            id={`firm-${firm}`}
                            checked={formData.firms.includes(firm) || formData.firms.includes("all")}
                            onCheckedChange={() => toggleFirm(firm)}
                            disabled={formData.firms.includes("all")}
                            className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                          />
                          <Label htmlFor={`firm-${firm}`} className={`text-xs cursor-pointer ${formData.firms.includes("all") ? "text-gray-400" : "text-gray-700"}`}>
                            {firm}
                          </Label>
                        </div>
                      ))}
                      {availableFirms.length === 0 && (
                        <p className="text-xs text-gray-400 col-span-2 italic">No firms found in MASTER table.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 leading-relaxed">
                      Changes apply immediately. User must refresh their browser to see updated access.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right column — page permissions */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-600 flex items-center justify-between">
                  Page Permissions
                  <Badge variant="outline" className="text-[10px]">
                    {formData.pages.includes("all") ? "All Pages" : `${formData.pages.length} Selected`}
                  </Badge>
                </Label>

                <div className="border border-gray-100 rounded-lg p-3 bg-slate-50/30">
                  {/* All access */}
                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-100 mb-2">
                    <Checkbox
                      id="page-all"
                      checked={formData.pages.includes("all")}
                      onCheckedChange={() => togglePage("all")}
                      className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                    />
                    <div>
                      <Label htmlFor="page-all" className="text-xs font-bold text-purple-900 cursor-pointer flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Full Access (All Pages)
                      </Label>
                      <p className="text-[10px] text-purple-600">Overrides all individual selections</p>
                    </div>
                  </div>

                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-1">
                      {ALL_PAGES.map((page) => (
                        <div key={page} className="flex items-center gap-2 p-1.5 hover:bg-white rounded transition-colors">
                          <Checkbox
                            id={`page-${page}`}
                            checked={formData.pages.includes(page) || formData.pages.includes("all")}
                            onCheckedChange={() => togglePage(page)}
                            disabled={formData.pages.includes("all")}
                            className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                          />
                          <Label
                            htmlFor={`page-${page}`}
                            className={`text-xs cursor-pointer ${formData.pages.includes("all") ? "text-gray-400" : "text-gray-700"}`}
                          >
                            {page}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmitting ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
