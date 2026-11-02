import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { IconTrash } from 'twenty-ui/icon';
import { Button, IconButton, SearchInput } from 'twenty-ui/input';
import { useTheme } from 'twenty-ui/theme-constants';

import { RELATION_CARDS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { callRoute } from './api';

/**
 * Контактные лица контрагента.
 *
 * Один виджет на две карточки:
 *  • компания — её контактные лица (записи связи, владелец = эта компания);
 *  • контакт — два блока: его собственные контактные лица и места, где он сам
 *    используется как контактное лицо.
 *
 * Работает через объект связи `kontaktKlienta` (поля `klientCompany` /
 * `klientPerson` / `kontaktnoeLico`), а не через нативное `person.companyId`.
 * Менять владельца у существующей связи нельзя: перенос — только удалить и создать.
 */

type FullNameField = {
  firstName?: string | null;
  lastName?: string | null;
};

type PhonesField = {
  primaryPhoneNumber?: string | null;
  primaryPhoneCallingCode?: string | null;
  additionalPhones?: Array<{
    number?: string | null;
    callingCode?: string | null;
  }> | null;
};

type PersonLite = {
  id: string;
  name?: FullNameField | null;
  phones?: PhonesField | null;
  jobTitle?: string | null;
};

type LinkRecord = {
  id: string;
  name?: string | null;
  dolzhnost?: string | null;
  objectGuid?: string | null;
  klientCompanyId?: string | null;
  klientPersonId?: string | null;
  kontaktnoeLicoId?: string | null;
};

type LinksResponse = {
  data?: {
    kontaktyKlientov?: LinkRecord[];
  };
};

type PeopleResponse = {
  data?: {
    people?: PersonLite[];
  };
};

type CreatePersonResponse = {
  data?: {
    createPerson?: {
      id?: string;
    };
  };
};

type CompaniesResponse = {
  data?: {
    companies?: Array<{ id: string; name?: string | null }>;
  };
};

type Mode = 'company' | 'person' | 'unknown';
type PickerKind = 'contact' | 'owner';

const LIMIT = 200;
const PICKER_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

const joinNonEmpty = (parts: Array<string | null | undefined>): string =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();

const getPersonName = (person?: PersonLite | null): string =>
  joinNonEmpty([person?.name?.lastName, person?.name?.firstName]) || 'Без имени';

const getPersonPhones = (person?: PersonLite | null): string[] => {
  const phones: string[] = [];

  if (person?.phones?.primaryPhoneNumber) {
    phones.push(
      joinNonEmpty([
        person.phones.primaryPhoneCallingCode,
        person.phones.primaryPhoneNumber,
      ]),
    );
  }

  for (const additional of person?.phones?.additionalPhones ?? []) {
    if (additional?.number) {
      phones.push(joinNonEmpty([additional.callingCode, additional.number]));
    }
  }

  return phones;
};

const sanitizeSearchTerm = (term: string): string =>
  term.replace(/[:%,()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

const buildPeopleSearchFilter = (term: string): string => {
  const cleanTerm = sanitizeSearchTerm(term);

  if (!cleanTerm) {
    return '';
  }

  const pattern = `%${cleanTerm}%`;

  return [
    'or(',
    `name.firstName[ilike]:${pattern},`,
    `name.lastName[ilike]:${pattern},`,
    `phones.primaryPhoneNumber[ilike]:${pattern}`,
    ')',
  ].join('');
};

const buildCompanySearchFilter = (term: string): string => {
  const cleanTerm = sanitizeSearchTerm(term);

  if (!cleanTerm) {
    return '';
  }

  return `name[ilike]:%${cleanTerm}%`;
};

const normalizePhone = (raw: string): string => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  return trimmed;
};

const splitSearchTermIntoName = (
  term: string,
): { firstName: string; lastName: string } => {
  const parts = term.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return { firstName: parts.slice(1).join(' '), lastName: parts[0] };
};

const ContactPersons = () => {
  const theme = useTheme();
  const [recordId] = useSelectedRecordIds();

  const [mode, setMode] = useState<Mode>('unknown');
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [usage, setUsage] = useState<LinkRecord[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonLite>>({});
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const [pickerKind, setPickerKind] = useState<PickerKind | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; title: string; subtitle: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const pickerOpenedAtRef = useRef(0);
  const insideInteractionRef = useRef(false);

  const closePicker = useCallback(() => {
    setPickerKind(null);
    setIsCreateFormOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const markInsideInteraction = useCallback(() => {
    insideInteractionRef.current = true;

    setTimeout(() => {
      insideInteractionRef.current = false;
    }, 250);
  }, []);

  const loadAll = useCallback(async () => {
    if (!recordId) {
      setMode('unknown');
      setLinks([]);
      setUsage([]);

      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Читаем через маршрут приложения: роль пользователя может не иметь
      // доступа к служебному объекту связей, а контактные лица видеть должна.
      const data = await callRoute<{
        isCompany: boolean;
        links: LinkRecord[];
        usage: LinkRecord[];
        persons: Record<string, PersonLite>;
        ownerNames: Record<string, string>;
      }>(`/relation-cards-data?recordId=${encodeURIComponent(recordId)}`);

      setMode(data.isCompany ? 'company' : 'person');
      setLinks(data.links ?? []);
      setUsage(data.usage ?? []);
      setPersons(data.persons ?? {});
      setOwnerNames(data.ownerNames ?? {});
    } catch (error) {
      console.error('contact-persons: load failed', error);
      setErrorMessage('Не удалось загрузить контактные лица');
    } finally {
      setIsLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!pickerKind) {
      return;
    }

    let isCancelled = false;

    setIsSearching(true);

    const timer = setTimeout(() => {
      const api = new RestApiClient();

      const request =
        pickerKind === 'contact'
          ? (() => {
              const filter = buildPeopleSearchFilter(searchQuery);

              return api
                .get<PeopleResponse>('/rest/people', {
                  query: {
                    limit: PICKER_LIMIT,
                    select: 'id,name,phones,jobTitle',
                    ...(filter ? { filter } : {}),
                  },
                })
                .then((response) =>
                  (response?.data?.people ?? []).map((person) => ({
                    id: person.id,
                    title: getPersonName(person),
                    subtitle: getPersonPhones(person)[0] ?? '',
                  })),
                );
            })()
          : (() => {
              const filter = buildCompanySearchFilter(searchQuery);

              return api
                .get<CompaniesResponse>('/rest/companies', {
                  query: {
                    limit: PICKER_LIMIT,
                    select: 'id,name',
                    ...(filter ? { filter } : {}),
                  },
                })
                .then((response) =>
                  (response?.data?.companies ?? []).map((company) => ({
                    id: company.id,
                    title: String(company.name ?? '').trim() || 'Без названия',
                    subtitle: '',
                  })),
                );
            })();

      request
        .then((rows) => {
          if (!isCancelled) {
            setSearchResults(rows);
          }
        })
        .catch((error) => {
          console.error('contact-persons: search failed', error);

          if (!isCancelled) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [pickerKind, searchQuery, refreshKey]);

  const openPicker = useCallback(
    (kind: PickerKind) => {
      pickerOpenedAtRef.current = Date.now();
      setPickerKind(kind);
      setSearchQuery('');
      setSearchResults([]);
      setIsCreateFormOpen(false);
    },
    [],
  );

  const linkedContactIds = useMemo(
    () =>
      new Set(
        links
          .map((link) => String(link.kontaktnoeLicoId ?? ''))
          .filter(Boolean),
      ),
    [links],
  );

  const linkedOwnerIds = useMemo(
    () =>
      new Set(
        usage.map((link) =>
          String(link.klientCompanyId ?? link.klientPersonId ?? ''),
        ),
      ),
    [usage],
  );

  const addContactLink = useCallback(
    async (personId: string) => {
      if (!recordId) {
        return;
      }

      await callRoute('/relation-cards-add', {
        method: 'POST',
        body: { mode, recordId, personId },
      });
      await loadAll();
    },
    [loadAll, mode, recordId],
  );

  const handlePick = useCallback(
    async (id: string) => {
      if (pendingIds.includes(id)) {
        return;
      }

      setPendingIds((previous) => [...previous, id]);

      try {
        if (pickerKind === 'owner') {
          if (!recordId) {
            return;
          }

          await callRoute('/relation-cards-add', {
            method: 'POST',
            body: { companyId: id, personId: recordId },
          });

          await loadAll();
        } else if (linkedContactIds.has(id)) {
          // уже в списке — второй раз не связываем
        } else {
          await addContactLink(id);
        }

        closePicker();
      } catch (error) {
        console.error('contact-persons: failed to add link', error);

        await enqueueSnackbar({
          message: 'Не удалось добавить связь',
          variant: 'error',
        });
      } finally {
        setPendingIds((previous) =>
          previous.filter((pendingId) => pendingId !== id),
        );
      }
    },
    [
      addContactLink,
      closePicker,
      linkedContactIds,
      pendingIds,
      pickerKind,
      recordId,
      loadAll,
    ],
  );

  const handleRemove = useCallback(
    async (link: LinkRecord) => {
      if (pendingIds.includes(link.id)) {
        return;
      }

      setPendingIds((previous) => [...previous, link.id]);

      try {
        await callRoute('/relation-cards-remove', {
          method: 'POST',
          body: { linkId: link.id },
        });
        await loadAll();

        await enqueueSnackbar({
          message: 'Контактное лицо убрано',
          variant: 'success',
        });
      } catch (error) {
        console.error('contact-persons: failed to remove link', error);

        await enqueueSnackbar({
          message: 'Не удалось убрать связь',
          variant: 'error',
        });
      } finally {
        setPendingIds((previous) =>
          previous.filter((pendingId) => pendingId !== link.id),
        );
      }
    },
    [loadAll, pendingIds],
  );

  const handleCreatePerson = useCallback(async () => {
    const firstName = formFirstName.trim();
    const lastName = formLastName.trim();
    const phone = normalizePhone(formPhone);

    if (!firstName && !lastName) {
      return;
    }

    setIsCreating(true);

    try {
      const created = await callRoute<{ personId?: string }>('/relation-cards-add', {
        method: 'POST',
        body: {
          mode,
          recordId,
          newPerson: { firstName, lastName, phone },
        },
      });

      if (!created?.personId) {
        await loadAll();
      }

      setFormFirstName('');
      setFormLastName('');
      setFormPhone('');
      setIsCreateFormOpen(false);
      closePicker();

      await enqueueSnackbar({
        message: 'Контакт создан',
        variant: 'success',
      });
    } catch (error) {
      console.error('contact-persons: create person failed', error);

      await enqueueSnackbar({
        message: 'Не удалось создать контакт',
        variant: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  }, [addContactLink, closePicker, formFirstName, formLastName, formPhone, loadAll]);

  const linkRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing['2'],
    padding: `${theme.spacing['1']} 0`,
    borderBottom: `1px solid ${theme.border.color.light}`,
  };

  const mutedStyle = {
    fontSize: theme.font.size.xs,
    color: theme.font.color.light,
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing['2'],
    paddingBottom: theme.spacing['1'],
  };

  const titleStyle = {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
    color: theme.font.color.primary,
  };

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: `${theme.spacing['1']} ${theme.spacing['2']}`,
    borderRadius: theme.border.radius.sm,
    border: `1px solid ${theme.border.color.medium}`,
    background: theme.background.primary,
    color: theme.font.color.primary,
    fontSize: theme.font.size.sm,
    fontFamily: 'inherit',
    outline: 'none',
  };

  const renderPicker = () => {
    if (!pickerKind) {
      return null;
    }

    const createTerm = searchQuery.trim();
    const preset = splitSearchTermIntoName(createTerm);
    const canCreate =
      pickerKind === 'contact' &&
      createTerm.length > 1 &&
      !searchResults.some(
        (row) => row.title.toLowerCase() === createTerm.toLowerCase(),
      );

    return (
      <>
        <div
          onClick={closePicker}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9,
            background: 'transparent',
          }}
        />

        <div
          onClick={(event) => event.stopPropagation()}
          onMouseDown={markInsideInteraction}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: '320px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            background: theme.background.primary,
            border: `1px solid ${theme.border.color.medium}`,
            borderRadius: theme.border.radius.md,
            boxShadow: theme.boxShadow.strong,
            padding: theme.spacing['2'],
            gap: theme.spacing['1'],
          }}
        >
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={
              pickerKind === 'contact' ? 'Имя или телефон' : 'Название компании'
            }
            autoFocus
          />

          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {isSearching && searchResults.length === 0 ? (
              <div style={{ ...mutedStyle, padding: theme.spacing['1'] }}>
                Поиск…
              </div>
            ) : null}

            {searchResults.map((row) => {
              const isLinked =
                pickerKind === 'contact'
                  ? linkedContactIds.has(row.id)
                  : linkedOwnerIds.has(row.id);

              return (
                <button
                  key={row.id}
                  type="button"
                  disabled={isLinked}
                  onClick={() => {
                    if (!isLinked) {
                      void handlePick(row.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    padding: `${theme.spacing['1']} ${theme.spacing['2']}`,
                    border: 'none',
                    borderRadius: theme.border.radius.sm,
                    background: 'transparent',
                    cursor: isLinked ? 'default' : 'pointer',
                    opacity: isLinked ? 0.5 : 1,
                    textAlign: 'left' as const,
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.font.size.sm,
                      color: theme.font.color.primary,
                    }}
                  >
                    {row.title}
                  </span>

                  {row.subtitle ? (
                    <span style={mutedStyle}>{row.subtitle}</span>
                  ) : null}
                </button>
              );
            })}

            {!isSearching && searchResults.length === 0 && !isCreateFormOpen ? (
              <div style={{ ...mutedStyle, padding: theme.spacing['1'] }}>
                Ничего не найдено
              </div>
            ) : null}
          </div>

          {canCreate && !isCreateFormOpen ? (
            <Button
              title={`+ Создать «${createTerm}»`}
              size="small"
              variant="secondary"
              onClick={() => {
                setFormFirstName(preset.firstName);
                setFormLastName(preset.lastName);
                setFormPhone(/^[\d+\-\s()]+$/.test(createTerm) ? createTerm : '');
                setIsCreateFormOpen(true);
              }}
            />
          ) : null}

          {isCreateFormOpen ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing['1'],
              }}
            >
              <input
                style={inputStyle}
                value={formLastName}
                placeholder="Фамилия"
                onChange={(event) => setFormLastName(event.target.value)}
              />
              <input
                style={inputStyle}
                value={formFirstName}
                placeholder="Имя"
                onChange={(event) => setFormFirstName(event.target.value)}
              />
              <input
                style={inputStyle}
                value={formPhone}
                placeholder="Телефон"
                onChange={(event) => setFormPhone(event.target.value)}
              />

              <div style={{ display: 'flex', gap: theme.spacing['2'] }}>
                <Button
                  title={isCreating ? 'Создание…' : 'Создать'}
                  size="small"
                  variant="primary"
                  disabled={isCreating}
                  onClick={() => {
                    void handleCreatePerson();
                  }}
                />

                <Button
                  title="Отмена"
                  size="small"
                  variant="secondary"
                  disabled={isCreating}
                  onClick={() => setIsCreateFormOpen(false)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </>
    );
  };

  const renderBlockHeader = (title: string, kind: PickerKind) => (
    <div style={headerStyle}>
      <span style={titleStyle}>{title}</span>

      <Button
        title="Добавить"
        size="small"
        variant="secondary"
        disabled={!recordId}
        onClick={(event) => {
          event.stopPropagation();

          if (pickerKind === kind) {
            closePicker();
          } else {
            openPicker(kind);
          }
        }}
      />
    </div>
  );

  const renderLinkRow = (link: LinkRecord, showOwner: boolean) => {
    const person = persons[String(link.kontaktnoeLicoId ?? '')];
    const personName = person ? getPersonName(person) : String(link.name ?? '').trim() || 'Без имени';
    const phones = getPersonPhones(person);
    const ownerId = String(link.klientCompanyId ?? link.klientPersonId ?? '');
    const ownerName = showOwner ? ownerNames[ownerId] ?? '' : '';

    return (
      <div key={link.id} style={linkRowStyle}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: theme.font.size.sm,
              color: theme.font.color.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {personName}
          </span>

          {ownerName ? (
            <span style={mutedStyle}>{ownerName}</span>
          ) : null}

          {phones.length > 0 ? (
            <span style={mutedStyle}>{phones.join(', ')}</span>
          ) : null}
        </div>

        <IconButton
          Icon={IconTrash}
          size="small"
          variant="secondary"
          accent="default"
          ariaLabel="Убрать"
          disabled={pendingIds.includes(link.id)}
          onClick={(event) => {
            event.stopPropagation();
            void handleRemove(link);
          }}
        />
      </div>
    );
  };

  if (!recordId) {
    return null;
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        gap: theme.spacing['3'],
      }}
    >
      {errorMessage ? (
        <div style={{ fontSize: theme.font.size.sm, color: theme.color.red }}>
          {errorMessage}
        </div>
      ) : null}

      {isLoading && links.length === 0 && usage.length === 0 ? (
        <div style={mutedStyle}>Загрузка…</div>
      ) : null}

      {mode !== 'unknown' ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {renderBlockHeader('Контактные лица', 'contact')}

          {links.length === 0 && !isLoading ? (
            <div style={{ ...mutedStyle, padding: `${theme.spacing['1']} 0` }}>
              Пока никого нет
            </div>
          ) : null}

          {links.map((link) => renderLinkRow(link, false))}

          {pickerKind === 'contact' ? renderPicker() : null}
        </div>
      ) : null}

      {mode === 'person' ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {renderBlockHeader('Используется как контактное лицо', 'owner')}

          {usage.length === 0 && !isLoading ? (
            <div style={{ ...mutedStyle, padding: `${theme.spacing['1']} 0` }}>
              Ни у кого не указан
            </div>
          ) : null}

          {usage.map((link) => renderLinkRow(link, true))}

          {pickerKind === 'owner' ? renderPicker() : null}
        </div>
      ) : null}

    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: RELATION_CARDS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Контактные лица',
  description:
    'Контактные лица контрагента: список, добавление и удаление связей',
  component: ContactPersons,
});
