import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import {
  adminAtualizarSituacao, adminExcluirInteressado, adminListarInteressadosLancamento,
  formatarWhatsApp, gerarCsvInteressados,
  ROTULO_PERFIL, ROTULO_PERIODO, ROTULO_TRANSPORTE, SITUACOES,
  type InteressadoLancamento, type SituacaoInteressado,
} from '@/data/prelancamento-admin';
import type { TipoInteresse } from '@/lib/interesse';

/**
 * Admin › "Interessados no lançamento".
 * Renderizado apenas dentro do painel (/admin), depois da verificação de papel;
 * os dados só chegam se o banco confirmar que a sessão é de administrador (RLS).
 */
export function InteressadosLancamento() {
  const [linhas, setLinhas] = useState<InteressadoLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<'todos' | TipoInteresse>('todos');
  const [situacao, setSituacao] = useState<'todas' | SituacaoInteressado>('todas');

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try { setLinhas(await adminListarInteressadosLancamento()); }
    catch { setErro('Não foi possível carregar os interessados no lançamento.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(
    () => linhas.filter((l) => (perfil === 'todos' || l.lead_type === perfil) && (situacao === 'todas' || l.status === situacao)),
    [linhas, perfil, situacao],
  );

  async function mudarSituacao(l: InteressadoLancamento, nova: SituacaoInteressado) {
    setOcupado(l.id); setAviso(null);
    const r = await adminAtualizarSituacao(l.id, nova);
    if (r.ok) setLinhas((ls) => ls.map((x) => (x.id === l.id ? { ...x, status: nova } : x)));
    setAviso(r.ok ? { tipo: 'ok', texto: 'Situação atualizada.' } : { tipo: 'erro', texto: `Não foi possível salvar: ${r.erro}` });
    setOcupado(null);
  }

  async function excluir(l: InteressadoLancamento) {
    if (!window.confirm(`Excluir definitivamente o cadastro de ${l.full_name}? Esta ação não pode ser desfeita.`)) return;
    setOcupado(l.id); setAviso(null);
    const r = await adminExcluirInteressado(l.id);
    if (r.ok) setLinhas((ls) => ls.filter((x) => x.id !== l.id));
    setAviso(r.ok ? { tipo: 'ok', texto: 'Cadastro excluído.' } : { tipo: 'erro', texto: `Não foi possível excluir: ${r.erro}` });
    setOcupado(null);
  }

  function exportarCsv() {
    const blob = new Blob([gerarCsvInteressados(filtradas)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vanbora-interessados-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const seletor = 'h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm';

  return (
    <section className="mt-8" aria-labelledby="titulo-interessados-lancamento">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-interessados-lancamento" className="font-display text-lg font-bold">Interessados no lançamento</h2>
          <p className="text-xs text-navy-500">
            {linhas.length} no total · {linhas.filter((l) => l.lead_type === 'motorista').length} motoristas · {linhas.filter((l) => l.lead_type === 'familia').length} famílias
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-navy-600">Perfil
            <select className={seletor} value={perfil} onChange={(e) => setPerfil(e.target.value as typeof perfil)}>
              <option value="todos">Todos</option><option value="motorista">Motoristas</option><option value="familia">Famílias</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-navy-600">Situação
            <select className={seletor} value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)}>
              <option value="todas">Todas</option>
              {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select>
          </label>
          <button className="btn btn-sm btn-ghost" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button className="btn btn-sm btn-navy" onClick={exportarCsv} disabled={filtradas.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV ({filtradas.length})
          </button>
        </div>
      </div>

      {aviso && <p role="status" className={`mb-3 rounded-xl p-3 text-sm ${aviso.tipo === 'ok' ? 'bg-mint-50 text-mint-800' : 'bg-red-50 text-red-700'}`}>{aviso.texto}</p>}
      {erro && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <div className="card overflow-hidden">
        {carregando && linhas.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-navy-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtradas.length === 0 ? (
          <p className="p-6 text-center text-sm text-navy-500">{linhas.length === 0 ? 'Nenhum interessado registrado ainda.' : 'Nenhum interessado com esses filtros.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
                <tr>
                  <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Escola e período</th><th className="px-4 py-3">Inscrição</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {filtradas.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-navy-900">{l.full_name}</span>
                      {l.resubmitted_at && <span className="chip ml-2 bg-amber-100 text-amber-800" title={`Reenviou o formulário em ${new Date(l.resubmitted_at).toLocaleString('pt-BR')}. O cadastro original foi mantido.`}>reenviado</span>}
                      {l.lead_type === 'familia' && l.street_address && (
                        <p className="mt-0.5 text-xs text-navy-500">{l.street_address}, {l.address_number} — {l.neighborhood}{l.address_complement ? ` (${l.address_complement})` : ''}</p>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`chip ${l.lead_type === 'motorista' ? 'bg-navy-900 text-white' : 'bg-mint-100 text-mint-800'}`}>{ROTULO_PERFIL[l.lead_type]}</span></td>
                    <td className="px-4 py-3">
                      <a className="font-medium text-navy-900 underline-offset-2 hover:underline" href={`https://wa.me/${l.whatsapp_e164.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{formatarWhatsApp(l.whatsapp_e164)}</a>
                      {l.email && <p className="mt-0.5 break-all text-xs text-navy-500">{l.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-navy-700">
                      {l.school_name ? <>{l.school_name}<p className="mt-0.5 text-xs text-navy-500">{l.school_shift ? ROTULO_PERIODO[l.school_shift] : ''}{l.transport_direction ? ` · ${ROTULO_TRANSPORTE[l.transport_direction]}` : ''}</p></> : <span className="text-navy-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-navy-600">{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <select aria-label={`Situação de ${l.full_name}`} className={seletor} value={l.status} disabled={ocupado === l.id}
                        onChange={(e) => mudarSituacao(l, e.target.value as SituacaoInteressado)}>
                        {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-navy-400 hover:bg-red-50 hover:text-red-700" disabled={ocupado === l.id}
                        onClick={() => excluir(l)} aria-label={`Excluir cadastro de ${l.full_name}`} title="Excluir (pedido do titular)">
                        {ocupado === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
