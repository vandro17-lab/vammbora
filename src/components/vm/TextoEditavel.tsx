import type { CSSProperties, ElementType, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { PencilSimpleLine } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useUiConfig } from '@/lib/vm/useUiConfig';
import { useEdicaoAparencia } from '@/lib/vm/useEdicaoAparencia';
import { type ConfigTexto, type TextoDef } from '@/data/ui-config';

/**
 * Texto editável no layout. Renderiza o conteúdo/estilo publicado (ou a prévia
 * local durante a edição); sem nada publicado, usa o padrão. Fora do modo de
 * edição, é idêntico a um texto comum. Para textos DINÂMICOS (valores do banco),
 * passe `conteudoEditavel: false` na def e o valor via `children` — só a aparência
 * fica editável.
 */
export function TextoEditavel({ def, children, className, as, style: extra }: {
  def: TextoDef;
  children?: ReactNode;
  className?: string;
  as?: ElementType;
  style?: CSSProperties;
}) {
  const Tag = (as ?? 'span') as ElementType;
  const { configDe } = useUiConfig();
  const { ativo, abrirTexto, previaTextoDe } = useEdicaoAparencia();

  const cfg = (previaTextoDe(def.key) ?? configDe(def.key)) as ConfigTexto | undefined;
  const e = cfg?.estilo;
  const style: CSSProperties = {
    ...extra,
    ...(e?.tamanhoPx ? { fontSize: `${e.tamanhoPx}px` } : null),
    ...(e?.peso ? { fontWeight: e.peso } : null),
    ...(e?.cor ? { color: e.cor } : null),
    ...(e?.alinhamento ? { textAlign: e.alinhamento } : null),
  };
  const conteudo = def.conteudoEditavel ? (cfg?.conteudo ?? def.padrao) : children;

  if (!ativo) return <Tag className={className} style={style}>{conteudo}</Tag>;

  function abrir(ev: MouseEvent | KeyboardEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    abrirTexto(def);
  }

  return (
    <Tag
      className={cn('relative cursor-pointer rounded outline outline-1 outline-dashed outline-mint-400/90 outline-offset-2 transition', className)}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`Editar texto: ${def.padrao}`}
      data-texto-editavel={def.key}
      onClick={abrir}
      onKeyDown={(ev: KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') abrir(ev); }}
    >
      {conteudo}
      <span className="pointer-events-none absolute -right-1.5 -top-2.5 grid h-4 w-4 place-items-center rounded-full bg-mint-500 text-white shadow ring-2 ring-white">
        <PencilSimpleLine size={9} weight="bold" />
      </span>
    </Tag>
  );
}
