import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/guards";
import { getWorkspaceContext, listOrganizationMembers } from "@/services/workspace.service";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export default async function SettingsPage() {
  const session = await requireSession();
  const workspace = await getWorkspaceContext(session);
  const members = await listOrganizationMembers(workspace.organization.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, organization, and team.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Profile</CardTitle>
          <CardDescription>Personal account details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="text-sm font-medium">{workspace.user.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{workspace.user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <Badge variant="secondary">{ROLE_LABEL[workspace.role]}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Your company workspace.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Company Name</p>
            <p className="text-sm font-medium">{workspace.organization.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Workspace Slug</p>
            <p className="text-sm font-medium">{workspace.organization.slug}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
          <CardDescription>People with access to this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-md border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
                <Badge variant="secondary">{ROLE_LABEL[member.role]}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
