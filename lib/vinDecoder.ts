// Детерминированная часть VIN-декодера: WMI (страна+производитель) и год.
// Эти данные жёстко зашиты в стандарт ISO 3779 — никаких AI и никаких ошибок.

export interface WmiInfo {
  country: string;
  manufacturer: string;
  expectedMakes: string[];
}

// Год по позиции 10 (стандарт SAE J775) — циклы по 30 лет
// Буквы I, O, Q, U, Z и 0 не используются
const YEAR_CODES_2010_2039: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
  '1': 2031, '2': 2032, '3': 2033, '4': 2034, '5': 2035, '6': 2036, '7': 2037, '8': 2038, '9': 2039,
};

const YEAR_CODES_1980_2009: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984, F: 1985, G: 1986, H: 1987,
  J: 1988, K: 1989, L: 1990, M: 1991, N: 1992, P: 1993, R: 1994, S: 1995,
  T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009,
};

// Чтобы понять цикл, смотрим самый свежий возможный год не из будущего.
// Правило про позицию 7 (цифра=старая эпоха, буква=новая) работает только
// для VIN из США/Канады/Мексики, и подводит для корейских/русских/китайских.
export function decodeYear(vin: string): number | null {
  if (vin.length !== 17) return null;
  const yearChar = vin[9].toUpperCase();
  const newEra = YEAR_CODES_2010_2039[yearChar];
  const oldEra = YEAR_CODES_1980_2009[yearChar];
  const currentYear = new Date().getFullYear();
  // Допускаем модельный год на 1 вперёд (например, 2026 модель продаётся в 2025)
  const maxYear = currentYear + 1;

  if (newEra && newEra <= maxYear) return newEra;
  if (oldEra && oldEra <= maxYear) return oldEra;
  return newEra ?? oldEra ?? null;
}

