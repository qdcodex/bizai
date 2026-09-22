import { Loader2, Check, AlertCircle } from "lucide-react";

const TOOL_LABELS: Record<string, { inProgress: string; done: string }> = {
  searchProducts: { inProgress: "Searching products...", done: "Products checked" },
  getProduct: { inProgress: "Looking up product...", done: "Product checked" },
  getLowStockProducts: { inProgress: "Checking inventory...", done: "Inventory checked" },
  checkStockAvailability: { inProgress: "Checking stock availability...", done: "Stock checked" },
  getProductStock: { inProgress: "Checking inventory...", done: "Inventory checked" },
  getStockMovements: { inProgress: "Checking stock movements...", done: "Stock movements checked" },
  searchCustomers: { inProgress: "Searching customers...", done: "Customers checked" },
  getCustomer: { inProgress: "Looking up customer...", done: "Customer checked" },
  getCustomerPurchaseHistory: { inProgress: "Checking purchase history...", done: "Purchase history checked" },
  searchSuppliers: { inProgress: "Searching suppliers...", done: "Suppliers checked" },
  getSupplier: { inProgress: "Looking up supplier...", done: "Supplier checked" },
  searchQuotations: { inProgress: "Checking quotations...", done: "Quotations checked" },
  getQuotation: { inProgress: "Looking up quotation...", done: "Quotation checked" },
};

export type ToolStatusState = "in-progress" | "done" | "error";

export function ToolStatus({ toolName, state }: { toolName: string; state: ToolStatusState }) {
  const labels = TOOL_LABELS[toolName] ?? { inProgress: "Working...", done: "Done" };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {state === "in-progress" && (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          <span>{labels.inProgress}</span>
        </>
      )}
      {state === "done" && (
        <>
          <Check className="size-3.5 text-emerald-600" />
          <span>{labels.done}</span>
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="size-3.5 text-destructive" />
          <span>Something went wrong checking that.</span>
        </>
      )}
    </div>
  );
}
