import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

let ai: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno");
    }
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// Helper to handle transient errors (e.g., 503, 500, UNAVAILABLE) with retry and a multi-model fallback cascade
async function generateContentWithRetry(params: {
  contents: any;
  config?: any;
  maxRetriesPerModel?: number;
}) {
  const client = getGeminiClient();
  const cascadeModels = [
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-flash-latest"
  ];
  const maxRetries = params.maxRetriesPerModel !== undefined ? params.maxRetriesPerModel : 3;
  let lastError: any = null;

  for (let mIdx = 0; mIdx < cascadeModels.length; mIdx++) {
    const modelName = cascadeModels[mIdx];
    let delay = 600;

    console.info(`[Resilient API] Attempting generation with model: ${modelName} (Cascade ${mIdx + 1}/${cascadeModels.length})`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        });
        
        if (mIdx > 0) {
          console.info(`[Resilient API] Success using fallback model: ${modelName} on attempt ${attempt}`);
        }
        return response;
      } catch (error: any) {
        lastError = error;
        const errorStr = (error.message || "") + " " + (error.status || "") + " " + (JSON.stringify(error) || "");
        const isTransient = errorStr.includes("503") || 
                            errorStr.includes("500") || 
                            errorStr.includes("UNAVAILABLE") || 
                            errorStr.includes("high demand") || 
                            errorStr.includes("overloaded") ||
                            errorStr.includes("Overloaded") ||
                            errorStr.includes("RESOURCE_EXHAUSTED") ||
                            errorStr.includes("temporales");

        console.warn(`[Resilient API] Model ${modelName} attempt ${attempt}/${maxRetries} failed: ${error.message || error}`);

        if (isTransient && attempt < maxRetries) {
          const jitter = Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
          delay *= 2; // exponential backoff
          continue;
        }
        break;
      }
    }
  }

  const finalErrorMsg = lastError?.message || JSON.stringify(lastError) || "Error de red persistente";
  throw new Error(`[Servidor de IA] No se pudo generar el contenido tras intentar con múltiples modelos de respaldo. Detalle: ${finalErrorMsg}`);
}

// API endpoint to generate text
app.post("/api/generate", async (req, res) => {
  try {
    const { topic, systemInstruction, learnedRules = [] } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "El tema o prompt de inicio es requerido" });
    }

    // Construct system instructions by merging user's base guidelines and learned rules
    const mergedInstructions = `
Eres un generador de texto de inteligencia artificial experto que está siendo entrenado por un usuario humano para escribir en un estilo de redacción sumamente específico y personalizado.
Tu objetivo es escribir un texto impecable sobre el tema solicitado por el usuario, adhiriéndote rigurosamente a las siguientes dos conjuntos de directrices:

### 1. DIRECTRICES DE ESTILO MANUALES (Configuradas por el usuario):
${systemInstruction || "Escribir un texto claro, coherente y fluido en español."}

### 2. REGLAS APRENDIDAS DINÁMICAMENTE (Descubiertas de correcciones previas que hizo el usuario):
${learnedRules.length > 0 ? learnedRules.map((rule: string, idx: number) => `- ${rule}`).join("\n") : "Ninguna regla aprendida todavía. Sigue las directrices manuales."}

### INSTRUCCIONES DE SALIDA CRÍTICAS:
- Cumple con ambas directrices de manera implícita en la redacción.
- No agregues introducciones conversacionales como "Aquí tienes el texto:", "Por supuesto, aquí está:", ni explicaciones al final.
- Escribe ÚNICAMENTE el texto final generado.
`;

    const response = await generateContentWithRetry({
      contents: `Genera un texto completo sobre el siguiente tema, aplicando todas las pautas de estilo indicadas: "${topic}"`,
      config: {
        systemInstruction: mergedInstructions,
        temperature: 0.7,
      }
    });

    res.json({ generatedText: response.text });
  } catch (error: any) {
    console.error("Error al generar el texto:", error);
    res.status(500).json({ error: error.message || "Error al generar el texto" });
  }
});

