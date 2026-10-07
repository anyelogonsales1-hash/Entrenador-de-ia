import { useState } from "react";
import { 
  Sparkles, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  BookOpen, 
  Code, 
  Undo, 
  ArrowRight, 
  TrendingUp, 
  FileText, 
  Lightbulb, 
  FileCheck2, 
  ListRestart,
  Upload,
  Layers,
  HelpCircle,
  Save,
  History
} from "lucide-react";
import { PRESET_STYLES } from "./utils/presets";
import { computeWordDiff, extractCorrections, CorrectionChunk } from "./utils/diff";
import { HistoryItem, StyleTransferSegment } from "./types";
import StyleTransferWorkspace from "./components/StyleTransferWorkspace";
import StructureTrainingWorkspace from "./components/StructureTrainingWorkspace";

interface SavedBasePrompt {
  id: string;
  prompt: string;
  timestamp: string;
  note?: string;
}

export default function App() {
  // Manual system guidelines input
  const [systemInstruction, setSystemInstruction] = useState<string>(
    "Escribe en un tono profesional, claro, amigable pero corporativo. Evita el uso excesivo de exclamaciones e introduce cada idea con conectores elegantes."
  );

  // Persistent backups for base systemInstruction
  const [savedBasePrompts, setSavedBasePrompts] = useState<SavedBasePrompt[]>(() => {
    try {
      const stored = localStorage.getItem("saved_base_prompts");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Dynamic state
  const [topic, setTopic] = useState<string>("Un correo para dar la bienvenida a un cliente de software SaaS premium");
  const [originalText, setOriginalText] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");
  const [rawImportedText, setRawImportedText] = useState<string>("");
  const [userComment, setUserComment] = useState<string>("");
  
  // Learned Style rules extracted from user modifications
  const [learnedRules, setLearnedRules] = useState<string[]>([
    "Evita usar la frase introductoria genérica 'Espero que este mensaje te encuentre bien'.",
    "Prefiere oraciones cortas de menos de 15 palabras para mayor legibilidad."
  ]);
  
  // App state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isParsingPrompt, setIsParsingPrompt] = useState<boolean>(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [isProcessingText, setIsProcessingText] = useState<boolean>(false);
  
  // Workspace modes: 'edit' or 'diff'
  const [workspaceMode, setWorkspaceMode] = useState<"edit" | "diff">("edit");
  
  // History items & extracted corrections
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryItem, setActiveHistoryItem] = useState<HistoryItem | null>(null);
  
  // Meta-prompt output modal/panel
  const [metaPrompt, setMetaPrompt] = useState<string>("");
  const [showMetaModal, setShowMetaModal] = useState<boolean>(false);
  const [showTrainJustificationModal, setShowTrainJustificationModal] = useState<boolean>(false);

  // Individual correction comment states
  const [correctionComments, setCorrectionComments] = useState<{ [id: string]: string }>({});
  const [activeCorrectionToJustify, setActiveCorrectionToJustify] = useState<CorrectionChunk | null>(null);

  // Import prompt state
  const [showImportPromptModal, setShowImportPromptModal] = useState<boolean>(false);
  const [pastedPrompt, setPastedPrompt] = useState<string>("");

  // Paste clean text state
  const [showImportTextModal, setShowImportTextModal] = useState<boolean>(false);
  const [pastedCleanText, setPastedCleanText] = useState<string>("");
  const [customTextTitle, setCustomTextTitle] = useState<string>("Mi escrito original");

  // Dynamic suggested topics from AI
  interface AISuggestion {
    title: string;
    description: string;
    fullPrompt: string;
  }
  const [suggestedTopics, setSuggestedTopics] = useState<AISuggestion[]>([]);

  // Main Tab selector: 'training', 'style-transfer', or 'structure-training'
  const [mainTab, setMainTab] = useState<"training" | "style-transfer" | "structure-training">("training");

  // New Writing Style Copier / Transfer states
  const [styleTransferOriginal, setStyleTransferOriginal] = useState<string>(
    "Hola. Quería decirte que ya terminamos de revisar el software. Encontramos un par de errores menores pero ya están arreglados. El sistema funciona súper bien ahora y puedes entrar cuando quieras para probarlo. Avísanos cualquier cosa."
  );
  const [styleTransferReference, setStyleTransferReference] = useState<string>(
    "¡Buenas noticias! El proceso de auditoría técnica del software ha culminado exitosamente. Tras identificar y corregir dos vulnerabilidades de baja prioridad, el entorno se encuentra plenamente optimizado y disponible para su evaluación inmediata. Quedamos a su entera disposición para solventar cualquier duda."
  );
  const [styleTransferSegments, setStyleTransferSegments] = useState<StyleTransferSegment[]>([]);
  const [isTransferringStyle, setIsTransferringStyle] = useState<boolean>(false);
  const [isExportingStylePrompt, setIsExportingStylePrompt] = useState<boolean>(false);
  const [styleTransferPrompt, setStyleTransferPrompt] = useState<string>("");
  const [showStylePromptModal, setShowStylePromptModal] = useState<boolean>(false);
  
  // Toast notifications state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Preset quick selector
  const handleSelectPreset = (prompt: string) => {
    setSystemInstruction(prompt);
    showToast("✓ Plantilla de estilo aplicada");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1. Generate text from AI
  const handleGenerateText = async () => {
    if (!topic.trim()) {
      showToast("⚠️ Por favor escribe un tema o prompt para iniciar");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          systemInstruction,
          learnedRules
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al generar el texto");
      }

      const data = await res.json();
      setRawImportedText("");
      setOriginalText(data.generatedText);
      setEditedText(data.generatedText);
      setWorkspaceMode("edit");
      setCorrectionComments({});
      setActiveCorrectionToJustify(null);
      showToast("✨ ¡Texto generado exitosamente!");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Submit edits and train the model (learn rules from diff)
  const handleTrainWithEdits = async (commentOverride?: string) => {
    if (!originalText) {
      showToast("⚠️ Primero genera un texto o importa un escrito antes de entrenar");
      return;
    }

    if (originalText.trim() === editedText.trim()) {
      showToast("ℹ️ No has realizado cambios en el texto todavía. ¡Modifica palabras para entrenar!");
      return;
    }

    // Consolidate individual correction justifications
    const activeChunks = extractCorrections(diffParts);
    const individualCommentsList = activeChunks
      .map(chunk => {
        const comment = correctionComments[chunk.id];
        if (!comment || !comment.trim()) return null;
        return `- Se cambió "${chunk.before.trim() || '(vacío)'}" por "${chunk.after.trim() || '(vacío)'}": "${comment.trim()}"`;
      })
      .filter(Boolean);

    let consolidatedComment = "";
    const baseComment = commentOverride !== undefined ? commentOverride : userComment;
    if (baseComment && baseComment.trim()) {
      consolidatedComment += `${baseComment.trim()}\n\n`;
    }
    if (individualCommentsList.length > 0) {
      consolidatedComment += `JUSTIFICACIONES DE CAMBIOS ESPECÍFICOS:\n${individualCommentsList.join("\n")}`;
    }
    const finalComment = consolidatedComment.trim() || undefined;

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText,
          editedText,
          systemInstruction,
          learnedRules,
          userComment: finalComment
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al analizar los cambios");
      }

      const data = await res.json();
      
      // Merge rules without duplicates
      const newRules = data.detectedRules || [];
      const updatedRules = [...learnedRules];
      newRules.forEach((rule: string) => {
        if (!updatedRules.includes(rule)) {
          updatedRules.push(rule);
        }
      });
      
      setLearnedRules(updatedRules);

      // Save to local history list
      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        topic: topic,
        originalText: originalText,
        editedText: editedText,
        modificationsSummary: data.modificationsSummary || "Análisis de cambios estilísticos completado.",
        detectedRules: data.detectedRules || [],
        keyCorrections: data.keyCorrections || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userComment: finalComment || undefined
      };

      setHistory([newItem, ...history]);
      setActiveHistoryItem(newItem);
      
      // Update the current original text to match editedText so further changes can be tracked
      setOriginalText(editedText);
      setUserComment(""); // Reset the comment box
      
      showToast("🎯 ¡Entrenamiento exitoso! Se han aprendido nuevas reglas");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error al analizar: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. Parse and integrate existing prompt
  const handleImportPrompt = async () => {
    if (!pastedPrompt.trim()) {
      showToast("⚠️ Por favor pega un prompt válido");
      return;
    }

    setIsParsingPrompt(true);
    try {
      const res = await fetch("/api/parse-existing-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingPrompt: pastedPrompt })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al deconstruir el prompt");
      }

      const data = await res.json();
      
      if (data.baseGuidelines) {
        setSystemInstruction(data.baseGuidelines);
      }

      if (data.extractedRules && data.extractedRules.length > 0) {
        // Merge rules without duplicates
        const updatedRules = [...learnedRules];
        data.extractedRules.forEach((rule: string) => {
          if (!updatedRules.includes(rule)) {
            updatedRules.push(rule);
          }
        });
        setLearnedRules(updatedRules);
      }

      setShowImportPromptModal(false);
      setPastedPrompt("");
      showToast("🎯 ¡Prompt analizado e integrado con éxito al entrenamiento!");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error al importar prompt: ${err.message}`);
    } finally {
      setIsParsingPrompt(false);
    }
  };

  // 3b. Integrate learned rules directly into the base systemInstruction prompt
  const handleIntegrateRulesIntoBase = (rulesToIntegrate: string[], historyItemId?: string) => {
    if (!rulesToIntegrate || rulesToIntegrate.length === 0) {
      showToast("⚠️ No hay reglas o correcciones nuevas que integrar");
      return;
    }
    
    const currentBase = systemInstruction.trim();
    const formattedRules = rulesToIntegrate.map(r => `- ${r}`).join("\n");
    const newBase = currentBase 
      ? `${currentBase}\n\n### AJUSTES ADICIONALES APRENDIDOS:\n${formattedRules}`
      : `### AJUSTES ADICIONALES APRENDIDOS:\n${formattedRules}`;
    
    setSystemInstruction(newBase);
    
    // Remove from the dynamic learnedRules state to avoid duplication
    setLearnedRules(prev => prev.filter(r => !rulesToIntegrate.includes(r)));
    
    if (historyItemId) {
      setHistory(prev => prev.map(item => {
        if (item.id === historyItemId) {
          return { ...item, rulesIntegrated: true };
        }
        return item;
      }));
      setActiveHistoryItem(prev => prev && prev.id === historyItemId ? { ...prev, rulesIntegrated: true } : prev);
    }
    
    showToast("📥 Ajustes estilísticos integrados con éxito en las Instrucciones Base");
  };

  // 3c. Manage base prompt history (backups)
  const handleSaveBasePrompt = (customNote?: string) => {
    if (!systemInstruction.trim()) {
      showToast("⚠️ El prompt base está vacío.");
      return;
    }
    const note = customNote?.trim() || `Copia de seguridad #${savedBasePrompts.length + 1}`;
    const newBackup: SavedBasePrompt = {
      id: crypto.randomUUID(),
      prompt: systemInstruction,
      timestamp: new Date().toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }),
      note
    };
    const updated = [newBackup, ...savedBasePrompts];
    setSavedBasePrompts(updated);
    localStorage.setItem("saved_base_prompts", JSON.stringify(updated));
    showToast("💾 Copia de seguridad guardada en el historial");
  };

  const handleRestoreBasePrompt = (prompt: string) => {
    setSystemInstruction(prompt);
    showToast("🔄 Prompt base restaurado desde el historial");
  };

  const handleDeleteBasePrompt = (id: string) => {
    const updated = savedBasePrompts.filter(item => item.id !== id);
    setSavedBasePrompts(updated);
    localStorage.setItem("saved_base_prompts", JSON.stringify(updated));
    showToast("🗑️ Copia eliminada del historial");
  };

  const handleClearAllBasePrompts = () => {
    if (confirm("¿Estás seguro de que deseas borrar todo el historial de prompts base?")) {
      setSavedBasePrompts([]);
      localStorage.removeItem("saved_base_prompts");
      showToast("🗑️ Historial de prompts base vaciado");
    }
  };

  // 4. Import dynamic custom text directly (without generation)
  const handleImportCleanText = () => {
    if (!pastedCleanText.trim()) {
      showToast("⚠️ Por favor ingresa o pega un escrito válido");
      return;
    }

    const currentTitle = customTextTitle.trim() || "Escrito personalizado importado";
    setTopic(currentTitle);
    setRawImportedText(pastedCleanText);
    setOriginalText(pastedCleanText);
    setEditedText(pastedCleanText);
    setWorkspaceMode("edit");
    setCorrectionComments({});
    setActiveCorrectionToJustify(null);
    setShowImportTextModal(false);
    setPastedCleanText("");
    showToast("📝 Escrito importado. ¡Empieza a editarlo abajo para entrenar a la IA!");
  };

  // 4b. Import dynamic custom text and process it first using the current integrated prompt/learnedRules
  const handleImportAndProcessCleanText = async () => {
    if (!pastedCleanText.trim()) {
      showToast("⚠️ Por favor ingresa o pega un escrito válido");
      return;
    }

    setIsProcessingText(true);
    try {
      const res = await fetch("/api/process-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pastedCleanText,
          systemInstruction,
          learnedRules
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al procesar el escrito");
      }

      const data = await res.json();
      const currentTitle = customTextTitle.trim() || "Escrito personalizado importado";
      setTopic(currentTitle);
      
      // We set rawImportedText as the user's raw draft,
      // and originalText/editedText as the style-processed output.
      // That way, the baseline comparison for training ONLY registers
      // changes that the user does manually on top of the style-processed output!
      setRawImportedText(pastedCleanText);
      setOriginalText(data.processedText || pastedCleanText);
      setEditedText(data.processedText || pastedCleanText);
      setWorkspaceMode("edit");
      setCorrectionComments({});
      setActiveCorrectionToJustify(null);
      setShowImportTextModal(false);
      setPastedCleanText("");
      showToast("✨ Escrito procesado con tu estilo integrado. ¡Edítalo abajo para entrenar!");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error al procesar: ${err.message}`);
    } finally {
      setIsProcessingText(false);
    }
  };

  // 5. Ask AI to suggest interesting topics/tasks tailored to active style rules
  const handleGetAISuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      const res = await fetch("/api/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction,
          learnedRules
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al sugerir temas");
      }

      const data = await res.json();
      setSuggestedTopics(data.suggestions || []);
      showToast("💡 5 Ejercicios de ejemplo sugeridos por la IA");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error al sugerir temas: ${err.message}`);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // 5b. Style Transfer trigger
  const handleStyleTransfer = async () => {
    if (!styleTransferOriginal.trim()) {
      showToast("⚠️ Por favor ingresa el texto original (Documento 1)");
      return;
    }
    if (!styleTransferReference.trim()) {
      showToast("⚠️ Por favor ingresa el texto de referencia estilística (Documento 2)");
      return;
    }

    setIsTransferringStyle(true);
    try {
      const res = await fetch("/api/style-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: styleTransferOriginal,
          styleReferenceText: styleTransferReference
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al copiar estilo");
      }

      const data = await res.json();
      
      // Map segments adding client IDs and pending statuses
      const mappedSegments = (data.segments || []).map((seg: any) => ({
        ...seg,
        id: crypto.randomUUID(),
        status: "pending",
        editedBlock: seg.rewrittenBlock
      }));

      setStyleTransferSegments(mappedSegments);
      showToast("✨ Estilo copiado con éxito. Revisa y aprueba cada bloque.");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error al copiar estilo: ${err.message}`);
    } finally {
      setIsTransferringStyle(false);
    }
  };

  const handleUpdateSegmentStatus = (id: string, status: "pending" | "accepted" | "rejected") => {
    setStyleTransferSegments(prev =>
      prev.map(seg => (seg.id === id ? { ...seg, status } : seg))
    );
    if (status === "accepted") {
      showToast("✓ Bloque con nuevo estilo aceptado");
    } else if (status === "rejected") {
      showToast("✕ Bloque revertido a texto original");
    } else {
      showToast("🔄 Bloque devuelto a pendiente");
    }
  };

  const handleUpdateSegmentText = (id: string, newText: string) => {
    setStyleTransferSegments(prev =>
      prev.map(seg => (seg.id === id ? { ...seg, editedBlock: newText } : seg))
    );
  };

  const handleUpdateSegmentComment = (id: string, comment: string) => {
    setStyleTransferSegments(prev =>
      prev.map(seg => (seg.id === id ? { ...seg, userComment: comment } : seg))
    );
  };

  // 5c. Export style prompt
  const handleExportStylePrompt = async () => {
    const accepted = styleTransferSegments.filter(seg => seg.status === "accepted");
    if (accepted.length === 0) {
      showToast("⚠️ Primero debes aceptar al menos un cambio estilístico para exportar el prompt.");
      return;
    }

    setIsExportingStylePrompt(true);
    try {
      const res = await fetch("/api/export-style-transfer-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleReferenceText: styleTransferReference,
          baseInstruction: systemInstruction,
          acceptedSegments: accepted.map(s => ({
            originalBlock: s.originalBlock,
            rewrittenBlock: s.editedBlock || s.rewrittenBlock,
            detectedRules: s.detectedRules,
            styleApplied: s.styleApplied,
            userComment: s.userComment
          }))
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al exportar prompt de estilo");
      }

      const data = await res.json();
      setStyleTransferPrompt(data.stylePrompt);
      setShowStylePromptModal(true);
      showToast("📋 Prompt de estilo consolidado y listo");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error al exportar: ${err.message}`);
    } finally {
      setIsExportingStylePrompt(false);
    }
  };

  // 6. Export trained meta-prompt
  const handleExportMetaPrompt = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/export-meta-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction,
          learnedRules,
          history: history.slice(0, 5) // Send the last 5 training cases
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al exportar");
      }

      const data = await res.json();
      setMetaPrompt(data.metaPrompt);
      setShowMetaModal(true);
      showToast("📋 Prompt de entrenamiento consolidado");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error al exportar: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    showToast("📋 Copiado al portapapeles");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAddNewRule = () => {
    const rule = prompt("Escribe una regla de estilo personalizada:");
    if (rule && rule.trim()) {
      setLearnedRules([...learnedRules, rule.trim()]);
      showToast("✓ Regla agregada manualmente");
    }
  };

  const handleDeleteRule = (indexToDelete: number) => {
    setLearnedRules(learnedRules.filter((_, idx) => idx !== indexToDelete));
    showToast("🗑️ Regla de estilo eliminada");
  };

  // Compute live visual diff
  const diffParts = computeWordDiff(originalText, editedText);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-slide-in font-medium text-sm">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Sparkles className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                Laboratorio de Entrenamiento de Texto IA
              </h1>
              <p className="text-xs text-slate-500">
                Instruye a la IA, importa prompts, edita respuestas y extrae pautas de redacción dinámicas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Import existing prompt button */}
            <button
              onClick={() => setShowImportPromptModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-indigo-700 hover:text-indigo-800 font-semibold border border-indigo-200 rounded-lg shadow-xs text-xs transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Integrar Mi Prompt
            </button>

            {/* Reset stats */}
            <button
              onClick={() => {
                if (confirm("¿Estás seguro de reiniciar los datos del entrenamiento?")) {
                  setLearnedRules([
                    "Evita usar la frase introductoria genérica 'Espero que este mensaje te encuentre bien'.",
                    "Prefiere oraciones cortas de menos de 15 palabras para mayor legibilidad."
                  ]);
                  setOriginalText("");
                  setEditedText("");
                  setRawImportedText("");
                  setHistory([]);
                  setSuggestedTopics([]);
                  setActiveHistoryItem(null);
                  showToast("🔄 Sistema restablecido");
                }
              }}
              title="Restablecer entrenamiento"
              className="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 bg-white"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Consolidate master prompt */}
            <button
              onClick={handleExportMetaPrompt}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg shadow-sm transition-all text-xs cursor-pointer whitespace-nowrap"
            >
              {isExporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Consolidando...
                </>
              ) : (
                <>
                  <Code className="w-4 h-4" />
                  Consolidar Prompt Maestro
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Sub-navigation tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6">
          <button
            onClick={() => setMainTab("training")}
            className={`py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              mainTab === "training"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            Laboratorio de Entrenamiento
          </button>
          <button
            onClick={() => setMainTab("style-transfer")}
            className={`py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              mainTab === "style-transfer"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Copia de Estilo de Escritura
            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] rounded-full uppercase tracking-wider font-bold">Nuevo</span>
          </button>
          <button
            onClick={() => setMainTab("structure-training")}
            className={`py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              mainTab === "structure-training"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-500" />
            Estructura y Entregas
            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] rounded-full uppercase tracking-wider font-bold">Simulación</span>
          </button>
        </div>
      </div>

      {mainTab === "training" ? (
        /* Main Sandbox Layout */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: DNA / Rules / Presets Config (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Section 1: Base Manual Guidelines */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4.5 h-4.5 text-indigo-600" />
                1. Instrucciones Base del Estilo
              </h2>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase rounded-md tracking-wider">
                Configurable
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Escribe pautas generales de estilo y tono:
                </label>
                <button
                  onClick={() => setShowImportPromptModal(true)}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  ¿Ya tienes un prompt? Impórtalo
                </button>
              </div>
              <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                placeholder="Ejemplo: Escribe con entusiasmo, usa analogías de fútbol, nunca uses lenguaje corporativo seco..."
                className="w-full h-24 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 resize-none leading-relaxed"
              />
              
              {/* Manual Backup Trigger with custom Version Note */}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Nota corta de esta versión (ej: Tono amigable)..."
                  id="backup-note-input"
                  className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const input = e.currentTarget;
                      handleSaveBasePrompt(input.value);
                      input.value = "";
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById("backup-note-input") as HTMLInputElement | null;
                    handleSaveBasePrompt(input?.value || "");
                    if (input) input.value = "";
                  }}
                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 rounded-md transition-all text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  title="Guardar copia del prompt base en el historial persistente"
                >
                  <Save className="w-3.5 h-3.5 text-indigo-500" /> Respaldar Prompt
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                ¿O comenzar con una plantilla de estilo?
              </span>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                {PRESET_STYLES.map((style) => (
                  <button
                    key={style.name}
                    onClick={() => handleSelectPreset(style.prompt)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all text-xs group"
                  >
                    <div className="font-bold text-slate-800 group-hover:text-indigo-900 flex justify-between items-center">
                      <span>{style.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-indigo-500 transition-all transform translate-x-1" />
                    </div>
                    <div className="text-slate-500 mt-0.5 line-clamp-1">{style.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Historial de Respaldos de Prompt Base */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700">
                    Historial de Prompts Guardados ({savedBasePrompts.length})
                  </span>
                </div>
                {savedBasePrompts.length > 0 && (
                  <button
                    onClick={handleClearAllBasePrompts}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold transition-all cursor-pointer"
                  >
                    Borrar todo
                  </button>
                )}
              </div>

              {savedBasePrompts.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">
                  No tienes copias de seguridad guardadas todavía. Guarda tu prompt actual arriba para tener un respaldo.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {savedBasePrompts.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 bg-slate-50 border border-slate-200/60 rounded-lg flex flex-col gap-1.5 text-xs animate-fade-in group hover:bg-slate-100/50 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/40 pb-1">
                        <span className="font-bold text-slate-800 truncate" title={item.note}>
                          📝 {item.note || "Sin nota"}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {item.timestamp}
                        </span>
                      </div>
                      
                      {/* Truncated prompt preview */}
                      <p className="text-[11px] text-slate-600 line-clamp-2 italic whitespace-pre-wrap select-all bg-white/70 p-1.5 rounded border border-slate-100">
                        {item.prompt}
                      </p>

                      <div className="flex items-center justify-end gap-1.5 self-end mt-0.5">
                        <button
                          onClick={() => {
                            if (confirm("¿Estás seguro de que deseas cargar este prompt base del historial? Esto sobrescribirá el prompt base actual.")) {
                              handleRestoreBasePrompt(item.prompt);
                            }
                          }}
                          className="px-2 py-0.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer shadow-3xs"
                          title="Restaurar este prompt al editor"
                        >
                          <RotateCcw className="w-2.5 h-2.5" /> Cargar
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("¿Quieres eliminar este respaldo del historial?")) {
                              handleDeleteBasePrompt(item.id);
                            }
                          }}
                          className="p-1 hover:bg-rose-50 border border-transparent hover:border-rose-100 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer"
                          title="Borrar respaldo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Learned Rules list (Dynamic DNA) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                  2. Reglas de Estilo Aprendidas ({learnedRules.length})
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Extraídas automáticamente a partir de tus ediciones.
                </p>
              </div>
              <button
                onClick={handleAddNewRule}
                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border border-slate-200"
                title="Añadir regla manualmente"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {learnedRules.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Lightbulb className="w-8 h-8 text-amber-400 mb-2 animate-bounce" />
                <p className="text-xs font-semibold text-slate-700">Ninguna regla aprendida todavía</p>
                <p className="text-[10px] text-slate-500 max-w-xs mt-1">
                  Genera un texto, o pega tu propio escrito a la derecha, edítalo manualmente y haz click en "Guardar Cambios y Entrenar".
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[350px] pr-1">
                {learnedRules.map((rule, index) => (
                  <div
                    key={index}
                    className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg flex items-start justify-between gap-3 text-xs leading-relaxed group animate-fade-in"
                  >
                    <div className="flex gap-2">
                      <span className="text-emerald-700 font-bold mt-0.5">✓</span>
                      <span className="text-slate-800 font-medium">{rule}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(index)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 rounded-md hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Eliminar regla"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {learnedRules.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("¿Quieres integrar permanentemente estas reglas aprendidas en tu Prompt Base de la Sección 1? Se eliminarán de esta sección para evitar duplicados.")) {
                    handleIntegrateRulesIntoBase(learnedRules);
                  }
                }}
                className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                Integrar todas estas reglas en el Prompt Base
              </button>
            )}
            
            <div className="text-[11px] text-indigo-600 font-semibold bg-indigo-50/60 p-3 rounded-lg border border-indigo-100 flex items-start gap-2 leading-relaxed">
              <span className="font-bold">ProTip:</span>
              <span>Puedes importar tu propio prompt usando el botón superior "Integrar Mi Prompt". Nuestro analizador de deconstrucción lo integrará de inmediato para que sigas mejorándolo con nuevos textos.</span>
            </div>
          </div>
        </section>

        {/* Right Side: Interactive Sandbox / Writing Area (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Generation & Inputs Trigger Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                ¿Cómo quieres preparar tu ejercicio de entrenamiento?
              </h3>
              
              <button
                onClick={() => setShowImportTextModal(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Pegar mi propio escrito
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej. Un post de LinkedIn sobre los beneficios de programar en pareja..."
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 font-medium"
                />
                
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleGenerateText}
                    disabled={isGenerating}
                    className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Generar Texto
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleGetAISuggestions}
                    disabled={isLoadingSuggestions}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-all cursor-pointer"
                    title="Sugerir ejemplos creativos por IA para este estilo"
                  >
                    {isLoadingSuggestions ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                    ) : (
                      "✨ Ideas IA"
                    )}
                  </button>
                </div>
              </div>

              {/* Suggestions Grid */}
              {suggestedTopics.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 mt-1 animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      Ejercicios Recomendados por IA para tu estilo:
                    </span>
                    <button
                      onClick={() => setSuggestedTopics([])}
                      className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Ocultar
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {suggestedTopics.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setTopic(sug.fullPrompt);
                          showToast(`✓ Seleccionado: ${sug.title}`);
                        }}
                        className="text-left p-2.5 bg-white border border-slate-200 hover:border-indigo-200 rounded-lg hover:bg-indigo-50/20 transition-all text-[11px] flex flex-col justify-between h-24 group shadow-2xs"
                      >
                        <div className="font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-950">{sug.title}</div>
                        <div className="text-slate-500 line-clamp-2 mt-0.5 leading-snug">{sug.description}</div>
                        <span className="text-[9px] text-indigo-600 font-bold self-end mt-1 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          Usar →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Writing Sandbox Workspace */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex-col flex flex-1 min-h-[480px]">
            
            {/* Tab header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                  <FileCheck2 className="w-5 h-5 text-indigo-600" />
                  Área de Trabajo del Modelo
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modifica directamente el texto de abajo para enseñarle a la IA tu estilo exacto.
                </p>
              </div>

              {originalText && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-end sm:self-auto">
                  <button
                    onClick={() => setWorkspaceMode("edit")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      workspaceMode === "edit"
                        ? "bg-white text-indigo-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Editar Texto
                  </button>
                  <button
                    onClick={() => setWorkspaceMode("diff")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      workspaceMode === "diff"
                        ? "bg-white text-indigo-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Ver Diferencias (Diff)
                  </button>
                </div>
              )}
            </div>

            {/* Content Sandbox Area */}
            {!originalText ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-6 bg-slate-50/40 rounded-xl border border-dashed border-slate-200 my-auto">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 animate-pulse">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Laboratorio de Redacción Vacío</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                  Elige un tema arriba y haz click en "Generar Texto" o bien presiona "Pegar mi propio escrito" para subir un texto limpio que tú mismo corregirás.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTopic("Un correo para dar la bienvenida a un cliente de software SaaS premium");
                      handleGenerateText();
                    }}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Generar ejemplo por defecto
                  </button>
                  <button
                    onClick={() => setShowImportTextModal(true)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    Pega tu propio escrito
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4">
                {workspaceMode === "edit" ? (
                  <div className="flex-1 flex flex-col relative">
                    <div className="absolute top-2.5 right-2.5 z-10 flex gap-2">
                      <button
                        onClick={() => {
                          setEditedText(originalText);
                          showToast("🔄 Revertido al texto original de la IA");
                        }}
                        className="px-2.5 py-1.5 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Revertir cambios"
                      >
                        <Undo className="w-3.5 h-3.5" /> Revertir Cambios
                      </button>
                    </div>

                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full flex-1 min-h-[300px] p-4 pt-11 bg-slate-50 border border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm text-slate-900 leading-relaxed font-mono shadow-xs resize-none"
                      placeholder="Modifica, borra palabras o reescribe oraciones directamente en este editor..."
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-h-[300px] p-4 bg-slate-50 border border-slate-200 rounded-xl overflow-y-auto text-sm leading-relaxed font-mono whitespace-pre-wrap shadow-inner">
                    {diffParts.length === 0 ? (
                      <span className="text-slate-400">No se han realizado cambios en el texto generado por el momento.</span>
                    ) : (
                      diffParts.map((part, index) => {
                        if (part.type === "added") {
                          return (
                            <span 
                              key={index} 
                              className="bg-emerald-100 text-emerald-900 font-semibold px-0.5 rounded-sm border-b-2 border-emerald-400 animate-pulse decoration-emerald-600"
                              title="Agregado por ti"
                            >
                              {part.value}
                            </span>
                          );
                        } else if (part.type === "removed") {
                          return (
                            <span 
                              key={index} 
                              className="bg-rose-100 text-rose-900 line-through px-0.5 rounded-sm border-b-2 border-rose-400 decoration-rose-600"
                              title="Eliminado de la IA"
                            >
                              {part.value}
                            </span>
                          );
                        } else {
                          return <span key={index} className="text-slate-700">{part.value}</span>;
                        }
                      })
                    )}
                  </div>
                )}

                {/* 🎯 Correcciones de Forma Enmarcadas (Interactivas) */}
                {workspaceMode === "diff" && (
                  <div id="framed-corrections" className="mt-2 flex flex-col gap-3 border-t border-slate-100 pt-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                        </span>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          🎯 Correcciones de Forma Enmarcadas ({extractCorrections(diffParts).length})
                        </h4>
                      </div>
                      <p className="text-[10px] text-slate-500 italic hidden sm:block">
                        Haz click en cualquier cuadro para justificar tu cambio a la IA
                      </p>
                    </div>

                    {extractCorrections(diffParts).length === 0 ? (
                      <div className="p-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center text-xs text-slate-400">
                        No se detectaron correcciones individuales. Realiza cambios de palabras o frases en el editor de texto para verlas aquí.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[350px] overflow-y-auto pr-1">
                        {extractCorrections(diffParts).map((chunk) => {
                          const comment = correctionComments[chunk.id] || "";
                          const hasComment = comment.trim().length > 0;
                          return (
                            <div
                              key={chunk.id}
                              id={`correction-card-${chunk.id}`}
                              onClick={() => setActiveCorrectionToJustify(chunk)}
                              className={`group relative p-3 bg-white border rounded-xl cursor-pointer transition-all hover:shadow-md hover:border-indigo-400 active:scale-[0.99] flex flex-col justify-between gap-2.5 ${
                                hasComment
                                  ? "border-emerald-200 bg-emerald-50/10 hover:border-emerald-400"
                                  : "border-slate-200/90 hover:border-indigo-300"
                              }`}
                            >
                              <div className="flex flex-col gap-2">
                                {/* Context snippet */}
                                <div className="text-[10px] leading-relaxed text-slate-400 font-mono pb-1.5 border-b border-slate-100 flex items-center gap-1">
                                  <span className="text-slate-300 font-bold">CONTEXTO:</span>
                                  <span className="truncate max-w-[280px]">
                                    {chunk.contextBefore && <span>{chunk.contextBefore}</span>}
                                    <span className="mx-1 px-1 bg-indigo-50 text-indigo-700 font-bold rounded text-[9px]">
                                      CAMBIO
                                    </span>
                                    {chunk.contextAfter && <span>{chunk.contextAfter}</span>}
                                  </span>
                                </div>

                                {/* Side by side before/after */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="p-2 bg-rose-50/60 border border-rose-100/55 rounded-lg flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Antes (IA):</span>
                                    <span className="text-rose-900 font-mono line-through leading-relaxed break-words text-[11px] font-semibold">
                                      {chunk.before.trim() || <span className="italic text-rose-400/80">(vacío)</span>}
                                    </span>
                                  </div>
                                  <div className="p-2 bg-emerald-50/60 border border-emerald-100/55 rounded-lg flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Después (Tú):</span>
                                    <span className="text-emerald-900 font-mono leading-relaxed break-words text-[11px] font-bold">
                                      {chunk.after.trim() || <span className="italic text-emerald-400/80">(vacío)</span>}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Footer status bar */}
                              <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-100/70">
                                {hasComment ? (
                                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold max-w-[80%]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="truncate italic">
                                      💬 "{comment}"
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-slate-400 group-hover:text-indigo-600 font-medium flex items-center gap-1 transition-colors">
                                    <span>💬</span>
                                    <span>Haz click para justificar este cambio</span>
                                  </div>
                                )}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-all ${
                                  hasComment 
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-700"
                                }`}>
                                  {hasComment ? "Justificado" : "Agregar"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 💬 Justificación o Comentarios sobre las Correcciones */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2.5 shadow-3xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      💬 Justifica tus correcciones (Opcional)
                    </span>
                    <span className="text-[10px] bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
                      La IA aprenderá de esto
                    </span>
                  </div>
                  <input
                    type="text"
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    placeholder="Ej: 'Cambié el inicio para evitar clichés' o 'Prefiero palabras técnicas para sonar más formal'..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 rounded-lg text-xs leading-relaxed text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 leading-snug">
                    Al ingresar un comentario, la IA podrá extraer reglas mucho más específicas y precisas alineadas con tu lógica de escritura.
                  </p>
                </div>

                {/* 🗂️ Comparador y Recuperación de Borrador Original */}
                {rawImportedText && (
                  <div className="bg-amber-50/40 border border-amber-200/70 rounded-xl p-4 flex flex-col gap-3 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-200/40 pb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-600" />
                        <h4 className="font-bold text-amber-900 text-xs">
                          Comparador con tu Borrador Original Pegado
                        </h4>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm("¿Estás seguro de restaurar el borrador original completo en el editor? Esto reemplazará todo el texto editado actual.")) {
                            setEditedText(rawImportedText);
                            setOriginalText(rawImportedText); // Synchronize comparison baseline as well!
                            showToast("🔄 Borrador original completo cargado en el editor");
                          }
                        }}
                        className="text-[10px] font-bold bg-white hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md transition-all shadow-3xs cursor-pointer flex items-center gap-1"
                      >
                        <Undo className="w-3 h-3" /> Restaurar borrador completo
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left side: original raw text with selection */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                          📥 Tu borrador original (Haz doble click o copia):
                        </span>
                        <div className="bg-white border border-amber-200/60 p-3 rounded-lg max-h-40 overflow-y-auto text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap select-all selection:bg-amber-100">
                          {rawImportedText}
                        </div>
                        <p className="text-[9px] text-amber-700/80 leading-snug">
                          💡 Puedes seleccionar cualquier parte de este bloque de texto, copiarla con Ctrl+C, y pegarla de vuelta en el editor de arriba para restaurar partes borradas.
                        </p>
                      </div>

                      {/* Right side: diff overview */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
                          🔍 Cambios realizados por el Procesador de Estilo:
                        </span>
                        <div className="bg-white border border-slate-100 p-3 rounded-lg max-h-40 overflow-y-auto text-xs font-mono leading-relaxed whitespace-pre-wrap">
                          {(() => {
                            const rawDiff = computeWordDiff(rawImportedText, originalText);
                            if (rawDiff.length === 0) {
                              return <span className="text-slate-400">El procesador de estilo no hizo ningún cambio en este texto.</span>;
                            }
                            return rawDiff.map((part, index) => {
                              if (part.type === "added") {
                                return (
                                  <span 
                                    key={index} 
                                    className="bg-indigo-50 text-indigo-800 font-semibold px-0.5 rounded-sm border-b border-indigo-200"
                                    title="Agregado por el estilo integrado"
                                  >
                                    {part.value}
                                  </span>
                                );
                              } else if (part.type === "removed") {
                                return (
                                  <span 
                                    key={index} 
                                    className="bg-rose-50 text-rose-800 line-through px-0.5 rounded-sm border-b border-rose-200 decoration-rose-300"
                                    title="Modificado o eliminado por el estilo integrado"
                                  >
                                    {part.value}
                                  </span>
                                );
                              } else {
                                return <span key={index} className="text-slate-600">{part.value}</span>;
                              }
                            });
                          })()}
                        </div>
                        <p className="text-[9px] text-indigo-700/80 leading-snug">
                          🔍 El texto <span className="text-rose-600 line-through">rojo tachado</span> indica lo que fue descartado o cambiado del borrador original para adaptarlo.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Training Actions Panel */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    {originalText === editedText ? (
                      <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                        ✏️ Realiza cambios en el texto arriba para entrenar la IA
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                        ✨ ¡Cambios detectados! Listo para analizar y entrenar
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => {
                        if (!originalText) {
                          showToast("⚠️ Primero genera un texto o importa un escrito antes de entrenar");
                          return;
                        }
                        if (originalText.trim() === editedText.trim()) {
                          showToast("ℹ️ No has realizado cambios en el texto todavía. ¡Modifica palabras para entrenar!");
                          return;
                        }
                        setShowTrainJustificationModal(true);
                      }}
                      disabled={isAnalyzing || originalText === editedText}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Analizando cambios...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4.5 h-4.5" />
                          Guardar Cambios y Entrenar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    ) : mainTab === "style-transfer" ? (
      /* Style Transfer Workspace Layout */
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        <StyleTransferWorkspace
          styleTransferOriginal={styleTransferOriginal}
          setStyleTransferOriginal={setStyleTransferOriginal}
          styleTransferReference={styleTransferReference}
          setStyleTransferReference={setStyleTransferReference}
          styleTransferSegments={styleTransferSegments}
          isTransferringStyle={isTransferringStyle}
          isExportingStylePrompt={isExportingStylePrompt}
          handleStyleTransfer={handleStyleTransfer}
          handleUpdateSegmentStatus={handleUpdateSegmentStatus}
          handleUpdateSegmentText={handleUpdateSegmentText}
          handleUpdateSegmentComment={handleUpdateSegmentComment}
          handleExportStylePrompt={handleExportStylePrompt}
          showToast={showToast}
        />
      </main>
    ) : (
      /* Structure and Delivery Training Workspace Layout */
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 animate-fade-in">
        <StructureTrainingWorkspace showToast={showToast} />
      </main>
    )}

      {/* Footer / Training Logs Timeline */}
      <footer className="bg-slate-100 border-t border-slate-200 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {mainTab === "training" ? (
            <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ListRestart className="w-4.5 h-4.5 text-indigo-600" />
                  Historial de Casos y Correcciones de Entrenamiento ({history.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Detalle del aprendizaje incremental extraído en cada sesión de edición.
                </p>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                No se han registrado entrenamientos en esta sesión de laboratorio.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left: Interactive logs list */}
                <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveHistoryItem(item)}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                        activeHistoryItem?.id === item.id
                          ? "bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500"
                          : "bg-slate-50/50 border-slate-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-center gap-4 mb-1">
                        <span className="font-bold text-xs text-slate-900 line-clamp-1">
                          Tema: {item.topic}
                        </span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold shrink-0">
                          {item.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {item.modificationsSummary}
                      </p>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.detectedRules.map((rule, idx) => (
                          <span key={idx} className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] px-1.5 py-0.5 rounded font-medium">
                            + {rule.slice(0, 30)}...
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right: Selected historical analysis view */}
                {activeHistoryItem ? (
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-4">
                    <div className="border-b border-slate-100 pb-2.5">
                      <h4 className="font-bold text-slate-900 text-sm">
                        Análisis de Entrenamiento: {activeHistoryItem.topic}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Resumen de los ajustes aprendidos y aplicados para futuras iteraciones.
                      </p>
                    </div>

                    {/* Summary */}
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Resumen de Cambios del Usuario:
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {activeHistoryItem.modificationsSummary}
                      </p>
                    </div>

                    {/* User Comment Justification if present */}
                    {activeHistoryItem.userComment && (
                      <div>
                        <span className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">
                          Justificación proporcionada por ti:
                        </span>
                        <p className="text-xs text-indigo-900 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100/60 italic">
                          "{activeHistoryItem.userComment}"
                        </p>
                      </div>
                    )}

                    {/* Reglas estilísticas detectadas */}
                    {activeHistoryItem.detectedRules && activeHistoryItem.detectedRules.length > 0 && (
                      <div>
                        <div className="flex justify-between items-center mb-1.5 gap-2">
                          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Reglas Estilísticas Aprendidas:
                          </span>
                          {!activeHistoryItem.rulesIntegrated ? (
                            <button
                              onClick={() => handleIntegrateRulesIntoBase(activeHistoryItem.detectedRules, activeHistoryItem.id)}
                              className="text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Upload className="w-3.5 h-3.5" /> Integrar en Prompt Base
                            </button>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-bold flex items-center gap-1 border border-emerald-100 shrink-0">
                              <Check className="w-3.5 h-3.5" /> Integrado en Prompt Base
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {activeHistoryItem.detectedRules.map((rule, idx) => (
                            <div key={idx} className="p-2 bg-emerald-50/40 border border-emerald-100/60 rounded-lg text-xs text-slate-700 flex items-start gap-1.5 animate-fade-in">
                              <span className="text-emerald-600 font-bold">✓</span>
                              <span>{rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Word/Phrase corrections */}
                    {activeHistoryItem.keyCorrections && activeHistoryItem.keyCorrections.length > 0 && (
                      <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Vocabulario y Frases Corregidas:
                        </span>
                        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                          {activeHistoryItem.keyCorrections.map((corr, idx) => (
                            <div key={idx} className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs leading-relaxed">
                              <div className="grid grid-cols-2 gap-3 mb-1">
                                <div className="text-rose-700 bg-rose-50/50 p-1 rounded border border-rose-100">
                                  <span className="font-bold uppercase text-[9px] block text-rose-500">Antes (IA):</span>
                                  <span className="font-medium">"{corr.before}"</span>
                                </div>
                                <div className="text-emerald-800 bg-emerald-50/50 p-1 rounded border border-emerald-100">
                                  <span className="font-bold uppercase text-[9px] block text-emerald-600">Después (Usuario):</span>
                                  <span className="font-semibold">"{corr.after}"</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-500 italic mt-1 pl-1">
                                <span className="font-semibold text-slate-600">Razón:</span> {corr.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl flex items-center justify-center text-center p-8 text-slate-400 text-xs">
                    Selecciona un caso de entrenamiento a la izquierda para ver su análisis estilístico detallado.
                  </div>
                )}

              </div>
            )}
          </div>
          ) : (
            <div className="text-center text-slate-400 text-xs py-4">
              © 2026 Laboratorio de Entrenamiento de IA. Hecho con tecnología avanzada Gemini AI.
            </div>
          )}
        </div>
      </footer>

      {/* Style-Prompt Export Modal */}
      {showStylePromptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Reporte del Prompt Maestro de Estilo</h3>
                  <p className="text-xs text-slate-500">Informe detallado de mejoras, cambios, nuevos aprendizajes y cosas desechadas</p>
                </div>
              </div>
              <button
                onClick={() => setShowStylePromptModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-all">
              {styleTransferPrompt}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                ✓ Contiene auditoría estilística completa y prompt de sistema consolidado
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleCopyText(styleTransferPrompt, "style_prompt")}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  {copiedIndex === "style_prompt" ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copiado con éxito
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Reporte y Prompt
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Meta-Prompt Export Modal */}
      {showMetaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Reporte del Prompt Maestro de Entrenamiento</h3>
                  <p className="text-xs text-slate-500">Detalle de mejoras, cambios, nuevos aprendizajes y pautas desechadas</p>
                </div>
              </div>
              <button
                onClick={() => setShowMetaModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {metaPrompt}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                ✓ Auditoría completa + directrices consolidadas + lecciones descartadas
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleCopyText(metaPrompt, "meta")}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  {copiedIndex === "meta" ? (
                    <>
                      <Check className="w-4 h-4" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Reporte y Prompt
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowMetaModal(false)}
                  className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Import Existing Prompt Modal */}
      {showImportPromptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-100 text-indigo-800 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Integrar Mi Prompt Existente</h3>
                  <p className="text-xs text-slate-500">La IA lo deconstruirá en directrices de estilo y reglas aprendidas.</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportPromptModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Pega tu prompt o instrucciones completas aquí:
                </label>
                <textarea
                  value={pastedPrompt}
                  onChange={(e) => setPastedPrompt(e.target.value)}
                  placeholder="Ej. Eres un redactor alegre. Usa viñetas. Empieza cada párrafo con un emoji. Evita tecnicismos y escribe para un público general en español latino..."
                  className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm text-slate-800 leading-relaxed font-mono resize-none shadow-xs"
                />
              </div>
              
              <p className="text-[11px] text-slate-500 leading-relaxed">
                💡 Al hacer click abajo, enviaremos este prompt a Gemini para que identifique el estilo clave y extraiga reglas ordenadas de redacción que se cargarán en tu mapa de ADN de inmediato.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowImportPromptModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportPrompt}
                disabled={isParsingPrompt || !pastedPrompt.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                {isParsingPrompt ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analizando Prompt...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Deconstruir e Integrar
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Import Clean Text Direct Modal */}
      {showImportTextModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Cargar un Escrito Propio</h3>
                  <p className="text-xs text-slate-500">Carga un texto existente para corregirlo manualmente y entrenar a la IA.</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportTextModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Título de referencia / Contexto:
                </label>
                <input
                  type="text"
                  value={customTextTitle}
                  onChange={(e) => setCustomTextTitle(e.target.value)}
                  placeholder="Ej. Correo de seguimiento para prospecto"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Pega el escrito limpio a corregir:
                </label>
                <textarea
                  value={pastedCleanText}
                  onChange={(e) => setPastedCleanText(e.target.value)}
                  placeholder="Pega el texto original aquí. Luego podrás corregirlo directamente en el editor del Laboratorio de Entrenamiento..."
                  className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm text-slate-800 leading-relaxed font-mono resize-none shadow-xs"
                />
              </div>
              
              <p className="text-[11px] text-slate-500 leading-relaxed">
                💡 Este texto se registrará como el punto de inicio ("Antes"). Cualquier edición que realices sobre él en el área de trabajo será analizada para deducir nuevas reglas de estilo aplicables a futuros escritos.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-between items-center gap-3">
              <button
                onClick={() => setShowImportTextModal(false)}
                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={handleImportCleanText}
                  disabled={isProcessingText || !pastedCleanText.trim()}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
                  title="Cargar el escrito directamente para empezar a editarlo desde cero"
                >
                  Cargar Sin Procesar
                </button>
                
                <button
                  onClick={handleImportAndProcessCleanText}
                  disabled={isProcessingText || !pastedCleanText.trim()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  title="Usa tus pautas de estilo actuales para mejorar el escrito primero, y luego edítalo"
                >
                  {isProcessingText ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Procesando con Estilo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Procesar con Estilo Integrado
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 📝 Modal de Justificación Automática de Cambios (Entrenamiento Global) */}
      {showTrainJustificationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 animate-pulse text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">¿Por qué realizaste estas correcciones?</h3>
                  <p className="text-xs text-slate-500">Danos una pista de tu intención para refinar el estilo</p>
                </div>
              </div>
              <button
                onClick={() => setShowTrainJustificationModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Hemos detectado cambios en el texto. Para que la IA no se limite a la gramática general, cuéntanos la lógica de tus correcciones (ej: <i>"prefiero adjetivos formales en vez de coloquiales"</i>, <i>"quité muletillas"</i>, <i>"reorganicé para dar impacto"</i>). 
              </p>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Tu justificación / Comentario de estilo:
                </label>
                <textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="Ej: Prefiero oraciones directas, evité la voz pasiva y cambié el inicio para no sonar cliché..."
                  className="w-full h-28 p-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800 leading-relaxed font-mono resize-none shadow-3xs"
                  autoFocus
                />
              </div>
              
              <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/30">
                <p className="text-[10px] text-indigo-700 leading-snug flex gap-1.5 items-start">
                  <span>💡</span>
                  <span><b>Detección Inteligente de Cambios:</b> No necesitas detallar en qué oraciones editaste; la IA comparará el texto original y la versión editada, ubicará las modificaciones de forma autónoma y las interpretará usando este comentario como brújula estilística.</span>
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => {
                  setShowTrainJustificationModal(false);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                onClick={() => {
                  setShowTrainJustificationModal(false);
                  handleTrainWithEdits(userComment);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Entrenar sin justificar
              </button>

              <button
                onClick={() => {
                  setShowTrainJustificationModal(false);
                  handleTrainWithEdits(userComment);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Guardar y Entrenar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 📝 Modal de Justificación para Correcciones Enmarcadas Individuales */}
      {activeCorrectionToJustify && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 animate-pulse text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">¿Por qué corregiste este bloque?</h3>
                  <p className="text-[11px] text-slate-500">Dinos tu intención para entrenar el modelo en esta corrección</p>
                </div>
              </div>
              <button
                onClick={() => setActiveCorrectionToJustify(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-3.5 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150 text-[11px]">
                <div>
                  <span className="font-bold text-rose-500 uppercase tracking-wider block text-[9px] mb-0.5">Propuesta IA (Antes):</span>
                  <p className="text-rose-900 italic line-through font-mono leading-relaxed bg-rose-50/50 p-1.5 rounded break-all whitespace-pre-wrap">{activeCorrectionToJustify.before || <span className="text-rose-400/80 italic font-sans">(nuevo escrito)</span>}</p>
                </div>
                <div>
                  <span className="font-bold text-emerald-600 uppercase tracking-wider block text-[9px] mb-0.5">Tu Versión (Después):</span>
                  <p className="text-emerald-900 font-semibold font-mono leading-relaxed bg-emerald-50/50 p-1.5 rounded break-all whitespace-pre-wrap">{activeCorrectionToJustify.after || <span className="text-emerald-400/80 italic font-sans">(eliminado)</span>}</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Justificación / Comentario de esta corrección:
                </label>
                <textarea
                  value={correctionComments[activeCorrectionToJustify.id] || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCorrectionComments(prev => ({
                      ...prev,
                      [activeCorrectionToJustify.id]: val
                    }));
                  }}
                  placeholder="Ej: Es demasiado informal. Prefiero usar terminología más técnica y directa..."
                  className="w-full h-24 p-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800 leading-relaxed font-mono resize-none"
                  autoFocus
                />
              </div>

              <div className="bg-indigo-50/40 p-3 rounded-lg border border-indigo-100/20">
                <p className="text-[10px] text-indigo-700 leading-normal flex gap-1.5 items-start">
                  <span>💡</span>
                  <span><b>Justificaciones precisas:</b> Al explicar el porqué de este cambio exacto, la IA creará reglas hiper-enfocadas para evitar generar esa frase/palabra molesta en el futuro.</span>
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => {
                  setCorrectionComments(prev => {
                    const copy = { ...prev };
                    delete copy[activeCorrectionToJustify.id];
                    return copy;
                  });
                  setActiveCorrectionToJustify(null);
                  showToast("🗑️ Comentario eliminado");
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
              >
                Eliminar Comentario
              </button>

              <button
                onClick={() => {
                  setActiveCorrectionToJustify(null);
                  showToast("✓ Cambio conservado sin justificar");
                }}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-all cursor-pointer"
              >
                Omitir
              </button>

              <button
                onClick={() => {
                  setActiveCorrectionToJustify(null);
                  showToast("🎯 ¡Justificación guardada para esta corrección!");
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Guardar y Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
