# Twenty Apps — Монорепо приложений Kplus79

Приложения на Twenty TypeScript SDK для CRM https://crm.kplus79.ru.

## Структура

```
twenty-apps/
├── apps/                    # отдельные приложения
│   ├── telefon/             # телефония (ВАТС Мегафон)
│   ├── call-widget/         # виджет звонков
│   └── ...                  # будущие приложения
├── shared/                  # общие утилиты, типы, компоненты
└── README.md
```

## Быстрый старт

```bash
# Создать новое приложение
cd apps
npx create-twenty-app@latest my-app --url https://crm.kplus79.ru --display-name "My App"

# Деплой
cd my-app
yarn twenty remote:add --url https://crm.kplus79.ru --api-key <key>
yarn twenty apply
yarn twenty dev        # watch mode
```

## Приложения

| Приложение | Тип | Статус |
|---|---|---|
| `telefon` | App | Планируется |
| `call-widget` | Front Component | Планируется |
