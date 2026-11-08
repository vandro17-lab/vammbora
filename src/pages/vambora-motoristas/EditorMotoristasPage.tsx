import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PencilSimpleLine } from '@phosphor-icons/react';
import { X } from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { SubHeader } from '@/components/vm/ui';
import { Avatar } from '@/components/brand/Avatar';
import {
  listarMotoristasDemo, fotosDisponiveis, salvarOverride, limparOverride, type MotoristaDemo,
} from '@/data/motoristas-override';
import { cn } from '@/lib/utils';

/** Miniatura da foto com fallback para as iniciais. */
function FotoThumb({ src, nome, className }: { src?: string; nome: string; className?: string }) {
  const [erro, setErro] = useState(false);
  if (!src || erro) return <Avatar nome={nome} className={cn('text-sm', className)} />;
  return <img src={src} alt="" loading="lazy" draggable={false} onError={() => setErro(true)} className={cn('rounded-full bg-navy-100 object-cover', className)} />;
}

/**
 * Editor (admin) dos motoristas DEMONSTRATIVOS: ajusta nome e foto para corrigir
 * associações erradas. As alterações ficam só neste navegador e aparecem nos
 * resultados da busca da família.
 */
export function EditorMotoristasPage() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<MotoristaDemo[]>(() => listarMotoristasDemo());
  const [editando, setEditando] = useState<MotoristaDemo | null>(null);
  const fotos = fotosDisponiveis();
  const recarregar = () => setLista(listarMotoristasDemo());

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Editar motoristas" onVoltar={() => navigate('/app/mais')} />
      <div className="px-4 pb-16 pt-4">
        <p className="mb-3 text-sm text-navy-500">
          Corrija o <b className="font-semibold text-navy-700">nome</b> e a <b className="font-semibold text-navy-700">foto</b> dos motoristas.
          As alterações ficam só neste navegador e aparecem nos resultados da busca.
        </p>
        <ul className="space-y-2">
          {lista.map((m) => (
            <li key={m.slug}>
              <button onClick={() => setEditando(m)} className="vm-card vm-press flex w-full items-center gap-3 p-3 text-left">
                <FotoThumb src={m.imagem} nome={m.nome} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy-900">{m.nome}</p>
                  {m.editado
                    ? <p className="text-[11px] font-medium text-mint-700">editado</p>
                    : <p className="text-[11px] text-navy-400">padrão</p>}
                </div>
                <PencilSimpleLine size={18} className="shrink-0 text-navy-300" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {editando && (
        <EditorModal
          key={editando.slug}
          motorista={editando}
          fotos={fotos}
          onFechar={() => setEditando(null)}
          onSalvar={(nome, imagem) => { salvarOverride(editando.slug, { nome, imagem }); recarregar(); setEditando(null); }}
          onRestaurar={() => { limparOverride(editando.slug); recarregar(); setEditando(null); }}
        />
      )}
    </VMShell>
  );
}

function EditorModal({
  motorista, fotos, onFechar, onSalvar, onRestaurar,
}: {
  motorista: MotoristaDemo;
  fotos: string[];
  onFechar: () => void;
  onSalvar: (nome: string, imagem: string) => void;
  onRestaurar: () => void;
}) {
  const [nome, setNome] = useState(motorista.nome);
  const [imagem, setImagem] = useState(motorista.imagem);

  // Trava a rolagem do fundo e guarda a posição: o modal abre enquadrado na
  // tela e, ao fechar, a página volta para onde estava (igual no celular).
  useEffect(() => {
    const y = window.scrollY;
    const body = document.body;
    const anterior = body.style.cssText;
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => {
      body.style.cssText = anterior;
      window.scrollTo(0, y);
      window.removeEventListener('keydown', onKey);
    };
  }, [onFechar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${motorista.nomeOriginal}`}
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-navy-950/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-float sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <b className="font-display text-lg text-navy-900">Editar motorista</b>
          <button onClick={onFechar} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full text-navy-500 hover:bg-navy-50"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <FotoThumb src={imagem} nome={nome} className="h-16 w-16 shrink-0 ring-2 ring-white" />
            <div className="min-w-0 flex-1">
              <label className="field-label" htmlFor="m-nome">Nome</label>
              <input id="m-nome" className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          </div>

          <div>
            <p className="field-label">Foto</p>
            <div className="grid grid-cols-5 gap-2">
              {fotos.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setImagem(f)}
                  aria-pressed={imagem === f}
                  aria-label="Escolher esta foto"
                  className={cn('overflow-hidden rounded-xl ring-2 transition', imagem === f ? 'ring-mint-500' : 'ring-transparent hover:ring-navy-200')}
                >
                  <img src={f} alt="" loading="lazy" draggable={false} className="aspect-square w-full bg-navy-100 object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-navy-100 px-5 py-4">
          <button onClick={onRestaurar} className="text-sm font-medium text-navy-500 hover:text-navy-800">Restaurar padrão</button>
          <div className="flex-1" />
          <button onClick={onFechar} className="btn btn-sm btn-ghost">Cancelar</button>
          <button onClick={() => onSalvar(nome.trim() || motorista.nomeOriginal, imagem)} className="btn btn-sm btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  );
}
