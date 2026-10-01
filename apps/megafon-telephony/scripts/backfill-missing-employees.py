#!/usr/bin/env python3
"""Починка сотрудника у звонков, которые прошли в период поломки поиска.

Пока у пользователя воркспейса было удалено поле `memberPosition` (30.09–01.10.2026),
обработчик не мог найти сотрудника: фильтр по несуществующему полю давал 400, и участник
не ставился вовсе. Здесь добиваем пропущенного сотрудника у таких звонков.

Правила поиска — те же, что в приложении (`employee-lookup.ts`):
  1. карточка «Сотрудник» по телефону (основной + дополнительные);
  2. резерв: рабочий телефон должности → единственный сотрудник должности;
  3. страховка: телефон пользователя CRM.

По умолчанию — сухой прогон (только чтение). Запись: `--live`.
Запуск: python3 scripts/backfill-missing-employees.py [--live]
"""
import json
import re
import subprocess
import sys
from collections import defaultdict

SEP = "\x1f"
SCHEMA = "workspace_axptqwnkaqgld2rxit5apc9gl"
CONFIG = "/root/.hermes/profiles/crm-builder/home/.twenty/config.json"
LIVE = "--live" in sys.argv

cfg = json.load(open(CONFIG))
KEY = cfg["remotes"]["crm"]["apiKey"]
URL = cfg["remotes"]["crm"]["apiUrl"]


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
    seen = []
    for block in re.findall(r"\d{10,}", str(raw_json or "")):
        key = digits10(block)
        if key and key not in seen:
            seen.append(key)
    return seen


# --- справочники (как в приложении) --------------------------------------

employees_by_phone = defaultdict(set)
employee_info = {}          # id карточки -> {"name", "member"}
employees_of_position = defaultdict(set)

for emp_id, last, first, primary, extra_json, position_id, member_id in q(f"""
SELECT s.id::text, coalesce(s."fioLastName", ''), coalesce(s."fioFirstName", ''),
       coalesce(s."telefonPrimaryPhoneNumber", ''),
       coalesce(s."telefonAdditionalPhones"::text, '[]'),
       coalesce(s."dolzhnostId"::text, ''),
       coalesce(wm.id::text, '')
FROM {SCHEMA}."_sotrudnik" s
LEFT JOIN {SCHEMA}."workspaceMember" wm
       ON wm."sotrudnikId" = s.id AND wm."deletedAt" IS NULL
WHERE s."deletedAt" IS NULL;
"""):
    employee_info[emp_id] = {"name": f"{last} {first}".strip(), "member": member_id}
    if position_id:
        employees_of_position[position_id].add(emp_id)
    for raw in [primary] + extra_digits(extra_json):
        key = digits10(raw)
        if key:
            employees_by_phone[key].add(emp_id)

positions_by_phone = defaultdict(set)
for position_id, phone in q(f"""
SELECT id::text,
       coalesce(right(regexp_replace(coalesce("workPhonePrimaryPhoneNumber", ''), '\\D', '', 'g'), 10), '')
FROM {SCHEMA}."_position" WHERE "deletedAt" IS NULL;
"""):
    if phone:
        positions_by_phone[phone].add(position_id)

members_by_phone = {}
for member_id, primary, extra_json in q(f"""
SELECT id::text, coalesce("telefonPrimaryPhoneNumber", ''),
       coalesce("telefonAdditionalPhones"::text, '[]')
FROM {SCHEMA}."workspaceMember" WHERE "deletedAt" IS NULL;
"""):
    for raw in [primary] + extra_digits(extra_json):
        key = digits10(raw)
        if key:
            members_by_phone.setdefault(key, member_id)


def resolve_employee(our_number):
    """{"name", "member", "source"} или None — той же цепочкой, что в приложении."""
    phone = digits10(our_number)
    if not phone:
        return None

    employees = employees_by_phone.get(phone, set())
    if len(employees) == 1:
        info = employee_info[next(iter(employees))]
        return {"name": info["name"], "member": info["member"], "source": "сотрудник"}

    if len(employees) > 1:
        return None

    positions = positions_by_phone.get(phone, set())
    if len(positions) == 1:
        staff = employees_of_position.get(next(iter(positions)), set())
        if len(staff) == 1:
            info = employee_info[next(iter(staff))]
            return {"name": info["name"], "member": info["member"], "source": "должность"}

    member = members_by_phone.get(phone, "")
    if member:
        return {"name": "", "member": member, "source": "телефон"}

    return None


