import { PresetStyle } from "../types";

export const PRESET_STYLES: PresetStyle[] = [
  {
    name: "✉️ Correo de Negocios Formal",
    description: "Tono sofisticado, profesional y cortés, ideal para clientes o directivos.",
    prompt: "Tono corporativo sofisticado, cortés y sumamente profesional. Utiliza fórmulas de saludo y despedida formales tradicionales. Evita contracciones, muletillas o giros coloquiales. El vocabulario debe ser corporativo, claro y enfocado en generar confianza y mutuo acuerdo."
  },
  {
    name: "⚡ Copywriting Persuasivo",
    description: "Oraciones cortas, ganchos emocionales y enfoque total en el beneficio del lector.",
    prompt: "Tono persuasivo, dinámico y cargado de energía. Utiliza oraciones cortas e impactantes. Enfócate al 100% en los beneficios para el cliente antes de mencionar las características técnicas. Incluye ganchos conversacionales, preguntas directas al lector y un llamado a la acción claro y urgente."
  },
  {
    name: "❤️ Soporte Técnico Empático",
    description: "Mensajes pacientes, estructurados y amigables para resolver problemas técnicos.",
    prompt: "Tono sumamente empático, paciente, comprensivo y didáctico. Valida activamente las emociones o frustraciones del cliente al inicio del mensaje. Utiliza guías estructuradas paso a paso (con números o viñetas) para resolver problemas complejos de forma sencilla, evitando tecnicismos sin explicación previa."
  },
  {
    name: "📖 Storytelling Creativo",
    description: "Narrativa descriptiva con lenguaje sensorial y ritmo cautivador.",
    prompt: "Estilo literario y narrativo con un ritmo envolvente y variado. Utiliza descripciones sensoriales vívidas (colores, sensaciones, emociones). Prefiere mostrar las acciones o sentimientos del protagonista en lugar de solo nombrarlos (técnica 'show, don't tell'). Evita un tono puramente informativo o seco."
  },
  {
    name: "🧠 Ciencia y Tecnología Sencilla",
    description: "Explicaciones de temas complejos usando analogías cotidianas accesibles.",
    prompt: "Tono divulgativo, accesible y entusiasta. Tu objetivo es explicar conceptos tecnológicos o científicos complejos de forma que cualquier persona de 12 años lo entienda. Traduce términos oscuros a analogías de la vida cotidiana. Mantén el rigor de la información pero elimina por completo la jerga innecesaria."
  }
];
