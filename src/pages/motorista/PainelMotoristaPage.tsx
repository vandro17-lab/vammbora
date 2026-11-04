import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bus, Route as RouteIcon, User, FileText, Search, Plus, ChevronRight, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { MotoristaShell, ExigirMotorista } from './MotoristaShell';
import { listarVeiculos, listarRotas } from '@/data/motorista-store';
import type { Veiculo, Rota } from '@/types/motorista';

export function PainelMotoristaPage() {
  return (
    <ExigirMotorista>
      <Painel />
    </ExigirMotorista>
  );
}

function Painel() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      setErro(false);
      try {
        const [v, r] = await Promise.all([listarVeiculos(), listarRotas()]);
        if (vivo) { setVeiculos(v); setRotas(r); }
      } catch {
        if (vivo) setErro(true);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const temVan = veiculos.length > 0;
  const rotasConcluidas = rotas.filter((r) => r.status === 'concluida').length;

  return (
    <MotoristaShell titulo="Meu painel">
      <h1 className="font-display text-2xl font-bold">Olá! 👋</h1>
      <p className="mt-1 text-navy-600">Monte seu cadastro no seu ritmo. Cada parte pode ser feita em um momento.</p>

      {erro && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Não foi possível carregar seus dados. Recarregue a página.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Cartao
          Icone={Bus}
          titulo="Minha van"
          para="/painel/veiculos"
          pendencia={!temVan ? 'Falta adicionar sua van.' : undefined}
          acao={!temVan ? 'Adicionar van' : undefined}
          resumo={temVan ? `${veiculos.length} van(s) cadastrada(s)` : undefined}
          pronto={temVan}
          carregando={carregando}
        />
        <Cartao
          Icone={RouteIcon}
          titulo="Minhas rotas"
          para="/painel/rotas"
          pendencia={temVan && rotas.length === 0 ? 'Monte a rota que você já faz.' : undefined}
          acao={temVan && rotas.length === 0 ? 'Criar rota' : undefined}
          resumo={rotas.length > 0 ? `${rotas.length} rota(s) · ${rotasConcluidas} concluída(s)` : (!temVan ? 'Cadastre uma van primeiro' : undefined)}
          pronto={rotasConcluidas > 0}
          carregando={carregando}
        />
        <Cartao Icone={User} titulo="Meu perfil" para="/painel/perfil" resumo="Como as famílias te veem" />
        <Cartao
          Icone={FileText}
          titulo="Meus documentos"
          para="/painel/documentos"
          pendencia="Necessário para aparecer às famílias."
          resumo="Enviar e acompanhar a análise"
        />
        <Cartao
          Icone={Search}
          titulo="Onde estão procurando"
          para="/painel/procura"
          resumo="Veja a procura por região e escola"
        />
      </div>

      <p className="mt-6 text-center text-xs text-navy-400">
        Você só aparece para as famílias depois que seus documentos forem aprovados e sua rota estiver pronta.
      </p>
    </MotoristaShell>
  );
}

function Cartao({
  Icone, titulo, para, pendencia, acao, resumo, pronto, carregando,
}: {
  Icone: typeof Bus; titulo: string; para: string;
  pendencia?: string; acao?: string; resumo?: string; pronto?: boolean; carregando?: boolean;
}) {
  return (
    <Link to={para} className="card card-interactive group block p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
          <Icone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-bold text-navy-900">{titulo}</h2>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin text-navy-300" /> : pronto ? <CheckCircle2 className="h-4 w-4 text-mint-500" /> : null}
          </div>
          {resumo && <p className="mt-0.5 text-sm text-navy-500">{resumo}</p>}
          {pendencia && (
            <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {pendencia}
            </p>
          )}
          {acao && (
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-mint-700">
              <Plus className="h-4 w-4" /> {acao}
            </span>
          )}
          {!acao && (
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-navy-400 group-hover:text-navy-700">
              Abrir <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
