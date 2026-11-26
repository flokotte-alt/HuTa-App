export type DateFieldProps = {
  label: string;
  value: string; // JJJJ-MM-TT oder leer
  onChange: (iso: string) => void;
  min?: string;
  clearable?: boolean;
};
