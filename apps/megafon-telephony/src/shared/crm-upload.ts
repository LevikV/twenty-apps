/**
 * Загрузка файла в файловое поле Twenty без клиента SDK.
 *
 * В 2.58 прежний multipart-запрос `uploadFilesFieldFile` убран, а метод
 * `uploadFile` из SDK сменил сигнатуру. Песочница логик-функций может держать
 * клиентский слой предыдущей версии, поэтому здесь тот же трёхшаговый протокол,
 * что и в мосте MAX — напрямую:
 *
 *   1. `createFileUpload` выдаёт fileId и адрес прямой загрузки;
 *   2. байты уходят PUT по этому адресу;
 *   3. `completeFileUpload` подтверждает загрузку.
 */

type Env = Record<string, string | undefined>;

const readEnv = (): Env =>
  ((globalThis as unknown as { process?: { env?: Env } }).process?.env ?? {}) as Env;

const apiBase = (): string => (readEnv().TWENTY_API_URL ?? '').replace(/\/+$/, '');

const appToken = (): string =>
  readEnv().TWENTY_APP_APPLICATION_ACCESS_TOKEN ?? readEnv().TWENTY_API_KEY ?? '';

const metadataGraphql = async <TData,>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> => {
  const response = await fetch(`${apiBase()}/metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appToken()}`,
      'Content-Type': 'application/json',
      'apollo-require-preflight': 'true',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as {
    data?: TData;
    errors?: { message?: string }[];
  };

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? `metadata: HTTP ${response.status}`);
  }

  return payload.data as TData;
};

export type UploadedFieldFile = { id: string };

export const uploadFieldFile = async ({
  bytes,
  filename,
  contentType,
  fieldMetadataUniversalIdentifier,
}: {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  fieldMetadataUniversalIdentifier: string;
}): Promise<UploadedFieldFile> => {
  const created = await metadataGraphql<{
    createFileUpload?: { fileId?: string; uploadUrl?: string; contentType?: string } | null;
  }>(
    `mutation($filename: String!, $size: Float!, $fileFolder: FileFolder!, $fieldMetadataUniversalIdentifier: String!) {
      createFileUpload(
        filename: $filename
        size: $size
        fileFolder: $fileFolder
        fieldMetadataUniversalIdentifier: $fieldMetadataUniversalIdentifier
      ) { fileId uploadUrl contentType }
    }`,
    {
      filename,
      size: bytes.byteLength,
      fileFolder: 'FilesField',
      fieldMetadataUniversalIdentifier,
    },
  );

  const target = created?.createFileUpload;

  if (!target?.fileId || !target?.uploadUrl) {
    throw new Error('CRM не выдала адрес загрузки файла');
  }

  const put = await fetch(target.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': target.contentType || contentType || 'application/octet-stream' },
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  });

  if (!put.ok) {
    throw new Error(`загрузка файла: HTTP ${put.status}`);
  }

  const done = await metadataGraphql<{
    completeFileUpload?: { id?: string } | null;
  }>(
    `mutation($fileId: String!) { completeFileUpload(fileId: $fileId) { id } }`,
    { fileId: target.fileId },
  );

  const fileId = done?.completeFileUpload?.id;

  if (!fileId) {
    throw new Error('CRM не подтвердила загрузку файла');
  }

  return { id: fileId };
};
