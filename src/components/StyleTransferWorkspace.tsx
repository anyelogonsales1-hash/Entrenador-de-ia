import React, { useState } from "react";
import { 
  Sparkles, 
  Check, 
  X, 
  Copy, 
  FileText, 
  ArrowRight, 
  Lightbulb, 
  HelpCircle,
  FileCheck2,
  ListRestart,
  Save,
  Code
} from "lucide-react";
import { StyleTransferSegment } from "../types";

interface StyleTransferWorkspaceProps {
  styleTransferOriginal: string;
  setStyleTransferOriginal: (val: string) => void;
  styleTransferReference: string;
  setStyleTransferReference: (val: string) => void;
  styleTransferSegments: StyleTransferSegment[];
  isTransferringStyle: boolean;
  isExportingStylePrompt: boolean;
  handleStyleTransfer: () => void;
  handleUpdateSegmentStatus: (id: string, status: "pending" | "accepted" | "rejected") => void;
  handleUpdateSegmentText: (id: string, text: string) => void;
  handleUpdateSegmentComment: (id: string, comment: string) => void;
  handleExportStylePrompt: () => void;
  showToast: (msg: string) => void;
}

export default function StyleTransferWorkspace({
  styleTransferOriginal,
  setStyleTransferOriginal,
  styleTransferReference,
  setStyleTransferReference,
  styleTransferSegments,
  isTransferringStyle,
  isExportingStylePrompt,
  handleStyleTransfer,
  handleUpdateSegmentStatus,
  handleUpdateSegmentText,
  handleUpdateSegmentComment,
  handleExportStylePrompt,
  showToast
}: StyleTransferWorkspaceProps) {
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null);
  const [justifyingSegment, setJustifyingSegment] = useState<StyleTransferSegment | null>(null);
  const [justificationText, setJustificationText] = useState<string>("");

  // Stats computation
  const totalBlocks = styleTransferSegments.length;
  const acceptedBlocks = styleTransferSegments.filter(s => s.status === "accepted").length;
  const rejectedBlocks = styleTransferSegments.filter(s => s.status === "rejected").length;
  const pendingBlocks = styleTransferSegments.filter(s => s.status === "pending").length;

  const handleCopyConsolidated = () => {
    const text = styleTransferSegments
      .map(seg => {
        if (seg.status === "accepted") {
          return seg.editedBlock || seg.rewrittenBlock;
        } else {
          return seg.originalBlock;
        }
      })
      .join("\n\n");
    
    if (!text.trim()) {
      showToast("⚠️ No hay texto consolidado disponible.");
      return;
    }

    navigator.clipboard.writeText(text);
    showToast("📋 ¡Escrito consolidado copiado con éxito!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "original" | "reference") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (target === "original") {
        setStyleTransferOriginal(text);
        showToast("📥 Documento 1 cargado con éxito");
      } else {
        setStyleTransferReference(text);
        showToast("📥 Documento 2 (Estilo) cargado con éxito");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      
      {/* Informative Banner */}
      <div className="bg-indigo-50/75 border border-indigo-100 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-start shadow-2xs">
        <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Copia de Estilo de Escritura Inteligente (Writing Style Copier)
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed mt-1">
            Esta herramienta clona todo el estilo de escritura, formato, musicalidad y tono de un documento de referencia y lo incorpora sobre el contenido de otro texto. Sube ambos textos, examina los cambios párrafo por párrafo, aprueba o rechaza los ajustes individuales y exporta el conjunto final como un Prompt para entrenar a tus asistentes de IA.
          </p>
        </div>
      </div>

      {/* Two Columns Inputs (Original vs. Style Reference) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Document 1: Original text to rewrite */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4 shadow-3xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-slate-100 text-slate-800 rounded-lg text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="font-bold text-slate-900 text-sm">Documento 1: Texto a Transformar</h3>
            </div>
            
            {/* File upload input */}
            <label className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer">
              <input 
                type="file" 
                accept=".txt,.md,.doc,.docx" 
                className="hidden" 
                onChange={(e) => handleFileUpload(e, "original")} 
              />
              <span>Subir archivo (.txt)</span>
            </label>
          </div>

          <textarea
            value={styleTransferOriginal}
            onChange={(e) => setStyleTransferOriginal(e.target.value)}
            placeholder="Pega el texto original o borrador básico aquí (el contenido de fondo que quieres reescribir con un estilo diferente)..."
            className="w-full h-48 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm text-slate-800 leading-relaxed resize-none shadow-3xs"
          />
          <div className="flex justify-between items-center text-[11px] text-slate-400">
            <span>Contiene la información y el mensaje de fondo</span>
            <span>{styleTransferOriginal.length} caracteres</span>
          </div>
        </div>

        {/* Document 2: Style reference source */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4 shadow-3xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="font-bold text-indigo-900 text-sm">Documento 2: Estilo de Referencia</h3>
            </div>
            
            {/* File upload input */}
            <label className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer">
              <input 
                type="file" 
                accept=".txt,.md,.doc,.docx" 
                className="hidden" 
                onChange={(e) => handleFileUpload(e, "reference")} 
              />
              <span>Subir archivo (.txt)</span>
            </label>
          </div>

          <textarea
            value={styleTransferReference}
            onChange={(e) => setStyleTransferReference(e.target.value)}
            placeholder="Pega el texto que tiene el estilo, voz y tono deseado (el patrón que quieres imitar)..."
            className="w-full h-48 p-3 bg-indigo-50/20 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm text-slate-800 leading-relaxed resize-none shadow-3xs"
          />
          <div className="flex justify-between items-center text-[11px] text-slate-400">
            <span className="text-indigo-600 font-medium">Contiene el estilo de redacción a imitar</span>
            <span>{styleTransferReference.length} caracteres</span>
          </div>
        </div>

      </div>

      {/* Trigger Button */}
      <div className="flex justify-center my-2">
        <button
          onClick={handleStyleTransfer}
          disabled={isTransferringStyle}
          className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all cursor-pointer text-sm"
        >
          {isTransferringStyle ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Copiando y Adaptando Estilo de Escritura...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4.5 h-4.5" />
              <span>Copiar y Transferir Estilo de Redacción</span>
            </>
          )}
        </button>
      </div>

      {/* Style Transfer Interactive Board Section */}
      {styleTransferSegments.length > 0 && (
        <div className="mt-4 flex flex-col gap-6 animate-fade-in">
          
          {/* Dashboard Header Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs">
            
            {/* Stat Counters */}
            <div className="flex items-center gap-4 flex-wrap justify-center lg:justify-start">
              <div className="text-slate-900 font-bold text-sm">
                Panel de Aceptación Interactiva:
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-full">
                  {pendingBlocks} Pendientes
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full">
                  {acceptedBlocks} Aceptados
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-bold rounded-full">
                  {rejectedBlocks} Rechazados
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 w-full lg:w-auto justify-center lg:justify-end">
              <button
                onClick={handleCopyConsolidated}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-200 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                title="Copiar texto combinando bloques aceptados y rechazados"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Escrito Final
              </button>

              <button
                onClick={handleExportStylePrompt}
                disabled={isExportingStylePrompt || acceptedBlocks === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-lg shadow-sm transition-all text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Exportar un prompt maestro de sistema en base a tus adaptaciones aprobadas"
              >
                {isExportingStylePrompt ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Consolidando Prompt...
                  </>
                ) : (
                  <>
                    <Code className="w-4 h-4" />
                    Exportar como Prompt de Estilo
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Guidelines info */}
          <p className="text-xs text-slate-500 italic mt-[-10px] px-1">
            * Haz click en <b>Aceptar</b> para incorporar la versión reescrita de la IA o edítala libremente en la caja de texto. Si prefieres la versión original sin cambios, haz click en <b>Rechazar</b>.
          </p>

          {/* Segments Loop */}
          <div className="flex flex-col gap-5">
            {styleTransferSegments.map((seg, idx) => {
              const isAccepted = seg.status === "accepted";
              const isRejected = seg.status === "rejected";
              const isPending = seg.status === "pending";

              let cardBg = "bg-white border-slate-200";
              if (isAccepted) cardBg = "bg-emerald-50/10 border-emerald-300 ring-1 ring-emerald-300";
              if (isRejected) cardBg = "bg-slate-50/50 border-slate-300";

              return (
                <div
                  key={seg.id}
                  className={`border rounded-2xl p-5 flex flex-col gap-4 transition-all shadow-2xs ${cardBg}`}
                >
                  
                  {/* Card Header with index and status badge */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-800 text-xs font-bold rounded-md">
                        Párrafo #{idx + 1}
                      </span>
                      {isAccepted && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Cambios Estilísticos Aceptados
                        </span>
                      )}
                      {isRejected && (
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> Revertido al Original
                        </span>
                      )}
                      {isPending && (
                        <span className="text-xs font-bold text-blue-600 animate-pulse">
                          ● Pendiente de Revisión
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const valToCopy = isAccepted ? (seg.editedBlock || seg.rewrittenBlock) : seg.originalBlock;
                          navigator.clipboard.writeText(valToCopy);
                          setCopiedSegmentId(seg.id);
                          setTimeout(() => setCopiedSegmentId(null), 1500);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 bg-white"
                        title="Copiar texto actual de este párrafo"
                      >
                        {copiedSegmentId === seg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Comparative text containers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Left side: Original text */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/50 text-xs flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Contenido Original:
                      </span>
                      <p className="text-slate-600 leading-relaxed font-mono whitespace-pre-wrap">
                        {seg.originalBlock}
                      </p>
                    </div>

                    {/* Right side: Styled re-write / Live edit */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs flex flex-col gap-1.5 shadow-3xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                          Adaptación Estilística (Editable):
                        </span>
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                          IA
                        </span>
                      </div>
                      
                      <textarea
                        value={seg.editedBlock !== undefined ? seg.editedBlock : seg.rewrittenBlock}
                        onChange={(e) => handleUpdateSegmentText(seg.id, e.target.value)}
                        onBlur={() => {
                          const isEdited = seg.editedBlock !== undefined && seg.editedBlock !== seg.rewrittenBlock;
                          if (isEdited && !seg.userComment) {
                            setJustifyingSegment(seg);
                            setJustificationText("");
                          }
                        }}
                        placeholder="Edita esta adaptación para darle tu toque personalizado..."
                        className="w-full h-28 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed font-mono text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />

                      <input
                        type="text"
                        value={seg.userComment || ""}
                        onChange={(e) => handleUpdateSegmentComment(seg.id, e.target.value)}
                        placeholder="💬 Justificación de la corrección / comentarios..."
                        className="w-full mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:border-indigo-200 focus:border-indigo-500 rounded-lg text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                    </div>

                  </div>

                  {/* Applied Rules Pills & explanations */}
                  <div className="p-3 bg-indigo-50/30 border border-indigo-100/40 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
                      Deconstrucción Estilística de la IA:
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      <b>Cambio:</b> {seg.styleApplied}
                    </p>
                    {seg.detectedRules && seg.detectedRules.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {seg.detectedRules.map((rule, idxRule) => (
                          <span
                            key={idxRule}
                            className="px-2 py-0.5 bg-white text-slate-700 font-medium border border-slate-200 rounded text-[10px]"
                          >
                            💡 {rule}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Accept / Reject controls */}
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {/* Revert / Reject */}
                    <button
                      onClick={() => handleUpdateSegmentStatus(seg.id, isRejected ? "pending" : "rejected")}
                      className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        isRejected
                          ? "bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300"
                          : "bg-white border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500"
                      }`}
                    >
                      <X className="w-3.5 h-3.5 text-rose-500" />
                      {isRejected ? "Deshacer rechazo" : "Rechazar (Mantener Original)"}
                    </button>

                    {/* Accept */}
                    <button
                      onClick={() => {
                        if (isAccepted) {
                          handleUpdateSegmentStatus(seg.id, "pending");
                        } else {
                          const isEdited = seg.editedBlock !== undefined && seg.editedBlock !== seg.rewrittenBlock;
                          if (isEdited && !seg.userComment) {
                            setJustifyingSegment(seg);
                            setJustificationText("");
                          } else {
                            handleUpdateSegmentStatus(seg.id, "accepted");
                          }
                        }
                      }}
                      className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1 border ${
                        isAccepted
                          ? "bg-emerald-100 border-emerald-200 text-emerald-800 hover:bg-emerald-200"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent hover:shadow-3xs"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isAccepted ? "Deshacer aprobación" : "Aprobar Estilo IA"}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Consolidated bottom button */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">¡Has revisado tus párrafos!</h4>
              <p className="text-xs text-slate-500 mt-1">
                Combina todas las aprobaciones y rechazos en un texto consolidado listo para publicar.
              </p>
            </div>
            <button
              onClick={handleCopyConsolidated}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              Copiar Todo el Escrito Consolidado ({acceptedBlocks}/{totalBlocks} Aprobados)
            </button>
          </div>

        </div>
      )}

      {/* Empty State when no segments loaded */}
      {styleTransferSegments.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 px-6 text-center flex flex-col items-center justify-center max-w-xl mx-auto shadow-xs mt-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 shadow-sm animate-pulse">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">¿Listo para clonar un estilo de escritura?</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
            Ingresa tu escrito base en el Documento 1, pega el estilo que quieres imitar en el Documento 2, y haz click en el botón <b>Copiar y Transferir Estilo</b>.
          </p>
          <div className="grid grid-cols-1 gap-2.5 mt-6 w-full text-left text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex gap-2">
              <span className="font-bold text-indigo-500">1.</span>
              <span>La IA segmentará tu borrador original de forma lógica.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-indigo-500">2.</span>
              <span>Reescribirá cada párrafo usando los patrones estilísticos del Documento 2.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-indigo-500">3.</span>
              <span>Podrás aceptar, rechazar o editar las propuestas individualmente.</span>
            </div>
          </div>
        </div>
      )}

      {/* 📝 Modal de Justificación Automática para Párrafos */}
      {justifyingSegment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center animate-pulse">
                  <Lightbulb className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">¿Por qué corregiste este párrafo?</h3>
                  <p className="text-[11px] text-slate-500">Dinos tu intención para entrenar el modelo en este bloque</p>
                </div>
              </div>
              <button
                onClick={() => setJustifyingSegment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-3.5 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150 text-[11px]">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px] mb-0.5">Propuesta IA:</span>
                  <p className="text-slate-500 italic line-through font-mono leading-relaxed bg-rose-50/50 p-1.5 rounded">{justifyingSegment.rewrittenBlock}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-500 uppercase tracking-wider block text-[9px] mb-0.5">Tu Versión Corregida:</span>
                  <p className="text-slate-800 font-semibold font-mono leading-relaxed bg-emerald-50/50 p-1.5 rounded">{justifyingSegment.editedBlock || justifyingSegment.rewrittenBlock}</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Justificación / Comentario (Opcional):
                </label>
                <textarea
                  value={justificationText}
                  onChange={(e) => setJustificationText(e.target.value)}
                  placeholder="Ej: El tono era demasiado informal, preferí usar terminología más técnica y directa para sonar formal..."
                  className="w-full h-24 p-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800 leading-relaxed font-mono resize-none"
                  autoFocus
                />
              </div>

              <div className="bg-indigo-50/40 p-3 rounded-lg border border-indigo-100/20">
                <p className="text-[10px] text-indigo-700 leading-normal flex gap-1.5 items-start">
                  <span>💡</span>
                  <span><b>Detección de Cambios Inteligente:</b> La IA comparará los dos bloques, detectará exactamente qué palabras reemplazaste o reescribiste, y aprenderá de tu justificación automáticamente.</span>
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setJustifyingSegment(null)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={() => {
                  handleUpdateSegmentStatus(justifyingSegment.id, "accepted");
                  setJustifyingSegment(null);
                  showToast("✓ Párrafo aprobado sin justificación");
                }}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-all cursor-pointer"
              >
                Omitir
              </button>

              <button
                onClick={() => {
                  handleUpdateSegmentComment(justifyingSegment.id, justificationText);
                  handleUpdateSegmentStatus(justifyingSegment.id, "accepted");
                  setJustifyingSegment(null);
                  showToast("🎯 ¡Comentario guardado y párrafo aprobado!");
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Guardar y Aprobar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
