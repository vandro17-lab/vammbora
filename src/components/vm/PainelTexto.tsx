import { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle, ArrowCounterClockwise, TextAa, TextAlignLeft, TextAlignCenter, TextAlignRight } from '@phosphor-icons/react';
import { publicarUiConfig, removerUiConfig, type ConfigTexto, type TextoDef } from '@/data/ui-config';
import { cn } from '@/lib/utils';

const PESOS: Array<[number, string]> = [[400, 'Normal'], [600, 'Médio'], [800, 'Forte']];
const CORES = ['#0b1f3a', '#17306b', '#0f8a66', '#16b377', '#e11d48', '#d97706', '#ffffff'];
const ALINHAR: Array<['left' | 'center' | 'right', typeof TextAlignLeft]> = [
  ['left', TextAlignLeft], ['center', TextAlignCenter], ['right', TextAlignRight],
];

export interface PainelTextoProps {
  def: TextoDef;
  atual?: ConfigTexto;
  onFechar: () => void;
  onPublicado: () => void | Promise<void>;
  onRestaurado?: () => void | Promise<void>;
  /** Prévia local (não publicada) aplicada ao vivo no texto da tela. */
  onPrevia?: (cfg: ConfigTexto | null) => void;
}

/**
 * Painel contextual de um TEXTO editável (bottom sheet): conteúdo (quando o texto
 * é estático), tamanho, peso, cor e alinhamento, com prévia ao vivo no próprio
 * componente. Publica/remonta na tabela app_ui_config (só admin, via RLS).
 */
export function PainelTexto({ def, atual, onFechar, onPublicado, onRestaurado, onPrevia }: PainelTextoProps) {
  const [conteudo, setConteudo] = useState(atual?.conteudo ?? def.padrao);
  const [tamanho, setTamanho] = useState(atual?.estilo?.tamanhoPx ?? def.base.tamanhoPx);
  const [peso, setPeso] = useState(atual?.estilo?.peso ?? def.base.peso);
  const [cor, setCor] = useState(atual?.estilo?.cor ?? def.base.cor);
  const [alinhamento, setAlinhamento] = useState<'left' | 'center' | 'right'>(atual?.estilo?.alinhamento ?? def.base.alinhamento);
  const [erro, setErro] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  const cfg = useMemo<ConfigTexto>(() => ({
    tipo: 'texto',
    ...(def.conteudoEditavel && conteudo !== def.padrao ? { conteudo } : {}),
    estilo: { tamanhoPx: tamanho, peso, cor, alinhamento },
  }), [def.conteudoEditavel, def.padrao, conteudo, tamanho, peso, cor, alinhamento]);

  // Prévia ao vivo no componente da tela.
  useEffect(() => { onPrevia?.(cfg); }, [cfg, onPrevia]);
  useEffect(() => () => { onPrevia?.(null); }, [onPrevia]);

  async function publicar() {
    setPublicando(true); setErro(null);
    try {
      await publicarUiConfig(def.key, cfg);
      onPrevia?.(null);
      await onPublicado();
    } catch (e) {
      setErro((e as Error).message);
      setPublicando(false);
    }
  }

  async function restaurar() {
    if (!window.confirm('Restaurar o texto padrão? As alterações publicadas serão removidas.')) return;
    setRestaurando(true); setErro(null);
    try {
      await removerUiConfig(def.key);
      onPrevia?.(null);
      await (onRestaurado ?? onPublicado)();
    } catch (e) {
      setErro((e as Error).message);
      setRestaurando(false);
    }
  }

  function cancelar() { onPrevia?.(null); onFechar(); }
  const ocupado = publicando || restaurando;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-navy-950/40" onClick={cancelar}>
      <div className="mt-auto max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-20px_40px_-20px_rgba(11,31,58,0.5)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-navy-100" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-navy-900"><TextAa size={20} weight="bold" /> Texto</h2>
            <p className="text-[12px] text-navy-500">Ajuste o conteúdo e a aparência. A prévia aparece na tela atrás.</p>
          </div>
          <button onClick={cancelar} aria-label="Fechar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-500"><X size={18} weight="bold" /></button>
        </div>

        {def.conteudoEditavel ? (
          <div className="mt-4">
            <label className="field-label">Conteúdo</label>
            <textarea className="field-input min-h-[3rem] resize-y" value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-navy-50 p-2.5 text-[11px] text-navy-500">Este texto mostra um valor do sistema (número, data…). Você edita só a aparência; o conteúdo continua vindo dos dados reais.</p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="field-label mb-0">Tamanho</label>
            <span className="text-[12px] font-semibold tabular-nums text-navy-500">{tamanho}px</span>
          </div>
          <input type="range" min={10} max={48} step={1} value={tamanho} onChange={(e) => setTamanho(Number(e.target.value))} className="mt-1 w-full accent-mint-500" />
        </div>

        <div className="mt-4">
          <label className="field-label">Peso</label>
          <div className="flex gap-2">
            {PESOS.map(([v, label]) => (
              <button key={v} onClick={() => setPeso(v)}
                className={cn('flex-1 rounded-full py-2 text-[13px] font-semibold ring-1 transition', peso === v ? 'bg-mint-500 text-white ring-mint-500' : 'bg-white text-navy-600 ring-navy-200')}
                style={{ fontWeight: v }}>{label}</button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="field-label">Cor</label>
          <div className="flex flex-wrap items-center gap-2">
            {CORES.map((c) => (
              <button key={c} onClick={() => setCor(c)} aria-label={`Cor ${c}`}
                className={cn('h-8 w-8 rounded-full ring-2 transition', cor.toLowerCase() === c.toLowerCase() ? 'ring-navy-900' : 'ring-navy-100')}
                style={{ backgroundColor: c, boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : undefined }} />
            ))}
            <label className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-navy-100">
              <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="absolute -inset-2 h-12 w-12 cursor-pointer" aria-label="Cor personalizada" />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="field-label">Alinhamento</label>
          <div className="flex gap-2">
            {ALINHAR.map(([v, Icon]) => (
              <button key={v} onClick={() => setAlinhamento(v)} aria-label={`Alinhar ${v}`}
                className={cn('flex flex-1 items-center justify-center rounded-xl py-2.5 ring-1 transition', alinhamento === v ? 'bg-mint-500 text-white ring-mint-500' : 'bg-white text-navy-600 ring-navy-200')}>
                <Icon size={18} weight="bold" />
              </button>
            ))}
          </div>
        </div>

        {erro && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-[12px] font-medium text-red-600">{erro}</p>}

        <div className="mt-5 flex items-center gap-2">
          <button onClick={cancelar} disabled={ocupado} className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-navy-600 ring-1 ring-navy-100 disabled:opacity-60">Cancelar</button>
          {atual && (
            <button onClick={restaurar} disabled={ocupado}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-3 text-sm font-semibold text-red-600 ring-1 ring-navy-100 disabled:opacity-60" title="Restaurar padrão">
              <ArrowCounterClockwise size={16} weight="bold" /> Padrão
            </button>
          )}
          <button onClick={publicar} disabled={ocupado}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-mint-500 py-3 text-sm font-bold text-white disabled:opacity-60">
            {publicando ? 'Publicando…' : <><CheckCircle size={18} weight="fill" /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
