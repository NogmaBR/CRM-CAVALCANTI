export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          acao: string
          created_at: string | null
          diff: Json | null
          entidade: string
          entidade_id: string
          id: number
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          diff?: Json | null
          entidade: string
          entidade_id: string
          id?: number
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          diff?: Json | null
          entidade?: string
          entidade_id?: string
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      autorizados: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          deleted_at: string | null
          id: string
          nome: string
          papel_obra: string | null
          telefone_whats: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          nome: string
          papel_obra?: string | null
          telefone_whats: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          nome?: string
          papel_obra?: string | null
          telefone_whats?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string | null
          created_at: string | null
          deleted_at: string | null
          icone: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          deleted_at?: string | null
          icone?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          deleted_at?: string | null
          icone?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      confirmacoes_pendentes: {
        Row: {
          created_at: string | null
          id: string
          mensagem_id: string
          msg_id_pergunta_uazapi: string | null
          pergunta_enviada: string
          resolvida: boolean | null
          respondida_em: string | null
          resposta_bruta: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mensagem_id: string
          msg_id_pergunta_uazapi?: string | null
          pergunta_enviada: string
          resolvida?: boolean | null
          respondida_em?: string | null
          resposta_bruta?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mensagem_id?: string
          msg_id_pergunta_uazapi?: string | null
          pergunta_enviada?: string
          resolvida?: boolean | null
          respondida_em?: string | null
          resposta_bruta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confirmacoes_pendentes_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens_whats"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          chave_acesso_nf: string | null
          created_at: string | null
          deleted_at: string | null
          fornecedor_id: string | null
          hash_sha256: string | null
          id: string
          mime_type: string
          nome_arquivo: string
          numero_nf: string | null
          obra_id: string | null
          onedrive_file_id: string | null
          pagamento_id: string | null
          storage_path: string
          tamanho_bytes: number | null
          tipo: Database["public"]["Enums"]["anexo_tipo"]
          updated_at: string | null
        }
        Insert: {
          chave_acesso_nf?: string | null
          created_at?: string | null
          deleted_at?: string | null
          fornecedor_id?: string | null
          hash_sha256?: string | null
          id?: string
          mime_type: string
          nome_arquivo: string
          numero_nf?: string | null
          obra_id?: string | null
          onedrive_file_id?: string | null
          pagamento_id?: string | null
          storage_path: string
          tamanho_bytes?: number | null
          tipo: Database["public"]["Enums"]["anexo_tipo"]
          updated_at?: string | null
        }
        Update: {
          chave_acesso_nf?: string | null
          created_at?: string | null
          deleted_at?: string | null
          fornecedor_id?: string | null
          hash_sha256?: string | null
          id?: string
          mime_type?: string
          nome_arquivo?: string
          numero_nf?: string | null
          obra_id?: string | null
          onedrive_file_id?: string | null
          pagamento_id?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: Database["public"]["Enums"]["anexo_tipo"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedor_apelidos: {
        Row: {
          apelido: string
          created_at: string | null
          criado_por_ia: boolean | null
          fornecedor_id: string
          id: string
          vezes_visto: number | null
        }
        Insert: {
          apelido: string
          created_at?: string | null
          criado_por_ia?: boolean | null
          fornecedor_id: string
          id?: string
          vezes_visto?: number | null
        }
        Update: {
          apelido?: string
          created_at?: string | null
          criado_por_ia?: boolean | null
          fornecedor_id?: string
          id?: string
          vezes_visto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_apelidos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean | null
          categoria_id: string | null
          created_at: string | null
          deleted_at: string | null
          documento: string | null
          documento_tipo: Database["public"]["Enums"]["documento_tipo"] | null
          email: string | null
          id: string
          nome: string
          origem: Database["public"]["Enums"]["origem_fornecedor"] | null
          razao_social: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          documento?: string | null
          documento_tipo?: Database["public"]["Enums"]["documento_tipo"] | null
          email?: string | null
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["origem_fornecedor"] | null
          razao_social?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          documento?: string | null
          documento_tipo?: Database["public"]["Enums"]["documento_tipo"] | null
          email?: string | null
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["origem_fornecedor"] | null
          razao_social?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes_agendados: {
        Row: {
          alvo_id: string | null
          ativo: boolean | null
          created_at: string | null
          cron_expressao: string
          id: string
          tipo: string
          ultima_execucao: string | null
        }
        Insert: {
          alvo_id?: string | null
          ativo?: boolean | null
          created_at?: string | null
          cron_expressao: string
          id?: string
          tipo: string
          ultima_execucao?: string | null
        }
        Update: {
          alvo_id?: string | null
          ativo?: boolean | null
          created_at?: string | null
          cron_expressao?: string
          id?: string
          tipo?: string
          ultima_execucao?: string | null
        }
        Relationships: []
      }
      mensagens_whats: {
        Row: {
          autorizado_id: string | null
          confianca_ia: number | null
          created_at: string | null
          dados_extraidos: Json | null
          documento_id: string | null
          erro_msg: string | null
          id: string
          midia_mime: string | null
          midia_storage_path: string | null
          msg_id_uazapi: string
          pagamento_id: string | null
          recebida_em: string
          status: Database["public"]["Enums"]["msg_status"]
          telefone_from: string
          tentativas_reprocessamento: number | null
          texto_bruto: string | null
          tipo: Database["public"]["Enums"]["msg_tipo"]
          updated_at: string | null
        }
        Insert: {
          autorizado_id?: string | null
          confianca_ia?: number | null
          created_at?: string | null
          dados_extraidos?: Json | null
          documento_id?: string | null
          erro_msg?: string | null
          id?: string
          midia_mime?: string | null
          midia_storage_path?: string | null
          msg_id_uazapi: string
          pagamento_id?: string | null
          recebida_em: string
          status?: Database["public"]["Enums"]["msg_status"]
          telefone_from: string
          tentativas_reprocessamento?: number | null
          texto_bruto?: string | null
          tipo: Database["public"]["Enums"]["msg_tipo"]
          updated_at?: string | null
        }
        Update: {
          autorizado_id?: string | null
          confianca_ia?: number | null
          created_at?: string | null
          dados_extraidos?: Json | null
          documento_id?: string | null
          erro_msg?: string | null
          id?: string
          midia_mime?: string | null
          midia_storage_path?: string | null
          msg_id_uazapi?: string
          pagamento_id?: string | null
          recebida_em?: string
          status?: Database["public"]["Enums"]["msg_status"]
          telefone_from?: string
          tentativas_reprocessamento?: number | null
          texto_bruto?: string | null
          tipo?: Database["public"]["Enums"]["msg_tipo"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_msgs_documento"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_msgs_pagamento"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_whats_autorizado_id_fkey"
            columns: ["autorizado_id"]
            isOneToOne: false
            referencedRelation: "autorizados"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_email: {
        Row: {
          assunto: string
          contexto: Json | null
          corpo: string
          created_at: string | null
          destinatario: string
          enviada_em: string | null
          erro: string | null
          id: string
        }
        Insert: {
          assunto: string
          contexto?: Json | null
          corpo: string
          created_at?: string | null
          destinatario: string
          enviada_em?: string | null
          erro?: string | null
          id?: string
        }
        Update: {
          assunto?: string
          contexto?: Json | null
          corpo?: string
          created_at?: string | null
          destinatario?: string
          enviada_em?: string | null
          erro?: string | null
          id?: string
        }
        Relationships: []
      }
      obras: {
        Row: {
          apelidos: string[] | null
          cliente: string | null
          created_at: string | null
          data_inicio: string | null
          data_prevista_fim: string | null
          deleted_at: string | null
          endereco: Json | null
          id: string
          nome: string
          observacoes: string | null
          onedrive_folder_id: string | null
          orcamento: number | null
          status: Database["public"]["Enums"]["obra_status"] | null
          tipo: Database["public"]["Enums"]["obra_tipo"] | null
          updated_at: string | null
        }
        Insert: {
          apelidos?: string[] | null
          cliente?: string | null
          created_at?: string | null
          data_inicio?: string | null
          data_prevista_fim?: string | null
          deleted_at?: string | null
          endereco?: Json | null
          id?: string
          nome: string
          observacoes?: string | null
          onedrive_folder_id?: string | null
          orcamento?: number | null
          status?: Database["public"]["Enums"]["obra_status"] | null
          tipo?: Database["public"]["Enums"]["obra_tipo"] | null
          updated_at?: string | null
        }
        Update: {
          apelidos?: string[] | null
          cliente?: string | null
          created_at?: string | null
          data_inicio?: string | null
          data_prevista_fim?: string | null
          deleted_at?: string | null
          endereco?: Json | null
          id?: string
          nome?: string
          observacoes?: string | null
          onedrive_folder_id?: string | null
          orcamento?: number | null
          status?: Database["public"]["Enums"]["obra_status"] | null
          tipo?: Database["public"]["Enums"]["obra_tipo"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          categoria_id: string | null
          created_at: string | null
          criado_por_user_id: string | null
          criado_via_msg_id: string | null
          data_pagamento: string
          deleted_at: string | null
          descricao: string | null
          fornecedor_id: string | null
          id: string
          obra_id: string
          observacoes: string | null
          origem: Database["public"]["Enums"]["pagamento_origem"]
          status_pagto: Database["public"]["Enums"]["pagamento_status"] | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string | null
          criado_por_user_id?: string | null
          criado_via_msg_id?: string | null
          data_pagamento?: string
          deleted_at?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          obra_id: string
          observacoes?: string | null
          origem: Database["public"]["Enums"]["pagamento_origem"]
          status_pagto?: Database["public"]["Enums"]["pagamento_status"] | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string | null
          criado_por_user_id?: string | null
          criado_via_msg_id?: string | null
          data_pagamento?: string
          deleted_at?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          obra_id?: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["pagamento_origem"]
          status_pagto?: Database["public"]["Enums"]["pagamento_status"] | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_criado_por_user_id_fkey"
            columns: ["criado_por_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pagamentos_criado_via_msg_id_fkey"
            columns: ["criado_via_msg_id"]
            isOneToOne: false
            referencedRelation: "mensagens_whats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          nome: string
          papel: Database["public"]["Enums"]["papel_usuario"]
          telefone: string | null
          tema_preferido: Database["public"]["Enums"]["tema_preferido"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          nome: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          telefone?: string | null
          tema_preferido?: Database["public"]["Enums"]["tema_preferido"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          nome?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          telefone?: string | null
          tema_preferido?: Database["public"]["Enums"]["tema_preferido"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { roles: Database["public"]["Enums"]["papel_usuario"][] }
        Returns: boolean
      }
    }
    Enums: {
      anexo_tipo: "nota_fiscal" | "comprovante" | "contrato" | "outro"
      documento_tipo: "cnpj" | "cpf"
      msg_status:
        | "recebida"
        | "processando"
        | "classificada"
        | "confirmada"
        | "erro"
      msg_tipo: "texto" | "imagem" | "pdf" | "audio"
      obra_status: "ativa" | "pausada" | "concluida" | "arquivada"
      obra_tipo: "nova" | "reforma"
      origem_fornecedor: "manual" | "auto_detectado"
      pagamento_origem: "whatsapp" | "manual" | "importado"
      pagamento_status: "confirmado" | "aguardando" | "erro"
      papel_usuario: "admin" | "gestor" | "financeiro" | "leitura"
      tema_preferido: "light" | "black" | "dark"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      anexo_tipo: ["nota_fiscal", "comprovante", "contrato", "outro"],
      documento_tipo: ["cnpj", "cpf"],
      msg_status: [
        "recebida",
        "processando",
        "classificada",
        "confirmada",
        "erro",
      ],
      msg_tipo: ["texto", "imagem", "pdf", "audio"],
      obra_status: ["ativa", "pausada", "concluida", "arquivada"],
      obra_tipo: ["nova", "reforma"],
      origem_fornecedor: ["manual", "auto_detectado"],
      pagamento_origem: ["whatsapp", "manual", "importado"],
      pagamento_status: ["confirmado", "aguardando", "erro"],
      papel_usuario: ["admin", "gestor", "financeiro", "leitura"],
      tema_preferido: ["light", "black", "dark"],
    },
  },
} as const