// WMI — World Manufacturer Identifier (первые 3 символа)
// Здесь основные производители популярные в СНГ + крупнейшие мировые
const WMI_TABLE: Record<string, WmiInfo> = {
  // ─── Россия ───
  XTA: { country: 'Россия', manufacturer: 'АвтоВАЗ', expectedMakes: ['Lada', 'ВАЗ', 'LADA'] },
  XTT: { country: 'Россия', manufacturer: 'УАЗ', expectedMakes: ['UAZ', 'УАЗ'] },
  X4X: { country: 'Россия', manufacturer: 'BMW Russia', expectedMakes: ['BMW'] },
  XW8: { country: 'Россия', manufacturer: 'VW Group Rus', expectedMakes: ['Volkswagen', 'Skoda', 'Audi', 'VW'] },
  XW7: { country: 'Россия', manufacturer: 'Toyota Russia', expectedMakes: ['Toyota'] },
  XTH: { country: 'Россия', manufacturer: 'ГАЗ', expectedMakes: ['GAZ', 'ГАЗ'] },
  Z94: { country: 'Россия', manufacturer: 'Hyundai Russia', expectedMakes: ['Hyundai', 'Solaris'] },
  Z8T: { country: 'Россия', manufacturer: 'Renault Russia', expectedMakes: ['Renault'] },

  // ─── Корея ───
  KL1: { country: 'Южная Корея', manufacturer: 'GM Korea', expectedMakes: ['Chevrolet', 'Daewoo', 'Holden'] },
  KLA: { country: 'Южная Корея', manufacturer: 'GM Korea (Daewoo)', expectedMakes: ['Daewoo', 'Chevrolet'] },
  KMH: { country: 'Южная Корея', manufacturer: 'Hyundai', expectedMakes: ['Hyundai'] },
  KNA: { country: 'Южная Корея', manufacturer: 'Kia', expectedMakes: ['Kia'] },
  KNB: { country: 'Южная Корея', manufacturer: 'Kia', expectedMakes: ['Kia'] },
  KND: { country: 'Южная Корея', manufacturer: 'Kia', expectedMakes: ['Kia'] },
  KNE: { country: 'Южная Корея', manufacturer: 'Kia', expectedMakes: ['Kia'] },
  KNH: { country: 'Южная Корея', manufacturer: 'Kia', expectedMakes: ['Kia'] },
  KMF: { country: 'Южная Корея', manufacturer: 'Hyundai (комм.)', expectedMakes: ['Hyundai'] },
  KPA: { country: 'Южная Корея', manufacturer: 'SsangYong', expectedMakes: ['SsangYong'] },
  KPB: { country: 'Южная Корея', manufacturer: 'SsangYong', expectedMakes: ['SsangYong'] },

  // ─── Япония ───
  JT2: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota'] },
  JT3: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota'] },
  JT4: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota'] },
  JTD: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota'] },
  JTE: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota', 'Lexus'] },
  JTH: { country: 'Япония', manufacturer: 'Lexus', expectedMakes: ['Lexus', 'Toyota'] },
  JTJ: { country: 'Япония', manufacturer: 'Lexus', expectedMakes: ['Lexus'] },
  JTK: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota', 'Scion'] },
  JTL: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota'] },
  JTM: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota'] },
  JTN: { country: 'Япония', manufacturer: 'Toyota', expectedMakes: ['Toyota'] },
  JN1: { country: 'Япония', manufacturer: 'Nissan', expectedMakes: ['Nissan', 'Infiniti'] },
  JN3: { country: 'Япония', manufacturer: 'Nissan', expectedMakes: ['Nissan'] },
  JN6: { country: 'Япония', manufacturer: 'Nissan', expectedMakes: ['Nissan'] },
  JN8: { country: 'Япония', manufacturer: 'Nissan', expectedMakes: ['Nissan', 'Infiniti'] },
  JNK: { country: 'Япония', manufacturer: 'Infiniti', expectedMakes: ['Infiniti', 'Nissan'] },
  JNR: { country: 'Япония', manufacturer: 'Infiniti', expectedMakes: ['Infiniti'] },
  JHM: { country: 'Япония', manufacturer: 'Honda', expectedMakes: ['Honda'] },
  JHL: { country: 'Япония', manufacturer: 'Honda', expectedMakes: ['Honda'] },
  JHG: { country: 'Япония', manufacturer: 'Honda', expectedMakes: ['Honda'] },
  JF1: { country: 'Япония', manufacturer: 'Subaru', expectedMakes: ['Subaru'] },
  JF2: { country: 'Япония', manufacturer: 'Subaru', expectedMakes: ['Subaru'] },
  JM1: { country: 'Япония', manufacturer: 'Mazda', expectedMakes: ['Mazda'] },
  JM3: { country: 'Япония', manufacturer: 'Mazda', expectedMakes: ['Mazda'] },
  JMZ: { country: 'Япония', manufacturer: 'Mazda', expectedMakes: ['Mazda'] },
  JMB: { country: 'Япония', manufacturer: 'Mitsubishi', expectedMakes: ['Mitsubishi'] },
  JA3: { country: 'Япония', manufacturer: 'Mitsubishi', expectedMakes: ['Mitsubishi'] },
  JA4: { country: 'Япония', manufacturer: 'Mitsubishi', expectedMakes: ['Mitsubishi'] },
  JS3: { country: 'Япония', manufacturer: 'Suzuki', expectedMakes: ['Suzuki'] },
  JS2: { country: 'Япония', manufacturer: 'Suzuki', expectedMakes: ['Suzuki'] },

  // ─── Германия ───
  WBA: { country: 'Германия', manufacturer: 'BMW', expectedMakes: ['BMW'] },
  WBS: { country: 'Германия', manufacturer: 'BMW M', expectedMakes: ['BMW'] },
  WBY: { country: 'Германия', manufacturer: 'BMW i', expectedMakes: ['BMW'] },
  WBX: { country: 'Германия', manufacturer: 'BMW X', expectedMakes: ['BMW'] },
  WDB: { country: 'Германия', manufacturer: 'Mercedes-Benz', expectedMakes: ['Mercedes-Benz', 'Mercedes'] },
  WDC: { country: 'Германия', manufacturer: 'Mercedes-Benz SUV', expectedMakes: ['Mercedes-Benz', 'Mercedes'] },
  WDD: { country: 'Германия', manufacturer: 'Mercedes-Benz', expectedMakes: ['Mercedes-Benz', 'Mercedes'] },
  W1K: { country: 'Германия', manufacturer: 'Mercedes-Benz', expectedMakes: ['Mercedes-Benz', 'Mercedes'] },
  W1N: { country: 'Германия', manufacturer: 'Mercedes-Benz', expectedMakes: ['Mercedes-Benz', 'Mercedes'] },
  WVW: { country: 'Германия', manufacturer: 'Volkswagen', expectedMakes: ['Volkswagen', 'VW'] },
  WV1: { country: 'Германия', manufacturer: 'VW коммерч.', expectedMakes: ['Volkswagen', 'VW'] },
  WV2: { country: 'Германия', manufacturer: 'VW коммерч.', expectedMakes: ['Volkswagen', 'VW'] },
  WVG: { country: 'Германия', manufacturer: 'VW SUV', expectedMakes: ['Volkswagen', 'VW'] },
  WAU: { country: 'Германия', manufacturer: 'Audi', expectedMakes: ['Audi'] },
  WA1: { country: 'Германия', manufacturer: 'Audi SUV', expectedMakes: ['Audi'] },
  WP0: { country: 'Германия', manufacturer: 'Porsche', expectedMakes: ['Porsche'] },
  WP1: { country: 'Германия', manufacturer: 'Porsche SUV', expectedMakes: ['Porsche'] },
  TMB: { country: 'Чехия', manufacturer: 'Skoda', expectedMakes: ['Skoda', 'Škoda'] },

  // ─── Франция ───
  VF1: { country: 'Франция', manufacturer: 'Renault', expectedMakes: ['Renault'] },
  VF3: { country: 'Франция', manufacturer: 'Peugeot', expectedMakes: ['Peugeot'] },
  VF7: { country: 'Франция', manufacturer: 'Citroen', expectedMakes: ['Citroen', 'Citroën'] },
  VF6: { country: 'Франция', manufacturer: 'Renault Trucks', expectedMakes: ['Renault'] },

  // ─── Италия ───
  ZFA: { country: 'Италия', manufacturer: 'Fiat', expectedMakes: ['Fiat'] },
  ZFF: { country: 'Италия', manufacturer: 'Ferrari', expectedMakes: ['Ferrari'] },

  // ─── Великобритания ───
  SAJ: { country: 'Великобритания', manufacturer: 'Jaguar', expectedMakes: ['Jaguar'] },
  SAL: { country: 'Великобритания', manufacturer: 'Land Rover', expectedMakes: ['Land Rover', 'Range Rover'] },
  SCC: { country: 'Великобритания', manufacturer: 'Lotus', expectedMakes: ['Lotus'] },

  // ─── Швеция ───
  YV1: { country: 'Швеция', manufacturer: 'Volvo', expectedMakes: ['Volvo'] },
  YS3: { country: 'Швеция', manufacturer: 'Saab', expectedMakes: ['Saab'] },

  // ─── Китай ───
  LSV: { country: 'Китай', manufacturer: 'SAIC-VW', expectedMakes: ['Volkswagen', 'VW'] },
  LFV: { country: 'Китай', manufacturer: 'FAW-VW', expectedMakes: ['Volkswagen', 'VW'] },
  LVS: { country: 'Китай', manufacturer: 'Changan Ford', expectedMakes: ['Ford'] },
  LFP: { country: 'Китай', manufacturer: 'FAW Car', expectedMakes: ['FAW', 'Hongqi'] },
  LGB: { country: 'Китай', manufacturer: 'Dongfeng Nissan', expectedMakes: ['Nissan'] },
  LJD: { country: 'Китай', manufacturer: 'Dongfeng', expectedMakes: ['Dongfeng', 'DFM'] },
  LB3: { country: 'Китай', manufacturer: 'Geely', expectedMakes: ['Geely'] },
  LJX: { country: 'Китай', manufacturer: 'JAC', expectedMakes: ['JAC'] },
  LGW: { country: 'Китай', manufacturer: 'Great Wall / Haval', expectedMakes: ['Haval', 'Great Wall', 'GWM'] },
  LGX: { country: 'Китай', manufacturer: 'BYD', expectedMakes: ['BYD'] },
  LSG: { country: 'Китай', manufacturer: 'SAIC GM', expectedMakes: ['Buick', 'Chevrolet'] },
  LRW: { country: 'Китай', manufacturer: 'Tesla Shanghai', expectedMakes: ['Tesla'] },
  LVV: { country: 'Китай', manufacturer: 'Chery', expectedMakes: ['Chery'] },
  LJ1: { country: 'Китай', manufacturer: 'JAC', expectedMakes: ['JAC'] },

  // ─── США ───
  '1G1': { country: 'США', manufacturer: 'Chevrolet', expectedMakes: ['Chevrolet'] },
  '1GC': { country: 'США', manufacturer: 'Chevrolet Truck', expectedMakes: ['Chevrolet'] },
  '1GN': { country: 'США', manufacturer: 'Chevrolet SUV', expectedMakes: ['Chevrolet'] },
  '1FA': { country: 'США', manufacturer: 'Ford', expectedMakes: ['Ford'] },
  '1FT': { country: 'США', manufacturer: 'Ford Truck', expectedMakes: ['Ford'] },
  '1FM': { country: 'США', manufacturer: 'Ford SUV', expectedMakes: ['Ford'] },
  '1C3': { country: 'США', manufacturer: 'Chrysler', expectedMakes: ['Chrysler'] },
  '1C4': { country: 'США', manufacturer: 'Jeep/Dodge', expectedMakes: ['Jeep', 'Dodge', 'Chrysler'] },
  '5YJ': { country: 'США', manufacturer: 'Tesla', expectedMakes: ['Tesla'] },
  '7SA': { country: 'США', manufacturer: 'Tesla', expectedMakes: ['Tesla'] },
};

export function decodeWmi(vin: string): WmiInfo | null {
  if (vin.length < 3) return null;
  const wmi3 = vin.slice(0, 3).toUpperCase();
  return WMI_TABLE[wmi3] ?? null;
}

export function isVinValid(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}
