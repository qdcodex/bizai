"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GATED_MODULES, CONFIGURABLE_ROLES, isModuleVisible, type ModuleVisibility } from "@/lib/auth/modules";
import type { Role } from "@/models/roles";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export function ModuleAccessMatrix({ initialVisibility }: { initialVisibility: ModuleVisibility }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<ModuleVisibility>(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function toggle(role: Role, moduleKey: string) {
    setDirty(true);
    setVisibility((prev) => {
      const current = prev[role] ?? GATED_MODULES.map((m) => m.key);
      const next = current.includes(moduleKey)
        ? current.filter((k) => k !== moduleKey)
        : [...current, moduleKey];
      return { ...prev, [role]: next };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/organization/module-visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visibility),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Module access updated");
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Module</th>
              {CONFIGURABLE_ROLES.map((role) => (
                <th key={role} className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">
                  {ROLE_LABEL[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GATED_MODULES.map((module) => (
              <tr key={module.key} className="border-b last:border-0">
                <td className="px-3 py-2.5 font-medium">{module.label}</td>
                {CONFIGURABLE_ROLES.map((role) => (
                  <td key={role} className="px-3 py-2.5 text-center">
                    <Checkbox
                      checked={isModuleVisible(visibility, role, module.key)}
                      onCheckedChange={() => toggle(role, module.key)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Owner always has full access. Unchecking a module hides it from that role and blocks direct links to it.
        </p>
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
