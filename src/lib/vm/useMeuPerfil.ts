import { useCallback, useEffect, useState } from 'react';
import { obterMeuPerfil, type PerfilMotorista } from '@/data/perfil-motorista';

export interface EstadoMeuPerfil {
  carregando: boolean;
  /** Erro REAL da consulta (null = sem erro). */
  erro: string | null;
  /** null = a conta ainda não tem perfil profissional. */
  perfil: PerfilMotorista | null;
  recarregar: () => void;
}

/** Perfil profissional da conta logada (estado vazio verdadeiro; erro real visível). */
export function useMeuPerfil(): EstadoMeuPerfil {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PerfilMotorista | null>(null);

  const carregar = useCallback(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    obterMeuPerfil()
      .then((p) => { if (vivo) setPerfil(p); })
      .catch((e) => { if (vivo) setErro((e as Error).message || 'Não foi possível carregar o seu perfil.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => carregar(), [carregar]);
  return { carregando, erro, perfil, recarregar: carregar };
}
