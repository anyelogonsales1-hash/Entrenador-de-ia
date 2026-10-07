export interface KeyCorrection {
  before: string;
  after: string;
  reason: string;
}

export interface HistoryItem {
  id: string;
  topic: string;
  originalText: string;
  editedText: string;
  modificationsSummary: string;
  detectedRules: string[];
  keyCorrections: KeyCorrection[];
  timestamp: string;
  rulesIntegrated?: boolean;
  userComment?: string;
}

export interface PresetStyle {
  name: string;
  description: string;
  prompt: string;
}

export interface StyleTransferSegment {
  id: string;
  originalBlock: string;
  rewrittenBlock: string;
  styleApplied: string;
  detectedRules: string[];
  status: "pending" | "accepted" | "rejected";
  editedBlock?: string;
  userComment?: string;
}

export interface LLMConstraint {
  constraint: string;
  description: string;
  workaround: string;
}

export interface ProjectSection {
  id: string;
  title: string;
  estimatedWords: number;
  structuralPurpose: string;
  keySubsections: string[];
  instructions: string;
}

export interface StructureSimulation {
  projectName: string;
  overallDescription: string;
  llmConstraints: LLMConstraint[];
  sections: ProjectSection[];
}