// API endpoint to analyze diff and learn style rules
app.post("/api/analyze-diff", async (req, res) => {
  try {
    const { originalText, editedText, systemInstruction, learnedRules = [], userComment } = req.body;
    if (!originalText || !editedText) {
      return res.status(400).json({ error: "Tanto el texto original como el editado son requeridos" });
    }

    const client = getGeminiClient();

    const analysisPrompt = `
Eres un analizador lingüístico y estilístico de IA de nivel experto.
Un usuario está entrenando a un modelo de generación de texto. El modelo generó un texto original y el usuario lo editó manualmente para corregir y perfeccionar el estilo.
Tu tarea es analizar detalladamente las diferencias entre el texto original y la versión corregida para extraer reglas de estilo explícitas y concretas que sirvan para futuras generaciones de texto.

TEXTO ORIGINAL GENERADO POR LA IA:
"""
${originalText}
"""

VERSIÓN EDITADA Y CORREGIDA POR EL USUARIO:
"""
${editedText}
"""

${userComment ? `COMENTARIOS Y JUSTIFICACIÓN DEL USUARIO SOBRE SUS CAMBIOS:
"""
${userComment}
"""
(Usa este comentario explicativo como la guía de oro de la intención estilística del usuario para identificar qué palabras o estructuras usar y cuáles prohibir).` : ""}

REGLAS MANUALES / INSTRUCCIONES INTEGRADAS ACTUALES:
${systemInstruction || "Ninguna"}

REGLAS APRENDIDAS ACTUALES:
${learnedRules.join("\n") || "Ninguna"}

INSTRUCCIONES DE ANÁLISIS CRÍTICAS PARA EVITAR REPETICIONES:
1. Compara palabra por palabra y oración por oración. Identifica qué eliminó, qué agregó, qué cambió de orden, o qué cambios hizo en el tono, vocabulario o formato.
2. Formula de 1 a 4 NUEVAS reglas de estilo en español que capturen la INTENCIÓN detrás de los cambios del usuario. 
3. REGLA DE NO-REPETICIÓN: Está STRICTAMENTE PROHIBIDO repetir o reiterar ideas que ya se encuentren explícitamente escritas en las "REGLAS MANUALES / INSTRUCCIONES INTEGRADAS ACTUALES" o en las "REGLAS APRENDIDAS ACTUALES". Si la corrección del usuario ya está cubierta por el prompt integrado, no generes una regla redundante. Los nuevos aprendizajes deben ser específicos, complementarios, ultra-precisos y enfocados estrictamente en lo novedoso (no importa si son muy cortos o micro-pautas sobre palabras específicas).
4. Las reglas deben ser concisas, claras y directamente aplicables para que un escritor las entienda.
5. Identifica de 1 a 3 correcciones clave de palabras o frases (antes y después) con la justificación del cambio.
6. Haz un breve resumen de los cambios realizados por el usuario.

Genera tu respuesta estrictamente en formato JSON utilizando el esquema de respuesta especificado.
`;

    const response = await generateContentWithRetry({
      contents: analysisPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modificationsSummary: {
              type: Type.STRING,
              description: "Resumen explicativo en español de los cambios estilísticos, estructurales o de vocabulario realizados por el usuario."
            },
            detectedRules: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              },
              description: "Lista de nuevas reglas estilísticas específicas en español que explican las correcciones del usuario."
            },
            keyCorrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  before: { type: Type.STRING, description: "La frase, palabra o estructura que generó la IA." },
                  after: { type: Type.STRING, description: "El cambio o corrección exacta realizada por el usuario." },
                  reason: { type: Type.STRING, description: "La razón lingüística o estilística detrás del cambio." }
                },
                required: ["before", "after", "reason"]
              },
              description: "Ejemplos específicos de correcciones directas antes/después hechas por el usuario."
            }
          },
          required: ["modificationsSummary", "detectedRules", "keyCorrections"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error al analizar la diferencia:", error);
    res.status(500).json({ error: error.message || "Error al analizar los cambios en el texto" });
  }
});

// API endpoint to parse and integrate an existing user prompt
app.post("/api/parse-existing-prompt", async (req, res) => {
  try {
    const { existingPrompt } = req.body;
    if (!existingPrompt || !existingPrompt.trim()) {
      return res.status(400).json({ error: "El prompt existente es requerido" });
    }

    const client = getGeminiClient();

    const analysisPrompt = `
Eres un ingeniero experto en Ingeniería de Prompts (Prompt Engineer).
El usuario ha proporcionado un prompt, rol o conjunto de instrucciones que ya utiliza actualmente para dar formato o estilo a sus textos de IA.
Tu tarea es analizar detalladamente este prompt existente para deconstruirlo y estructurarlo adecuadamente para nuestro sistema.

PROMPT DEL USUARIO:
"""
${existingPrompt}
"""

INSTRUCCIONES DE DECONSTRUCCIÓN:
1. Extrae las directrices manuales principales (las instrucciones de tono principal, voz, rol) en una sola cadena consolidada y refinada.
2. Identifica y extrae de 2 a 6 reglas de estilo específicas, breves e independientes y ponlas en un arreglo de reglas. (Ejemplo de regla extraída: "Escribir siempre en segunda persona del plural", "Estructurar la salida con subtítulos marcados con viñetas").
3. Mantén todo en español.

Genera tu respuesta estrictamente en formato JSON utilizando el esquema de respuesta especificado.
`;

    const response = await generateContentWithRetry({
      contents: analysisPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            baseGuidelines: {
              type: Type.STRING,
              description: "Un párrafo consolidado y refinado en español que describa el tono principal, rol y estilo del prompt original."
            },
            extractedRules: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              },
              description: "Un arreglo de reglas estilísticas o restricciones concretas y concisas extraídas del prompt original."
            }
          },
          required: ["baseGuidelines", "extractedRules"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error al procesar el prompt existente:", error);
    res.status(500).json({ error: error.message || "Error al deconstruir el prompt" });
  }
});