# --- звонки, журнал и текущие участники ----------------------------------

our_numbers = {}
for uid, nash in q(f"""
SELECT uid, coalesce("nashNomer", '')
FROM {SCHEMA}."_webhookLog"
WHERE "deletedAt" IS NULL AND uid IS NOT NULL AND uid <> '' AND coalesce("nashNomer", '') <> ''
ORDER BY "createdAt";
"""):
    our_numbers[uid] = nash  # последняя запись по uid — самая свежая

have_employee = set()
for (event_id,) in [(row[0],) for row in q(f"""
SELECT DISTINCT "calendarEventId"::text FROM {SCHEMA}."calendarEventParticipant"
WHERE "deletedAt" IS NULL AND "workspaceMemberId" IS NOT NULL;
""")]:
    have_employee.add(event_id)

calls = q(f"""
SELECT r.id::text, coalesce(r."externalRecordingId", ''), coalesce(r.title, ''),
       coalesce(r."calendarEventId"::text, ''), r."createdAt"::text
FROM {SCHEMA}."callRecording" r
WHERE r."deletedAt" IS NULL AND r."calendarEventId" IS NOT NULL
ORDER BY r."createdAt";
""")

# --- разбор ---------------------------------------------------------------

targets = []
skipped_no_log = 0
skipped_no_employee = 0
stats = defaultdict(int)

for call_id, uid, title, event_id, created_at in calls:
    if event_id in have_employee:
        continue

    our = our_numbers.get(uid, "")
    if not our:
        skipped_no_log += 1
        continue

    found = resolve_employee(our)
    if not found:
        skipped_no_employee += 1
        continue

    targets.append({
        "callId": call_id,
        "eventId": event_id,
        "title": title,
        "ourNumber": our,
        "name": found["name"],
        "member": found["member"],
        "source": found["source"],
        "createdAt": created_at,
    })
    stats[f"{found['name'] or found['member']} ({found['source']})"] += 1

print("Починка сотрудника у звонков без участника-сотрудника")
print(f"режим: {'БОЕВОЙ (запись)' if LIVE else 'сухой прогон (без записи)'}\n")
print(f"Звонков всего:                 {len(calls)}")
print(f"  уже есть сотрудник:          {len(have_employee)}")
print(f"  без журнала (наш номер не определить): {skipped_no_log}")
print(f"  журнал есть, сотрудник не находится:   {skipped_no_employee}")
print(f"  К ПОЧИНКЕ:                   {len(targets)}\n")

if stats:
    print("Кому достанется звонок:")
    for who, count in sorted(stats.items(), key=lambda item: -item[1]):
        print(f"  {who}: {count}")
    print()

for row in targets[:15]:
    print(f"  {row['createdAt'][:16]}  {row['title'][:44]:44s} наш {row['ourNumber']} → {row['name']}")
if len(targets) > 15:
    print(f"  … и ещё {len(targets) - 15}")

if not LIVE:
    print("\nНичего не изменено. Запись — с флагом --live.")
    raise SystemExit(0)

# --- запись ---------------------------------------------------------------

import time
import urllib.error
import urllib.request


def post(path: str, body: dict) -> tuple[bool, str]:
    request = urllib.request.Request(
        URL + path,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return 200 <= response.status < 300, ""
    except urllib.error.HTTPError as exc:
        return False, f"HTTP {exc.code}: {exc.read().decode()[:200]}"
    except Exception as exc:  # noqa: BLE001
        return False, f"{type(exc).__name__}: {exc}"


created = 0
errors = []

for index, row in enumerate(targets, start=1):
    body = {
        "calendarEventId": row["eventId"],
        "displayName": row["name"] or "",
        "isOrganizer": True,
        "responseStatus": "ACCEPTED",
    }
    if row["member"]:
        body["workspaceMemberId"] = row["member"]

    ok, error = post("/rest/calendarEventParticipants", body)
    if ok:
        created += 1
    else:
        errors.append(f"{row['title']}: {error}")

    if index % 10 == 0 or index == len(targets):
        print(f"  обработано {index}/{len(targets)}, создано {created}, ошибок {len(errors)}")

    time.sleep(0.8)  # лимит REST — 100 запросов в минуту

print(f"\nГотово: создано участников {created}, ошибок {len(errors)}")
for error in errors[:10]:
    print("  ❌ " + error)
