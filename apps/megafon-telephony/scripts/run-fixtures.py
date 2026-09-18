#!/usr/bin/env python3
"""Прогон сохранённых боевых вебхуков через маршрут приложения (сухой прогон).

Каждое тело из fixtures/megafon-webhooks.json отправляется на маршрут с dry_run=1,
результат разбора сравнивается с эталоном старого воркфлоу (если он сохранён).

Запуск: python3 scripts/run-fixtures.py [URL]
"""
import json
import sys
import urllib.parse
import urllib.request

URL = sys.argv[1] if len(sys.argv) > 1 else "https://crm.kplus79.ru/s/megafon"
FIXTURES = "fixtures/megafon-webhooks.json"

# эталон старого воркфлоу → поля нашего разбора
CHECKS = {
    "napravlenie": "direction",
    "itog": "outcome",
    "statusZapisi": "recordingStatus",
    "iso": "startedAtIso",
    "isoEnd": "endedAtIso",
}


def post(payload: dict) -> dict:
    data = dict(payload)
    data["dry_run"] = "1"
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(
        URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    fixtures = json.load(open(FIXTURES, encoding="utf-8"))
    failures = 0

    for case in fixtures:
        try:
            answer = post(case["payload"])
        except Exception as exc:  # noqa: BLE001
            print(f"❌ {case['name']}: ошибка запроса — {exc}")
            failures += 1
            continue

        parsed = answer.get("parsed", {})
        print(
            f"— {case['name']:26s} cmd={parsed.get('command'):8s} stage={parsed.get('stage'):10s} "
            f"dir={parsed.get('direction') or '-':8s} итог={parsed.get('outcome') or '-':8s} "
            f"запись={parsed.get('recordingStatus'):13s} {parsed.get('startedAtIso') or '-'} → "
            f"{parsed.get('endedAtIso') or '-'} ({parsed.get('durationSeconds')} c)"
        )

        expected = case.get("expectedOldWorkflow") or {}
        for old_field, new_field in CHECKS.items():
            # у хуков contact и event ВАТС не передаёт время начала — берём момент получения,
            # поэтому со эталоном старого воркфлоу время сверяем только у history
            if old_field in ("iso", "isoEnd") and case.get("cmd") != "history":
                continue

            want = str(expected.get(old_field, "") or "")
            got = str(parsed.get(new_field, "") or "")
            if want and want != got:
                print(f"    ❌ {old_field}: эталон {want!r} ≠ наш {got!r}")
                failures += 1

    print(f"\nкейсов: {len(fixtures)}, расхождений: {failures}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
