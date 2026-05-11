// Auto-generated from Supabase schema.
// Regenerate: npm run supabase:types  (equivalente a: supabase gen types typescript --local > src/types/database.ts)
// Placeholder até a primeira migration ser aplicada localmente.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
