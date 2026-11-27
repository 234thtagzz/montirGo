
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_logs": {
                  Row: {
                    "activity_type": string,"created_at": string,"description": string | null,"id": string,"related_entity_id": string | null,"related_entity_type": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_type": string,"created_at"?: string,"description"?: string | null,"id"?: string,"related_entity_id"?: string | null,"related_entity_type"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "activity_type"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"related_entity_id"?: string | null,"related_entity_type"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_chat_messages": {
                  Row: {
                    "content": string,"created_at": string,"id": string,"mode": string,"model_used": string | null,"persona": string,"request_id": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"id"?: string,"mode"?: string,"model_used"?: string | null,"persona"?: string,"request_id"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"id"?: string,"mode"?: string,"model_used"?: string | null,"persona"?: string,"request_id"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_chat_messages_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chat_messages_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chat_messages_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chat_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chat_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_diagnoses": {
                  Row: {
                    "created_at": string,"disclaimer": string,"estimated_complexity": string | null,"id": string,"possible_issues": NonNullable<Json>,"questions_for_client": (string)[],"raw_response": Json | null,"recommended_checks": (string)[],"request_id": string,"risk_level": string,"suggested_tools": (string)[],"symptoms_summary": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"disclaimer"?: string,"estimated_complexity"?: string | null,"id"?: string,"possible_issues"?: NonNullable<Json>,"questions_for_client"?: (string)[],"raw_response"?: Json | null,"recommended_checks"?: (string)[],"request_id": string,"risk_level"?: string,"suggested_tools"?: (string)[],"symptoms_summary"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"disclaimer"?: string,"estimated_complexity"?: string | null,"id"?: string,"possible_issues"?: NonNullable<Json>,"questions_for_client"?: (string)[],"raw_response"?: Json | null,"recommended_checks"?: (string)[],"request_id"?: string,"risk_level"?: string,"suggested_tools"?: (string)[],"symptoms_summary"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_diagnoses_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_diagnoses_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_diagnoses_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage_logs": {
                  Row: {
                    "created_at": string,"endpoint": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"endpoint": string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"endpoint"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_usage_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"complaints": {
                  Row: {
                    "admin_reply": string | null,"category": string,"created_at": string,"description": string,"id": string,"photo_paths": (string)[],"reporter_id": string,"reporter_role": string,"request_id": string,"resolved_at": string | null,"resolved_by": string | null,"status": string,"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_reply"?: string | null,"category": string,"created_at"?: string,"description": string,"id"?: string,"photo_paths"?: (string)[],"reporter_id": string,"reporter_role": string,"request_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"subject": string,"updated_at"?: string
                  }
                  Update: {
                    "admin_reply"?: string | null,"category"?: string,"created_at"?: string,"description"?: string,"id"?: string,"photo_paths"?: (string)[],"reporter_id"?: string,"reporter_role"?: string,"request_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "complaints_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"device_push_tokens": {
                  Row: {
                    "created_at": string,"device_name": string | null,"expo_push_token": string,"id": string,"is_active": boolean,"last_seen_at": string,"platform": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"device_name"?: string | null,"expo_push_token": string,"id"?: string,"is_active"?: boolean,"last_seen_at"?: string,"platform": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"device_name"?: string | null,"expo_push_token"?: string,"id"?: string,"is_active"?: boolean,"last_seen_at"?: string,"platform"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "device_push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"earnings": {
                  Row: {
                    "available_at": string,"created_at": string,"gross_amount": number,"id": string,"mechanic_id": string,"net_amount": number,"payment_id": string | null,"payment_method": string,"period_date": string,"platform_fee": number,"request_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "available_at"?: string,"created_at"?: string,"gross_amount": number,"id"?: string,"mechanic_id": string,"net_amount": number,"payment_id"?: string | null,"payment_method"?: string,"period_date"?: string,"platform_fee"?: number,"request_id": string,"status"?: string
                  }
                  Update: {
                    "available_at"?: string,"created_at"?: string,"gross_amount"?: number,"id"?: string,"mechanic_id"?: string,"net_amount"?: number,"payment_id"?: string | null,"payment_method"?: string,"period_date"?: string,"platform_fee"?: number,"request_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "earnings_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "earnings_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "earnings_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["payment_id"]
    },{
      foreignKeyName: "earnings_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "earnings_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "earnings_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "earnings_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"mechanic_locations": {
                  Row: {
                    "accuracy_meters": number | null,"id": string,"lat": number,"lng": number,"mechanic_id": string,"recorded_at": string,"request_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_meters"?: number | null,"id"?: string,"lat": number,"lng": number,"mechanic_id": string,"recorded_at"?: string,"request_id"?: string | null
                  }
                  Update: {
                    "accuracy_meters"?: number | null,"id"?: string,"lat"?: number,"lng"?: number,"mechanic_id"?: string,"recorded_at"?: string,"request_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mechanic_locations_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_locations_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_locations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_locations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_locations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"mechanic_payout_accounts": {
                  Row: {
                    "account_holder_name": string,"account_number": string,"bank_code": string,"created_at": string,"id": string,"is_primary": boolean,"mechanic_id": string,"routing_type": string | null,"routing_value": string | null,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_holder_name": string,"account_number": string,"bank_code": string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"mechanic_id": string,"routing_type"?: string | null,"routing_value"?: string | null,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "account_holder_name"?: string,"account_number"?: string,"bank_code"?: string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"mechanic_id"?: string,"routing_type"?: string | null,"routing_value"?: string | null,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mechanic_payout_accounts_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_payout_accounts_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mechanic_profiles": {
                  Row: {
                    "bio": string | null,"certifications": (string)[],"created_at": string,"current_lat": number | null,"current_lng": number | null,"experience_years": number | null,"is_available": boolean,"is_online": boolean,"is_verified": boolean,"last_location_at": string | null,"location": unknown,"profile_id": string,"rating_avg": number,"rating_count": number,"service_radius_km": number,"skills": (string)[],"total_jobs": number,"updated_at": string,"vehicle_specialization": (string)[],"verified_at": string | null,"verified_by": string | null,"workshop_address": string | null,"workshop_name": string | null,"workshop_photos": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"certifications"?: (string)[],"created_at"?: string,"current_lat"?: number | null,"current_lng"?: number | null,"experience_years"?: number | null,"is_available"?: boolean,"is_online"?: boolean,"is_verified"?: boolean,"last_location_at"?: string | null,"location"?: unknown,"profile_id": string,"rating_avg"?: number,"rating_count"?: number,"service_radius_km"?: number,"skills"?: (string)[],"total_jobs"?: number,"updated_at"?: string,"vehicle_specialization"?: (string)[],"verified_at"?: string | null,"verified_by"?: string | null,"workshop_address"?: string | null,"workshop_name"?: string | null,"workshop_photos"?: (string)[]
                  }
                  Update: {
                    "bio"?: string | null,"certifications"?: (string)[],"created_at"?: string,"current_lat"?: number | null,"current_lng"?: number | null,"experience_years"?: number | null,"is_available"?: boolean,"is_online"?: boolean,"is_verified"?: boolean,"last_location_at"?: string | null,"location"?: unknown,"profile_id"?: string,"rating_avg"?: number,"rating_count"?: number,"service_radius_km"?: number,"skills"?: (string)[],"total_jobs"?: number,"updated_at"?: string,"vehicle_specialization"?: (string)[],"verified_at"?: string | null,"verified_by"?: string | null,"workshop_address"?: string | null,"workshop_name"?: string | null,"workshop_photos"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "mechanic_profiles_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_profiles_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_profiles_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_profiles_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mechanic_wallets": {
                  Row: {
                    "available_balance": number,"commission_debt": number,"held_balance": number,"mechanic_id": string,"pending_balance": number,"total_earned": number,"total_withdrawn": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "available_balance"?: number,"commission_debt"?: number,"held_balance"?: number,"mechanic_id": string,"pending_balance"?: number,"total_earned"?: number,"total_withdrawn"?: number,"updated_at"?: string
                  }
                  Update: {
                    "available_balance"?: number,"commission_debt"?: number,"held_balance"?: number,"mechanic_id"?: string,"pending_balance"?: number,"total_earned"?: number,"total_withdrawn"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mechanic_wallets_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: true
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_wallets_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"is_read": boolean,"related_entity_id": string | null,"related_entity_type": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"is_read"?: boolean,"related_entity_id"?: string | null,"related_entity_type"?: string | null,"title": string,"type"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"is_read"?: boolean,"related_entity_id"?: string | null,"related_entity_type"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_invoice_items": {
                  Row: {
                    "amount": number,"created_at": string,"description": string,"id": string,"mechanic_id": string,"request_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"description": string,"id"?: string,"mechanic_id": string,"request_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"description"?: string,"id"?: string,"mechanic_id"?: string,"request_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_invoice_items_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_invoice_items_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_invoice_items_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_invoice_items_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_invoice_items_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "created_at": string,"event_id": string | null,"event_type": string,"id": string,"payload": Json | null,"payment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id"?: string | null,"event_type": string,"id"?: string,"payload"?: Json | null,"payment_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string | null,"event_type"?: string,"id"?: string,"payload"?: Json | null,"payment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_events_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["payment_id"]
    },{
      foreignKeyName: "payment_events_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"attempt_no": number,"created_at": string,"currency": string,"expires_at": string | null,"external_payment_id": string | null,"fee_percent": number,"gateway_reference": string | null,"id": string,"method": string,"net_amount": number,"paid_at": string | null,"payment_session_id": string | null,"payment_url": string | null,"platform_fee": number,"qr_payload": string | null,"request_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"attempt_no"?: number,"created_at"?: string,"currency"?: string,"expires_at"?: string | null,"external_payment_id"?: string | null,"fee_percent"?: number,"gateway_reference"?: string | null,"id"?: string,"method"?: string,"net_amount": number,"paid_at"?: string | null,"payment_session_id"?: string | null,"payment_url"?: string | null,"platform_fee"?: number,"qr_payload"?: string | null,"request_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"attempt_no"?: number,"created_at"?: string,"currency"?: string,"expires_at"?: string | null,"external_payment_id"?: string | null,"fee_percent"?: number,"gateway_reference"?: string | null,"id"?: string,"method"?: string,"net_amount"?: number,"paid_at"?: string | null,"payment_session_id"?: string | null,"payment_url"?: string | null,"platform_fee"?: number,"qr_payload"?: string | null,"request_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": string
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profile_identities": {
                  Row: {
                    "created_at": string,"identity_number": string,"profile_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"identity_number": string,"profile_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"identity_number"?: string,"profile_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_identities_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_identities_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string | null,"full_name": string | null,"id": string,"phone_number": string | null,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"phone_number"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"phone_number"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "client_id": string,"comment": string | null,"created_at": string,"id": string,"is_visible": boolean,"mechanic_id": string,"mechanic_reply": string | null,"rating": number,"replied_at": string | null,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"comment"?: string | null,"created_at"?: string,"id"?: string,"is_visible"?: boolean,"mechanic_id": string,"mechanic_reply"?: string | null,"rating": number,"replied_at"?: string | null,"request_id": string
                  }
                  Update: {
                    "client_id"?: string,"comment"?: string | null,"created_at"?: string,"id"?: string,"is_visible"?: boolean,"mechanic_id"?: string,"mechanic_reply"?: string | null,"rating"?: number,"replied_at"?: string | null,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"service_request_assignment_rejections": {
                  Row: {
                    "client_id": string,"created_at": string,"mechanic_id": string,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"mechanic_id": string,"request_id": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"mechanic_id"?: string,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_request_assignment_rejections_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_assignment_rejections_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_assignment_rejections_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_assignment_rejections_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_assignment_rejections_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_assignment_rejections_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_assignment_rejections_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"service_request_status_history": {
                  Row: {
                    "changed_by": string | null,"created_at": string,"from_status": string | null,"id": string,"notes": string | null,"request_id": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_by"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: string,"notes"?: string | null,"request_id": string,"to_status": string
                  }
                  Update: {
                    "changed_by"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: string,"notes"?: string | null,"request_id"?: string,"to_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_request_status_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_status_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_status_history_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_status_history_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_request_status_history_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"service_requests": {
                  Row: {
                    "accepted_at": string | null,"additional_notes": string | null,"address": string | null,"ai_summary": string | null,"arrived_at": string | null,"assignment_expires_at": string | null,"assignment_requested_at": string | null,"client_id": string,"completed_at": string | null,"contact_phone": string,"created_at": string,"currency": string,"id": string,"issue_description": string,"lat": number,"lng": number,"location": unknown,"mechanic_id": string | null,"payment_method": string | null,"photo_urls": (string)[],"price_amount": number | null,"route_distance_m": number | null,"route_duration_s": number | null,"route_polyline": string | null,"route_updated_at": string | null,"status": string,"symptoms": string | null,"updated_at": string,"vehicle_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"additional_notes"?: string | null,"address"?: string | null,"ai_summary"?: string | null,"arrived_at"?: string | null,"assignment_expires_at"?: string | null,"assignment_requested_at"?: string | null,"client_id": string,"completed_at"?: string | null,"contact_phone": string,"created_at"?: string,"currency"?: string,"id"?: string,"issue_description": string,"lat": number,"lng": number,"location"?: unknown,"mechanic_id"?: string | null,"payment_method"?: string | null,"photo_urls"?: (string)[],"price_amount"?: number | null,"route_distance_m"?: number | null,"route_duration_s"?: number | null,"route_polyline"?: string | null,"route_updated_at"?: string | null,"status"?: string,"symptoms"?: string | null,"updated_at"?: string,"vehicle_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"additional_notes"?: string | null,"address"?: string | null,"ai_summary"?: string | null,"arrived_at"?: string | null,"assignment_expires_at"?: string | null,"assignment_requested_at"?: string | null,"client_id"?: string,"completed_at"?: string | null,"contact_phone"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"issue_description"?: string,"lat"?: number,"lng"?: number,"location"?: unknown,"mechanic_id"?: string | null,"payment_method"?: string | null,"photo_urls"?: (string)[],"price_amount"?: number | null,"route_distance_m"?: number | null,"route_duration_s"?: number | null,"route_polyline"?: string | null,"route_updated_at"?: string | null,"status"?: string,"symptoms"?: string | null,"updated_at"?: string,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "brand": string,"created_at": string,"id": string,"license_plate": string,"model": string,"notes": string | null,"owner_id": string,"photo_url": string | null,"type": string,"updated_at": string,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand": string,"created_at"?: string,"id"?: string,"license_plate": string,"model": string,"notes"?: string | null,"owner_id": string,"photo_url"?: string | null,"type": string,"updated_at"?: string,"year"?: number | null
                  }
                  Update: {
                    "brand"?: string,"created_at"?: string,"id"?: string,"license_plate"?: string,"model"?: string,"notes"?: string | null,"owner_id"?: string,"photo_url"?: string | null,"type"?: string,"updated_at"?: string,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicles_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wallet_transactions": {
                  Row: {
                    "amount": number,"balance_after": number,"bucket": string,"created_at": string,"id": string,"mechanic_id": string,"note": string | null,"ref_id": string | null,"ref_type": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"balance_after": number,"bucket"?: string,"created_at"?: string,"id"?: string,"mechanic_id": string,"note"?: string | null,"ref_id"?: string | null,"ref_type"?: string | null,"type": string
                  }
                  Update: {
                    "amount"?: number,"balance_after"?: number,"bucket"?: string,"created_at"?: string,"id"?: string,"mechanic_id"?: string,"note"?: string | null,"ref_id"?: string | null,"ref_type"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wallet_transactions_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wallet_transactions_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"withdrawal_events": {
                  Row: {
                    "created_at": string,"event_id": string | null,"event_type": string,"id": string,"payload": Json | null,"withdrawal_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id"?: string | null,"event_type": string,"id"?: string,"payload"?: Json | null,"withdrawal_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string | null,"event_type"?: string,"id"?: string,"payload"?: Json | null,"withdrawal_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "withdrawal_events_withdrawal_id_fkey"
      columns: ["withdrawal_id"]
isOneToOne: false
      referencedRelation: "withdrawals"
      referencedColumns: ["id"]
    }
                  ]
                },"withdrawals": {
                  Row: {
                    "account_snapshot": NonNullable<Json>,"amount": number,"completed_at": string | null,"created_at": string,"failure_code": string | null,"fee": number,"id": string,"mechanic_id": string,"payout_account_id": string | null,"reference_id": string,"status": string,"updated_at": string,"xendit_payout_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_snapshot"?: NonNullable<Json>,"amount": number,"completed_at"?: string | null,"created_at"?: string,"failure_code"?: string | null,"fee"?: number,"id"?: string,"mechanic_id": string,"payout_account_id"?: string | null,"reference_id": string,"status"?: string,"updated_at"?: string,"xendit_payout_id"?: string | null
                  }
                  Update: {
                    "account_snapshot"?: NonNullable<Json>,"amount"?: number,"completed_at"?: string | null,"created_at"?: string,"failure_code"?: string | null,"fee"?: number,"id"?: string,"mechanic_id"?: string,"payout_account_id"?: string | null,"reference_id"?: string,"status"?: string,"updated_at"?: string,"xendit_payout_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "withdrawals_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "withdrawals_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "withdrawals_payout_account_id_fkey"
      columns: ["payout_account_id"]
isOneToOne: false
      referencedRelation: "mechanic_payout_accounts"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "admin_complaint_overview": {
                  Row: {
                    "admin_reply": string | null,"category": string,"created_at": string,"description": string,"id": string,"order_created_at": string,"order_issue": string,"order_status": string,"photo_paths": (string)[],"reporter_email": string | null,"reporter_id": string,"reporter_name": string | null,"reporter_phone": string | null,"reporter_role": string,"request_id": string,"resolved_at": string | null,"resolved_by": string | null,"status": string,"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "complaints_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "admin_transaction_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "mechanic_open_request_view"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "service_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "complaints_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_transaction_overview": {
                  Row: {
                    "accepted_at": string | null,"additional_notes": string | null,"address": string | null,"arrived_at": string | null,"client_email": string | null,"client_id": string,"client_name": string | null,"client_phone": string | null,"completed_at": string | null,"contact_phone": string,"created_at": string,"currency": string,"id": string,"invoice_item_count": number | null,"invoice_total": number | null,"issue_description": string,"lat": number,"license_plate": string | null,"lng": number,"mechanic_email": string | null,"mechanic_id": string | null,"mechanic_name": string | null,"mechanic_phone": string | null,"net_amount": number | null,"paid_at": string | null,"payment_amount": number | null,"payment_id": string | null,"payment_method": string | null,"payment_method_used": string | null,"payment_status": string | null,"platform_fee": number | null,"price_amount": number | null,"status": string,"symptoms": string | null,"vehicle_brand": string | null,"vehicle_id": string | null,"vehicle_model": string | null,"vehicle_type": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_user_directory": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"certifications": (string)[] | null,"client_request_count": number | null,"created_at": string,"current_lat": number | null,"current_lng": number | null,"email": string | null,"experience_years": number | null,"full_name": string | null,"id": string,"identity_number": string | null,"is_available": boolean | null,"is_online": boolean | null,"is_verified": boolean | null,"last_location_at": string | null,"mechanic_request_count": number | null,"phone_number": string | null,"rating_avg": number | null,"rating_count": number | null,"role": string | null,"skills": (string)[] | null,"total_earned": number | null,"total_jobs": number | null,"total_spent": number | null,"updated_at": string,"vehicle_count": number | null,"vehicle_specialization": (string)[] | null,"verified_at": string | null,"workshop_address": string | null,"workshop_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"mechanic_assignment_profile": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"certifications": (string)[],"experience_years": number | null,"full_name": string | null,"is_verified": boolean,"profile_id": string,"rating_avg": number,"rating_count": number,"skills": (string)[],"total_jobs": number,"vehicle_specialization": (string)[],"verified_at": string | null,"workshop_address": string | null,"workshop_name": string | null,"workshop_photo": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "mechanic_profiles_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_profiles_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mechanic_directory": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"certifications": (string)[],"experience_years": number | null,"full_name": string | null,"is_available": boolean,"is_online": boolean,"is_verified": boolean,"profile_id": string,"rating_avg": number,"rating_count": number,"skills": (string)[],"total_jobs": number,"vehicle_specialization": (string)[],"verified_at": string | null,"workshop_address": string | null,"workshop_name": string | null,"workshop_photo": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "mechanic_profiles_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mechanic_profiles_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mechanic_open_request_view": {
                  Row: {
                    "additional_notes": string | null,"address_area": string | null,"ai_analysis": Json | null,"ai_created_at": string | null,"client_avatar_url": string | null,"client_id": string,"client_joined_at": string | null,"client_name": string | null,"client_total_requests": number | null,"created_at": string,"distance_km": number | null,"id": string,"issue_description": string,"status": string,"symptoms": string | null,"vehicle_brand": string | null,"vehicle_model": string | null,"vehicle_photo_url": string | null,"vehicle_type": string | null,"vehicle_year": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mechanic_review_view": {
                  Row: {
                    "comment": string | null,"created_at": string,"id": string,"mechanic_id": string,"mechanic_reply": string | null,"rating": number,"replied_at": string | null,"reviewer_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "reviews_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "admin_user_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_mechanic_id_fkey"
      columns: ["mechanic_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_service_request":
{ Args: { "p_request_id": string }; Returns: Json
                           },
"cancel_order":
{ Args: { "p_reason"?: string,"p_request_id": string }; Returns: {
              "accepted_at": string | null,
"additional_notes": string | null,
"address": string | null,
"ai_summary": string | null,
"arrived_at": string | null,
"assignment_expires_at": string | null,
"assignment_requested_at": string | null,
"client_id": string,
"completed_at": string | null,
"contact_phone": string,
"created_at": string,
"currency": string,
"id": string,
"issue_description": string,
"lat": number,
"lng": number,
"location": unknown,
"mechanic_id": string | null,
"payment_method": string | null,
"photo_urls": (string)[],
"price_amount": number | null,
"route_distance_m": number | null,
"route_duration_s": number | null,
"route_polyline": string | null,
"route_updated_at": string | null,
"status": string,
"symptoms": string | null,
"updated_at": string,
"vehicle_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"check_and_log_ai_rate_limit":
{ Args: { "p_endpoint": string,"p_max_per_day"?: number,"p_max_per_hour"?: number,"p_user_id": string }; Returns: Json
                           },
"choose_payment_method":
{ Args: { "p_method": string,"p_request_id": string }; Returns: {
              "accepted_at": string | null,
"additional_notes": string | null,
"address": string | null,
"ai_summary": string | null,
"arrived_at": string | null,
"assignment_expires_at": string | null,
"assignment_requested_at": string | null,
"client_id": string,
"completed_at": string | null,
"contact_phone": string,
"created_at": string,
"currency": string,
"id": string,
"issue_description": string,
"lat": number,
"lng": number,
"location": unknown,
"mechanic_id": string | null,
"payment_method": string | null,
"photo_urls": (string)[],
"price_amount": number | null,
"route_distance_m": number | null,
"route_duration_s": number | null,
"route_polyline": string | null,
"route_updated_at": string | null,
"status": string,
"symptoms": string | null,
"updated_at": string,
"vehicle_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"cleanup_old_operational_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"confirm_cash_payment":
{ Args: { "p_mechanic_id": string,"p_request_id": string }; Returns: {
              "amount": number,
"attempt_no": number,
"created_at": string,
"currency": string,
"expires_at": string | null,
"external_payment_id": string | null,
"fee_percent": number,
"gateway_reference": string | null,
"id": string,
"method": string,
"net_amount": number,
"paid_at": string | null,
"payment_session_id": string | null,
"payment_url": string | null,
"platform_fee": number,
"qr_payload": string | null,
"request_id": string,
"status": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "payments"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_service_request":
{ Args: { "p_additional_notes"?: string,"p_address"?: string,"p_contact_phone"?: string,"p_issue_description"?: string,"p_lat"?: number,"p_lng"?: number,"p_symptoms"?: string,"p_vehicle_id"?: string }; Returns: {
              "accepted_at": string | null,
"additional_notes": string | null,
"address": string | null,
"ai_summary": string | null,
"arrived_at": string | null,
"assignment_expires_at": string | null,
"assignment_requested_at": string | null,
"client_id": string,
"completed_at": string | null,
"contact_phone": string,
"created_at": string,
"currency": string,
"id": string,
"issue_description": string,
"lat": number,
"lng": number,
"location": unknown,
"mechanic_id": string | null,
"payment_method": string | null,
"photo_urls": (string)[],
"price_amount": number | null,
"route_distance_m": number | null,
"route_duration_s": number | null,
"route_polyline": string | null,
"route_updated_at": string | null,
"status": string,
"symptoms": string | null,
"updated_at": string,
"vehicle_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"deactivate_my_push_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"expire_stale_assignments":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"expire_stale_requests":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finalize_order_invoice":
{ Args: { "p_request_id": string }; Returns: {
              "accepted_at": string | null,
"additional_notes": string | null,
"address": string | null,
"ai_summary": string | null,
"arrived_at": string | null,
"assignment_expires_at": string | null,
"assignment_requested_at": string | null,
"client_id": string,
"completed_at": string | null,
"contact_phone": string,
"created_at": string,
"currency": string,
"id": string,
"issue_description": string,
"lat": number,
"lng": number,
"location": unknown,
"mechanic_id": string | null,
"payment_method": string | null,
"photo_urls": (string)[],
"price_amount": number | null,
"route_distance_m": number | null,
"route_duration_s": number | null,
"route_polyline": string | null,
"route_updated_at": string | null,
"status": string,
"symptoms": string | null,
"updated_at": string,
"vehicle_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"finalize_payment":
{ Args: { "p_payment_id": string }; Returns: undefined
                           },
"has_role":
{ Args: { "required_role": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_nearby_mechanics":
{ Args: { "p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_radius_km"?: number }; Returns: {
              "avatar_url": string,"bio": string,"certifications": (string)[],"distance_km": number,"experience_years": number,"full_name": string,"is_available": boolean,"is_online": boolean,"is_verified": boolean,"profile_id": string,"rating_avg": number,"rating_count": number,"skills": (string)[],"total_jobs": number,"vehicle_specialization": (string)[],"verified_at": string,"workshop_address": string,"workshop_name": string,"workshop_photo": string
            }[]
                           },
"list_nearby_open_requests":
{ Args: { "p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_radius_km"?: number }; Returns: {
              "address_area": string,"ai_analysis": Json,"client_avatar_url": string,"client_name": string,"created_at": string,"distance_km": number,"id": string,"issue_description": string,"status": string,"symptoms": string,"vehicle_brand": string,"vehicle_model": string,"vehicle_photo_url": string,"vehicle_type": string
            }[]
                           },
"mask_address_area":
{ Args: { "p_address": string }; Returns: string
                           },
"mechanic_active_order_id":
{ Args: { "p_mechanic_id": string }; Returns: string
                           },
"notify_nearby_mechanics":
{ Args: { "p_exclude_mechanic"?: string,"p_request_id": string }; Returns: undefined
                           },
"record_commission_topup":
{ Args: { "p_amount": number,"p_mechanic_id": string,"p_note"?: string,"p_ref_id"?: string }; Returns: {
              "available_balance": number,
"commission_debt": number,
"held_balance": number,
"mechanic_id": string,
"pending_balance": number,
"total_earned": number,
"total_withdrawn": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "mechanic_wallets"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_mechanic_location":
{ Args: { "p_accuracy"?: number,"p_lat": number,"p_lng": number,"p_request_id": string,"p_route_distance_m"?: number,"p_route_duration_s"?: number,"p_route_polyline"?: string }; Returns: undefined
                           },
"refresh_mechanic_jobs":
{ Args: { "p_mechanic_id": string }; Returns: undefined
                           },
"refresh_mechanic_rating":
{ Args: { "p_mechanic_id": string }; Returns: undefined
                           },
"refresh_my_wallet":
{ Args: Record<PropertyKey, never>; Returns: {
              "available_balance": number,
"commission_debt": number,
"held_balance": number,
"mechanic_id": string,
"pending_balance": number,
"total_earned": number,
"total_withdrawn": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "mechanic_wallets"
        isOneToOne: true
        isSetofReturn: false
      } },
"release_matured_earnings":
{ Args: { "p_batch_limit"?: number,"p_mechanic_id"?: string }; Returns: number
                           },
"reopen_order_invoice":
{ Args: { "p_request_id": string }; Returns: {
              "accepted_at": string | null,
"additional_notes": string | null,
"address": string | null,
"ai_summary": string | null,
"arrived_at": string | null,
"assignment_expires_at": string | null,
"assignment_requested_at": string | null,
"client_id": string,
"completed_at": string | null,
"contact_phone": string,
"created_at": string,
"currency": string,
"id": string,
"issue_description": string,
"lat": number,
"lng": number,
"location": unknown,
"mechanic_id": string | null,
"payment_method": string | null,
"photo_urls": (string)[],
"price_amount": number | null,
"route_distance_m": number | null,
"route_duration_s": number | null,
"route_polyline": string | null,
"route_updated_at": string | null,
"status": string,
"symptoms": string | null,
"updated_at": string,
"vehicle_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"reply_to_review":
{ Args: { "p_reply": string,"p_review_id": string }; Returns: {
              "client_id": string,
"comment": string | null,
"created_at": string,
"id": string,
"is_visible": boolean,
"mechanic_id": string,
"mechanic_reply": string | null,
"rating": number,
"replied_at": string | null,
"request_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "reviews"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_withdrawal":
{ Args: { "p_account_id": string,"p_amount": number,"p_mechanic_id": string }; Returns: {
              "account_snapshot": NonNullable<Json>,
"amount": number,
"completed_at": string | null,
"created_at": string,
"failure_code": string | null,
"fee": number,
"id": string,
"mechanic_id": string,
"payout_account_id": string | null,
"reference_id": string,
"status": string,
"updated_at": string,
"xendit_payout_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "withdrawals"
        isOneToOne: true
        isSetofReturn: false
      } },
"respond_to_assignment":
{ Args: { "p_action": string,"p_request_id": string }; Returns: Json
                           },
"set_mechanic_online_status":
{ Args: { "p_is_online": boolean,"p_lat"?: number,"p_lng"?: number }; Returns: {
              "bio": string | null,
"certifications": (string)[],
"created_at": string,
"current_lat": number | null,
"current_lng": number | null,
"experience_years": number | null,
"is_available": boolean,
"is_online": boolean,
"is_verified": boolean,
"last_location_at": string | null,
"location": unknown,
"profile_id": string,
"rating_avg": number,
"rating_count": number,
"service_radius_km": number,
"skills": (string)[],
"total_jobs": number,
"updated_at": string,
"vehicle_specialization": (string)[],
"verified_at": string | null,
"verified_by": string | null,
"workshop_address": string | null,
"workshop_name": string | null,
"workshop_photos": (string)[]
            }
                          SetofOptions: {
        from: "*"
        to: "mechanic_profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_my_identity_number":
{ Args: { "p_identity_number": string }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_role": string,"p_user_id": string }; Returns: {
              "avatar_url": string | null,
"created_at": string,
"email": string | null,
"full_name": string | null,
"id": string,
"phone_number": string | null,
"role": Database["public"]['Enums']["app_role"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"setting_int":
{ Args: { "p_default": number,"p_key": string }; Returns: number
                           },
"settle_withdrawal":
{ Args: { "p_failure_code"?: string,"p_status": string,"p_withdrawal_id": string }; Returns: undefined
                           },
"transition_order_status":
{ Args: { "p_request_id": string,"p_to_status": string }; Returns: {
              "accepted_at": string | null,
"additional_notes": string | null,
"address": string | null,
"ai_summary": string | null,
"arrived_at": string | null,
"assignment_expires_at": string | null,
"assignment_requested_at": string | null,
"client_id": string,
"completed_at": string | null,
"contact_phone": string,
"created_at": string,
"currency": string,
"id": string,
"issue_description": string,
"lat": number,
"lng": number,
"location": unknown,
"mechanic_id": string | null,
"payment_method": string | null,
"photo_urls": (string)[],
"price_amount": number | null,
"route_distance_m": number | null,
"route_duration_s": number | null,
"route_polyline": string | null,
"route_updated_at": string | null,
"status": string,
"symptoms": string | null,
"updated_at": string,
"vehicle_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "service_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"upsert_my_push_token":
{ Args: { "p_device_name"?: string,"p_platform": string,"p_token": string }; Returns: {
              "created_at": string,
"device_name": string | null,
"expo_push_token": string,
"id": string,
"is_active": boolean,
"last_seen_at": string,
"platform": string,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "device_push_tokens"
        isOneToOne: true
        isSetofReturn: false
      } },
"vehicle_photo_visible":
{ Args: { "p_path": string }; Returns: boolean
                           },
"workshop_photo_visible":
{ Args: { "p_path": string }; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "client"|"mechanic"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["client", "mechanic", "admin"]
          }
        }
} as const
