export interface StudyCornerBlock {
  id: string;
  block_id: string;
  nome: string;
  descricao?: string | null;
  materia?: string | null;
  ordem?: number | null;
}

export interface StudyCornerQuestion {
  id: string;
  bloco_raiz_id: string;
  caso_id: string | null;
  caso_nome: string;
  numero: string;
  topico: string;
  categoria: string;
  enunciado_texto?: string | null;
  imagens_urls: string[];
  gabarito_texto?: string | null;
  gabarito_imagens_urls: string[];
}

export interface StudyCornerCasoGroup {
  casoId: string;
  casoNome: string;
  questions: StudyCornerQuestion[];
}

export interface UserAnswerStat {
  ultimo: "acerto" | "erro";
  totalErros: number;
  totalAcertos: number;
}

export type CameraPreset = "desk" | "binder" | "window";
export type BinderRightMode = "cadernos" | "questoes";
