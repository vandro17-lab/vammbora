import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { UploadSimple, X, CheckCircle, Info, ArrowCounterClockwise, Eye } from '@phosphor-icons/react';
import { publicarAppAsset, removerAppAsset, type AppAsset } from '@/data/app-assets';
import { aspecto, TAMANHO_MAX_BYTES, type SlotDef } from '@/lib/vm/slots';
import { recortarParaBlob, type AreaPixels } from '@/lib/vm/recorte';

/* -------- padrão xadrez (indica transparência) -------- */
const XADREZ: CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0px',
};

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
export function proporcaoTexto(s: SlotDef): string { const g = gcd(s.largura, s.altura); return `${s.largura / g}:${s.altura / g}`; }
export function formatosTexto(s: SlotDef): string { return s.formatos.map((f) => f.split('/')[1].toUpperCase()).join(' / '); }

export interface EditorArteProps {
  slot: SlotDef;
  /** Arte publicada atual do slot (se houver). */
  atual?: AppAsset;
  /** Cancelar sem publicar. */
  onFechar: () => void;
  /** Publicação concluída (upload + registro confirmados). */
  onPublicado: () => void | Promise<void>;
  /** Arte removida (voltou ao visual padrão). */
  onRestaurado?: () => void | Promise<void>;
  /**
   * Prévia LOCAL (não publicada): recebe uma URL de objeto para aplicar a arte
   * ao vivo no próprio componente da tela (ou null para limpar). Quando presente,
   * o editor atualiza a prévia no layout real enquanto o admin enquadra.
   */
  onPrevia?: (url: string | null) => void;
}

/**
 * Editor de arte de um slot (bottom sheet): seleciona imagem, amplia/reposiciona,
 * mostra prévia aplicada no próprio componente da tela (quando `onPrevia` existe),
 * publica no Supabase (upload → registro, sem apagar a anterior antes de confirmar)
 * e permite restaurar o visual padrão. Reaproveitado pelo modo "Editar aparência"
 * e pelo índice completo do admin.
 */
