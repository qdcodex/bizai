/**
 * Development seed data for BizAI Phase 2.
 * Run with: npm run seed
 *
 * Creates (or reuses) a dedicated demo organization and reseeds its business
 * data by going through the real service layer — not raw inserts — so the
 * same validation, numbering, and stock-movement invariants apply as in the
 * running app.
 */
import { connectToDatabase } from "../src/lib/db/connect";
import { User } from "../src/models/User";
import { Organization } from "../src/models/Organization";
import { Membership } from "../src/models/Membership";
import { Product } from "../src/models/Product";
import { InventoryItem } from "../src/models/InventoryItem";
import { StockMovement } from "../src/models/StockMovement";
import { Customer } from "../src/models/Customer";
import { Supplier } from "../src/models/Supplier";
import { Quotation } from "../src/models/Quotation";
import { Counter } from "../src/models/Counter";
import { hashPassword } from "../src/lib/auth/password";
import { createProduct } from "../src/services/product.service";
import { recordStockMovement } from "../src/services/stock-movement.service";
import { createCustomer } from "../src/services/customer.service";
import { createSupplier } from "../src/services/supplier.service";
import {
  createQuotation,
  submitQuotation,
  approveQuotation,
  rejectQuotation,
  convertQuotation,
} from "../src/services/quotation.service";
import type { SessionPayload } from "../src/lib/auth/session";

const DEMO_EMAIL = "demo@bizai.dev";
const DEMO_PASSWORD = "Demo@1234";
const DEMO_ORG_NAME = "BizAI Demo Co";
const DEMO_ORG_SLUG = "bizai-demo-co";

async function ensureDemoOrganization(): Promise<{ userId: string; organizationId: string }> {
  let organization = await Organization.findOne({ slug: DEMO_ORG_SLUG });
  let user = await User.findOne({ email: DEMO_EMAIL });

  if (!user) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    user = await User.create({ name: "Demo Owner", email: DEMO_EMAIL, passwordHash });
  }

  if (!organization) {
    organization = await Organization.create({
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
      ownerId: user._id,
    });
  }

  user.activeOrganizationId = organization._id;
  await user.save();

  await Membership.findOneAndUpdate(
    { userId: user._id, organizationId: organization._id },
    { $setOnInsert: { role: "owner" } },
    { upsert: true },
  );

  return { userId: user._id.toString(), organizationId: organization._id.toString() };
}

async function wipeBusinessData(organizationId: string): Promise<void> {
  await Promise.all([
    Product.deleteMany({ organizationId }),
    InventoryItem.deleteMany({ organizationId }),
    StockMovement.deleteMany({ organizationId }),
    Customer.deleteMany({ organizationId }),
    Supplier.deleteMany({ organizationId }),
    Quotation.deleteMany({ organizationId }),
    Counter.deleteMany({ _id: new RegExp(`^${organizationId}:`) }),
  ]);
}

const CATEGORIES = ["Safety Equipment", "Hand Tools", "Power Tools", "Fasteners", "Electrical"];
const BRANDS = ["ProGuard", "IronGrip", "VoltMax", "SteelCore", "Apex"];
const UOMS = ["unit", "box", "pair", "set", "meter"];

function productBlueprint(index: number) {
  const category = CATEGORIES[index % CATEGORIES.length];
  const brand = BRANDS[index % BRANDS.length];
  const uom = UOMS[index % UOMS.length];
  const costPrice = 200 + index * 37;
  const sellingPrice = Math.round(costPrice * 1.6);
  const minSellingPrice = Math.round(costPrice * 1.2);

  const names: Record<string, string> = {
    "Safety Equipment": `Safety Helmet Model ${index + 1}`,
    "Hand Tools": `Adjustable Wrench ${index + 1}"`,
    "Power Tools": `Cordless Drill X${index + 1}`,
    Fasteners: `Hex Bolt Pack M${index + 1}`,
    Electrical: `Circuit Breaker ${(index + 1) * 5}A`,
  };

  return {
    itemCode: `P-${String(index + 1).padStart(4, "0")}`,
    itemName: names[category],
    description: `${brand} ${names[category]} — durable, field-tested, and ready for daily use.`,
    category,
    brand,
    partNumber: `${brand.slice(0, 3).toUpperCase()}-${1000 + index}`,
    uom,
    costPrice,
    sellingPrice,
    minSellingPrice,
    lowStockThreshold: 15,
    imageUrl: "",
    isActive: true,
  };
}

