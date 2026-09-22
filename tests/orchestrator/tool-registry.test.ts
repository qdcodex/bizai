import { describe, it, expect } from "vitest";
import { TOOL_REGISTRY } from "@/ai/tools";
import { TOOL_CATEGORIES } from "@/ai/types";
import { getAllToolEntries, getToolEntry, getToolsByCategory, isWriteTool, toolRequiresConfirmation } from "@/ai/orchestrator/ToolRegistry";
import { buildTools } from "@/ai/tools";

describe("Tool Registry", () => {
  it("registers every tool with a unique name", () => {
    const names = TOOL_REGISTRY.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("searchProducts");
    expect(names).toContain("createQuotation");
    expect(names).toContain("searchKnowledgeBase");
  });

  it("assigns every tool a valid category", () => {
    for (const entry of TOOL_REGISTRY) {
      expect(TOOL_CATEGORIES).toContain(entry.category);
    }
  });

  it("classifies read vs. write tools correctly", () => {
    expect(isWriteTool("createQuotation")).toBe(true);
    expect(isWriteTool("adjustStock")).toBe(true);
    expect(isWriteTool("searchProducts")).toBe(false);
    expect(isWriteTool("getQuotation")).toBe(false);
  });

  it("only the two write tools require confirmation", () => {
    const requiresConfirmation = TOOL_REGISTRY.filter((entry) => entry.requiresConfirmation).map((e) => e.name);
    expect(requiresConfirmation.sort()).toEqual(["adjustStock", "createQuotation"]);
    expect(toolRequiresConfirmation("createQuotation")).toBe(true);
    expect(toolRequiresConfirmation("adjustStock")).toBe(true);
    expect(toolRequiresConfirmation("searchProducts")).toBe(false);
  });

  it("looks up a tool entry by name, and returns undefined for an unknown tool", () => {
    expect(getToolEntry("searchProducts")?.permission).toBe("products.read");
    expect(getToolEntry("doesNotExist")).toBeUndefined();
  });

  it("filters tool entries by category", () => {
    const quotationTools = getToolsByCategory("QUOTATIONS");
    expect(quotationTools.map((e) => e.name).sort()).toEqual(["createQuotation", "getQuotation", "searchQuotations"]);
  });

  it("getAllToolEntries returns the same registry the tool index assembles", () => {
    expect(getAllToolEntries()).toBe(TOOL_REGISTRY);
  });

  it("buildTools fails closed: a tool with no registry entry would never be exposed", () => {
    // Every tool buildTools() can construct has a matching registry entry —
    // this guards against a future tools file forgetting to register one.
    const tools = buildTools({
      organizationId: "000000000000000000000001",
      userId: "000000000000000000000002",
      role: "owner",
      conversationId: "000000000000000000000003",
    });
    for (const name of Object.keys(tools)) {
      expect(getToolEntry(name)).toBeDefined();
    }
  });
});
