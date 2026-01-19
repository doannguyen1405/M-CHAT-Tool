
export enum ExaminerPosition {
  DIRECTOR = 'Giám đốc/P.Giám đốc',
  MANAGER = 'Quản lý',
  TEACHER = 'Giáo viên',
  SPECIALIST = 'Chuyên viên'
}

export interface PatientInfo {
  testDate: string;
  childName: string;
  homeName: string;
  birthDate: string;
  ageInMonths: number;
  examinerName: string;
  examinerPosition: ExaminerPosition;
}

export interface Question {
  id: number;
  text: string;
  example?: string;
  isSpecial: boolean; // Questions 2, 5, 12 are special
}

export interface AnswerState {
  [key: number]: boolean | null; // true for "Có", false for "Không"
}

export enum RiskLevel {
  LOW = 'NGUY CƠ THẤP',
  MEDIUM = 'NGUY CƠ TRUNG BÌNH',
  HIGH = 'NGUY CƠ CAO'
}
