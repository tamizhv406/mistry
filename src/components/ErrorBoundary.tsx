import React, { Component, type ErrorInfo, type ReactNode } from "react";
interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(e: Error) { return { hasError: true, error: e }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error("[EB]", e, i); }
  render() {
    if (this.state.hasError) return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--color-charcoal, #1F2937)",color:"var(--color-text-inverse, #FFFFFF)",textAlign:"center",padding:32,gap:16}}>
        <div style={{fontSize:48}}>⚠️</div>
        <h2 style={{color:"var(--color-danger, #DC2626)",margin:0}}>Something went wrong</h2>
        <p style={{color:"var(--color-border-strong, #D6D3D1)",margin:0}}>{this.state.error?.message}</p>
        <button onClick={()=>window.location.reload()} style={{minHeight:44,padding:"10px 24px",background:"var(--color-primary, #F97316)",color:"var(--color-on-primary, #1F2937)",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>🔄 Reload App</button>
      </div>
    );
    return this.props.children;
  }
}
