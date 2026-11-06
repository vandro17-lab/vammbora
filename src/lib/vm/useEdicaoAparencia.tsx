import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { PencilSimpleLine, Check, CursorClick } from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth';
import { useAppAssets } from '@/lib/vm/useAppAssets';
import { useUiConfig } from '@/lib/vm/useUiConfig';
import { type SlotDef } from '@/lib/vm/slots';
import { type ConfigTexto, type TextoDef } from '@/data/ui-config';
import { EditorArte } from '@/components/vm/EditorArte';
import { PainelTexto } from '@/components/vm/PainelTexto';

interface EdicaoAparenciaCtx {
  /** O modo "Editar aparência" pode ser oferecido (admin validado — ou DEV p/ testes). */
  disponivel: boolean;
  /** Modo de edição ativo (navegando as telas reais com as áreas destacadas). */
  ativo: boolean;
  /** Slot de imagem cujo editor está aberto, ou null. */
  slotAtivo: SlotDef | null;
  /** Texto cujo painel de propriedades está aberto, ou null. */
  textoAtivo: TextoDef | null;
  ativar: () => void;
  /** Ativa o modo por um atalho oculto (sem exigir a affordance de admin à vista). */
  ativarOculto: () => void;
  desativar: () => void;
  alternar: () => void;
  abrirEditor: (slot: SlotDef) => void;
  fecharEditor: () => void;
  abrirTexto: (def: TextoDef) => void;
  fecharTexto: () => void;
  /** URL de prévia local (não publicada) de um slot de imagem, se houver. */
  previaDe: (slotId: string) => string | undefined;
  /** Define/limpa a prévia local de um slot de imagem. */
  definirPrevia: (slotId: string, url: string | null) => void;
  /** Prévia local (não publicada) de um texto, se houver. */
  previaTextoDe: (key: string) => ConfigTexto | undefined;
  /** Define/limpa a prévia local de um texto (aplica ao vivo no componente). */
  definirPreviaTexto: (key: string, cfg: ConfigTexto | null) => void;
}

const Ctx = createContext<EdicaoAparenciaCtx>({
  disponivel: false, ativo: false, slotAtivo: null, textoAtivo: null,
  ativar: () => {}, ativarOculto: () => {}, desativar: () => {}, alternar: () => {},
  abrirEditor: () => {}, fecharEditor: () => {}, abrirTexto: () => {}, fecharTexto: () => {},
  previaDe: () => undefined, definirPrevia: () => {},
  previaTextoDe: () => undefined, definirPreviaTexto: () => {},
});

/** Em DEV, permite ativar o modo p/ testes via ?editar-aparencia=1 (sem Supabase). */
function flagDev(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try { return new URLSearchParams(window.location.search).has('editar-aparencia'); }
  catch { return false; }
}

/**
 * Provê o modo "Editar aparência": o admin ativa a edição enquanto navega pelas
 * telas reais; áreas editáveis (imagens e textos) ganham destaque discreto e, ao
 * tocar, abrem o editor/painel no próprio layout. Fora do modo, nada muda.
 *
 * A permissão real é validada no banco (RLS + is_admin): este contexto só decide
 * se a AFFORDANCE aparece; publicar/remover seguem barrados para não-admins.
 */
