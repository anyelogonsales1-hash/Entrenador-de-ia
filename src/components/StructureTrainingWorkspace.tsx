import React, { useState } from "react";
import { 
  Sparkles, 
  Trash2, 
  Plus, 
  Edit2, 
  ArrowUp, 
  ArrowDown, 
  Copy, 
  Check, 
  Info, 
  FileText, 
  Layers, 
  RefreshCw, 
  X, 
  AlertTriangle, 
  BookOpen, 
  CheckSquare, 
  Save,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StructureSimulation, ProjectSection, LLMConstraint } from "../types";

interface StructureTrainingWorkspaceProps {
  showToast: (msg: string) => void;
}

// Preset long project topics for easy selection
const PRESET_LONG_PROJECTS = [
  {
    title: "Manual de Políticas de Privacidad y Términos SaaS (30 Páginas)",
    topic: "Manual completo de políticas de privacidad, manejo de datos GDPR/CCPA y términos de servicio detallados para una plataforma SaaS multi-inquilino de finanzas.",
    constraints: "Divide el contenido en al menos 4 entregas secuenciales e incluye tablas de cláusulas específicas de indemnización."
  },
  {
    title: "Plan de Negocios para Cadena de Cafeterías Especializadas (25 Páginas)",
    topic: "Plan de negocios exhaustivo para una franquicia de cafés orgánicos y sustentables de especialidad, incluyendo análisis de mercado, plan de operaciones y proyección financiera.",
    constraints: "Debe estar pensado para inversionistas de capital de riesgo, estructurado en capítulos claros con presupuestos detallados por fase."
  },
  {
    title: "Libro Blanco de Inteligencia Artificial en Salud Pública (40 Páginas)",
    topic: "Whitepaper técnico y ético sobre la implementación de modelos predictivos y redes neuronales convolucionales en la detección temprana de patologías respiratorias.",
    constraints: "Estilo académico de alta densidad científica, con glosario estructurado y secciones de marco legal."
  }
];

