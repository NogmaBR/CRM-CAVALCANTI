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
      automation_rules: {
        Row: {
          ativo: boolean
          chave: string
          config: Json
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          chave: string
          config?: Json
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          chave?: string
          config?: Json
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          created_at: string | null
          duracao_ms: number | null
          entidade_id: string | null
          evento: string
          id: string
          motivo: string | null
          payload: Json | null
          regra_chave: string
          status: string
        }
        Insert: {
          created_at?: string | null
          duracao_ms?: number | null
          entidade_id?: string | null
          evento: string
          id?: string
          motivo?: string | null
          payload?: Json | null
          regra_chave: string
          status: string
        }
        Update: {
          created_at?: string | null
          duracao_ms?: number | null
          entidade_id?: string | null
          evento?: string
          id?: string
          motivo?: string | null
          payload?: Json | null
          regra_chave?: string
          status?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          id: string
          origem: string
          origem_id: string
          obra_id: string | null
          titulo: string
          conteudo: string
          hash_conteudo: string
          indexado_em: string | null
          created_at: string | null
          updated_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          origem: string
          origem_id: string
          obra_id?: string | null
          titulo: string
          conteudo: string
          hash_conteudo: string
          indexado_em?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          origem?: string
          origem_id?: string
          obra_id?: string | null
          titulo?: string
          conteudo?: string
          hash_conteudo?: string
          indexado_em?: string | null
          created_at?: string | null
          updated_at?: string | null
          deleted_at?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          id: string
          documento_id: string
          ordem: number
          conteudo: string
          embedding: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          documento_id: string
          ordem: number
          conteudo: string
          embedding?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          documento_id?: string
          ordem?: number
          conteudo?: string
          embedding?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          id: string
          canal: string
          autorizado_id: string | null
          user_id: string | null
          obra_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          canal: string
          autorizado_id?: string | null
          user_id?: string | null
          obra_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          canal?: string
          autorizado_id?: string | null
          user_id?: string | null
          obra_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          id: string
          conversation_id: string
          papel: string
          conteudo: string
          fontes: Json | null
          tokens_entrada: number | null
          tokens_saida: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          papel: string
          conteudo: string
          fontes?: Json | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          papel?: string
          conteudo?: string
          fontes?: Json | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      ai_tool_calls: {
        Row: {
          id: string
          message_id: string
          ferramenta: string
          argumentos: Json | null
          resultado: Json | null
          ok: boolean
          erro: string | null
          duracao_ms: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          message_id: string
          ferramenta: string
          argumentos?: Json | null
          resultado?: Json | null
          ok?: boolean
          erro?: string | null
          duracao_ms?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          message_id?: string
          ferramenta?: string
          argumentos?: Json | null
          resultado?: Json | null
          ok?: boolean
          erro?: string | null
          duracao_ms?: number | null
          created_at?: string | null
        }
        Relationships: []
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
          pagamento_id: string | null
          resolvida: boolean | null
          resolvida_via: string | null
          respondida_em: string | null
          resposta_bruta: string | null
          resultado: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mensagem_id: string
          msg_id_pergunta_uazapi?: string | null
          pergunta_enviada: string
          pagamento_id?: string | null
          resolvida?: boolean | null
          resolvida_via?: string | null
          respondida_em?: string | null
          resposta_bruta?: string | null
          resultado?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mensagem_id?: string
          msg_id_pergunta_uazapi?: string | null
          pergunta_enviada?: string
          pagamento_id?: string | null
          resolvida?: boolean | null
          resolvida_via?: string | null
          respondida_em?: string | null
          resposta_bruta?: string | null
          resultado?: string | null
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
          criado_por_user_id: string | null
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
          criado_por_user_id?: string | null
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
          criado_por_user_id?: string | null
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
            foreignKeyName: "documentos_criado_por_user_id_fkey"
            columns: ["criado_por_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
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
      rate_limits: {
        Row: {
          chave: string
          hits: number
          janela_inicio: string
        }
        Insert: {
          chave: string
          hits?: number
          janela_inicio?: string
        }
        Update: {
          chave?: string
          hits?: number
          janela_inicio?: string
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
          texto_transcrito: string | null
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
          texto_transcrito?: string | null
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
          texto_transcrito?: string | null
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
      obra_compartilhamentos: {
        Row: {
          acessos: number
          created_at: string | null
          criado_por_user_id: string | null
          descricao: string | null
          expira_em: string | null
          id: string
          obra_id: string
          revogado_em: string | null
          token: string
          ultimo_acesso_em: string | null
        }
        Insert: {
          acessos?: number
          created_at?: string | null
          criado_por_user_id?: string | null
          descricao?: string | null
          expira_em?: string | null
          id?: string
          obra_id: string
          revogado_em?: string | null
          token: string
          ultimo_acesso_em?: string | null
        }
        Update: {
          acessos?: number
          created_at?: string | null
          criado_por_user_id?: string | null
          descricao?: string | null
          expira_em?: string | null
          id?: string
          obra_id?: string
          revogado_em?: string | null
          token?: string
          ultimo_acesso_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_compartilhamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
          email_prefs: Json
          nome: string
          papel: Database["public"]["Enums"]["papel_usuario"]
          telefone: string | null
          tema_preferido: Database["public"]["Enums"]["tema_preferido"] | null
          timezone: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email_prefs?: Json
          nome: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          telefone?: string | null
          tema_preferido?: Database["public"]["Enums"]["tema_preferido"] | null
          timezone?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email_prefs?: Json
          nome?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          telefone?: string | null
          tema_preferido?: Database["public"]["Enums"]["tema_preferido"] | null
          timezone?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhooks_outbound: {
        Row: {
          ativo: boolean
          created_at: string | null
          criado_por_user_id: string | null
          deleted_at: string | null
          eventos: string[]
          id: string
          nome: string
          secret: string
          total_execucoes: number
          ultima_execucao_em: string | null
          ultima_execucao_erro: string | null
          ultima_execucao_status: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          criado_por_user_id?: string | null
          deleted_at?: string | null
          eventos?: string[]
          id?: string
          nome: string
          secret: string
          total_execucoes?: number
          ultima_execucao_em?: string | null
          ultima_execucao_erro?: string | null
          ultima_execucao_status?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          criado_por_user_id?: string | null
          deleted_at?: string | null
          eventos?: string[]
          id?: string
          nome?: string
          secret?: string
          total_execucoes?: number
          ultima_execucao_em?: string | null
          ultima_execucao_erro?: string | null
          ultima_execucao_status?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_outbound_criado_por_user_id_fkey"
            columns: ["criado_por_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
      increment_webhook_execution: {
        Args: { p_webhook_id: string; p_status: number; p_erro: string | null }
        Returns: undefined
      }
      rate_limit_hit: {
        Args: { p_chave: string; p_janela_segundos: number; p_max: number }
        Returns: {
          permitido: boolean
          hits: number
          reset_em: string
        }[]
      }
      rate_limit_reset: {
        Args: { p_chave: string }
        Returns: undefined
      }
      rate_limit_purge: {
        Args: { p_idade_horas?: number }
        Returns: number
      }
      purgar_automation_executions: {
        Args: { p_dias?: number }
        Returns: number
      }
      fila_enfileirar: {
        Args: { p_fila: string; p_payload: Json; p_delay?: number }
        Returns: number
      }
      fila_ler: {
        Args: { p_fila: string; p_vt?: number; p_qtd?: number }
        Returns: {
          msg_id: number
          read_ct: number
          enqueued_at: string
          payload: Json
        }[]
      }
      fila_concluir: {
        Args: { p_fila: string; p_msg_id: number }
        Returns: boolean
      }
      fila_arquivar: {
        Args: { p_fila: string; p_msg_id: number }
        Returns: boolean
      }
      saude_sistema: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      alertar_se_doente: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      buscar_conhecimento: {
        Args: {
          p_embedding: string
          p_limite?: number
          p_obra_id?: string | null
          p_similaridade_minima?: number
        }
        Returns: {
          chunk_id: string
          documento_id: string
          origem: string
          origem_id: string
          obra_id: string | null
          titulo: string
          conteudo: string
          similaridade: number
        }[]
      }
      fila_arquivadas: {
        Args: { p_limite?: number }
        Returns: {
          fila: string
          msg_id: number
          tentativas: number
          enfileirado_em: string
          arquivado_em: string
          payload: Json
        }[]
      }
      fila_metricas: {
        Args: Record<PropertyKey, never>
        Returns: {
          fila: string
          na_fila: number
          visiveis: number
          mais_antiga_seg: number | null
          total_ja_enfileirado: number
        }[]
      }
      registrar_acesso_compartilhamento: {
        Args: { p_token: string }
        Returns: undefined
      }
      merge_fornecedores_atomic: {
        Args: { p_keep_id: string; p_drop_id: string }
        Returns: {
          pagamentos_movidos: number
          documentos_movidos: number
          apelidos_movidos: number
          drop_nome: string
        }[]
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
        | "recusada"
        | "erro"
      msg_tipo: "texto" | "imagem" | "pdf" | "audio"
      obra_status: "ativa" | "pausada" | "concluida" | "arquivada"
      obra_tipo: "nova" | "reforma"
      origem_fornecedor: "manual" | "auto_detectado"
      pagamento_origem: "whatsapp" | "manual" | "importado"
      pagamento_status: "confirmado" | "aguardando" | "recusado" | "erro"
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