// API endpoint to generate dynamic custom writing topic suggestions based on current guidelines
app.post("/api/suggest-topics", async (req, res) => {
  try {
    const { systemInstruction, learnedRules = [] } = req.body;

    const client = getGeminiClient();

    const suggestionPrompt = `
Eres un editor creativo de contenido y tutor de redacción para Inteligencia Artificial.
El sistema de entrenamiento actual cuenta con las siguientes directrices y reglas estilísticas:

DIRECTRICES BASE:
"${systemInstruction || "Ninguna especificada."}"

REGLAS APRENDIDAS ADICIONALES:
${learnedRules.length > 0 ? learnedRules.map((r: string) => `- ${r}`).join("\n") : "Ninguna."}

Tu tarea es sugerir exactamente 5 temas de ejercicio o situaciones realistas de redacción (ejemplos prácticos) en los cuales sería excelente probar estas directrices de estilo.
Por ejemplo, si las reglas hablan de tono empático corporativo, sugiere correos de atención a quejas o disculpas. Si el estilo es de copywriting directo, sugiere anuncios de lanzamiento o hilos de redes sociales.

INSTRUCCIONES:
- Genera 5 sugerencias de temas atractivas, concretas y bien explicadas.
- Mantén las descripciones breves y en español.

Genera tu respuesta estrictamente en formato JSON utilizando el esquema de respuesta especificado.
`;

    const response = await generateContentWithRetry({
      contents: suggestionPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Un título corto y claro de la sugerencia de ejercicio." },
                  description: { type: Type.STRING, description: "Descripción de qué debe escribir la IA (ej: Un post de LinkedIn para anunciar X)." },
                  fullPrompt: { type: Type.STRING, description: "El prompt exacto optimizado que se puede pasar como tema para generar el texto." }
                },
                required: ["title", "description", "fullPrompt"]
              },
              description: "Exactamente 5 sugerencias personalizadas de temas o ejercicios de entrenamiento."
            }
          },
          required: ["suggestions"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error al sugerir temas:", error);
    res.status(500).json({ error: error.message || "Error al generar sugerencias de temas" });
  }
});

// API endpoint for copying writing style from Document 2 onto Document 1
app.post("/api/style-transfer", async (req, res) => {
  try {
    const { originalText, styleReferenceText } = req.body;
    if (!originalText || !originalText.trim()) {
      return res.status(400).json({ error: "El texto original (Documento 1) es requerido." });
    }
    if (!styleReferenceText || !styleReferenceText.trim()) {
      return res.status(400).json({ error: "El texto con el estilo de referencia (Documento 2) es requerido." });
    }

    const client = getGeminiClient();

    const prompt = `
Eres un editor literario y corrector de estilo de primer nivel, especializado en "Copia de Estilo de Escritura" (Writing Style/Voice Copying).

Tienes dos textos:
1. TEXTO ORIGINAL (El fondo o contenido que debe ser reescrito):
"""
${originalText}
"""

2. TEXTO DE REFERENCIA ESTILÍSTICA (El estilo de escritura, tono, voz, ritmo, longitud de frases, vocabulario y formato que debes emular e incorporar al Texto Original):
"""
${styleReferenceText}
"""

TU TAREA:
1. Divide el "TEXTO ORIGINAL" en bloques o párrafos lógicos (aproximadamente de 1 a 5 párrafos/bloques según la longitud).
2. Para cada bloque o párrafo original:
   a. Reescríbelo por completo asegurándote de que adopte rigurosamente el estilo, la voz, el tono, la musicalidad y la estructura gramatical del "TEXTO DE REFERENCIA ESTILÍSTICA".
   b. Mantén intactos los datos objetivos, hechos y significado principal del bloque original de fondo. No inventes hechos nuevos ni contradigas la información original.
   c. Explica detalladamente en español qué cambios estilísticos, de vocabulario o estructura aplicaste para imitar la referencia de estilo ("styleApplied").
   d. Extrae de 1 a 2 reglas o directrices de estilo concretas que describan esta transformación ("detectedRules").
3. Devuelve los resultados en un formato JSON estructurado que contenga un arreglo de segmentos con la correspondencia exacta.

Genera tu respuesta estrictamente en formato JSON utilizando el esquema de respuesta especificado.
`;

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  originalBlock: { type: Type.STRING, description: "El bloque o párrafo del texto original." },
                  rewrittenBlock: { type: Type.STRING, description: "El mismo bloque reescrito imitando perfectamente el estilo del texto de referencia." },
                  styleApplied: { type: Type.STRING, description: "Explicación del cambio estilístico o de tono que se aplicó a este bloque." },
                  detectedRules: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Reglas de estilo concretas o hábitos de escritura extraídos de este cambio para copiar el estilo."
                  }
                },
                required: ["originalBlock", "rewrittenBlock", "styleApplied", "detectedRules"]
              },
              description: "Los bloques correspondientes de texto original y reescrito con estilo."
            }
          },
          required: ["segments"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error al transferir estilo:", error);
    res.status(500).json({ error: error.message || "Error al transferir el estilo de escritura" });
  }
});

