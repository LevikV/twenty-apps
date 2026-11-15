/**
 * Ссылка на файл вложения с настоящим именем.
 *
 * Twenty отдаёт файл по адресу с uuid и не передаёт имя: оно хранится только
 * в подписи вложения (label). Имя уходит параметром `filename`, а nginx
 * превращает его в Content-Disposition (см. /etc/nginx/conf.d/crm-file-names.conf),
 * поэтому браузер сохраняет «соглашение.docx», а не набор символов.
 *
 * PDF открываем в браузере (disp=inline), остальное скачиваем.
 */
export const fileHref = (url: string, label: string): string => {
  const name = label || 'файл';
  const disposition = /\.pdf$/i.test(name) ? 'inline' : 'attachment';
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}filename=${encodeURIComponent(name)}&disp=${disposition}`;
};
