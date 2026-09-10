import { useEffect, useMemo, useState } from 'react';

import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { Avatar } from 'twenty-ui/data-display';
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

const RelationCards = () => {
  const theme = useTheme();
  const [recordId] = useSelectedRecordIds();

  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) {
      setPeople([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    setIsLoading(true);
    setErrorMessage(null);

    new RestApiClient()
      .get<PeopleResponse>('/rest/people', {
        query: {
          limit: PEOPLE_LIMIT,
          filter: `companyId[eq]:${recordId}`,
        },
      })
      .then((response) => {
        if (!isCancelled) {
          setPeople(response?.data?.people ?? []);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setErrorMessage('Не удалось загрузить контакты');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [recordId]);

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

  if (isLoading) {
    return <div style={stateMessageStyle}>Загрузка…</div>;
  }

  if (errorMessage) {
    return <div style={stateMessageStyle}>{errorMessage}</div>;
  }

  if (sortedPeople.length === 0) {
    return <div style={stateMessageStyle}>Нет связанных контактов</div>;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {sortedPeople.map((person) => {
        const personName = getPersonName(person);
        const phones = getPersonPhones(person);
        const emails = getPersonEmails(person);

        const valueStyle = {
          fontSize: theme.font.size.sm,
          color: theme.font.color.secondary,
          overflowWrap: 'anywhere' as const,
        };

        return (
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
              placeholder={personName}
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
                {personName}
              </span>

              {phones.map((phone, index) => (
                <span key={`phone-${index}`} style={valueStyle}>
                  {phone}
                </span>
              ))}

              {emails.map((email, index) => (
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
        );
      })}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: RELATION_CARDS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Карточки связей',
  description: 'Связанные записи в виде карточек с выбранными полями',
  component: RelationCards,
});