// API endpoint to export the style-transfer rules and segments as a consolidated prompt
app.post("/api/export-style-transfer-prompt", async (req, res) => {
  try {
    const { styleReferenceText, baseInstruction, acceptedSegments = [] } = req.body;

    const exportPrompt = `
Eres un ingeniero experto en ingeniería de prompts (Meta-Prompt Engineer) y deconstrucción de voz, tono y estilo lingüístico.
Tu objetivo es redactar un "System Prompt" (Prompt de Sistema o Instrucción de Estilo) de nivel profesional para que CUALQUIER otra IA imite exactamente el estilo de escritura de la referencia que el usuario aprobó.

Para lograr esto, debes hacer una comparación meticulosa con la instrucción base original y, de forma primordial, identificar patrones lexicográficos precisos: **qué palabras y tipos de oraciones usar (y cómo usarlas) y qué palabras y oraciones evitar por completo**.

DATOS DE ENTRADA PARA EL ANÁLISIS:

1. PROMPT BASE INTEGRADO ORIGINAL (La base conceptual/instrucción previa):
"""
${baseInstruction || "No se especificó un prompt base previo."}
"""

2. TEXTO DE REFERENCIA ESTILÍSTICA COMPLETO (El patrón real a imitar):
"""
${styleReferenceText || "Ninguno proporcionado."}
"""

3. CASOS DE ÉXITO APROBADOS POR EL USUARIO (La verdad de oro de cómo se debe adaptar el estilo):
${acceptedSegments.length > 0 ? acceptedSegments.map((s: any, idx: number) => `
### Caso de Éxito #${idx + 1}
- Texto Original: "${s.originalBlock}"
- Texto Adaptado con Estilo: "${s.rewrittenBlock}"
- Reglas de estilo identificadas: ${s.detectedRules ? s.detectedRules.join(", ") : "N/A"}
- Explicación de la transformación: ${s.styleApplied || "N/A"}
${s.userComment ? `- Comentario / Justificación del usuario: "${s.userComment}"` : ""}
`).join("\n") : "Ninguno proporcionado explícitamente."}

TU TAREA:
Genera un informe interactivo, sumamente estructurado y elegante en Markdown con las siguientes secciones detalladas:

# REPORTE DE CONSOLIDACIÓN Y PROMPT MAESTRO DE ESTILO DE ESCRITURA

---

## 🚀 I. INFORME DE MEJORAS Y CAMBIOS (QUÉ SE MEJORÓ Y CAMBIÓ)

### 1. Qué se Mejoró
- Explica de forma sustancial cómo las adaptaciones aprobadas mejoran la legibilidad, la elegancia, la fluidez y el impacto del mensaje original.
- Detalla los beneficios comunicativos del nuevo estilo adoptado (p. ej. mayor asertividad, cadencia más agradable, eliminación de frialdad técnica o exceso de informalidad).

### 2. Qué se Cambió
- Describe los cambios lingüísticos e idiomáticos concretos aplicados sobre los textos originales (p. ej. reestructuración de párrafos densos, simplificación de redundancias, adición de conectores lógicos más sofisticados, cambios de voz o persona gramatical).

---

## 🧠 II. NUEVOS APRENDIZAJES Y GUÍA DE DOSIFICACIÓN

### 1. Nuevos Aprendizajes Adquiridos por la IA
- Detalla los hábitos de redacción descubiertos en la Referencia Estilística y aprobados por el usuario.
- **Rítmica y Estructura de Oraciones**: ¿Cómo se estructuran las frases? (ej: oraciones cortas e impactantes, uso de cláusulas subordinadas elegantes, inicio con gerundios, etc.).
- Explica qué se aprendió respecto al tono, nivel de formalidad, adjetivación y el uso particular de la puntuación en esta voz.

### 2. Guía de Contexto, Aplicación y Dosificación de Vocabulario (Cuándo sí y Cuándo no)
- Explica con precisión cuándo es idóneo usar los nuevos términos aprendidos y cuándo resulta redundante o forzado.
- **Regla de No-Abuso (Evitar Saturación)**: Instruye claramente a no repetir excesivamente las palabras preferidas o añadidas por el usuario en sus correcciones. El abuso de términos "sofisticados" devalúa el estilo.
- Muestra una **tabla de dosificación y contexto** detallada con las columnas:
  \`Palabra o Expresión Aprendida\` | \`Cuándo Debe Utilizarse (Contexto de uso idóneo)\` | \`Límite de Dosificación sugerido (Frecuencia para evitar abuso)\` | \`Cuándo Omitirla o Evitarla (Frecuencia / Redundancia)\`

---

## 🎯 III. PROMPT MAESTRO DE SISTEMA CONSOLIDADO (Listo para copiar)
Escribe el prompt maestro final que se le puede dar a cualquier LLM (Gemini, Claude, GPT) para indicarle que adopte este estilo de escritura de forma infalible.

El prompt maestro debe estar delimitado dentro de un bloque de código Markdown (\`\`\`) para facilitar su copia rápida, y debe estructurarse así:
- **Perfil y Rol del Redactor**: Rol detallado, voz, tono, nivel de formalidad y audiencia objetivo.
- **Reglas Estilísticas de Oro (Formato, Puntuación, Longitud)**: Reglas de ritmo de oraciones, uso de exclamaciones, listas, mayúsculas, etc.
- **Guía de Contexto y Dosificación de Vocabulario**: Instrucciones rigurosas sobre *cuándo* y *cómo* usar las palabras favoritas de forma moderada, con límites explícitos para no abusar de ellas.
- **Ejemplos Few-Shot de Estilo**: Muestra de forma impecable ejemplos de "Antes (Sin Estilo)" y "Después (Con Estilo de Escritura Copiado)" basados en los Casos de Éxito aprobados por el usuario.

Genera tu respuesta directamente en Markdown en español. No incluyas explicaciones previas, preámbulos, ni notas personales al inicio o al final. Comienza directamente con el título principal.
`;

    const response = await generateContentWithRetry({
      contents: exportPrompt,
    });

    res.json({ stylePrompt: response.text });
  } catch (error: any) {
    console.error("Error al exportar prompt de estilo:", error);
    res.status(500).json({ error: error.message || "Error al exportar el prompt de estilo" });
  }
});

