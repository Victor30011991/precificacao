import Decimal from 'decimal.js';
import { norm } from './normalize';
import { roundCents } from './money';

export type Family = 'massa' | 'volume' | 'contagem';

const MASS: Record<string, number> = { kg: 1000, g: 1 };
const VOLUME: Record<string, number> = { L: 1000, ml: 1 };

export const BASE_UNITS = ['kg', 'g', 'L', 'ml', 'un', 'pacote', 'caixa'];

const ALIASES: Record<string, string> = {
  kg: 'kg', kgs: 'kg', quilo: 'kg', quilos: 'kg', kilo: 'kg', kilos: 'kg', quilograma: 'kg', quilogramas: 'kg',
  g: 'g', gr: 'g', grs: 'g', grama: 'g', gramas: 'g',
  l: 'L', lt: 'L', lts: 'L', litro: 'L', litros: 'L',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', unit: 'un', pc: 'un', pç: 'un', peca: 'un', pecas: 'un',
  pct: 'pacote', pac: 'pacote', pacote: 'pacote', pacotes: 'pacote',
  cx: 'caixa', caixa: 'caixa', caixas: 'caixa',
};

/** Texto livre -> unidade padrão do sistema. Desconhecida = unidade personalizada (mantém o texto). */
export function normalizeUnit(raw: unknown): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const key = norm(text).replace(/[.\s]/g, '');
  if (ALIASES[key]) return ALIASES[key];
  return text;
}

export function familyOf(unit: string): Family {
  if (unit in MASS) return 'massa';
  if (unit in VOLUME) return 'volume';
  return 'contagem';
}

function factorOf(unit: string): number | null {
  if (unit in MASS) return MASS[unit];
  if (unit in VOLUME) return VOLUME[unit];
  return null;
}

/** Converte uma quantidade entre unidades da MESMA família. Incompatível (ex.: kg -> L) = null. */
export function convertQty(qty: number | Decimal, from: string, to: string): Decimal | null {
  if (from === to) return new Decimal(qty);
  if (familyOf(from) !== familyOf(to)) return null;
  const f = factorOf(from);
  const t = factorOf(to);
  if (f == null || t == null) return null; // unidades personalizadas não convertem entre si
  return new Decimal(qty).times(f).div(t);
}

export function compatibleUnits(unit: string): string[] {
  const fam = familyOf(unit);
  if (fam === 'massa') return Object.keys(MASS);
  if (fam === 'volume') return Object.keys(VOLUME);
  return [];
}

export function defaultProportional(unit: string): { qtd: number; unidade: string } | null {
  if (unit === 'kg') return { qtd: 100, unidade: 'g' };
  if (unit === 'L') return { qtd: 100, unidade: 'ml' };
  return null;
}

/**
 * Preço proporcional a partir do preço de venda JÁ ARREDONDADO.
 * R$ 59,90/kg -> R$ 5,99 por 100 g. Conversão incompatível -> null.
 */
export function proportionalPrice(
  priceCents: number | null,
  unit: string,
  propQtd: number | null,
  propUnidade: string | null,
): number | null {
  if (priceCents == null || propQtd == null || !propUnidade || propQtd <= 0) return null;
  const qtyInRefUnit = convertQty(propQtd, propUnidade, unit);
  if (qtyInRefUnit == null) return null;
  return roundCents(new Decimal(priceCents).times(qtyInRefUnit));
}

export function formatQtyUnit(qtd: number, unidade: string): string {
  return `${String(qtd).replace('.', ',')} ${unidade}`;
}

/** "100 g" / "250 ml" -> {qtd, unidade} */
export function parseBase(text: unknown): { qtd: number; unidade: string } | null {
  const m = String(text ?? '')
    .trim()
    .match(/^([\d.,]+)\s*([^\d\s].*)$/);
  if (!m) return null;
  const qtd = Number(m[1].replace(/\./g, '').replace(',', '.'));
  const unidade = normalizeUnit(m[2]);
  if (!Number.isFinite(qtd) || qtd <= 0 || !unidade) return null;
  return { qtd, unidade };
}
