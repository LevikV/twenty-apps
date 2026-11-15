/**
 * Загрузка файла вложения в Twenty из логик-функции.
 *
 * Фронт-компонент не умеет писать файловые поля сам: у него только токен
 * приложения, а не пользователя. Поэтому файл приходит сюда в base64, а
 * загрузку в хранилище делает приложение (тот же путь, что у моста MAX:
 * GraphQL-мутация uploadFilesFieldFile в /metadata).
 *
 * Идентификатор файлового поля ищем по именам, а не держим в константе:
 * в другом рабочем пространстве при установке шаблона он будет свой.
 */

type Env = Record<string, string | undefined>;

const readEnv = (): Env =>
  ((globalThis as unknown as { process?: { env?: Env } }).process?.env ?? {}) as Env;

const apiBase = (): string => (readEnv().TWENTY_API_URL ?? '').replace(/\/+$/, '');

const appToken = (): string => {
  const env = readEnv();

  return env.TWENTY_APP_APPLICATION_ACCESS_TOKEN ?? env.TWENTY_API_KEY ?? '';
};

/** Запрос к схеме метаданных: у неё свой адрес (/metadata), не /graphql. */
const metadataGraphql = async <TData,>(query: string): Promise<TData> => {
  const response = await fetch(`${apiBase()}/metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const payload = (await response.json()) as { data?: TData; errors?: { message: string }[] };

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? `GraphQL ${response.status}`);
  }

  return payload.data as TData;
};

/** Идентификатор поля «Вложение» у сообщения (кэшируется на процесс). */
let cachedFieldId = '';

const attachmentFieldId = async (): Promise<string> => {
  if (cachedFieldId) return cachedFieldId;

  const data = await metadataGraphql<{
    objects: { edges: { node: { nameSingular: string; fields: { edges: { node: { id: string; name: string } }[] } } }[] };
  }>(
    `query {
      objects(paging: { first: 200 }) {
        edges {
          node {
            nameSingular
            fields(paging: { first: 200 }) {
              edges { node { id name } }
            }
          }
        }
      }
    }`,
  );

  const object = data.objects.edges
    .map((edge) => edge.node)
    .find((node) => node.nameSingular === 'soobshchenie');

  const field = object?.fields.edges
    .map((edge) => edge.node)
    .find((node) => node.name === 'vlozhenie');

  if (!field?.id) throw new Error('не найдено поле «Вложение» у сообщения');

  cachedFieldId = field.id;

  return cachedFieldId;
};

/**
 * Загрузить файл и вернуть то, что нужно записать в поле вложения:
 * `{ fileId, label }`.
 */
export const uploadAttachment = async (
  name: string,
  mime: string,
  content: string,
): Promise<{ fileId: string; label: string }> => {
  const safeName = name.trim() || 'файл';
  const fieldMetadataId = await attachmentFieldId();

  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const form = new FormData();

  form.append(
    'operations',
    JSON.stringify({
      query:
        'mutation($file: Upload!, $fieldMetadataId: String!) { uploadFilesFieldFile(file: $file, fieldMetadataId: $fieldMetadataId) { id } }',
      variables: { file: null, fieldMetadataId },
    }),
  );
  form.append('map', JSON.stringify({ '0': ['variables.file'] }));
  form.append('0', new Blob([bytes], { type: mime || 'application/octet-stream' }), safeName);

  const response = await fetch(`${apiBase()}/metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appToken()}`,
      'apollo-require-preflight': 'true',
    },
    body: form,
  });

  const payload = (await response.json()) as {
    data?: { uploadFilesFieldFile?: { id?: string } };
    errors?: { message: string }[];
  };

  const fileId = payload.data?.uploadFilesFieldFile?.id;

  if (!fileId) {
    throw new Error(payload.errors?.[0]?.message ?? 'файл не загрузился');
  }

  return { fileId, label: safeName };
};