const CUSTOMER_NAMES = [
  ["Ravi Kumar", "ABC Industries"],
  ["Priya Sharma", "Sharma Traders"],
  ["Amit Patel", "Patel Constructions"],
  ["Sunita Rao", "Rao Electricals"],
  ["Vikram Singh", "Singh Hardware"],
  ["Anjali Mehta", "Mehta Enterprises"],
  ["Karan Malhotra", "Malhotra & Sons"],
  ["Deepa Nair", "Nair Engineering"],
  ["Sanjay Gupta", "Gupta Tools Co"],
  ["Neha Joshi", "Joshi Industrial Supplies"],
];

const SUPPLIER_NAMES = [
  ["Rajesh Verma", "Verma Steel Works"],
  ["Meena Iyer", "Iyer Fasteners Ltd"],
  ["Arjun Desai", "Desai Electricals"],
  ["Kavita Reddy", "Reddy Safety Gear"],
  ["Manoj Bhatt", "Bhatt Power Tools"],
];

async function seedProducts(organizationId: string) {
  const products = [];
  for (let i = 0; i < 20; i++) {
    const product = await createProduct(organizationId, productBlueprint(i));
    products.push(product);
  }
  return products;
}

async function seedCustomers(organizationId: string) {
  const customers = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const [name, companyName] = CUSTOMER_NAMES[i];
    const customer = await createCustomer(organizationId, {
      customerCode: `CUST-${String(i + 1).padStart(4, "0")}`,
      name,
      companyName,
      email: `${name.toLowerCase().replace(" ", ".")}@${companyName.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      phone: `98${String(10000000 + i * 1111).slice(0, 8)}`,
      taxNumber: `GSTIN${1000 + i}`,
      address: `${100 + i} Industrial Area`,
      city: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Pune"][i % 5],
      state: ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Maharashtra"][i % 5],
      country: "India",
      postalCode: `4000${i}0`,
      creditLimit: 50000 + i * 10000,
      paymentTerms: ["Net 15", "Net 30", "Net 45"][i % 3],
      isActive: true,
    });
    customers.push(customer);
  }
  return customers;
}

async function seedSuppliers(organizationId: string) {
  for (let i = 0; i < SUPPLIER_NAMES.length; i++) {
    const [name, companyName] = SUPPLIER_NAMES[i];
    await createSupplier(organizationId, {
      supplierCode: `SUP-${String(i + 1).padStart(4, "0")}`,
      name,
      companyName,
      email: `${name.toLowerCase().replace(" ", ".")}@${companyName.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      phone: `99${String(20000000 + i * 2222).slice(0, 8)}`,
      taxNumber: `GSTIN${2000 + i}`,
      address: `${200 + i} Supplier Complex`,
      city: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Pune"][i % 5],
      state: ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Maharashtra"][i % 5],
      country: "India",
      postalCode: `5000${i}0`,
      paymentTerms: ["Net 30", "Net 45", "Net 60"][i % 3],
      isActive: true,
    });
  }
}

