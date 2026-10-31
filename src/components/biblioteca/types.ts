import type { BancoQuestion } from "../banco/QuestionsTable";
import type { QuestionStats } from "../banco/CadernosTab";

export interface Caso3DGroup {
  id: string;
  nome: string;
  questoes: BancoQuestion[];
}

export interface Caderno3DItem {
  id: string;
  nome: string;
  materia: string;
  casos: Caso3DGroup[];
  questoes: BancoQuestion[];
  // Atributos visuais e espaciais no espaço 3D
  coverColor: string;
  accentColor: string;
  goldTone: string;
  thickness: number; // espessura em unidades 3D
  position: [number, number, number];
  rotation: [number, number, number];
  floatSpeed: number;
  floatOffset: number;
  floatAmplitude: number;
  rotationSpeed: number;
}
