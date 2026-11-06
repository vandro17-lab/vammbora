import { useState, type ChangeEvent, type CSSProperties } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { ImageSquare, UploadSimple, Trash, Eye, LockKey, X, CheckCircle, Info } from '@phosphor-icons/react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader } from '@/components/vm/ui';
import { useAuth } from '@/lib/auth';
import { USE_SUPABASE } from '@/lib/supabase';
import { useAppAssets } from '@/lib/vm/useAppAssets';
import { publicarAppAsset, removerAppAsset, type AppAsset } from '@/data/app-assets';
import { SLOTS, slotsPorGrupo, aspecto, TAMANHO_MAX_BYTES, type SlotDef } from '@/lib/vm/slots';
import { recortarParaBlob, type AreaPixels } from '@/lib/vm/recorte';
import { cn } from '@/lib/utils';

/* -------- padrão xadrez (indica transparência) -------- */
const XADREZ: CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0px',
};

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function proporcaoTexto(s: SlotDef): string { const g = gcd(s.largura, s.altura); return `${s.largura / g}:${s.altura / g}`; }
function formatosTexto(s: SlotDef): string { return s.formatos.map((f) => f.split('/')[1].toUpperCase()).join(' / '); }

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

/* ============================== Gerenciador ============================== */
function Gerenciador() {
  const navigate = useNavigate();
  const { assets, recarregar } = useAppAssets();
  const [editando, setEditando] = useState<SlotDef | null>(null);
  const grupos = slotsPorGrupo();
  const publicados = SLOTS.filter((s) => assets[s.id]).length;

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Aparência do app" onVoltar={() => navigate('/app/mais')} />
      <div className="space-y-5 px-4 pb-10 pt-4">
        <Card className="flex items-start gap-3 p-3.5">
          <span className="vm-chip-ico vm-ico-green shrink-0"><ImageSquare size={20} weight="duotone" /></span>
          <div>
            <p className="text-sm font-semibold text-navy-900">{publicados} de {SLOTS.length} espaços personalizados</p>
            <p className="mt-0.5 text-[12px] leading-snug text-navy-500">
              Envie imagens profissionais nos espaços abaixo. Sem arte publicada, o app mantém o visual padrão.
              Prefira PNG/WebP com fundo transparente. Nada é publicado antes de o envio ser confirmado.
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
        <EditorArte slot={editando} onFechar={() => setEditando(null)}
          onPublicado={async () => { await recarregar(); setEditando(null); }} />
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
        <button onClick={onEditar} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-mint-500 py-2.5 text-sm font-semibold text-white active:scale-[0.99]">
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

/* ------------------------------- Editor (recorte) ------------------------------- */
function EditorArte({ slot, onFechar, onPublicado }: {
  slot: SlotDef; onFechar: () => void; onPublicado: () => Promise<void>;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'image/png' | 'image/webp'>('image/png');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<AreaPixels | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);

  function escolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro(null); setPreviewUrl(null); setArea(null); setZoom(1); setCrop({ x: 0, y: 0 });
    if (!slot.formatos.includes(f.type)) { setErro(`Formato não aceito. Use ${formatosTexto(slot)}.`); return; }
    if (f.size > TAMANHO_MAX_BYTES) { setErro('Arquivo muito grande (máximo 5 MB).'); return; }
    setTipo(f.type === 'image/webp' ? 'image/webp' : 'image/png');
    setSrc(URL.createObjectURL(f));
  }

  async function gerarPrevia() {
    if (!src || !area) return;
    try { const blob = await recortarParaBlob(src, area, { largura: slot.largura, altura: slot.altura }, tipo); setPreviewUrl(URL.createObjectURL(blob)); }
    catch (e) { setErro((e as Error).message); }
  }

  async function publicar() {
    if (!src || !area) { setErro('Selecione e enquadre uma imagem.'); return; }
    setPublicando(true); setErro(null);
    try {
      const blob = await recortarParaBlob(src, area, { largura: slot.largura, altura: slot.altura }, tipo);
      await publicarAppAsset(slot.id, blob, { width: slot.largura, height: slot.altura });
      await onPublicado(); // só avança após upload + registro confirmados
    } catch (e) {
      setErro('Falha ao publicar: ' + (e as Error).message);
      setPublicando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy-950/60" onClick={onFechar}>
      <div className="mt-auto max-h-[94dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-navy-100" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900">{slot.titulo}</h2>
            <p className="text-[12px] text-navy-500">{slot.largura}×{slot.altura}px · {proporcaoTexto(slot)} · {formatosTexto(slot)}</p>
          </div>
          <button onClick={onFechar} className="grid h-8 w-8 place-items-center rounded-full bg-navy-50 text-navy-500"><X size={18} weight="bold" /></button>
        </div>

        <div className="mt-2 rounded-xl bg-mint-50 p-2.5 text-[11px] leading-snug text-mint-800">
          <Info size={13} weight="fill" className="mr-1 inline" />Área segura: {slot.areaSegura}
        </div>

        {!src ? (
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 bg-navy-50/40 py-10 text-center">
            <UploadSimple size={30} weight="duotone" className="text-mint-600" />
            <span className="text-sm font-semibold text-navy-700">Escolher imagem</span>
            <span className="text-[11px] text-navy-400">{formatosTexto(slot)} · até 5 MB</span>
            <input type="file" accept={slot.formatos.join(',')} className="hidden" onChange={escolher} />
          </label>
        ) : (
          <>
            <div className="relative mt-4 h-72 w-full overflow-hidden rounded-2xl" style={XADREZ}>
              <Cropper
                image={src} crop={crop} zoom={zoom} aspect={aspecto(slot)}
                onCropChange={setCrop} onZoomChange={setZoom}
                onCropComplete={(_a, px) => setArea(px)}
                objectFit="contain" showGrid restrictPosition={false}
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] font-semibold text-navy-500">Zoom</span>
              <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-mint-500" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer text-[12px] font-semibold text-mint-700 underline">
                Trocar imagem
                <input type="file" accept={slot.formatos.join(',')} className="hidden" onChange={escolher} />
              </label>
              <button onClick={gerarPrevia} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy-600">
                <Eye size={15} weight="bold" /> Pré-visualizar
              </button>
            </div>

            {previewUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-navy-50 p-3">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg ring-1 ring-navy-100" style={XADREZ}>
                  <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                </div>
                <p className="text-[11px] text-navy-500">Prévia no tamanho final ({slot.largura}×{slot.altura}px). Confirme para publicar.</p>
              </div>
            )}
          </>
        )}

        {erro && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-[12px] font-medium text-red-600">{erro}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onFechar} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-navy-600 ring-1 ring-navy-100">Cancelar</button>
          <button onClick={publicar} disabled={!src || publicando}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-mint-500 py-3 text-sm font-bold text-white disabled:opacity-60">
            {publicando ? 'Publicando…' : <><CheckCircle size={18} weight="fill" /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
