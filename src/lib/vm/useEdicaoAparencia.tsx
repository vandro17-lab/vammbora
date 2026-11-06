import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { PencilSimpleLine, Check, CursorClick } from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth';
import { useAppAssets } from '@/lib/vm/useAppAssets';
import { type SlotDef } from '@/lib/vm/slots';
import { EditorArte } from '@/components/vm/EditorArte';

interface EdicaoAparenciaCtx {
  /** O modo "Editar aparência" pode ser oferecido (admin validado — ou DEV p/ testes). */
  disponivel: boolean;
  /** Modo de edição ativo (navegando as telas reais com as áreas destacadas). */
  ativo: boolean;
  /** Slot cujo editor está aberto (bottom sheet), ou null. */
  slotAtivo: SlotDef | null;
  ativar: () => void;
  /** Ativa o modo por um atalho oculto (sem exigir a affordance de admin à vista). */
  ativarOculto: () => void;
  desativar: () => void;
  alternar: () => void;
  abrirEditor: (slot: SlotDef) => void;
  fecharEditor: () => void;
  /** URL de prévia local (não publicada) de um slot, se houver. */
  previaDe: (slotId: string) => string | undefined;
  /** Define/limpa a prévia local de um slot (aplica ao vivo no componente). */
  definirPrevia: (slotId: string, url: string | null) => void;
}

const Ctx = createContext<EdicaoAparenciaCtx>({
  disponivel: false, ativo: false, slotAtivo: null,
  ativar: () => {}, ativarOculto: () => {}, desativar: () => {}, alternar: () => {},
  abrirEditor: () => {}, fecharEditor: () => {},
  previaDe: () => undefined, definirPrevia: () => {},
});

/** Em DEV, permite ativar o modo p/ testes via ?editar-aparencia=1 (sem Supabase). */
function flagDev(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try { return new URLSearchParams(window.location.search).has('editar-aparencia'); }
  catch { return false; }
}

/**
 * Provê o modo "Editar aparência": o admin ativa a edição enquanto navega pelas
 * telas reais; as áreas editáveis ganham um destaque discreto e, ao tocar, abrem
 * o editor no próprio layout. Fora do modo, o app funciona exatamente como antes.
 *
 * A permissão real é validada no banco (RLS + is_admin): este contexto só decide
 * se a AFFORDANCE aparece; qualquer publicação/remoção continua barrada pelas
 * políticas do Supabase para quem não for admin.
 */
export function EdicaoAparenciaProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const [ativo, setAtivo] = useState(false);
  const [slotAtivo, setSlotAtivo] = useState<SlotDef | null>(null);
  const [previas, setPrevias] = useState<Record<string, string>>({});

  const disponivel = isAdmin || flagDev();

  const definirPrevia = useCallback((slotId: string, url: string | null) => {
    setPrevias((prev) => {
      const prox = { ...prev };
      if (url) prox[slotId] = url; else delete prox[slotId];
      return prox;
    });
  }, []);

  const previaDe = useCallback((slotId: string) => previas[slotId], [previas]);

  const ativar = useCallback(() => { if (disponivel) setAtivo(true); }, [disponivel]);
  // Atalho oculto (ex.: toque secreto em Configurações): abre o modo sem exigir a
  // affordance de admin. Não concede escrita — publicar/remover seguem barrados
  // pelas políticas do banco para quem não for admin autenticado.
  const ativarOculto = useCallback(() => setAtivo(true), []);
  const fecharEditor = useCallback(() => setSlotAtivo(null), []);
  const abrirEditor = useCallback((slot: SlotDef) => setSlotAtivo(slot), []);
  const desativar = useCallback(() => {
    setAtivo(false);
    setSlotAtivo(null);
    setPrevias({});
  }, []);
  const alternar = useCallback(() => (ativo ? desativar() : ativar()), [ativo, desativar, ativar]);

  const valor = useMemo<EdicaoAparenciaCtx>(() => ({
    disponivel, ativo, slotAtivo, ativar, ativarOculto, desativar, alternar,
    abrirEditor, fecharEditor, previaDe, definirPrevia,
  }), [disponivel, ativo, slotAtivo, ativar, ativarOculto, desativar, alternar, abrirEditor, fecharEditor, previaDe, definirPrevia]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <OverlaysEdicao />
    </Ctx.Provider>
  );
}

export const useEdicaoAparencia = () => useContext(Ctx);

/* ---------------- Overlays globais (indicador + editor no layout) ---------------- */
function OverlaysEdicao() {
  const { ativo, slotAtivo, desativar, fecharEditor, definirPrevia } = useEdicaoAparencia();
  const { assets, recarregar } = useAppAssets();

  if (!ativo) return null;

  return (
    <>
      {/* Barra flutuante do modo de edição — no topo, nunca cobre a navegação inferior. */}
      {!slotAtivo && (
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

      {/* Editor do slot selecionado — edição no próprio layout. */}
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
    </>
  );
}
