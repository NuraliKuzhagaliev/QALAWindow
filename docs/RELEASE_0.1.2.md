# QALA Window 0.1.2

Рабочий снимок `osm-2026-11-21-258b6326` собран из бесплатного экстракта Geofabrik. В нём 120 POI и 5 403 пути. Версия POI и графа совпадает. Планировщик построил маршруты с возвратом из Expo и Керуена. [Проверка снимка](../tests/evidence/osm-refresh-0.1.2.json)

Windows portable использует системную службу геолокации с разрешением для основного окна приложения. Регрессия прошла в упакованном Electron 44.11.5 с эмулированной точкой Expo. Проверка физического устройства зависит от системных разрешений и доступности координат. Этот тест также подтвердил открытие сохранённого маршрута офлайн и удаление управляемых файлов после очистки. [Windows regression](../tests/evidence/native-clear-0.1.2.json)

Статическая веб-версия использует локальный планировщик, тот же снимок и прямой бесплатный прогноз Open-Meteo. Адрес EXE и SHA256 формируются из тега GitHub Release. Веб-приложение не отправляет запросы генерации в этом режиме. Полная проверка публикации описана в [STATUS.md](../STATUS.md).

Чтобы повторить обновление, скачайте PBF и опубликованный checksum из [Geofabrik](https://download.geofabrik.de/asia/kazakhstan.html), сверяйте checksum и держите файл вне Git. Используйте Python с pyosmium и существующий проверенный снимок в качестве географической опоры:

```powershell
python scripts/data/extract-geofabrik.py .cache/osm/kazakhstan-latest.osm.pbf data/snapshots/pois.json .tmp/osm-refresh
node scripts/data/collect.mjs --staged-refresh=.tmp/osm-refresh
npx tsx scripts/data/check-refresh.ts .tmp/osm-refresh
```

Переносите boundary, POI и walking network из staging после проверки пары и предварительной резервной копии. При расхождении версий сборка останавливается. Сборщик не заменяет PBF и не изменяет действующий снимок в режиме staged-refresh.
