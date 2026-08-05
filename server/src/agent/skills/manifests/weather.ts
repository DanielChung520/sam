// Built-in skill: weather（即時天氣查詢）
//
// 真實呼叫 OpenWeatherMap API，API key 從 server/.env 讀取（可設置）：
//   OPENWEATHERMAP_API_KEY
//
// 支援兩種輸入（二選一）：
//   - city：城市名稱（如 台北 / Tokyo）
//   - lat + lon：經緯度（LINE location message 會給座標）
// units：metric(°C) / imperial(°F)，預設 metric。
// 輸出含 city、溫度、體感、濕度、氣壓、天氣描述、風速、當地時間。

import type { SkillManifest } from '../../types.js';
import { registerInlineHandler } from '../../skillExecutor.js';
import { logger } from '../../logger.js';

const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';

interface WeatherResult {
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  description: string;
  windSpeed: number;
  localTime: string;
  units: 'metric' | 'imperial';
}

export async function getWeather(args: {
  city?: string;
  lat?: number;
  lon?: number;
  units?: string;
}): Promise<WeatherResult | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    logger.warn('weather.no_api_key');
    return null;
  }

  const units = args.units === 'imperial' ? 'imperial' : 'metric';
  const params = new URLSearchParams({ appid: apiKey, units, lang: 'zh_tw' });

  if (args.city) {
    params.set('q', args.city);
  } else if (typeof args.lat === 'number' && typeof args.lon === 'number') {
    params.set('lat', String(args.lat));
    params.set('lon', String(args.lon));
  } else {
    logger.warn('weather.missing_input', { args });
    return null;
  }

  try {
    const res = await fetch(`${WEATHER_URL}?${params}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      logger.warn('weather.api_error', { status: res.status, text: (await res.text()).slice(0, 200) });
      return null;
    }
    const data = (await res.json()) as {
      name?: string;
      sys?: { country?: string };
      main?: { temp?: number; feels_like?: number; humidity?: number; pressure?: number };
      weather?: Array<{ description?: string }>;
      wind?: { speed?: number };
      dt?: number;
      timezone?: number;
    };
    // 當地時間：dt（epoch sec）+ timezone offset（sec）
    const localTime = new Date(((data.dt ?? 0) + (data.timezone ?? 0)) * 1000)
      .toISOString()
      .slice(11, 16);
    return {
      city: data.name ?? args.city ?? '未知',
      country: data.sys?.country ?? '',
      temperature: Math.round(data.main?.temp ?? 0),
      feelsLike: Math.round(data.main?.feels_like ?? 0),
      humidity: data.main?.humidity ?? 0,
      pressure: data.main?.pressure ?? 0,
      description: data.weather?.[0]?.description ?? '',
      windSpeed: data.wind?.speed ?? 0,
      localTime,
      units,
    };
  } catch (e) {
    logger.warn('weather.fetch_error', { args, error: String(e) });
    return null;
  }
}

// 格式化天氣輸出（handler 與 webhook location 共用）
export function formatWeatherOutput(weather: WeatherResult): string {
  const tempUnit = weather.units === 'imperial' ? '°F' : '°C';
  const windUnit = weather.units === 'imperial' ? 'mph' : 'm/s';
  const lines = [
    `🌤 ${weather.city}${weather.country ? ` (${weather.country})` : ''}`,
    `天氣：${weather.description}`,
    `氣溫：${weather.temperature}${tempUnit}（體感 ${weather.feelsLike}${tempUnit}）`,
    `濕度：${weather.humidity}%　氣壓：${weather.pressure} hPa`,
    `風速：${weather.windSpeed} ${windUnit}`,
    `當地時間：${weather.localTime}`,
  ];
  return lines.join('\n');
}

const handler = async (args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> => {
  const weather = await getWeather({
    city: args.city ? String(args.city) : undefined,
    lat: typeof args.lat === 'number' ? args.lat : undefined,
    lon: typeof args.lon === 'number' ? args.lon : undefined,
    units: args.units ? String(args.units) : 'metric',
  });

  if (!weather) {
    return { ok: false, output: '查不到天氣資訊。請提供城市名稱（如「台北」）或分享你的位置，例如：「查台北天氣」' };
  }

  return { ok: true, output: formatWeatherOutput(weather) };
};

registerInlineHandler('weather', handler);

const manifest: SkillManifest = {
  id: 'weather',
  name: '即時天氣',
  description: '查詢即時天氣：溫度、濕度、風速、天氣描述（需城市或座標）',
  triggers: ['天氣', 'weather', '氣象', '溫度', '會不會下雨', '幾度'],
  parameters: [
    { name: 'city', type: 'string', required: false, description: '城市名稱（city 與 lat/lon 二選一）' },
    { name: 'lat', type: 'number', required: false, description: '緯度（需搭配 lon）' },
    { name: 'lon', type: 'number', required: false, description: '經度（需搭配 lat）' },
    { name: 'units', type: 'string', required: false, description: 'metric(°C) / imperial(°F)，預設 metric' },
  ],
  executor: { type: 'inline', handler: 'weather' },
  timeoutMs: 20_000,
};

export default manifest;
