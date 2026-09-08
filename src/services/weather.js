import { cfg } from '../lib/config.js';
import { getDb } from '../lib/db.js';
import { log, safeErr } from '../lib/log.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const TTL_MS = 10 * 60 * 1000;

const regions = ['Київ', 'Вінниця', 'Луцьк', 'Дніпро', 'Донецьк', 'Житомир', 'Ужгород', 'Запоріжжя', 'Івано-Франківськ', 'Кропивницький', 'Луганськ', 'Львів', 'Миколаїв', 'Одеса', 'Полтава', 'Рівне', 'Суми', 'Тернопіль', 'Харків', 'Херсон', 'Хмельницький', 'Черкаси', 'Чернівці', 'Чернігів'];

function codeText(code) {
  const c = Number(code);
  if ([0].includes(c)) return 'ясно';
  if ([1, 2, 3].includes(c)) return 'мінлива хмарність';
  if ([45, 48].includes(c)) return 'туман';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(c)) return 'дощ';
  if ([71, 73, 75, 77, 85, 86].includes(c)) return 'сніг';
  if ([95, 96, 99].includes(c)) return 'гроза';
  return 'дані погодного коду';
}

async function cached(key, loader) {
  const db = await getDb(cfg.MONGODB_URI);
  const now = new Date();
  if (db) {
    try {
      const hit = await db.collection('weatherCache').findOne({ provider: 'open-meteo', locationKey: key.locationKey, dataType: key.dataType, expiresAt: { $gt: now } });
      if (hit?.payload) return hit.payload;
    } catch (err) {
      log.error('db read failed', { collection: 'weatherCache', operation: 'findOne', err: safeErr(err) });
    }
  }
  const payload = await loader();
  if (db) {
    try {
      await db.collection('weatherCache').updateOne(
        { provider: 'open-meteo', locationKey: key.locationKey, dataType: key.dataType },
        { $setOnInsert: { createdAt: now }, $set: { payload, source: 'Open-Meteo', fetchedAt: now, expiresAt: new Date(Date.now() + TTL_MS), updatedAt: now } },
        { upsert: true }
      );
    } catch (err) {
      log.error('db write failed', { collection: 'weatherCache', operation: 'updateOne', err: safeErr(err) });
    }
  }
  return payload;
}

export async function geocodeCity(city) {
  const name = String(city || cfg.DEFAULT_CITY).trim().slice(0, 80);
  const url = GEO + '?name=' + encodeURIComponent(name) + '&count=1&language=uk&format=json&countryCode=UA';
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Не вдалося знайти місто');
  const json = await response.json();
  const item = json?.results?.[0];
  if (!item) throw new Error('Місто не знайдено');
  return { name: item.name, region: item.admin1 || '', latitude: item.latitude, longitude: item.longitude };
}

export async function getWeather(city) {
  const geo = await geocodeCity(city);
  return cached({ locationKey: geo.name, dataType: 'weather' }, async () => {
    const params = new URLSearchParams({ latitude: String(geo.latitude), longitude: String(geo.longitude), timezone: cfg.DEFAULT_TIMEZONE, current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,snowfall,weather_code,pressure_msl,wind_speed_10m,wind_gusts_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max' });
    const response = await fetch(API + '?' + params.toString(), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Погодний API тимчасово недоступний');
    const json = await response.json();
    return { source: 'Open-Meteo', fetchedAt: new Date().toISOString(), location: geo, current: json.current, currentUnits: json.current_units, daily: json.daily };
  });
}

export async function getForecast(city) {
  return getWeather(city);
}

export function formatCurrent(data) {
  const c = data.current || {};
  return [
    'Поточна погода: ' + data.location.name + (data.location.region ? ', ' + data.location.region : ''),
    'Стан: ' + codeText(c.weather_code),
    'Температура: ' + Math.round(c.temperature_2m) + ' °C, відчувається як ' + Math.round(c.apparent_temperature) + ' °C',
    'Опади: ' + (c.precipitation ?? 0) + ' мм, вітер: ' + Math.round(c.wind_speed_10m || 0) + ' км/год',
    'Вологість: ' + (c.relative_humidity_2m ?? 'н/д') + '%, тиск: ' + Math.round(c.pressure_msl || 0) + ' гПа',
    'Оновлено: ' + new Date(data.fetchedAt).toLocaleString('uk-UA', { timeZone: cfg.DEFAULT_TIMEZONE }),
    'Джерело: ' + data.source
  ].join('\n');
}

export function formatForecast(data, mode = 'today') {
  const d = data.daily || {};
  const days = mode === 'week' ? 7 : 1;
  const offset = mode === 'tomorrow' ? 1 : 0;
  const lines = ['Прогноз: ' + data.location.name, 'Джерело: ' + data.source];
  for (let i = offset; i < Math.min((d.time || []).length, offset + days); i += 1) {
    lines.push([new Date(d.time[i]).toLocaleDateString('uk-UA'), codeText(d.weather_code?.[i]), 'від ' + Math.round(d.temperature_2m_min?.[i]) + ' до ' + Math.round(d.temperature_2m_max?.[i]) + ' °C', 'опади ' + (d.precipitation_sum?.[i] ?? 0) + ' мм', 'вітер до ' + Math.round(d.wind_speed_10m_max?.[i] || 0) + ' км/год'].join(' · '));
  }
  return lines.join('\n');
}

export async function formatAllRegions() {
  const picked = regions.slice(0, 25);
  const lines = ['Погода по областях України та Києву', 'Короткий огляд з Open-Meteo:'];
  for (const city of picked) {
    try {
      const data = await getWeather(city);
      lines.push(city + ': ' + Math.round(data.current.temperature_2m) + ' °C, ' + codeText(data.current.weather_code));
    } catch {
      lines.push(city + ': дані тимчасово недоступні');
    }
  }
  return lines.join('\n');
}