// API endpoint to process/rewrite custom text with the current style instructions (integrated prompt)
app.post("/api/process-text", async (req, res) => {
  try {
    const { text, systemInstruction, learnedRules = [] } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "El texto a procesar es requerido" });
    }

    const mergedInstructions = `
Eres un editor y corrector de estilo experto de inteligencia artificial. Tu objetivo es tomar el texto proporcionado por el usuario y reescribirlo o adaptarlo para que cumpla RIGUROSAMENTE con las siguientes directrices y reglas de estilo:

### 1. DIRECTRICES DE ESTILO BASE (INTEGRADAS):
${systemInstruction || "Escribir un texto claro, coherente y fluido en español."}

### 2. REGLAS APRENDIDAS ADICIONALES:
${learnedRules.length > 0 ? learnedRules.map((rule: string) => `- ${rule}`).join("\n") : "Ninguna adicional por ahora. Sigue las directrices base."}

### INSTRUCCIONES DE SALIDA CRÍTICAS:
- Adapta el texto de entrada para alinearlo perfectamente con el tono, longitud de oraciones, vocabulario y reglas listadas arriba.
- Mantén el fondo y los datos principales del mensaje original intactos. No inventes información contradictoria.
- No agregues preámbulos conversacionales ni comentarios al final.
- Escribe ÚNICAMENTE el texto final reescrito o adaptado.
`;

    const response = await generateContentWithRetry({
      contents: `Procesa y adapta el siguiente texto original:\n\n"""\n${text}\n"""`,
      config: {
        systemInstruction: mergedInstructions,
        temperature: 0.5,
      }
    });

    res.json({ processedText: response.text });
  } catch (error: any) {
    console.error("Error al procesar el texto con el prompt integrado:", error);
    res.status(500).json({ error: error.message || "Error al procesar el texto" });
  }
});

