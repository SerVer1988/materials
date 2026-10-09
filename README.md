# Листовой материал

Учёт листового материала: приход, расход, обрезки. PWA, данные в localStorage + Supabase.

## Структура
```
index.html            разметка (без inline CSS/JS)
manifest.webmanifest  PWA-манифест
sw.js                 service worker (network-first)
assets/               logo.jpg, icon.svg, icon-512.svg
css/                  стили; themes.css (палитры) подключается первым, порядок = каскад
js/                   логика; классические скрипты, порядок в index.html важен
```

## JS по файлам
| Файл | Назначение |
|---|---|
| config.js | константы, глобальное состояние |
| theme-init.js | ставит тему до отрисовки (в `<head>`), по умолчанию светлая |
| theme.js | переключатель темы в настройках, хранится в localStorage `lm7_theme` |
| ui.js | toast, confirm, подсветка строк |
| sync.js | Supabase: merge, push/pull |
| access.js | код доступа |
| storage.js | save/load, ключи кусков |
| crud.js | renderAll, del |
| init.js | init, миграции, селекты |
| autocomplete.js | автокомплит |
| navigation.js | вкладки, свайпы, панели |
| search.js | поиск по приходу/расходу/складу |
| stock.js | склад, остатки, фильтры |
| place-filter.js | раскрывающийся фильтр «Место» для прихода, расхода, листов и обрезок |
| scrap-calc.js | расчёт обрезков, превью |
| income.js / expense.js | приход / расход |
| remainders.js | обрезки: список, правка, фильтры |
| scrap-modals.js | модалки обрезков |
| selection.js | выделение и перемещение |
| history.js | история |
| export.js | Excel/JSON, импорт |
| lists.js | справочники |
| pwa.js | регистрация SW, баннер установки |
| main.js | точка входа, **всегда последним** |

Модули ES не используются: в разметке inline `onclick`, функции должны быть глобальными.

## Темы
Все цвета интерфейса — переменные в `css/themes.css` (`light` / `dark`). В остальных css, html и js используйте только `var(--...)`, не hex.
Для жёлтого **текста** — `var(--accent-ink)`, для фонов — `var(--accent)`.
