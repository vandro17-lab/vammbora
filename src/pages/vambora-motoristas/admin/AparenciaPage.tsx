import { useState, type CSSProperties } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ImageSquare, UploadSimple, Trash, LockKey, CheckCircle, Info, PencilSimpleLine } from '@phosphor-icons/react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader } from '@/components/vm/ui';
import { EditorArte, proporcaoTexto, formatosTexto } from '@/components/vm/EditorArte';
import { useAuth } from '@/lib/auth';
import { USE_SUPABASE } from '@/lib/supabase';
import { useAppAssets } from '@/lib/vm/useAppAssets';
import { useEdicaoAparencia } from '@/lib/vm/useEdicaoAparencia';
import { removerAppAsset, type AppAsset } from '@/data/app-assets';
import { SLOTS, slotsPorGrupo, type SlotDef } from '@/lib/vm/slots';
import { cn } from '@/lib/utils';

/* -------- padrão xadrez (indica transparência) -------- */
const XADREZ: CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0px',
};

/* ============================ Página (com guarda) ============================ */
export function AparenciaPage() {
  const { session, isAdmin, carregando } = useAuth();
  const navigate = useNavigate();

  if (!USE_SUPABASE)
    return <Aviso icon={Info} titulo="Aparência"
      texto="O gerenciador de artes precisa do Supabase configurado. Neste ambiente de demonstração ele está desligado." />;
  if (carregando)
    return <Aviso icon={LockKey} titulo="Aparência" texto="Verificando permissão de administrador…" />;
  if (!session) return <Navigate to="/motorista/conta" replace />;
  if (!isAdmin)
    return <Aviso icon={LockKey} titulo="Aparência"
      texto="Acesso restrito. Esta área é exclusiva para administradores (validado no banco)." onVoltar={() => navigate('/app/mais')} />;

  return <Gerenciador />;
}

function Aviso({ icon: Icon, titulo, texto, onVoltar }: { icon: typeof Info; titulo: string; texto: string; onVoltar?: () => void }) {
  const navigate = useNavigate();
  return (
    <VMShell nav={false}>
      <SubHeader titulo={titulo} onVoltar={onVoltar ?? (() => navigate('/app/mais'))} />
      <div className="px-4 pt-6">
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-navy-50 text-navy-400"><Icon size={28} weight="duotone" /></span>
          <p className="max-w-xs text-sm text-navy-600">{texto}</p>
        </Card>
      </div>
    </VMShell>
  );
}

/* ============================== Gerenciador (índice completo) ============================== */
function Gerenciador() {
  const navigate = useNavigate();
  const { ativar } = useEdicaoAparencia();
  const { assets, recarregar } = useAppAssets();
  const [editando, setEditando] = useState<SlotDef | null>(null);
  const grupos = slotsPorGrupo();
  const publicados = SLOTS.filter((s) => assets[s.id]).length;

  function editarNasTelas() {
    ativar();
    navigate('/app/mais');
  }

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Aparência do app" onVoltar={() => navigate('/app/mais')} />
      <div className="space-y-5 px-4 pb-10 pt-4">
        <button onClick={editarNasTelas}
          className="vm-press flex w-full items-center gap-3 rounded-2xl bg-navy-900 p-3.5 text-left text-white shadow-card">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-400 text-navy-950"><PencilSimpleLine size={20} weight="bold" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold">Editar direto nas telas</p>
            <p className="text-[11px] text-white/70">Ative o modo de edição e personalize cada arte no próprio lugar.</p>
          </div>
        </button>

        <Card className="flex items-start gap-3 p-3.5">
          <span className="vm-chip-ico vm-ico-green shrink-0"><ImageSquare size={20} weight="duotone" /></span>
          <div>
            <p className="text-sm font-semibold text-navy-900">{publicados} de {SLOTS.length} espaços personalizados</p>
            <p className="mt-0.5 text-[12px] leading-snug text-navy-500">
              Esta é a lista completa dos espaços — útil para alcançar artes que não estão na tela aberta.
              Sem arte publicada, o app mantém o visual padrão. Prefira PNG/WebP com fundo transparente.
            </p>
          </div>
        </Card>

        {grupos.map(({ grupo, itens }) => (
          <section key={grupo} className="space-y-2.5">
            <h2 className="px-1 font-display text-sm font-bold text-navy-700">{grupo}</h2>
            <div className="space-y-2.5">
              {itens.map((s) => (
                <SlotCard key={s.id} slot={s} atual={assets[s.id]} onEditar={() => setEditando(s)} onMudou={recarregar} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {editando && (
        <EditorArte
          slot={editando}
          atual={assets[editando.id]}
          onFechar={() => setEditando(null)}
          onPublicado={async () => { await recarregar(); setEditando(null); }}
          onRestaurado={async () => { await recarregar(); setEditando(null); }}
        />
      )}
    </VMShell>
  );
}

/* ------------------------------- Cartão de slot ------------------------------- */
function SlotCard({ slot, atual, onEditar, onMudou }: {
  slot: SlotDef; atual?: AppAsset; onEditar: () => void; onMudou: () => Promise<void>;
}) {
  const [removendo, setRemovendo] = useState(false);
  const publicado = !!atual;

  async function remover() {
    if (!window.confirm(`Remover a arte de "${slot.titulo}"? O app volta ao visual padrão.`)) return;
    setRemovendo(true);
    try { await removerAppAsset(slot.id, atual?.storage_path); await onMudou(); }
    catch (e) { window.alert('Não foi possível remover: ' + (e as Error).message); }
    finally { setRemovendo(false); }
  }

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-navy-100" style={XADREZ}>
          {publicado ? <img src={atual!.url} alt="" className="h-full w-full object-contain" /> : <ImageSquare size={24} className="text-navy-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold leading-tight text-navy-900">{slot.titulo}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-navy-500">{slot.descricao}</p>
          <p className="mt-1 text-[11px] leading-snug text-navy-400">
            {slot.largura}×{slot.altura}px · proporção {proporcaoTexto(slot)} · {formatosTexto(slot)}{slot.transparencia ? ' · transparente' : ''}
          </p>
          <span className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
            publicado ? 'bg-mint-100 text-mint-700' : 'bg-navy-100 text-navy-500')}>
            {publicado ? <><CheckCircle size={12} weight="fill" /> Publicado</> : 'Usando padrão'}
          </span>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onEditar} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-mint-400 py-2.5 text-sm font-bold text-navy-950 active:scale-[0.99]">
          <UploadSimple size={16} weight="bold" /> {publicado ? 'Trocar arte' : 'Enviar arte'}
        </button>
        {publicado && (
          <button onClick={remover} disabled={removendo}
            className="flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-navy-100 disabled:opacity-60">
            <Trash size={16} weight="bold" />
          </button>
        )}
      </div>
    </Card>
  );
}
