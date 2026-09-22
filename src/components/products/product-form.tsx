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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { productCreateSchema, type ProductCreateInput } from "@/lib/validation/product";

type ProductFormValues = z.input<typeof productCreateSchema>;

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  defaultValues?: Partial<ProductCreateInput>;
}

export function ProductForm({ mode, productId, defaultValues }: ProductFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues, unknown, ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      itemCode: "",
      itemName: "",
      description: "",
      category: "",
      brand: "",
      partNumber: "",
      uom: "unit",
      costPrice: 0,
      sellingPrice: 0,
      minSellingPrice: 0,
      lowStockThreshold: 10,
      imageUrl: "",
      isActive: true,
      ...defaultValues,
    },
  });

  const isActive = useWatch({ control, name: "isActive" });

  async function onSubmit(values: ProductCreateInput) {
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/products" : `/api/products/${productId}`;
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
      toast.success(mode === "create" ? "Product created" : "Product updated");
      router.push(`/products/${result.data._id ?? productId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "New Product" : "Edit Product"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="itemCode">Item Code</Label>
            <Input id="itemCode" {...register("itemCode")} />
            {errors.itemCode && <p className="text-xs text-destructive">{errors.itemCode.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="itemName">Item Name</Label>
            <Input id="itemName" {...register("itemName")} />
            {errors.itemName && <p className="text-xs text-destructive">{errors.itemName.message}</p>}
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" {...register("category")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" {...register("brand")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="partNumber">Part Number</Label>
            <Input id="partNumber" {...register("partNumber")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="uom">Unit of Measure</Label>
            <Input id="uom" {...register("uom")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="costPrice">Cost Price</Label>
            <Input id="costPrice" type="number" step="0.01" {...register("costPrice", { valueAsNumber: true })} />
            {errors.costPrice && <p className="text-xs text-destructive">{errors.costPrice.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sellingPrice">Selling Price</Label>
            <Input
              id="sellingPrice"
              type="number"
              step="0.01"
              {...register("sellingPrice", { valueAsNumber: true })}
            />
            {errors.sellingPrice && <p className="text-xs text-destructive">{errors.sellingPrice.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="minSellingPrice">Minimum Selling Price</Label>
            <Input
              id="minSellingPrice"
              type="number"
              step="0.01"
              {...register("minSellingPrice", { valueAsNumber: true })}
            />
            {errors.minSellingPrice && (
              <p className="text-xs text-destructive">{errors.minSellingPrice.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
            <Input
              id="lowStockThreshold"
              type="number"
              {...register("lowStockThreshold", { valueAsNumber: true })}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input id="imageUrl" {...register("imageUrl")} placeholder="https://..." />
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
            {mode === "create" ? "Create Product" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
