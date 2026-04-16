"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { Department } from "@/types/machine";

interface DeptFormState {
  code: string;
  name: string;
  description: string;
}

const emptyForm: DeptFormState = { code: "", name: "", description: "" };

interface EditingState {
  id: string;
  values: DeptFormState;
}

export default function DepartmanlarPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<DeptFormState>(emptyForm);
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: departments, isLoading, isError } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => fetch("/api/departments").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: DeptFormState) =>
      fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Departman eklenemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setAddForm(emptyForm);
      setShowAddForm(false);
      setAddError(null);
    },
    onError: (err: Error) => setAddError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeptFormState }) =>
      fetch(`/api/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Departman güncellenemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setEditing(null);
      setEditError(null);
    },
    onError: (err: Error) => setEditError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/departments/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Departman silinemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeleteConfirm(null);
      setDeleteError(null);
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addForm.code.trim() || !addForm.name.trim()) {
      setAddError("Kod ve ad zorunludur.");
      return;
    }
    createMutation.mutate(addForm);
  }

  function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    if (!editing.values.code.trim() || !editing.values.name.trim()) {
      setEditError("Kod ve ad zorunludur.");
      return;
    }
    updateMutation.mutate({ id: editing.id, data: editing.values });
  }

  function startEdit(dept: Department) {
    setEditing({
      id: dept.id,
      values: {
        code: dept.code,
        name: dept.name,
        description: dept.description ?? "",
      },
    });
    setEditError(null);
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Departmanlar</h1>
        {!showAddForm && (
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Departman Ekle
          </Button>
        )}
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yeni Departman</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-code">
                    Kod <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="add-code"
                    placeholder="URT"
                    value={addForm.code}
                    onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-name">
                    Ad <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="add-name"
                    placeholder="Üretim"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="add-desc">Açıklama</Label>
                  <Textarea
                    id="add-desc"
                    placeholder="Departman açıklaması..."
                    rows={2}
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
              {addError && <p className="text-sm text-destructive">{addError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddForm(emptyForm);
                    setAddError(null);
                  }}
                >
                  İptal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              Departmanlar yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && (!departments || departments.length === 0) && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              Henüz departman eklenmemiş.
            </div>
          )}
          {!isLoading && !isError && departments && departments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kod</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ad</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Açıklama
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Makine Sayısı
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => {
                    const isEditing = editing?.id === dept.id;
                    const isDeleteConfirm = deleteConfirm === dept.id;

                    return (
                      <tr key={dept.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              className="h-8 w-24 text-xs"
                              value={editing.values.code}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, values: { ...prev.values, code: e.target.value } } : prev
                                )
                              }
                            />
                          ) : (
                            <span className="font-mono text-xs">{dept.code}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {isEditing ? (
                            <Input
                              className="h-8"
                              value={editing.values.name}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, values: { ...prev.values, name: e.target.value } } : prev
                                )
                              }
                            />
                          ) : (
                            dept.name
                          )}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                          {isEditing ? (
                            <Input
                              className="h-8"
                              value={editing.values.description}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev
                                    ? { ...prev, values: { ...prev.values, description: e.target.value } }
                                    : prev
                                )
                              }
                            />
                          ) : (
                            dept.description ?? "—"
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                          {dept._count?.machines ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <form onSubmit={handleEditSave}>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="submit"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600 hover:text-green-700"
                                  disabled={updateMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => setEditing(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              {editError && (
                                <p className="text-xs text-destructive mt-1 text-right">{editError}</p>
                              )}
                            </form>
                          ) : isDeleteConfirm ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => deleteMutation.mutate(dept.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  Evet, Sil
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setDeleteConfirm(null);
                                    setDeleteError(null);
                                  }}
                                >
                                  İptal
                                </Button>
                              </div>
                              {deleteError && (
                                <p className="text-xs text-destructive">{deleteError}</p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => startEdit(dept)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setDeleteConfirm(dept.id);
                                  setDeleteError(null);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
