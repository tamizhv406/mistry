import React, { Component, ErrorInfo, ReactNode } from "react";
interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(e: Error) { return { hasError: true, error: e }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error("[EB]", e, i); }
  render() {
    if (this.state.hasError) return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0F172A",color:"#fff",textAlign:"center",padding:32,gap:16}}>
        <div style={{fontSize:48}}>⚠️</div>
        <h2 style={{color:"#EF4444",margin:0}}>Something went wrong</h2>
        <p style={{color:"#94A3B8",margin:0}}>{this.state.error?.message}</p>
        <button onClick={()=>window.location.reload()} style={{padding:"10px 24px",background:"#2563EB",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:14}}>🔄 Reload App</button>
      </div>
    );
    return this.props.children;
  }
}
