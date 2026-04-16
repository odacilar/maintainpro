"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Plus, Search, Pencil, UserCheck, UserX, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = "FACTORY_ADMIN" | "ENGINEER" | "TECHNICIAN";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  department: { id: string; name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: Role | "";
  departmentId: string;
  phone: string;
}

const emptyForm: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "",
  departmentId: "",
  phone: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleLabel(role: Role) {
  switch (role) {
    case "FACTORY_ADMIN":
      return "Fabrika Yöneticisi";
    case "ENGINEER":
      return "Mühendis";
    case "TECHNICIAN":
      return "Teknisyen";
  }
}

function roleBadge(role: Role) {
  switch (role) {
    case "FACTORY_ADMIN":
      return <Badge variant="default">{roleLabel(role)}</Badge>;
    case "ENGINEER":
      return <Badge variant="warning">{roleLabel(role)}</Badge>;
    case "TECHNICIAN":
      return <Badge variant="secondary">{roleLabel(role)}</Badge>;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Dialog component (inline — no shadcn Dialog in ui/)
// ---------------------------------------------------------------------------

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-background shadow-xl border border-border mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KullanicilarPage() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormState>(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit dialog
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserFormState>>({});
  const [editError, setEditError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: users, isLoading, isError } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => fetch("/api/departments").then((r) => r.json()),
  });

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = !filterRole || u.role === filterRole;
      const matchStatus =
        !filterStatus ||
        (filterStatus === "active" ? u.isActive : !u.isActive);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, filterRole, filterStatus]);

  // Subscription limit summary
  const userCount = users?.length ?? 0;

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: UserFormState) =>
      fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role || undefined,
          departmentId: data.departmentId || undefined,
          phone: data.phone || undefined,
        }),
      }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((body as { error?: string }).error ?? "Kullanıcı oluşturulamadı.");
        return body;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      setCreateForm(emptyForm);
      setCreateError(null);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormState> }) =>
      fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || undefined,
          role: data.role || undefined,
          departmentId: data.departmentId || null,
          phone: data.phone || null,
        }),
      }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((body as { error?: string }).error ?? "Kullanıcı güncellenemedi.");
        return body;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      setEditError(null);
    },
    onError: (err: Error) => setEditError(err.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((body as { error?: string }).error ?? "Durum değiştirilemedi.");
        return body;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.name.trim()) {
      setCreateError("Ad Soyad zorunludur.");
      return;
    }
    if (!createForm.email.trim()) {
      setCreateError("E-posta zorunludur.");
      return;
    }
    if (!createForm.password || createForm.password.length < 8) {
      setCreateError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (!createForm.role) {
      setCreateError("Rol seçimi zorunludur.");
      return;
    }
    createMutation.mutate(createForm);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      departmentId: user.department?.id ?? "",
      phone: "",
    });
    setEditError(null);
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    if (!editForm.name?.trim()) {
      setEditError("Ad Soyad zorunludur.");
      return;
    }
    updateMutation.mutate({ id: editingUser.id, data: editForm });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Kullanıcılar</h1>
          {users && (
            <p className="text-sm text-muted-foreground mt-1">
              {userCount} kullanıcı kayıtlı
            </p>
          )}
        </div>
        <Button onClick={() => { setShowCreate(true); setCreateError(null); setCreateForm(emptyForm); }}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kullanıcı
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Ad veya e-posta ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              className="w-full sm:w-48"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as Role | "")}
            >
              <option value="">Tüm Roller</option>
              <option value="FACTORY_ADMIN">Fabrika Yöneticisi</option>
              <option value="ENGINEER">Mühendis</option>
              <option value="TECHNICIAN">Teknisyen</option>
            </Select>
            <Select
              className="w-full sm:w-40"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "" | "active" | "inactive")}
            >
              <option value="">Tüm Durumlar</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              Kullanıcılar yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {users?.length === 0
                ? "Henüz kullanıcı eklenmemiş."
                : "Filtreyle eşleşen kullanıcı bulunamadı."}
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ad Soyad</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">E-posta</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rol</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Departman</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Oluşturulma</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">{user.email}</div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        {roleBadge(user.role)}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                        {user.department?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {user.isActive ? (
                          <Badge variant="success">Aktif</Badge>
                        ) : (
                          <Badge variant="danger">Pasif</Badge>
                        )}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Düzenle"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-8 w-8 ${user.isActive ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-700"}`}
                            title={user.isActive ? "Devre Dışı Bırak" : "Aktifleştir"}
                            disabled={toggleStatusMutation.isPending}
                            onClick={() =>
                              toggleStatusMutation.mutate({ id: user.id, isActive: !user.isActive })
                            }
                          >
                            {user.isActive ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(emptyForm); setCreateError(null); }}
        title="Yeni Kullanıcı"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">
              Ad Soyad <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-name"
              placeholder="Ahmet Yılmaz"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-email">
              E-posta <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-email"
              type="email"
              placeholder="ahmet@fabrika.com"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-password">
              Şifre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-password"
              type="password"
              placeholder="En az 8 karakter"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-role">
              Rol <span className="text-destructive">*</span>
            </Label>
            <Select
              id="create-role"
              className="w-full"
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as Role | "" }))}
            >
              <option value="">Rol seçin...</option>
              <option value="FACTORY_ADMIN">Fabrika Yöneticisi</option>
              <option value="ENGINEER">Mühendis</option>
              <option value="TECHNICIAN">Teknisyen</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-department">Departman</Label>
            <Select
              id="create-department"
              className="w-full"
              value={createForm.departmentId}
              onChange={(e) => setCreateForm((f) => ({ ...f, departmentId: e.target.value }))}
            >
              <option value="">Departman seçin (opsiyonel)</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-phone">Telefon</Label>
            <Input
              id="create-phone"
              placeholder="+90 555 000 00 00"
              value={createForm.phone}
              onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={createMutation.isPending} className="flex-1">
              {createMutation.isPending ? "Kaydediliyor..." : "Kullanıcı Oluştur"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowCreate(false); setCreateForm(emptyForm); setCreateError(null); }}
            >
              İptal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={!!editingUser}
        onClose={() => { setEditingUser(null); setEditError(null); }}
        title="Kullanıcıyı Düzenle"
      >
        {editingUser && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1 pb-2 border-b border-border">
              <p className="text-xs text-muted-foreground">E-posta</p>
              <p className="text-sm font-medium">{editingUser.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Ad Soyad <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editForm.name ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rol</Label>
              <Select
                id="edit-role"
                className="w-full"
                value={editForm.role ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role | "" }))}
              >
                <option value="FACTORY_ADMIN">Fabrika Yöneticisi</option>
                <option value="ENGINEER">Mühendis</option>
                <option value="TECHNICIAN">Teknisyen</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Departman</Label>
              <Select
                id="edit-department"
                className="w-full"
                value={editForm.departmentId ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, departmentId: e.target.value }))}
              >
                <option value="">Departman yok</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
                {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditingUser(null); setEditError(null); }}
              >
                İptal
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
