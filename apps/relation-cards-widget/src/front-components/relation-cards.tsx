import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { Avatar } from 'twenty-ui/data-display';
import { IconCheck, IconPencil } from 'twenty-ui/icon';
import { Button, SearchInput } from 'twenty-ui/input';
import { useTheme } from 'twenty-ui/theme-constants';

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

type PersonRecord = {
  id: string;
  name?: FullNameField | null;
  phones?: PhonesField | null;
  emails?: EmailsField | null;
  kommentariy?: string | null;
  avatarUrl?: string | null;
};

type PeopleResponse = {
  data?: {
    people?: PersonRecord[];
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

const RelationCards = () => {
  const theme = useTheme();
  const [recordId] = useSelectedRecordIds();

  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PersonRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingPersonIds, setPendingPersonIds] = useState<string[]>([]);

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
  }, [isPickerOpen, searchQuery, recordId]);

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

  const sortedPeople = useMemo(
    () =>
      [...people].sort((personA, personB) =>
        getPersonName(personA).localeCompare(getPersonName(personB), 'ru'),
      ),
    [people],
  );

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
        <Button
          title="Связать"
          Icon={IconPencil}
          size="small"
          variant="secondary"
          disabled={!recordId}
          onClick={() => setIsPickerOpen((isOpen) => !isOpen)}
        />

        {isPickerOpen ? (
          <div
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
            <div style={{ padding: theme.spacing['2'] }}>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Имя, телефон, email"
                autoFocus
              />
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {isSearching && searchResults.length === 0 ? (
                <div style={stateMessageStyle}>Поиск…</div>
              ) : null}

              {!isSearching && searchResults.length === 0 ? (
                <div style={stateMessageStyle}>Ничего не найдено</div>
              ) : null}

              {searchResults.map((person) => {
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
              style={{
                display: 'flex',
                gap: theme.spacing['3'],
                padding: `${theme.spacing['2']} ${theme.spacing['1']}`,
                borderBottom: `1px solid ${theme.border.color.light}`,
              }}
            >
              <Avatar
                size="md"
                placeholder={getPersonName(person)}
                placeholderColorSeed={person.id}
                avatarUrl={person.avatarUrl ?? undefined}
              />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.spacing['1'],
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span
                  style={{
                    fontSize: theme.font.size.md,
                    fontWeight: theme.font.weight.medium,
                    color: theme.font.color.primary,
                  }}
                >
                  {getPersonName(person)}
                </span>

                {getPersonPhones(person).map((phone, index) => (
                  <span key={`phone-${index}`} style={valueStyle}>
                    {phone}
                  </span>
                ))}

                {getPersonEmails(person).map((email, index) => (
                  <span key={`email-${index}`} style={valueStyle}>
                    {email}
                  </span>
                ))}

                {person.kommentariy ? (
                  <span style={{ ...valueStyle, whiteSpace: 'pre-wrap' }}>
                    {person.kommentariy}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        : null}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: RELATION_CARDS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Карточки связей',
  description: 'Связанные записи в виде карточек с выбранными полями',
  component: RelationCards,
});
