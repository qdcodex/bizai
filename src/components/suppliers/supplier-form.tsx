"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supplierCreateSchema, type SupplierCreateInput } from "@/lib/validation/supplier";

type SupplierFormValues = z.input<typeof supplierCreateSchema>;

interface SupplierFormProps {
  mode: "create" | "edit";
  supplierId?: string;
  defaultValues?: Partial<SupplierCreateInput>;
}

export function SupplierForm({ mode, supplierId, defaultValues }: SupplierFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SupplierFormValues, unknown, SupplierCreateInput>({
    resolver: zodResolver(supplierCreateSchema),
    defaultValues: {
      supplierCode: "",
      name: "",
      companyName: "",
      email: "",
      phone: "",
      taxNumber: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      paymentTerms: "Net 30",
      isActive: true,
      ...defaultValues,
    },
  });

  const isActive = useWatch({ control, name: "isActive" });

  async function onSubmit(values: SupplierCreateInput) {
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/suppliers" : `/api/suppliers/${supplierId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(mode === "create" ? "Supplier created" : "Supplier updated");
      router.push(`/suppliers/${result.data._id ?? supplierId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "New Supplier" : "Edit Supplier"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplierCode">Supplier Code</Label>
            <Input id="supplierCode" {...register("supplierCode")} />
            {errors.supplierCode && <p className="text-xs text-destructive">{errors.supplierCode.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" {...register("companyName")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="taxNumber">Tax Number</Label>
            <Input id="taxNumber" {...register("taxNumber")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register("city")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" {...register("state")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...register("country")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input id="postalCode" {...register("postalCode")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="paymentTerms">Payment Terms</Label>
            <Input id="paymentTerms" {...register("paymentTerms")} />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="isActive" checked={isActive} onCheckedChange={(v) => setValue("isActive", v)} />
            <Label htmlFor="isActive">Active</Label>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {mode === "create" ? "Create Supplier" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
