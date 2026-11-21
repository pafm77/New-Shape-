import React, { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  ClientRecord,
  FoodItemRecord,
  NutritionEntryRecord,
} from '../types/studio';
import { MEAL_TYPES } from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import {
  BrandCard,
  FieldLabel,
  GoldButton,
  Input,
  Modal,
  SecondaryButton,
  StatusPill,
} from './UiPrimitives';

interface PtNutritionSectionProps {
  uid: string;
  clients: ClientRecord[];
  foodItems: FoodItemRecord[];
  nutritionEntries: NutritionEntryRecord[];
  initialClientId?: string;
  onBanner: (msg: string) => void;
}

export const PtNutritionSection: React.FC<PtNutritionSectionProps> = ({
  uid,
  clients,
  foodItems,
  nutritionEntries,
  initialClientId,
  onBanner,
}) => {
  const [subTab, setSubTab] = useState<'plan' | 'foods'>('plan');
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const [selectedClientId, setSelectedClientId] = useState(
    initialClientId || activeClients[0]?.id || ''
  );
  const effectiveClient =
    activeClients.find((c) => c.id === selectedClientId) || activeClients[0] || null;

  const clientEntries = useMemo(
    () =>
      effectiveClient
        ? nutritionEntries.filter((e) => e.clientId === effectiveClient.id)
        : [],
    [nutritionEntries, effectiveClient]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-1.5">
        <button
          type="button"
          onClick={() => setSubTab('plan')}
          className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
            subTab === 'plan'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Plano por Aluno
        </button>
        <button
          type="button"
          onClick={() => setSubTab('foods')}
          className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition ${
            subTab === 'foods'
              ? 'bg-[#EAB308] text-[#121214]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Alimentos ({foodItems.length})
        </button>
      </div>

      {subTab === 'plan' ? (
        <div className="space-y-4">
          <BrandCard>
            <FieldLabel>Aluno</FieldLabel>
            <select
              value={effectiveClient?.id || ''}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-sm text-[#F4F4F5] outline-none focus:border-[#EAB308]"
            >
              {activeClients.length === 0 ? (
                <option value="">Sem alunos ativos</option>
              ) : (
                activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </BrandCard>

          <DailyMacrosSummaryCard entries={clientEntries} />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F4F4F5]">Refeições do Aluno</h3>
            <span className="text-xs text-[#A1A1AA]">Apenas leitura · Preenchido pelo aluno</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {MEAL_TYPES.map((meal) => {
              const mealEntries = clientEntries.filter((e) => e.mealType === meal.key);
              const mKcal = mealEntries.reduce((s, e) => s + e.kcal, 0);
              const mProt = mealEntries.reduce((s, e) => s + e.protein, 0);
              const mCarbs = mealEntries.reduce((s, e) => s + e.carbs, 0);
              const mFat = mealEntries.reduce((s, e) => s + e.fat, 0);

              return (
                <BrandCard key={meal.key}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-[#F4F4F5]">{meal.label}</h3>
                      <p className="text-xs font-medium text-[#EAB308]">
                        {mKcal.toFixed(0)} kcal · P {mProt.toFixed(0)}g · HC {mCarbs.toFixed(0)}g · G{' '}
                        {mFat.toFixed(0)}g
                      </p>
                    </div>
                  </div>

                  {mealEntries.length === 0 ? (
                    <p className="mt-2 text-xs text-[#A1A1AA]">
                      Sem alimentos registados nesta refeição.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2 border-t border-[#323238] pt-2.5">
                      {mealEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-[#242429]/70 px-3 py-2"
                        >
                          <div>
                            <p className="text-xs font-bold text-[#F4F4F5]">
                              {entry.foodName} ({entry.grams.toFixed(0)}g)
                            </p>
                            <p className="text-[11px] text-[#A1A1AA]">
                              {entry.kcal.toFixed(0)} kcal · P {entry.protein.toFixed(1)}g · HC{' '}
                              {entry.carbs.toFixed(1)}g · G {entry.fat.toFixed(1)}g
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </BrandCard>
              );
            })}
          </div>
        </div>
      ) : (
        <FoodCatalogView uid={uid} foodItems={foodItems} onBanner={onBanner} />
      )}
    </div>
  );
};

export const DailyMacrosSummaryCard: React.FC<{ entries: NutritionEntryRecord[] }> = ({
  entries,
}) => {
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  const prot = entries.reduce((s, e) => s + e.protein, 0);
  const carbs = entries.reduce((s, e) => s + e.carbs, 0);
  const fat = entries.reduce((s, e) => s + e.fat, 0);

  return (
    <BrandCard highlight>
      <h3 className="text-sm font-bold text-[#FACC15]">Resumo Diário de Macros</h3>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-[#242429] p-2.5">
          <p className="text-base font-extrabold text-[#FACC15]">{kcal.toFixed(0)}</p>
          <p className="text-[11px] text-[#A1A1AA]">kcal</p>
        </div>
        <div className="rounded-xl bg-[#242429] p-2.5">
          <p className="text-base font-extrabold text-[#22C55E]">{prot.toFixed(1)}g</p>
          <p className="text-[11px] text-[#A1A1AA]">Proteína</p>
        </div>
        <div className="rounded-xl bg-[#242429] p-2.5">
          <p className="text-base font-extrabold text-[#38BDF8]">{carbs.toFixed(1)}g</p>
          <p className="text-[11px] text-[#A1A1AA]">Hidratos</p>
        </div>
        <div className="rounded-xl bg-[#242429] p-2.5">
          <p className="text-base font-extrabold text-[#F59E0B]">{fat.toFixed(1)}g</p>
          <p className="text-[11px] text-[#A1A1AA]">Gordura</p>
        </div>
      </div>
    </BrandCard>
  );
};

const FoodCatalogView: React.FC<{
  uid: string;
  foodItems: FoodItemRecord[];
  onBanner: (msg: string) => void;
}> = ({ uid, foodItems, onBanner }) => {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Todos');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeleteAllCustom, setShowDeleteAllCustom] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const customFoods = useMemo(() => foodItems.filter((f) => f.custom), [foodItems]);

  const cats = useMemo(
    () => ['Todos', ...Array.from(new Set(foodItems.map((f) => f.category))).sort()],
    [foodItems]
  );

  const filtered = foodItems.filter(
    (f) =>
      (!onlyCustom || f.custom) &&
      (cat === 'Todos' || f.category === cat) &&
      (!search.trim() ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[#F4F4F5]">
          Alimentos ({filtered.length}) · por 100g
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {customFoods.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteAllCustom(true)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#EF4444]/40 bg-[#3B1518] px-3.5 py-2 text-xs font-bold text-[#FCA5A5] transition hover:bg-[#EF4444]/25"
            >
              <Trash2 className="h-4 w-4" />
              Apagar importados ({customFoods.length})
            </button>
          )}
          <GoldButton onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Novo Alimento
          </GoldButton>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Procurar alimento..."
          className="pl-9"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {customFoods.length > 0 && (
          <button
            type="button"
            onClick={() => setOnlyCustom((prev) => !prev)}
            className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              onlyCustom
                ? 'border-[#EF4444] bg-[#EF4444] text-white'
                : 'border-[#EF4444]/40 bg-[#3B1518]/60 text-[#FCA5A5]'
            }`}
          >
            Importados / Adicionados ({customFoods.length})
          </button>
        )}
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              cat === c
                ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                : 'border-[#323238] bg-[#1B1B1E] text-[#A1A1AA]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {filtered.map((fd) => (
          <div
            key={fd.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-3.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-bold text-[#F4F4F5]">{fd.name}</p>
                {fd.custom && <StatusPill tone="blue">Importado/Adic.</StatusPill>}
              </div>
              <p className="text-xs text-[#A1A1AA]">
                {fd.kcalPer100g.toFixed(0)} kcal · P {fd.proteinPer100g}g · HC {fd.carbsPer100g}g · G{' '}
                {fd.fatPer100g}g
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusPill tone="gold">{fd.category}</StatusPill>
              {fd.custom && (
                <button
                  type="button"
                  title="Apagar alimento"
                  aria-label={`Apagar ${fd.name}`}
                  onClick={async () => {
                    await repo.deleteFood(uid, fd.id);
                    onBanner(`Alimento "${fd.name}" removido.`);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#EF4444] transition hover:bg-[#3B1518]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddCustomFoodModal
          onClose={() => setShowAdd(false)}
          onSave={async (name, category, kcal, p, c, f) => {
            await repo.addCustomFood(uid, name, category, kcal, p, c, f);
            setShowAdd(false);
            onBanner('Alimento adicionado!');
          }}
        />
      )}

      {showDeleteAllCustom && (
        <Modal
          open
          title="Apagar alimentos importados?"
          onClose={() => !deletingAll && setShowDeleteAllCustom(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-[#D4D4D8]">
              Vais remover todos os <strong className="text-white">{customFoods.length}</strong> alimentos
              importados via Excel ou adicionados manualmente. A lista base de alimentos da New Shape
              mantém-se intacta.
            </p>
            <div className="flex justify-end gap-2">
              <SecondaryButton
                disabled={deletingAll}
                onClick={() => setShowDeleteAllCustom(false)}
              >
                Cancelar
              </SecondaryButton>
              <button
                type="button"
                disabled={deletingAll}
                onClick={async () => {
                  setDeletingAll(true);
                  try {
                    const removed = await repo.deleteCustomFoods(
                      uid,
                      customFoods.map((f) => f.id)
                    );
                    setOnlyCustom(false);
                    setShowDeleteAllCustom(false);
                    onBanner(`${removed} alimentos importados/adicionados removidos!`);
                  } finally {
                    setDeletingAll(false);
                  }
                }}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#EF4444] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#DC2626] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deletingAll ? 'A apagar...' : `Apagar todos (${customFoods.length})`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export const AddFoodToMealModal: React.FC<{
  mealLabel: string;
  foods: FoodItemRecord[];
  onClose: () => void;
  onAdd: (food: FoodItemRecord, grams: number) => Promise<void>;
}> = ({ mealLabel, foods, onClose, onAdd }) => {
  const [search, setSearch] = useState('');
  const filtered = foods.filter(
    (f) =>
      !search.trim() ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase())
  );
  const [selectedId, setSelectedId] = useState(foods[0]?.id || '');
  const [grams, setGrams] = useState('100');
  const selected = foods.find((f) => f.id === selectedId) || filtered[0] || null;
  const g = Math.max(0, Number(grams) || 0);

  return (
    <Modal open title={`Adicionar a ${mealLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Procurar alimento..."
        />
        <div className="max-h-44 overflow-y-auto rounded-xl border border-[#323238] bg-[#242429] divide-y divide-[#323238]/60">
          {filtered.map((fd) => (
            <label
              key={fd.id}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs hover:bg-[#2E2E35]"
            >
              <input
                type="radio"
                name="food_pick"
                checked={selected?.id === fd.id}
                onChange={() => setSelectedId(fd.id)}
                className="accent-[#EAB308]"
              />
              <div>
                <p className="font-semibold text-[#F4F4F5]">{fd.name}</p>
                <p className="text-[11px] text-[#EAB308]">{fd.kcalPer100g.toFixed(0)} kcal/100g</p>
              </div>
            </label>
          ))}
        </div>
        <div>
          <FieldLabel>Quantidade (gramas)</FieldLabel>
          <Input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </div>
        {selected && (
          <p className="text-xs font-semibold text-[#FACC15]">
            Calculado: {((selected.kcalPer100g * g) / 100).toFixed(0)} kcal · P{' '}
            {((selected.proteinPer100g * g) / 100).toFixed(1)}g · HC{' '}
            {((selected.carbsPer100g * g) / 100).toFixed(1)}g · G{' '}
            {((selected.fatPer100g * g) / 100).toFixed(1)}g
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton disabled={!selected || g <= 0} onClick={() => selected && onAdd(selected, g)}>
            Adicionar
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};

const AddCustomFoodModal: React.FC<{
  onClose: () => void;
  onSave: (
    name: string,
    category: string,
    kcal: number,
    p: number,
    c: number,
    f: number
  ) => Promise<void>;
}> = ({ onClose, onSave }) => {
  const cats = ['Proteína', 'Hidratos', 'Gordura', 'Laticínios', 'Fruta', 'Legumes', 'Suplemento'];
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Proteína');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  return (
    <Modal open title="Novo Alimento (por 100g)" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Nome do alimento</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                category === c
                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                  : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Kcal</FieldLabel>
            <Input type="number" step="0.1" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Proteína (g)</FieldLabel>
            <Input
              type="number"
              step="0.1"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Hidratos (g)</FieldLabel>
            <Input
              type="number"
              step="0.1"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Gordura (g)</FieldLabel>
            <Input type="number" step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={!name.trim()}
            onClick={() =>
              onSave(
                name,
                category,
                Number(kcal) || 0,
                Number(protein) || 0,
                Number(carbs) || 0,
                Number(fat) || 0
              )
            }
          >
            Guardar Alimento
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};