export function EditorArte({ slot, atual, onFechar, onPublicado, onRestaurado, onPrevia }: EditorArteProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'image/png' | 'image/webp'>('image/png');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<AreaPixels | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  // Mantém referências das URLs de objeto para revogar e evitar vazamento.
  const srcRef = useRef<string | null>(null);
  const previewRef = useRef<string | null>(null);

  function revogar(ref: { current: string | null }) {
    if (ref.current) { URL.revokeObjectURL(ref.current); ref.current = null; }
  }

  // Limpeza ao desmontar: revoga URLs e limpa a prévia aplicada no layout.
  useEffect(() => {
    return () => {
      revogar(srcRef);
      revogar(previewRef);
      onPrevia?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function escolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro(null);
    setArea(null); setZoom(1); setCrop({ x: 0, y: 0 });
    if (!slot.formatos.includes(f.type)) { setErro(`Formato não aceito. Use ${formatosTexto(slot)}.`); return; }
    if (f.size > TAMANHO_MAX_BYTES) { setErro('Arquivo muito grande (máximo 5 MB).'); return; }
    setTipo(f.type === 'image/webp' ? 'image/webp' : 'image/png');
    revogar(srcRef);
    const u = URL.createObjectURL(f);
    srcRef.current = u;
    setSrc(u);
  }

  // Prévia ao vivo: regenera o recorte (debounce) quando o enquadramento muda e
  // aplica no próprio componente da tela via onPrevia.
  useEffect(() => {
    if (!src || !area) return;
    let cancelado = false;
    const id = window.setTimeout(async () => {
      try {
        const blob = await recortarParaBlob(src, area, { largura: slot.largura, altura: slot.altura }, tipo);
        if (cancelado) return;
        revogar(previewRef);
        const u = URL.createObjectURL(blob);
        previewRef.current = u;
        setPreviewUrl(u);
        onPrevia?.(u);
      } catch (e) {
        if (!cancelado) setErro((e as Error).message);
      }
    }, 220);
    return () => { cancelado = true; window.clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, area, zoom, tipo, slot.largura, slot.altura]);

  async function publicar() {
    if (!src || !area) { setErro('Selecione e enquadre uma imagem.'); return; }
    setPublicando(true); setErro(null);
    try {
      const blob = await recortarParaBlob(src, area, { largura: slot.largura, altura: slot.altura }, tipo);
      await publicarAppAsset(slot.id, blob, { width: slot.largura, height: slot.altura });
      onPrevia?.(null);            // a prévia dá lugar à arte publicada (recarregada)
      await onPublicado();         // só avança após upload + registro confirmados
    } catch (e) {
      setErro('Falha ao publicar: ' + (e as Error).message);
      setPublicando(false);
    }
  }

  async function restaurarPadrao() {
    if (!atual) return;
    if (!window.confirm(`Restaurar o visual padrão de "${slot.titulo}"? A arte publicada será removida.`)) return;
    setRestaurando(true); setErro(null);
    try {
      await removerAppAsset(slot.id, atual.storage_path);
      onPrevia?.(null);
      await (onRestaurado ?? onPublicado)();
    } catch (e) {
      setErro('Falha ao restaurar: ' + (e as Error).message);
      setRestaurando(false);
    }
  }

  function cancelar() {
    onPrevia?.(null);
    onFechar();
  }

  const ocupado = publicando || restaurando;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-navy-950/45" onClick={cancelar}>
      <div
        className="mt-auto max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-20px_40px_-20px_rgba(11,31,58,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-navy-100" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold text-navy-900">{slot.titulo}</h2>
            <p className="text-[12px] text-navy-500">
              {slot.largura}×{slot.altura}px · proporção {proporcaoTexto(slot)} · {formatosTexto(slot)}
            </p>
          </div>
          <button onClick={cancelar} aria-label="Fechar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-500">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-mint-50 p-2.5 text-[11px] leading-snug text-mint-800">
          <Info size={14} weight="fill" className="mt-0.5 shrink-0" />
          <span>{slot.areaSegura}</span>
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
            <div className="relative mt-4 h-60 w-full overflow-hidden rounded-2xl" style={XADREZ}>
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
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer text-[12px] font-semibold text-mint-700 underline">
                Trocar imagem
                <input type="file" accept={slot.formatos.join(',')} className="hidden" onChange={escolher} />
              </label>
              {previewUrl && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-navy-500">
                  <Eye size={14} weight="bold" className="text-mint-600" />
                  {onPrevia ? 'Prévia aplicada na tela atrás desta janela' : 'Prévia gerada abaixo'}
                </span>
              )}
            </div>

            {previewUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-navy-50 p-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg ring-1 ring-navy-100" style={XADREZ}>
                  <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                </div>
                <p className="text-[11px] text-navy-500">Prévia no tamanho final ({slot.largura}×{slot.altura}px). Nada é publicado antes de você confirmar.</p>
              </div>
            )}
          </>
        )}

        {erro && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-[12px] font-medium text-red-600">{erro}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button onClick={cancelar} disabled={ocupado} className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-navy-600 ring-1 ring-navy-100 disabled:opacity-60">
            Cancelar
          </button>
          {atual && (
            <button onClick={restaurarPadrao} disabled={ocupado}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-3 text-sm font-semibold text-red-600 ring-1 ring-navy-100 disabled:opacity-60"
              title="Restaurar visual padrão">
              <ArrowCounterClockwise size={16} weight="bold" />
              Padrão
            </button>
          )}
          <button onClick={publicar} disabled={!src || ocupado}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-mint-500 py-3 text-sm font-bold text-white disabled:opacity-60">
            {publicando ? 'Publicando…' : <><CheckCircle size={18} weight="fill" /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
