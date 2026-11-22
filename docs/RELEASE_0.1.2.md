# QALA Window 0.1.2

Рабочий снимок `osm-2026-11-21-258b6326` собран из бесплатного экстракта Geofabrik. В нём 120 POI и 5 403 пути. Версия POI и графа совпадает. Планировщик построил маршруты с возвратом из Expo и Керуена. [Проверка снимка](../tests/evidence/osm-refresh-0.1.2.json)

Windows portable использует системную службу геолокации с разрешением для основного окна приложения. Регрессия прошла в упакованном Electron 44.11.5 с эмулированной точкой Expo. Проверка физического устройства зависит от системных разрешений и доступности координат. Этот тест также подтвердил открытие сохранённого маршрута офлайн и удаление управляемых файлов после очистки. [Windows regression](../tests/evidence/native-clear-0.1.2.json)

[Сайт GitHub Pages](https://nuralikuzhagaliev.github.io/QALAWindow/) использует локальный планировщик, тот же снимок и прямой бесплатный прогноз Open-Meteo. Адрес EXE и SHA256 формируются из тега GitHub Release. Браузерный сценарий с маршрутом и прогнозом прошёл без входа или запросов генерации. [Проверка публикации](../tests/evidence/github-pages-0.1.2.json)

| Проверка | Результат |
|---|---|
| Сборка, линтинг, типы | Прошли |
| Автоматическая регрессия | [80/80 тестов](../tests/evidence/deterministic-0.1.2.tap) |
| Точный Windows portable | [Запуск, версия 0.1.2 и маршрут офлайн](../tests/evidence/portable-launch-0.1.2.json) |
| Скачивание с локального сайта | [113 719 467 байт, совпадающий SHA256](../tests/evidence/download-0.1.2-local.json) |
| Статический сайт | [Проверка по пути /QALAWindow/, снимок, маршрут, погода и 390 px](../tests/evidence/static-web-0.1.2-local.json) |
| GitHub | [Публичный релиз v0.1.2](https://github.com/NuraliKuzhagaliev/QALAWindow/releases/tag/v0.1.2), SHA256 пяти загруженных файлов совпали |
| Публичный сайт | [Маршрут, прогноз и мобильный экран в браузере без входа](../tests/evidence/static-web-0.1.2-public.json) |
| Публичное скачивание EXE | [113 719 467 байт без входа. SHA256 совпал с опубликованным и локальным](../tests/evidence/download-0.1.2-public.json) |

Windows EXE не подписан. Сохранённые маршруты сохраняют формат версии 1. Предыдущая Windows-сборка 0.1.1 осталась в локальном каталоге выпуска.

Чтобы повторить обновление, скачайте PBF и опубликованный checksum из [Geofabrik](https://download.geofabrik.de/asia/kazakhstan.html), сверяйте checksum и держите файл вне Git. Используйте Python с pyosmium и существующий проверенный снимок в качестве географической опоры:

```powershell
python scripts/data/extract-geofabrik.py .cache/osm/kazakhstan-latest.osm.pbf data/snapshots/pois.json .tmp/osm-refresh
node scripts/data/collect.mjs --staged-refresh=.tmp/osm-refresh
npx tsx scripts/data/check-refresh.ts .tmp/osm-refresh
```

Переносите boundary, POI и walking network из staging после проверки пары и предварительной резервной копии. При расхождении версий сборка останавливается. Сборщик не заменяет PBF и не изменяет действующий снимок в режиме staged-refresh.
