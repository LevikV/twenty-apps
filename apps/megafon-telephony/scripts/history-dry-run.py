#!/usr/bin/env python3
"""Сухой прогон по истории звонков: что даст приведение к формату приложения.

Считает по тем же правилам, что и приложение (crm-lookup.ts):
  контакт по телефону (1 совпадение) → компания через «Контакт клиента»
  (ровно одна связь) → резерв: компания по телефону; несколько связей — не гадаем.
  Наш сотрудник (30.09.2026): карточка «Сотрудник» по телефону → резерв: рабочий
  телефон должности → единственный сотрудник должности → страховка: телефон
  пользователя CRM.

Ничего не меняет: только читает базу и печатает отчёт.
"""

import re
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


def extra_digits(raw_json) -> list[str]:
    """Дополнительные телефоны из RAW_JSON: `[{"number": "4262275910"}]` → 10 цифр."""
    seen = []
    for block in re.findall(r"\d{10,}", str(raw_json or "")):
        key = digits10(block)
        if key and key not in seen:
            seen.append(key)
    return seen


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

# Контакты и компании: как в приложении (crm-lookup.ts) — **основное поле в приоритете**,
# дополнительные смотрим только если основное не дало совпадений. Иначе номер, продублированный
# в чужой карточке как дополнительный, дал бы ложную «неоднозначность».
persons_primary = defaultdict(list)
persons_extra = defaultdict(list)
person_name = {}
for pid, last, first, primary, extra_json in q(f"""
SELECT id, coalesce("nameLastName", ''), coalesce("nameFirstName", ''),
       coalesce("phonesPrimaryPhoneNumber", ''),
       coalesce("phonesAdditionalPhones"::text, '[]')
FROM {SCHEMA}.person WHERE "deletedAt" IS NULL;
"""):
    person_name[pid] = f"{last} {first}".strip()
    key = digits10(primary)
    if key:
        persons_primary[key].append(pid)
    for key in extra_digits(extra_json):
        persons_extra[key].append(pid)

companies_primary = defaultdict(list)
companies_extra = defaultdict(list)
company_name = {}
for cid, name, primary, extra_json in q(f"""
SELECT id, coalesce(name, ''),
       coalesce("telefonyPrimaryPhoneNumber", ''),
       coalesce("telefonyAdditionalPhones"::text, '[]')
FROM {SCHEMA}.company WHERE "deletedAt" IS NULL;
"""):
    company_name[cid] = name
    key = digits10(primary)
    if key:
        companies_primary[key].append(cid)
    for key in extra_digits(extra_json):
        companies_extra[key].append(cid)

members_by_phone = defaultdict(set)
for member_id, phone in q(f"""
SELECT id::text, coalesce(right(regexp_replace(coalesce("telefonPrimaryPhoneNumber", ''), '\\D', '', 'g'), 10), '')
FROM {SCHEMA}."workspaceMember" WHERE "deletedAt" IS NULL;
"""):
    if phone:
        members_by_phone[phone].add(member_id)

# Карточки «Сотрудник» — новое место телефона: телефон (основной + дополнительные),
# должность и пользователь CRM. Той же цепочкой ходит приложение.
employees_by_phone = defaultdict(set)      # 10 цифр -> {id карточки «Сотрудник»}
employee_member = {}                       # id карточки -> workspaceMemberId ('')
employees_of_position = defaultdict(set)   # id должности -> {id карточки}

for emp_id, primary, extra_json, position_id, member_id in q(f"""
SELECT s.id::text,
       coalesce(s."telefonPrimaryPhoneNumber", ''),
       coalesce(s."telefonAdditionalPhones"::text, '[]'),
       coalesce(s."dolzhnostId"::text, ''),
       coalesce(wm.id::text, '')
FROM {SCHEMA}."_sotrudnik" s
LEFT JOIN {SCHEMA}."workspaceMember" wm
       ON wm."sotrudnikId" = s.id AND wm."deletedAt" IS NULL
WHERE s."deletedAt" IS NULL;
"""):
    employee_member[emp_id] = member_id
    if position_id:
        employees_of_position[position_id].add(emp_id)
    for raw in [primary] + re.findall(r"\d{10,}", extra_json):
        key = digits10(raw)
        if key:
            employees_by_phone[key].add(emp_id)

positions_by_phone = defaultdict(set)      # рабочий телефон должности -> {id должности}
for position_id, phone in q(f"""
SELECT id::text,
       coalesce(right(regexp_replace(coalesce("workPhonePrimaryPhoneNumber", ''), '\\D', '', 'g'), 10), '')
FROM {SCHEMA}."_position" WHERE "deletedAt" IS NULL;
"""):
    if phone:
        positions_by_phone[phone].add(position_id)


def resolve_member(our_phone):
    """Сотрудник по нашему номеру — той же цепочкой, что в приложении.

    1. карточка «Сотрудник» по телефону (основной + дополнительные);
    2. резерв: рабочий телефон должности → единственный сотрудник должности;
    3. страховка: личный телефон пользователя CRM.
    Пусто — если совпадений нет или их несколько (не гадаем).
    """
    phone = digits10(our_phone)
    if not phone:
        return ""

    employees = employees_by_phone.get(phone, set())
    if len(employees) == 1:
        return employee_member.get(next(iter(employees)), "")

    if len(employees) > 1:
        return ""

    positions = positions_by_phone.get(phone, set())
    if len(positions) == 1:
        staff = employees_of_position.get(next(iter(positions)), set())
        if len(staff) == 1:
            return employee_member.get(next(iter(staff)), "")
        return ""

    if len(positions) > 1:
        return ""

    return members_by_phone.get(phone, "")

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

    found = persons_primary.get(phone) or persons_extra.get(phone) or []

    if len(found) > 1:
        # несколько контактов — не гадаем; компанию тоже не ищем (как в приложении)
        ambiguous = True
    else:
        if found:
            person_id = found[0]

        phone_companies = companies_primary.get(phone) or companies_extra.get(phone) or []

        if len(phone_companies) == 1:
            company_id = phone_companies[0]
            company_source = "телефон компании"
        elif len(phone_companies) > 1:
            ambiguous = True

    member_id = resolve_member(our_phone)

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
