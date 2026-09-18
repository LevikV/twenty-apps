#!/usr/bin/env python3
"""Сквозные проверки этапа 1 (подшаг 1.7).

Отправляет на боевой маршрут выбранные сохранённые тела ВАТС, подменяя `callid`
на тестовый, и печатает ответ приложения. Ничего боевого не трогает.
"""
import json
import sys
import urllib.parse
import urllib.request

URL = next((a for a in sys.argv[1:] if not a.startswith("--")), "https://crm.kplus79.ru/s/megafon")
FIXTURES = "fixtures/megafon-webhooks.json"

CASES = json.load(open(FIXTURES))
BY_NAME = {c["name"]: c for c in CASES}


def send(name: str, callid: str) -> dict:
    body = dict(BY_NAME[name]["payload"])
    body["callid"] = callid
    data = urllib.parse.urlencode(body).encode()
    req = urllib.request.Request(
        URL, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        answer = json.loads(response.read().decode("utf-8", "replace"))

    print(
        f"  {name:26s} → action={answer.get('action'):8s} callId={answer.get('callId') or '—'}"
        f" log={answer.get('logId') or '—'} errors={answer.get('errors') or '—'}"
    )

    return answer


print("1. полный цикл: contact → event → history (KPTEST-CYC-1)")
send("contact", "KPTEST-CYC-1")
send("event-INCOMING", "KPTEST-CYC-1")
send("history-INCOMING-ANSWERED", "KPTEST-CYC-1")

print("2. повторный хук того же звонка (должен быть updated, не второй звонок)")
send("history-INCOMING-ANSWERED", "KPTEST-CYC-1")

print("3. только history, без начала звонка — пропущенный входящий (KPTEST-ONLY-1)")
send("history-INCOMING-MISSED", "KPTEST-ONLY-1")

print("4. не дозвонились: исходящий без записи (KPTEST-MISS-1)")
send("history-OUTGOING", "KPTEST-MISS-1")

print("5. отменённый звонок + итог (KPTEST-CANCEL-1)")
send("event-CANCELLED", "KPTEST-CANCEL-1")
send("history-in-missed", "KPTEST-CANCEL-1")
