#!/usr/bin/env python3
"""Сухая проверка нового поиска клиента (основной + дополнительные телефоны).

Ничего не пишет в CRM: только запросы чтения.
  1) по сохранённым боевым телам (fixtures) — не стало ли регрессов против эталона;
  2) по всем номерам из «Журнала вебхуков» — сколько клиентов находим старым
     способом (только основное поле) и новым (основное → дополнительные).

Запуск: python3 scripts/lookup-dry-run.py
"""
import json
import subprocess
import sys
import time
import urllib.parse

CONFIG = "/root/.hermes/profiles/crm-builder/home/.twenty/config.json"
FIXTURES = "fixtures/megafon-webhooks.json"

cfg = json.load(open(CONFIG))
KEY = cfg["remotes"]["crm"]["apiKey"]
URL = cfg["remotes"]["crm"]["apiUrl"]


ERRORS: list = []
CACHE: dict = {}
LAST_CALL = [0.0]
# у REST-ключа лимит 100 запросов за 60 с (проверено 23.09) — держим ~75/мин
PAUSE = 0.8


def get(path: str, filt: str, limit: int = 5):
    """Чтение с кэшем и троттлингом; None — если запрос так и не удался."""
    cache_key = (path, filt)
    if cache_key in CACHE:
        return CACHE[cache_key]

    for attempt in range(3):
        wait = PAUSE - (time.monotonic() - LAST_CALL[0])
        if wait > 0:
            time.sleep(wait)
        result = subprocess.run(
            [
                "curl", "-s", "-m", "20", "-G",
                "--data-urlencode", f"filter={filt}",
                "--data-urlencode", f"limit={limit}",
                "-H", f"Authorization: Bearer {KEY}",
                URL + path,
            ],
            capture_output=True, text=True,
        )
        LAST_CALL[0] = time.monotonic()
        out = result.stdout
        try:
            data = json.loads(out)
        except Exception as exc:  # noqa: BLE001
            ERRORS.append(f"{filt}: {type(exc).__name__} {str(exc)[:60]} | вывод: {out[:80]!r}")
            continue
        if "messages" in data:
            message = str(data["messages"])
            if "Limit reached" in message:
                time.sleep(20)
                continue
            ERRORS.append(f"{filt}: API {message}")
            return None
        values = list(data.get("data", {}).values())
        rows = values[0] if values else []
        CACHE[cache_key] = rows
        return rows

    return None


def old_search(path: str, key: str, field: str, phone: str):
    """Как искал обработчик до правки: только основное поле."""
    rows = get(path, f'{field}.primaryPhoneNumber[eq]:"{phone}"')
    return None if rows is None else rows


def new_search(path: str, key: str, field: str, phone: str):
    """Как ищет после правки: основное поле в приоритете, иначе дополнительные."""
    rows = get(path, f'{field}.primaryPhoneNumber[eq]:"{phone}"')
    if rows is None:
        return None
    if rows:
        return rows
    return get(path, f'{field}.additionalPhones[like]:"%{phone}%"')


def digits10(value: str) -> str:
    d = "".join(ch for ch in str(value or "") if ch.isdigit())
    return d[-10:] if len(d) >= 10 else d


def lookup(search, phone: str) -> dict:
    """clientLookup: контакт → компания; несколько совпадений — неоднозначность."""
    result = {"personId": "", "companyId": "", "ambiguous": False}
    people = search("/rest/people", "people", "phones", phone)
    if people is None:
        return {"error": True}
    if len(people) > 1:
        result["ambiguous"] = True
        return result
    if len(people) == 1:
        result["personId"] = people[0]["id"]
    companies = search("/rest/companies", "companies", "telefony", phone)
    if companies is None:
        return {"error": True}
    if len(companies) == 1:
        result["companyId"] = companies[0]["id"]
    elif len(companies) > 1:
        result["ambiguous"] = True
    return result


def main() -> int:
    fixtures = json.load(open(FIXTURES, encoding="utf-8"))
    print("=== 1. Сохранённые боевые тела (эталон старого воркфлоу) ===")
    regressions = 0
    for case in fixtures:
        payload = case["payload"]
        phone = digits10(payload.get("phone"))
        if not phone:
            continue
        old = lookup(old_search, phone)
        new = lookup(new_search, phone)
        expected = case.get("expectedOldWorkflow") or {}
        marks = []
        if expected.get("personFound") and not new.get("personId"):
            marks.append("❌ регресс: контакт")
            regressions += 1
        if expected.get("companyFound") and not new.get("companyId"):
            marks.append("❌ регресс: компания")
            regressions += 1
        if old.get("personId") != new.get("personId") or old.get("companyId") != new.get("companyId"):
            marks.append(f"＋ изменение: было контакт={bool(old.get('personId'))} компания={bool(old.get('companyId'))} → стало контакт={bool(new.get('personId'))} компания={bool(new.get('companyId'))}")
        print(f"— {case['name']:26s} {phone}: {', '.join(marks) or 'без изменений'}")
    print(f"регрессов: {regressions}")

    print("\n=== 2. Номера из «Журнала вебхуков» ===")
    sql = (
        "SELECT DISTINCT klient FROM workspace_axptqwnkaqgld2rxit5apc9gl.\"_webhookLog\" "
        "WHERE klient IS NOT NULL AND klient <> ''"
    )
    dump = subprocess.run(
        ["docker", "exec", "twenty-db-1", "psql", "-U", "postgres", "-d", "default", "-t", "-A", "-c", sql],
        capture_output=True, text=True,
    ).stdout
    numbers = sorted({digits10(line) for line in dump.splitlines() if digits10(line)})

    stats = {"было": 0, "стало": 0, "новых": 0, "стало_неоднозначно": 0, "ошибок": 0}
    gained = []

    for number in numbers:
        old = lookup(old_search, number)
        new = lookup(new_search, number)
        if old.get("error") or new.get("error"):
            stats["ошибок"] += 1
            continue

        def found(res):
            return bool(res.get("personId") or res.get("companyId"))

        if found(old):
            stats["было"] += 1
        if found(new):
            stats["стало"] += 1
        if found(new) and not found(old):
            stats["новых"] += 1
            gained.append(number)
        if old.get("ambiguous") is False and new.get("ambiguous") is True:
            stats["стало_неоднозначно"] += 1

    print(f"номеров всего: {len(numbers)}")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    print(f"  примеры новых: {', '.join(gained[:12])}")
    if ERRORS:
        print(f"  причины ошибок (первые 5 из {len(ERRORS)}):")
        for line in ERRORS[:5]:
            print(f"    {line}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