// API endpoint to export the trained prompt
app.post("/api/export-meta-prompt", async (req, res) => {
  try {
    const { learnedRules = [], history = [] } = req.body;

    const client = getGeminiClient();

    const exportPrompt = `
Eres un ingeniero experto en ingeniería de prompts (Meta-Prompt Engineer).
Tu objetivo es redactar un "System Prompt" (Prompt de Sistema o Instrucción Directa) sumamente efectivo, profesional y optimizado. Este prompt se utilizará para programar o instruir a CUALQUIER otra inteligencia artificial (como ChatGPT, Claude, Llama o una nueva sesión de Gemini) para que escriba exactamente con el estilo de redacción que el usuario ha entrenado en este sistema.

REGLA DE ORO DE CONSOLIDACIÓN EXCLUSIVA:
- Debes ignorar por completo cualquier prompt o instrucción base genérica previa. El nuevo prompt maestro debe construirse ÚNICA Y EXCLUSIVAMENTE a partir de los aprendizajes reales, hábitos y correcciones acumuladas durante el entrenamiento dinámico del usuario (las reglas aprendidas y los casos del historial).
- No asumas reglas generales que no estén respaldadas por los datos de entrenamiento que te proporcionamos abajo.

Datos de entrenamiento recopilados durante la sesión (Los únicos de los que debes aprender):

1. REGLAS DE ESTILO APRENDIDAS DE LAS CORRECCIONES DEL USUARIO:
${learnedRules.length > 0 ? learnedRules.map((r: string) => `- ${r}`).join("\n") : "Ninguna regla aprendida todavía."}

2. HISTORIAL DE CASOS DE ENTRENAMIENTO (Ejemplos Few-Shot reales del usuario):
${history.length > 0 ? history.map((h: any, idx: number) => `
### Caso de Entrenamiento #${idx + 1}
- Tema/Contexto: ${h.topic}
- Salida Original (Incorrecta):
"${h.originalText}"
- Corrección Manual del Usuario (Estilo Objetivo deseado):
"${h.editedText}"
- Aprendizaje extraído: ${h.modificationsSummary || "N/A"}
`).join("\n") : "Sin historial de correcciones directas."}

TU TAREA:
Escribe un informe interactivo, sumamente estructurado y elegante en Markdown en español. El reporte no es un simple prompt base, sino un reporte detallado y un Prompt Maestro de Sistema Consolidado listo para ser copiado.

Debe comenzar directamente con el título principal y contener las siguientes secciones perfectamente redactadas:

# 📋 REPORTE DETALLADO DEL PROMPT MAESTRO Y AUDITORÍA DE ESTILO

---

## 🚀 I. INFORME DE MEJORAS Y CAMBIOS (QUÉ SE MEJORÓ Y CAMBIÓ)

### 1. Qué se Mejoró
- Explica de forma sustancial cómo las correcciones manuales y el entrenamiento del usuario han mejorado la legibilidad, la asertividad, la elegancia, la fluidez o el tono en comparación con las propuestas iniciales automáticas de la IA.
- Detalla los beneficios comunicativos del nuevo estilo perfeccionado (p. ej. tono más directo, oraciones más dinámicas, ganancia en autoridad profesional, etc.).

### 2. Qué se Cambió
- Describe los cambios lingüísticos, estructurales y gramaticales específicos que el usuario realizó en los textos del historial (p. ej. reestructuración de oraciones complejas, simplificación de introducciones redundantes, cambio en la formalidad, reordenamiento de ideas clave, etc.).

---

## 🧠 II. NUEVOS APRENDIZAJES Y GUÍA DE DOSIFICACIÓN

### 1. Nuevos Aprendizajes Adquiridos por la IA
- Detalla los nuevos hábitos y reglas de redacción específicos descubiertos a partir del historial de entrenamiento y las reglas aprobadas por el usuario.
- **Rítmica, Estructura y Puntuación**: Describe cómo se estructuran las frases y el ritmo deseado en las oraciones (ej. el uso de frases cortas de alto impacto o conectores de transición fluidos).

### 2. Guía de Contexto, Aplicación y Dosificación de Vocabulario (Cuándo sí y Cuándo no)
- Explica con precisión cuándo es idóneo usar los nuevos términos aprendidos y cuándo resulta redundante o forzado.
- **Regla de No-Abuso (Evitar Saturación)**: Instruye claramente a no repetir excesivamente las palabras preferidas o añadidas por el usuario en sus correcciones. El abuso de términos "sofisticados" devalúa el estilo.
- Muestra una **tabla de dosificación y contexto** detallada con las columnas:
  \`Palabra o Expresión Aprendida\` | \`Cuándo Debe Utilizarse (Contexto de uso idóneo)\` | \`Límite de Dosificación sugerido (Frecuencia para evitar abuso)\` | \`Cuándo Omitirla o Evitarla (Frecuencia / Redundancia)\`

---

## 🎯 III. PROMPT MAESTRO DE SISTEMA CONSOLIDADO (Listo para copiar)
Escribe el prompt maestro final consolidado que se le puede dar a cualquier LLM (Gemini, Claude, GPT) para indicarle que adopte este estilo de escritura de forma infalible.

El prompt maestro debe estar delimitado dentro de un bloque de código Markdown (\`\`\`) para facilitar su copia rápida, y debe estructurarse así:
- **Perfil y Rol del Redactor**: Rol detallado, voz, tono, nivel de formalidad y audiencia objetivo.
- **Reglas Estilísticas de Oro (Formato, Puntuación, Longitud)**: Reglas de ritmo de oraciones, uso de exclamaciones, listas, mayúsculas, etc.
- **Guía de Contexto y Dosificación de Vocabulario**: Instrucciones rigurosas sobre *cuándo* y *cómo* usar las palabras favoritas de forma moderada, con límites explícitos para no abusar de ellas.
- **Ejemplos Few-Shot de Estilo**: Muestra de forma impecable ejemplos de "Antes (Sin Estilo)" y "Después (Con Estilo de Escritura Copiado)" basados en los Casos de Entrenamiento reales del usuario.

Genera tu respuesta directamente en Markdown en español. No incluyas explicaciones previas, preámbulos, ni notas personales al inicio o al final. Comienza directamente con el título principal.
`;

    const response = await generateContentWithRetry({
      contents: exportPrompt,
    });

    res.json({ metaPrompt: response.text });
  } catch (error: any) {
    console.error("Error al exportar el prompt de entrenamiento:", error);
    res.status(500).json({ error: error.message || "Error al exportar el prompt de entrenamiento" });
  }
});

