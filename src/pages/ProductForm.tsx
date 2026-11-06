import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { useApp } from '../state/store';
import { Button, Field, MoneyInput, Modal, NumberInput, Notice } from '../ui/ui';
import { BASE_UNITS, compatibleUnits, defaultProportional, proportionalPrice, formatQtyUnit } from '../core/units';
import { norm } from '../core/normalize';
import { formatBRL } from '../core/money';
import { calcPrice, paymentById } from '../core/pricing';

const NOVA = '__nova__';
const OUTRA = '__outra__';

export function ProductForm({ inicial, novo, onClose }: { inicial: Product; novo: boolean; onClose: () => void }) {
  const { state, act } = useApp();
  const [d, setD] = useState<Product>(inicial);
  const [catSel, setCatSel] = useState<string>(inicial.categoria);
  const [novaCat, setNovaCat] = useState('');
  const [unSel, setUnSel] = useState<string>(BASE_UNITS.includes(inicial.unidade) ? inicial.unidade : OUTRA);
  const [unOutra, setUnOutra] = useState(BASE_UNITS.includes(inicial.unidade) ? '' : inicial.unidade);
  const [tentou, setTentou] = useState(false);
  const [sugestao, setSugestao] = useState<{ ok: boolean; texto: string } | null>(null);

  const set = (patch: Partial<Product>) => setD((prev) => ({ ...prev, ...patch }));

  const unidade = unSel === OUTRA ? unOutra.trim() : unSel;
  const categoria = catSel === NOVA ? novaCat.trim() : catSel;
  const compat = compatibleUnits(unidade);
  const temProp = d.propQtd != null && d.propUnidade != null;

  function trocarUnidade(u: string) {
    const dp = defaultProportional(u);
    set({ unidade: u, propQtd: dp?.qtd ?? null, propUnidade: dp?.unidade ?? null });
  }

  const nome = d.nome.trim();
  const erroNome = !nome ? 'Informe o nome do produto.' : null;
  const erroUnidade = !unidade ? 'Informe a unidade de medida.' : null;
  const duplicado = useMemo(
    () => state.lista.produtos.find((p) => p.id !== d.id && norm(p.nome) === norm(nome) && norm(p.categoria) === norm(categoria) && p.unidade === unidade),
    [state.lista.produtos, d.id, nome, categoria, unidade],
  );
  const erroDup = duplicado ? 'Já existe um produto com este nome, categoria e unidade. Altere um deles ou edite o que já existe.' : null;
  const erroCat = catSel === NOVA && !novaCat.trim() ? 'Digite o nome da nova categoria.' : null;

  const prop = proportionalPrice(d.venda, unidade, d.propQtd, d.propUnidade);

  function sugerir() {
    const pay = paymentById(state.config, state.config.pagamentoBase);
    const r = calcPrice({ custo: d.custo, custosAdicionais: d.custosAdicionais }, state.config, pay.taxa);
    if (!r.ok) {
      setSugestao({ ok: false, texto: r.motivo });
      return;
    }
    set({ venda: r.precoCents });
    setSugestao({ ok: true, texto: `Preço sugerido ${formatBRL(r.precoCents)} (${pay.label.toLowerCase()}, margem ${String(state.config.margem.valor).replace('.', ',')}%${state.config.margem.modo === 'markup' ? ' de markup' : ''}). Você pode ajustar.` });
  }

  function salvar() {
    setTentou(true);
    if (erroNome || erroUnidade || erroDup || erroCat) return;
    const known = state.lista.categorias.find((c) => norm(c) === norm(categoria));
    act.salvarProduto({
      ...d,
      nome,
      unidade,
      categoria: known ?? categoria,
      observacoes: d.observacoes.trim(),
      propQtd: temProp && compat.includes(d.propUnidade!) ? d.propQtd : null,
      propUnidade: temProp && compat.includes(d.propUnidade!) ? d.propUnidade : null,
    });
    onClose();
  }

  return (
    <Modal
      open
      wide
      title={novo ? 'Novo produto' : 'Editar produto'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} icon="check">
            {novo ? 'Adicionar produto' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <Field label="Nome do produto" erro={tentou ? erroNome ?? erroDup : null} className="span-2">
          {(id) => <input id={id} value={d.nome} onChange={(e) => set({ nome: e.target.value })} autoFocus placeholder="Ex.: Castanha-do-pará" />}
        </Field>

        <Field label="Categoria" erro={tentou ? erroCat : null}>
          {(id) => (
            <>
              <select id={id} value={catSel} onChange={(e) => setCatSel(e.target.value)}>
                <option value="">Sem categoria</option>
                {state.lista.categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NOVA}>+ Nova categoria…</option>
              </select>
              {catSel === NOVA && <input className="mt" aria-label="Nome da nova categoria" value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Nome da nova categoria" />}
            </>
          )}
        </Field>

        <Field label="Unidade de medida" erro={tentou ? erroUnidade : null} hint="A unidade em que o preço é informado (ex.: preço por kg).">
          {(id) => (
            <>
              <select
                id={id}
                value={unSel}
                onChange={(e) => {
                  setUnSel(e.target.value);
                  if (e.target.value !== OUTRA) trocarUnidade(e.target.value);
                  else trocarUnidade(unOutra.trim());
                }}
              >
                {BASE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value={OUTRA}>Outra…</option>
              </select>
              {unSel === OUTRA && (
                <input
                  className="mt"
                  aria-label="Nome da unidade personalizada"
                  value={unOutra}
                  onChange={(e) => {
                    setUnOutra(e.target.value);
                    trocarUnidade(e.target.value.trim());
                  }}
                  placeholder="Ex.: fardo, saco, dúzia"
                />
              )}
            </>
          )}
        </Field>

        <Field label="Custo de aquisição" hint="Quanto você paga pelo produto, na unidade acima.">
          {(id) => <MoneyInput id={id} value={d.custo} onChange={(v) => set({ custo: v })} />}
        </Field>

        <Field label="Custos adicionais do produto" hint="Frete, embalagem ou outro custo só deste item (por unidade).">
          {(id) => <MoneyInput id={id} value={d.custosAdicionais || null} onChange={(v) => set({ custosAdicionais: v ?? 0 })} />}
        </Field>

        <Field label="Preço de venda" className="span-2" hint="Preço que o cliente paga, na unidade acima.">
          {(id) => (
            <div className="row-gap">
              <MoneyInput id={id} value={d.venda} onChange={(v) => { set({ venda: v }); setSugestao(null); }} />
              <Button variant="secondary" icon="sparkle" onClick={sugerir} disabled={d.custo == null}>
                Calcular preço sugerido
              </Button>
            </div>
          )}
        </Field>
        {sugestao && (
          <div className="span-2">
            <Notice tone={sugestao.ok ? 'ok' : 'warn'}>{sugestao.texto}</Notice>
          </div>
        )}

        {compat.length > 0 && (
          <fieldset className="span-2 prop-box">
            <legend>Preço proporcional</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={temProp}
                onChange={(e) => {
                  if (e.target.checked) {
                    const dp = defaultProportional(unidade) ?? { qtd: 100, unidade: compat.find((u) => u !== unidade) ?? compat[0] };
                    set({ propQtd: dp.qtd, propUnidade: dp.unidade });
                  } else set({ propQtd: null, propUnidade: null });
                }}
              />
              Mostrar também o preço por uma quantidade menor
            </label>
            {temProp && (
              <div className="row-gap">
                <span className="muted">Preço por</span>
                <NumberInput ariaLabel="Quantidade da base proporcional" value={d.propQtd ?? 100} min={0.001} onChange={(v) => set({ propQtd: v })} className="w-sm" />
                <select aria-label="Unidade da base proporcional" value={d.propUnidade ?? ''} onChange={(e) => set({ propUnidade: e.target.value })}>
                  {compat.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <strong className="prop-result">
                  {prop == null ? '—' : `${formatBRL(prop)} por ${formatQtyUnit(d.propQtd ?? 0, d.propUnidade ?? '')}`}
                </strong>
              </div>
            )}
            <small className="muted">Calculado sobre o preço de venda já arredondado. Só converte unidades compatíveis (kg↔g, L↔ml).</small>
          </fieldset>
        )}

        <Field label="Observações" className="span-2" hint="Anotações internas. Não aparecem no PDF.">
          {(id) => <textarea id={id} rows={2} value={d.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
