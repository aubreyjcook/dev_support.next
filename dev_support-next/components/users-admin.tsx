import { CreateUserForm } from "@/components/create-user-form";
import { UserTable } from "@/components/user-table";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/users";

/** Admin-only user management. Rendered inside a Suspense boundary by the page. */
export async function UsersAdmin() {
  const admin = await requireAdmin();
  const users = listUsers();

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">Add a person</h2>
          <p className="text-[11px] text-muted">
            They can sign in immediately with the password you set. Share it out of
            band and ask them to change it.
          </p>
        </div>
        <div className="p-4">
          <CreateUserForm />
        </div>
      </section>

      <UserTable users={users} currentUserId={admin.id} />
    </div>
  );
}