export default function StructureTrainingWorkspace({ showToast }: StructureTrainingWorkspaceProps) {
  // Inputs
  const [projectTopic, setProjectTopic] = useState<string>(
    "Manual de marca y de tono de voz de 30 páginas para una startup fintech latinoamericana"
  );
  const [customConstraints, setCustomConstraints] = useState<string>(
    "Debe incluir una guía de palabras tabú (prohibidas) y un capítulo dedicado a la redacción de notificaciones push."
  );

  // States
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [simulation, setSimulation] = useState<StructureSimulation | null>(null);

  // Editing state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionEditForm, setSectionEditForm] = useState<ProjectSection | null>(null);

  // Output prompt state
  const [exportPromptResult, setExportPromptResult] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // Inline edits for overall project
  const [isEditingProjectMeta, setIsEditingProjectMeta] = useState<boolean>(false);
  const [editProjectName, setEditProjectName] = useState<string>("");
  const [editProjectDesc, setEditProjectDesc] = useState<string>("");

  const handleApplyPreset = (preset: typeof PRESET_LONG_PROJECTS[0]) => {
    setProjectTopic(preset.topic);
    setCustomConstraints(preset.constraints);
    showToast("✓ Parámetros de plantilla de proyecto cargados");
  };

  const handleGenerateSimulation = async () => {
    if (!projectTopic.trim()) {
      showToast("⚠️ El tema del proyecto es requerido.");
      return;
    }

    setIsSimulating(true);
    setSimulation(null);
    setExportPromptResult(null);

    try {
      const res = await fetch("/api/generate-structure-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectTopic,
          customConstraints
        })
      });

      if (!res.ok) {
        let errMsg = "Error al simular la estructura";
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {
          try {
            const txt = await res.text();
            if (txt && txt.trim().startsWith("<!doctype")) {
              errMsg = "Error interno del servidor (500 HTML Fallback)";
            } else {
              errMsg = txt.slice(0, 150) || errMsg;
            }
          } catch {}
        }
        throw new Error(errMsg);
      }

      const data: StructureSimulation = await res.json();
      setSimulation(data);
      setEditProjectName(data.projectName);
      setEditProjectDesc(data.overallDescription);
      showToast("🧠 Simulación estructural y límites de IA analizados con éxito");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExportPrompt = async () => {
    if (!simulation) return;

    setIsExporting(true);
    try {
      const res = await fetch("/api/export-structure-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: simulation.projectName,
          overallDescription: simulation.overallDescription,
          llmConstraints: simulation.llmConstraints,
          sections: simulation.sections
        })
      });

      if (!res.ok) {
        let errMsg = "Error al exportar prompt";
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {
          try {
            const txt = await res.text();
            if (txt && txt.trim().startsWith("<!doctype")) {
              errMsg = "Error interno del servidor (500 HTML Fallback)";
            } else {
              errMsg = txt.slice(0, 150) || errMsg;
            }
          } catch {}
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      setExportPromptResult(data.structureMasterPrompt);
      setShowExportModal(true);
      showToast("📋 Prompt maestro de estructura y entregas consolidado");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Error al consolidar prompt: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Reordering sections
  const handleMoveSection = (index: number, direction: "up" | "down") => {
    if (!simulation) return;
    const newSections = [...simulation.sections];
    const targetIdx = direction === "up" ? index - 1 : index + 1;

    if (targetIdx < 0 || targetIdx >= newSections.length) return;

    // Swap
    const temp = newSections[index];
    newSections[index] = newSections[targetIdx];
    newSections[targetIdx] = temp;

    setSimulation({
      ...simulation,
      sections: newSections
    });
    showToast("↕ Orden de entregas reorganizado");
  };

  // Editing handlers
  const handleStartEditSection = (section: ProjectSection) => {
    setEditingSectionId(section.id);
    setSectionEditForm({ ...section });
  };

  const handleSaveSectionEdit = () => {
    if (!simulation || !sectionEditForm) return;

    const updatedSections = simulation.sections.map(sec => 
      sec.id === sectionEditForm.id ? sectionEditForm : sec
    );

    setSimulation({
      ...simulation,
      sections: updatedSections
    });

    setEditingSectionId(null);
    setSectionEditForm(null);
    showToast("✓ Cambios guardados en la sección");
  };

  const handleDeleteSection = (id: string) => {
    if (!simulation) return;
    if (simulation.sections.length <= 1) {
      showToast("⚠️ Debe haber al menos una sección en la estructura.");
      return;
    }

    const updatedSections = simulation.sections.filter(sec => sec.id !== id);
    setSimulation({
      ...simulation,
      sections: updatedSections
    });
    showToast("🗑️ Sección de entrega eliminada");
  };

  const handleAddSection = () => {
    if (!simulation) return;

    const newId = `sec-${Date.now()}`;
    const newSec: ProjectSection = {
      id: newId,
      title: `Nueva Sección o Capítulo #${simulation.sections.length + 1}`,
      estimatedWords: 500,
      structuralPurpose: "Escribe aquí el propósito principal de este capítulo de entrega.",
      keySubsections: ["Subsección A", "Subsección B"],
      instructions: "Escribe aquí las pautas de estilo o requerimientos especiales para esta entrega modular."
    };

    setSimulation({
      ...simulation,
      sections: [...simulation.sections, newSec]
    });

    setEditingSectionId(newId);
    setSectionEditForm(newSec);
    showToast("➕ Nueva entrega modular añadida");
  };

  const handleSaveProjectMeta = () => {
    if (!simulation) return;
    setSimulation({
      ...simulation,
      projectName: editProjectName,
      overallDescription: editProjectDesc
    });
    setIsEditingProjectMeta(false);
    showToast("✓ Metadatos generales del proyecto actualizados");
  };

  const handleCopyPromptResult = () => {
    if (!exportPromptResult) return;
    navigator.clipboard.writeText(exportPromptResult);
    setCopiedPrompt(true);
    showToast("📋 ¡Prompt maestro copiado al portapapeles!");
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Overview Intro Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-start shadow-md text-white">
        <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
          <Layers className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            Entrenamiento de Estructura, Dosificación y Entrega Secuencial
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            Los proyectos largos (libros, manuales, extensos reportes) causan que la IA falle por límite de caracteres de salida, se cuelgue por timeouts, o pierda el tono e hilo argumental (context drift). Con este simulador, planificamos la <strong>fragmentación modular inteligente</strong> de tu proyecto. Edita el orden y alcance de las entregas secuenciales, y exporta un <strong>Prompt Maestro de Estructura</strong> para guiar a tu IA paso a paso sin fallas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Panel: Configuration & Presets (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Preset templates */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col gap-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Proyectos de Ejemplo Extensos
            </h3>
            <p className="text-[11px] text-slate-500">Selecciona un modelo de proyecto masivo para ver cómo fragmentarlo:</p>
            <div className="flex flex-col gap-2">
              {PRESET_LONG_PROJECTS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(preset)}
                  className="w-full text-left p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-indigo-50/40 hover:border-indigo-100 transition-all text-xs"
                >
                  <div className="font-bold text-slate-800">{preset.title}</div>
                  <div className="text-slate-500 truncate mt-0.5">{preset.topic}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Config inputs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Parámetros de Estructuración
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Tema del Proyecto Largo:</label>
              <textarea
                value={projectTopic}
                onChange={(e) => setProjectTopic(e.target.value)}
                placeholder="Describe qué proyecto completo de largo alcance quieres redactar (ej: un plan de negocios de 20 páginas para una panadería, un libro de cocina típica, etc.)..."
                className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs text-slate-800 leading-relaxed resize-none shadow-3xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Requerimientos de Layout o Estructura (Opcional):</label>
              <textarea
                value={customConstraints}
                onChange={(e) => setCustomConstraints(e.target.value)}
                placeholder="Especifica el número de capítulos deseado, si debe contener tablas financieras, si debe seguir normas APA, etc..."
                className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs text-slate-800 leading-relaxed resize-none shadow-3xs"
              />
            </div>

            <button
              onClick={handleGenerateSimulation}
              disabled={isSimulating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg shadow-sm text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analizando y Fragmentando...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  Simular Fragmentación del Proyecto
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side Panel: Interactive Simulation (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {!simulation ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs flex flex-col items-center text-center gap-4 min-h-[350px] justify-center"
              >
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h3 className="font-bold text-slate-800 text-base">Estructurador Interactivo de Proyectos</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Escribe tu propuesta o selecciona una de las plantillas rápidas de la izquierda y haz clic en <strong>Simular Fragmentación</strong>.
                  </p>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Nuestra IA analizará los límites de cuotas de tokens de salida, el drift de memoria técnica del modelo, y diseñará un plan de entregas lógicas que podrás ajustar, reordenar y entrenar.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-6"
              >
                {/* Simulated Metadata Block */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col gap-3">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div className="flex-1">
                      {isEditingProjectMeta ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={editProjectName}
                            onChange={(e) => setEditProjectName(e.target.value)}
                            className="w-full font-bold text-sm text-slate-900 border border-slate-200 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                          />
                          <textarea
                            value={editProjectDesc}
                            onChange={(e) => setEditProjectDesc(e.target.value)}
                            className="w-full text-xs text-slate-600 border border-slate-200 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 h-16"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setIsEditingProjectMeta(false)}
                              className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200 font-bold"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleSaveProjectMeta}
                              className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 font-bold flex items-center gap-1"
                            >
                              <Save className="w-3 h-3" />
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-slate-950">{simulation.projectName}</h4>
                            <button
                              onClick={() => setIsEditingProjectMeta(true)}
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-50"
                              title="Editar nombre y descripción"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {simulation.overallDescription}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-slate-500">
                    <div>
                      <span className="font-bold text-slate-800">Total Entregas: </span>
                      {simulation.sections.length} módulos
                    </div>
                    <div>
                      <span className="font-bold text-slate-800">Palabras Totales Estimadas: </span>
                      {simulation.sections.reduce((acc, s) => acc + s.estimatedWords, 0)} palabras
                    </div>
                  </div>
                </div>

                {/* Technical Constraints box */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-5 shadow-3xs flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Límites y Cuellos de Botella Analizados del LLM</h4>
                  </div>
                  <p className="text-[11px] text-amber-900/80 leading-relaxed">
                    Para escribir un proyecto de esta magnitud, se detectaron las siguientes restricciones técnicas en la IA. Aquí te mostramos cómo la simulación de fragmentación modular las elude:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                    {simulation.llmConstraints.map((item, idx) => (
                      <div key={idx} className="bg-white/80 p-3 rounded-lg border border-amber-100 flex flex-col gap-1 text-[11px]">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                          {item.constraint}
                        </div>
                        <p className="text-slate-500 leading-normal">{item.description}</p>
                        <div className="mt-1 text-indigo-700 font-semibold bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-50 text-[10px]">
                          <strong>Workaround:</strong> {item.workaround}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chapters / Sequential sections list */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Secuencia y Orden de las Entregas Modulares
                    </h3>
                    <button
                      onClick={handleAddSection}
                      className="px-2.5 py-1 text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Añadir Entrega
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {simulation.sections.map((sec, idx) => {
                      const isEditing = editingSectionId === sec.id;

                      return (
                        <div
                          key={sec.id}
                          className={`bg-white rounded-xl border p-5 shadow-3xs transition-all ${
                            isEditing ? "border-indigo-500 ring-2 ring-indigo-50" : "border-slate-200"
                          }`}
                        >
                          {isEditing && sectionEditForm ? (
                            /* Editing Form */
                            <div className="flex flex-col gap-3">
                              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                                  Editando Bloque de Entrega #{idx + 1}
                                </span>
                                <button
                                  onClick={() => setEditingSectionId(null)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="md:col-span-3 flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-slate-500">Título de la Entrega:</label>
                                  <input
                                    type="text"
                                    value={sectionEditForm.title}
                                    onChange={(e) => setSectionEditForm({ ...sectionEditForm, title: e.target.value })}
                                    className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-slate-500">Palabras Sugeridas:</label>
                                  <input
                                    type="number"
                                    value={sectionEditForm.estimatedWords}
                                    onChange={(e) => setSectionEditForm({ ...sectionEditForm, estimatedWords: parseInt(e.target.value) || 300 })}
                                    className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500">Propósito Estructural del Capítulo:</label>
                                <textarea
                                  value={sectionEditForm.structuralPurpose}
                                  onChange={(e) => setSectionEditForm({ ...sectionEditForm, structuralPurpose: e.target.value })}
                                  className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-16 resize-none"
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500">Subsecciones / Contenido de Fondo (Separados por coma):</label>
                                <input
                                  type="text"
                                  value={sectionEditForm.keySubsections.join(", ")}
                                  onChange={(e) => setSectionEditForm({
                                    ...sectionEditForm,
                                    keySubsections: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                                  })}
                                  className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500">Instrucciones de Redacción, Tono y Formato del Capítulo:</label>
                                <textarea
                                  value={sectionEditForm.instructions}
                                  onChange={(e) => setSectionEditForm({ ...sectionEditForm, instructions: e.target.value })}
                                  className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-20 resize-none"
                                />
                              </div>

                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={() => setEditingSectionId(null)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleSaveSectionEdit}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded flex items-center gap-1"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  Aplicar Cambios
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Card View */
                            <div className="flex flex-col gap-3">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center border border-slate-200">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <h5 className="text-xs font-bold text-slate-900">{sec.title}</h5>
                                    <span className="inline-block mt-0.5 text-[9px] bg-slate-50 border border-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                                      Límite seguro: ~{sec.estimatedWords} palabras
                                    </span>
                                  </div>
                                </div>

                                {/* Order & Actions Controls */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleMoveSection(idx, "up")}
                                    disabled={idx === 0}
                                    title="Mover arriba"
                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveSection(idx, "down")}
                                    disabled={idx === simulation.sections.length - 1}
                                    title="Mover abajo"
                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleStartEditSection(sec)}
                                    title="Editar sección"
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSection(sec.id)}
                                    title="Eliminar sección"
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-600 leading-relaxed pl-8">
                                <span className="font-bold text-slate-800">Propósito Estructural: </span>
                                {sec.structuralPurpose}
                              </div>

                              <div className="pl-8 flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subsecciones: </span>
                                {sec.keySubsections.map((sub, sidx) => (
                                  <span key={sidx} className="bg-slate-100 border border-slate-200/80 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">
                                    {sub}
                                  </span>
                                ))}
                              </div>

                              <div className="text-[11px] bg-slate-50/50 rounded-lg p-2.5 border border-slate-100 pl-8 leading-relaxed text-slate-500">
                                <span className="font-bold text-slate-600 block mb-0.5 text-[10px] uppercase tracking-wider">Instrucciones de Redacción:</span>
                                {sec.instructions}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Consolidate structures export action button */}
                  <div className="mt-2 bg-white rounded-xl border border-slate-200 p-4 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                      <span className="text-xs">
                        ¿Listo con el mapa estructural? Haz clic para generar el prompt secuencial maestro.
                      </span>
                    </div>
                    <button
                      onClick={handleExportPrompt}
                      disabled={isExporting}
                      className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg shadow-sm text-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {isExporting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generando Prompt...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Consolidar Prompt de Estructura
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* MODAL: Master structural prompt output */}
      <AnimatePresence>
        {showExportModal && exportPromptResult && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Prompt Maestro de Estructura y Entrega</h3>
                    <p className="text-xs text-slate-500">Copia estas instrucciones para alimentar a tu IA y redactar secuencialmente</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Modal Body (Text Area Content) */}
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 flex flex-col gap-4">
                <p className="text-xs text-slate-600 leading-normal">
                  Este prompt maestro contiene el mapa de fragmentación analizado y las instrucciones detalladas de entrega por bloques secuenciales. Al copiarlo en tu sesión de IA (Claude, Gemini, ChatGPT), el modelo adoptará el rol de redactor de tu proyecto y redactará estrictamente una sección a la vez, esperando tu aprobación para sortear límites de tokens de salida.
                </p>

                <div className="relative border border-slate-200 rounded-xl bg-slate-900 overflow-hidden shadow-inner flex-1 min-h-[300px] flex flex-col">
                  {/* Top Bar inside Code block */}
                  <div className="bg-slate-950 text-slate-400 px-4 py-2 text-[10px] font-mono flex items-center justify-between border-b border-slate-800">
                    <span>PROMPT MAESTRO COMPILADO (MARKDOWN)</span>
                    <button
                      onClick={handleCopyPromptResult}
                      className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline text-[10px]"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Código
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={exportPromptResult}
                    readOnly
                    className="w-full flex-1 p-4 bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed resize-none focus:outline-none focus:ring-0 overflow-y-auto"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                  ✓ Configurado con mitigación contra el truncado y pérdida de memoria de IA
                </span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handleCopyPromptResult}
                    className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-4 h-4" />
                        ¡Copiado con éxito!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar Prompt Maestro
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
