import { ActionButton } from "@/components/action-button";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { RoleBadge } from "@/components/badges";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Time } from "@/components/time";
import { setUserActiveAction, updateUserRoleAction } from "@/lib/actions/users";
import { ROLES, ROLE_LABEL } from "@/lib/constants";
import type { UserSummary } from "@/lib/users";

/**
 * User administration table. Role changes apply immediately on selection; the
 * server rejects self-demotion and removal of the last admin regardless of what
 * the client sends.
 */
export function UserTable({
  users,
  currentUserId,
}: {
  users: UserSummary[];
  currentUserId: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left text-[13px]">
          <caption className="sr-only">People with access to the support desk</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 pl-4 pr-3 font-medium">
                Person
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Role
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Access
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Manage
              </th>
              <th scope="col" className="hidden py-2 pr-4 text-right font-medium sm:table-cell">
                Added
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;

              return (
                <tr key={user.id} className="border-t border-line align-top">
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="font-medium">
                      {user.name}
                      {isSelf ? (
                        <span className="ml-1.5 text-[10px] font-normal text-muted">
                          (you)
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-muted">{user.email}</div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">
                        Reset password
                      </summary>
                      <ResetPasswordForm userId={user.id} name={user.name} />
                    </details>
                  </td>

                  <td className="py-2.5 pr-3">
                    {isSelf ? (
                      <RoleBadge role={user.role} />
                    ) : (
                      <AutoSubmitForm
                        action={updateUserRoleAction}
                        hiddenFields={{ userId: user.id }}
                      >
                        <select
                          name="value"
                          defaultValue={user.role}
                          aria-label={`Role for ${user.name}`}
                          className="input input-sm w-32"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                      </AutoSubmitForm>
                    )}
                  </td>

                  <td className="py-2.5 pr-3">
                    <span className={user.isActive ? "badge badge-emerald" : "badge badge-zinc"}>
                      {user.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>

                  <td className="py-2.5 pr-3">
                    {isSelf ? (
                      <span className="text-[11px] text-muted">—</span>
                    ) : user.isActive ? (
                      <ActionButton
                        action={setUserActiveAction}
                        fields={{ userId: user.id, value: "inactive" }}
                        label="Deactivate"
                        pendingLabel="Saving…"
                        className="btn btn-ghost btn-sm"
                      />
                    ) : (
                      <ActionButton
                        action={setUserActiveAction}
                        fields={{ userId: user.id, value: "active" }}
                        label="Reactivate"
                        pendingLabel="Saving…"
                        className="btn btn-secondary btn-sm"
                      />
                    )}
                  </td>

                  <td className="hidden whitespace-nowrap py-2.5 pr-4 text-right text-[11px] text-muted sm:table-cell">
                    <Time value={user.createdAt} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