// API endpoint to generate a project structure simulation taking into account LLM constraints
app.post("/api/generate-structure-simulation", async (req, res) => {
  try {
    const { projectTopic, customConstraints } = req.body;
    if (!projectTopic || !projectTopic.trim()) {
      return res.status(400).json({ error: "El tema del proyecto largo es requerido." });
    }

    const client = getGeminiClient();

    const simulationPrompt = `
Eres un Arquitecto de Información y Diseñador de Prompts de IA de nivel senior.
El usuario quiere planificar y redactar un proyecto extenso y complejo: "${projectTopic}".
Otras restricciones personalizadas especificadas por el usuario: "${customConstraints || "Ninguna adicional"}".

Tu tarea es diseñar un mapa estructural completo y detallado en español para simular cómo se organizará, estructurará y entregará este proyecto por partes, superando de manera proactiva las limitaciones técnicas de los modelos de lenguaje (LLM).

LIMITACIONES QUE DEBES CONSIDERAR E INCLUIR EN 'llmConstraints':
1. Límite de tokens de salida (Output Token Limits): El LLM no puede generar todo el proyecto de golpe; se truncaría y cortaría la respuesta.
2. Pérdida de coherencia o contexto acumulado (Context Drift / Memory Degradation): A medida que genera más capítulos, la IA puede olvidar directrices de estilo o datos previos.
3. Cuotas de uso y Rate Limits de API: Hacer llamadas de golpe muy pesadas puede provocar bloqueos temporales por saturación de cuota.
4. Tiempos de espera (Timeout Limits): Intentar que la IA genere 10,000 palabras de un tirón causa errores de timeout en los servidores.

MÉTODO DE MITIGACIÓN (WORKAROUND):
- Diseño y entrega modular secuencial: Dividir el proyecto de forma rigurosa en capítulos o secciones de tamaño moderado (< 800 palabras por capítulo) que se redactan uno a uno, integrando resúmenes de contexto en el prompt para mantener la coherencia.

En el listado de 'sections', divide el proyecto de manera lógica en una secuencia de entregas (mínimo 3, máximo 6). Cada sección debe ser una entrega modular y segura ante el límite de salida del modelo.

Genera tu respuesta estrictamente en formato JSON utilizando el esquema de respuesta especificado.
`;

    const response = await generateContentWithRetry({
      contents: simulationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectName: { type: Type.STRING, description: "Un nombre atractivo y profesional para el proyecto." },
            overallDescription: { type: Type.STRING, description: "Descripción detallada del alcance, objetivos y estructura general del proyecto." },
            llmConstraints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  constraint: { type: Type.STRING, description: "La limitación técnica identificada del LLM." },
                  description: { type: Type.STRING, description: "Breve explicación de cómo afecta al desarrollo de este proyecto extenso." },
                  workaround: { type: Type.STRING, description: "La estrategia o solución modular aplicada en la simulación." }
                },
                required: ["constraint", "description", "workaround"]
              },
              description: "Lista de limitaciones del LLM identificadas y cómo se resolverán."
            },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Un ID único, ej: sec-1." },
                  title: { type: Type.STRING, description: "Título claro y descriptivo del capítulo o sección." },
                  estimatedWords: { type: Type.INTEGER, description: "Cantidad estimada de palabras recomendadas para este bloque (ej: 400, 600)." },
                  structuralPurpose: { type: Type.STRING, description: "El propósito de fondo que cumple esta sección en el documento." },
                  keySubsections: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Lista de subsecciones específicas, apartados o temas internos que debe contener."
                  },
                  instructions: { type: Type.STRING, description: "Instrucciones específicas de tono, formato, variables a usar o enfoque de redacción para esta entrega modular." }
                },
                required: ["id", "title", "estimatedWords", "structuralPurpose", "keySubsections", "instructions"]
              },
              description: "Las secciones o entregas secuenciales que estructuran el proyecto."
            }
          },
          required: ["projectName", "overallDescription", "llmConstraints", "sections"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error al generar simulación de estructura:", error);
    res.status(500).json({ error: error.message || "Error al simular la estructura del proyecto" });
  }
});

