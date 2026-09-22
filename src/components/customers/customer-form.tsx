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
import { customerCreateSchema, type CustomerCreateInput } from "@/lib/validation/customer";

type CustomerFormValues = z.input<typeof customerCreateSchema>;

interface CustomerFormProps {
  mode: "create" | "edit";
  customerId?: string;
  defaultValues?: Partial<CustomerCreateInput>;
}

export function CustomerForm({ mode, customerId, defaultValues }: CustomerFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues, unknown, CustomerCreateInput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: {
      customerCode: "",
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
      creditLimit: 0,
      paymentTerms: "Net 30",
      isActive: true,
      ...defaultValues,
    },
  });

  const isActive = useWatch({ control, name: "isActive" });

  async function onSubmit(values: CustomerCreateInput) {
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/customers" : `/api/customers/${customerId}`;
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
      toast.success(mode === "create" ? "Customer created" : "Customer updated");
      router.push(`/customers/${result.data._id ?? customerId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "New Customer" : "Edit Customer"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="customerCode">Customer Code</Label>
            <Input id="customerCode" {...register("customerCode")} />
            {errors.customerCode && <p className="text-xs text-destructive">{errors.customerCode.message}</p>}
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
            <Label htmlFor="creditLimit">Credit Limit</Label>
            <Input id="creditLimit" type="number" step="0.01" {...register("creditLimit", { valueAsNumber: true })} />
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
            {mode === "create" ? "Create Customer" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
