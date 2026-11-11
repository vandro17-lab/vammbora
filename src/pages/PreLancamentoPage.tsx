import { Link } from 'react-router-dom';

export function PreLancamentoPage() {
  return <main style={{minHeight:'100dvh',background:'#FFC700',color:'#101820',fontFamily:'Inter, sans-serif',display:'grid',placeItems:'center',padding:'32px 20px'}}>
    <section style={{width:'100%',maxWidth:640,textAlign:'center'}}>
      <div style={{fontWeight:900,fontSize:48,letterSpacing:'-0.06em'}}>VanBora<span style={{color:'#fff'}}>.</span></div>
      <p style={{fontWeight:800,letterSpacing:'.12em',fontSize:12}}>MAIS VAGAS, MAIS CONEXÕES</p>
      <div style={{background:'#fff',borderRadius:28,padding:'36px 24px',marginTop:30,boxShadow:'0 16px 40px #0002'}}>
        <p style={{fontWeight:800,fontSize:14}}>🚐 ARAÇATUBA · SP</p>
        <h1 style={{fontSize:'clamp(32px,7vw,52px)',lineHeight:1.08,letterSpacing:'-.05em',margin:'18px 0'}}>Estamos chegando!</h1>
        <p style={{fontSize:18,lineHeight:1.55}}>Uma vitrine inteligente para conectar famílias que procuram transporte escolar a motoristas com vagas e rotas compatíveis.</p>
        <p style={{fontWeight:700,marginTop:26}}>Em breve: encontre ou seja encontrado.</p>
        <p style={{fontSize:14,color:'#53606a'}}>O cadastro de vans e rotas ainda não está disponível. Acompanhe as novidades pelo Instagram oficial do VanBora.</p>
      </div>
      <p style={{marginTop:28,fontSize:13}}><Link to="/privacidade" style={{color:'#101820',textDecoration:'underline'}}>Política de Privacidade</Link></p>
    </section>
  </main>;
}