async function seedStockMovements(
  organizationId: string,
  userId: string,
  products: Array<{ _id: { toString(): string }; itemName: string }>,
) {
  let movementCount = 0;

  // Initial purchase for every product; a few are deliberately kept low/empty.
  for (let i = 0; i < products.length; i++) {
    const initialStock = i === 0 ? 0 : i < 4 ? 5 : 40 + i * 6;
    if (initialStock > 0) {
      await recordStockMovement({
        organizationId,
        productId: products[i]._id.toString(),
        type: "PURCHASE",
        quantity: initialStock,
        referenceType: "PURCHASE_ORDER",
        notes: "Initial stock intake",
        createdBy: userId,
      });
      movementCount++;
    }
  }

  // A spread of additional adjustments/sales/returns across products.
  const extraTypes = ["SALE", "ADJUSTMENT_OUT", "RETURN_IN", "ADJUSTMENT_IN"] as const;
  for (let i = 0; movementCount < 30; i++) {
    const product = products[(i + 5) % products.length];
    const type = extraTypes[i % extraTypes.length];
    const quantity = 1 + (i % 5);
    try {
      await recordStockMovement({
        organizationId,
        productId: product._id.toString(),
        type,
        quantity,
        referenceType: "MANUAL",
        notes: `Seed movement ${movementCount + 1}`,
        createdBy: userId,
      });
      movementCount++;
    } catch {
      // Skip if the product doesn't have enough stock for this outbound movement.
    }
  }
}

async function seedQuotations(
  session: SessionPayload,
  customers: Array<{ _id: { toString(): string } }>,
  products: Array<{ _id: { toString(): string }; sellingPrice: number }>,
) {
  async function makeQuotation(customerIndex: number, productIndexes: number[], quantities: number[]) {
    return createQuotation(session, {
      customerId: customers[customerIndex]._id.toString(),
      items: productIndexes.map((productIndex, i) => ({
        productId: products[productIndex]._id.toString(),
        quantity: quantities[i],
      })),
      notes: "Seeded quotation",
      overrideMinPrice: false,
    });
  }

  // 3 drafts (small, low value)
  for (let i = 0; i < 3; i++) {
    await makeQuotation(i, [i, i + 1], [2, 1]);
  }

  // 2 pending approval (large quantities to exceed the default threshold)
  for (let i = 3; i < 5; i++) {
    const q = await makeQuotation(i, [i, i + 2, i + 4], [20, 15, 10]);
    await submitQuotation(session, q._id.toString());
  }

  // 2 approved (submitted, then approved if the total required it)
  for (let i = 5; i < 7; i++) {
    const q = await makeQuotation(i, [i], [1]);
    const submitted = await submitQuotation(session, q._id.toString());
    if (submitted.status === "PENDING_APPROVAL") {
      await approveQuotation(session, q._id.toString());
    }
  }

  // 2 converted (approved, then converted — deducts real stock)
  for (let i = 7; i < 9; i++) {
    const q = await makeQuotation(i, [i % products.length], [2]);
    const submitted = await submitQuotation(session, q._id.toString());
    if (submitted.status === "PENDING_APPROVAL") {
      await approveQuotation(session, q._id.toString());
    }
    await convertQuotation(session, q._id.toString());
  }

  // 1 rejected
  {
    const q = await makeQuotation(9, [9, 11, 13], [25, 15, 10]);
    await submitQuotation(session, q._id.toString());
    await rejectQuotation(session, q._id.toString(), "Pricing needs revision.");
  }
}

async function main() {
  await connectToDatabase();

  const { userId, organizationId } = await ensureDemoOrganization();
  console.log(`Demo organization ready: ${DEMO_ORG_NAME} (${organizationId})`);
  console.log(`Sign in with: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  await wipeBusinessData(organizationId);
  console.log("Cleared previous demo business data.");

  const products = await seedProducts(organizationId);
  console.log(`Seeded ${products.length} products.`);

  const customers = await seedCustomers(organizationId);
  console.log(`Seeded ${customers.length} customers.`);

  await seedSuppliers(organizationId);
  console.log(`Seeded ${SUPPLIER_NAMES.length} suppliers.`);

  await seedStockMovements(organizationId, userId, products);
  console.log("Seeded stock movements.");

  const session: SessionPayload = { userId, organizationId, role: "owner" };
  await seedQuotations(session, customers, products);
  console.log("Seeded quotations across Draft, Pending, Approved, Converted, and Rejected states.");

  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
