import { MetadataApiClient } from 'twenty-client-sdk/metadata';

/**
 * Проверка роли «Администратор» для текущего сотрудника.
 *
 * Приложение работает от своей роли, поэтому права сотрудника надо смотреть
 * отдельно. Роль в Twenty назначается на пользователя рабочего пространства,
 * а в контексте маршрута есть только идентификатор участника — поэтому берём
 * список участников из метаданных роли.
 */
export const isAdmin = async (memberId: string): Promise<boolean> => {
  if (!memberId) return false;

  try {
    const metadata = new MetadataApiClient();
    const result = await metadata.query({
      getRoles: {
        id: true,
        label: true,
        workspaceMembers: { id: true },
      },
    });

    const roles = (result?.getRoles ?? []) as {
      label?: string | null;
      workspaceMembers?: { id?: string | null }[];
    }[];

    const admin = roles.find((role) => String(role.label ?? '').toLowerCase() === 'admin');

    return (admin?.workspaceMembers ?? []).some((member) => String(member.id ?? '') === memberId);
  } catch {
    return false;
  }
};