export function EdicaoAparenciaProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const [ativo, setAtivo] = useState(false);
  const [slotAtivo, setSlotAtivo] = useState<SlotDef | null>(null);
  const [textoAtivo, setTextoAtivo] = useState<TextoDef | null>(null);
  const [previas, setPrevias] = useState<Record<string, string>>({});
  const [previasTexto, setPreviasTexto] = useState<Record<string, ConfigTexto>>({});

  const disponivel = isAdmin || flagDev();

  const definirPrevia = useCallback((slotId: string, url: string | null) => {
    setPrevias((prev) => {
      const prox = { ...prev };
      if (url) prox[slotId] = url; else delete prox[slotId];
      return prox;
    });
  }, []);
  const previaDe = useCallback((slotId: string) => previas[slotId], [previas]);

  const definirPreviaTexto = useCallback((key: string, cfg: ConfigTexto | null) => {
    setPreviasTexto((prev) => {
      const prox = { ...prev };
      if (cfg) prox[key] = cfg; else delete prox[key];
      return prox;
    });
  }, []);
  const previaTextoDe = useCallback((key: string) => previasTexto[key], [previasTexto]);

  const ativar = useCallback(() => { if (disponivel) setAtivo(true); }, [disponivel]);
  const ativarOculto = useCallback(() => setAtivo(true), []);
  const fecharEditor = useCallback(() => setSlotAtivo(null), []);
  const abrirEditor = useCallback((slot: SlotDef) => { setTextoAtivo(null); setSlotAtivo(slot); }, []);
  const fecharTexto = useCallback(() => setTextoAtivo(null), []);
  const abrirTexto = useCallback((def: TextoDef) => { setSlotAtivo(null); setTextoAtivo(def); }, []);
  const desativar = useCallback(() => {
    setAtivo(false);
    setSlotAtivo(null);
    setTextoAtivo(null);
    setPrevias({});
    setPreviasTexto({});
  }, []);
  const alternar = useCallback(() => (ativo ? desativar() : ativar()), [ativo, desativar, ativar]);

  const valor = useMemo<EdicaoAparenciaCtx>(() => ({
    disponivel, ativo, slotAtivo, textoAtivo, ativar, ativarOculto, desativar, alternar,
    abrirEditor, fecharEditor, abrirTexto, fecharTexto,
    previaDe, definirPrevia, previaTextoDe, definirPreviaTexto,
  }), [disponivel, ativo, slotAtivo, textoAtivo, ativar, ativarOculto, desativar, alternar,
    abrirEditor, fecharEditor, abrirTexto, fecharTexto, previaDe, definirPrevia, previaTextoDe, definirPreviaTexto]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <OverlaysEdicao />
    </Ctx.Provider>
  );
}

export const useEdicaoAparencia = () => useContext(Ctx);

/* ---------------- Overlays globais (indicador + editores no layout) ---------------- */
function OverlaysEdicao() {
  const {
    ativo, slotAtivo, textoAtivo, desativar, fecharEditor, definirPrevia, fecharTexto, definirPreviaTexto,
  } = useEdicaoAparencia();
  const { assets, recarregar } = useAppAssets();
  const { config, recarregar: recarregarConfig } = useUiConfig();

  if (!ativo) return null;
  const algumEditor = !!slotAtivo || !!textoAtivo;

  return (
    <>
      {/* Barra flutuante do modo de edição — no topo, nunca cobre a navegação inferior. */}
      {!algumEditor && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-[calc(30rem-2rem)] items-center gap-2 rounded-full bg-navy-900/95 px-3 py-2 text-white shadow-[0_12px_30px_-10px_rgba(11,31,58,0.7)] ring-1 ring-white/10 backdrop-blur">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-mint-500 text-white">
              <PencilSimpleLine size={16} weight="bold" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-[12px] font-bold">Editando aparência</p>
              <p className="flex items-center gap-1 text-[10px] text-white/70">
                <CursorClick size={11} weight="bold" /> toque nas áreas destacadas
              </p>
            </div>
            <button
              onClick={desativar}
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-mint-500 px-3 py-1.5 text-[12px] font-bold text-white active:scale-95"
            >
              <Check size={14} weight="bold" /> Encerrar
            </button>
          </div>
        </div>
      )}

      {/* Editor do slot de imagem selecionado. */}
      {slotAtivo && (
        <EditorArte
          slot={slotAtivo}
          atual={assets[slotAtivo.id]}
          onFechar={fecharEditor}
          onPrevia={(url) => definirPrevia(slotAtivo.id, url)}
          onPublicado={async () => { await recarregar(); fecharEditor(); }}
          onRestaurado={async () => { await recarregar(); fecharEditor(); }}
        />
      )}

      {/* Painel de propriedades do texto selecionado. */}
      {textoAtivo && (
        <PainelTexto
          def={textoAtivo}
          atual={config[textoAtivo.key] as ConfigTexto | undefined}
          onFechar={fecharTexto}
          onPrevia={(cfg) => definirPreviaTexto(textoAtivo.key, cfg)}
          onPublicado={async () => { await recarregarConfig(); fecharTexto(); }}
          onRestaurado={async () => { await recarregarConfig(); fecharTexto(); }}
        />
      )}
    </>
  );
}