// API endpoint to compile and export the structural master prompt instructions
app.post("/api/export-structure-prompt", async (req, res) => {
  try {
    const { projectName, overallDescription, llmConstraints = [], sections = [] } = req.body;

    const client = getGeminiClient();

    const exportPrompt = `
Eres un Ingeniero de Prompts certificado y Arquitecto de IA experto (Master Prompt Engineer).
Tu objetivo es redactar un "PROMPT MAESTRO DE ESTRUCTURACIÓN, DOSIFICACIÓN Y ENTREGA SECUENCIAL" impecable, profesional y listo para usar en español.
Este Prompt Maestro servirá para programar e instruir a cualquier LLM (Gemini, Claude, ChatGPT, etc.) sobre cómo redactar el siguiente proyecto complejo paso a paso de forma exitosa, evitando de manera infalible el truncado de texto, las fallas de timeout y el desgaste de coherencia (context drift).

DATOS CLAVE DEL PROYECTO A REDACTAR:
- **Título del Proyecto**: ${projectName || "Proyecto Extenso"}
- **Descripción General**: ${overallDescription || "Redacción modular de un documento extenso."}

- **LIMITACIONES TÉCNICAS RECONOCIDAS Y WORKAROUNDS**:
${llmConstraints.length > 0 ? llmConstraints.map((c: any) => `- **${c.constraint}**: ${c.description} (Workaround: ${c.workaround})`).join("\n") : "Límite de salida de texto y desgaste de memoria."}

- **MAPA DE ENTREGAS SECUENCIALES REQUERIDO**:
${sections.map((s: any, idx: number) => `
ENTREGA #${idx + 1}: ${s.title}
- Límite sugerido: ${s.estimatedWords} palabras.
- Propósito Estructural: ${s.structuralPurpose}
- Subsecciones requeridas: ${s.keySubsections ? s.keySubsections.join(", ") : "N/A"}
- Instrucciones de Redacción: ${s.instructions}
`).join("\n")}

TU TAREA:
Redacta un prompt final cohesivo y sumamente detallado estructurado en las siguientes secciones principales:
1. **Perfil, Rol y Voz del Redactor**: Un rol altamente capacitado para este proyecto.
2. **Las Reglas de Oro de Entrega Secuencial (Fórmula Modular)**: Instrucciones obligatorias para que la IA NO escriba todo el documento de una sola vez. Explícale que debe ir bloque a bloque, deteniéndose al final de cada entrega para pedir confirmación ("Esperando instrucción para iniciar Entrega X").
3. **Control Dinámico de Extensión e Impedimento de Truncado**: Instrucciones rígidas de no rebasar los límites de palabras asignados por sección, logrando un balance perfecto entre densidad de información y seguridad de ejecución.
4. **Fórmula para el Traspaso de Contexto e Hilo Conductor**: Cómo el usuario alimentará el resumen del bloque anterior para evitar que la IA pierda el rumbo a la mitad.
5. **Esquema de las Secciones a Redactar**: Formatea en una elegante lista estructurada o tabla todas las entregas con sus directrices, límites de palabras y temas clave.
6. **Ejemplo de Flujo de Conversación**: Muestra un ejemplo de cómo interactuar con el modelo (Ej: "Usuario: Genera entrega 1" -> "IA: Genera entrega 1..." -> "Usuario: Siguiente sección" -> "IA: Genera entrega 2...").

Escribe tu respuesta directamente en Markdown en español. No agregues preámbulos, ni explicaciones personales externas. El Prompt Maestro debe estar perfectamente delimitado dentro de un bloque de código Markdown (\`\`\`) para que el usuario pueda copiarlo de un solo clic.
`;

    const response = await generateContentWithRetry({
      contents: exportPrompt,
    });

    res.json({ structureMasterPrompt: response.text });
  } catch (error: any) {
    console.error("Error al exportar prompt de estructura:", error);
    res.status(500).json({ error: error.message || "Error al exportar el prompt de estructura" });
  }
});

// Serve assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
