# Листовой материал

Учёт листового материала: приход, расход, обрезки. PWA, данные в localStorage + Supabase.

## Структура
```
index.html            разметка (без inline CSS/JS)
manifest.webmanifest  PWA-манифест
sw.js                 service worker (network-first)
assets/               logo.jpg, icon.svg, icon-512.svg
css/                  стили; порядок подключения = порядок каскада
js/                   логика; классические скрипты, порядок в index.html важен
```

## JS по файлам
| Файл | Назначение |
|---|---|
| config.js | константы, глобальное состояние |
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
