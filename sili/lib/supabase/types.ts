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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      achat_commandes: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_commande: string | null
          date_livraison_prevue: string | null
          fournisseur_id: string | null
          id: string
          montant_ht: number | null
          montant_ttc: number | null
          notes: string | null
          numero: string
          societe_id: string
          statut: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_commande?: string | null
          date_livraison_prevue?: string | null
          fournisseur_id?: string | null
          id?: string
          montant_ht?: number | null
          montant_ttc?: number | null
          notes?: string | null
          numero: string
          societe_id: string
          statut?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_commande?: string | null
          date_livraison_prevue?: string | null
          fournisseur_id?: string | null
          id?: string
          montant_ht?: number | null
          montant_ttc?: number | null
          notes?: string | null
          numero?: string
          societe_id?: string
          statut?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achat_commandes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achat_commandes_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "achat_fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achat_commandes_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achat_commandes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      achat_fournisseurs: {
        Row: {
          adresse: string | null
          conditions_paiement: string | null
          contact_principal: string | null
          created_at: string | null
          delai_livraison_jours: number | null
          email: string | null
          id: string
          is_active: boolean | null
          nom: string
          notes: string | null
          societe_id: string
          telephone: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          conditions_paiement?: string | null
          contact_principal?: string | null
          created_at?: string | null
          delai_livraison_jours?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          nom: string
          notes?: string | null
          societe_id: string
          telephone?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          conditions_paiement?: string | null
          contact_principal?: string | null
          created_at?: string | null
          delai_livraison_jours?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          nom?: string
          notes?: string | null
          societe_id?: string
          telephone?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achat_fournisseurs_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achat_fournisseurs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compta_ecritures: {
        Row: {
          compte_id: string
          created_at: string | null
          created_by: string | null
          credit: number | null
          date_ecriture: string
          debit: number | null
          exercice_id: string | null
          id: string
          is_validated: boolean | null
          journal: string
          libelle: string
          numero_piece: string | null
          reference_source: string | null
          societe_id: string
          tenant_id: string
          validated_by: string | null
        }
        Insert: {
          compte_id: string
          created_at?: string | null
          created_by?: string | null
          credit?: number | null
          date_ecriture: string
          debit?: number | null
          exercice_id?: string | null
          id?: string
          is_validated?: boolean | null
          journal: string
          libelle: string
          numero_piece?: string | null
          reference_source?: string | null
          societe_id: string
          tenant_id: string
          validated_by?: string | null
        }
        Update: {
          compte_id?: string
          created_at?: string | null
          created_by?: string | null
          credit?: number | null
          date_ecriture?: string
          debit?: number | null
          exercice_id?: string | null
          id?: string
          is_validated?: boolean | null
          journal?: string
          libelle?: string
          numero_piece?: string | null
          reference_source?: string | null
          societe_id?: string
          tenant_id?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compta_ecritures_compte_id_fkey"
            columns: ["compte_id"]
            isOneToOne: false
            referencedRelation: "compta_plan_comptable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compta_ecritures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compta_ecritures_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "compta_exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compta_ecritures_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compta_ecritures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compta_ecritures_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compta_exercices: {
        Row: {
          created_at: string | null
          date_debut: string
          date_fin: string
          id: string
          libelle: string
          societe_id: string
          statut: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          date_debut: string
          date_fin: string
          id?: string
          libelle: string
          societe_id: string
          statut?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          date_debut?: string
          date_fin?: string
          id?: string
          libelle?: string
          societe_id?: string
          statut?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compta_exercices_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compta_exercices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compta_plan_comptable: {
        Row: {
          classe: number | null
          created_at: string | null
          id: string
          intitule: string
          is_active: boolean | null
          is_systeme: boolean | null
          numero: string
          sens: string | null
          societe_id: string
          tenant_id: string
          type_compte: string | null
        }
        Insert: {
          classe?: number | null
          created_at?: string | null
          id?: string
          intitule: string
          is_active?: boolean | null
          is_systeme?: boolean | null
          numero: string
          sens?: string | null
          societe_id: string
          tenant_id: string
          type_compte?: string | null
        }
        Update: {
          classe?: number | null
          created_at?: string | null
          id?: string
          intitule?: string
          is_active?: boolean | null
          is_systeme?: boolean | null
          numero?: string
          sens?: string | null
          societe_id?: string
          tenant_id?: string
          type_compte?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compta_plan_comptable_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compta_plan_comptable_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigne_a: string | null
          converti_en: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          entreprise: string | null
          id: string
          nom: string
          notes: string | null
          score: number | null
          societe_id: string
          source: string | null
          statut: string | null
          telephone: string | null
          tenant_id: string
          updated_at: string | null
          valeur_estimee: number | null
        }
        Insert: {
          assigne_a?: string | null
          converti_en?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          entreprise?: string | null
          id?: string
          nom: string
          notes?: string | null
          score?: number | null
          societe_id: string
          source?: string | null
          statut?: string | null
          telephone?: string | null
          tenant_id: string
          updated_at?: string | null
          valeur_estimee?: number | null
        }
        Update: {
          assigne_a?: string | null
          converti_en?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          entreprise?: string | null
          id?: string
          nom?: string
          notes?: string | null
          score?: number | null
          societe_id?: string
          source?: string | null
          statut?: string | null
          telephone?: string | null
          tenant_id?: string
          updated_at?: string | null
          valeur_estimee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_assigne_a_fkey"
            columns: ["assigne_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_converti_en_fkey"
            columns: ["converti_en"]
            isOneToOne: false
            referencedRelation: "vente_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunites: {
        Row: {
          assigne_a: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          date_cloture_prevue: string | null
          etape: string | null
          id: string
          notes: string | null
          probabilite: number | null
          societe_id: string
          tenant_id: string
          titre: string
          updated_at: string | null
          valeur: number | null
        }
        Insert: {
          assigne_a?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_cloture_prevue?: string | null
          etape?: string | null
          id?: string
          notes?: string | null
          probabilite?: number | null
          societe_id: string
          tenant_id: string
          titre: string
          updated_at?: string | null
          valeur?: number | null
        }
        Update: {
          assigne_a?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_cloture_prevue?: string | null
          etape?: string | null
          id?: string
          notes?: string | null
          probabilite?: number | null
          societe_id?: string
          tenant_id?: string
          titre?: string
          updated_at?: string | null
          valeur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunites_assigne_a_fkey"
            columns: ["assigne_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vente_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunites_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          level: string
          message: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          service: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          level: string
          message: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          service: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          level?: string
          message?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          service?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string | null
          read_at: string | null
          tenant_id: string | null
          titre: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          read_at?: string | null
          tenant_id?: string | null
          titre: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          read_at?: string | null
          tenant_id?: string | null
          titre?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          is_super_admin: boolean | null
          last_login_at: string | null
          phone: string | null
          preferred_currency: string | null
          preferred_language: string | null
          privacy_accepted_at: string | null
          role: Database["public"]["Enums"]["global_role"] | null
          tenant_id: string | null
          terms_accepted_at: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          privacy_accepted_at?: string | null
          role?: Database["public"]["Enums"]["global_role"] | null
          tenant_id?: string | null
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_super_admin?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          privacy_accepted_at?: string | null
          role?: Database["public"]["Enums"]["global_role"] | null
          tenant_id?: string | null
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_conges: {
        Row: {
          approuve_le: string | null
          approuve_par: string | null
          commentaire_rh: string | null
          created_at: string | null
          created_by: string | null
          date_debut: string
          date_fin: string
          employe_id: string
          id: string
          justificatif_path: string | null
          motif: string | null
          nb_heures: number | null
          nb_jours: number | null
          societe_id: string
          statut: string | null
          tenant_id: string
          type_conge: string
          typologie: string
          updated_at: string | null
        }
        Insert: {
          approuve_le?: string | null
          approuve_par?: string | null
          commentaire_rh?: string | null
          created_at?: string | null
          created_by?: string | null
          date_debut: string
          date_fin: string
          employe_id: string
          id?: string
          justificatif_path?: string | null
          motif?: string | null
          nb_heures?: number | null
          nb_jours?: number | null
          societe_id: string
          statut?: string | null
          tenant_id: string
          type_conge: string
          typologie?: string
          updated_at?: string | null
        }
        Update: {
          approuve_le?: string | null
          approuve_par?: string | null
          commentaire_rh?: string | null
          created_at?: string | null
          created_by?: string | null
          date_debut?: string
          date_fin?: string
          employe_id?: string
          id?: string
          justificatif_path?: string | null
          motif?: string | null
          nb_heures?: number | null
          nb_jours?: number | null
          societe_id?: string
          statut?: string | null
          tenant_id?: string
          type_conge?: string
          typologie?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_conges_approuve_par_fkey"
            columns: ["approuve_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_conges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_conges_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "rh_employes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_conges_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_conges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_employe_documents: {
        Row: {
          created_at: string
          employe_id: string
          id: string
          nom_fichier: string
          societe_id: string
          storage_path: string
          taille_kb: number | null
          tenant_id: string
          type_doc: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          employe_id: string
          id?: string
          nom_fichier: string
          societe_id: string
          storage_path: string
          taille_kb?: number | null
          tenant_id: string
          type_doc: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          employe_id?: string
          id?: string
          nom_fichier?: string
          societe_id?: string
          storage_path?: string
          taille_kb?: number | null
          tenant_id?: string
          type_doc?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_employe_documents_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "rh_employes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_employe_documents_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_employe_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_employes: {
        Row: {
          adresse: string | null
          cni_numero: string | null
          cnps_numero: string | null
          created_at: string
          created_by: string | null
          date_embauche: string | null
          date_naissance: string | null
          departement: string | null
          email: string | null
          id: string
          lieu_naissance: string | null
          matricule: string
          nationalite: string | null
          nom: string
          photo_url: string | null
          poste: string | null
          prenom: string
          salaire_base: number | null
          sexe: string | null
          societe_id: string
          statut: string
          telephone: string | null
          tenant_id: string
          type_contrat: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adresse?: string | null
          cni_numero?: string | null
          cnps_numero?: string | null
          created_at?: string
          created_by?: string | null
          date_embauche?: string | null
          date_naissance?: string | null
          departement?: string | null
          email?: string | null
          id?: string
          lieu_naissance?: string | null
          matricule?: string
          nationalite?: string | null
          nom: string
          photo_url?: string | null
          poste?: string | null
          prenom: string
          salaire_base?: number | null
          sexe?: string | null
          societe_id: string
          statut?: string
          telephone?: string | null
          tenant_id: string
          type_contrat?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adresse?: string | null
          cni_numero?: string | null
          cnps_numero?: string | null
          created_at?: string
          created_by?: string | null
          date_embauche?: string | null
          date_naissance?: string | null
          departement?: string | null
          email?: string | null
          id?: string
          lieu_naissance?: string | null
          matricule?: string
          nationalite?: string | null
          nom?: string
          photo_url?: string | null
          poste?: string | null
          prenom?: string
          salaire_base?: number | null
          sexe?: string | null
          societe_id?: string
          statut?: string
          telephone?: string | null
          tenant_id?: string
          type_contrat?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_employes_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_employes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_presences: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          employe_id: string
          heure_entree: string | null
          heure_sortie: string | null
          id: string
          note: string | null
          societe_id: string
          statut: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          employe_id: string
          heure_entree?: string | null
          heure_sortie?: string | null
          id?: string
          note?: string | null
          societe_id: string
          statut?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          employe_id?: string
          heure_entree?: string | null
          heure_sortie?: string | null
          id?: string
          note?: string | null
          societe_id?: string
          statut?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_presences_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_presences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      societe_data_sharing: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          module: string
          source_societe_id: string
          target_societe_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          module: string
          source_societe_id: string
          target_societe_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          module?: string
          source_societe_id?: string
          target_societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "societe_data_sharing_source_societe_id_fkey"
            columns: ["source_societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societe_data_sharing_target_societe_id_fkey"
            columns: ["target_societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      societe_modules: {
        Row: {
          activated_at: string | null
          id: string
          is_active: boolean
          module: string
          societe_id: string
        }
        Insert: {
          activated_at?: string | null
          id?: string
          is_active?: boolean
          module: string
          societe_id: string
        }
        Update: {
          activated_at?: string | null
          id?: string
          is_active?: boolean
          module?: string
          societe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "societe_modules_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      societes: {
        Row: {
          adresse: string | null
          capital_social: number | null
          created_at: string | null
          devise: string | null
          email: string | null
          exercice_fiscal_debut: number | null
          forme_juridique: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          numero_contribuable: string | null
          numero_rccm: string | null
          pays: string | null
          portail_pin: string
          raison_sociale: string
          secteur_activite: string | null
          sigle: string | null
          site_web: string | null
          storage_gb: number
          telephone: string | null
          tenant_id: string
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          capital_social?: number | null
          created_at?: string | null
          devise?: string | null
          email?: string | null
          exercice_fiscal_debut?: number | null
          forme_juridique?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          numero_contribuable?: string | null
          numero_rccm?: string | null
          pays?: string | null
          portail_pin?: string
          raison_sociale: string
          secteur_activite?: string | null
          sigle?: string | null
          site_web?: string | null
          storage_gb?: number
          telephone?: string | null
          tenant_id: string
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          capital_social?: number | null
          created_at?: string | null
          devise?: string | null
          email?: string | null
          exercice_fiscal_debut?: number | null
          forme_juridique?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          numero_contribuable?: string | null
          numero_rccm?: string | null
          pays?: string | null
          portail_pin?: string
          raison_sociale?: string
          secteur_activite?: string | null
          sigle?: string | null
          site_web?: string | null
          storage_gb?: number
          telephone?: string | null
          tenant_id?: string
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "societes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_articles: {
        Row: {
          categorie: string | null
          created_at: string | null
          description: string | null
          designation: string
          emplacement: string | null
          id: string
          is_active: boolean | null
          prix_achat: number | null
          prix_vente: number | null
          reference: string
          societe_id: string
          stock_actuel: number | null
          stock_maximum: number | null
          stock_minimum: number | null
          tenant_id: string
          unite: string | null
          updated_at: string | null
        }
        Insert: {
          categorie?: string | null
          created_at?: string | null
          description?: string | null
          designation: string
          emplacement?: string | null
          id?: string
          is_active?: boolean | null
          prix_achat?: number | null
          prix_vente?: number | null
          reference: string
          societe_id: string
          stock_actuel?: number | null
          stock_maximum?: number | null
          stock_minimum?: number | null
          tenant_id: string
          unite?: string | null
          updated_at?: string | null
        }
        Update: {
          categorie?: string | null
          created_at?: string | null
          description?: string | null
          designation?: string
          emplacement?: string | null
          id?: string
          is_active?: boolean | null
          prix_achat?: number | null
          prix_vente?: number | null
          reference?: string
          societe_id?: string
          stock_actuel?: number | null
          stock_maximum?: number | null
          stock_minimum?: number | null
          tenant_id?: string
          unite?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_articles_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_articles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_mouvements: {
        Row: {
          article_id: string
          created_at: string | null
          created_by: string | null
          id: string
          motif: string | null
          prix_unitaire: number | null
          quantite: number
          reference_source: string | null
          societe_id: string
          source_type: string | null
          stock_apres: number
          stock_avant: number
          tenant_id: string
          type_mouvement: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          motif?: string | null
          prix_unitaire?: number | null
          quantite: number
          reference_source?: string | null
          societe_id: string
          source_type?: string | null
          stock_apres: number
          stock_avant: number
          tenant_id: string
          type_mouvement: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          motif?: string | null
          prix_unitaire?: number | null
          quantite?: number
          reference_source?: string | null
          societe_id?: string
          source_type?: string | null
          stock_apres?: number
          stock_avant?: number
          tenant_id?: string
          type_mouvement?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_mouvements_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "stock_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_modules: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      team_channels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          membres: string[] | null
          nom: string
          societe_id: string
          tenant_id: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          membres?: string[] | null
          nom: string
          societe_id: string
          tenant_id: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          membres?: string[] | null
          nom?: string
          societe_id?: string
          tenant_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channels_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          author_id: string
          channel_id: string
          contenu: string
          created_at: string | null
          edited_at: string | null
          id: string
          piece_jointe_url: string | null
          tenant_id: string
          type: string | null
        }
        Insert: {
          author_id: string
          channel_id: string
          contenu: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          piece_jointe_url?: string | null
          tenant_id: string
          type?: string | null
        }
        Update: {
          author_id?: string
          channel_id?: string
          contenu?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          piece_jointe_url?: string | null
          tenant_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_taches: {
        Row: {
          assigne_a: string | null
          created_at: string | null
          created_by: string | null
          date_echeance: string | null
          description: string | null
          id: string
          priorite: string | null
          societe_id: string
          statut: string | null
          tags: string[] | null
          tenant_id: string
          titre: string
          updated_at: string | null
        }
        Insert: {
          assigne_a?: string | null
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string | null
          description?: string | null
          id?: string
          priorite?: string | null
          societe_id: string
          statut?: string | null
          tags?: string[] | null
          tenant_id: string
          titre: string
          updated_at?: string | null
        }
        Update: {
          assigne_a?: string | null
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string | null
          description?: string | null
          id?: string
          priorite?: string | null
          societe_id?: string
          statut?: string | null
          tags?: string[] | null
          tenant_id?: string
          titre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_taches_assigne_a_fkey"
            columns: ["assigne_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_taches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_taches_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_taches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_backups: {
        Row: {
          completed_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          size_mb: number | null
          status: string
          storage_path: string | null
          tenant_id: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          size_mb?: number | null
          status?: string
          storage_path?: string | null
          tenant_id: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          size_mb?: number | null
          status?: string
          storage_path?: string | null
          tenant_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_backups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          activated_at: string | null
          config: Json | null
          id: string
          is_active: boolean | null
          module: Database["public"]["Enums"]["module_key"]
          tenant_id: string
        }
        Insert: {
          activated_at?: string | null
          config?: Json | null
          id?: string
          is_active?: boolean | null
          module: Database["public"]["Enums"]["module_key"]
          tenant_id: string
        }
        Update: {
          activated_at?: string | null
          config?: Json | null
          id?: string
          is_active?: boolean | null
          module?: Database["public"]["Enums"]["module_key"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_storage_usage: {
        Row: {
          backups_mb: number
          database_mb: number
          files_mb: number
          logs_mb: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          backups_mb?: number
          database_mb?: number
          files_mb?: number
          logs_mb?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          backups_mb?: number
          database_mb?: number
          files_mb?: number
          logs_mb?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_storage_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          max_licences: number
          max_societes: number
          max_storage_gb: number
          max_users: number | null
          metadata: Json | null
          name: string
          plan: string | null
          slug: string
          status: string | null
          timezone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_licences?: number
          max_societes?: number
          max_storage_gb?: number
          max_users?: number | null
          metadata?: Json | null
          name: string
          plan?: string | null
          slug: string
          status?: string | null
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_licences?: number
          max_societes?: number
          max_storage_gb?: number
          max_users?: number | null
          metadata?: Json | null
          name?: string
          plan?: string | null
          slug?: string
          status?: string | null
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_group_members: {
        Row: {
          created_at: string | null
          employe_id: string | null
          group_id: string
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          employe_id?: string | null
          group_id: string
          id?: string
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          employe_id?: string | null
          group_id?: string
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "rh_employes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_permissions: {
        Row: {
          granted_by: string
          group_id: string
          id: string
          module: string
          permission: string
          societe_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          granted_by: string
          group_id: string
          id?: string
          module: string
          permission?: string
          societe_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          granted_by?: string
          group_id?: string
          id?: string
          module?: string
          permission?: string
          societe_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          nom: string
          societe_id: string
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          nom: string
          societe_id: string
          tenant_id: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          nom?: string
          societe_id?: string
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          module: Database["public"]["Enums"]["module_key"]
          permission: Database["public"]["Enums"]["permission_level"]
          societe_id: string | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          module: Database["public"]["Enums"]["module_key"]
          permission?: Database["public"]["Enums"]["permission_level"]
          societe_id?: string | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          module?: Database["public"]["Enums"]["module_key"]
          permission?: Database["public"]["Enums"]["permission_level"]
          societe_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_module_permissions_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_module_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_module_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_societes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          societe_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          societe_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          societe_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_societes_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      vente_clients: {
        Row: {
          adresse: string | null
          contact_principal: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean | null
          nom: string
          notes: string | null
          numero_contribuable: string | null
          pays: string | null
          societe_id: string
          solde_credit: number | null
          telephone: string | null
          tenant_id: string
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          contact_principal?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          nom: string
          notes?: string | null
          numero_contribuable?: string | null
          pays?: string | null
          societe_id: string
          solde_credit?: number | null
          telephone?: string | null
          tenant_id: string
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          contact_principal?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          nom?: string
          notes?: string | null
          numero_contribuable?: string | null
          pays?: string | null
          societe_id?: string
          solde_credit?: number | null
          telephone?: string | null
          tenant_id?: string
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vente_clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_clients_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vente_devis: {
        Row: {
          client_id: string | null
          client_nom: string | null
          conditions: string | null
          created_at: string | null
          created_by: string | null
          date_emission: string | null
          date_expiration: string | null
          devise: string | null
          id: string
          montant_ht: number | null
          montant_ttc: number | null
          notes: string | null
          numero: string
          parent_devis_id: string | null
          societe_id: string
          statut: string | null
          taux_tva: number | null
          tenant_id: string
          tva_montant: number | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          client_id?: string | null
          client_nom?: string | null
          conditions?: string | null
          created_at?: string | null
          created_by?: string | null
          date_emission?: string | null
          date_expiration?: string | null
          devise?: string | null
          id?: string
          montant_ht?: number | null
          montant_ttc?: number | null
          notes?: string | null
          numero: string
          parent_devis_id?: string | null
          societe_id: string
          statut?: string | null
          taux_tva?: number | null
          tenant_id: string
          tva_montant?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          client_id?: string | null
          client_nom?: string | null
          conditions?: string | null
          created_at?: string | null
          created_by?: string | null
          date_emission?: string | null
          date_expiration?: string | null
          devise?: string | null
          id?: string
          montant_ht?: number | null
          montant_ttc?: number | null
          notes?: string | null
          numero?: string
          parent_devis_id?: string | null
          societe_id?: string
          statut?: string | null
          taux_tva?: number | null
          tenant_id?: string
          tva_montant?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vente_devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vente_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_devis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_devis_parent_devis_id_fkey"
            columns: ["parent_devis_id"]
            isOneToOne: false
            referencedRelation: "vente_devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_devis_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_devis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vente_devis_lignes: {
        Row: {
          created_at: string | null
          description: string | null
          designation: string
          devis_id: string
          id: string
          montant_ht: number | null
          ordre: number
          prix_unitaire: number
          quantite: number
          remise_pct: number | null
          unite: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          designation: string
          devis_id: string
          id?: string
          montant_ht?: number | null
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number | null
          unite?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          designation?: string
          devis_id?: string
          id?: string
          montant_ht?: number | null
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number | null
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vente_devis_lignes_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "vente_devis"
            referencedColumns: ["id"]
          },
        ]
      }
      vente_factures: {
        Row: {
          client_id: string | null
          client_nom: string | null
          created_at: string | null
          created_by: string | null
          date_echeance: string | null
          date_emission: string | null
          devis_id: string | null
          devise: string | null
          id: string
          montant_ht: number | null
          montant_paye: number | null
          montant_ttc: number | null
          notes: string | null
          numero: string
          societe_id: string
          statut: string | null
          taux_tva: number | null
          tenant_id: string
          tva_montant: number | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          client_nom?: string | null
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string | null
          date_emission?: string | null
          devis_id?: string | null
          devise?: string | null
          id?: string
          montant_ht?: number | null
          montant_paye?: number | null
          montant_ttc?: number | null
          notes?: string | null
          numero: string
          societe_id: string
          statut?: string | null
          taux_tva?: number | null
          tenant_id: string
          tva_montant?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          client_nom?: string | null
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string | null
          date_emission?: string | null
          devis_id?: string | null
          devise?: string | null
          id?: string
          montant_ht?: number | null
          montant_paye?: number | null
          montant_ttc?: number | null
          notes?: string | null
          numero?: string
          societe_id?: string
          statut?: string | null
          taux_tva?: number | null
          tenant_id?: string
          tva_montant?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vente_factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vente_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_factures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "vente_devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_factures_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_factures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vente_factures_lignes: {
        Row: {
          created_at: string | null
          designation: string
          facture_id: string
          id: string
          montant_ht: number | null
          ordre: number
          prix_unitaire: number
          quantite: number
          remise_pct: number | null
          unite: string | null
        }
        Insert: {
          created_at?: string | null
          designation: string
          facture_id: string
          id?: string
          montant_ht?: number | null
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number | null
          unite?: string | null
        }
        Update: {
          created_at?: string | null
          designation?: string
          facture_id?: string
          id?: string
          montant_ht?: number | null
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          remise_pct?: number | null
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vente_factures_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "vente_factures"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_comments: {
        Row: {
          action: string | null
          author_id: string
          contenu: string
          created_at: string | null
          id: string
          request_id: string
          tenant_id: string
        }
        Insert: {
          action?: string | null
          author_id: string
          contenu: string
          created_at?: string | null
          id?: string
          request_id: string
          tenant_id: string
        }
        Update: {
          action?: string | null
          author_id?: string
          contenu?: string
          created_at?: string | null
          id?: string
          request_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "workflow_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instance_steps: {
        Row: {
          actor_id: string | null
          commentaire: string | null
          created_at: string | null
          deadline_at: string | null
          escalated_at: string | null
          id: string
          instance_id: string
          ordre: number
          signature_data: string | null
          statut: string
          step_id: string
          traite_le: string | null
        }
        Insert: {
          actor_id?: string | null
          commentaire?: string | null
          created_at?: string | null
          deadline_at?: string | null
          escalated_at?: string | null
          id?: string
          instance_id: string
          ordre: number
          signature_data?: string | null
          statut?: string
          step_id: string
          traite_le?: string | null
        }
        Update: {
          actor_id?: string | null
          commentaire?: string | null
          created_at?: string | null
          deadline_at?: string | null
          escalated_at?: string | null
          id?: string
          instance_id?: string
          ordre?: number
          signature_data?: string | null
          statut?: string
          step_id?: string
          traite_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instance_steps_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_process_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          created_at: string | null
          current_step_ordre: number
          form_data: Json
          id: string
          initiator_id: string
          societe_id: string
          statut: string
          template_id: string
          tenant_id: string
          titre: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_step_ordre?: number
          form_data?: Json
          id?: string
          initiator_id: string
          societe_id: string
          statut?: string
          template_id: string
          tenant_id: string
          titre: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_step_ordre?: number
          form_data?: Json
          id?: string
          initiator_id?: string
          societe_id?: string
          statut?: string
          template_id?: string
          tenant_id?: string
          titre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_process_steps: {
        Row: {
          action_type: string
          assignee_id: string | null
          assignee_role: string | null
          assignee_type: string
          created_at: string | null
          deadline_days: number | null
          description: string | null
          escalation_to: string | null
          id: string
          mode_signature: string | null
          nom: string
          ordre: number
          template_id: string
        }
        Insert: {
          action_type: string
          assignee_id?: string | null
          assignee_role?: string | null
          assignee_type: string
          created_at?: string | null
          deadline_days?: number | null
          description?: string | null
          escalation_to?: string | null
          id?: string
          mode_signature?: string | null
          nom: string
          ordre: number
          template_id: string
        }
        Update: {
          action_type?: string
          assignee_id?: string | null
          assignee_role?: string | null
          assignee_type?: string
          created_at?: string | null
          deadline_days?: number | null
          description?: string | null
          escalation_to?: string | null
          id?: string
          mode_signature?: string | null
          nom?: string
          ordre?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_process_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_process_templates: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          form_schema: Json
          id: string
          is_active: boolean
          nom: string
          societe_id: string | null
          tenant_id: string
          type_process: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          form_schema?: Json
          id?: string
          is_active?: boolean
          nom: string
          societe_id?: string | null
          tenant_id: string
          type_process: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          form_schema?: Json
          id?: string
          is_active?: boolean
          nom?: string
          societe_id?: string | null
          tenant_id?: string
          type_process?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_process_templates_societe_id_fkey"
            columns: ["societe_id"]
            isOneToOne: false
            referencedRelation: "societes"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          assigned_to_group: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          justificatif_path: string | null
          priorite: string
          refused_at: string | null
          refused_by: string | null
          societe_id: string
          statut: string
          tenant_id: string
          titre: string
          type_demande: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          assigned_to_group?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          justificatif_path?: string | null
          priorite?: string
          refused_at?: string | null
          refused_by?: string | null
          societe_id: string
          statut?: string
          tenant_id: string
          titre: string
          type_demande: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          assigned_to_group?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          justificatif_path?: string | null
          priorite?: string
          refused_at?: string | null
          refused_by?: string | null
          societe_id?: string
          statut?: string
          tenant_id?: string
          titre?: string
          type_demande?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_requests_assigned_to_group_fkey"
            columns: ["assigned_to_group"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tenant_storage_summary: {
        Row: {
          backups_mb: number | null
          database_mb: number | null
          files_mb: number | null
          logs_mb: number | null
          tenant_id: string | null
          total_mb: number | null
          updated_at: string | null
        }
        Insert: {
          backups_mb?: number | null
          database_mb?: number | null
          files_mb?: number | null
          logs_mb?: number | null
          tenant_id?: string | null
          total_mb?: never
          updated_at?: string | null
        }
        Update: {
          backups_mb?: number | null
          database_mb?: number | null
          files_mb?: number | null
          logs_mb?: number | null
          tenant_id?: string | null
          total_mb?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_storage_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      register_new_tenant: {
        Args: {
          p_admin_name: string
          p_devise: string
          p_phone: string
          p_raison_sociale: string
          p_user_id?: string
        }
        Returns: Json
      }
      setup_first_superadmin: {
        Args: { target_email: string }
        Returns: undefined
      }
      verify_superadmin_pin: { Args: { pin: string }; Returns: boolean }
      wf_is_actor_in_instance: {
        Args: { p_instance_id: string }
        Returns: boolean
      }
    }
    Enums: {
      global_role:
        | "super_admin"
        | "admin"
        | "user"
        | "tenant_admin"
        | "tenant_user"
      module_key:
        | "comptabilite"
        | "vente"
        | "achat"
        | "stock"
        | "rh"
        | "crm"
        | "teams"
        | "workflow"
        | "rapports"
        | "securite"
        | "sauvegarde"
        | "presence"
        | "planning"
      permission_level:
        | "aucun"
        | "lecteur"
        | "contributeur"
        | "gestionnaire"
        | "admin"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      global_role: [
        "super_admin",
        "admin",
        "user",
        "tenant_admin",
        "tenant_user",
      ],
      module_key: [
        "comptabilite",
        "vente",
        "achat",
        "stock",
        "rh",
        "crm",
        "teams",
        "workflow",
        "rapports",
        "securite",
        "sauvegarde",
        "presence",
        "planning",
      ],
      permission_level: [
        "aucun",
        "lecteur",
        "contributeur",
        "gestionnaire",
        "admin",
      ],
    },
  },
} as const
