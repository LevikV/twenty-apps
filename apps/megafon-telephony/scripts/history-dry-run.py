#!/usr/bin/env python3
"""Сухой прогон по истории звонков: что даст приведение к формату приложения.

Считает по тем же правилам, что и приложение (crm-lookup.ts):
  контакт по телефону (1 совпадение) → компания через «Контакт клиента»
  (ровно одна связь) → резерв: компания по телефону; несколько связей — не гадаем.

Ничего не меняет: только читает базу и печатает отчёт.
"""

import subprocess
import sys
from collections import defaultdict

SEP = "\x1f"
SCHEMA = "workspace_axptqwnkaqgld2rxit5apc9gl"


def q(sql: str) -> list[list[str]]:
    result = subprocess.run(
        ["docker", "exec", "-i", "twenty-db-1", "psql", "-U", "postgres", "-d", "default",
         "-t", "-A", "-F", SEP],
        input=sql, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("ОШИБКА ЗАПРОСА:\n" + result.stderr[:800], file=sys.stderr)
        sys.exit(1)
    return [line.split(SEP) for line in result.stdout.splitlines() if line.strip()]


def digits10(value) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else ""


# --- данные -------------------------------------------------------------

calls = q(f"""
SELECT r.id, coalesce(r."externalRecordingId", ''), coalesce(r.title, ''),
       coalesce(r."createdBySource"::text, ''), r."createdAt"::text
FROM {SCHEMA}."callRecording" r
WHERE r."deletedAt" IS NULL
ORDER BY r."createdAt";
""")

# телефон клиента и наш номер — из журнала вебхуков по UID звонка
phones = {}
for uid, raw_phone, our_phone in q(f"""
SELECT uid,
       coalesce(right(regexp_replace(coalesce("dannye"::json->>'phone', ''), '\\D', '', 'g'), 10), ''),
       coalesce(regexp_replace(coalesce("nashNomer", ''), '\\D', '', 'g'), '')
FROM {SCHEMA}."_webhookLog"
WHERE "deletedAt" IS NULL AND uid IS NOT NULL AND uid <> ''
  AND coalesce("dannye"::json->>'phone', '') <> ''
ORDER BY "createdAt" DESC;
"""):
    phones.setdefault(uid, (raw_phone, our_phone))

persons_by_phone = defaultdict(list)
person_name = {}
for pid, last, first, phone in q(f"""
SELECT id, coalesce("nameLastName", ''), coalesce("nameFirstName", ''),
       coalesce(right(regexp_replace(coalesce("phonesPrimaryPhoneNumber", ''), '\\D', '', 'g'), 10), '')
FROM {SCHEMA}.person WHERE "deletedAt" IS NULL;
"""):
    person_name[pid] = f"{last} {first}".strip()
    if phone:
        persons_by_phone[phone].append(pid)

companies_by_phone = defaultdict(list)
company_name = {}
for cid, name, phone in q(f"""
SELECT id, coalesce(name, ''),
       coalesce(right(regexp_replace(coalesce("telefonyPrimaryPhoneNumber", ''), '\\D', '', 'g'), 10), '')
FROM {SCHEMA}.company WHERE "deletedAt" IS NULL;
"""):
    company_name[cid] = name
    if phone:
        companies_by_phone[phone].append(cid)

companies_of_person = defaultdict(set)
for person_id, company_id in q(f"""
SELECT "kontaktnoeLicoId"::text, coalesce("klientCompanyId"::text, '')
FROM {SCHEMA}."_kontaktKlienta" WHERE "deletedAt" IS NULL;
"""):
    if company_id:
        companies_of_person[person_id].add(company_id)

members_by_phone = defaultdict(set)
for member_id, phone in q(f"""
SELECT wm.id::text, coalesce(right(regexp_replace(coalesce(p."workPhonePrimaryPhoneNumber", ''), '\\D', '', 'g'), 10), '')
FROM {SCHEMA}."workspaceMember" wm
LEFT JOIN {SCHEMA}."_position" p ON p.id = wm."memberPositionId"
WHERE wm."deletedAt" IS NULL;
"""):
    if phone:
        members_by_phone[phone].add(member_id)

for member_id, phone in q(f"""
SELECT id::text, coalesce(right(regexp_replace(coalesce("telefonPrimaryPhoneNumber", ''), '\\D', '', 'g'), 10), '')
FROM {SCHEMA}."workspaceMember" WHERE "deletedAt" IS NULL;
"""):
    if phone:
        members_by_phone[phone].add(member_id)

links = {}
for call_id, company_id, person_id, member_id in q(f"""
SELECT r.id::text, coalesce(tgt."targetCompanyId"::text, ''),
       coalesce(tgt."targetPersonId"::text, ''), coalesce(p."workspaceMemberId"::text, '')
FROM {SCHEMA}."callRecording" r
LEFT JOIN {SCHEMA}."calendarEventTarget" tgt
       ON tgt."calendarEventId" = r."calendarEventId" AND tgt."deletedAt" IS NULL
LEFT JOIN {SCHEMA}."calendarEventParticipant" p
       ON p."calendarEventId" = r."calendarEventId" AND p."deletedAt" IS NULL
WHERE r."deletedAt" IS NULL;
"""):
    current = links.setdefault(call_id, {"company": set(), "person": set(), "member": set()})
    if company_id:
        current["company"].add(company_id)
    if person_id:
        current["person"].add(person_id)
    if member_id:
        current["member"].add(member_id)

timeline_for_call = defaultdict(set)
for record_id, company_id in q(f"""
SELECT coalesce("linkedRecordId"::text, ''), coalesce("targetCompanyId"::text, '')
FROM {SCHEMA}."timelineActivity"
WHERE "deletedAt" IS NULL AND "linkedRecordId" IS NOT NULL;
"""):
    if company_id:
        timeline_for_call[record_id].add(company_id)

# --- прогон правил ------------------------------------------------------

stats = defaultdict(int)
by_source = defaultdict(lambda: defaultdict(int))
examples = defaultdict(list)
new_timeline = set()

for call_id, uid, title, source, created_at in calls:
    stats["всего"] += 1
    by_source[source]["всего"] += 1

    raw_phone, our_phone = phones.get(uid, ("", ""))
    phone = digits10(raw_phone)

    if not phone:
        # у записей приложения в журнале не заполнен uid — номер берём из заголовка
        phone = digits10(title)

    if not phone:
        stats["без номера клиента"] += 1
        by_source[source]["без номера клиента"] += 1
        continue

    person_id = ""
    company_id = ""
    company_source = ""
    ambiguous = False

    found = persons_by_phone.get(phone, [])

    if len(found) == 1:
        person_id = found[0]
        companies = companies_of_person.get(person_id, set())
        if len(companies) == 1:
            company_id = next(iter(companies))
            company_source = "связь «Контакт клиента»"
        elif len(companies) > 1:
            ambiguous = True
        else:
            phone_companies = companies_by_phone.get(phone, [])
            if len(phone_companies) == 1:
                company_id = phone_companies[0]
                company_source = "телефон компании"
            elif len(phone_companies) > 1:
                ambiguous = True
    elif len(found) > 1:
        ambiguous = True
    else:
        phone_companies = companies_by_phone.get(phone, [])
        if len(phone_companies) == 1:
            company_id = phone_companies[0]
            company_source = "телефон компании"
        elif len(phone_companies) > 1:
            ambiguous = True

    member_id = next(iter(members_by_phone.get(digits10(our_phone), set())), "")

    stats["контакт найден"] += 1 if person_id else 0
    stats["компания найдена"] += 1 if company_id else 0
    stats["неоднозначно"] += 1 if ambiguous else 0
    stats["ничего не найдено"] += 1 if not person_id and not company_id and not ambiguous else 0
    stats["сотрудник найден"] += 1 if member_id else 0
    by_source[source]["компания найдена"] += 1 if company_id else 0

    current = links.get(call_id, {"company": set(), "person": set(), "member": set()})

    need_target = (person_id and person_id not in current["person"]) or (
        company_id and company_id not in current["company"]
    )
    need_member = bool(member_id) and member_id not in current["member"]

    stats["связей к добавлению"] += 1 if need_target else 0
    stats["сотрудников к добавлению"] += 1 if need_member else 0

    if company_id and company_id not in timeline_for_call.get(call_id, set()):
        new_timeline.add(call_id)
        stats["лент к добавлению"] += 1

    if len(examples["компания"]) < 8 and company_id:
        examples["компания"].append(
            f"  {title} → {company_name.get(company_id, '?')} ({company_source})"
        )
    if len(examples["неоднозначно"]) < 5 and ambiguous:
        examples["неоднозначно"].append(f"  {title} → номер {phone}")
    if len(examples["мимо"]) < 5 and not company_id and not person_id and not ambiguous:
        examples["мимо"].append(f"  {title} → номер {phone}")

# --- отчёт --------------------------------------------------------------

print("Сухой прогон по истории звонков (ничего не менялось)\n")
print(f"Звонков всего: {stats['всего']}")
for source, values in sorted(by_source.items()):
    print(f"  {source}: {values['всего']}, из них компания нашлась у {values['компания найдена']}")

print("\nЧто даст приведение к формату приложения:")
print(f"  контакт находится:            {stats['контакт найден']}")
print(f"  компания находится:           {stats['компания найдена']}")
print(f"  неоднозначно (не трогаем):    {stats['неоднозначно']}")
print(f"  вообще не находится:          {stats['ничего не найдено']}")
print(f"  без номера клиента:           {stats['без номера клиента']}")
print(f"  наш сотрудник находится:      {stats['сотрудник найден']}")
print()
print(f"  связей к добавлению:          {stats['связей к добавлению']}")
print(f"  сотрудников к добавлению:     {stats['сотрудников к добавлению']}")
print(f"  записей в лентах компаний:    {stats['лент к добавлению']}")

for key, header in (("компания", "Примеры: компания определилась"),
                    ("неоднозначно", "Примеры: неоднозначные — не привязываем"),
                    ("мимо", "Примеры: ни контакта, ни компании")):
    if examples[key]:
        print(f"\n{header}:")
        print("\n".join(examples[key]))
