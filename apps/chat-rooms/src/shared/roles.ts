import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RestApiClient } from 'twenty-client-sdk/rest';

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

const rest = () => new RestApiClient({ runAs: 'application' });

const recordOf = (body: unknown, key: string): Record<string, unknown> | null => {
  const row = (body as { data?: Record<string, unknown> })?.data?.[key];

  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
};

/**
 * Может ли сотрудник менять связи сообщения.
 *
 * Автор сообщения — само собой. Но переписку ведут и через канал: входящее
 * SMS и отправка из карточки созданы приложением, у них автора-сотрудника нет.
 * Поэтому владелец канала этого диалога тоже может менять связи, как и админ.
 */
export const canManageMessage = async (params: {
  memberId: string;
  authorId: string;
  chatId: string;
}): Promise<boolean> => {
  const { memberId, authorId, chatId } = params;

  if (!memberId) return false;
  if (authorId && authorId === memberId) return true;
  if (await isAdmin(memberId)) return true;

  if (!chatId) return false;

  try {
    const client = rest();
    const chat = recordOf(
      await client.get<unknown>(`/rest/chats/${chatId}`, { query: { select: 'id,shlyuzId' } }),
      'chat',
    );
    const gatewayId = String(chat?.shlyuzId ?? '');

    if (!gatewayId) return false;

    const gateway = recordOf(
      await client.get<unknown>(`/rest/smsGateways/${gatewayId}`, {
        query: { select: 'id,sotrudnikId' },
      }),
      'smsGateway',
    );

    return String(gateway?.sotrudnikId ?? '') === memberId;
  } catch {
    return false;
  }
};
