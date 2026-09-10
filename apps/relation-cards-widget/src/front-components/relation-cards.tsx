import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  getApplicationVariable,
  openSidePanelPage,
  SidePanelPages,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { Avatar } from 'twenty-ui/data-display';
import { IconCheck, IconPencil, IconPlus } from 'twenty-ui/icon';
import { Button, IconButton, SearchInput } from 'twenty-ui/input';
import { useTheme } from 'twenty-ui/theme-constants';

import {
  CARD_FIELDS_VARIABLE_KEY,
  DEFAULT_CARD_FIELDS,
  SHOW_AVATAR_VARIABLE_KEY,
  SORT_ORDER_VARIABLE_KEY,
} from 'src/constants/application-variables';
import { RELATION_CARDS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

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

type EmailsField = {
  primaryEmail?: string | null;
  additionalEmails?: string[] | null;
};

type AddressField = {
  addressStreet1?: string | null;
  addressStreet2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostcode?: string | null;
  addressCountry?: string | null;
};

type PersonRecord = {
  id: string;
  createdAt?: string | null;
  name?: FullNameField | null;
  phones?: PhonesField | null;
  emails?: EmailsField | null;
  kommentariy?: string | null;
  jobTitle?: string | null;
  adresYuridicheskiy?: AddressField | null;
  tipOtnosheniy?: string[] | null;
  avatarUrl?: string | null;
};

type PeopleResponse = {
  data?: {
    people?: PersonRecord[];
  };
};

type CreatePersonResponse = {
  data?: {
    createPerson?: {
      id?: string;
    };
  };
};

const PEOPLE_LIMIT = 200;
const PICKER_RESULT_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

const CHECKBOX_SIZE_IN_PX = 16;

const joinNonEmpty = (parts: Array<string | null | undefined>): string =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();

const getPersonName = (person: PersonRecord): string =>
  joinNonEmpty([person.name?.lastName, person.name?.firstName]) || 'Без имени';

const getPersonPhones = (person: PersonRecord): string[] => {
  const phones: string[] = [];

  if (person.phones?.primaryPhoneNumber) {
    phones.push(
      joinNonEmpty([
        person.phones.primaryPhoneCallingCode,
        person.phones.primaryPhoneNumber,
      ]),
    );
  }

  for (const additional of person.phones?.additionalPhones ?? []) {
    if (additional?.number) {
      phones.push(joinNonEmpty([additional.callingCode, additional.number]));
    }
  }

  return phones;
};

const getPersonEmails = (person: PersonRecord): string[] => {
  const emails: string[] = [];

  if (person.emails?.primaryEmail) {
    emails.push(person.emails.primaryEmail);
  }

  for (const additional of person.emails?.additionalEmails ?? []) {
    if (additional) {
      emails.push(additional);
    }
  }

  return emails;
};

const sanitizeSearchTerm = (term: string): string =>
  term.replace(/[:%,()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

const buildSearchFilter = (term: string): string => {
  const cleanTerm = sanitizeSearchTerm(term);

  if (!cleanTerm) {
    return '';
  }

  const pattern = `%${cleanTerm}%`;

  return [
    'or(',
    `name.firstName[ilike]:${pattern},`,
    `name.lastName[ilike]:${pattern},`,
    `phones.primaryPhoneNumber[ilike]:${pattern},`,
    `emails.primaryEmail[ilike]:${pattern}`,
    ')',
  ].join('');
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

  if (digits.length === 12 && digits[0] === '7') {
    return `+${digits}`;
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

const readConfiguredStringArray = (key: string): string[] | null => {
  const raw = getApplicationVariable(key) as unknown;

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item));
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // значение может быть простым списком через запятую
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const readConfiguredCardFields = (): string[] => {
  const configured = readConfiguredStringArray(CARD_FIELDS_VARIABLE_KEY);

  return configured && configured.length > 0
    ? configured
    : DEFAULT_CARD_FIELDS;
};

const readShowAvatar = (): boolean =>
  getApplicationVariable(SHOW_AVATAR_VARIABLE_KEY) !== 'false';

const readSortOrder = (): 'name' | 'newest' =>
  getApplicationVariable(SORT_ORDER_VARIABLE_KEY) === 'newest'
    ? 'newest'
    : 'name';

const getAddressLines = (address?: AddressField | null): string[] => {
  if (!address) {
    return [];
  }

  return [
    joinNonEmpty([address.addressPostcode, address.addressCity]),
    joinNonEmpty([address.addressStreet1, address.addressStreet2]),
    joinNonEmpty([address.addressState, address.addressCountry]),
  ].filter(Boolean);
};

const getMultiselectValues = (values?: string[] | null): string[] =>
  (values ?? []).filter((value): value is string => Boolean(value));

const RelationCards = () => {
  const theme = useTheme();
  const [recordId] = useSelectedRecordIds();

  const cardFields = useMemo(() => readConfiguredCardFields(), []);
  const showAvatar = useMemo(() => readShowAvatar(), []);
  const sortOrder = useMemo(() => readSortOrder(), []);

  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PersonRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const [pendingPersonIds, setPendingPersonIds] = useState<string[]>([]);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formComment, setFormComment] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);
  const insideInteractionRef = useRef(false);
  const pickerOpenedAtRef = useRef(0);

  const markInsideInteraction = useCallback(() => {
    insideInteractionRef.current = true;

    setTimeout(() => {
      insideInteractionRef.current = false;
    }, 250);
  }, []);

  const closePicker = useCallback(() => {
    setIsCreateFormOpen(false);
    setIsPickerOpen(false);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => {
      if (insideInteractionRef.current) {
        return;
      }

      if (Date.now() - pickerOpenedAtRef.current < 500) {
        return;
      }

      closePicker();
    }, 150);
  }, [closePicker]);

  const loadRelatedPeople = useCallback(async () => {
    if (!recordId) {
      setPeople([]);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await new RestApiClient().get<PeopleResponse>(
        '/rest/people',
        {
          query: {
            limit: PEOPLE_LIMIT,
            filter: `companyId[eq]:${recordId}`,
          },
        },
      );

      setPeople(response?.data?.people ?? []);
    } catch (error) {
      console.error('relation-cards: failed to load related people', error);
      setErrorMessage('Не удалось загрузить контакты');
    } finally {
      setIsLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void loadRelatedPeople();
  }, [loadRelatedPeople]);

  useEffect(() => {
    if (!isPickerOpen || !recordId) {
      return;
    }

    let isCancelled = false;

    setIsSearching(true);

    const timer = setTimeout(() => {
      const filter = buildSearchFilter(searchQuery);

      new RestApiClient()
        .get<PeopleResponse>('/rest/people', {
          query: {
            limit: PICKER_RESULT_LIMIT,
            ...(filter ? { filter } : {}),
          },
        })
        .then((response) => {
          if (!isCancelled) {
            setSearchResults(response?.data?.people ?? []);
          }
        })
        .catch((error) => {
          console.error('relation-cards: people search failed', error);

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
  }, [isPickerOpen, searchQuery, recordId, searchRefreshKey]);

  const linkedPersonIds = useMemo(
    () => new Set(people.map((person) => person.id)),
    [people],
  );

  const handleToggleLink = useCallback(
    async (person: PersonRecord) => {
      if (!recordId || pendingPersonIds.includes(person.id)) {
        return;
      }

      const isLinked = linkedPersonIds.has(person.id);

      setPendingPersonIds((previous) => [...previous, person.id]);

      try {
        await new RestApiClient().patch(`/rest/people/${person.id}`, {
          companyId: isLinked ? null : recordId,
        });

        await loadRelatedPeople();
      } catch (error) {
        console.error('relation-cards: failed to toggle link', error);
        setErrorMessage('Не удалось изменить связь');
      } finally {
        setPendingPersonIds((previous) =>
          previous.filter((id) => id !== person.id),
        );
      }
    },
    [linkedPersonIds, loadRelatedPeople, pendingPersonIds, recordId],
  );

  const openCreateForm = useCallback(() => {
    const preset = splitSearchTermIntoName(searchQuery);

    setFormFirstName(preset.firstName);
    setFormLastName(preset.lastName);
    setFormError(null);
    setIsCreateFormOpen(true);
  }, [searchQuery]);

  const closeCreateForm = useCallback(() => {
    setIsCreateFormOpen(false);
    setFormError(null);
  }, []);

  const handleOpenPerson = useCallback((personId: string) => {
    void openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      recordId: personId,
      objectNameSingular: 'person',
    });
  }, []);

  const handleCreatePerson = useCallback(async () => {
    if (!recordId || isCreating) {
      return;
    }

    const firstName = formFirstName.trim();
    const lastName = formLastName.trim();
    const phone = normalizePhone(formPhone);
    const email = formEmail.trim();
    const comment = formComment.trim();

    if (!firstName && !lastName) {
      setFormError('Укажите имя или фамилию');
      return;
    }

    setIsCreating(true);
    setFormError(null);

    try {
      await new RestApiClient().post<CreatePersonResponse>('/rest/people', {
        name: { firstName, lastName },
        ...(phone ? { phones: { primaryPhoneNumber: phone } } : {}),
        ...(email ? { emails: { primaryEmail: email } } : {}),
        ...(comment ? { kommentariy: comment } : {}),
        companyId: recordId,
      });

      setFormFirstName('');
      setFormLastName('');
      setFormPhone('');
      setFormEmail('');
      setFormComment('');
      setIsCreateFormOpen(false);

      await loadRelatedPeople();
      setSearchRefreshKey((previous) => previous + 1);

      await enqueueSnackbar({
        message: 'Контакт создан',
        variant: 'success',
      });
    } catch (error) {
      console.error('relation-cards: failed to create person', error);
      setFormError('Не удалось создать контакт (проверьте телефон и email)');
    } finally {
      setIsCreating(false);
    }
  }, [
    formComment,
    formEmail,
    formFirstName,
    formLastName,
    formPhone,
    isCreating,
    loadRelatedPeople,
    recordId,
  ]);

  const sortedPeople = useMemo(() => {
    const copy = [...people];

    if (sortOrder === 'newest') {
      return copy.sort((personA, personB) =>
        String(personB.createdAt ?? '').localeCompare(
          String(personA.createdAt ?? ''),
        ),
      );
    }

    return copy.sort((personA, personB) =>
      getPersonName(personA).localeCompare(getPersonName(personB), 'ru'),
    );
  }, [people, sortOrder]);

  const isSearchActive = sanitizeSearchTerm(searchQuery).length > 0;

  const pickerRows = useMemo(() => {
    if (isSearchActive) {
      return searchResults;
    }

    const linkedIds = new Set(people.map((person) => person.id));

    return [
      ...sortedPeople,
      ...searchResults.filter((person) => !linkedIds.has(person.id)),
    ];
  }, [isSearchActive, people, searchResults, sortedPeople]);

  const stateMessageStyle = {
    fontSize: theme.font.size.sm,
    color: theme.font.color.tertiary,
    padding: theme.spacing['3'],
  };

  const valueStyle = {
    fontSize: theme.font.size.sm,
    color: theme.font.color.secondary,
    overflowWrap: 'anywhere' as const,
  };

  const titleStyle = {
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
    color: theme.font.color.primary,
  };

  const renderCardField = (person: PersonRecord, field: string) => {
    switch (field) {
      case 'name':
        return <span style={titleStyle}>{getPersonName(person)}</span>;

      case 'phones':
        return getPersonPhones(person).map((phone, index) => (
          <span key={`phone-${index}`} style={valueStyle}>
            {phone}
          </span>
        ));

      case 'emails':
        return getPersonEmails(person).map((email, index) => (
          <span key={`email-${index}`} style={valueStyle}>
            {email}
          </span>
        ));

      case 'kommentariy':
        return person.kommentariy ? (
          <span style={{ ...valueStyle, whiteSpace: 'pre-wrap' }}>
            {person.kommentariy}
          </span>
        ) : null;

      case 'jobTitle':
        return person.jobTitle ? (
          <span style={valueStyle}>{person.jobTitle}</span>
        ) : null;

      case 'adresYuridicheskiy':
        return getAddressLines(person.adresYuridicheskiy).map((line, index) => (
          <span key={`address-${index}`} style={valueStyle}>
            {line}
          </span>
        ));

      case 'tipOtnosheniy': {
        const values = getMultiselectValues(person.tipOtnosheniy);

        return values.length > 0 ? (
          <span style={valueStyle}>{values.join(', ')}</span>
        ) : null;
      }

      default:
        return null;
    }
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

  const createRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing['2'],
    padding: `${theme.spacing['2']} ${theme.spacing['3']}`,
    cursor: 'pointer',
    color: theme.font.color.primary,
    fontSize: theme.font.size.sm,
    borderTop: `1px solid ${theme.border.color.light}`,
  };

  const renderCheckbox = (isChecked: boolean, isPending: boolean) => (
    <div
      style={{
        width: `${CHECKBOX_SIZE_IN_PX}px`,
        height: `${CHECKBOX_SIZE_IN_PX}px`,
        minWidth: `${CHECKBOX_SIZE_IN_PX}px`,
        borderRadius: '4px',
        border: `1px solid ${
          isChecked ? theme.color.blue : theme.border.color.medium
        }`,
        background: isChecked ? theme.color.blue : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isPending ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      {isChecked ? <IconCheck size={12} color="#FFFFFF" /> : null}
    </div>
  );

  const createLabel = sanitizeSearchTerm(searchQuery)
    ? `Создать «${sanitizeSearchTerm(searchQuery)}»`
    : 'Создать нового контакта';

  const renderCreateForm = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing['2'],
        padding: theme.spacing['3'],
      }}
    >
      <div style={{ fontSize: theme.font.size.sm, color: theme.font.color.secondary }}>
        Новый контакт
      </div>

      <input
        style={inputStyle}
        value={formFirstName}
        placeholder="Имя"
        onChange={(event) => setFormFirstName(event.target.value)}
      />

      <input
        style={inputStyle}
        value={formLastName}
        placeholder="Фамилия"
        onChange={(event) => setFormLastName(event.target.value)}
      />

      <input
        style={inputStyle}
        value={formPhone}
        placeholder="Телефон"
        onChange={(event) => setFormPhone(event.target.value)}
      />

      <input
        style={inputStyle}
        value={formEmail}
        placeholder="Email"
        onChange={(event) => setFormEmail(event.target.value)}
      />

      <textarea
        style={{ ...inputStyle, minHeight: '56px', resize: 'vertical' }}
        value={formComment}
        placeholder="Комментарий"
        onChange={(event) => setFormComment(event.target.value)}
      />

      {formError ? (
        <div style={{ fontSize: theme.font.size.sm, color: theme.color.red }}>
          {formError}
        </div>
      ) : null}

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
          onClick={closeCreateForm}
        />
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          position: 'relative',
          padding: `${theme.spacing['1']} 0`,
        }}
      >
        <IconButton
          Icon={IconPencil}
          size="medium"
          variant="secondary"
          accent="default"
          ariaLabel="Связать"
          disabled={!recordId}
          onClick={(event) => {
            event.stopPropagation();

            const nextIsPickerOpen = !isPickerOpen;

            if (nextIsPickerOpen) {
              pickerOpenedAtRef.current = Date.now();
            }

            setIsPickerOpen(nextIsPickerOpen);
          }}
        />

        {isPickerOpen ? (
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
        ) : null}

        {isPickerOpen ? (
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
              overflow: 'hidden',
            }}
          >
            {isCreateFormOpen ? (
              renderCreateForm()
            ) : (
              <>
                <div
                  onBlur={handleSearchBlur}
                  style={{ padding: theme.spacing['2'] }}
                >
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Имя, телефон, email"
                    autoFocus
                  />
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {isSearching && pickerRows.length === 0 ? (
                    <div style={stateMessageStyle}>Поиск…</div>
                  ) : null}

                  {!isSearching && pickerRows.length === 0 ? (
                    <div style={stateMessageStyle}>Ничего не найдено</div>
                  ) : null}

                  {pickerRows.map((person) => {
                    const isLinked = linkedPersonIds.has(person.id);
                    const isPending = pendingPersonIds.includes(person.id);
                    const personName = getPersonName(person);
                    const phones = getPersonPhones(person);
                    const emails = getPersonEmails(person);
                    const hint = [phones[0], emails[0]]
                      .filter(Boolean)
                      .join(' • ');

                    return (
                      <div
                        key={person.id}
                        onClick={() => {
                          void handleToggleLink(person);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: theme.spacing['2'],
                          padding: `${theme.spacing['2']} ${theme.spacing['3']}`,
                          borderBottom: `1px solid ${theme.border.color.light}`,
                          cursor: isPending ? 'default' : 'pointer',
                        }}
                      >
                        {renderCheckbox(isLinked, isPending)}

                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <span
                            style={{
                              fontSize: theme.font.size.sm,
                              color: theme.font.color.primary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {personName}
                          </span>

                          {hint ? (
                            <span
                              style={{
                                fontSize: theme.font.size.xs,
                                color: theme.font.color.tertiary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {hint}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div onClick={openCreateForm} style={createRowStyle}>
                  <IconPlus size={16} />
                  <span>{createLabel}</span>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {isLoading ? <div style={stateMessageStyle}>Загрузка…</div> : null}

      {!isLoading && errorMessage ? (
        <div style={stateMessageStyle}>{errorMessage}</div>
      ) : null}

      {!isLoading && !errorMessage && sortedPeople.length === 0 ? (
        <div style={stateMessageStyle}>Нет связанных контактов</div>
      ) : null}

      {!isLoading && !errorMessage && sortedPeople.length > 0
        ? sortedPeople.map((person) => (
            <div
              key={person.id}
              onClick={() => {
                closePicker();
                handleOpenPerson(person.id);
              }}
              onMouseEnter={() => setHoveredPersonId(person.id)}
              onMouseLeave={() =>
                setHoveredPersonId((previous) =>
                  previous === person.id ? null : previous,
                )
              }
              style={{
                display: 'flex',
                gap: theme.spacing['3'],
                padding: `${theme.spacing['2']} ${theme.spacing['1']}`,
                borderBottom: `1px solid ${theme.border.color.light}`,
                cursor: 'pointer',
                borderRadius: theme.border.radius.sm,
                background:
                  hoveredPersonId === person.id
                    ? theme.background.transparent.light
                    : 'transparent',
              }}
            >
              {showAvatar ? (
                <Avatar
                  size="md"
                  placeholder={getPersonName(person)}
                  placeholderColorSeed={person.id}
                  avatarUrl={person.avatarUrl ?? undefined}
                />
              ) : null}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.spacing['1'],
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {cardFields.map((field) => (
                  <Fragment key={field}>
                    {renderCardField(person, field)}
                  </Fragment>
                ))}
              </div>
            </div>
          ))
        : null}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: RELATION_CARDS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Контактные лица',
  description: 'Связанные записи в виде карточек с выбранными полями',
  component: RelationCards,
});
